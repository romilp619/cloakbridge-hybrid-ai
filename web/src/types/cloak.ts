export type PolicyProfile = 'medical' | 'legal' | 'finance' | 'strict';

export type EntityCategory =
  | 'PERSON'
  | 'ID'
  | 'ACCT'
  | 'PHONE'
  | 'EMAIL'
  | 'LOC'
  | 'DOB'
  | 'ORG'
  | 'AMOUNT_SENSITIVE';

export interface VaultEntry {
  token: string; // e.g. [PERSON_1]
  original: string; // Strictly stays on device
  category: EntityCategory;
  source: 'ON_DEVICE_NANO' | 'LOCAL_RULE' | 'USER_CUSTOM';
  enabled: boolean; // User can toggle cloaking per entity
}

export interface ScrubResult {
  scrubbedText: string;
  entries: VaultEntry[];
  zeroLeakVerified: boolean;
  leakedValues: string[];
  engineUsed: 'ON_DEVICE_NANO' | 'LOCAL_RULE_FALLBACK';
  latencyMs: number;
}

export type InferenceSourceLabel = 'ON_DEVICE' | 'IN_CLOUD' | 'LOCAL_RULE';

export type HybridModeLabel =
  | 'ONLY_ON_DEVICE'
  | 'PREFER_ON_DEVICE'
  | 'PREFER_IN_CLOUD'
  | 'ONLY_IN_CLOUD';

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  stage: 'PII_SHIELD' | 'LOCAL_TRIAGE' | 'OFFLINE_QA' | 'DEEP_AUDIT' | 'DISPUTE_DRAFT';
  requestedMode: HybridModeLabel;
  actualSource: InferenceSourceLabel;
  modelName: string;
  latencyMs: number;
  outboundBytes: number;
  piiTokensProtected: number;
  estimatedCostUsd: number;
  note: string;
}

export interface TriageResult {
  summary: string;
  riskScore: number; // 0..100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  redFlags: string[];
  inferenceSource: InferenceSourceLabel;
  latencyMs: number;
  modelUsed: string;
}

export interface AuditFinding {
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  estimatedImpactUsd: number;
  actionStep: string;
}

export interface CloudAuditResult {
  executiveSummary: string;
  overallRiskScore: number;
  estimatedSavingsUsd: number;
  findings: AuditFinding[];
  rawScrubbedPayloadSent: string;
  inferenceSource: InferenceSourceLabel;
  latencyMs: number;
  modelUsed: string;
}

export interface DisputeDraftResult {
  scrubbedDraft: string;
  rehydratedDraft: string;
  inferenceSource: InferenceSourceLabel;
  latencyMs: number;
  modelUsed: string;
}

export interface SavedCase {
  id: string;
  title: string;
  policyProfile: PolicyProfile;
  platform: 'web' | 'android';
  scrubbedText: string;
  tokenCount: number;
  zeroLeakVerified: boolean;
  triageSummary: string;
  riskScore: number;
  triageSource: InferenceSourceLabel;
  cloudAuditMarkdown: string;
  cloudAuditSource: 'IN_CLOUD' | 'ON_DEVICE' | 'PENDING';
  disputeDraftScrubbed: string;
  estimatedSavingsUsd: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface NanoStatus {
  supported: boolean;
  availability: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';
  downloadProgress: number | null;
  detail: string;
}

export interface RemotePolicyDefinition {
  label: string;
  categories: EntityCategory[];
  auditFocus: string;
}

export interface RemotePolicyConfig {
  cloudAuditModel: string;
  cloudFallbackModel: string;
  defaultPolicyProfile: PolicyProfile;
  maxOnDeviceChars: number;
  strictZeroLeakBlock: boolean;
  policies: Record<PolicyProfile, RemotePolicyDefinition>;
  source: 'REMOTE_CONFIG' | 'DEFAULTS';
}
