import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  Shield,
  Lock,
  Cpu,
  Radio,
  Cloud,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Play,
  Upload,
  Eye,
  EyeOff,
  CloudUpload,
  Check,
  AlertTriangle,
  Loader2,
  PanelRightOpen,
} from 'lucide-react';
import type { CloudAuditResult, DisputeDraftResult, TriageResult } from '../types/cloak';

export type WorkflowNodeId =
  | 'input'
  | 'shield'
  | 'vault'
  | 'triage'
  | 'wire'
  | 'audit'
  | 'action';

interface WorkflowCanvasProps {
  selectedNode: WorkflowNodeId;
  onSelectNode: (id: WorkflowNodeId) => void;
  docTitle: string;
  policyLabel: string;
  rawCharCount: number;
  cloakedCount: number;
  totalVaultCount: number;
  zeroLeakVerified: boolean;
  leakedCount: number;
  shieldLatencyMs: number | null;
  triage: TriageResult | null;
  cloudAudit: CloudAuditResult | null;
  disputeDraft: DisputeDraftResult | null;
  cloudAuditModel: string;
  cloudFallbackModel: string;
  showRehydrated: boolean;
  onToggleRehydrated: () => void;
  busyStage: string | null;
  onRunShieldAndTriage: () => void;
  onRunDeepAudit: () => void;
  onDraftDispute: () => void;
  onSyncFirestore: () => void;
  onTriggerScanImage: () => void;
  onOpenMobileInspector?: () => void;
  canRunCloud: boolean;
  canSync: boolean;
  lastSyncedCaseId: string | null;
}

type NodeState = 'idle' | 'running' | 'completed' | 'warning' | 'error';

interface CarbonNodeProps {
  index: string;
  title: string;
  description: string;
  environment: string;
  metric: string;
  statusLabel: string;
  state: NodeState;
  selected: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  style: React.CSSProperties;
}

const STAGE_WIDTH = 980;
const STAGE_HEIGHT = 408;

