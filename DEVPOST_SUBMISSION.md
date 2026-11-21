# CloakBridge — Devpost Submission & 3-Minute Demo Script

## Project Name
**CloakBridge** — Zero-Leak Hybrid AI Privacy Firewall (Web + Android)

## Tagline (Short Description)
On-device AI acts as a zero-leak privacy firewall for cloud AI: scrub PII locally with Gemini Nano 4, audit deeply in the cloud with Gemini 3.8 Flash, and rehydrate locally.

## Live Hosted Demo URL
https://cloakbridge-cad89.web.app

## Platforms Selected
- **Web (Chrome)** — Gemini Nano 4 via Firebase AI Logic JS Hybrid SDK (`@firebase/ai@3.1.0`)
- **Android** — Gemini Nano 4 via Firebase AI Logic Android Hybrid SDK (`firebase-ai:18.2.0` + `firebase-ai-ondevice:16.0.0-beta08`)

---

## Devpost Description (Copy & Paste)

### Inspiration & Problem
Every day, patients, tenants, freelancers, and small businesses receive complex **ER medical bills, apartment leases, freelance contracts, and bank notices** packed with upcoding, duplicate facility fees, illegal junk fees, and one-sided liability traps. They want frontier cloud AI to audit these documents and draft formal disputes — **but they cannot safely or legally upload raw SSNs, patient names, policy IDs, addresses, or bank account numbers to cloud servers**. On-device models are private, offline, and free, yet too compact for deep multi-clause legal and medical-billing reasoning.

### What CloakBridge Does
**CloakBridge turns on-device AI into a privacy firewall for cloud AI** through a verifiable **4-stage Split-Brain Hybrid Pipeline** across **Web (Chrome)** and **Android**:

1. **Stage 1 — Local Privacy Shield (`InferenceMode.ONLY_ON_DEVICE`):** Gemini Nano 4 (paired with a deterministic local guardrail) scans raw text — or a photographed paper bill/contract via multimodal on-device OCR — to detect and tokenize PII/PHI (`[PERSON_1]`, `[ID_1]`, `[ACCT_1]`, `[LOC_1]`, `[EMAIL_1]`). The token map stays strictly inside browser IndexedDB / Android local storage. Zero raw bytes leave the device.
2. **Stage 2 — Instant Offline Triage & Q&A (`InferenceMode.PREFER_ON_DEVICE`):** Runs locally on Gemini Nano 4 at **$0.00 cloud cost** and works completely offline (airplane mode / Chrome DevTools Offline) to generate an instant Risk Score (0–100), warning flags, and interactive Offline Q&A — falling back seamlessly to `gemini-3.5-flash-lite` on unsupported devices while logging the SDK's real `response.inferenceSource`.
3. **Wire Gate & Stage 3 — Deep Cloud Audit (`InferenceMode.ONLY_IN_CLOUD`):** A hard client-side Zero-Leak Assertion Gate verifies `RAW PII LEAKS: 0` before sending **only the anonymized payload** via Firebase AI Logic + **Firebase App Check** to **`gemini-3.8-flash`** for itemized billing/legal findings, consumer-protection citations, and estimated recoverable dollar impact.
4. **Stage 4 — Local Rehydration & Cross-Platform Sync (`InferenceMode.PREFER_IN_CLOUD`):** Generates a formal dispute or counter-proposal letter (falling back to Gemini Nano 4 if connectivity drops) using placeholders, then **rehydrates real values strictly on-device**. Only zero-leak verified anonymized cases sync in real time between **CloakBridge Web** and **CloakBridge Android** via **Cloud Firestore** (enforced by owner-isolated, schema-validating `firestore.rules`).

### How We Used Firebase Products
- **Firebase AI Logic Hybrid Inference SDK (Web & Android):** Intentionally leverages all four `InferenceMode`s (`ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`, `PREFER_IN_CLOUD`), multimodal image input, structured JSON schemas, and live `inferenceSource` telemetry.
- **Firebase App Check:** Protects all cloud Gemini calls across Web and Android.
- **Firebase Remote Config:** Live policy profiles (`Medical & HIPAA`, `Legal & Lease`, `Finance & Tax`, `Strict Zero-Trust`) and dynamic model names (`gemini-3.8-flash`, `gemini-3.5-flash-lite`) updated without redeploying.
- **Cloud Firestore + Security Rules:** Offline-first cross-platform case sync enforcing `zeroLeakVerified == true` and strict `hasOnly(...)` schema rules.
- **Firebase Authentication & Firebase Hosting:** Guest & Google Sign-In plus production CDN hosting.

---

## 3-Minute YouTube Demo Script

- **0:00 – 0:25 | The Hook & Architecture**
  - Show CloakBridge Carbon Command Center live at `https://cloakbridge-cad89.web.app`.
  - Point to the Interactive Execution Graph separating the **On-Device Execution Zone** (`01`–`04`), **05 Wire Gate**, and **Anonymized Cloud Zone** (`06`–`07`).
- **0:25 – 1:05 | Stage 1 & 2 Local Privacy Shield + Wire Verification**
  - Select the **ER Visit Itemized Medical Bill** preset (`Elena Rostova`, SSN `482-73-9104`, policy `BCBS-884920144`, account `ACCT-90482177`).
  - Click **Run Privacy Shield & Offline Triage**.
  - Click **03 Local PII Vault** (show masked tokens + toggle Reveal) and **05 Wire Gate** (show `RAW PII LEAKS: 0 — VERIFIED` and highlighted `[PERSON_1]` / `[ID_1]` tokens in the outbound payload).
- **1:05 – 1:40 | True Offline Resilience (Gemini Nano 4)**
  - Open **Chrome DevTools → Network → Offline**.
  - Show top bar flipping to **Offline · Local**. Run **Offline Q&A** in the Triage tab and inspect the Execution Trace showing `ON_DEVICE · $0.00`.
- **1:40 – 2:25 | Stage 3 Deep Cloud Audit & Stage 4 Local Rehydration**
  - Reconnect online → click **Run Deep Cloud Audit** (`ONLY_IN_CLOUD` → `gemini-3.8-flash` + App Check).
  - Show itemized CPT upcoding / duplicate X-Ray / No Surprises Act findings and recoverable `$` savings.
  - Open **Action** tab → click **Draft Dispute Letter** (`PREFER_IN_CLOUD`) → toggle **Scrubbed View ↔ Restored Locally** so judges watch `[PERSON_1]` and `[ID_1]` rehydrate strictly on-device.
- **2:25 – 3:00 | Multi-Platform Android Companion & Firebase Stack**
  - Click **Sync Anonymized Case to Firestore (Web + Android)**.
  - Switch to **CloakBridge Android** (matching Carbon Command Center Jetpack Compose app using `firebase-ai:18.2.0` + `firebase-ai-ondevice:16.0.0-beta08`): show the synced anonymized case live in the **Synced** tab, plus on-device shield/triage & multimodal photo scan!
  - Close with Firebase Remote Config (`RC LIVE` policy switch) and Apache-2.0 open-source repo.
