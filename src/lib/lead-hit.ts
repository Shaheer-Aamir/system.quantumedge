// A lead as shown in search suggestions. Safe to import from client components.
export type LeadHit = {
  id: string;
  company: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  callCount: number;
  lastOutcome: string | null;
  lastCalledAt: number | null;
};
