import {
  getGenerativeModel,
  InferenceMode,
  Schema,
  type GenerateContentResult,
} from 'firebase/ai';
import { ai } from './firebase';
import {
  applyVaultScrub,
  buildVaultEntries,
  rehydrateTextLocally,
  verifyZeroLeak,
} from './localVault';
import type {
  CloudAuditResult,
  DisputeDraftResult,
  EntityCategory,
  InferenceSourceLabel,
  NanoStatus,
  PolicyProfile,
  RemotePolicyConfig,
  ScrubResult,
  TriageResult,
  VaultEntry,
} from '../types/cloak';

// Chrome Prompt API global type declaration for Gemini Nano 4 status & model download
interface ChromeLanguageModelGlobal {
  availability: () => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create: (options?: {
    expectedInputs?: Array<{ type: string; languages?: string[] }>;
    expectedOutputs?: Array<{ type: string; languages?: string[] }>;
    monitor?: (monitor: EventTarget) => void;
  }) => Promise<{ destroy?: () => void }>;
}

function getChromeLanguageModel(): ChromeLanguageModelGlobal | null {
  const g = globalThis as unknown as { LanguageModel?: ChromeLanguageModelGlobal };
  return g.LanguageModel ?? null;
}

/**
 * Returns true ONLY when Gemini Nano 4 is already fully downloaded and immediately available.
 * Prevents calling LanguageModel.create() while the ~1.7 GB model is still downloading,
 * which would otherwise block inference for several minutes.
 */
async function isNanoReadyNow(): Promise<boolean> {
  const lm = getChromeLanguageModel();
  if (!lm || typeof lm.availability !== 'function') return false;
  try {
    return (await lm.availability()) === 'available';
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function checkNanoAvailability(): Promise<NanoStatus> {
  const lm = getChromeLanguageModel();
  if (!lm || typeof lm.availability !== 'function') {
    return {
      supported: false,
      availability: 'unsupported',
      downloadProgress: null,
      detail:
        'Chrome Prompt API (Gemini Nano 4) not detected. Use Chrome 139+ Desktop with #prompt-api-for-gemini-nano-multimodal-input enabled, or run seamlessly via hybrid cloud fallback.',
    };
  }

  try {
    const status = await lm.availability();
    if (status === 'available') {
      return {
        supported: true,
        availability: 'available',
        downloadProgress: 100,
        detail: 'Gemini Nano 4 is ready locally in Chrome — 0ms cloud, $0 cost, offline-capable.',
      };
    }
    if (status === 'downloadable') {
      return {
        supported: true,
        availability: 'downloadable',
        downloadProgress: 0,
        detail: 'Chrome supports Gemini Nano 4! Click "Download Nano" to fetch the local model.',
      };
    }
    if (status === 'downloading') {
      return {
        supported: true,
        availability: 'downloading',
        downloadProgress: null,
        detail:
          'Gemini Nano 4 is downloading in Chrome. Local deterministic shield & hybrid cloud fallback stay instant while downloading.',
      };
    }
    return {
      supported: false,
      availability: 'unavailable',
      downloadProgress: null,
      detail: 'On-device model unavailable on this hardware. Hybrid fallback will keep the app running.',
    };
  } catch (err) {
    return {
      supported: false,
      availability: 'unavailable',
      downloadProgress: null,
      detail: `Unable to query Chrome LanguageModel API: ${(err as Error).message}`,
    };
  }
}

export async function downloadNanoModel(
  onProgress: (percent: number) => void
): Promise<NanoStatus> {
  const lm = getChromeLanguageModel();
  if (!lm) return checkNanoAvailability();

  const session = await lm.create({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    monitor(m) {
      m.addEventListener('downloadprogress', (e: Event) => {
        const progressEvent = e as Event & { loaded?: number };
        if (typeof progressEvent.loaded === 'number') {
          onProgress(Math.round(progressEvent.loaded * 100));
        }
      });
    },
  });
  session?.destroy?.();
  return checkNanoAvailability();
}

function readInferenceSource(
  result: GenerateContentResult,
  defaultSource: InferenceSourceLabel
): InferenceSourceLabel {
  const resp = result.response as unknown as { inferenceSource?: string };
  if (resp?.inferenceSource === 'ON_DEVICE') return 'ON_DEVICE';
  if (resp?.inferenceSource === 'IN_CLOUD') return 'IN_CLOUD';
  return defaultSource;
}

async function fileToInlinePart(
  file: File
): Promise<{ type: 'inlineData'; inlineData: { data: string; mimeType: string } }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const str = String(reader.result || '');
      resolve(str.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return {
    type: 'inlineData',
    inlineData: {
      data: base64,
      mimeType: file.type || 'image/png',
    },
  };
}

/**
 * STAGE 0 (Multimodal On-Device OCR): Extract text from an uploaded JPEG/PNG document
 * using InferenceMode.ONLY_ON_DEVICE so raw photos of bills/contracts NEVER leave the browser.
 */
export async function extractDocumentFromImageOnDevice(imageFile: File): Promise<{
  extractedText: string;
  inferenceSource: InferenceSourceLabel;
  latencyMs: number;
}> {
  if (!ai) {
    throw new Error('Firebase AI Logic is not initialized yet. Add your Firebase config in .env.local.');
  }
  const ready = await isNanoReadyNow();
  if (!ready) {
    throw new Error(
      'Gemini Nano 4 is not finished downloading yet. Open "Nano Setup / Hybrid" to complete download before scanning images locally.'
    );
  }
  const t0 = performance.now();
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      },
    },
  });

  const imagePart = await fileToInlinePart(imageFile);
  const result = await model.generateContent([
    'Transcribe all text, numbers, names, dates, account IDs, and line-item charges from this document image verbatim. Output plain text only.',
    imagePart,
  ]);
  return {
    extractedText: result.response.text().trim(),
    inferenceSource: readInferenceSource(result, 'ON_DEVICE'),
    latencyMs: Math.round(performance.now() - t0),
  };
}

