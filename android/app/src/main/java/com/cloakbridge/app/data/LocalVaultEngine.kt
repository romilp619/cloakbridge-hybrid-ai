package com.cloakbridge.app.data

data class VaultEntry(
    val token: String,
    val original: String,
    val category: String,
    val source: String, // "ON_DEVICE_NANO" | "LOCAL_RULE" | "USER_CUSTOM"
    val enabled: Boolean = true
)

data class ZeroLeakResult(
    val verified: Boolean,
    val leakedValues: List<String>
)

data class DemoPreset(
    val id: String,
    val title: String,
    val policy: String,
    val rawText: String
)

object LocalVaultEngine {

    val demoPresets: List<DemoPreset> = listOf(
        DemoPreset(
            id = "medical",
            title = "ER Visit Itemized Medical Bill",
            policy = "medical",
            rawText = """
                MERCY VALLEY REGIONAL HOSPITAL — PATIENT BILLING STATEMENT
                Patient Name: Elena Rostova
                DOB: 04/19/1988
                Patient SSN: 482-73-9104
                Member ID / Policy #: BCBS-884920144
                Billing Account #: ACCT-90482177
                Patient Address: 742 Evergreen Terrace, Apt 4B, Austin, TX 78701
                Phone: (512) 555-0194 | Email: elena.rostova@gmail.com
                Attending Physician: Dr. Marcus Vance, MD

                1. CPT 99285 — Emergency Dept Visit, Level 5 (Critical) .... $3,840.00
                   Note: Mild ankle sprain, vitals stable, discharged in 45 mins.
                2. CPT 73610 — X-Ray Ankle 3 Views (Technical Fee) ......... $1,120.00
                3. CPT 73610 — X-Ray Ankle 3 Views (Duplicate Re-read) ..... $1,120.00
                4. Out-of-Network Radiologist Balance Bill (Dr. S. Patel) .. $940.00
                PATIENT BALANCE DUE IN 15 DAYS: $6,500.00
            """.trimIndent()
        ),
        DemoPreset(
            id = "legal",
            title = "Apartment Lease Renewal Agreement",
            policy = "legal",
            rawText = """
                RESIDENTIAL LEASE AGREEMENT — APEX SKYLINE PROPERTIES LLC
                Landlord Agent: Victor Sterling (v.sterling@apexskyline.com | 415-555-0148)
                Tenant: David Chen
                Tenant SSN: 519-44-2281 | Driver License: CA-D8924103
                Premises: 1840 Market Street, Unit 1102, San Francisco, CA 94102
                Tenant Email: david.chen.sf@proton.me | Phone: (415) 555-0182
                ACH Auto-Debit Account: 021000021 / 8839201144

                1. Monthly Rent: $3,250 + $195 mandatory monthly junk fees (Smart Lock, Valet Trash, Billing Convenience).
                2. Security Deposit: $6,500 ($1,200 designated non-refundable cleaning fee regardless of condition).
                3. Auto-renews for 12 months at +14% rent unless certified mail sent 90 days prior.
            """.trimIndent()
        ),
        DemoPreset(
            id = "finance",
            title = "Enterprise Consulting MSA",
            policy = "finance",
            rawText = """
                MASTER SERVICES AGREEMENT — NORTHSTAR FINTECH CORP
                Client Representative: Sarah Jenkins (s.jenkins@northstarfintech.io)
                Contractor: Priya Nair (EIN: 84-3920184)
                Address: 215 Peachtree St NE, Suite 600, Atlanta, GA 30303
                Phone: (404) 555-0167 | Email: priya@nairstudio.dev
                Wire Account: Chase Bank Acct #4491029384

                - Fee: $24,000 payable Net-90 upon subjective acceptance, minus 3.5% Vendor Portal Fee ($840).
                - $500/day liquidated damages for Contractor delays; 0% late fee for Client.
                - All pre-existing tools & off-hours ideas transfer irrevocably to Client; 24-month global non-compete.
            """.trimIndent()
        )
    )

