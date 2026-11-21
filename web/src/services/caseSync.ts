import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { verifyZeroLeak } from './localVault';
import type { SavedCase, VaultEntry } from '../types/cloak';

/**
 * Syncs ONLY anonymized cases to Cloud Firestore (`users/{uid}/cases/{caseId}`).
 * Raw text and local vault token maps are NEVER written to Firestore.
 */
export async function saveAnonymizedCase(
  uid: string,
  payload: Omit<SavedCase, 'id' | 'createdAt' | 'updatedAt'>,
  vaultEntries: VaultEntry[]
): Promise<string> {
  if (!db) throw new Error('Firestore is not configured yet.');

  const checkText = `${payload.scrubbedText}\n${payload.triageSummary}\n${payload.cloudAuditMarkdown}\n${payload.disputeDraftScrubbed}`;
  const leakCheck = verifyZeroLeak(checkText, vaultEntries);
  if (!leakCheck.verified) {
    throw new Error(
      `Blocked Firestore sync: detected raw PII tokens (${leakCheck.leakedValues.join(', ')}).`
    );
  }

  const casesRef = collection(db, 'users', uid, 'cases');
  const docRef = await addDoc(casesRef, {
    title: payload.title.slice(0, 140),
    policyProfile: payload.policyProfile,
    platform: 'web',
    scrubbedText: payload.scrubbedText.slice(0, 30000),
    tokenCount: Math.min(500, Math.max(0, Math.round(payload.tokenCount))),
    zeroLeakVerified: true,
    triageSummary: payload.triageSummary.slice(0, 4000),
    riskScore: Math.min(100, Math.max(0, Math.round(payload.riskScore))),
    triageSource: payload.triageSource,
    cloudAuditMarkdown: payload.cloudAuditMarkdown.slice(0, 30000),
    cloudAuditSource: payload.cloudAuditSource,
    disputeDraftScrubbed: payload.disputeDraftScrubbed.slice(0, 20000),
    estimatedSavingsUsd: Math.max(0, Number(payload.estimatedSavingsUsd) || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeUserCases(
  uid: string,
  onCases: (cases: SavedCase[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, 'users', uid, 'cases'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedCase[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title || 'Untitled Case'),
          policyProfile: data.policyProfile || 'medical',
          platform: data.platform === 'android' ? 'android' : 'web',
          scrubbedText: String(data.scrubbedText || ''),
          tokenCount: Number(data.tokenCount || 0),
          zeroLeakVerified: Boolean(data.zeroLeakVerified),
          triageSummary: String(data.triageSummary || ''),
          riskScore: Number(data.riskScore || 0),
          triageSource: data.triageSource || 'ON_DEVICE',
          cloudAuditMarkdown: String(data.cloudAuditMarkdown || ''),
          cloudAuditSource: data.cloudAuditSource || 'PENDING',
          disputeDraftScrubbed: String(data.disputeDraftScrubbed || ''),
          estimatedSavingsUsd: Number(data.estimatedSavingsUsd || 0),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
        };
      });
      onCases(items);
    },
    (err) => onError?.(err)
  );
}

export async function deleteUserCase(uid: string, caseId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'users', uid, 'cases', caseId));
}
