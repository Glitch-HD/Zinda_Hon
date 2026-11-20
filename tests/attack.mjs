// Security attack suite: node tests/attack.mjs <base-url> <database-url>  (run on a FRESH local database; it changes data)
// Attack our own app the way a strict judge would. Each line: BLOCKED (good) or HOLE (bad).
import { execFileSync } from "node:child_process";
const B = process.argv[2] ?? "http://localhost:3123";
const DB = process.argv[3];
let holes = 0, n = 0;
const out = [];
const check = (blocked, what, detail = "") => { n++; if (!blocked) holes++; out.push(`${blocked ? "BLOCKED" : "HOLE   "} ${what}${detail ? `  [${detail}]` : ""}`); };
async function login(phone, password) {
  const r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify({ phone, password }) });
  const cookie = r.headers.get("set-cookie")?.split(";")[0];
  const call = (path, opts = {}) => fetch(`${B}${path}`, { ...opts, headers: { "content-type": "application/json", cookie, ...(opts.headers ?? {}) } });
  return { cookie, call, post: (path, body) => call(path, { method: "POST", body: JSON.stringify(body ?? {}) }) };
}
const lit = (v) => (typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const q = async (sql, args = []) => {
  const text = sql.replace(/\$(\d+)/g, (_, i) => lit(args[Number(i) - 1]));
  const res = execFileSync("psql", [DB, "-Atc", `select coalesce(json_agg(t),'[]') from (${text}) t`]).toString().trim();
  return JSON.parse(res);
};
const db = { query: async (sql) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { stdio: "pipe" }), end: async () => {} };
const caseOf = async (no) => (await q(`select c.id, c."pensionerId" from "Case" c join "Pensioner" p on p.id=c."pensionerId" where p."pensionNo"=$1 and c.year=$2`, [no, new Date().getFullYear()]))[0];
const vec = (s) => Array.from({ length: 128 }, (_, i) => Math.sin(s * 31 + i) * 0.1);
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const widow = await login("03026619470", "Zainab786");
const sakinaU = await login("03154407218", "Sakina4321");
const sana = await login("03214417832", "Sana@Pension24");
const bilal = await login("03332290615", "Bilal#Korangi7");
const naveed = await login("03003108847", "Naveed!Hyd52");
const admin = await login("03452876104", "Kamran$Admin9");
const auditor = await login("03127739025", "Nadia&Audit3");
const rubina = await login("03012654398", "Rubina@Lyari8");
const farhan = await login("03349182746", "Farhan%Help6");
const shop = await login("03225501987", "Imran*Shop4");

const zainab = await caseOf("PEN-K-1001"), noor = await caseOf("PEN-K-1005"), sakina = await caseOf("PEN-K-1011"), fatima = await caseOf("PEN-K-1002");
const rubinaFamilies = (await q(`select p."pensionNo" from "HelperLink" h join "User" u on u.id=h."helperId" join "Pensioner" p on p.id=h."pensionerId" where u.phone='03012654398'`)).map((r) => r.pensionNo);
const farhanFamilies = (await q(`select p."pensionNo" from "HelperLink" h join "User" u on u.id=h."helperId" join "Pensioner" p on p.id=h."pensionerId" where u.phone='03349182746'`)).map((r) => r.pensionNo);
const notFarhans = rubinaFamilies.find((x) => !farhanFamilies.includes(x));
const notFarhansCase = await caseOf(notFarhans);

