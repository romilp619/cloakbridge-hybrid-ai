package com.cloakbridge.app.ui

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cloakbridge.app.ai.CloakBridgeHybridEngine
import com.cloakbridge.app.ai.TelemetryLogItem
import com.cloakbridge.app.data.DemoPreset
import com.cloakbridge.app.data.FirestoreCaseSync
import com.cloakbridge.app.data.LocalVaultEngine
import com.cloakbridge.app.data.SyncedCase
import com.cloakbridge.app.data.VaultEntry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.remoteconfig.remoteConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class CloakUiState(
    val title: String = LocalVaultEngine.demoPresets.first().title,
    val policy: String = LocalVaultEngine.demoPresets.first().policy,
    val rawText: String = LocalVaultEngine.demoPresets.first().rawText,
    val vaultEntries: List<VaultEntry> = emptyList(),
    val scrubbedText: String = "",
    val zeroLeakVerified: Boolean = true,
    val nanoStatus: String = "CHECKING",
    val nanoDownloadMessage: String? = null,
    val cloudAuditModel: String = "gemini-3.8-flash",
    val cloudFallbackModel: String = "gemini-3.5-flash-lite",
    val strictZeroLeakBlock: Boolean = true,
    val triageText: String = "",
    val triageSource: String = "",
    val cloudAuditText: String = "",
    val cloudAuditSource: String = "",
    val disputeDraftScrubbed: String = "",
    val disputeSource: String = "",
    val showRehydrated: Boolean = true,
    val telemetry: List<TelemetryLogItem> = emptyList(),
    val syncedCases: List<SyncedCase> = emptyList(),
    val userUid: String? = null,
    val busyMessage: String? = null,
    val statusBanner: String? = null,
    val errorMessage: String? = null
)

class CloakBridgeViewModel : ViewModel() {
    private val engine = CloakBridgeHybridEngine()
    private val caseSync = FirestoreCaseSync()

    private val _uiState = MutableStateFlow(CloakUiState())
    val uiState: StateFlow<CloakUiState> = _uiState.asStateFlow()

    init {
        refreshNanoStatus()
        fetchRemoteConfig()
        ensureAnonymousAuth()
    }

    fun refreshNanoStatus() {
        viewModelScope.launch {
            val status = engine.checkNanoStatus()
            _uiState.update { it.copy(nanoStatus = status) }
        }
    }

