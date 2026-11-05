// Fills your LOCAL database with fictional demo data for screenshots.
// Usage:  npm run seed:demo
// It uses the development database (.env.local) and refuses to run on the live one (.env.prod).
// It clears leads, calls, meetings, projects, payments and scripts first.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import readline from "node:readline";
import { connect, describeTarget } from "./_db.mjs";
const DEMO_PASSWORD = "DemoPass#2026";
const ITERATIONS = 100000;
const N_LEADS = 1000;
const DAYS_BACK = 140;

// Safety: never wipe the live database.
const target = process.env.TURSO_DATABASE_URL ?? "";
if (existsSync(".env.prod")) {
  const prod = /^TURSO_DATABASE_URL=(.*)$/m.exec(readFileSync(".env.prod", "utf8"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (prod && prod === target) { console.error("This is your LIVE database (.env.prod). Demo data is only for the development database."); process.exit(1); }
}
if (!target) { console.error("TURSO_DATABASE_URL is not set. Create .env.local first."); process.exit(1); }

// ---- helpers ---------------------------------------------------------------
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261029);
const pick = (a) => a[Math.floor(rand() * a.length)];
const chance = (p) => rand() < p;
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const id = (p) => `${p}-${Math.floor(rand() * 1e12).toString(36)}${Math.floor(rand() * 1e12).toString(36)}`;

const OFF = 5 * 3600e3; // Pakistan time
const DAY = 86400e3;
const now = Date.now();
const todayStart = Math.floor((now + OFF) / DAY) * DAY - OFF;
const dayStartBack = (n) => todayStart - n * DAY;
const isWeekend = (dayStart) => { const d = new Date(dayStart + OFF).getUTCDay(); return d === 0 || d === 6; };
const eveningOf = (dayStart) => dayStart + (19 * 60 + between(0, 270)) * 60000; // 19:00 to 23:30, US morning hours
const forwardWeekday = (dayStart) => { while (isWeekend(dayStart)) dayStart += DAY; return dayStart; };
const dayStartOf = (ms) => Math.floor((ms + OFF) / DAY) * DAY - OFF;

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); });
  });
}

// ---- fictional data pools --------------------------------------------------
const PREFIX = ["Summit", "Harbor", "Pinecrest", "Redwood", "Bluebird", "Ironwood", "Maple Row", "Clearwater", "Lakeside", "Evergreen", "Silverline", "Oakridge", "Sunrise", "Cedar Point", "Granite", "Willow", "Copperfield", "Meadowbrook", "Brightwater", "Stonebridge", "Foxglove", "Riverbend", "Highland", "Cobalt", "Juniper", "Crescent", "Driftwood", "Falcon", "Hawthorne", "Larkspur", "Magnolia", "Northshore", "Orchard", "Prairie", "Quarry", "Ridgeway", "Saltmarsh", "Timberline", "Union Square", "Valley View", "Westbrook", "Zenith", "Aspen Hill", "Birchwood", "Canyon", "Dunemark", "Eastgate", "Fairview", "Goldcrest", "Heron"];
const SUFFIX = ["Dental", "Roofing", "Law Group", "Realty", "Fitness", "Plumbing", "Landscaping", "Auto Repair", "Accounting", "Veterinary", "Bakery", "Insurance Agency", "Cleaning Services", "Physiotherapy", "Interiors", "Chiropractic", "HVAC", "Photography", "Pest Control", "Optometry", "Tax Services", "Movers", "Catering", "Salon and Spa", "Electric"];
const FIRST = ["James", "Maria", "David", "Sarah", "Michael", "Jennifer", "Robert", "Linda", "Daniel", "Emily", "Kevin", "Laura", "Brian", "Amanda", "Jason", "Nicole", "Eric", "Rachel", "Chris", "Megan", "Andrew", "Lauren", "Mark", "Jessica", "Steven", "Hannah", "Paul", "Olivia", "Tyler", "Natalie"];
const LAST = ["Carter", "Nguyen", "Patel", "Brooks", "Morgan", "Bennett", "Hughes", "Reyes", "Foster", "Coleman", "Sullivan", "Murphy", "Rivera", "Cooper", "Ward", "Jensen", "Hayes", "Powell", "Long", "Price", "Russell", "Howard", "Diaz", "Gray", "Watts", "Fisher", "Cruz", "Ellis", "Webb", "Shaw"];
const CITIES = [["Austin", 512], ["Denver", 303], ["Charlotte", 704], ["Nashville", 615], ["Portland", 503], ["Phoenix", 602], ["Columbus", 614], ["Tampa", 813], ["Raleigh", 919], ["Boise", 208], ["Sacramento", 916], ["Kansas City", 816], ["Salt Lake City", 801], ["Minneapolis", 612], ["Richmond", 804]];
const usedPhones = new Set();
function phone(cities) {
  for (;;) {
    const [city, ac] = pick(cities);
    const p = `+1 ${ac} 555 01${String(between(0, 99)).padStart(2, "0")}`; // 555-0100 to 0199 are reserved for fiction
    if (!usedPhones.has(p)) { usedPhones.add(p); return { city, phone: p }; }
  }
}
const NOTES = {
  no_answer: ["Rang out, no voicemail", "Voicemail left", "Went to voicemail, left a short message", "Gatekeeper said the owner is out"],
  failed: ["Number is disconnected", "Wrong number", "Line busy three times"],
  not_interested: ["Already has an agency", "Happy with the current website", "Not a priority this year", "Asked not to be called again"],
  follow_up: ["Wants a callback on Thursday", "Asked to email the portfolio first", "Owner is travelling, call next week", "Interested, needs to talk to a partner"],
  meeting_booked: ["Interested in a redesign, booked a call", "Wants a quote for a new site", "Keen to improve online bookings", "Asked for a website audit"],
};
const MEETING_TITLES = ["Intro call", "Discovery call", "Website audit walkthrough", "Proposal review", "Intro call"];
const PROJECT_TYPES = ["Website redesign", "Local SEO setup", "Landing page and ads", "Online booking system", "E-commerce store build", "Brand refresh and website", "Lead generation setup"];
const LEAD_NOTES = ["Decision maker is the owner", "Prefers calls in the morning", "Referred by an existing client", "Has an outdated site, good fit", "Runs two locations"];
function outcome() {
  const r = rand();
  if (r < 0.5) return "no_answer";
  if (r < 0.7) return "follow_up";
  if (r < 0.76) return "failed";
  if (r < 0.96) return "not_interested";
  return "meeting_booked";
}