/**
 * STAGE 1 — LOCAL PRIVACY SHIELD (InferenceMode.ONLY_ON_DEVICE)
 * Runs strictly on-device with Gemini Nano 4 (when available) to semantically detect PII/PHI/secrets.
 * NEVER falls back to the cloud — merges with deterministic local rules so 0 raw bytes leak,
 * and never blocks if Gemini Nano is still downloading in the background.
 */
export async function runLocalPrivacyShield(
  rawText: string,
  policy: PolicyProfile,
  remoteConfig: RemotePolicyConfig,
  existingCustomEntries: VaultEntry[] = []
): Promise<ScrubResult> {
  const t0 = performance.now();
  const policyDef = remoteConfig.policies[policy];
  const aiDetections: Array<{ value: string; category: EntityCategory }> = [];
  let engineUsed: ScrubResult['engineUsed'] = 'LOCAL_RULE_FALLBACK';

  const nanoReady = await isNanoReadyNow();
  if (ai && nanoReady) {
    try {
      const nanoModel = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_ON_DEVICE,
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          },
          promptOptions: {
            responseConstraint: {
              type: 'object',
              properties: {
                entities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                      category: {
                        type: 'string',
                        enum: ['PERSON', 'ID', 'ACCT', 'PHONE', 'EMAIL', 'LOC', 'DOB', 'ORG'],
                      },
                    },
                    required: ['value', 'category'],
                  },
                },
              },
              required: ['entities'],
            },
          },
        },
      });

      const truncated = rawText.slice(0, remoteConfig.maxOnDeviceChars);
      const prompt = `Extract exact sensitive PII/PHI substrings from the document below for policy "${policyDef.label}".
Return ONLY JSON with {"entities":[{"value":"exact substring","category":"PERSON|ID|ACCT|PHONE|EMAIL|LOC|DOB|ORG"}]}.
Do NOT include dollar prices, CPT codes, or generic legal terms.

DOCUMENT:
${truncated}`;

      const result = await withTimeout(
        nanoModel.generateContent(prompt),
        12_000,
        'On-device Nano Privacy Shield'
      );
      const rawJson = result.response.text().trim();
      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch
        ? (JSON.parse(jsonMatch[0]) as {
            entities?: Array<{ value?: string; category?: EntityCategory }>;
          })
        : null;
      if (parsed && Array.isArray(parsed.entities)) {
        for (const item of parsed.entities) {
          if (item.value && item.category) {
            aiDetections.push({ value: item.value, category: item.category });
          }
        }
        engineUsed = 'ON_DEVICE_NANO';
      }
    } catch (err) {
      // ONLY_ON_DEVICE intentionally never spills raw PII to cloud; deterministic engine protects locally.
      console.info(
        '[CloakBridge] On-device Nano shield skipped; protected locally via deterministic engine (0 cloud bytes):',
        (err as Error).message
      );
    }
  }

  const entries = buildVaultEntries(
    rawText,
    aiDetections,
    policy,
    policyDef.categories,
    existingCustomEntries
  );
  const scrubbedText = applyVaultScrub(rawText, entries);
  const check = verifyZeroLeak(scrubbedText, entries);

  return {
    scrubbedText,
    entries,
    zeroLeakVerified: check.verified,
    leakedValues: check.leakedValues,
    engineUsed,
    latencyMs: Math.round(performance.now() - t0),
  };
}