// --- Logging in and tokens
check((await fetch(`${B}/api/cases/${zainab.id}`)).status === 401, "No login: open a case");
const [h, p] = widow.cookie.split("=")[1].split(".");
const payload = JSON.parse(Buffer.from(p, "base64url").toString()); payload.role = "ADMIN";
const forged = `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${widow.cookie.split(".")[2]}`;
check((await fetch(`${B}/api/admin/rules`, { method: "POST", headers: { cookie: `zh_session=${forged}` }, body: "{}" })).status === 401, "Edit my login token to say ADMIN");
const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.`;
check((await fetch(`${B}/api/admin/rules`, { method: "POST", headers: { cookie: `zh_session=${none}` }, body: "{}" })).status === 401, "Login token with alg=none");
let s429 = false; for (let i = 0; i < 12; i++) { const r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: "03214417832", password: "guess" + i }) }); if (r.status === 429) { s429 = true; break; } }
check(s429, "Guess an officer's password many times", "rate limited");

// --- Roles
check((await widow.post("/api/admin/rules", {})).status === 403, "Pensioner publishes a new rule");
check((await rubina.post(`/api/cases/${zainab.id}/officer`, { action: "approve", note: "x" })).status === 403, "Helper approves a case");
check((await shop.call(`/api/cases/${zainab.id}`)).status === 403, "Shopkeeper reads a case");
check((await auditor.post(`/api/cases/${zainab.id}/officer`, { action: "stop", note: "auditor stopping it" })).status === 403, "Auditor (read-only) stops a pension");
check((await rubina.post(`/api/cases/${zainab.id}/agent`)).status === 403, "Helper runs the officer's AI assistant");
check((await sana.post("/api/admin/api-keys", { name: "x", scopes: ["cases:read"] })).status === 403, "Officer creates an API key");

// --- Other office (tenant)
check((await naveed.call(`/api/cases/${zainab.id}`)).status === 404, "Hyderabad officer opens a Karachi case");
check((await naveed.post(`/api/cases/${zainab.id}/officer`, { action: "stop", note: "cross office stop attempt" })).status === 404, "Hyderabad officer stops a Karachi pension");

// --- Helper abuse
check((await farhan.call(`/api/cases/${notFarhansCase.id}`)).status === 403, "Helper opens a family not linked to them", notFarhans);
check((await farhan.post(`/api/cases/${notFarhansCase.id}/evidence`, { type: "face_match", clientActionId: rid(), descriptor: vec(3) })).status === 403, "Helper sends a selfie for a family not linked to them");
check((await farhan.post(`/api/corrections?pensionerId=${notFarhansCase.pensionerId}`, { field: "name", newValue: "Someone Else" })).status === 403, "Helper asks to change data of a family not linked to them");
const rubinaCase = await caseOf(rubinaFamilies[0]);
check((await rubina.post(`/api/corrections?pensionerId=${rubinaCase.pensionerId}`, { field: "bankAccountNo", newValue: "MB-9999" })).status === 403, "Helper redirects a widow's pension to another bank account");
check((await rubina.post(`/api/corrections?pensionerId=${rubinaCase.pensionerId}`, { field: "cnicMock", newValue: "00000-9999999-9" })).status === 403, "Helper changes a widow's CNIC");

// --- Staff faking proof of life
check((await sana.post(`/api/cases/${noor.id}/evidence`, { type: "face_match", clientActionId: rid(), descriptor: vec(5) })).status === 403, "Officer submits a selfie for a (dead) pensioner");
check((await sana.post(`/api/cases/${noor.id}/submit`)).status === 403, "Officer triggers the AI decision for a pensioner");
let r = await sana.post(`/api/cases/${noor.id}/officer`, { action: "approve", note: "" });
check(r.status === 400, "Officer approves the dead pensioner's case with no reason", (await r.json()).error?.slice(0, 60));

// --- Face enrolment insider tricks
const enrol = (who, pid, d, reason) => who.post(`/api/pensioners/${pid}/enroll-face`, { descriptor: d, reason });
await enrol(sana, sakina.pensionerId, vec(11), "first enrolment for test setup");
const fatimaEnrolled = (await q(`select array_length("enrolledFaceDescriptor",1) n from "Pensioner" where id=$1`, [fatima.pensionerId]))[0].n === 128;
r = await enrol(sana, fatima.pensionerId, vec(11), fatimaEnrolled ? "reason long enough" : undefined);
check(r.status === 409, "Enrol the same face for two pensioners (one person, two pensions)");
r = await enrol(bilal, sakina.pensionerId, vec(12));
check(r.status === 400, "Replace an enrolled face with no reason");
r = await enrol(bilal, sakina.pensionerId, vec(12), "re-taking photo, test of controls");
const bilalApprove = await bilal.post(`/api/cases/${sakina.id}/officer`, { action: "approve", note: "x".repeat(40) });
check(bilalApprove.status === 403, "Officer who replaced the face then approves that person");

// --- Replays and fake liveness, through the pensioner's own login (Sakina, face = vec(12) now)
const ev = (body) => sakinaU.post(`/api/cases/${sakina.id}/evidence`, body);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: [{ action: "blink", done: true, ms: 0 }, { action: "turn_left", done: true, ms: 0 }] });
const live = (await q(`select passed from "Evidence" where "caseId"=$1 and type='liveness' order by "createdAt" desc limit 1`, [sakina.id]))[0];
check(live?.passed === false, "Script claims the blink and head-turn were done in 0 ms");
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: [{ action: "blink", done: true, ms: 900 }, { action: "turn_left", done: true, ms: 1100 }] });
await ev({ type: "face_match", clientActionId: rid(), descriptor: vec(12) });
let d = await (await sakinaU.post(`/api/cases/${sakina.id}/submit`)).json();
check(d.outcome !== "APPROVE", "Send the exact enrolled face numbers (a copied photo)", d.outcome);
const flags = (await q(`select "riskFlags" from "Case" where id=$1`, [sakina.id]))[0].riskFlags;
check(flags.includes("face_reenrolled_this_year"), "Face was replaced this year: case still goes to an officer", flags.join(","));

// Same widow, replay of an identical earlier submission
const w = (body) => widow.post(`/api/cases/${zainab.id}/evidence`, body);
const pid = zainab.pensionerId;
await enrol(sana, pid, vec(1), "test reenrol for replay check");
const face = vec(1).map((x, i) => x + (i % 2 ? 0.02 : -0.02));
await w({ type: "liveness", clientActionId: rid(), passed: true, challenges: [{ action: "blink", done: true, ms: 800 }, { action: "turn_right", done: true, ms: 1300 }] });
await w({ type: "face_match", clientActionId: rid(), descriptor: face });
await w({ type: "face_match", clientActionId: rid(), descriptor: face });
d = await (await widow.post(`/api/cases/${zainab.id}/submit`)).json();
const zf = (await q(`select "riskFlags" from "Case" where id=$1`, [zainab.id]))[0].riskFlags;
check(zf.includes("face_numbers_reused"), "Replay the same selfie numbers twice", zf.join(","));

// --- PIN guessing for a pensioner
const book = await (await fetch(`${B}/api/auth/pensioner/demo-book?no=PEN-K-1012`)).json();
let jar = (await fetch(`${B}/api/auth/pensioner/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qrText: book.qrText }) })).headers.get("set-cookie")?.split(";")[0];
let blockedAt = null;
for (let i = 0; i < 8; i++) { const r2 = await fetch(`${B}/api/auth/pensioner/pin`, { method: "POST", headers: { "content-type": "application/json", cookie: jar }, body: JSON.stringify({ pin: String(1000 + i) }) }); if (r2.status === 429) { blockedAt = i; break; } }
check(blockedAt !== null && blockedAt <= 5, "Guess a pensioner's 4-digit PIN", `blocked after ${blockedAt} tries`);
const forgedQr = book.qrText.replace(/PEN-K-1012/, "PEN-K-1005");
check((await fetch(`${B}/api/auth/pensioner/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qrText: forgedQr }) })).status === 400, "Edit a pension book QR to log in as someone else");
check((await fetch(`${B}/api/auth/pensioner/demo-book?no=PEN-K-1005`)).status === 400, "Ask the demo route for a non-sample pension book");

// --- Consent
const otherConsent = (await q(`select c.id from "Consent" c join "Pensioner" p on p.id=c."pensionerId" where p."pensionNo"<>'PEN-K-1001' limit 1`))[0];
check((await widow.post(`/api/consents/${otherConsent.id}`, { action: "withdraw" })).status === 404, "Pensioner withdraws someone else's consent (ID guessing)");

// --- Public API
check((await fetch(`${B}/api/v1/mock/nadra/0000010000012`)).status === 401, "Public API with no key");
check((await fetch(`${B}/api/v1/mock/nadra/0000010000012`, { headers: { "x-api-key": "zh_deadbeef.notreal" } })).status === 401, "Public API with a made-up key");
const k = await (await admin.post("/api/admin/api-keys", { name: "attack-test", scopes: ["mock:read"] })).json();
check((await fetch(`${B}/api/v1/cases/PEN-K-1001`, { headers: { "x-api-key": k.key ?? "" } })).status === 403, "API key used outside its scope", k.key ? "" : "no key returned");
const hydPension = (await q(`select p."pensionNo" from "Pensioner" p join "Tenant" t on t.id=p."tenantId" where t.name ilike '%hyd%' limit 1`))[0]?.pensionNo;
const k2 = await (await admin.post("/api/admin/api-keys", { name: "attack-test-2", scopes: ["cases:read"] })).json();
if (hydPension) check((await fetch(`${B}/api/v1/cases/${hydPension}`, { headers: { "x-api-key": k2.key ?? "" } })).status === 404, "Karachi API key reads a Hyderabad pensioner");

// --- Audit log tampering, straight in the database
let tamper = "allowed";
try { await db.query(`update "AuditLog" set action='nothing' where id=(select id from "AuditLog" limit 1)`); } catch { tamper = "refused"; }
check(tamper === "refused", "Edit an audit log row directly in the database");
tamper = "allowed";
try { await db.query(`delete from "AuditLog" where id=(select id from "AuditLog" limit 1)`); } catch { tamper = "refused"; }
check(tamper === "refused", "Delete an audit log row directly in the database");

// --- Bad input
check((await widow.post(`/api/cases/${zainab.id}/evidence`, { type: "face_match", clientActionId: rid(), descriptor: [1, 2, 3] })).status === 400, "Send a broken face (3 numbers instead of 128)");
check((await widow.post(`/api/cases/${zainab.id}/evidence`, { type: "liveness", clientActionId: "x'; DROP TABLE \"Case\";--", passed: true, challenges: [] })).status !== 500, "SQL injection text in an ID field");
const hdr = await fetch(`${B}/login`);
check(hdr.headers.get("x-frame-options") === "DENY" && Boolean(hdr.headers.get("x-content-type-options")), "Load the site inside another site's frame (clickjacking)");

console.log(out.join("\n"));
console.log(`\n${n} attacks, ${holes} hole(s)`);
await db.end();
