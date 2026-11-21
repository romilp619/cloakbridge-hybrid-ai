import type { EntityCategory, PolicyProfile, VaultEntry } from '../types/cloak';

const DB_NAME = 'cloakbridge_local_vault_v1';
const STORE_NAME = 'vault_sessions';

/**
 * Local IndexedDB persistence for the PII token map.
 * CRITICAL PRIVACY INVARIANT: Vault mappings NEVER leave IndexedDB or the browser.
 */
function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'caseKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalVaultEntries(caseKey: string, entries: VaultEntry[]): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ caseKey, entries, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[CloakBridge Vault] IndexedDB save skipped:', err);
  }
}

export async function loadLocalVaultEntries(caseKey: string): Promise<VaultEntry[] | null> {
  try {
    const db = await openVaultDb();
    return await new Promise<VaultEntry[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(caseKey);
      req.onsuccess = () => resolve(req.result?.entries ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

interface DetectedSpan {
  value: string;
  category: EntityCategory;
  source: 'ON_DEVICE_NANO' | 'LOCAL_RULE' | 'USER_CUSTOM';
}

const REGEX_DETECTORS: Array<{ category: EntityCategory; regex: RegExp }> = [
  // SSN / EIN / Policy / Driver License / Account IDs
  { category: 'ID', regex: /\b\d{3}-\d{2}-\d{4}\b/g }, // SSN
  { category: 'ID', regex: /\b\d{2}-\d{7}\b/g }, // EIN
  { category: 'ID', regex: /\b(?:BCBS|POL|MEM|CA-D|DL|ID)[-\s#]*[A-Z0-9]{5,14}\b/g },
  { category: 'ACCT', regex: /\b(?:ACCT|Acct)[-\s#]*[A-Z0-9]{5,14}\b/g },
  { category: 'ACCT', regex: /\b\d{9}\s*\/\s*\d{8,14}\b/g }, // Routing / Account pair
  { category: 'ACCT', regex: /(?<=Acct\s*#|Account\s*#?:?\s*)\d{6,14}\b/gi },
  // Emails & Phones
  { category: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { category: 'PHONE', regex: /(?:\+1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/g },
  // DOB
  { category: 'DOB', regex: /(?<=DOB:\s*)\d{2}\/\d{2}\/\d{4}\b/gi },
  // Street Addresses
  {
    category: 'LOC',
    regex:
      /\b\d{2,5}\s+[A-Z][A-Za-z0-9.\s]{2,35}\s(?:Street|St|Avenue|Ave|Terrace|Road|Rd|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)(?:[,\s]+(?:Apt|Unit|Suite|Ste)\.?\s*[A-Za-z0-9-]+)?(?:,\s*[A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?/g,
  },
  // Labeled People (Patient Name:, Tenant:, Contractor:, Attending Physician:, Landlord Agent:, Client Representative:)
  {
    category: 'PERSON',
    regex:
      /(?<=(?:Patient Name|Tenant|Contractor|Attending Physician|Landlord Agent|Client Representative|Signed by):\s*)(?:Dr\.\s+)?[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+(?:\s*,\s*MD)?/g,
  },
  // Inline doctor names like (Dr. S. Patel)
  { category: 'PERSON', regex: /\bDr\.\s+[A-Z](?:\.|[a-z]+)\s+[A-Z][a-z]+\b/g },
  // Organizations (ALL CAPS or LLC/CORP/HOSPITAL)
  {
    category: 'ORG',
    regex:
      /\b[A-Z][A-Za-z0-9&\s]{2,40}\s(?:HOSPITAL|LLC|CORP|INC|BANK|CLINIC|PROPERTIES LLC|FINTECH CORP)\b/g,
  },
];

/**
 * Runs deterministic zero-miss local regex extraction so PII is ALWAYS scrubbed
 * even before or alongside on-device Gemini Nano semantic detection.
 */
export function detectDeterministicEntities(
  rawText: string,
  allowedCategories: EntityCategory[]
): DetectedSpan[] {
  const found: DetectedSpan[] = [];
  const seen = new Set<string>();

  for (const { category, regex } of REGEX_DETECTORS) {
    if (!allowedCategories.includes(category)) continue;
    const matches = rawText.matchAll(new RegExp(regex.source, regex.flags));
    for (const match of matches) {
      const value = match[0].trim();
      if (value.length < 3) continue;
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ value, category, source: 'LOCAL_RULE' });
      }
    }
  }

  return found;
}

/**
 * Merges on-device Gemini Nano semantic detections with deterministic rules and custom user terms,
 * producing stable numbered tokens ([PERSON_1], [ID_1], etc.).
 */
export function buildVaultEntries(
  rawText: string,
  aiEntities: Array<{ value: string; category: EntityCategory }>,
  policy: PolicyProfile,
  allowedCategories: EntityCategory[],
  existingCustomEntries: VaultEntry[] = []
): VaultEntry[] {
  const deterministic = detectDeterministicEntities(rawText, allowedCategories);
  const combined: DetectedSpan[] = [];
  const seen = new Set<string>();

  const addIfPresent = (
    value: string,
    category: EntityCategory,
    source: VaultEntry['source']
  ) => {
    const clean = value.trim();
    if (clean.length < 3) return;
    if (!rawText.includes(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    combined.push({ value: clean, category, source });
  };

  // Preserve custom entries first
  for (const custom of existingCustomEntries) {
    if (custom.source === 'USER_CUSTOM') {
      addIfPresent(custom.original, custom.category, 'USER_CUSTOM');
    }
  }

  // On-device Gemini Nano semantic detections
  for (const item of aiEntities) {
    if (policy === 'strict' || allowedCategories.includes(item.category)) {
      addIfPresent(item.value, item.category, 'ON_DEVICE_NANO');
    }
  }

  // Deterministic guardrail detections
  for (const det of deterministic) {
    addIfPresent(det.value, det.category, 'LOCAL_RULE');
  }

  // Sort longest first to avoid partial substring clobbering
  combined.sort((a, b) => b.value.length - a.value.length);

  const counters: Record<string, number> = {};
  return combined.map((span) => {
    const idx = (counters[span.category] || 0) + 1;
    counters[span.category] = idx;
    return {
      token: `[${span.category}_${idx}]`,
      original: span.value,
      category: span.category,
      source: span.source,
      enabled: true,
    };
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Applies all enabled vault entries to produce the anonymized text safe for cloud transmission.
 */
export function applyVaultScrub(rawText: string, entries: VaultEntry[]): string {
  const active = [...entries]
    .filter((e) => e.enabled && e.original.trim().length > 0)
    .sort((a, b) => b.original.length - a.original.length);

  let scrubbed = rawText;
  for (const entry of active) {
    scrubbed = scrubbed.replace(new RegExp(escapeRegExp(entry.original), 'g'), entry.token);
  }
  return scrubbed;
}

/**
 * Strictly client-side Zero-Leak Assertion Guard.
 * Verifies that NO enabled raw PII strings remain inside an outbound payload before cloud transmission.
 */
export function verifyZeroLeak(
  outboundPayload: string,
  entries: VaultEntry[]
): { verified: boolean; leakedValues: string[] } {
  const lower = outboundPayload.toLowerCase();
  const leakedValues: string[] = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;
    const orig = entry.original.trim();
    if (orig.length >= 3 && lower.includes(orig.toLowerCase())) {
      leakedValues.push(orig);
    }
  }

  return {
    verified: leakedValues.length === 0,
    leakedValues,
  };
}

/**
 * Rehydrates tokenized cloud output locally by swapping [PERSON_1], [ID_1], etc. back to real values.
 */
export function rehydrateTextLocally(tokenizedText: string, entries: VaultEntry[]): string {
  let result = tokenizedText;
  for (const entry of entries) {
    if (!entry.enabled) continue;
    result = result.replace(new RegExp(escapeRegExp(entry.token), 'g'), entry.original);
  }
  return result;
}