const CarbonNode: React.FC<CarbonNodeProps> = ({
  index,
  title,
  description,
  environment,
  metric,
  statusLabel,
  state,
  selected,
  icon,
  onClick,
  style,
}) => {
  const dotClass =
    state === 'completed'
      ? 'bg-[#56B89A]'
      : state === 'running'
        ? 'bg-[#E37A37]'
        : state === 'warning'
          ? 'bg-[#E8B35D]'
          : state === 'error'
            ? 'bg-[#DB6666]'
            : 'bg-[#5A6068]';

  const statusTextClass =
    state === 'completed'
      ? 'text-[#56B89A]'
      : state === 'running'
        ? 'text-[#E37A37]'
        : state === 'warning'
          ? 'text-[#E8B35D]'
          : state === 'error'
            ? 'text-[#DB6666]'
            : 'text-[#777D85]';

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`group absolute flex flex-col justify-between rounded-[8px] border bg-[#17191C] p-3.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E37A37] ${
        selected
          ? 'border-[#E37A37] bg-[#1C1E22]'
          : 'border-[#303237] hover:border-[#45484F] hover:bg-[#1C1E22]'
      }`}
    >
      {/* Selected Left Accent Bar */}
      {selected && (
        <span className="pointer-events-none absolute bottom-2 left-0 top-2 w-[2.5px] rounded-r bg-[#E37A37]" />
      )}

      {/* Header: Node ID + Monochrome Icon + Execution Status */}
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-medium text-[#777D85]">{index}</span>
          <span className={selected ? 'text-[#F1F2F3]' : 'text-[#A3A7AD] group-hover:text-[#F1F2F3]'}>
            {icon}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-medium ${statusTextClass}`}
        >
          {state === 'running' ? (
            <Loader2 className="h-3 w-3 animate-spin text-[#E37A37]" />
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          )}
          {statusLabel}
        </span>
      </div>

      {/* Body: Title + Concise Description */}
      <div className="mt-2">
        <h3 className="text-[13.5px] font-semibold leading-tight text-[#F1F2F3]">{title}</h3>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-[#A3A7AD]">{description}</p>
      </div>

      {/* Footer: Environment + Metric */}
      <div className="mt-2.5 flex w-full items-center justify-between gap-2 border-t border-[#25272B] pt-2 font-mono text-[10px]">
        <span className="truncate text-[#777D85]">{environment}</span>
        <span
          className={`shrink-0 font-medium ${
            state === 'completed'
              ? 'text-[#56B89A]'
              : state === 'error'
                ? 'text-[#DB6666]'
                : state === 'warning'
                  ? 'text-[#E8B35D]'
                  : 'text-[#F1F2F3]'
          }`}
        >
          {metric}
        </span>
      </div>
    </button>
  );
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  selectedNode,
  onSelectNode,
  docTitle,
  policyLabel,
  rawCharCount,
  cloakedCount,
  totalVaultCount,
  zeroLeakVerified,
  leakedCount,
  shieldLatencyMs,
  triage,
  cloudAudit,
  disputeDraft,
  cloudAuditModel,
  cloudFallbackModel,
  showRehydrated,
  onToggleRehydrated,
  busyStage,
  onRunShieldAndTriage,
  onRunDeepAudit,
  onDraftDispute,
  onSyncFirestore,
  onTriggerScanImage,
  onOpenMobileInspector,
  canRunCloud,
  canSync,
  lastSyncedCaseId,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGuides, setShowGuides] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const userAdjustedRef = useRef<boolean>(false);
  const panOriginRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const stage1Ran = totalVaultCount > 0;
  const stage1Verified = stage1Ran && zeroLeakVerified;
  const stage2Done = Boolean(triage);
  const stage3Done = Boolean(cloudAudit);
  const stage4Done = Boolean(disputeDraft);

  const isRunning1 = Boolean(busyStage && /Stage 1|ON_DEVICE/i.test(busyStage));
  const isRunning2 = Boolean(busyStage && /Stage 2|PREFER_ON_DEVICE/i.test(busyStage));
  const isRunning3 = Boolean(busyStage && /Stage 3|ONLY_IN_CLOUD/i.test(busyStage));
  const isRunning4 = Boolean(busyStage && /Stage 4|PREFER_IN_CLOUD/i.test(busyStage));

  const computeFitZoom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return 1;
    const availW = Math.max(320, el.clientWidth - 40);
    const availH = Math.max(260, el.clientHeight - 40);
    const scale = Math.min(availW / STAGE_WIDTH, availH / STAGE_HEIGHT);
    return Math.min(1.08, Math.max(0.62, Number(scale.toFixed(2))));
  }, []);

  const handleFitView = useCallback(() => {
    userAdjustedRef.current = false;
    setZoom(computeFitZoom());
    setPan({ x: 0, y: 0 });
  }, [computeFitZoom]);

  // Auto-recalculate fit-to-view when viewport resizes (e.g. inspector drag resize)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!userAdjustedRef.current) {
        setZoom(computeFitZoom());
      }
    });
    observer.observe(el);
    setZoom(computeFitZoom());
    return () => observer.disconnect();
  }, [computeFitZoom]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsPanning(true);
    userAdjustedRef.current = true;
    panOriginRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panOriginRef.current) return;
    setPan({
      x: panOriginRef.current.panX + (e.clientX - panOriginRef.current.x),
      y: panOriginRef.current.panY + (e.clientY - panOriginRef.current.y),
    });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    panOriginRef.current = null;
  };

  // Contextual bottom command center primary action
  const primaryCommand = !stage1Verified
    ? {
        label: 'Run Shield & Offline Triage',
        status: busyStage || 'Step 1 of 4 · Awaiting local privacy shield execution',
        onClick: onRunShieldAndTriage,
        disabled: Boolean(busyStage) || rawCharCount === 0,
      }
    : !stage3Done
      ? {
          label: 'Run Deep Cloud Audit',
          status:
            busyStage ||
            `Step 3 of 4 · Wire verified (${cloakedCount} tokens cloaked, 0 raw PII leaks)`,
          onClick: onRunDeepAudit,
          disabled: Boolean(busyStage) || !canRunCloud,
        }
      : !stage4Done
        ? {
            label: 'Draft Dispute Letter',
            status:
              busyStage ||
              `Step 4 of 4 · Cloud audit complete ($${cloudAudit!.estimatedSavingsUsd.toLocaleString()} impact)`,
            onClick: onDraftDispute,
            disabled: Boolean(busyStage) || !canRunCloud,
          }
        : {
            label: 'Sync Anonymized Case',
            status:
              busyStage ||
              (lastSyncedCaseId
                ? `Synced to Firestore · Case ${lastSyncedCaseId.slice(0, 8)}`
                : 'Ready to sync anonymized payload to Firestore (Web + Android)'),
            onClick: onSyncFirestore,
            disabled: Boolean(busyStage) || !canSync,
          };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#101113]">
      {/* Canvas Control Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#25272B] bg-[#0D0E10] px-4 py-2 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#F1F2F3]">Execution Graph</span>
          <span className="hidden h-3 w-[1px] bg-[#25272B] sm:inline-block" />
          <span className="hidden font-mono text-[10.5px] text-[#777D85] sm:inline">
            LOCAL BOUNDARY → WIRE GATE → ANONYMIZED CLOUD
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenMobileInspector && (
            <button
              type="button"
              onClick={onOpenMobileInspector}
              className="cc-btn-secondary mr-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] lg:hidden"
            >
              <PanelRightOpen className="h-3.5 w-3.5" /> Inspector
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowGuides((v) => !v)}
            className={`cc-btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px] ${
              showGuides ? 'bg-[#202226] text-[#F1F2F3]' : ''
            }`}
            title="Toggle subtle alignment grid"
          >
            <Grid className="h-3.5 w-3.5" /> Guides
          </button>

          <div className="ml-1 inline-flex items-center rounded-[6px] border border-[#303237] bg-[#17191C]">
            <button
              type="button"
              onClick={() => {
                userAdjustedRef.current = true;
                setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))));
              }}
              className="px-1.5 py-1 text-[#A3A7AD] hover:text-[#F1F2F3]"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="border-x border-[#25272B] px-2 font-mono text-[10px] text-[#F1F2F3]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => {
                userAdjustedRef.current = true;
                setZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))));
              }}
              className="px-1.5 py-1 text-[#A3A7AD] hover:text-[#F1F2F3]"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleFitView}
            className="cc-btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            title="Fit entire workflow to viewport"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Fit
          </button>
        </div>
      </div>

      {/* Main Matte Graphite Interactive Flowchart Surface */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex flex-1 items-center justify-center overflow-hidden p-4 select-none ${
          showGuides ? 'cc-guides' : ''
        } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            width: `${STAGE_WIDTH}px`,
            height: `${STAGE_HEIGHT}px`,
          }}
          className="relative shrink-0 transition-transform duration-100"
        >
          {/* ON-DEVICE EXECUTION ZONE */}
          <div
            style={{ left: 0, top: 0, width: 492, height: 392 }}
            className="absolute rounded-[10px] border border-[#25272B] bg-[#121417]"
          >
            <div className="flex items-center justify-between border-b border-[#25272B] px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#56B89A]" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#F1F2F3]">
                  On-Device Execution Zone
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#777D85]">
                0 raw bytes to cloud · Gemini Nano 4
              </span>
            </div>
          </div>

          {/* ANONYMIZED CLOUD ZONE */}
          <div
            style={{ left: 698, top: 0, width: 282, height: 392 }}
            className="absolute rounded-[10px] border border-[#2A2F38] bg-[#13161B]"
          >
            <div className="flex items-center justify-between border-b border-[#25272B] px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7D9DBA]" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#F1F2F3]">
                  Anonymized Cloud Zone
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#7D9DBA]">App Check</span>
            </div>
          </div>

          {/* ORTHOGONAL DATA-FLOW CONNECTORS */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
          >
            <defs>
              <marker id="cc-arrow-idle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 7 4 L 0 7 z" fill="#464A52" />
              </marker>
              <marker id="cc-arrow-green" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 7 4 L 0 7 z" fill="#56B89A" />
              </marker>
              <marker id="cc-arrow-orange" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 7 4 L 0 7 z" fill="#E37A37" />
              </marker>
              <marker id="cc-arrow-blue" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 7 4 L 0 7 z" fill="#7D9DBA" />
              </marker>
            </defs>

            {/* 01 -> 02: Raw Input -> Local Privacy Shield */}
            <path
              d="M 226 112 L 260 112"
              fill="none"
              stroke={isRunning1 ? '#E37A37' : stage1Ran ? '#56B89A' : '#3C4047'}
              strokeWidth="1.75"
              className={isRunning1 ? 'cc-wire-running' : ''}
              markerEnd={
                isRunning1
                  ? 'url(#cc-arrow-orange)'
                  : stage1Ran
                    ? 'url(#cc-arrow-green)'
                    : 'url(#cc-arrow-idle)'
              }
            >
              <title>Raw document enters Local Privacy Shield (strictly on-device)</title>
            </path>

            {/* 02 -> 03: Privacy Shield -> Local PII Vault */}
            <path
              d="M 338 176 L 338 206 L 120 206 L 120 232"
              fill="none"
              stroke={stage1Ran ? '#56B89A' : '#3C4047'}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              markerEnd={stage1Ran ? 'url(#cc-arrow-green)' : 'url(#cc-arrow-idle)'}
            >
              <title>Extracted PII token map stored strictly in local IndexedDB</title>
            </path>

            {/* 02 -> 04: Privacy Shield -> Instant Offline Triage */}
            <path
              d="M 392 176 L 392 232"
              fill="none"
              stroke={isRunning2 ? '#E37A37' : stage2Done ? '#56B89A' : '#3C4047'}
              strokeWidth="1.75"
              className={isRunning2 ? 'cc-wire-running' : ''}
              markerEnd={
                isRunning2
                  ? 'url(#cc-arrow-orange)'
                  : stage2Done
                    ? 'url(#cc-arrow-green)'
                    : 'url(#cc-arrow-idle)'
              }
            >
              <title>Scrubbed text scored locally via PREFER_ON_DEVICE</title>
            </path>

            {/* 02 -> 05: Privacy Shield -> Wire Gate */}
            <path
              d="M 472 112 L 520 112"
              fill="none"
              stroke={stage1Verified ? '#56B89A' : '#3C4047'}
              strokeWidth="1.75"
              markerEnd={stage1Verified ? 'url(#cc-arrow-green)' : 'url(#cc-arrow-idle)'}
            >
              <title>Candidate outbound payload inspected by Zero-Leak Wire Gate</title>
            </path>

            {/* 05 -> 06: Wire Gate -> Deep Cloud Audit (steel blue for cloud-bound anonymized data) */}
            <path
              d="M 670 112 L 718 112"
              fill="none"
              stroke={isRunning3 ? '#E37A37' : stage3Done ? '#7D9DBA' : stage1Verified ? '#7D9DBA' : '#3C4047'}
              strokeWidth="1.75"
              strokeDasharray={stage1Verified ? undefined : '4 4'}
              className={isRunning3 ? 'cc-wire-running' : ''}
              markerEnd={
                isRunning3
                  ? 'url(#cc-arrow-orange)'
                  : stage1Verified
                    ? 'url(#cc-arrow-blue)'
                    : 'url(#cc-arrow-idle)'
              }
            >
              <title>Verified zero-leak anonymized payload transmitted to Cloud Gemini via App Check</title>
            </path>

            {/* 06 -> 07: Deep Cloud Audit -> Rehydrate & Sync */}
            <path
              d="M 839 176 L 839 232"
              fill="none"
              stroke={isRunning4 ? '#E37A37' : stage4Done ? '#7D9DBA' : '#3C4047'}
              strokeWidth="1.75"
              className={isRunning4 ? 'cc-wire-running' : ''}
              markerEnd={
                isRunning4
                  ? 'url(#cc-arrow-orange)'
                  : stage4Done
                    ? 'url(#cc-arrow-blue)'
                    : 'url(#cc-arrow-idle)'
              }
            >
              <title>Tokenized audit & draft returned for local rehydration and anonymized Firestore sync</title>
            </path>

            {/* 03 -> 07: Local Vault Rehydration Lookup (dashed reference path) */}
            <path
              d="M 120 364 L 120 398 L 839 398 L 839 368"
              fill="none"
              stroke={stage4Done ? '#56B89A' : '#303237'}
              strokeWidth="1.4"
              strokeDasharray="4 4"
              markerEnd={stage4Done ? 'url(#cc-arrow-green)' : 'url(#cc-arrow-idle)'}
            >
              <title>Local client rehydrates placeholders using IndexedDB vault without cloud exposure</title>
            </path>
            <rect x="404" y="388" width="176" height="19" rx="4" fill="#101113" stroke="#303237" />
            <text
              x="492"
              y="400.5"
              textAnchor="middle"
              fill="#777D85"
              fontSize="9.5"
              fontFamily="IBM Plex Mono, monospace"
            >
              LOCAL VAULT REHYDRATION
            </text>
          </svg>

          {/* 01 Raw Document Input */}
          <CarbonNode
            index="01"
            title="Raw Document Input"
            description={`${docTitle || 'Untitled document'} · ${policyLabel}`}
            environment="LOCAL_ONLY"
            metric={`${rawCharCount.toLocaleString()} chars`}
            statusLabel={rawCharCount > 0 ? 'LOADED' : 'EMPTY'}
            state={rawCharCount > 0 ? 'completed' : 'idle'}
            selected={selectedNode === 'input'}
            icon={<FileText className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('input')}
            style={{ left: 16, top: 50, width: 210, height: 126 }}
          />

          {/* 02 Local Privacy Shield */}
          <CarbonNode
            index="02"
            title="Local Privacy Shield"
            description="Detects & tokenizes sensitive entities strictly locally"
            environment="ONLY_ON_DEVICE"
            metric={
              stage1Ran
                ? `${cloakedCount} cloaked${shieldLatencyMs !== null ? ` · ${shieldLatencyMs}ms` : ''}`
                : '0 CLOUD BYTES'
            }
            statusLabel={isRunning1 ? 'RUNNING' : stage1Ran ? 'VERIFIED' : 'READY'}
            state={isRunning1 ? 'running' : stage1Ran ? 'completed' : 'idle'}
            selected={selectedNode === 'shield'}
            icon={<Shield className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('shield')}
            style={{ left: 262, top: 50, width: 210, height: 126 }}
          />

          {/* 03 Local PII Vault */}
          <CarbonNode
            index="03"
            title="Local PII Vault"
            description="Encrypted token map retained exclusively in IndexedDB"
            environment="INDEXEDDB"
            metric={`${cloakedCount}/${totalVaultCount} tokens`}
            statusLabel={stage1Ran ? 'LOCKED' : 'EMPTY'}
            state={stage1Ran ? 'completed' : 'idle'}
            selected={selectedNode === 'vault'}
            icon={<Lock className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('vault')}
            style={{ left: 16, top: 236, width: 210, height: 126 }}
          />

          {/* 04 Instant Offline Triage */}
          <CarbonNode
            index="04"
            title="Instant Offline Triage"
            description={`Local risk scoring · ${cloudFallbackModel} fallback`}
            environment={triage ? triage.inferenceSource : 'PREFER_ON_DEVICE'}
            metric={triage ? `${triage.riskScore}/100 · ${triage.latencyMs}ms` : '$0.00 LOCAL'}
            statusLabel={isRunning2 ? 'RUNNING' : stage2Done ? triage!.severity : 'IDLE'}
            state={
              isRunning2
                ? 'running'
                : stage2Done
                  ? triage!.severity === 'CRITICAL'
                    ? 'error'
                    : triage!.severity === 'HIGH'
                      ? 'warning'
                      : 'completed'
                  : 'idle'
            }
            selected={selectedNode === 'triage'}
            icon={<Cpu className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('triage')}
            style={{ left: 262, top: 236, width: 210, height: 126 }}
          />

          {/* 05 Wire Gate */}
          <CarbonNode
            index="05"
            title="Wire Gate"
            description={
              !stage1Ran
                ? 'Awaiting Stage 1 scrub before permitting cloud transit'
                : zeroLeakVerified
                  ? 'Outbound payload verified free of raw vault values'
                  : 'Unredacted vault entries blocked from cloud transit'
            }
            environment="ZERO_LEAK_GATE"
            metric={!stage1Ran ? 'NOT RUN' : `${leakedCount} LEAKS`}
            statusLabel={
              !stage1Ran ? 'UNVERIFIED' : zeroLeakVerified ? 'VERIFIED' : 'BLOCKED'
            }
            state={!stage1Ran ? 'idle' : zeroLeakVerified ? 'completed' : 'error'}
            selected={selectedNode === 'wire'}
            icon={<Radio className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('wire')}
            style={{ left: 522, top: 50, width: 148, height: 166 }}
          />

          {/* 06 Deep Cloud Audit */}
          <CarbonNode
            index="06"
            title="Deep Cloud Audit"
            description={`Scrubbed payload analysis via ${cloudAuditModel}`}
            environment="ONLY_IN_CLOUD"
            metric={
              cloudAudit
                ? `$${cloudAudit.estimatedSavingsUsd.toLocaleString()} · ${cloudAudit.latencyMs}ms`
                : 'SCRUBBED ONLY'
            }
            statusLabel={isRunning3 ? 'RUNNING' : stage3Done ? 'AUDITED' : 'IDLE'}
            state={isRunning3 ? 'running' : stage3Done ? 'completed' : 'idle'}
            selected={selectedNode === 'audit'}
            icon={<Cloud className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('audit')}
            style={{ left: 720, top: 50, width: 242, height: 126 }}
          />

          {/* 07 Rehydrate & Sync */}
          <CarbonNode
            index="07"
            title="Rehydrate & Sync"
            description="Local placeholder restoration & Firestore Web/Android sync"
            environment="PREFER_IN_CLOUD"
            metric={
              lastSyncedCaseId
                ? 'SYNCED'
                : stage4Done
                  ? showRehydrated
                    ? 'REHYDRATED'
                    : 'SCRUBBED'
                  : 'READY'
            }
            statusLabel={isRunning4 ? 'DRAFTING' : stage4Done ? 'READY' : 'IDLE'}
            state={isRunning4 ? 'running' : stage4Done ? 'completed' : 'idle'}
            selected={selectedNode === 'action'}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => onSelectNode('action')}
            style={{ left: 720, top: 236, width: 242, height: 126 }}
          />
        </div>
      </div>

      {/* Integrated Bottom Command Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#25272B] bg-[#0D0E10] px-4 py-2.5">
        {/* Left: Single Contextual Primary Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={primaryCommand.onClick}
            disabled={primaryCommand.disabled}
            className="cc-btn-primary inline-flex items-center gap-2 px-3.5 py-1.5 text-[12.5px]"
          >
            {busyStage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            {primaryCommand.label}
          </button>
        </div>

        {/* Center: Live Execution Step & Verification Status */}
        <div className="hidden min-w-0 flex-1 items-center justify-center px-2 text-center text-[11.5px] xl:flex">
          {stage1Ran && !zeroLeakVerified ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#DB6666]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Cloud blocked — {leakedCount} unredacted value(s) detected
            </span>
          ) : stage1Verified ? (
            <span className="inline-flex items-center gap-1.5 truncate text-[#A3A7AD]">
              <Check className="h-3.5 w-3.5 shrink-0 text-[#56B89A]" />
              <span className="truncate">{primaryCommand.status}</span>
            </span>
          ) : (
            <span className="truncate text-[#777D85]">{primaryCommand.status}</span>
          )}
        </div>

        {/* Right: Secondary Command Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onTriggerScanImage}
            disabled={Boolean(busyStage)}
            className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
            title="Scan JPEG/PNG document strictly on-device"
          >
            <Upload className="h-3.5 w-3.5 text-[#A3A7AD]" /> Scan Image
          </button>
          <button
            type="button"
            onClick={onRunShieldAndTriage}
            disabled={Boolean(busyStage) || rawCharCount === 0}
            className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
          >
            <Shield className="h-3.5 w-3.5 text-[#56B89A]" /> Shield
          </button>
          <button
            type="button"
            onClick={onRunDeepAudit}
            disabled={Boolean(busyStage) || !canRunCloud}
            className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
          >
            <Cloud className="h-3.5 w-3.5 text-[#7D9DBA]" /> Audit
          </button>
          <button
            type="button"
            onClick={onToggleRehydrated}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[12px] font-medium transition ${
              showRehydrated
                ? 'border-[#56B89A]/40 bg-[#152420] text-[#56B89A]'
                : 'border-[#E8B35D]/40 bg-[#241E14] text-[#E8B35D]'
            }`}
            title="Toggle local placeholder rehydration"
          >
            {showRehydrated ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showRehydrated ? 'Rehydrated' : 'Scrubbed'}
          </button>
          <button
            type="button"
            onClick={onSyncFirestore}
            disabled={!canSync}
            className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
            title="Sync anonymized case to Firestore (Web + Android)"
          >
            <CloudUpload className="h-3.5 w-3.5 text-[#56B89A]" /> Sync
          </button>
        </div>
      </div>
    </div>
  );
};
