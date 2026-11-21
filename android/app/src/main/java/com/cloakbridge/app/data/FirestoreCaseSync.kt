package com.cloakbridge.app.data

import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class SyncedCase(
    val id: String,
    val title: String,
    val policyProfile: String,
    val platform: String,
    val scrubbedText: String,
    val tokenCount: Int,
    val riskScore: Int,
    val triageSummary: String,
    val triageSource: String,
    val cloudAuditMarkdown: String,
    val disputeDraftScrubbed: String,
    val estimatedSavingsUsd: Double
)

/**
 * Syncs ONLY zero-leak-verified anonymized cases to Cloud Firestore (`users/{uid}/cases/{caseId}`),
 * matching the exact schema enforced by `firestore.rules` and CloakBridge Web.
 */
class FirestoreCaseSync {
    private val db get() = Firebase.firestore

    suspend fun saveAnonymizedCase(
        uid: String,
        title: String,
        policyProfile: String,
        scrubbedText: String,
        vault: List<VaultEntry>,
        triageSummary: String,
        riskScore: Int,
        triageSource: String,
        cloudAuditMarkdown: String,
        cloudAuditSource: String,
        disputeDraftScrubbed: String,
        estimatedSavingsUsd: Double
    ): String {
        val combined = "$scrubbedText\n$triageSummary\n$cloudAuditMarkdown\n$disputeDraftScrubbed"
        val check = LocalVaultEngine.verifyZeroLeak(combined, vault)
        if (!check.verified) {
            throw SecurityException("Blocked Firestore write: unredacted PII detected.")
        }

        val now = Timestamp.now()
        val payload = hashMapOf(
            "title" to title.take(140).ifBlank { "Android Anonymized Case" },
            "policyProfile" to policyProfile,
            "platform" to "android",
            "scrubbedText" to scrubbedText.take(30000),
            "tokenCount" to vault.count { it.enabled }.coerceIn(0, 500),
            "zeroLeakVerified" to true,
            "triageSummary" to triageSummary.take(4000),
            "riskScore" to riskScore.coerceIn(0, 100),
            "triageSource" to triageSource,
            "cloudAuditMarkdown" to cloudAuditMarkdown.take(30000),
            "cloudAuditSource" to cloudAuditSource,
            "disputeDraftScrubbed" to disputeDraftScrubbed.take(20000),
            "estimatedSavingsUsd" to estimatedSavingsUsd.coerceAtLeast(0.0),
            "createdAt" to now,
            "updatedAt" to now
        )

        val docRef = db.collection("users").document(uid).collection("cases").add(payload).await()
        return docRef.id
    }

    fun observeCases(uid: String): Flow<List<SyncedCase>> = callbackFlow {
        val listener = db.collection("users")
            .document(uid)
            .collection("cases")
            .orderBy("updatedAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) return@addSnapshotListener
                val items = snapshot.documents.map { doc ->
                    SyncedCase(
                        id = doc.id,
                        title = doc.getString("title") ?: "Untitled",
                        policyProfile = doc.getString("policyProfile") ?: "medical",
                        platform = doc.getString("platform") ?: "web",
                        scrubbedText = doc.getString("scrubbedText") ?: "",
                        tokenCount = (doc.getLong("tokenCount") ?: 0L).toInt(),
                        riskScore = (doc.getLong("riskScore") ?: 0L).toInt(),
                        triageSummary = doc.getString("triageSummary") ?: "",
                        triageSource = doc.getString("triageSource") ?: "ON_DEVICE",
                        cloudAuditMarkdown = doc.getString("cloudAuditMarkdown") ?: "",
                        disputeDraftScrubbed = doc.getString("disputeDraftScrubbed") ?: "",
                        estimatedSavingsUsd = doc.getDouble("estimatedSavingsUsd") ?: 0.0
                    )
                }
                trySend(items)
            }
        awaitClose { listener.remove() }
    }
}
