// Builds a Google search for a lead: business name plus location.
// Location comes from imported columns such as City, State or Address. If the lead has none,
// the phone number is used instead, because Google matches business listings by phone very well.
type SearchableLead = { company: string | null; contactName: string | null; phone: string | null; extra: Record<string, string> };

const LOCATION_COLUMNS = [/\b(address|street)\b/i, /\b(city|town)\b/i, /\b(state|province|region|county)\b/i, /\b(location|area|neighbou?rhood)\b/i, /\bcountry\b/i];

export function leadSearchQuery(lead: SearchableLead) {
  const name = (lead.company || lead.contactName || "").trim();
  const parts: string[] = [];
  for (const column of LOCATION_COLUMNS) {
    const hit = Object.entries(lead.extra).find(([key, value]) => column.test(key) && value.trim());
    const value = hit?.[1].trim();
    if (!value) continue;
    const v = value.toLowerCase();
    if (parts.some((p) => p.toLowerCase().includes(v))) continue; // already covered by a more specific part
    for (let i = parts.length - 1; i >= 0; i--) if (v.includes(parts[i].toLowerCase())) parts.splice(i, 1); // this one is more specific
    parts.push(value);
  }
  const where = parts.join(" ") || (lead.phone ?? "");
  return [name, where].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 250);
}

export const googleSearchUrl = (lead: SearchableLead) => `https://www.google.com/search?q=${encodeURIComponent(leadSearchQuery(lead))}`;