// ---- build the data --------------------------------------------------------
const SUPER = "(SELECT id FROM admins WHERE role = 'super_admin' ORDER BY created_at LIMIT 1)";
const AYESHA = "'demo-admin-ayesha'";
const ADMINS = [SUPER, AYESHA];

const combos = shuffle(PREFIX.flatMap((p) => SUFFIX.map((s) => [p, s]))).slice(0, N_LEADS);
const leads = [], calls = [], meetings = [], projects = [], payments = [];

combos.forEach(([prefix, suffix], i) => {
  const company = `${prefix} ${suffix}`;
  const contact = `${pick(FIRST)} ${pick(LAST)}`;
  const { city, phone: ph } = phone(CITIES);
  const owner = chance(0.52) ? 0 : 1;
  const contacted = chance(0.86);
  const imported = chance(0.7);
  const lead = {
    id: id("lead"), company, contact, phone: ph, norm: ph.replace(/[^\d+]/g, ""),
    email: chance(0.85) ? `${contact.split(" ")[0][0].toLowerCase()}.${contact.split(" ")[1].toLowerCase()}@${slug(company)}.example` : null,
    status: "new", notes: chance(0.15) ? pick(LEAD_NOTES) : null,
    extra: imported ? JSON.stringify({ City: city, Industry: suffix, Website: `www.${slug(company)}.example` }) : null,
    source: imported ? "import" : "manual", owner, createdAt: 0, updatedAt: 0, assigned: null,
  };

  if (!contacted) {
    const back = between(0, 12);
    lead.createdAt = lead.updatedAt = dayStartBack(back) + between(9, 17) * 3600e3;
    lead.assigned = chance(0.6) ? owner : null;
    leads.push(lead);
    return;
  }

  let back = DAYS_BACK - Math.floor(DAYS_BACK * Math.sqrt(rand())); // more recent leads than old ones
  let day = dayStartBack(back);
  while (isWeekend(day)) day -= DAY;
  lead.createdAt = day - between(0, 4) * DAY + between(9, 15) * 3600e3;
  let t = eveningOf(day);
  let last = null;
  for (let attempt = 0; attempt < 4 && t <= now; attempt++) {
    const o = outcome();
    const call = { id: id("call"), lead: lead.id, owner, outcome: o, notes: chance(0.4) ? pick(NOTES[o]) : null, at: t };
    calls.push(call);
    last = call;
    if (o === "meeting_booked") {
      const startsDay = forwardWeekday(dayStartOf(t) + between(2, 9) * DAY);
      const startsAt = eveningOf(startsDay);
      let status = "scheduled";
      if (startsAt < now) { const r = rand(); status = r < 0.78 ? "completed" : r < 0.92 ? "no_show" : "cancelled"; }
      meetings.push({ id: id("meet"), lead: lead.id, call: call.id, owner, title: pick(MEETING_TITLES), startsAt, duration: pick([15, 30, 30, 45]), status, notes: call.notes, createdAt: t, lead_ref: lead });
    }
    if (o !== "no_answer" && o !== "follow_up") break;
    t = eveningOf(forwardWeekday(dayStartOf(t) + between(1, 6) * DAY));
  }
  lead.assigned = owner;
  if (!last) { lead.status = "new"; lead.updatedAt = lead.createdAt; }
  else {
    lead.updatedAt = last.at;
    lead.status = last.outcome === "meeting_booked" ? "meeting_booked" : last.outcome === "not_interested" || last.outcome === "failed" ? "dead" : "contacted";
  }
  leads.push(lead);
});