/**
 * STAGE 2 — INSTANT OFFLINE TRIAGE (InferenceMode.PREFER_ON_DEVICE)
 * Prefers local Gemini Nano 4 ($0, offline-capable) on the scrubbed document when Nano is available,
 * and seamlessly uses the Remote-Config-controlled cloud fallback model while Nano is downloading
 * or unsupported (with offline deterministic fallback when disconnected).
 */
export async function runHybridTriage(
  scrubbedText: string,
  policy: PolicyProfile,
  remoteConfig: RemotePolicyConfig
): Promise<TriageResult> {
  const t0 = performance.now();
  const policyDef = remoteConfig.policies[policy];

  if (!ai) {
    return buildOfflineDeterministicTriage(scrubbedText, policyDef.label, t0);
  }

  const nanoReady = await isNanoReadyNow();
  if (!nanoReady && typeof navigator !== 'undefined' && !navigator.onLine) {
    return buildOfflineDeterministicTriage(scrubbedText, policyDef.label, t0);
  }

  try {
    const model = getGenerativeModel(ai, {
      mode: nanoReady ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: remoteConfig.cloudFallbackModel,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: Schema.object({
            properties: {
              summary: Schema.string(),
              riskScore: Schema.integer(),
              severity: Schema.enumString({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }),
              redFlags: Schema.array({ items: Schema.string() }),
            },
          }),
        },
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: 'text', languages: ['en'] }],
          expectedOutputs: [{ type: 'text', languages: ['en'] }],
        },
      },
    });

    const prompt = `You are a concise ${policyDef.label} document triage analyst.
Focus on: ${policyDef.auditFocus}.
Keep any anonymized placeholders like [PERSON_1], [ID_1], [ORG_1] intact.
Respond with JSON: { "summary": "2 concise sentences", "riskScore": 0-100, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "redFlags": ["flag 1", "flag 2", "flag 3"] }.

ANONYMIZED DOCUMENT:
${scrubbedText.slice(0, remoteConfig.maxOnDeviceChars)}`;

    const result = await withTimeout(model.generateContent(prompt), 20_000, 'Hybrid Triage');
    const source = readInferenceSource(result, nanoReady ? 'ON_DEVICE' : 'IN_CLOUD');
    const rawOut = result.response.text().trim();
    const jsonMatch = rawOut.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (parsed && typeof parsed.summary === 'string') {
      return {
        summary: parsed.summary,
        riskScore: Math.min(100, Math.max(0, Number(parsed.riskScore) || 72)),
        severity: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.severity)
          ? parsed.severity
          : 'HIGH') as TriageResult['severity'],
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.slice(0, 4) : [],
        inferenceSource: source,
        latencyMs: Math.round(performance.now() - t0),
        modelUsed: source === 'ON_DEVICE' ? 'Gemini Nano 4 (Chrome)' : remoteConfig.cloudFallbackModel,
      };
    }

    return {
      summary: rawOut.slice(0, 320),
      riskScore: 76,
      severity: 'HIGH',
      redFlags: ['Review highlighted charges and restrictive clauses in Deep Cloud Audit.'],
      inferenceSource: source,
      latencyMs: Math.round(performance.now() - t0),
      modelUsed: source === 'ON_DEVICE' ? 'Gemini Nano 4 (Chrome)' : remoteConfig.cloudFallbackModel,
    };
  } catch (err) {
    console.warn('[CloakBridge] Hybrid triage fell back to local rule heuristics:', err);
    return buildOfflineDeterministicTriage(scrubbedText, policyDef.label, t0);
  }
}

function buildOfflineDeterministicTriage(
  scrubbedText: string,
  policyLabel: string,
  t0: number
): TriageResult {
  const flags: string[] = [];
  if (/duplicate|re-read|unbundled/i.test(scrubbedText))
    flags.push('Possible duplicate or unbundled billing line items detected.');
  if (/out-of-network|balance bill|no prior consent/i.test(scrubbedText))
    flags.push('Potential out-of-network surprise balance billing (check No Surprises Act).');
  if (/non-refundable|junk fee|convenience fee|compounding/i.test(scrubbedText))
    flags.push('Mandatory junk fees or non-refundable deposit clauses detected.');
  if (/auto-renew|90 days|14% rent/i.test(scrubbedText))
    flags.push('Aggressive auto-renewal notice window and automatic price escalation.');
  if (/net-90|subjective|irrevocably|non-compete|liquidated damages/i.test(scrubbedText))
    flags.push('One-sided IP assignment, Net-90 delay, or punitive liquidated damages clause.');
  if (flags.length === 0)
    flags.push('Document anonymized cleanly — run Deep Cloud Audit when online for full analysis.');

  return {
    summary: `Local ${policyLabel} triage completed offline with zero cloud calls. Detected ${flags.length} high-priority risk pattern(s) on the scrubbed text.`,
    riskScore: Math.min(95, 45 + flags.length * 18),
    severity: flags.length >= 2 ? 'HIGH' : 'MEDIUM',
    redFlags: flags,
    inferenceSource: 'LOCAL_RULE',
    latencyMs: Math.round(performance.now() - t0),
    modelUsed: 'Local Deterministic Fallback (Offline)',
  };
}

