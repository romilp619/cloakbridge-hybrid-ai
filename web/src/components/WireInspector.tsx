import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Radio,
  Copy,
  Check,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { TelemetryEvent } from '../types/cloak';

interface WireInspectorProps {
  scrubbedText: string;
  zeroLeakVerified: boolean;
  leakedValues: string[];
  protectedCount: number;
  telemetry: TelemetryEvent[];
}

export const WireInspector: React.FC<WireInspectorProps> = ({
  scrubbedText,
  zeroLeakVerified,
  leakedValues,
  protectedCount,
  telemetry,
}) => {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [traceOpen, setTraceOpen] = useState(true);

  const hasPayload = scrubbedText.trim().length > 0;
  const outboundBytes = new TextEncoder().encode(scrubbedText).length;
  const localCalls = telemetry.filter(
    (t) => t.actualSource === 'ON_DEVICE' || t.actualSource === 'LOCAL_RULE'
  ).length;
  const cloudCalls = telemetry.filter((t) => t.actualSource === 'IN_CLOUD').length;

  const handleCopyPayload = async () => {
    if (!scrubbedText) return;
    await navigator.clipboard.writeText(scrubbedText);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1800);
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Technical Wire Inspection Surface */}
      <div className="cc-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#7D9DBA]" />
              <h3 className="text-[14px] font-semibold text-[#F1F2F3]">Zero-Leak Wire Inspector</h3>
            </div>
            <p className="mt-0.5 text-[12px] text-[#777D85]">
              Exact anonymized payload permitted across the cloud boundary.
            </p>
          </div>
          {hasPayload && (
            <button
              type="button"
              onClick={handleCopyPayload}
              className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px]"
            >
              {copiedPayload ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#56B89A]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#A3A7AD]" /> Copy Safe Payload
                </>
              )}
            </button>
          )}
        </div>

        {/* Verification Status Strip */}
        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border px-3 py-2 font-mono text-[11px] ${
            !hasPayload
              ? 'border-[#303237] bg-[#0D0E10] text-[#777D85]'
              : zeroLeakVerified
                ? 'border-[#56B89A]/40 bg-[#121F1B] text-[#56B89A]'
                : 'border-[#DB6666]/45 bg-[#241415] text-[#DB6666]'
          }`}
        >
          <span className="inline-flex items-center gap-1.5 font-semibold">
            {!hasPayload ? (
              <>STATUS: NOT VERIFIED — RUN STAGE 1 SHIELD</>
            ) : zeroLeakVerified ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" /> RAW PII LEAKS: 0 — VERIFIED
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5" /> FAILED: {leakedValues.length} LEAK(S) BLOCKED
              </>
            )}
          </span>
          <span className="text-[10.5px] text-[#A3A7AD]">
            {outboundBytes.toLocaleString()} B · {protectedCount} tokens
          </span>
        </div>

        {/* Monospace Payload Code Inspector */}
        <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-3.5 font-mono text-[11.5px] leading-relaxed text-[#D2D6DC]">
          {hasPayload ? (
            scrubbedText.split(/(\[[A-Z_]+_\d+\])/g).map((part, idx) =>
              /^\[[A-Z_]+_\d+\]$/.test(part) ? (
                <span
                  key={idx}
                  className="rounded-[4px] border border-[#E8B35D]/35 bg-[#241E14] px-1 py-0.2 font-semibold text-[#E8B35D]"
                >
                  {part}
                </span>
              ) : (
                <React.Fragment key={idx}>{part}</React.Fragment>
              )
            )
          ) : (
            <span className="font-sans text-[12px] text-[#777D85]">
              Execute Stage 1 Local Privacy Shield to generate and verify the anonymized outbound
              payload.
            </span>
          )}
        </pre>
      </div>

      {/* Hybrid Execution Telemetry Trace */}
      <div className="cc-card overflow-hidden">
        <button
          type="button"
          onClick={() => setTraceOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#202226]"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#E37A37]" />
            <span className="text-[13px] font-semibold text-[#F1F2F3]">
              Execution Trace &amp; Telemetry
            </span>
          </div>
          <div className="flex items-center gap-2.5 font-mono text-[10.5px]">
            <span className="text-[#56B89A]">{localCalls} local ($0.00)</span>
            <span className="text-[#7D9DBA]">{cloudCalls} cloud</span>
            {traceOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#777D85]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#777D85]" />
            )}
          </div>
        </button>

        {traceOpen && (
          <div className="border-t border-[#25272B] bg-[#0D0E10] p-3.5">
            {telemetry.length === 0 ? (
              <p className="text-[12px] text-[#777D85]">
                Real Firebase AI Logic routing traces (<code className="text-[#56B89A]">ON_DEVICE</code>{' '}
                vs <code className="text-[#7D9DBA]">IN_CLOUD</code>) and timings appear here after
                execution.
              </p>
            ) : (
              <div className="max-h-56 divide-y divide-[#25272B] overflow-y-auto">
                {telemetry.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-[#F1F2F3]">
                          {ev.stage}
                        </span>
                        <span className="rounded-[4px] border border-[#303237] bg-[#17191C] px-1.5 py-0.2 font-mono text-[9.5px] text-[#A3A7AD]">
                          {ev.requestedMode}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#777D85]">
                        {ev.modelName} · {ev.note}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[10.5px]">
                      <span
                        className={`block font-semibold ${
                          ev.actualSource === 'ON_DEVICE'
                            ? 'text-[#56B89A]'
                            : ev.actualSource === 'IN_CLOUD'
                              ? 'text-[#7D9DBA]'
                              : 'text-[#E8B35D]'
                        }`}
                      >
                        {ev.actualSource}
                      </span>
                      <span className="text-[#777D85]">
                        {ev.latencyMs}ms ·{' '}
                        {ev.estimatedCostUsd === 0 ? '$0.00' : `$${ev.estimatedCostUsd.toFixed(4)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