// Meetings that did not happen leave the lead as contacted
for (const m of meetings) if (m.status === "no_show" || m.status === "cancelled") m.lead_ref.status = "contacted";

// Projects from completed meetings
const rateAt = (ms) => Math.round((279.5 + ((ms - dayStartBack(DAYS_BACK)) / (DAYS_BACK * DAY)) * 3 + (rand() - 0.5) * 0.8) * 100) / 100;
for (const m of meetings.filter((x) => x.status === "completed" && chance(0.3))) {
  const createdAt = m.startsAt + between(1, 10) * DAY;
  if (createdAt > now) continue;
  const agreed = pick([600, 900, 1200, 1500, 2000, 2500, 3000, 3500, 4500, 6000]) * 100;
  const age = (now - createdAt) / DAY;
  const status = age > 45 ? (chance(0.88) ? "completed" : "on_hold") : "ongoing";
  const deposit = Math.round((agreed * 0.5) / 100) * 100;
  const p = { id: id("proj"), name: pick(PROJECT_TYPES), client: m.lead_ref.company, status, agreed, upfront: deposit, owner: m.owner, startedAt: createdAt + DAY, createdAt };
  projects.push(p);
  m.lead_ref.status = "closed";
  const add = (cents, at, note) => { if (at <= now && cents > 0) payments.push({ id: id("pay"), project: p.id, cents, rate: rateAt(at), at, note, owner: m.owner }); };
  add(deposit, p.startedAt + DAY, "Upfront payment");
  if (status === "completed") add(agreed - deposit, createdAt + between(20, 40) * DAY, "Final payment");
  else if (status === "ongoing" && age > 20) add(Math.round((agreed * 0.25) / 100) * 100, createdAt + 16 * DAY, "Milestone payment");
}

const SCRIPTS = [
  ["Script 1: Opening pitch", `# Opening
> Hi {{name}}, this is {{your name}}. I know I am calling out of the blue. Do you have thirty seconds?
- Smile and slow down
- If they say they are busy, ask for a better time and book it

# The reason for the call
> I help local businesses bring in more enquiries from their website. I had a quick look at yours and noticed {{one specific thing}}.
- Keep it to one observation
- Do not criticise, be curious

# Ask for the meeting
> Would a fifteen minute call on {{day}} or {{day}} work better for you?

# If they agree
- Confirm the date, time and best email
- Repeat it back: "So that is **{{day}} at {{time}}**, correct?"
- Log the meeting straight after the call`],
  ["Script 2: Objection handling", `# "We already have an agency"
> That is great to hear. I am not trying to replace anyone. Would it be useful to get a second opinion on how the site converts?

# "Send me an email"
> Happy to. So I send you something useful, what is the one thing you would most like the website to do for you?

# "Not interested"
> Understood. Just so I can close this out properly, is it the timing or is the website working well for you?

# "How much does it cost?"
> It depends on what you need. That is exactly what the fifteen minute call is for, so the quote is accurate.

## Rules
- Never argue
- Two attempts at most, then thank them and move on
- Log the reason in the call notes`],
  ["Script 3: Voicemail and follow-up", `# Voicemail (under 20 seconds)
> Hi {{name}}, it is {{your name}}. I had a quick idea for improving enquiries from your website. I will send you a short email today. Speak soon.

# Follow-up email
- Subject: Quick idea for {{company}}
- One sentence on what you noticed
- One sentence on the result you can get
- One clear question to reply to

# Call-back rhythm
- Day 1: call
- Day 3: call and email
- Day 7: final call
- After that, mark the lead as dead`],
];

