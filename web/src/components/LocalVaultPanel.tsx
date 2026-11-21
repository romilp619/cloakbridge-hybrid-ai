import React, { useMemo, useState } from 'react';
import { Lock, Plus, Search, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import type { EntityCategory, VaultEntry } from '../types/cloak';

interface LocalVaultPanelProps {
  vaultEntries: VaultEntry[];
  shieldEngine: 'ON_DEVICE_NANO' | 'LOCAL_RULE_FALLBACK' | null;
  customSecret: string;
  onCustomSecretChange: (val: string) => void;
  onAddCustomSecret: (e: React.FormEvent) => void;
  onToggleEntry: (token: string) => void;
}

const CATEGORY_LABELS: Record<EntityCategory, string> = {
  PERSON: 'People',
  ID: 'IDs & SSN',
  ACCT: 'Accounts',
  EMAIL: 'Emails',
  PHONE: 'Phones',
  LOC: 'Addresses',
  DOB: 'Dates of Birth',
  ORG: 'Organizations',
  AMOUNT_SENSITIVE: 'Sensitive Amounts',
};

function maskSensitive(value: string): string {
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 4))}${value.slice(-2)}`;
}

export const LocalVaultPanel: React.FC<LocalVaultPanelProps> = ({
  vaultEntries,
  shieldEngine,
  customSecret,
  onCustomSecretChange,
  onAddCustomSecret,
  onToggleEntry,
}) => {
  const [filterText, setFilterText] = useState('');
  const [revealValues, setRevealValues] = useState(false);
  const [customOpen, setCustomOpen] = useState(true);

  const activeCount = useMemo(
    () => vaultEntries.filter((e) => e.enabled).length,
    [vaultEntries]
  );

  const grouped = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = q
      ? vaultEntries.filter(
          (e) =>
            e.token.toLowerCase().includes(q) ||
            e.original.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q)
        )
      : vaultEntries;

    const map = new Map<EntityCategory, VaultEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return Array.from(map.entries());
  }, [vaultEntries, filterText]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Vault Overview & Mappings */}
      <div className="cc-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#56B89A]" />
              <h3 className="text-[14px] font-semibold text-[#F1F2F3]">Local PII Vault</h3>
            </div>
            <p className="mt-0.5 text-[12px] text-[#777D85]">
              Stored exclusively in browser IndexedDB · Never synced to cloud
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRevealValues((v) => !v)}
              className="cc-btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
              title={revealValues ? 'Mask sensitive values' : 'Reveal original local values'}
            >
              {revealValues ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealValues ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </div>

        {/* Summary Metrics Strip */}
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-[6px] border border-[#25272B] bg-[#0D0E10] p-2.5 font-mono text-[10.5px]">
          <div>
            <span className="block text-[#777D85]">DETECTED</span>
            <span className="mt-0.5 block text-[13px] font-semibold text-[#F1F2F3]">
              {vaultEntries.length}
            </span>
          </div>
          <div className="border-x border-[#25272B] px-2.5">
            <span className="block text-[#777D85]">CLOAKED</span>
            <span className="mt-0.5 block text-[13px] font-semibold text-[#56B89A]">
              {activeCount}
            </span>
          </div>
          <div className="pl-1">
            <span className="block text-[#777D85]">ENGINE</span>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-[#A3A7AD]">
              {shieldEngine === 'ON_DEVICE_NANO'
                ? 'Nano 4'
                : shieldEngine === 'LOCAL_RULE_FALLBACK'
                  ? 'Local Rule'
                  : 'Idle'}
            </span>
          </div>
        </div>

        {vaultEntries.length > 0 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#777D85]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter tokens, categories, or values..."
              className="w-full rounded-[6px] border border-[#303237] bg-[#0D0E10] py-1.5 pl-8 pr-3 text-[12px] text-[#F1F2F3] placeholder:text-[#777D85] focus:border-[#E37A37] focus:outline-none"
            />
          </div>
        )}

        {vaultEntries.length === 0 ? (
          <div className="mt-3 rounded-[6px] border border-dashed border-[#303237] bg-[#0D0E10] p-4 text-[12px] text-[#777D85]">
            No vaulted entities yet. Run <strong className="text-[#F1F2F3]">Local Privacy Shield</strong>{' '}
            to extract and tokenize sensitive PII/PHI locally.
          </div>
        ) : (
          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#777D85]">
                  <span>{CATEGORY_LABELS[category] || category}</span>
                  <span>{items.length}</span>
                </div>
                <div className="divide-y divide-[#25272B] rounded-[6px] border border-[#25272B] bg-[#0D0E10]">
                  {items.map((entry) => (
                    <div
                      key={entry.token}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`shrink-0 font-mono text-[11px] font-semibold ${
                            entry.enabled ? 'text-[#E8B35D]' : 'text-[#777D85] line-through'
                          }`}
                        >
                          {entry.token}
                        </span>
                        <span
                          className={`truncate font-mono text-[11px] ${
                            entry.enabled ? 'text-[#A3A7AD]' : 'text-[#5A6068] line-through'
                          }`}
                        >
                          {revealValues ? entry.original : maskSensitive(entry.original)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleEntry(entry.token)}
                        className={`shrink-0 rounded-[5px] border px-2 py-0.5 font-mono text-[10px] font-medium transition ${
                          entry.enabled
                            ? 'border-[#56B89A]/35 bg-[#152420] text-[#56B89A] hover:border-[#56B89A]'
                            : 'border-[#303237] bg-[#17191C] text-[#777D85] hover:text-[#F1F2F3]'
                        }`}
                        title={`Source: ${entry.source}`}
                      >
                        {entry.enabled ? 'CLOAKED' : 'BYPASSED'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible Custom Secret Cloaker */}
      <div className="cc-card overflow-hidden">
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12.5px] font-semibold text-[#F1F2F3] hover:bg-[#202226]"
        >
          <span>Add Custom Secret Phrase</span>
          {customOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#777D85]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#777D85]" />
          )}
        </button>
        {customOpen && (
          <form
            onSubmit={onAddCustomSecret}
            className="flex gap-2 border-t border-[#25272B] p-3.5"
          >
            <input
              type="text"
              value={customSecret}
              onChange={(e) => onCustomSecretChange(e.target.value)}
              placeholder="Exact string from raw document..."
              className="flex-1 rounded-[6px] border border-[#303237] bg-[#0D0E10] px-3 py-1.5 text-[12px] text-[#F1F2F3] placeholder:text-[#777D85] focus:border-[#E37A37] focus:outline-none"
            />
            <button
              type="submit"
              className="cc-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-[12px]"
            >
              <Plus className="h-3.5 w-3.5" /> Cloak
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