    private val regexDetectors: List<Pair<String, Regex>> = listOf(
        "ID" to Regex("""\b\d{3}-\d{2}-\d{4}\b"""),
        "ID" to Regex("""\b\d{2}-\d{7}\b"""),
        "ID" to Regex("""\b(?:BCBS|POL|MEM|CA-D|DL|ID)[-\s#]*[A-Z0-9]{5,14}\b"""),
        "ACCT" to Regex("""\b(?:ACCT|Acct)[-\s#]*[A-Z0-9]{5,14}\b"""),
        "ACCT" to Regex("""\b\d{9}\s*/\s*\d{8,14}\b"""),
        "EMAIL" to Regex("""\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"""),
        "PHONE" to Regex("""(?:\+1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b"""),
        "DOB" to Regex("""(?<=DOB:\s)\d{2}/\d{2}/\d{4}\b"""),
        "LOC" to Regex("""\b\d{2,5}\s+[A-Z][A-Za-z0-9.\s]{2,35}\s(?:Street|St|Avenue|Ave|Terrace|Road|Rd|Blvd|Drive|Dr|Lane|Ln)(?:[,\s]+(?:Apt|Unit|Suite|Ste)\.?\s*[A-Za-z0-9-]+)?(?:,\s*[A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})?"""),
        "PERSON" to Regex("""(?<=(?:Patient Name|Tenant|Contractor|Attending Physician|Landlord Agent|Client Representative):\s)(?:Dr\.\s+)?[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+(?:\s*,\s*MD)?"""),
        "PERSON" to Regex("""\bDr\.\s+[A-Z](?:\.|[a-z]+)\s+[A-Z][a-z]+\b"""),
        "ORG" to Regex("""\b[A-Z][A-Za-z0-9&\s]{2,40}\s(?:HOSPITAL|LLC|CORP|INC|BANK|CLINIC)\b""")
    )

    fun buildVault(
        rawText: String,
        aiDetected: List<Pair<String, String>> = emptyList(),
        existingCustom: List<VaultEntry> = emptyList()
    ): List<VaultEntry> {
        val combined = mutableListOf<Triple<String, String, String>>()
        val seen = mutableSetOf<String>()

        fun addIfPresent(value: String, category: String, source: String) {
            val clean = value.trim()
            if (clean.length < 3 || !rawText.contains(clean)) return
            val key = clean.lowercase()
            if (seen.add(key)) {
                combined.add(Triple(clean, category, source))
            }
        }

        existingCustom.filter { it.source == "USER_CUSTOM" }.forEach {
            addIfPresent(it.original, it.category, "USER_CUSTOM")
        }
        aiDetected.forEach { (value, category) ->
            addIfPresent(value, category, "ON_DEVICE_NANO")
        }
        regexDetectors.forEach { (category, regex) ->
            regex.findAll(rawText).forEach { match ->
                addIfPresent(match.value, category, "LOCAL_RULE")
            }
        }

        combined.sortByDescending { it.first.length }
        val counters = mutableMapOf<String, Int>()
        return combined.map { (original, category, source) ->
            val idx = (counters[category] ?: 0) + 1
            counters[category] = idx
            VaultEntry(
                token = "[${category}_$idx]",
                original = original,
                category = category,
                source = source,
                enabled = true
            )
        }
    }

    fun applyScrub(rawText: String, entries: List<VaultEntry>): String {
        var scrubbed = rawText
        entries
            .filter { it.enabled && it.original.isNotBlank() }
            .sortedByDescending { it.original.length }
            .forEach { entry ->
                scrubbed = scrubbed.replace(entry.original, entry.token)
            }
        return scrubbed
    }

    fun verifyZeroLeak(outboundPayload: String, entries: List<VaultEntry>): ZeroLeakResult {
        val lower = outboundPayload.lowercase()
        val leaks = entries
            .filter { it.enabled && it.original.trim().length >= 3 }
            .map { it.original.trim() }
            .filter { lower.contains(it.lowercase()) }
        return ZeroLeakResult(verified = leaks.isEmpty(), leakedValues = leaks)
    }

    fun rehydrateLocally(tokenizedText: String, entries: List<VaultEntry>): String {
        var result = tokenizedText
        entries.filter { it.enabled }.forEach { entry ->
            result = result.replace(entry.token, entry.original)
        }
        return result
    }
}
