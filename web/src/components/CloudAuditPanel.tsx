import React, { useState } from 'react';
import {
  Cloud,
  FileText,
  Eye,
  EyeOff,
  Lock,
  Copy,
  Check,
  Download,
  CloudUpload,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { CloudAuditResult, DisputeDraftResult } from '../types/cloak';

interface CloudAuditPanelProps {
  cloudAuditModel: string;
  cloudAudit: CloudAuditResult | null;
  disputeDraft: DisputeDraftResult | null;
  showRehydrated: boolean;
  onToggleRehydrated: () => void;
  onRunDeepAudit: () => void;
  onDraftDispute: () => void;
  onSyncFirestore: () => void;
  canRunCloud: boolean;
  canSync: boolean;
  zeroLeakVerified: boolean;
  protectedCount: number;
  lastSyncedCaseId: string | null;
  busyStage: string | null;
  copied: boolean;
  onCopyDraft: () => void;
  onDownloadDraft: () => void;
  activeDraftDisplay: string;
  renderText: (text: string) => string;
  mode?: 'cloud' | 'action' | 'combined';
}

function severityPill(sev: string): string {
  switch (sev) {
    case 'CRITICAL':
      return 'border-[#DB6666]/45 bg-[#241415] text-[#DB6666]';
    case 'HIGH':
      return 'border-[#E8B35D]/40 bg-[#241E14] text-[#E8B35D]';
    case 'MEDIUM':
      return 'border-[#7D9DBA]/40 bg-[#151D24] text-[#7D9DBA]';
    default:
      return 'border-[#56B89A]/40 bg-[#121F1B] text-[#56B89A]';
  }
}

export const CloudAuditPanel: React.FC<CloudAuditPanelProps> = ({
  cloudAuditModel,
  cloudAudit,
  disputeDraft,
  showRehydrated,
  onToggleRehydrated,
  onRunDeepAudit,
  onDraftDispute,
  onSyncFirestore,
  canRunCloud,
  canSync,
  zeroLeakVerified,
  protectedCount,
  lastSyncedCaseId,
  busyStage,
  copied,
  onCopyDraft,
  onDownloadDraft,
  activeDraftDisplay,
  renderText,
  mode = 'combined',
}) => {
  const [findingsOpen, setFindingsOpen] = useState(true);
  const busy = Boolean(busyStage);
  const isAuditing = Boolean(busyStage && /Stage 3|ONLY_IN_CLOUD/i.test(busyStage));
  const isDrafting = Boolean(busyStage && /Stage 4|PREFER_IN_CLOUD/i.test(busyStage));

  const showCloudSection = mode === 'cloud' || mode === 'combined';
  const showActionSection = mode === 'action' || mode === 'combined';

  return (
    <div className="flex flex-col gap-3.5">
      {/* DEEP CLOUD AUDIT WORKSPACE */}
      {showCloudSection && (
        <div className="cc-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-[#7D9DBA]" />
                <h3 className="text-[14px] font-semibold text-[#F1F2F3]">Deep Cloud Audit</h3>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-[#777D85]">
                ONLY_IN_CLOUD · {cloudAuditModel} · App Check
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleRehydrated}
              className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[11px] font-medium transition ${
                showRehydrated
                  ? 'border-[#56B89A]/40 bg-[#121F1B] text-[#56B89A]'
                  : 'border-[#E8B35D]/40 bg-[#241E14] text-[#E8B35D]'
              }`}
            >
              {showRehydrated ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {showRehydrated ? 'Rehydrated Locally' : 'Scrubbed Tokens'}
            </button>
          </div>

          {/* Prerequisite & Verification Strip */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#25272B] bg-[#0D0E10] px-3 py-2 font-mono text-[10.5px]">
            <span
              className={
                canRunCloud && zeroLeakVerified ? 'text-[#56B89A]' : 'text-[#777D85]'
              }
            >
              {canRunCloud && zeroLeakVerified
                ? `PREREQUISITE MET · ${protectedCount} TOKENS SCRUBBED`
                : 'LOCKED · RUN STAGE 1 LOCAL SHIELD FIRST'}
            </span>
            <span className="text-[#7D9DBA]">
              {cloudAudit ? `${cloudAudit.inferenceSource} · ${cloudAudit.latencyMs}ms` : 'IDLE'}
            </span>
          </div>

          <button
            type="button"
            onClick={onRunDeepAudit}
            disabled={busy || !canRunCloud}
            className="cc-btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-[12.5px]"
          >
            {isAuditing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Cloud className="h-3.5 w-3.5" />
            )}
            {isAuditing ? 'Running Deep Cloud Audit...' : 'Run Deep Cloud Audit'}
          </button>

          {!cloudAudit ? (
            <div className="mt-3.5 rounded-[6px] border border-dashed border-[#303237] bg-[#0D0E10] p-4">
              <div className="flex items-start gap-2.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#7D9DBA]" />
                <div className="text-[12px] leading-relaxed text-[#A3A7AD]">
                  <p className="font-semibold text-[#F1F2F3]">Anonymized Cloud Analysis</p>
                  <p className="mt-1 text-[#777D85]">
                    Only the verified scrubbed payload is transmitted to{' '}
                    <code className="text-[#7D9DBA]">{cloudAuditModel}</code> under App Check
                    enforcement. Findings and dispute drafts are rehydrated strictly locally.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {/* Impact & Execution Metadata */}
              <div className="grid grid-cols-2 gap-2.5 rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-3.5">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#777D85]">
                    Estimated Impact
                  </span>
                  <p className="mt-0.5 text-2xl font-bold tracking-tight text-[#F1F2F3]">
                    ${cloudAudit.estimatedSavingsUsd.toLocaleString()}
                  </p>
                </div>
                <div className="border-l border-[#25272B] pl-3 text-right font-mono text-[10.5px]">
                  <span className="block text-[#7D9DBA] font-semibold">
                    {cloudAudit.inferenceSource}
                  </span>
                  <span className="mt-0.5 block text-[#A3A7AD]">{cloudAudit.modelUsed}</span>
                  <span className="block text-[#777D85]">
                    Risk {cloudAudit.overallRiskScore}/100 · {cloudAudit.latencyMs}ms
                  </span>
                </div>
              </div>

              {/* Analysis Summary */}
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#777D85]">
                  Analysis Summary
                </span>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#D2D6DC]">
                  {renderText(cloudAudit.executiveSummary)}
                </p>
              </div>

              {/* Findings & Recommendations */}
              {cloudAudit.findings.length > 0 && (
                <div className="rounded-[6px] border border-[#25272B] bg-[#0D0E10]">
                  <button
                    type="button"
                    onClick={() => setFindingsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12px] font-semibold text-[#F1F2F3] hover:bg-[#17191C]"
                  >
                    <span>Findings &amp; Recommendations ({cloudAudit.findings.length})</span>
                    {findingsOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-[#777D85]" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-[#777D85]" />
                    )}
                  </button>
                  {findingsOpen && (
                    <div className="divide-y divide-[#25272B] border-t border-[#25272B]">
                      {cloudAudit.findings.map((finding, idx) => (
                        <div key={idx} className="p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-[12.5px] font-semibold text-[#F1F2F3]">
                              {renderText(finding.title)}
                            </h5>
                            <span
                              className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${severityPill(
                                finding.severity
                              )}`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#A3A7AD]">
                            {renderText(finding.explanation)}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#1D1F23] pt-2 text-[11.5px]">
                            <span className="text-[#56B89A]">
                              <strong>Recommendation:</strong> {renderText(finding.actionStep)}
                            </span>
                            {finding.estimatedImpactUsd > 0 && (
                              <span className="shrink-0 font-mono font-semibold text-[#F1F2F3]">
                                ~${finding.estimatedImpactUsd.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* REHYDRATED ACTION WORKSPACE */}
      {showActionSection && (
        <div className="flex flex-col gap-3.5">
          <div className="cc-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#E37A37]" />
                  <h3 className="text-[14px] font-semibold text-[#F1F2F3]">
                    Rehydrated Action Workspace
                  </h3>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-[#777D85]">
                  PREFER_IN_CLOUD · Local placeholder restoration
                </p>
              </div>

              <button
                type="button"
                onClick={onToggleRehydrated}
                className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[11px] font-medium transition ${
                  showRehydrated
                    ? 'border-[#56B89A]/40 bg-[#121F1B] text-[#56B89A]'
                    : 'border-[#E8B35D]/40 bg-[#241E14] text-[#E8B35D]'
                }`}
              >
                {showRehydrated ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                {showRehydrated ? 'Restored Locally' : 'Scrubbed View'}
              </button>
            </div>

            {/* Analysis Result Summary (when in Action tab) */}
            {mode === 'action' && cloudAudit && (
              <div className="mt-3 rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-3">
                <div className="flex items-center justify-between font-mono text-[10px] text-[#777D85]">
                  <span>AUDIT CONCLUSIONS</span>
                  <span className="text-[#56B89A]">
                    ~${cloudAudit.estimatedSavingsUsd.toLocaleString()} impact
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#A3A7AD]">
                  {renderText(cloudAudit.executiveSummary)}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onDraftDispute}
              disabled={busy || !canRunCloud}
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-[12.5px] ${
                mode === 'action' ? 'cc-btn-primary' : 'cc-btn-secondary'
              }`}
            >
              {isDrafting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {isDrafting ? 'Drafting Dispute Letter...' : 'Draft Dispute Letter'}
            </button>

            {disputeDraft ? (
              <div className="mt-3.5 rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-[#25272B] pb-2">
                  <div>
                    <span className="block text-[12px] font-semibold text-[#F1F2F3]">
                      Draft Output
                    </span>
                    <span className="font-mono text-[10px] text-[#777D85]">
                      {disputeDraft.inferenceSource} · {disputeDraft.modelUsed} ·{' '}
                      {disputeDraft.latencyMs}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={onCopyDraft}
                      className="cc-btn-secondary px-2 py-1 text-[11px]"
                      title="Copy output"
                      aria-label="Copy dispute letter"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-[#56B89A]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#A3A7AD]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadDraft}
                      className="cc-btn-secondary px-2 py-1 text-[11px]"
                      title="Download .txt"
                      aria-label="Download dispute letter"
                    >
                      <Download className="h-3.5 w-3.5 text-[#A3A7AD]" />
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[#E2E4E7]">
                  {activeDraftDisplay}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-[#777D85]">
                Generate a ready-to-send dispute or counter-proposal letter using anonymized tokens,
                restored strictly on-device.
              </p>
            )}
          </div>

          {/* Anonymized Firestore Synchronization Module */}
          <div className="cc-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-[#56B89A]" />
                <span className="text-[13px] font-semibold text-[#F1F2F3]">
                  Anonymized Firestore Sync
                </span>
              </div>
              <span
                className={`font-mono text-[10px] font-semibold ${
                  lastSyncedCaseId ? 'text-[#56B89A]' : 'text-[#777D85]'
                }`}
              >
                {lastSyncedCaseId ? 'CONFIRMED' : 'NOT SYNCED'}
              </span>
            </div>

            <p className="mt-1 text-[12px] text-[#777D85]">
              Syncs only zero-leak verified scrubbed payloads across CloakBridge Web and Android.
              Rehydrated personal data is never uploaded.
            </p>

            {lastSyncedCaseId && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-[5px] border border-[#56B89A]/35 bg-[#121F1B] px-2.5 py-1.5 font-mono text-[10.5px] text-[#56B89A]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Synced Case ID: {lastSyncedCaseId}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onSyncFirestore}
              disabled={!canSync || busy}
              className="cc-btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-[12.5px]"
            >
              <CloudUpload className="h-3.5 w-3.5 text-[#56B89A]" />
              Sync Anonymized Case to Firestore (Web + Android)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
