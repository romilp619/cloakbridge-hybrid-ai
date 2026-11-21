import React, { useState } from 'react';
import { Cpu, AlertTriangle, Send, ChevronDown, ChevronRight } from 'lucide-react';
import type { TriageResult } from '../types/cloak';

interface OfflineTriagePanelProps {
  triage: TriageResult | null;
  qaInput: string;
  onQaInputChange: (val: string) => void;
  onAskQuestion: (e: React.FormEvent) => void;
  qaAnswer: {
    text: string;
    source: string;
    model: string;
    latencyMs: number;
  } | null;
  busy: boolean;
  canAsk: boolean;
  renderText: (text: string) => string;
}

function severityStyle(sev: string) {
  switch (sev) {
    case 'CRITICAL':
      return {
        badge: 'border-[#DB6666]/45 bg-[#241415] text-[#DB6666]',
        bar: 'bg-[#DB6666]',
        dot: 'bg-[#DB6666]',
      };
    case 'HIGH':
      return {
        badge: 'border-[#E8B35D]/40 bg-[#241E14] text-[#E8B35D]',
        bar: 'bg-[#E8B35D]',
        dot: 'bg-[#E8B35D]',
      };
    case 'MEDIUM':
      return {
        badge: 'border-[#7D9DBA]/40 bg-[#151D24] text-[#7D9DBA]',
        bar: 'bg-[#7D9DBA]',
        dot: 'bg-[#7D9DBA]',
      };
    default:
      return {
        badge: 'border-[#56B89A]/40 bg-[#121F1B] text-[#56B89A]',
        bar: 'bg-[#56B89A]',
        dot: 'bg-[#56B89A]',
      };
  }
}

export const OfflineTriagePanel: React.FC<OfflineTriagePanelProps> = ({
  triage,
  qaInput,
  onQaInputChange,
  onAskQuestion,
  qaAnswer,
  busy,
  canAsk,
  renderText,
}) => {
  const [qaOpen, setQaOpen] = useState(true);
  const sev = triage ? severityStyle(triage.severity) : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="cc-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#56B89A]" />
              <h3 className="text-[14px] font-semibold text-[#F1F2F3]">
                Offline Triage &amp; Risk Assessment
              </h3>
            </div>
            <p className="mt-0.5 text-[12px] text-[#777D85]">
              First-level local scoring via PREFER_ON_DEVICE
            </p>
          </div>

          <span className="rounded-[5px] border border-[#303237] bg-[#0D0E10] px-2 py-0.5 font-mono text-[10px] font-medium text-[#A3A7AD]">
            {triage ? `${triage.inferenceSource} · ${triage.latencyMs}ms` : 'PREFER_ON_DEVICE'}
          </span>
        </div>

        {!triage ? (
          <div className="mt-3.5 rounded-[6px] border border-dashed border-[#303237] bg-[#0D0E10] p-4 text-[12px] leading-relaxed text-[#777D85]">
            Run <strong className="text-[#F1F2F3]">Privacy Shield &amp; Offline Triage</strong> to
            evaluate risk locally with Gemini Nano 4 ($0.00 cloud cost, offline-ready).
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Risk Score Block */}
            <div className="rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#777D85]">
                    Risk Assessment
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tracking-tight text-[#F1F2F3]">
                      {triage.riskScore}
                    </span>
                    <span className="text-sm text-[#777D85]">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-[5px] border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${sev?.badge}`}
                  >
                    {triage.severity}
                  </span>
                  <p className="mt-1 font-mono text-[10px] text-[#777D85]">{triage.modelUsed}</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#25272B]">
                <div
                  className={`h-full transition-all duration-300 ${sev?.bar}`}
                  style={{ width: `${Math.max(4, triage.riskScore)}%` }}
                />
              </div>
            </div>

            {/* Summary Rationale */}
            <p className="text-[13px] leading-relaxed text-[#D2D6DC]">
              {renderText(triage.summary)}
            </p>

            {/* Structured Findings */}
            {triage.redFlags.length > 0 && (
              <div className="space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#777D85]">
                  Detected Findings ({triage.redFlags.length})
                </span>
                <div className="divide-y divide-[#25272B] rounded-[6px] border border-[#25272B] bg-[#0D0E10]">
                  {triage.redFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 text-[12.5px] text-[#F1F2F3]">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8B35D]" />
                      <span className="leading-snug text-[#D2D6DC]">{renderText(flag)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offline Q&A Composer */}
      <div className="cc-card overflow-hidden">
        <button
          type="button"
          onClick={() => setQaOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12.5px] font-semibold text-[#F1F2F3] hover:bg-[#202226]"
        >
          <span>Offline Document Q&amp;A</span>
          {qaOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#777D85]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#777D85]" />
          )}
        </button>

        {qaOpen && (
          <div className="border-t border-[#25272B] p-3.5">
            <form onSubmit={onAskQuestion} className="flex gap-2">
              <input
                type="text"
                value={qaInput}
                onChange={(e) => onQaInputChange(e.target.value)}
                placeholder="Ask an offline question about this document..."
                className="flex-1 rounded-[6px] border border-[#303237] bg-[#0D0E10] px-3 py-1.5 text-[12.5px] text-[#F1F2F3] placeholder:text-[#777D85] focus:border-[#E37A37] focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !canAsk || !qaInput.trim()}
                className="cc-btn-primary inline-flex items-center justify-center px-3 py-1.5"
                title="Query locally via PREFER_ON_DEVICE"
                aria-label="Send offline question"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

            {qaAnswer && (
              <div className="mt-3 rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-3 text-[12.5px] text-[#F1F2F3]">
                <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
                  <span
                    className={
                      qaAnswer.source === 'ON_DEVICE'
                        ? 'text-[#56B89A]'
                        : qaAnswer.source === 'IN_CLOUD'
                          ? 'text-[#7D9DBA]'
                          : 'text-[#E8B35D]'
                    }
                  >
                    {qaAnswer.source} · {qaAnswer.model}
                  </span>
                  <span className="text-[#777D85]">{qaAnswer.latencyMs}ms</span>
                </div>
                <p className="leading-relaxed text-[#D2D6DC]">{qaAnswer.text}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
