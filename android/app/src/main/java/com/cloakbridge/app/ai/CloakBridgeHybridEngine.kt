package com.cloakbridge.app.ai

import android.graphics.Bitmap
import android.os.SystemClock
import android.util.Log
import com.cloakbridge.app.data.LocalVaultEngine
import com.cloakbridge.app.data.VaultEntry
import com.google.firebase.Firebase
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.ai
import com.google.firebase.ai.ondevice.DownloadStatus
import com.google.firebase.ai.ondevice.FirebaseAIOnDevice
import com.google.firebase.ai.ondevice.OnDeviceModelStatus
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

data class HybridAiResponse(
    val text: String,
    val inferenceSource: String, // "ON_DEVICE" | "IN_CLOUD" | "LOCAL_RULE"
    val modelName: String,
    val latencyMs: Long
)

data class TelemetryLogItem(
    val stage: String,
    val requestedMode: String,
    val actualSource: String,
    val modelName: String,
    val latencyMs: Long,
    val outboundBytes: Int,
    val note: String
)

/**
 * Native Android Hybrid Inference Engine powered by Firebase AI Logic:
 * - firebase-ai:18.2.0
 * - firebase-ai-ondevice:16.0.0-beta08 (Gemini Nano 4 via ML Kit Prompt API / AICore)
 *
 * Intentionally demonstrates ALL FOUR Firebase AI Logic InferenceModes:
 * 1. ONLY_ON_DEVICE   -> Multimodal image OCR & semantic PII Shield (0 raw PII leaves device)
 * 2. PREFER_ON_DEVICE -> Instant offline triage ($0 cloud cost, seamless cloud fallback)
 * 3. ONLY_IN_CLOUD    -> Deep audit on strictly zero-leak-verified scrubbed payload
 * 4. PREFER_IN_CLOUD  -> Formal dispute letter drafter with offline Nano fallback + local rehydration
 */
@OptIn(PublicPreviewAPI::class)
class CloakBridgeHybridEngine {

    private val aiBackend get() = Firebase.ai(backend = GenerativeBackend.googleAI())

    @Suppress("DEPRECATION")
    suspend fun checkNanoStatus(): String {
        return try {
            when (FirebaseAIOnDevice.checkStatus()) {
                OnDeviceModelStatus.AVAILABLE -> "AVAILABLE"
                OnDeviceModelStatus.DOWNLOADABLE -> "DOWNLOADABLE"
                OnDeviceModelStatus.DOWNLOADING -> "DOWNLOADING"
                else -> "UNAVAILABLE"
            }
        } catch (e: Exception) {
            Log.w("CloakBridgeAI", "Unable to check on-device status: ${e.message}")
            "UNAVAILABLE"
        }
    }

    @Suppress("DEPRECATION")
    fun downloadNanoModel(): Flow<String> {
        return FirebaseAIOnDevice.download().map { status ->
            when (status) {
                is DownloadStatus.DownloadStarted ->
                    "Starting Gemini Nano download (${status.bytesToDownload / (1024 * 1024)} MB)..."
                is DownloadStatus.DownloadInProgress ->
                    "Downloading Gemini Nano (${status.totalBytesDownloaded / (1024 * 1024)} MB)..."
                is DownloadStatus.DownloadCompleted ->
                    "AVAILABLE"
                is DownloadStatus.DownloadFailed ->
                    "Download failed: $status"
                else -> "Downloading..."
            }
        }
    }