// ---- write the SQL ---------------------------------------------------------
const lines = [];
const batch = (table, cols, rows) => {
  for (let i = 0; i < rows.length; i += 40) {
    lines.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${rows.slice(i, i + 40).map((r) => `(${r.join(", ")})`).join(",\n")};`);
  }
};

const passwordHash = await hashPassword(DEMO_PASSWORD);
lines.push("DELETE FROM payments;", "DELETE FROM projects;", "DELETE FROM meetings;", "DELETE FROM calls;", "DELETE FROM leads;", "DELETE FROM scripts;");
lines.push(`UPDATE admins SET full_name = COALESCE(full_name, username), email = COALESCE(email, 'admin@example.com'), phone = COALESCE(phone, '+92 300 5550100'), profile_complete = 1 WHERE role = 'super_admin';`);
lines.push(`INSERT OR IGNORE INTO admins (id, username, username_lower, password_hash, role, full_name, email, phone, is_active, profile_complete, created_at, created_by) VALUES ('demo-admin-ayesha', 'Ayesha Khan', 'ayesha khan', ${q(passwordHash)}, 'admin', 'Ayesha Khan', 'ayesha.khan@example.com', '+92 300 5550142', 1, 1, ${dayStartBack(DAYS_BACK + 5)}, ${SUPER});`);
lines.push(`INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('usd_pkr_rate', '282.5', ${now});`);

batch("leads", ["id", "company", "contact_name", "phone", "phone_normalized", "email", "status", "notes", "extra", "assigned_to", "source", "created_by", "created_at", "updated_at"],
  leads.map((l) => [q(l.id), q(l.company), q(l.contact), q(l.phone), q(l.norm), q(l.email), q(l.status), q(l.notes), q(l.extra), l.assigned === null ? "NULL" : ADMINS[l.assigned], q(l.source), ADMINS[l.owner], l.createdAt, l.updatedAt]));
batch("calls", ["id", "admin_id", "lead_id", "outcome", "notes", "called_at", "created_at"],
  calls.map((c) => [q(c.id), ADMINS[c.owner], q(c.lead), q(c.outcome), q(c.notes), c.at, c.at]));
batch("meetings", ["id", "lead_id", "call_id", "admin_id", "title", "starts_at", "duration_min", "status", "notes", "created_at", "updated_at"],
  meetings.map((m) => [q(m.id), q(m.lead), q(m.call), ADMINS[m.owner], q(m.title), m.startsAt, m.duration, q(m.status), q(m.notes), m.createdAt, Math.min(now, m.status === "scheduled" ? m.createdAt : m.startsAt)]));
batch("projects", ["id", "name", "client", "status", "agreed_cents", "upfront_cents", "owner_id", "started_at", "notes", "created_by", "created_at", "updated_at"],
  projects.map((p) => [q(p.id), q(p.name), q(p.client), q(p.status), p.agreed, p.upfront, ADMINS[p.owner], p.startedAt, "NULL", ADMINS[p.owner], p.createdAt, p.createdAt]));
batch("payments", ["id", "project_id", "amount_cents", "rate", "received_at", "note", "created_by", "created_at"],
  payments.map((p) => [q(p.id), q(p.project), p.cents, p.rate, p.at, q(p.note), ADMINS[p.owner], p.at]));
batch("scripts", ["id", "name", "content", "created_by", "updated_by", "created_at", "updated_at"],
  SCRIPTS.map(([name, content], i) => [q(`demo-script-${i + 1}`), q(name), q(content), SUPER, SUPER, now - (20 - i * 5) * DAY, now - (3 - i) * DAY]));

// A CSV for demonstrating the import screen. These numbers are not in the demo data.
const csvCities = [["New York", 646], ["Miami", 305], ["Dallas", 214], ["Chicago", 773], ["Atlanta", 404]];
const csvNames = shuffle(PREFIX.flatMap((p) => SUFFIX.map((s) => [p, s]))).slice(N_LEADS, N_LEADS + 60);
const csv = ["Company Name,Contact Name,Phone,Email,City,Industry,Website"];
for (const [prefix, suffix] of csvNames) {
  const company = `${prefix} ${suffix}`, contact = `${pick(FIRST)} ${pick(LAST)}`;
  const { city, phone: ph } = phone(csvCities);
  csv.push([company, contact, ph, `${contact.split(" ")[0].toLowerCase()}@${slug(company)}.example`, city, suffix, `www.${slug(company)}.example`].map((v) => `"${v}"`).join(","));
}
writeFileSync("demo-leads.csv", csv.join("\n") + "\n");

console.log(`\nThis will REPLACE the leads, calls, meetings, projects, payments and scripts in ${describeTarget()} with demo data:`);
console.log(`  ${leads.length} leads, ${calls.length} calls, ${meetings.length} meetings, ${projects.length} projects, ${payments.length} payments, ${SCRIPTS.length} scripts`);
if (!process.argv.includes("--yes") && (await ask("Type yes to continue: ")) !== "yes") { console.log("Cancelled. Nothing was changed."); process.exit(0); }

await connect().executeMultiple(lines.join("\n") + "\n");

console.log(`\nDone. A second admin was added for the screenshots:`);
console.log(`  Username: Ayesha Khan    Password: ${DEMO_PASSWORD}`);
console.log(`A file called demo-leads.csv was created in this folder, for showing the Import leads screen.`);