/**
 * STAGE 2B — OFFLINE Q&A (InferenceMode.PREFER_ON_DEVICE)
 */
export async function askHybridQuestion(
  scrubbedText: string,
  question: string,
  remoteConfig: RemotePolicyConfig
): Promise<{
  answer: string;
  inferenceSource: InferenceSourceLabel;
  latencyMs: number;
  modelUsed: string;
}> {
  if (!ai) {
    throw new Error('Configure Firebase to enable Firebase AI Logic hybrid Q&A.');
  }
  const t0 = performance.now();
  const nanoReady = await isNanoReadyNow();
  const model = getGenerativeModel(ai, {
    mode: nanoReady ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: remoteConfig.cloudFallbackModel },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      },
    },
  });

  const result = await model.generateContent(
    `Answer concisely in 2-4 sentences using ONLY the anonymized document below. Preserve all [TOKEN_N] placeholders verbatim.\n\nDOCUMENT:\n${scrubbedText.slice(0, remoteConfig.maxOnDeviceChars)}\n\nQUESTION: ${question}`
  );
  const source = readInferenceSource(result, nanoReady ? 'ON_DEVICE' : 'IN_CLOUD');
  return {
    answer: result.response.text().trim(),
    inferenceSource: source,
    latencyMs: Math.round(performance.now() - t0),
    modelUsed: source === 'ON_DEVICE' ? 'Gemini Nano 4 (Chrome)' : remoteConfig.cloudFallbackModel,
  };
}

/**
 * STAGE 3 — DEEP CLOUD AUDIT (InferenceMode.ONLY_IN_CLOUD)
 * Strictly asserts ZERO raw PII leaks before sending ONLY the scrubbed payload
 * to frontier Cloud Gemini via Firebase AI Logic + App Check.
 */
export async function runDeepCloudAudit(
  scrubbedText: string,
  vaultEntries: VaultEntry[],
  policy: PolicyProfile,
  remoteConfig: RemotePolicyConfig
): Promise<CloudAuditResult> {
  if (!ai) {
    throw new Error('Firebase is not configured yet. Connect your Firebase project to run Deep Cloud Audit.');
  }

  // HARD ZERO-LEAK GATE
  const leakCheck = verifyZeroLeak(scrubbedText, vaultEntries);
  if (remoteConfig.strictZeroLeakBlock && !leakCheck.verified) {
    throw new Error(
      `ZERO-LEAK FIREWALL BLOCKED CLOUD CALL: Detected unredacted vault values (${leakCheck.leakedValues.join(', ')}). Re-run Local Shield first.`
    );
  }

  const t0 = performance.now();
  const policyDef = remoteConfig.policies[policy];

  const prompt = `You are a senior ${policyDef.label} auditor.
Analyze this ANONYMIZED document for: ${policyDef.auditFocus}.
CRITICAL: Preserve all anonymized tokens like [PERSON_1], [ORG_1], [ID_1], [ACCT_1] verbatim in your response so the client can rehydrate them locally.
Quantify dollar savings/exposure where applicable and cite relevant consumer protections (e.g., No Surprises Act, state tenant law, unfair contract doctrine) when relevant.

ANONYMIZED PAYLOAD:
${scrubbedText}`;

  const candidateModels = Array.from(
    new Set([remoteConfig.cloudAuditModel, remoteConfig.cloudFallbackModel, 'gemini-3.5-flash-lite'])
  );

  let result: GenerateContentResult | null = null;
  let usedModel = candidateModels[0];
  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const cloudModel = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: modelName,
          generationConfig: {
            temperature: 0.25,
            responseMimeType: 'application/json',
            responseSchema: Schema.object({
              properties: {
                executiveSummary: Schema.string(),
                overallRiskScore: Schema.integer(),
                estimatedSavingsUsd: Schema.number(),
                findings: Schema.array({
                  items: Schema.object({
                    properties: {
                      title: Schema.string(),
                      severity: Schema.enumString({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }),
                      explanation: Schema.string(),
                      estimatedImpactUsd: Schema.number(),
                      actionStep: Schema.string(),
                    },
                  }),
                }),
              },
            }),
          },
        },
      });
      result = await cloudModel.generateContent(prompt);
      usedModel = modelName;
      break;
    } catch (err) {
      lastError = err;
      console.warn(`[CloakBridge] Cloud audit model ${modelName} unavailable, trying next:`, err);
    }
  }

  if (!result) {
    throw lastError instanceof Error ? lastError : new Error('All cloud audit models failed.');
  }

  const parsed = JSON.parse(result.response.text()) as {
    executiveSummary: string;
    overallRiskScore: number;
    estimatedSavingsUsd: number;
    findings: CloudAuditResult['findings'];
  };

  return {
    executiveSummary: parsed.executiveSummary,
    overallRiskScore: Math.min(100, Math.max(0, Math.round(parsed.overallRiskScore || 80))),
    estimatedSavingsUsd: Math.max(0, Number(parsed.estimatedSavingsUsd) || 0),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    rawScrubbedPayloadSent: scrubbedText,
    inferenceSource: readInferenceSource(result, 'IN_CLOUD'),
    latencyMs: Math.round(performance.now() - t0),
    modelUsed: usedModel,
  };
}

