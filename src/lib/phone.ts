export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+\d][\d\s\-()]{5,19}$/;
export const normalizePhone = (p: string) => p.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