    /**
     * STAGE 0 — Multimodal On-Device OCR (ONLY_ON_DEVICE)
     * Captures a paper medical bill / contract Bitmap and extracts text strictly locally.
     */
    suspend fun extractTextFromBitmapOnDevice(
        bitmap: Bitmap,
        cloudModelPlaceholder: String
    ): HybridAiResponse {
        val t0 = SystemClock.elapsedRealtime()
        val model = aiBackend.generativeModel(
            modelName = cloudModelPlaceholder,
            onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE)
        )
        val prompt = content {
            image(bitmap)
            text("Transcribe all visible text, names, account IDs, dates, and charges from this document verbatim.")
        }
        val response = model.generateContent(prompt)
        return HybridAiResponse(
            text = response.text.orEmpty().trim(),
            inferenceSource = response.inferenceSource.toString(),
            modelName = "Gemini Nano 4 Multimodal (On-Device)",
            latencyMs = SystemClock.elapsedRealtime() - t0
        )
    }

    /**
     * STAGE 1 — Local Privacy Shield (ONLY_ON_DEVICE)
     * Uses Gemini Nano 4 strictly locally to extract context-dependent PII/PHI,
     * never falling back to cloud. Merged with LocalVaultEngine deterministic rules.
     */
    suspend fun runLocalPrivacyShield(
        rawText: String,
        policy: String,
        cloudModelPlaceholder: String,
        existingCustom: List<VaultEntry>
    ): Pair<List<VaultEntry>, HybridAiResponse> {
        val t0 = SystemClock.elapsedRealtime()
        val aiDetected = mutableListOf<Pair<String, String>>()
        var actualSource = "LOCAL_RULE"
        var modelUsed = "Deterministic Local Shield (0 cloud bytes)"

        try {
            val nanoModel = aiBackend.generativeModel(
                modelName = cloudModelPlaceholder,
                onDeviceConfig = OnDeviceConfig(
                    mode = InferenceMode.ONLY_ON_DEVICE,
                    maxOutputTokens = 256,
                    temperature = 0.1f
                )
            )
            val prompt = """
                List sensitive PII/PHI values from this $policy document as lines formatted CATEGORY|EXACT_VALUE
                Allowed categories: PERSON, ID, ACCT, PHONE, EMAIL, LOC, DOB, ORG.
                Copy exact substrings only. Do not include dollar prices or CPT codes.

                DOCUMENT:
                ${rawText.take(3500)}
            """.trimIndent()

            val response = nanoModel.generateContent(prompt)
            val lines = response.text.orEmpty().lines()
            for (line in lines) {
                val parts = line.split("|")
                if (parts.size == 2) {
                    val cat = parts[0].trim().uppercase()
                    val value = parts[1].trim()
                    if (cat in setOf("PERSON", "ID", "ACCT", "PHONE", "EMAIL", "LOC", "DOB", "ORG") && value.length >= 3) {
                        aiDetected.add(value to cat)
                    }
                }
            }
            actualSource = response.inferenceSource.toString()
            modelUsed = "Gemini Nano 4 + Local Guardrail"
        } catch (e: Exception) {
            Log.i("CloakBridgeAI", "ONLY_ON_DEVICE Nano unavailable; local deterministic rules enforced: ${e.message}")
        }

        val entries = LocalVaultEngine.buildVault(rawText, aiDetected, existingCustom)
        val latency = SystemClock.elapsedRealtime() - t0
        return entries to HybridAiResponse(
            text = "Vaulted ${entries.size} PII entities strictly on-device.",
            inferenceSource = actualSource,
            modelName = modelUsed,
            latencyMs = latency
        )
    }

    /**
     * STAGE 2 — Instant Offline Triage (PREFER_ON_DEVICE)
     * Prefers Gemini Nano 4 ($0, works in airplane mode) and transparently falls back
     * to Remote-Config-controlled cloud fallback model on unsupported Android devices.
     */
    suspend fun runHybridTriage(
        scrubbedText: String,
        policy: String,
        fallbackCloudModel: String
    ): HybridAiResponse {
        val t0 = SystemClock.elapsedRealtime()
        return try {
            val model = aiBackend.generativeModel(
                modelName = fallbackCloudModel,
                generationConfig = generationConfig {
                    temperature = 0.2f
                    maxOutputTokens = 256
                },
                onDeviceConfig = OnDeviceConfig(
                    mode = InferenceMode.PREFER_ON_DEVICE,
                    maxOutputTokens = 240,
                    temperature = 0.2f
                )
            )
            val prompt = """
                Provide a concise $policy risk triage in 3 bullet points + a Risk Score (0-100).
                Preserve all [TOKEN_N] placeholders verbatim.

                ANONYMIZED DOCUMENT:
                ${scrubbedText.take(3500)}
            """.trimIndent()

            val response = model.generateContent(prompt)
            val src = response.inferenceSource.toString()
            HybridAiResponse(
                text = response.text.orEmpty().trim(),
                inferenceSource = src,
                modelName = if (src == "ON_DEVICE") "Gemini Nano 4 (AICore)" else fallbackCloudModel,
                latencyMs = SystemClock.elapsedRealtime() - t0
            )
        } catch (e: Exception) {
            Log.w("CloakBridgeAI", "Triage offline fallback triggered: ${e.message}")
            HybridAiResponse(
                text = "Offline Local Triage: Scrubbed document flagged high-risk billing/contract clauses. Reconnect to run Deep Cloud Audit.",
                inferenceSource = "LOCAL_RULE",
                modelName = "Offline Deterministic Fallback",
                latencyMs = SystemClock.elapsedRealtime() - t0
            )
        }
    }

    /**
     * STAGE 3 — Deep Cloud Audit (ONLY_IN_CLOUD)
     * Enforces hard Zero-Leak gate BEFORE invoking Cloud Gemini via App Check.
     */
    suspend fun runDeepCloudAudit(
        scrubbedText: String,
        vault: List<VaultEntry>,
        policy: String,
        cloudAuditModel: String,
        strictZeroLeakBlock: Boolean
    ): HybridAiResponse {
        val check = LocalVaultEngine.verifyZeroLeak(scrubbedText, vault)
        if (strictZeroLeakBlock && !check.verified) {
            throw SecurityException("ZERO-LEAK FIREWALL BLOCKED CALL: ${check.leakedValues.joinToString()}")
        }

        val t0 = SystemClock.elapsedRealtime()
        val model = aiBackend.generativeModel(
            modelName = cloudAuditModel,
            generationConfig = generationConfig {
                temperature = 0.25f
                maxOutputTokens = 1200
            },
            onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD)
        )
        val prompt = """
            You are a senior $policy auditor. Audit this ANONYMIZED document for hidden fees, upcoding, illegal/unfair clauses, and consumer protection violations.
            CRITICAL: Preserve all anonymized placeholders ([PERSON_1], [ORG_1], [ID_1], [ACCT_1]) verbatim so the Android client can rehydrate them locally.
            Include:
            1) Executive Summary
            2) Estimated Recoverable / Risk Impact in USD (e.g. Estimated Impact: $2,400)
            3) Top 3 Itemized Findings with concrete action steps.

            ANONYMIZED PAYLOAD:
            $scrubbedText
        """.trimIndent()

        val response = model.generateContent(prompt)
        return HybridAiResponse(
            text = response.text.orEmpty().trim(),
            inferenceSource = response.inferenceSource.toString(),
            modelName = cloudAuditModel,
            latencyMs = SystemClock.elapsedRealtime() - t0
        )
    }

    /**
     * STAGE 4 — Hybrid Dispute Letter Drafter (PREFER_IN_CLOUD)
     * Uses Cloud Gemini when online and falls back to Gemini Nano 4 if connectivity drops.
     */
    suspend fun draftDisputeLetter(
        scrubbedText: String,
        auditSummary: String,
        vault: List<VaultEntry>,
        policy: String,
        cloudAuditModel: String,
        strictZeroLeakBlock: Boolean
    ): HybridAiResponse {
        val check = LocalVaultEngine.verifyZeroLeak(scrubbedText, vault)
        if (strictZeroLeakBlock && !check.verified) {
            throw SecurityException("ZERO-LEAK FIREWALL BLOCKED CALL")
        }

        val t0 = SystemClock.elapsedRealtime()
        val model = aiBackend.generativeModel(
            modelName = cloudAuditModel,
            generationConfig = generationConfig {
                temperature = 0.35f
                maxOutputTokens = 1000
            },
            onDeviceConfig = OnDeviceConfig(
                mode = InferenceMode.PREFER_IN_CLOUD,
                maxOutputTokens = 256
            )
        )
        val prompt = """
            Draft a concise, formal $policy dispute / counter-proposal letter using ONLY the anonymized tokens ([PERSON_1], [ORG_1], [ID_1], [ACCT_1]) present in the document so our Android app can rehydrate them locally.

            AUDIT SUMMARY:
            ${auditSummary.take(1200)}

            ANONYMIZED DOCUMENT:
            ${scrubbedText.take(3000)}
        """.trimIndent()

        val response = model.generateContent(prompt)
        val src = response.inferenceSource.toString()
        return HybridAiResponse(
            text = response.text.orEmpty().trim(),
            inferenceSource = src,
            modelName = if (src == "ON_DEVICE") "Gemini Nano 4 (Offline Fallback)" else cloudAuditModel,
            latencyMs = SystemClock.elapsedRealtime() - t0
        )
    }
}
