import React from 'react';
import { X, Smartphone, Globe, Trash2, ShieldCheck, LogIn, LogOut, UserCheck } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { SavedCase } from '../types/cloak';

interface CasesDrawerProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  isFirebaseConfigured: boolean;
  cases: SavedCase[];
  onSignInGuest: () => Promise<void>;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSelectCase: (c: SavedCase) => void;
  onDeleteCase: (id: string) => Promise<void>;
}

export const CasesDrawer: React.FC<CasesDrawerProps> = ({
  open,
  onClose,
  user,
  isFirebaseConfigured,
  cases,
  onSignInGuest,
  onSignInGoogle,
  onSignOut,
  onSelectCase,
  onDeleteCase,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75">
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#303237] bg-[#131518] p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#25272B] pb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#F1F2F3]">
              Cross-Platform Synced Cases
            </h2>
            <p className="text-[12px] text-[#777D85]">
              Cloud Firestore offline persistence · Anonymized payloads only
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cc-btn-ghost p-1"
            aria-label="Close synced cases drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Auth Session Card */}
        <div className="mt-4 rounded-[8px] border border-[#25272B] bg-[#0D0E10] p-3.5">
          {!isFirebaseConfigured ? (
            <p className="text-[12px] text-[#E8B35D]">
              Configure Firebase credentials in <code>web/.env.local</code> to activate Web +
              Android Firestore sync.
            </p>
          ) : user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[#56B89A]/35 bg-[#121F1B] text-[#56B89A]">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[#F1F2F3]">
                    {user.isAnonymous ? 'Anonymous Vault Session' : user.displayName || user.email}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[#777D85]">UID: {user.uid}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="cc-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px]"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[12px] text-[#A3A7AD]">
                Sign in to sync anonymized cases between CloakBridge Web and Android:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSignInGuest}
                  className="cc-btn-primary flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px]"
                >
                  <LogIn className="h-3.5 w-3.5" /> Guest Session
                </button>
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  className="cc-btn-secondary flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px]"
                >
                  Google Sign-In
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cases List */}
        <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {cases.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[#303237] bg-[#0D0E10] p-6 text-center text-[12px] text-[#777D85]">
              No synced cases yet. Run Stage 1 and click{' '}
              <strong className="text-[#F1F2F3]">Sync</strong> — or capture a document on
              CloakBridge Android to see it appear live here.
            </div>
          ) : (
            cases.map((item) => (
              <div
                key={item.id}
                className="rounded-[8px] border border-[#303237] bg-[#17191C] p-3.5 transition-colors hover:border-[#4A4E57]"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCase(item);
                      onClose();
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      {item.platform === 'android' ? (
                        <Smartphone className="h-3.5 w-3.5 text-[#56B89A]" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-[#7D9DBA]" />
                      )}
                      <span className="text-[12.5px] font-semibold text-[#F1F2F3]">
                        {item.title}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                      <span className="rounded-[4px] border border-[#303237] bg-[#0D0E10] px-1.5 py-0.5 uppercase text-[#A3A7AD]">
                        {item.policyProfile}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#56B89A]/35 bg-[#121F1B] px-1.5 py-0.5 text-[#56B89A]">
                        <ShieldCheck className="h-3 w-3" /> {item.tokenCount} tokens
                      </span>
                      <span className="rounded-[4px] border border-[#E8B35D]/35 bg-[#241E14] px-1.5 py-0.5 text-[#E8B35D]">
                        Risk {item.riskScore}/100
                      </span>
                      {item.estimatedSavingsUsd > 0 && (
                        <span className="rounded-[4px] border border-[#7D9DBA]/35 bg-[#151D24] px-1.5 py-0.5 text-[#7D9DBA]">
                          ~${item.estimatedSavingsUsd.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCase(item.id)}
                    className="cc-btn-ghost p-1.5 hover:bg-[#241415] hover:text-[#DB6666]"
                    title="Delete synced case"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
