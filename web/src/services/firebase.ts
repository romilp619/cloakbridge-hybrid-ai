import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {
  getRemoteConfig,
  fetchAndActivate,
  getString,
  getNumber,
  getBoolean,
  type RemoteConfig,
} from 'firebase/remote-config';
import type { PolicyProfile, RemotePolicyConfig, RemotePolicyDefinition } from '../types/cloak';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

export const DEFAULT_POLICIES: Record<PolicyProfile, RemotePolicyDefinition> = {
  medical: {
    label: 'Medical & HIPAA',
    categories: ['PERSON', 'ID', 'ACCT', 'PHONE', 'EMAIL', 'LOC', 'DOB', 'ORG'],
    auditFocus:
      'CPT/ICD upcoding, duplicate facility fees, out-of-network balance billing, No Surprises Act protections',
  },
  legal: {
    label: 'Legal & Lease',
    categories: ['PERSON', 'ID', 'ACCT', 'PHONE', 'EMAIL', 'LOC', 'ORG'],
    auditFocus:
      'illegal junk fees, automatic renewal traps, one-sided indemnification, non-refundable deposit clauses, IP overreach',
  },
  finance: {
    label: 'Finance & Tax',
    categories: ['PERSON', 'ID', 'ACCT', 'PHONE', 'EMAIL', 'LOC', 'ORG', 'AMOUNT_SENSITIVE'],
    auditFocus:
      'hidden APR/fee escalation, junk wire fees, unauthorized recurring charges, late-fee compounding',
  },
  strict: {
    label: 'Strict Zero-Trust',
    categories: ['PERSON', 'ID', 'ACCT', 'PHONE', 'EMAIL', 'LOC', 'DOB', 'ORG', 'AMOUNT_SENSITIVE'],
    auditFocus: 'comprehensive risk, liability, compliance, and hidden obligations analysis',
  },
};

export const DEFAULT_REMOTE_CONFIG: RemotePolicyConfig = {
  cloudAuditModel: 'gemini-3.8-flash',
  cloudFallbackModel: 'gemini-3.5-flash-lite',
  defaultPolicyProfile: 'medical',
  maxOnDeviceChars: 12000,
  strictZeroLeakBlock: true,
  policies: DEFAULT_POLICIES,
  source: 'DEFAULTS',
};

let app: FirebaseApp | null = null;
let ai: AI | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let remoteConfig: RemoteConfig | null = null;
let appCheck: AppCheck | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);

  // Configure App Check (uses debug token locally / in hackathon review if set)
  const debugTokenEnv = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugTokenEnv === 'true' || (typeof debugTokenEnv === 'string' && debugTokenEnv.length > 4)) {
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugTokenEnv === 'true' ? true : debugTokenEnv;
  }

  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Lc_cloakbridge_debug_placeholder';
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[CloakBridge] App Check initialization deferred:', err);
  }

  // Initialize Firebase AI Logic (Gemini Developer API backend)
  ai = getAI(app, { backend: new GoogleAIBackend() });

  // Initialize Cloud Firestore with multi-tab offline persistence
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });

  // Initialize Firebase Auth
  auth = getAuth(app);

  // Initialize Remote Config with offline-safe defaults
  remoteConfig = getRemoteConfig(app);
  remoteConfig.settings.minimumFetchIntervalMillis = 60_000;
  remoteConfig.defaultConfig = {
    cloud_audit_model: DEFAULT_REMOTE_CONFIG.cloudAuditModel,
    cloud_fallback_model: DEFAULT_REMOTE_CONFIG.cloudFallbackModel,
    default_policy_profile: DEFAULT_REMOTE_CONFIG.defaultPolicyProfile,
    max_on_device_chars: DEFAULT_REMOTE_CONFIG.maxOnDeviceChars,
    strict_zero_leak_block: DEFAULT_REMOTE_CONFIG.strictZeroLeakBlock,
    policy_rules_json: JSON.stringify(DEFAULT_POLICIES),
  };
}

export async function loadRemotePolicyConfig(): Promise<RemotePolicyConfig> {
  if (!remoteConfig) return DEFAULT_REMOTE_CONFIG;
  try {
    await fetchAndActivate(remoteConfig);
    const cloudAuditModel = getString(remoteConfig, 'cloud_audit_model') || DEFAULT_REMOTE_CONFIG.cloudAuditModel;
    const cloudFallbackModel =
      getString(remoteConfig, 'cloud_fallback_model') || DEFAULT_REMOTE_CONFIG.cloudFallbackModel;
    const rawProfile = getString(remoteConfig, 'default_policy_profile') as PolicyProfile;
    const defaultPolicyProfile: PolicyProfile =
      rawProfile in DEFAULT_POLICIES ? rawProfile : DEFAULT_REMOTE_CONFIG.defaultPolicyProfile;
    const maxOnDeviceChars =
      getNumber(remoteConfig, 'max_on_device_chars') || DEFAULT_REMOTE_CONFIG.maxOnDeviceChars;
    const strictZeroLeakBlock = getBoolean(remoteConfig, 'strict_zero_leak_block');

    let policies = DEFAULT_POLICIES;
    try {
      const parsed = JSON.parse(getString(remoteConfig, 'policy_rules_json'));
      if (parsed && parsed.medical && parsed.legal) {
        policies = { ...DEFAULT_POLICIES, ...parsed };
      }
    } catch {
      // keep defaults
    }

    return {
      cloudAuditModel,
      cloudFallbackModel,
      defaultPolicyProfile,
      maxOnDeviceChars,
      strictZeroLeakBlock,
      policies,
      source: 'REMOTE_CONFIG',
    };
  } catch (err) {
    console.warn('[CloakBridge] Remote Config fetch failed (offline or unprovisioned); using defaults:', err);
    return DEFAULT_REMOTE_CONFIG;
  }
}

export async function signInGuest(): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured yet.');
  await signInAnonymously(auth);
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured yet.');
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export { app, ai, db, auth, remoteConfig, appCheck };
