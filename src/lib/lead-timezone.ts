// Works out which time zone a lead is in, so the Leads list can show the lead's local time.
// Leads have no location column of their own, so we look at these, best source first:
//   1. a City / Suburb / Address column kept as an "extra detail" when the list was imported
//   2. a State column
//   3. a Postcode column
//   4. the area code of an Australian landline (02, 03, 07, 08). This one is only a guess.
// Mobile numbers (04...) carry no location, so a lead with a mobile number needs one of the columns above.
// Daylight saving is handled by the browser's time zone database, so nothing here needs updating each October.

export type LeadZone = { tz: string; place: string; guessed: boolean };
export type LocalNow = { time: string; day: string; abbr: string; open: boolean };

const STATE_TZ: Record<string, string> = {
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane", // Queensland has no daylight saving
  SA: "Australia/Adelaide",
  NT: "Australia/Darwin", // the Northern Territory has no daylight saving
  WA: "Australia/Perth", // Western Australia has no daylight saving
};

const STATE_NAMES: Record<string, string> = {
  "new south wales": "NSW", "australian capital territory": "ACT", victoria: "VIC", tasmania: "TAS",
  queensland: "QLD", "south australia": "SA", "northern territory": "NT", "western australia": "WA",
};

// City or suburb name -> state. Add more here any time.
const CITY_STATE: Record<string, string> = {
  sydney: "NSW", parramatta: "NSW", penrith: "NSW", liverpool: "NSW", blacktown: "NSW", newcastle: "NSW", wollongong: "NSW",
  "central coast": "NSW", gosford: "NSW", campbelltown: "NSW", "north sydney": "NSW", chatswood: "NSW", bankstown: "NSW",
  melbourne: "VIC", geelong: "VIC", ballarat: "VIC", bendigo: "VIC", frankston: "VIC", dandenong: "VIC", shepparton: "VIC",
  brisbane: "QLD", "gold coast": "QLD", "sunshine coast": "QLD", cairns: "QLD", townsville: "QLD", toowoomba: "QLD",
  ipswich: "QLD", logan: "QLD", mackay: "QLD", rockhampton: "QLD", bundaberg: "QLD", "hervey bay": "QLD", redcliffe: "QLD",
  perth: "WA", fremantle: "WA", mandurah: "WA", bunbury: "WA", joondalup: "WA", rockingham: "WA", geraldton: "WA",
  adelaide: "SA", "mount gambier": "SA",
  hobart: "TAS", launceston: "TAS", devonport: "TAS",
  darwin: "NT", "alice springs": "NT", palmerston: "NT",
  canberra: "ACT",
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CITY_RE = new RegExp(`\\b(${Object.keys(CITY_STATE).sort((a, b) => b.length - a.length).map(escapeRe).join("|")})\\b`, "gi");

function stateFromPostcode(code: string): string | null {
  const n = Number(code);
  if ((n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
  if ((n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2899) || (n >= 2921 && n <= 2999)) return "NSW";
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return "VIC";
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  if (n >= 800 && n <= 999) return "NT";
  return null;
}

const zoneOf = (state: string, place: string, guessed = false): LeadZone => ({ tz: STATE_TZ[state], place, guessed });

// ---- from imported columns ------------------------------------------------

// Free text such as "Sydney", "Penrith NSW" or "12 Sydney Rd, Brunswick VIC 3056".
function zoneFromText(text: string): LeadZone | null {
  // "VIC 3056" is the most reliable clue, and it stops a street called "Sydney Road" from beating the real suburb.
  const sp = /\b(NSW|ACT|VIC|QLD|TAS|SA|WA|NT)\b[,\s]*(\d{4})\b/i.exec(text);
  if (sp) {
    const state = sp[1].toUpperCase();
    return zoneOf(state, state);
  }
  // Otherwise the last city name in the text, since the city comes after the street.
  const cities = [...text.matchAll(CITY_RE)];
  if (cities.length) {
    const name = cities[cities.length - 1][1].toLowerCase();
    return zoneOf(CITY_STATE[name], name.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  const code = /\b(NSW|ACT|VIC|QLD|TAS)\b/.exec(text); // upper case only, so ordinary words are not mistaken for a state
  if (code) return zoneOf(code[1], code[1]);
  return null;
}

function zoneFromState(value: string): LeadZone | null {
  const v = value.trim();
  const state = STATE_TZ[v.toUpperCase()] ? v.toUpperCase() : STATE_NAMES[v.toLowerCase()];
  return state ? zoneOf(state, state) : null;
}

function zoneFromExtra(extra: Record<string, string>): LeadZone | null {
  let fromState: LeadZone | null = null;
  let fromPostcode: LeadZone | null = null;
  let fromCity: LeadZone | null = null;
  for (const [key, raw] of Object.entries(extra)) {
    const k = key.toLowerCase().replace(/[^a-z]/g, "");
    const value = String(raw ?? "").trim();
    if (!value) continue;
    if (/(city|suburb|town|locality|location|address|area)/.test(k)) fromCity ??= zoneFromText(value);
    if (k === "state" || k === "region" || k === "stateprovince" || k === "statecode") fromState ??= zoneFromState(value);
    if (/(postcode|postalcode|zip)/.test(k) && /^\d{4}$/.test(value)) {
      const state = stateFromPostcode(value);
      if (state) fromPostcode ??= zoneOf(state, state);
    }
  }
  return fromCity ?? fromState ?? fromPostcode;
}

// ---- from the phone number ------------------------------------------------

const isForeign = (phone: string) => {
  const p = phone.trim();
  return (p.startsWith("+") && !p.replace(/\D/g, "").startsWith("61")) || (p.startsWith("00") && !p.replace(/\D/g, "").slice(2).startsWith("61"));
};

// "+61 2 9876 5432", "(02) 9876 5432" or "61298765432" -> "0298765432". Anything that is not Australian gives null.
function australianNational(phone: string): string | null {
  const p = phone.trim();
  const digits = p.replace(/\D/g, "");
  if (p.startsWith("+") || p.startsWith("00")) {
    let rest = (p.startsWith("00") ? digits.slice(2) : digits);
    if (!rest.startsWith("61")) return null;
    rest = rest.slice(2);
    if (rest.startsWith("0")) rest = rest.slice(1); // "+61 (0)2 ..."
    return rest.length === 9 ? `0${rest}` : null;
  }
  if (digits.startsWith("61") && digits.length === 11) return `0${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (digits.length === 9 && /^[2378]/.test(digits)) return `0${digits}`; // a spreadsheet dropped the leading zero
  return null;
}

function zoneFromAreaCode(phone: string): LeadZone | null {
  const n = australianNational(phone);
  if (!n) return null;
  const guess = (state: string, label = state) => zoneOf(state, `${label} (area code)`, true);
  switch (n[1]) {
    case "2": return guess("NSW", "NSW/ACT");
    case "3": return n[2] === "6" ? guess("TAS") : guess("VIC");
    case "7": return guess("QLD");
    case "8":
      if (n.slice(2, 4) === "89") return guess("NT");
      if (n[2] === "9" || n[2] === "6") return guess("WA");
      return guess("SA");
    default: return null; // 04 mobiles, and anything else, say nothing about where the business is
  }
}

// ---- public ---------------------------------------------------------------

export function leadZone(lead: { phone: string | null; extra: Record<string, string> }): LeadZone | null {
  const phone = lead.phone ?? "";
  if (isForeign(phone)) return null; // a +1 or +44 number is not an Australian lead, even if the city is called Perth
  return zoneFromExtra(lead.extra ?? {}) ?? zoneFromAreaCode(phone);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
    formatters.set(tz, f);
  }
  return f;
}

// The lead's clock right now. open is true from 9:00 to 17:00 on a weekday, when a business is likely to pick up.
export function localNow(tz: string, nowMs: number): LocalNow {
  const parts = formatter(tz).formatToParts(nowMs);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(part("hour")) % 24;
  const day = part("weekday");
  return {
    time: `${hour % 12 || 12}:${part("minute")} ${hour < 12 ? "AM" : "PM"}`,
    day,
    abbr: part("timeZoneName"),
    open: day !== "Sat" && day !== "Sun" && hour >= 9 && hour < 17,
  };
}
