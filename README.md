# CloakBridge — Zero-Leak Hybrid AI Privacy Firewall (Web + Android)

> **#BuildHybridAI 2026 Submission** — Powered by **Firebase AI Logic Hybrid Inference**, **Gemini Nano 4** (Chrome & Android AICore), **Gemini 3.8 Flash**, **App Check**, **Remote Config**, **Cloud Firestore**, **Authentication**, and **Firebase Hosting**.
>
> **Live Hosted Web App:** https://cloakbridge-cad89.web.app

[![License](https://img.shields.io/badge/License-Apache_2.0-emerald.svg)](LICENSE)

## Value Proposition: Why Hybrid AI Is the Breakthrough

Millions of people want frontier AI to audit **medical bills, apartment leases, freelance contracts, and tax/bank notices**, but legally or personally **cannot upload raw PII/PHI/secrets to cloud servers**. Conversely, on-device models are private and free, but too small for deep multi-clause legal and medical-billing audits.

**CloakBridge turns on-device AI into a privacy firewall for cloud AI** via a **4-stage Split-Brain Pipeline** running on both **Web (Chrome)** and **Android (Kotlin + Jetpack Compose)**:

```
[Raw Document / Photo]
        │
        ▼  Stage 1: InferenceMode.ONLY_ON_DEVICE (Gemini Nano 4 + Local Guardrail)
[Local PII Vault (IndexedDB / Android Device)] ──► 0 raw PII bytes leave device
        │
        ▼  Stage 2: InferenceMode.PREFER_ON_DEVICE (Gemini Nano 4 → gemini-3.5-flash-lite fallback)
[Instant Offline Triage & Local Q&A] ──► Works in Airplane Mode / Chrome Offline ($0 cloud cost)
        │
        ▼  Hard Zero-Leak Gate + Stage 3: InferenceMode.ONLY_IN_CLOUD (gemini-3.8-flash + App Check)
[Deep Cloud Audit on Scrubbed Payload Only] ──► Itemized hidden fees, upcoding, $ savings
        │
        ▼  Stage 4: InferenceMode.PREFER_IN_CLOUD (Cloud → Nano offline fallback) + Local Rehydration
[Ready-to-Send Rehydrated Dispute Letter] ──► [PERSON_1] / [ID_1] restored strictly locally
        │
        ▼  Cloud Firestore (Offline Persistence + Zero-Leak Security Rules)
[Cross-Platform Synced Anonymized Cases (Web ↔ Android)]
```

---

## How Firebase AI Logic & Firebase Products Are Used at Runtime

| Product | Where It Runs | Role in CloakBridge |
| :--- | :--- | :--- |
| **Firebase AI Logic (Web)** | `web/src/services/hybridAi.ts` | Calls `getAI(app, { backend: new GoogleAIBackend() })` and `getGenerativeModel(ai, { mode })` across **all 4 modes** (`ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`, `PREFER_IN_CLOUD`), including multimodal JPEG/PNG on-device OCR and live `result.response.inferenceSource` telemetry. |
| **Firebase AI Logic (Android)** | `android/app/src/main/java/com/cloakbridge/app/ai/CloakBridgeHybridEngine.kt` | Uses `com.google.firebase:firebase-ai:18.2.0` + `com.google.firebase:firebase-ai-ondevice:16.0.0-beta08`, `FirebaseAIOnDevice.checkStatus()` / `download()`, `OnDeviceConfig`, Bitmap multimodal on-device OCR, and all 4 `InferenceMode`s with `response.inferenceSource`. |
| **Firebase App Check** | `web/src/services/firebase.ts` & `CloakBridgeApp.kt` | Protects all cloud Gemini API calls (`ReCaptchaEnterpriseProvider` + debug token on Web; `DebugAppCheckProviderFactory` / `PlayIntegrityAppCheckProviderFactory` on Android). |
| **Firebase Remote Config** | `remote_config.json`, `firebase.ts`, `CloakBridgeViewModel.kt` | Dynamically configures cloud model names (`gemini-3.8-flash`, `gemini-3.5-flash-lite`), privacy policy profiles (`medical`, `legal`, `finance`, `strict`), and strict zero-leak enforcement without redeploying. |
| **Cloud Firestore + Rules** | `firestore.rules`, `caseSync.ts`, `FirestoreCaseSync.kt` | Syncs **only zero-leak-verified anonymized cases** across Web & Android with offline persistence. `firestore.rules` enforces strict owner isolation, `hasOnly(...)` schema allowlists, size bounds, and `zeroLeakVerified == true`. |
| **Firebase Authentication** | `firebase.ts`, `CasesDrawer.tsx`, `CloakBridgeViewModel.kt` | Supports instant Anonymous Guest Vault sessions and Google Sign-In for private cross-device syncing. |
| **Firebase Hosting** | `firebase.json` | Hosts the production Web SPA (`web/dist`). |

---

## Quick Start (WSL / Linux / macOS)

### 1. Prerequisites
- Node.js 22+ (for Web & Firebase CLI)
- Chrome 139+ Desktop with `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` set to **Enabled**
- Android Studio / JDK 17+ & Android SDK 36 (for Android build; minSdk 26)
- Firebase CLI (`npx -y firebase-tools@latest`)

### 2. Provision Firebase Backend
```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use <YOUR_FIREBASE_PROJECT_ID>
npx -y firebase-tools@latest init ailogic
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,remoteconfig,auth
```

### 3. Run the Web App (Chrome + Gemini Nano 4)
```bash
cd web
cp .env.example .env.local
# Populate VITE_FIREBASE_* values from:
# npx -y firebase-tools@latest apps:sdkconfig WEB <WEB_APP_ID>
npm install
npm run dev
```
Open Chrome at `http://localhost:5173`, click **Gemini Nano 4 Status** in the top bar to download/verify Nano, and test toggling **Chrome DevTools → Network → Offline** to watch Stage 1 & Stage 2 execute 100% locally!

### 4. Build & Run the Android App (Kotlin + Jetpack Compose)
```bash
# Download google-services.json into android/app/google-services.json:
npx -y firebase-tools@latest apps:sdkconfig ANDROID <ANDROID_APP_ID> --out android/app/google-services.json
```
Open `android/` in Android Studio (or run `./gradlew assembleDebug`), register the logged App Check debug token in **Firebase Console → App Check → Apps → Manage debug tokens**, and launch on an Android device (API 26+; Gemini Nano 4 runs natively on AICore-supported devices and seamlessly falls back to cloud on all others).

---

## Repository Layout
```
├── web/                  # React + Vite + TypeScript + Tailwind + Firebase AI Logic Web Hybrid SDK
├── android/              # Native Kotlin + Jetpack Compose + Firebase AI Logic Android Hybrid SDK
├── firestore.rules       # Strict owner-isolated, zero-PII schema-enforcing security rules
├── firestore.indexes.json
├── remote_config.json    # Live hybrid routing & policy configuration template
├── firebase.json         # Hosting, Firestore, Remote Config, and Auth configuration
└── LICENSE               # Apache License 2.0
```

## License
Licensed under the [Apache License, Version 2.0](LICENSE).
