import { PolicyProfile } from '../types/cloak';

export interface DemoDocument {
  id: string;
  title: string;
  policy: PolicyProfile;
  badge: string;
  rawText: string;
}

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: 'medical-er-bill',
    title: 'ER Visit Itemized Medical Bill',
    policy: 'medical',
    badge: 'HIPAA / Medical',
    rawText: `MERCY VALLEY REGIONAL HOSPITAL — PATIENT BILLING STATEMENT
Patient Name: Elena Rostova
DOB: 04/19/1988
Patient SSN: 482-73-9104
Member ID / Policy #: BCBS-884920144
Billing Account #: ACCT-90482177
Patient Address: 742 Evergreen Terrace, Apt 4B, Austin, TX 78701
Phone: (512) 555-0194 | Email: elena.rostova@gmail.com
Attending Physician: Dr. Marcus Vance, MD

Date of Service: 10/14/2026 — Emergency Dept (Out-of-Network Specialist Consult)
1. CPT 99285 — Emergency Dept Visit, Level 5 (Critical) ...................... $3,840.00
   *Clinical note: Patient presented with mild ankle sprain, vitals stable, discharged in 45 mins.*
2. CPT 73610 — X-Ray Ankle 3 Views (Hospital Technical Fee) .................. $1,120.00
3. CPT 73610 — X-Ray Ankle 3 Views (Duplicate Facility Re-read) .............. $1,120.00
4. Facility Supply Fee — Elastic Ace Bandage (1 unit) ........................ $285.00
5. Out-of-Network Radiologist Balance Bill (Dr. S. Patel, no prior consent) .. $940.00
6. Unbundled Venipuncture + Basic Metabolic Panel (CPT 36415 + 80048) ........ $615.00

TOTAL BILLED: $7,920.00
Insurance Adjustment: -$1,420.00
PATIENT BALANCE DUE IN 15 DAYS: $6,500.00 (Sent to collections after 30 days).`,
  },
  {
    id: 'residential-lease',
    title: 'Apartment Lease Renewal Agreement',
    policy: 'legal',
    badge: 'Legal / Lease',
    rawText: `RESIDENTIAL LEASE AGREEMENT — APEX SKYLINE PROPERTIES LLC
Landlord Agent: Victor Sterling (v.sterling@apexskyline.com | 415-555-0148)
Tenant: David Chen
Tenant SSN: 519-44-2281 | Driver License: CA-D8924103
Premises: 1840 Market Street, Unit 1102, San Francisco, CA 94102
Tenant Email: david.chen.sf@proton.me | Phone: (415) 555-0182
Bank Routing / ACH Auto-Debit Account: 021000021 / 8839201144

KEY TERMS:
1. Monthly Base Rent: $3,250.00 due on the 1st. Late fee of $275.00 applies after 12:00 PM on the 2nd, plus $45/day compounding interest.
2. Mandatory Monthly Junk Fees: $85 "Smart Lock Portal Fee", $65 "Valet Trash Fee" (non-opt-out), $45 "Administrative Billing Convenience Fee".
3. Security Deposit: $6,500.00 — $1,200.00 is designated a "Non-Refundable Turnover Cleaning Fee" regardless of unit condition.
4. Automatic Renewal: Unless Tenant sends certified mail 90 days prior, lease auto-renews for 12 months at a 14% rent increase.
5. Liability Waiver: Tenant waives all rights to withhold rent or claim habitability defects, and indemnifies Landlord even for Landlord's own negligence.`,
  },
  {
    id: 'freelance-msa',
    title: 'Enterprise Consulting MSA & Invoice Terms',
    policy: 'finance',
    badge: 'Finance / Contract',
    rawText: `MASTER SERVICES AGREEMENT — NORTHSTAR FINTECH CORP
Client Representative: Sarah Jenkins (s.jenkins@northstarfintech.io)
Contractor: Priya Nair (Sole Proprietor, EIN: 84-3920184)
Contractor Address: 215 Peachtree St NE, Suite 600, Atlanta, GA 30303
Phone: (404) 555-0167 | Email: priya@nairstudio.dev
Wire Account: Chase Bank Acct #4491029384

SECTION 4 — COMPENSATION & FEES:
- Project Fee: $24,000.00 payable Net-90 from Client's "subjective final acceptance".
- Client may deduct a 3.5% "Vendor Portal Processing Fee" ($840) and a $75 domestic ACH initiation fee from every payout.
- No late payment interest applies to Client; however, Contractor owes $500/day liquidated damages for any milestone delay over 24 hours.

SECTION 7 — INTELLECTUAL PROPERTY & NON-COMPETE:
- All background code, pre-existing libraries, personal tools, and ideas conceived by Contractor during the 12-month term (even off-hours and unrelated to Client) transfer irrevocably to Client without extra compensation.
- 24-month global non-compete prohibiting Contractor from working with any software or financial company.`,
  },
];
