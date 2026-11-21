import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Shield,
  Lock,
  FileText,
  Radio,
  Cpu,
  Cloud,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import { DEMO_DOCUMENTS } from '../data/demoDocuments';
import { LocalVaultPanel } from './LocalVaultPanel';
import { WireInspector } from './WireInspector';
import { OfflineTriagePanel } from './OfflineTriagePanel';
import { CloudAuditPanel } from './CloudAuditPanel';
import type { WorkflowNodeId } from './WorkflowCanvas';
import type {
  CloudAuditResult,
  DisputeDraftResult,
  TelemetryEvent,
  TriageResult,
  VaultEntry,
} from '../types/cloak';

export type InspectorTabId = 'input' | 'wire' | 'vault' | 'triage' | 'cloud' | 'action';

export function nodeToInspectorTab(node: WorkflowNodeId): InspectorTabId {
  switch (node) {
    case 'input':
      return 'input';
    case 'shield':
    case 'wire':
      return 'wire';
    case 'vault':
      return 'vault';
    case 'triage':
      return 'triage';
    case 'audit':
      return 'cloud';
    case 'action':
      return 'action';
  }
}

interface NodeInspectorSidebarProps {
  activeTab: InspectorTabId;
  onSelectTab: (tab: InspectorTabId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  docTitle: string;
  onDocTitleChange: (val: string) => void;
  rawText: string;
  onRawTextChange: (val: string) => void;
  onLoadDemo: (id: string) => void;
  onTriggerScanImage: () => void;
  onRunShieldAndTriage: () => void;
  vaultEntries: VaultEntry[];
  shieldEngine: 'ON_DEVICE_NANO' | 'LOCAL_RULE_FALLBACK' | null;
  customSecret: string;
  onCustomSecretChange: (val: string) => void;
  onAddCustomSecret: (e: React.FormEvent) => void;
  onToggleVaultEntry: (token: string) => void;
  scrubbedText: string;
  zeroLeakVerified: boolean;
  leakedValues: string[];
  activeVaultCount: number;
  telemetry: TelemetryEvent[];
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
  lastSyncedCaseId: string | null;
  busyStage: string | null;
  copied: boolean;
  onCopyDraft: () => void;
  onDownloadDraft: () => void;
  activeDraftDisplay: string;
  renderText: (text: string) => string;
}

const STORAGE_KEY = 'cloakbridge_inspector_width_v1';

const TABS: Array<{ id: InspectorTabId; label: string; icon: React.ReactNode }> = [
  { id: 'input', label: 'Input', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'wire', label: 'Wire', icon: <Radio className="h-3.5 w-3.5" /> },
  { id: 'vault', label: 'Vault', icon: <Lock className="h-3.5 w-3.5" /> },
  { id: 'triage', label: 'Triage', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'cloud', label: 'Cloud', icon: <Cloud className="h-3.5 w-3.5" /> },
  { id: 'action', label: 'Action', icon: <RefreshCw className="h-3.5 w-3.5" /> },
];

export const NodeInspectorSidebar: React.FC<NodeInspectorSidebarProps> = (props) => {
  const { activeTab, onSelectTab, mobileOpen, onCloseMobile } = props;
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(sessionStorage.getItem(STORAGE_KEY));
      if (saved >= 360 && saved <= 680) return saved;
    } catch {
      // ignore
    }
    return 440;
  });
  const draggingRef = useRef<boolean>(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.min(680, Math.max(360, window.innerWidth - e.clientX));
      setWidth(next);
      try {
        sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const isRunningLocal = Boolean(
    props.busyStage && /Stage 1|Stage 2|ON_DEVICE|PREFER_ON_DEVICE/i.test(props.busyStage)
  );

  const inspectorInner = (
    <div className="flex h-full flex-col bg-[#131518]">
      {/* Compact Technical Tab Strip */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#25272B] bg-[#0D0E10] px-2">
        <div
          role="tablist"
          aria-label="Inspector Tabs"
          className="flex flex-1 items-center overflow-x-auto"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className={`relative inline-flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-[12px] font-medium transition-colors duration-150 focus:outline-none focus-visible:text-[#F1F2F3] ${
                  isActive
                    ? 'text-[#F1F2F3]'
                    : 'text-[#777D85] hover:bg-[#17191C] hover:text-[#A3A7AD]'
                }`}
              >
                <span className={isActive ? 'text-[#E37A37]' : 'text-[#777D85]'}>{tab.icon}</span>
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1.5 right-1.5 h-[2px] bg-[#E37A37]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer Close */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="cc-btn-ghost ml-1 p-1.5 lg:hidden"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Inspector Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'input' && (
          <div className="cc-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#56B89A]" />
                  <h3 className="text-[14px] font-semibold text-[#F1F2F3]">
                    Raw Document Input
                  </h3>
                </div>
                <p className="mt-0.5 text-[11.5px] text-[#777D85]">
                  Local-only buffer · 0 bytes transmitted before Stage 1 cloaking
                </p>
              </div>
              <button
                type="button"
                onClick={props.onTriggerScanImage}
                disabled={Boolean(props.busyStage)}
                className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
              >
                <Upload className="h-3.5 w-3.5 text-[#A3A7AD]" /> Scan Image
              </button>
            </div>

            {/* Segmented Category Switcher */}
            <div className="mt-3.5 grid grid-cols-3 rounded-[6px] border border-[#303237] bg-[#0D0E10] p-0.5">
              {DEMO_DOCUMENTS.map((demo) => {
                const selected = props.docTitle === demo.title;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => props.onLoadDemo(demo.id)}
                    className={`rounded-[5px] px-2 py-1.5 text-[11px] font-medium transition-colors ${
                      selected
                        ? 'bg-[#202226] text-[#F1F2F3]'
                        : 'text-[#777D85] hover:text-[#A3A7AD]'
                    }`}
                  >
                    {demo.badge}
                  </button>
                );
              })}
            </div>

            {/* Document Title */}
            <div className="mt-3.5">
              <label
                htmlFor="cc-doc-title"
                className="block text-[11px] font-medium text-[#A3A7AD]"
              >
                Document Title
              </label>
              <input
                id="cc-doc-title"
                type="text"
                value={props.docTitle}
                onChange={(e) => props.onDocTitleChange(e.target.value)}
                placeholder="Untitled case..."
                className="mt-1 w-full rounded-[6px] border border-[#303237] bg-[#0D0E10] px-3 py-2 text-[13px] font-medium text-[#F1F2F3] placeholder:text-[#777D85] focus:border-[#E37A37] focus:outline-none"
              />
            </div>

            {/* Raw Document Editor */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-[11px]">
                <label htmlFor="cc-doc-raw" className="font-medium text-[#A3A7AD]">
                  Document Content
                </label>
                <span className="font-mono text-[10.5px] text-[#777D85]">
                  {props.rawText.length.toLocaleString()} chars
                </span>
              </div>
              <textarea
                id="cc-doc-raw"
                value={props.rawText}
                onChange={(e) => props.onRawTextChange(e.target.value)}
                rows={14}
                placeholder="Paste a medical bill, lease agreement, contract, or bank notice..."
                className="mt-1 w-full resize-y rounded-[6px] border border-[#303237] bg-[#0D0E10] p-3.5 text-[13px] leading-[1.6] text-[#F1F2F3] placeholder:text-[#777D85] focus:border-[#E37A37] focus:outline-none"
              />
            </div>

            {/* Primary Execution Button */}
            <button
              type="button"
              onClick={props.onRunShieldAndTriage}
              disabled={Boolean(props.busyStage) || !props.rawText.trim()}
              className="cc-btn-primary mt-3.5 inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-[12.5px]"
            >
              {isRunningLocal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
              {isRunningLocal
                ? 'Running Local Shield & Triage...'
                : 'Run Privacy Shield & Offline Triage'}
            </button>
          </div>
        )}

        {activeTab === 'wire' && (
          <WireInspector
            scrubbedText={props.scrubbedText}
            zeroLeakVerified={props.zeroLeakVerified}
            leakedValues={props.leakedValues}
            protectedCount={props.activeVaultCount}
            telemetry={props.telemetry}
          />
        )}

        {activeTab === 'vault' && (
          <LocalVaultPanel
            vaultEntries={props.vaultEntries}
            shieldEngine={props.shieldEngine}
            customSecret={props.customSecret}
            onCustomSecretChange={props.onCustomSecretChange}
            onAddCustomSecret={props.onAddCustomSecret}
            onToggleEntry={props.onToggleVaultEntry}
          />
        )}

        {activeTab === 'triage' && (
          <OfflineTriagePanel
            triage={props.triage}
            qaInput={props.qaInput}
            onQaInputChange={props.onQaInputChange}
            onAskQuestion={props.onAskQuestion}
            qaAnswer={props.qaAnswer}
            busy={Boolean(props.busyStage)}
            canAsk={Boolean(props.scrubbedText)}
            renderText={props.renderText}
          />
        )}

        {activeTab === 'cloud' && (
          <CloudAuditPanel
            cloudAuditModel={props.cloudAuditModel}
            cloudAudit={props.cloudAudit}
            disputeDraft={props.disputeDraft}
            showRehydrated={props.showRehydrated}
            onToggleRehydrated={props.onToggleRehydrated}
            onRunDeepAudit={props.onRunDeepAudit}
            onDraftDispute={props.onDraftDispute}
            onSyncFirestore={props.onSyncFirestore}
            canRunCloud={props.canRunCloud}
            canSync={props.canSync}
            zeroLeakVerified={props.zeroLeakVerified}
            protectedCount={props.activeVaultCount}
            lastSyncedCaseId={props.lastSyncedCaseId}
            busyStage={props.busyStage}
            copied={props.copied}
            onCopyDraft={props.onCopyDraft}
            onDownloadDraft={props.onDownloadDraft}
            activeDraftDisplay={props.activeDraftDisplay}
            renderText={props.renderText}
            mode="cloud"
          />
        )}

        {activeTab === 'action' && (
          <CloudAuditPanel
            cloudAuditModel={props.cloudAuditModel}
            cloudAudit={props.cloudAudit}
            disputeDraft={props.disputeDraft}
            showRehydrated={props.showRehydrated}
            onToggleRehydrated={props.onToggleRehydrated}
            onRunDeepAudit={props.onRunDeepAudit}
            onDraftDispute={props.onDraftDispute}
            onSyncFirestore={props.onSyncFirestore}
            canRunCloud={props.canRunCloud}
            canSync={props.canSync}
            zeroLeakVerified={props.zeroLeakVerified}
            protectedCount={props.activeVaultCount}
            lastSyncedCaseId={props.lastSyncedCaseId}
            busyStage={props.busyStage}
            copied={props.copied}
            onCopyDraft={props.onCopyDraft}
            onDownloadDraft={props.onDownloadDraft}
            activeDraftDisplay={props.activeDraftDisplay}
            renderText={props.renderText}
            mode="action"
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Docked Resizable Inspector */}
      <aside
        style={{ width: `${width}px` }}
        className="relative hidden shrink-0 border-l border-[#25272B] lg:block"
      >
        <div
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector panel"
          title="Drag to resize inspector"
          className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize transition-colors hover:bg-[#E37A37]/40"
        />
        {inspectorInner}
      </aside>

      {/* Tablet & Mobile Slide-Over Inspector Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/70 lg:hidden">
          <div className="h-full w-full max-w-md border-l border-[#303237] shadow-2xl">
            {inspectorInner}
          </div>
        </div>
      )}
    </>
  );
};
