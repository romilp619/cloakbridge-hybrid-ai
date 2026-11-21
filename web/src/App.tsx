import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Cpu,
  Wifi,
  WifiOff,
  Upload,
  Lock,
  FolderSync,
  AlertOctagon,
  Sliders,
  Loader2,
  FileText,
  Cloud,
  Radio,
  RefreshCw,
  LayoutGrid,
  GitBranch,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { DEMO_DOCUMENTS } from './data/demoDocuments';
import {
  auth,
  DEFAULT_REMOTE_CONFIG,
  isFirebaseConfigured,
  loadRemotePolicyConfig,
  signInGuest,
  signInWithGoogle,
  signOutUser,
} from './services/firebase';
import {
  applyVaultScrub,
  loadLocalVaultEntries,
  rehydrateTextLocally,
  saveLocalVaultEntries,
  verifyZeroLeak,
} from './services/localVault';
import {
  askHybridQuestion,
  checkNanoAvailability,
  downloadNanoModel,
  extractDocumentFromImageOnDevice,
  runDeepCloudAudit,
  runHybridDisputeDraft,
  runHybridTriage,
  runLocalPrivacyShield,
} from './services/hybridAi';
import { deleteUserCase, saveAnonymizedCase, subscribeUserCases } from './services/caseSync';
import { WorkflowCanvas, type WorkflowNodeId } from './components/WorkflowCanvas';
import {
  NodeInspectorSidebar,
  nodeToInspectorTab,
  type InspectorTabId,
} from './components/NodeInspectorSidebar';
import { LocalVaultPanel } from './components/LocalVaultPanel';
import { WireInspector } from './components/WireInspector';
import { OfflineTriagePanel } from './components/OfflineTriagePanel';
import { CloudAuditPanel } from './components/CloudAuditPanel';
import { NanoStatusModal } from './components/NanoStatusModal';
import { CasesDrawer } from './components/CasesDrawer';
import type {
  CloudAuditResult,
  DisputeDraftResult,
  NanoStatus,
  PolicyProfile,
  RemotePolicyConfig,
  SavedCase,
  TelemetryEvent,
  TriageResult,
  VaultEntry,
} from './types/cloak';

function makeEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function App() {
  const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('canvas');
  const [selectedNode, setSelectedNode] = useState<WorkflowNodeId>('input');
  const [activeTab, setActiveTab] = useState<InspectorTabId>('input');
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [remoteConfig, setRemoteConfig] = useState<RemotePolicyConfig>(DEFAULT_REMOTE_CONFIG);
  const [policy, setPolicy] = useState<PolicyProfile>('medical');
  const [docTitle, setDocTitle] = useState<string>(DEMO_DOCUMENTS[0].title);
  const [rawText, setRawText] = useState<string>(DEMO_DOCUMENTS[0].rawText);

  // Local Vault & Scrubbing state (strictly client-side)
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [customSecret, setCustomSecret] = useState<string>('');
  const [shieldEngine, setShieldEngine] = useState<'ON_DEVICE_NANO' | 'LOCAL_RULE_FALLBACK' | null>(
    null
  );
  const [shieldLatencyMs, setShieldLatencyMs] = useState<number | null>(null);

  // Stage 2: Offline Triage & Q&A
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [qaInput, setQaInput] = useState<string>('');
  const [qaAnswer, setQaAnswer] = useState<{
    text: string;
    source: string;
    model: string;
    latencyMs: number;
  } | null>(null);

  // Stage 3 & 4: Deep Cloud Audit, Dispute Draft & Sync
  const [cloudAudit, setCloudAudit] = useState<CloudAuditResult | null>(null);
  const [disputeDraft, setDisputeDraft] = useState<DisputeDraftResult | null>(null);
  const [lastSyncedCaseId, setLastSyncedCaseId] = useState<string | null>(null);
  const [showRehydrated, setShowRehydrated] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Telemetry, Loading & Status
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Chrome Gemini Nano 4 status
  const [nanoStatus, setNanoStatus] = useState<NanoStatus>({
    supported: false,
    availability: 'unsupported',
    downloadProgress: null,
    detail: 'Checking Chrome Prompt API...',
  });
  const [nanoModalOpen, setNanoModalOpen] = useState<boolean>(false);

  // Firebase Auth & Synced Cases
  const [user, setUser] = useState<User | null>(null);
  const [syncedCases, setSyncedCases] = useState<SavedCase[]>([]);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrubbedText = useMemo(
    () => (vaultEntries.length > 0 ? applyVaultScrub(rawText, vaultEntries) : ''),
    [rawText, vaultEntries]
  );

  const leakVerification = useMemo(() => {
    if (!scrubbedText) return { verified: true, leakedValues: [] as string[] };
    return verifyZeroLeak(scrubbedText, vaultEntries);
  }, [scrubbedText, vaultEntries]);

  const activeVaultCount = useMemo(
    () => vaultEntries.filter((e) => e.enabled).length,
    [vaultEntries]
  );

  const handleSelectNode = (node: WorkflowNodeId, openDrawerOnMobile = false) => {
    setSelectedNode(node);
    setActiveTab(nodeToInspectorTab(node));
    if (openDrawerOnMobile) setMobileInspectorOpen(true);
  };

  const handleSelectTab = (tab: InspectorTabId) => {
    setActiveTab(tab);
    const tabToNode: Record<InspectorTabId, WorkflowNodeId> = {
      input: 'input',
      wire: 'wire',
      vault: 'vault',
      triage: 'triage',
      cloud: 'audit',
      action: 'action',
    };
    setSelectedNode(tabToNode[tab]);
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    checkNanoAvailability().then(setNanoStatus);
    loadRemotePolicyConfig().then((cfg) => setRemoteConfig(cfg));

    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) {
      setSyncedCases([]);
      return;
    }
    return subscribeUserCases(
      user.uid,
      (cases) => setSyncedCases(cases),
      (err) => console.warn('[CloakBridge] Firestore sync warning:', err.message)
    );
  }, [user]);

  const pushTelemetry = (event: Omit<TelemetryEvent, 'id' | 'timestamp'>) => {
    setTelemetry((prev) => [
      {
        ...event,
        id: makeEventId(),
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 19),
    ]);
  };

  const handleLoadDemo = (demoId: string) => {
    const demo = DEMO_DOCUMENTS.find((d) => d.id === demoId);
    if (!demo) return;
    setDocTitle(demo.title);
    setPolicy(demo.policy);
    setRawText(demo.rawText);
    setVaultEntries([]);
    setShieldLatencyMs(null);
    setTriage(null);
    setQaAnswer(null);
    setCloudAudit(null);
    setDisputeDraft(null);
    setLastSyncedCaseId(null);
    setBannerError(null);
    setBannerSuccess(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerError(null);
    setBusyStage('Stage 1: Transcribing image ON_DEVICE (Gemini Nano 4)...');
    try {
      const res = await extractDocumentFromImageOnDevice(file);
      setDocTitle(file.name.replace(/\.[^.]+$/, ''));
      setRawText(res.extractedText);
      setVaultEntries([]);
      setShieldLatencyMs(null);
      setTriage(null);
      setCloudAudit(null);
      setDisputeDraft(null);
      setLastSyncedCaseId(null);
      handleSelectNode('input');
      pushTelemetry({
        stage: 'PII_SHIELD',
        requestedMode: 'ONLY_ON_DEVICE',
        actualSource: res.inferenceSource,
        modelName: 'Gemini Nano 4 Multimodal',
        latencyMs: res.latencyMs,
        outboundBytes: 0,
        piiTokensProtected: 0,
        estimatedCostUsd: 0,
        note: `Local OCR of ${file.name} (0 bytes sent to cloud)`,
      });
      setBannerSuccess('Document image transcribed strictly on-device. Run Local Privacy Shield next.');
    } catch (err) {
      setBannerError(
        `On-device image OCR requires Gemini Nano 4 Multimodal in Chrome (${(err as Error).message}). You can edit text directly or select a preset.`
      );
    } finally {
      setBusyStage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleShieldAndTriage = async () => {
    if (!rawText.trim()) return;
    setBannerError(null);
    setBannerSuccess(null);
    setLastSyncedCaseId(null);
    setBusyStage('Stage 1: Running ONLY_ON_DEVICE Privacy Shield...');
    handleSelectNode('shield');

    try {
      const customEntries = vaultEntries.filter((e) => e.source === 'USER_CUSTOM');
      const scrub = await runLocalPrivacyShield(rawText, policy, remoteConfig, customEntries);
      setVaultEntries(scrub.entries);
      setShieldEngine(scrub.engineUsed);
      setShieldLatencyMs(scrub.latencyMs);
      await saveLocalVaultEntries(docTitle, scrub.entries);

      pushTelemetry({
        stage: 'PII_SHIELD',
        requestedMode: 'ONLY_ON_DEVICE',
        actualSource: scrub.engineUsed === 'ON_DEVICE_NANO' ? 'ON_DEVICE' : 'LOCAL_RULE',
        modelName:
          scrub.engineUsed === 'ON_DEVICE_NANO'
            ? 'Gemini Nano 4 + Local Guardrail'
            : 'Deterministic Local Shield (0 cloud bytes)',
        latencyMs: scrub.latencyMs,
        outboundBytes: 0,
        piiTokensProtected: scrub.entries.length,
        estimatedCostUsd: 0,
        note: `Vaulted ${scrub.entries.length} sensitive entities locally`,
      });

      setBusyStage('Stage 2: Running PREFER_ON_DEVICE Offline Triage...');
      const triageRes = await runHybridTriage(scrub.scrubbedText, policy, remoteConfig);
      setTriage(triageRes);
      handleSelectNode('triage');

      pushTelemetry({
        stage: 'LOCAL_TRIAGE',
        requestedMode: 'PREFER_ON_DEVICE',
        actualSource: triageRes.inferenceSource,
        modelName: triageRes.modelUsed,
        latencyMs: triageRes.latencyMs,
        outboundBytes:
          triageRes.inferenceSource === 'IN_CLOUD'
            ? new TextEncoder().encode(scrub.scrubbedText).length
            : 0,
        piiTokensProtected: scrub.entries.length,
        estimatedCostUsd: triageRes.inferenceSource === 'IN_CLOUD' ? 0.0004 : 0,
        note: `Risk ${triageRes.riskScore}/100 (${triageRes.severity})`,
      });
    } catch (err) {
      setBannerError((err as Error).message);
    } finally {
      setBusyStage(null);
    }
  };

  const handleToggleVaultEntry = (token: string) => {
    setVaultEntries((prev) =>
      prev.map((entry) => (entry.token === token ? { ...entry, enabled: !entry.enabled } : entry))
    );
  };

  const handleAddCustomSecret = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customSecret.trim();
    if (val.length < 2) return;
    if (!rawText.includes(val)) {
      setBannerError(`"${val}" was not found verbatim in the raw document.`);
      return;
    }
    const existingIdx = vaultEntries.filter((v) => v.category === 'ID').length + 1;
    const newEntry: VaultEntry = {
      token: `[CUSTOM_${existingIdx}]`,
      original: val,
      category: 'ID',
      source: 'USER_CUSTOM',
      enabled: true,
    };
    setVaultEntries((prev) => [newEntry, ...prev]);
    setCustomSecret('');
    setBannerError(null);
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || !scrubbedText) return;
    setBannerError(null);
    setBusyStage('Stage 2: Running PREFER_ON_DEVICE Offline Q&A...');
    try {
      const res = await askHybridQuestion(scrubbedText, qaInput.trim(), remoteConfig);
      const displayAnswer = showRehydrated
        ? rehydrateTextLocally(res.answer, vaultEntries)
        : res.answer;
      setQaAnswer({
        text: displayAnswer,
        source: res.inferenceSource,
        model: res.modelUsed,
        latencyMs: res.latencyMs,
      });
      pushTelemetry({
        stage: 'OFFLINE_QA',
        requestedMode: 'PREFER_ON_DEVICE',
        actualSource: res.inferenceSource,
        modelName: res.modelUsed,
        latencyMs: res.latencyMs,
        outboundBytes:
          res.inferenceSource === 'IN_CLOUD' ? new TextEncoder().encode(scrubbedText).length : 0,
        piiTokensProtected: activeVaultCount,
        estimatedCostUsd: res.inferenceSource === 'IN_CLOUD' ? 0.0003 : 0,
        note: `Answered: "${qaInput.trim().slice(0, 36)}"`,
      });
      setQaInput('');
    } catch (err) {
      setBannerError((err as Error).message);
    } finally {
      setBusyStage(null);
    }
  };

  const handleDeepCloudAudit = async () => {
    if (!scrubbedText) {
      setBannerError('Run Stage 1 Privacy Shield first so zero raw PII leaves your device.');
      return;
    }
    if (!isOnline) {
      setBannerError(
        'Currently offline. Stage 1 and Stage 2 execute locally via Gemini Nano 4; reconnect for Deep Cloud Audit.'
      );
      return;
    }
    setBannerError(null);
    setBannerSuccess(null);
    handleSelectNode('audit');
    setBusyStage(`Stage 3: Running ONLY_IN_CLOUD Audit (${remoteConfig.cloudAuditModel})...`);

    try {
      const audit = await runDeepCloudAudit(scrubbedText, vaultEntries, policy, remoteConfig);
      setCloudAudit(audit);
      pushTelemetry({
        stage: 'DEEP_AUDIT',
        requestedMode: 'ONLY_IN_CLOUD',
        actualSource: audit.inferenceSource,
        modelName: audit.modelUsed,
        latencyMs: audit.latencyMs,
        outboundBytes: new TextEncoder().encode(audit.rawScrubbedPayloadSent).length,
        piiTokensProtected: activeVaultCount,
        estimatedCostUsd: 0.0018,
        note: `${audit.findings.length} findings · ~$${audit.estimatedSavingsUsd.toLocaleString()} impact`,
      });
    } catch (err) {
      setBannerError((err as Error).message);
    } finally {
      setBusyStage(null);
    }
  };

  const handleDraftDispute = async () => {
    if (!scrubbedText) return;
    setBannerError(null);
    handleSelectNode('action');
    setBusyStage('Stage 4: Drafting letter (PREFER_IN_CLOUD with Nano fallback)...');
    try {
      const summary =
        cloudAudit?.executiveSummary ||
        triage?.summary ||
        'Audit flagged unfair charges and high-risk terms.';
      const draft = await runHybridDisputeDraft(
        scrubbedText,
        summary,
        vaultEntries,
        policy,
        remoteConfig
      );
      setDisputeDraft(draft);
      pushTelemetry({
        stage: 'DISPUTE_DRAFT',
        requestedMode: 'PREFER_IN_CLOUD',
        actualSource: draft.inferenceSource,
        modelName: draft.modelUsed,
        latencyMs: draft.latencyMs,
        outboundBytes:
          draft.inferenceSource === 'IN_CLOUD' ? new TextEncoder().encode(scrubbedText).length : 0,
        piiTokensProtected: activeVaultCount,
        estimatedCostUsd: draft.inferenceSource === 'IN_CLOUD' ? 0.0014 : 0,
        note: 'Generated tokenized letter & rehydrated locally',
      });
    } catch (err) {
      setBannerError((err as Error).message);
    } finally {
      setBusyStage(null);
    }
  };

  const handleSyncToFirestore = async () => {
    if (!scrubbedText) return;
    setBannerError(null);
    setBannerSuccess(null);
    try {
      let activeUser = user;
      if (!activeUser) {
        await signInGuest();
        activeUser = auth?.currentUser ?? null;
      }
      if (!activeUser) {
        throw new Error('Sign in required to sync anonymized cases to Firestore.');
      }

      const auditMarkdown = cloudAudit
        ? `## Executive Summary\n${cloudAudit.executiveSummary}\n\n` +
          cloudAudit.findings
            .map(
              (f) =>
                `- **${f.title}** (${f.severity}, ~$${f.estimatedImpactUsd}): ${f.explanation} — *Action:* ${f.actionStep}`
            )
            .join('\n')
        : '';

      const caseId = await saveAnonymizedCase(
        activeUser.uid,
        {
          title: docTitle || 'Untitled Anonymized Case',
          policyProfile: policy,
          platform: 'web',
          scrubbedText,
          tokenCount: activeVaultCount,
          zeroLeakVerified: true,
          triageSummary: triage?.summary || 'Anonymized via CloakBridge Web',
          riskScore: cloudAudit?.overallRiskScore ?? triage?.riskScore ?? 50,
          triageSource: triage?.inferenceSource || 'LOCAL_RULE',
          cloudAuditMarkdown: auditMarkdown,
          cloudAuditSource: cloudAudit ? 'IN_CLOUD' : 'PENDING',
          disputeDraftScrubbed: disputeDraft?.scrubbedDraft || '',
          estimatedSavingsUsd: cloudAudit?.estimatedSavingsUsd ?? 0,
        },
        vaultEntries
      );
      setLastSyncedCaseId(caseId);
      setBannerSuccess(
        `Anonymized case ${caseId} synced to Cloud Firestore (0 raw PII stored) — visible live on CloakBridge Android.`
      );
    } catch (err) {
      setBannerError((err as Error).message);
    }
  };

  const handleLoadSyncedCase = async (c: SavedCase) => {
    setDocTitle(c.title);
    setPolicy(c.policyProfile);
    setRawText(c.scrubbedText);
    setLastSyncedCaseId(c.id);
    const savedVault = await loadLocalVaultEntries(c.title);
    setVaultEntries(savedVault ?? []);
    setTriage({
      summary: c.triageSummary,
      riskScore: c.riskScore,
      severity: c.riskScore >= 80 ? 'CRITICAL' : c.riskScore >= 60 ? 'HIGH' : 'MEDIUM',
      redFlags: [],
      inferenceSource: c.triageSource,
      latencyMs: 0,
      modelUsed: `Synced from ${c.platform.toUpperCase()}`,
    });
    if (c.cloudAuditMarkdown) {
      setCloudAudit({
        executiveSummary: c.cloudAuditMarkdown,
        overallRiskScore: c.riskScore,
        estimatedSavingsUsd: c.estimatedSavingsUsd,
        findings: [],
        rawScrubbedPayloadSent: c.scrubbedText,
        inferenceSource: c.cloudAuditSource === 'ON_DEVICE' ? 'ON_DEVICE' : 'IN_CLOUD',
        latencyMs: 0,
        modelUsed: 'Synced Firestore Audit',
      });
    } else {
      setCloudAudit(null);
    }
    if (c.disputeDraftScrubbed) {
      setDisputeDraft({
        scrubbedDraft: c.disputeDraftScrubbed,
        rehydratedDraft: savedVault
          ? rehydrateTextLocally(c.disputeDraftScrubbed, savedVault)
          : c.disputeDraftScrubbed,
        inferenceSource: 'IN_CLOUD',
        latencyMs: 0,
        modelUsed: 'Synced Draft',
      });
    } else {
      setDisputeDraft(null);
    }
  };

  const activeDraftDisplay = disputeDraft
    ? showRehydrated
      ? disputeDraft.rehydratedDraft
      : disputeDraft.scrubbedDraft
    : '';

  const handleCopyDraft = async () => {
    if (!activeDraftDisplay) return;
    await navigator.clipboard.writeText(activeDraftDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadDraft = () => {
    if (!activeDraftDisplay) return;
    const blob = new Blob([activeDraftDisplay], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dispute.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTextWithRehydration = (text: string) =>
    showRehydrated ? rehydrateTextLocally(text, vaultEntries) : text;

  const railItems: Array<{
    id: WorkflowNodeId;
    label: string;
    icon: React.ReactNode;
    dotColor?: string;
  }> = [
    {
      id: 'input',
      label: '01 Raw Document Input',
      icon: <FileText className="h-4 w-4" />,
      dotColor: rawText.length > 0 ? 'bg-[#56B89A]' : undefined,
    },
    {
      id: 'shield',
      label: '02 Local Privacy Shield',
      icon: <Shield className="h-4 w-4" />,
      dotColor: vaultEntries.length > 0 ? 'bg-[#56B89A]' : undefined,
    },
    {
      id: 'vault',
      label: '03 Local PII Vault',
      icon: <Lock className="h-4 w-4" />,
      dotColor: vaultEntries.length > 0 ? 'bg-[#E8B35D]' : undefined,
    },
    {
      id: 'triage',
      label: '04 Instant Offline Triage',
      icon: <Cpu className="h-4 w-4" />,
      dotColor: triage ? 'bg-[#56B89A]' : undefined,
    },
    {
      id: 'wire',
      label: '05 Wire Gate & Telemetry',
      icon: <Radio className="h-4 w-4" />,
      dotColor:
        vaultEntries.length > 0
          ? leakVerification.verified
            ? 'bg-[#56B89A]'
            : 'bg-[#DB6666]'
          : undefined,
    },
    {
      id: 'audit',
      label: '06 Deep Cloud Audit',
      icon: <Cloud className="h-4 w-4" />,
      dotColor: cloudAudit ? 'bg-[#7D9DBA]' : undefined,
    },
    {
      id: 'action',
      label: '07 Rehydrate & Sync',
      icon: <RefreshCw className="h-4 w-4" />,
      dotColor: disputeDraft || lastSyncedCaseId ? 'bg-[#56B89A]' : undefined,
    },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#08090A] text-[#F1F2F3]">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* TOP COMMAND BAR (56px) */}
      <header className="z-30 flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#25272B] bg-[#0D0E10] px-4 py-2">
        {/* Left: Compact Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-[7px] border border-[#303237] bg-[#17191C] text-[#F1F2F3]">
            <Shield className="h-4 w-4 stroke-[2.2]" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#E37A37]" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-[#F1F2F3]">
              CloakBridge
            </h1>
            <p className="hidden text-[11px] text-[#777D85] sm:block">
              On-Device Privacy Firewall / Anonymized Cloud Reasoning / Local Rehydration
            </p>
          </div>
        </div>

        {/* Center: High-Craft Segmented View Switcher */}
        <div
          role="group"
          aria-label="Workspace view mode"
          className="inline-flex rounded-[7px] border border-[#303237] bg-[#131518] p-0.5 text-[12px]"
        >
          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`relative inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 font-medium transition-colors duration-150 ${
              viewMode === 'canvas'
                ? 'bg-[#202226] text-[#F1F2F3]'
                : 'text-[#777D85] hover:bg-[#17191C] hover:text-[#A3A7AD]'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" /> Workflow
            {viewMode === 'canvas' && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#E37A37]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`relative inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 font-medium transition-colors duration-150 ${
              viewMode === 'grid'
                ? 'bg-[#202226] text-[#F1F2F3]'
                : 'text-[#777D85] hover:bg-[#17191C] hover:text-[#A3A7AD]'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Split Grid
            {viewMode === 'grid' && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#E37A37]" />
            )}
          </button>
        </div>

        {/* Right: Compact Operational Status Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <div className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#25272B] bg-[#131518] px-2.5 py-1 text-[#A3A7AD]">
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-[#56B89A]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-[#E8B35D]" />
            )}
            <span className={isOnline ? 'text-[#F1F2F3]' : 'text-[#E8B35D]'}>
              {isOnline ? 'Online · Hybrid Ready' : 'Offline · Local'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setNanoModalOpen(true)}
            className="cc-btn-ghost inline-flex items-center gap-1.5 border border-[#25272B] bg-[#131518] px-2.5 py-1 text-[11.5px]"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                nanoStatus.availability === 'available' ? 'bg-[#56B89A]' : 'bg-[#E8B35D]'
              }`}
            />
            <Cpu className="h-3.5 w-3.5 text-[#A3A7AD]" />
            <span className="text-[#F1F2F3]">
              {nanoStatus.availability === 'available'
                ? 'Nano 4 Ready'
                : nanoStatus.availability === 'downloadable'
                  ? 'Download Nano'
                  : 'Nano Setup / Hybrid'}
            </span>
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#25272B] bg-[#131518] px-2.5 py-1">
            <Sliders className="h-3 w-3 text-[#777D85]" />
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value as PolicyProfile)}
              aria-label="Privacy policy profile"
              className="bg-transparent text-[11.5px] font-medium text-[#F1F2F3] focus:outline-none"
            >
              {(Object.keys(remoteConfig.policies) as PolicyProfile[]).map((key) => (
                <option key={key} value={key} className="bg-[#17191C] text-[#F1F2F3]">
                  {remoteConfig.policies[key].label}
                </option>
              ))}
            </select>
            <span className="border-l border-[#25272B] pl-1.5 font-mono text-[10px] text-[#7D9DBA]">
              {remoteConfig.source === 'REMOTE_CONFIG' ? 'RC LIVE' : 'RC DEF'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="cc-btn-ghost inline-flex items-center gap-1.5 border border-[#25272B] bg-[#131518] px-2.5 py-1 text-[11.5px] text-[#F1F2F3]"
          >
            <FolderSync className="h-3.5 w-3.5 text-[#7D9DBA]" />
            <span>Synced Cases</span>
            {syncedCases.length > 0 && (
              <span className="font-mono text-[10.5px] text-[#56B89A]">
                ({syncedCases.length})
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Inline Execution / Error / Confirmation Banner */}
      {(busyStage || bannerError || bannerSuccess || !isFirebaseConfigured) && (
        <div className="shrink-0 border-b border-[#25272B] bg-[#131518] px-4 py-2 text-[12px]">
          {!isFirebaseConfigured && (
            <div className="flex items-center gap-2 text-[#E8B35D]">
              <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Local Preview:</strong> Configure Firebase keys in{' '}
                <code>web/.env.local</code> for live Cloud Gemini audits and Firestore sync.
              </span>
            </div>
          )}
          {busyStage && (
            <div className="flex items-center gap-2 font-medium text-[#E37A37]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{busyStage}</span>
            </div>
          )}
          {bannerError && (
            <div className="flex items-center justify-between gap-2 text-[#DB6666]">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
                <span>{bannerError}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerError(null)}
                className="font-mono text-[10.5px] text-[#A3A7AD] hover:text-[#F1F2F3]"
              >
                Dismiss
              </button>
            </div>
          )}
          {bannerSuccess && (
            <div className="flex items-center justify-between gap-2 text-[#56B89A]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>{bannerSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerSuccess(null)}
                className="font-mono text-[10.5px] text-[#A3A7AD] hover:text-[#F1F2F3]"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* MAIN COMMAND CENTER BODY */}
      {viewMode === 'canvas' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SECURITY WORKSTATION NAVIGATION SIDEBAR (60px) */}
          <nav
            aria-label="Workflow Modules"
            className="hidden w-[60px] shrink-0 flex-col items-center justify-between border-r border-[#25272B] bg-[#0D0E10] py-3 sm:flex"
          >
            <div className="flex w-full flex-col items-center gap-1.5">
              {railItems.map((item) => {
                const isSelected = selectedNode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNode(item.id, true)}
                    title={item.label}
                    aria-label={item.label}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-[7px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E37A37] ${
                      isSelected
                        ? 'bg-[#202226] text-[#F1F2F3]'
                        : 'text-[#777D85] hover:bg-[#17191C] hover:text-[#F1F2F3]'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute -left-[10px] bottom-2 top-2 w-[2.5px] rounded-r bg-[#E37A37]" />
                    )}
                    {item.icon}
                    {item.dotColor && (
                      <span
                        className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${item.dotColor}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-1.5 border-t border-[#25272B] pt-3">
              <button
                type="button"
                onClick={() => setNanoModalOpen(true)}
                title="Gemini Nano 4 On-Device Engine"
                aria-label="Gemini Nano 4 Engine Status"
                className="flex h-9 w-9 items-center justify-center rounded-[7px] text-[#777D85] transition-colors hover:bg-[#17191C] hover:text-[#F1F2F3]"
              >
                <Cpu className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                title="Cross-Platform Synced Cases"
                aria-label="Open synced cases drawer"
                className="flex h-9 w-9 items-center justify-center rounded-[7px] text-[#777D85] transition-colors hover:bg-[#17191C] hover:text-[#F1F2F3]"
              >
                <FolderSync className="h-4 w-4" />
              </button>
            </div>
          </nav>

          {/* CENTER MATTE GRAPHITE WORKFLOW CANVAS */}
          <WorkflowCanvas
            selectedNode={selectedNode}
            onSelectNode={(node) => handleSelectNode(node, true)}
            docTitle={docTitle}
            policyLabel={remoteConfig.policies[policy].label}
            rawCharCount={rawText.length}
            cloakedCount={activeVaultCount}
            totalVaultCount={vaultEntries.length}
            zeroLeakVerified={leakVerification.verified}
            leakedCount={leakVerification.leakedValues.length}
            shieldLatencyMs={shieldLatencyMs}
            triage={triage}
            cloudAudit={cloudAudit}
            disputeDraft={disputeDraft}
            cloudAuditModel={remoteConfig.cloudAuditModel}
            cloudFallbackModel={remoteConfig.cloudFallbackModel}
            showRehydrated={showRehydrated}
            onToggleRehydrated={() => setShowRehydrated((v) => !v)}
            busyStage={busyStage}
            onRunShieldAndTriage={handleShieldAndTriage}
            onRunDeepAudit={handleDeepCloudAudit}
            onDraftDispute={handleDraftDispute}
            onSyncFirestore={handleSyncToFirestore}
            onTriggerScanImage={() => fileInputRef.current?.click()}
            onOpenMobileInspector={() => setMobileInspectorOpen(true)}
            canRunCloud={Boolean(scrubbedText) && leakVerification.verified}
            canSync={Boolean(scrubbedText) && isFirebaseConfigured && leakVerification.verified}
            lastSyncedCaseId={lastSyncedCaseId}
          />

          {/* RIGHT RESIZABLE TECHNICAL INSPECTOR */}
          <NodeInspectorSidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            mobileOpen={mobileInspectorOpen}
            onCloseMobile={() => setMobileInspectorOpen(false)}
            docTitle={docTitle}
            onDocTitleChange={setDocTitle}
            rawText={rawText}
            onRawTextChange={setRawText}
            onLoadDemo={handleLoadDemo}
            onTriggerScanImage={() => fileInputRef.current?.click()}
            onRunShieldAndTriage={handleShieldAndTriage}
            vaultEntries={vaultEntries}
            shieldEngine={shieldEngine}
            customSecret={customSecret}
            onCustomSecretChange={setCustomSecret}
            onAddCustomSecret={handleAddCustomSecret}
            onToggleVaultEntry={handleToggleVaultEntry}
            scrubbedText={scrubbedText}
            zeroLeakVerified={leakVerification.verified}
            leakedValues={leakVerification.leakedValues}
            activeVaultCount={activeVaultCount}
            telemetry={telemetry}
            triage={triage}
            qaInput={qaInput}
            onQaInputChange={setQaInput}
            onAskQuestion={handleAskQuestion}
            qaAnswer={qaAnswer}
            cloudAuditModel={remoteConfig.cloudAuditModel}
            cloudAudit={cloudAudit}
            disputeDraft={disputeDraft}
            showRehydrated={showRehydrated}
            onToggleRehydrated={() => setShowRehydrated((v) => !v)}
            onRunDeepAudit={handleDeepCloudAudit}
            onDraftDispute={handleDraftDispute}
            onSyncFirestore={handleSyncToFirestore}
            canRunCloud={Boolean(scrubbedText) && leakVerification.verified}
            canSync={Boolean(scrubbedText) && isFirebaseConfigured && leakVerification.verified}
            lastSyncedCaseId={lastSyncedCaseId}
            busyStage={busyStage}
            copied={copied}
            onCopyDraft={handleCopyDraft}
            onDownloadDraft={handleDownloadDraft}
            activeDraftDisplay={activeDraftDisplay}
            renderText={renderTextWithRehydration}
          />
        </div>
      ) : (
        /* SPLIT GRID VIEW (Carbon Command Center 3-Column Mode) */
        <main className="flex-1 overflow-y-auto bg-[#101113] p-5">
          <div className="mx-auto grid max-w-[1580px] grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-4">
              <div className="cc-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#56B89A]" />
                    <h2 className="text-[14px] font-semibold text-[#F1F2F3]">
                      01 Raw Document (Local-Only)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="cc-btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#A3A7AD]" /> Scan Image
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 rounded-[6px] border border-[#303237] bg-[#0D0E10] p-0.5">
                  {DEMO_DOCUMENTS.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => handleLoadDemo(demo.id)}
                      className={`rounded-[5px] px-2 py-1.5 text-[11px] font-medium ${
                        docTitle === demo.title
                          ? 'bg-[#202226] text-[#F1F2F3]'
                          : 'text-[#777D85] hover:text-[#A3A7AD]'
                      }`}
                    >
                      {demo.badge}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="mt-3 w-full rounded-[6px] border border-[#303237] bg-[#0D0E10] px-3 py-2 text-[13px] font-medium text-[#F1F2F3] focus:border-[#E37A37] focus:outline-none"
                />

                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={13}
                  className="mt-2.5 w-full rounded-[6px] border border-[#303237] bg-[#0D0E10] p-3 text-[13px] leading-[1.6] text-[#F1F2F3] focus:border-[#E37A37] focus:outline-none"
                />

                <button
                  type="button"
                  onClick={handleShieldAndTriage}
                  disabled={Boolean(busyStage) || !rawText.trim()}
                  className="cc-btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-[12.5px]"
                >
                  <Shield className="h-3.5 w-3.5" /> Run Privacy Shield &amp; Offline Triage
                </button>
              </div>

              <LocalVaultPanel
                vaultEntries={vaultEntries}
                shieldEngine={shieldEngine}
                customSecret={customSecret}
                onCustomSecretChange={setCustomSecret}
                onAddCustomSecret={handleAddCustomSecret}
                onToggleEntry={handleToggleVaultEntry}
              />
            </div>

            <div className="flex flex-col gap-4 lg:col-span-4">
              <WireInspector
                scrubbedText={scrubbedText}
                zeroLeakVerified={leakVerification.verified}
                leakedValues={leakVerification.leakedValues}
                protectedCount={activeVaultCount}
                telemetry={telemetry}
              />
              <OfflineTriagePanel
                triage={triage}
                qaInput={qaInput}
                onQaInputChange={setQaInput}
                onAskQuestion={handleAskQuestion}
                qaAnswer={qaAnswer}
                busy={Boolean(busyStage)}
                canAsk={Boolean(scrubbedText)}
                renderText={renderTextWithRehydration}
              />
            </div>

            <div className="flex flex-col lg:col-span-4">
              <CloudAuditPanel
                cloudAuditModel={remoteConfig.cloudAuditModel}
                cloudAudit={cloudAudit}
                disputeDraft={disputeDraft}
                showRehydrated={showRehydrated}
                onToggleRehydrated={() => setShowRehydrated((v) => !v)}
                onRunDeepAudit={handleDeepCloudAudit}
                onDraftDispute={handleDraftDispute}
                onSyncFirestore={handleSyncToFirestore}
                canRunCloud={Boolean(scrubbedText) && leakVerification.verified}
                canSync={Boolean(scrubbedText) && isFirebaseConfigured && leakVerification.verified}
                zeroLeakVerified={leakVerification.verified}
                protectedCount={activeVaultCount}
                lastSyncedCaseId={lastSyncedCaseId}
                busyStage={busyStage}
                copied={copied}
                onCopyDraft={handleCopyDraft}
                onDownloadDraft={handleDownloadDraft}
                activeDraftDisplay={activeDraftDisplay}
                renderText={renderTextWithRehydration}
                mode="combined"
              />
            </div>
          </div>
        </main>
      )}

      <NanoStatusModal
        open={nanoModalOpen}
        onClose={() => setNanoModalOpen(false)}
        status={nanoStatus}
        onRefresh={async () => setNanoStatus(await checkNanoAvailability())}
        onDownload={async (onProgress) => {
          const updated = await downloadNanoModel(onProgress);
          setNanoStatus(updated);
        }}
      />

      <CasesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        isFirebaseConfigured={isFirebaseConfigured}
        cases={syncedCases}
        onSignInGuest={signInGuest}
        onSignInGoogle={signInWithGoogle}
        onSignOut={signOutUser}
        onSelectCase={handleLoadSyncedCase}
        onDeleteCase={async (id) => {
          if (user) await deleteUserCase(user.uid, id);
        }}
      />
    </div>
  );
}
