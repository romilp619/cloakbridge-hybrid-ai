import React, { useState } from 'react';
import { Cpu, Download, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import type { NanoStatus } from '../types/cloak';

interface NanoStatusModalProps {
  open: boolean;
  onClose: () => void;
  status: NanoStatus;
  onRefresh: () => Promise<void>;
  onDownload: (onProgress: (pct: number) => void) => Promise<void>;
}

export const NanoStatusModal: React.FC<NanoStatusModalProps> = ({
  open,
  onClose,
  status,
  onRefresh,
  onDownload,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>(status.downloadProgress ?? 0);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await onDownload((pct) => setProgress(pct));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg rounded-[10px] border border-[#303237] bg-[#17191C] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#303237] bg-[#202226] text-[#56B89A]">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#F1F2F3]">
                Gemini Nano 4 On-Device Engine
              </h2>
              <p className="text-[12px] text-[#777D85]">
                Chrome Prompt API · Firebase AI Logic Hybrid SDK
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cc-btn-ghost p-1"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-[8px] border border-[#25272B] bg-[#0D0E10] p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#777D85]">
              Availability
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                status.availability === 'available'
                  ? 'border-[#56B89A]/40 bg-[#121F1B] text-[#56B89A]'
                  : status.availability === 'downloadable' || status.availability === 'downloading'
                    ? 'border-[#E8B35D]/40 bg-[#241E14] text-[#E8B35D]'
                    : 'border-[#303237] bg-[#17191C] text-[#A3A7AD]'
              }`}
            >
              {status.availability === 'available' ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {status.availability.toUpperCase()}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#D2D6DC]">{status.detail}</p>

          {downloading && (
            <div className="mt-3">
              <div className="flex justify-between font-mono text-[11px] text-[#E37A37]">
                <span>Downloading Gemini Nano 4...</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#25272B]">
                <div
                  className="h-full bg-[#E37A37] transition-all duration-300"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-[12px] text-[#DB6666]">{error}</p>}
        </div>

        <div className="mt-4 space-y-2 rounded-[8px] border border-[#25272B] bg-[#131518] p-4 text-[12px]">
          <p className="font-semibold text-[#F1F2F3]">Chrome Desktop Setup (v139+):</p>
          <ol className="list-decimal space-y-1.5 pl-4 text-[#A3A7AD]">
            <li>
              Enable{' '}
              <code className="rounded bg-[#0D0E10] px-1.5 py-0.5 text-[11px] text-[#E8B35D]">
                chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
              </code>
            </li>
            <li>Relaunch Chrome and click Download Gemini Nano 4 below when downloadable.</li>
            <li>
              Switch DevTools to Offline once AVAILABLE to execute Stage 1 &amp; Stage 2 strictly
              locally at $0.00 cloud cost.
            </li>
          </ol>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="cc-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-check
          </button>
          {(status.availability === 'downloadable' || status.availability === 'downloading') && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="cc-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Downloading...' : 'Download Gemini Nano 4'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cc-btn-secondary px-3.5 py-1.5 text-[12px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