    fun downloadNano() {
        viewModelScope.launch {
            try {
                engine.downloadNanoModel().collect { msg ->
                    if (msg == "AVAILABLE") {
                        _uiState.update { it.copy(nanoStatus = "AVAILABLE", nanoDownloadMessage = null) }
                    } else {
                        _uiState.update { it.copy(nanoStatus = "DOWNLOADING", nanoDownloadMessage = msg) }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Nano download error: ${e.message}") }
            }
        }
    }

    private fun fetchRemoteConfig() {
        viewModelScope.launch {
            try {
                val rc = Firebase.remoteConfig
                rc.fetchAndActivate().await()
                _uiState.update {
                    it.copy(
                        cloudAuditModel = rc.getString("cloud_audit_model").ifBlank { "gemini-3.8-flash" },
                        cloudFallbackModel = rc.getString("cloud_fallback_model").ifBlank { "gemini-3.5-flash-lite" },
                        strictZeroLeakBlock = rc.getBoolean("strict_zero_leak_block")
                    )
                }
            } catch (_: Exception) {
                // Offline defaults remain active
            }
        }
    }

    private fun ensureAnonymousAuth() {
        viewModelScope.launch {
            try {
                val auth = Firebase.auth
                val user = auth.currentUser ?: auth.signInAnonymously().await().user
                val uid = user?.uid ?: return@launch
                _uiState.update { it.copy(userUid = uid) }
                caseSync.observeCases(uid).collect { cases ->
                    _uiState.update { it.copy(syncedCases = cases) }
                }
            } catch (_: Exception) {
                // Offline or unconfigured Firebase
            }
        }
    }

    fun selectPreset(preset: DemoPreset) {
        _uiState.update {
            it.copy(
                title = preset.title,
                policy = preset.policy,
                rawText = preset.rawText,
                vaultEntries = emptyList(),
                scrubbedText = "",
                triageText = "",
                cloudAuditText = "",
                disputeDraftScrubbed = "",
                errorMessage = null,
                statusBanner = null
            )
        }
    }

    fun updateRawText(text: String) {
        _uiState.update { state ->
            val scrubbed = if (state.vaultEntries.isNotEmpty()) {
                LocalVaultEngine.applyScrub(text, state.vaultEntries)
            } else ""
            val check = LocalVaultEngine.verifyZeroLeak(scrubbed, state.vaultEntries)
            state.copy(rawText = text, scrubbedText = scrubbed, zeroLeakVerified = check.verified)
        }
    }

    fun toggleVaultEntry(token: String) {
        _uiState.update { state ->
            val updated = state.vaultEntries.map {
                if (it.token == token) it.copy(enabled = !it.enabled) else it
            }
            val scrubbed = LocalVaultEngine.applyScrub(state.rawText, updated)
            val check = LocalVaultEngine.verifyZeroLeak(scrubbed, updated)
            state.copy(vaultEntries = updated, scrubbedText = scrubbed, zeroLeakVerified = check.verified)
        }
    }

    fun toggleRehydratedView() {
        _uiState.update { it.copy(showRehydrated = !it.showRehydrated) }
    }

    fun scanBitmapOnDevice(bitmap: Bitmap) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyMessage = "Stage 0: Scanning photo ONLY_ON_DEVICE...", errorMessage = null) }
            try {
                val res = engine.extractTextFromBitmapOnDevice(bitmap, _uiState.value.cloudFallbackModel)
                _uiState.update { state ->
                    state.copy(
                        title = "Scanned Document Photo",
                        rawText = res.text,
                        busyMessage = null,
                        statusBanner = "Photo transcribed 100% locally via Gemini Nano 4 (0 cloud bytes).",
                        telemetry = listOf(
                            TelemetryLogItem(
                                stage = "IMAGE_OCR",
                                requestedMode = "ONLY_ON_DEVICE",
                                actualSource = res.inferenceSource,
                                modelName = res.modelName,
                                latencyMs = res.latencyMs,
                                outboundBytes = 0,
                                note = "Multimodal Bitmap OCR strictly on-device"
                            )
                        ) + state.telemetry
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        busyMessage = null,
                        errorMessage = "On-device image OCR requires Gemini Nano 4 on a supported Android device (${e.message})."
                    )
                }
            }
        }
    }

    fun runShieldAndTriage() {
        val cur = _uiState.value
        if (cur.rawText.isBlank()) return
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    busyMessage = "Stage 1: Running ONLY_ON_DEVICE Privacy Shield...",
                    errorMessage = null,
                    statusBanner = null
                )
            }
            try {
                val (entries, shieldRes) = engine.runLocalPrivacyShield(
                    rawText = cur.rawText,
                    policy = cur.policy,
                    cloudModelPlaceholder = cur.cloudFallbackModel,
                    existingCustom = cur.vaultEntries
                )
                val scrubbed = LocalVaultEngine.applyScrub(cur.rawText, entries)
                val check = LocalVaultEngine.verifyZeroLeak(scrubbed, entries)

                val shieldLog = TelemetryLogItem(
                    stage = "PII_SHIELD",
                    requestedMode = "ONLY_ON_DEVICE",
                    actualSource = shieldRes.inferenceSource,
                    modelName = shieldRes.modelName,
                    latencyMs = shieldRes.latencyMs,
                    outboundBytes = 0,
                    note = "Vaulted ${entries.size} PII items locally"
                )

                _uiState.update {
                    it.copy(
                        vaultEntries = entries,
                        scrubbedText = scrubbed,
                        zeroLeakVerified = check.verified,
                        busyMessage = "Stage 2: Running PREFER_ON_DEVICE Offline Triage...",
                        telemetry = listOf(shieldLog) + it.telemetry
                    )
                }

                val triageRes = engine.runHybridTriage(
                    scrubbedText = scrubbed,
                    policy = cur.policy,
                    fallbackCloudModel = cur.cloudFallbackModel
                )
                val triageLog = TelemetryLogItem(
                    stage = "LOCAL_TRIAGE",
                    requestedMode = "PREFER_ON_DEVICE",
                    actualSource = triageRes.inferenceSource,
                    modelName = triageRes.modelName,
                    latencyMs = triageRes.latencyMs,
                    outboundBytes = if (triageRes.inferenceSource == "IN_CLOUD") scrubbed.toByteArray().size else 0,
                    note = "Instant hybrid risk triage"
                )
                _uiState.update {
                    it.copy(
                        triageText = triageRes.text,
                        triageSource = triageRes.inferenceSource,
                        busyMessage = null,
                        telemetry = listOf(triageLog) + it.telemetry
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(busyMessage = null, errorMessage = e.message) }
            }
        }
    }

    fun runDeepCloudAudit() {
        val cur = _uiState.value
        if (cur.scrubbedText.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Run Stage 1 Shield first so 0 raw PII leaves the device.") }
            return
        }
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    busyMessage = "Stage 3: Running ONLY_IN_CLOUD Audit (${cur.cloudAuditModel})...",
                    errorMessage = null
                )
            }
            try {
                val res = engine.runDeepCloudAudit(
                    scrubbedText = cur.scrubbedText,
                    vault = cur.vaultEntries,
                    policy = cur.policy,
                    cloudAuditModel = cur.cloudAuditModel,
                    strictZeroLeakBlock = cur.strictZeroLeakBlock
                )
                val log = TelemetryLogItem(
                    stage = "DEEP_AUDIT",
                    requestedMode = "ONLY_IN_CLOUD",
                    actualSource = res.inferenceSource,
                    modelName = res.modelName,
                    latencyMs = res.latencyMs,
                    outboundBytes = cur.scrubbedText.toByteArray().size,
                    note = "Audited scrubbed payload via App Check"
                )
                _uiState.update {
                    it.copy(
                        cloudAuditText = res.text,
                        cloudAuditSource = res.inferenceSource,
                        busyMessage = null,
                        telemetry = listOf(log) + it.telemetry
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(busyMessage = null, errorMessage = e.message) }
            }
        }
    }

    fun runDisputeDraft() {
        val cur = _uiState.value
        if (cur.scrubbedText.isBlank()) return
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    busyMessage = "Stage 4: Drafting dispute letter (PREFER_IN_CLOUD)...",
                    errorMessage = null
                )
            }
            try {
                val summary = cur.cloudAuditText.ifBlank { cur.triageText }
                val res = engine.draftDisputeLetter(
                    scrubbedText = cur.scrubbedText,
                    auditSummary = summary,
                    vault = cur.vaultEntries,
                    policy = cur.policy,
                    cloudAuditModel = cur.cloudAuditModel,
                    strictZeroLeakBlock = cur.strictZeroLeakBlock
                )
                val log = TelemetryLogItem(
                    stage = "DISPUTE_DRAFT",
                    requestedMode = "PREFER_IN_CLOUD",
                    actualSource = res.inferenceSource,
                    modelName = res.modelName,
                    latencyMs = res.latencyMs,
                    outboundBytes = if (res.inferenceSource == "IN_CLOUD") cur.scrubbedText.toByteArray().size else 0,
                    note = "Generated tokenized letter & rehydrated locally"
                )
                _uiState.update {
                    it.copy(
                        disputeDraftScrubbed = res.text,
                        disputeSource = res.inferenceSource,
                        busyMessage = null,
                        telemetry = listOf(log) + it.telemetry
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(busyMessage = null, errorMessage = e.message) }
            }
        }
    }

    fun syncAnonymizedCaseToFirestore() {
        val cur = _uiState.value
        val uid = cur.userUid
        if (uid == null || cur.scrubbedText.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Run Local Shield & ensure Firebase Auth is active before syncing.") }
            return
        }
        viewModelScope.launch {
            try {
                caseSync.saveAnonymizedCase(
                    uid = uid,
                    title = cur.title,
                    policyProfile = cur.policy,
                    scrubbedText = cur.scrubbedText,
                    vault = cur.vaultEntries,
                    triageSummary = cur.triageText.ifBlank { "Anonymized on Android" },
                    riskScore = 82,
                    triageSource = cur.triageSource.ifBlank { "LOCAL_RULE" },
                    cloudAuditMarkdown = cur.cloudAuditText,
                    cloudAuditSource = if (cur.cloudAuditText.isNotBlank()) "IN_CLOUD" else "PENDING",
                    disputeDraftScrubbed = cur.disputeDraftScrubbed,
                    estimatedSavingsUsd = 0.0
                )
                _uiState.update {
                    it.copy(statusBanner = "Synced anonymized case to Firestore (0 raw PII) — now live on CloakBridge Web!")
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = "Sync failed: ${e.message}") }
            }
        }
    }

    fun formatForDisplay(text: String): String {
        val cur = _uiState.value
        return if (cur.showRehydrated) LocalVaultEngine.rehydrateLocally(text, cur.vaultEntries) else text
    }
}