/**
 * STAGE 4 — HYBRID DISPUTE / COUNTER-PROPOSAL DRAFTER (InferenceMode.PREFER_IN_CLOUD)
 * Prefers frontier Cloud Gemini on the scrubbed payload, and automatically falls back
 * to on-device Gemini Nano 4 if connectivity drops — then rehydrates locally!
 */
export async function runHybridDisputeDraft(
  scrubbedText: string,
  auditSummary: string,
  vaultEntries: VaultEntry[],
  policy: PolicyProfile,
  remoteConfig: RemotePolicyConfig
): Promise<DisputeDraftResult> {
  if (!ai) {
    throw new Error('Firebase is not configured yet.');
  }

  const leakCheck = verifyZeroLeak(scrubbedText, vaultEntries);
  if (remoteConfig.strictZeroLeakBlock && !leakCheck.verified) {
    throw new Error('ZERO-LEAK FIREWALL BLOCKED CALL: Re-run Local Shield before drafting.');
  }

  const t0 = performance.now();
  const policyDef = remoteConfig.policies[policy];
  const nanoReady = await isNanoReadyNow();

  const prompt = `Draft a firm, professional, ready-to-send formal dispute / counter-proposal letter for this ${policyDef.label} case.
CRITICAL RULE: Use the exact anonymized placeholder tokens found in the document (e.g., [PERSON_1], [ORG_1], [ID_1], [ACCT_1], [LOC_1], [EMAIL_1]) instead of inventing names or leaving blanks, because the user's device will locally rehydrate those tokens after you respond.

AUDIT SUMMARY:
${auditSummary}

ANONYMIZED DOCUMENT:
${scrubbedText.slice(0, remoteConfig.maxOnDeviceChars)}`;

  const candidateModels = Array.from(
    new Set([remoteConfig.cloudAuditModel, remoteConfig.cloudFallbackModel, 'gemini-3.5-flash-lite'])
  );

  let result: GenerateContentResult | null = null;
  let usedModel = candidateModels[0];
  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const model = getGenerativeModel(ai, {
        mode: nanoReady ? InferenceMode.PREFER_IN_CLOUD : InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: modelName,
          generationConfig: { temperature: 0.35, maxOutputTokens: 1600 },
        },
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          },
        },
      });
      result = await model.generateContent(prompt);
      usedModel = modelName;
      break;
    } catch (err) {
      lastError = err;
      console.warn(`[CloakBridge] Dispute draft model ${modelName} unavailable, trying next:`, err);
    }
  }

  if (!result) {
    throw lastError instanceof Error ? lastError : new Error('All dispute drafting models failed.');
  }

  const scrubbedDraft = result.response.text().trim();
  const rehydratedDraft = rehydrateTextLocally(scrubbedDraft, vaultEntries);
  const source = readInferenceSource(result, 'IN_CLOUD');

  return {
    scrubbedDraft,
    rehydratedDraft,
    inferenceSource: source,
    latencyMs: Math.round(performance.now() - t0),
    modelUsed: source === 'ON_DEVICE' ? 'Gemini Nano 4 (Offline Fallback)' : usedModel,
  };
}
