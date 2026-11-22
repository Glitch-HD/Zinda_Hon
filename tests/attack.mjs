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
const ticketFor = async (u, caseId) => (await u.post(`/api/cases/${caseId}/challenge`)).json();
const doneAll = (t, ms = 900) => t.sequence.map((a, i) => ({ action: a, done: true, ms: ms + i * 100 }));

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
const lastLive = async (cid) => (await q(`select passed, details from "Evidence" where "caseId"=$1 and type='liveness' order by "createdAt" desc limit 1`, [cid]))[0];
let tk = await ticketFor(sakinaU, sakina.id);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tk, 0), ticket: tk.token });
check((await lastLive(sakina.id))?.passed === false, "Script claims the blink and head-turn were done in 0 ms");
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: [{ action: "blink", done: true, ms: 900 }, { action: "turn_left", done: true, ms: 1100 }] });
check((await lastLive(sakina.id))?.passed === false, "Liveness 'passed' with no server ticket (script picks its own easy moves)");
tk = await ticketFor(sakinaU, sakina.id);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tk).reverse(), ticket: tk.token });
check((await lastLive(sakina.id))?.passed === false, "Do the movements in a different order than the server asked");
const tkOther = await ticketFor(widow, zainab.id);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tkOther), ticket: tkOther.token });
check((await lastLive(sakina.id))?.passed === false, "Use another case's liveness ticket");
const fakeTk = tk.token.split(".")[0] + "." + "A".repeat(43);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tk), ticket: fakeTk });
check((await lastLive(sakina.id))?.passed === false, "Forge the signature on a liveness ticket");
tk = await ticketFor(sakinaU, sakina.id);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tk), ticket: tk.token });
const goodLive = await lastLive(sakina.id);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tk), ticket: tk.token });
check(goodLive?.passed === true && (await lastLive(sakina.id))?.passed === false, "Replay a passed liveness ticket a second time");
tk = await ticketFor(sakinaU, sakina.id);
await ev({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tk), ticket: tk.token });
await ev({ type: "face_match", clientActionId: rid(), descriptor: vec(12), ticket: tk.token });
let d = await (await sakinaU.post(`/api/cases/${sakina.id}/submit`)).json();
check(d.outcome !== "APPROVE", "Send the exact enrolled face numbers (a copied photo)", d.outcome);
const flags = (await q(`select "riskFlags" from "Case" where id=$1`, [sakina.id]))[0].riskFlags;
check(flags.includes("face_reenrolled_this_year"), "Face was replaced this year: case still goes to an officer", flags.join(","));

// Same widow, replay of an identical earlier submission
const w = (body) => widow.post(`/api/cases/${zainab.id}/evidence`, body);
const pid = zainab.pensionerId;
await enrol(sana, pid, vec(1), "test reenrol for replay check");
const face = vec(1).map((x, i) => x + (i % 2 ? 0.02 : -0.02));
const tz = await ticketFor(widow, zainab.id);
await w({ type: "liveness", clientActionId: rid(), passed: true, challenges: doneAll(tz), ticket: tz.token });
await w({ type: "face_match", clientActionId: rid(), descriptor: face, ticket: tz.token });
await w({ type: "face_match", clientActionId: rid(), descriptor: face });
d = await (await widow.post(`/api/cases/${zainab.id}/submit`)).json();
const zf = (await q(`select "riskFlags" from "Case" where id=$1`, [zainab.id]))[0].riskFlags;
check(zf.includes("face_numbers_reused"), "Replay the same selfie numbers twice", zf.join(","));
check(zf.includes("face_not_from_liveness_check"), "Send a selfie on its own, without a liveness check", zf.join(","));

// --- Four-eyes rule on safety settings
const hira = await login("03000000012", "Hira@Rules5");
const RULES = { costs: { wrongApprovalPkr: 360000, humanReviewPkr: 2000 }, face: { strictDistance: 0.4, looseDistance: 0.55, reliabilityWhenStrict: 0.998 }, liveness: { reliabilityWhenPassed: 0.999 }, document: { reliabilityWhenValid: 0.9995, required: true }, identity: { autoMinSimilarity: 0.92, askMinSimilarity: 0.8, reliabilityWhenMatched: 0.9995 }, deathRegistry: { reliabilityWhenClear: 0.9995 }, anomaly: { maxAgeYears: 100 }, maxAttempts: 2 };
const lax = structuredClone(RULES); lax.costs.wrongApprovalPkr = 4000; lax.face.looseDistance = 0.9;
const before = (await q(`select max(version) v from "RuleVersion" rv join "Tenant" t on t.id=rv."tenantId" where t.name ilike '%karachi%'`))[0].v;
const pr = await (await admin.post("/api/admin/rules", { config: lax, note: "attack: open the gate" })).json();
const after = (await q(`select max(version) v from "RuleVersion" rv join "Tenant" t on t.id=rv."tenantId" where t.name ilike '%karachi%'`))[0].v;
check(pr.pending === true && after === before, "One admin makes the checks much looser on their own", `pending=${pr.pending}`);
check((await admin.post(`/api/admin/rules/requests/${pr.requestId}`, { action: "approve" })).status === 403, "The same admin approves their own looser rule");
check((await hira.post(`/api/admin/rules/requests/${pr.requestId}`, { action: "cancel" })).status === 403, "A second admin cancels someone else's change silently");
await hira.post(`/api/admin/rules/requests/${pr.requestId}`, { action: "reject", note: "attack test" });

// --- Light path abuse and crash-report flooding
check([403, 404].includes((await widow.post(`/api/cases/${sakina.id}/request-visit`, { reason: "slow_network" })).status), "Ask for a home visit on someone else's case");
let flood = null;
for (let i = 0; i < 25; i++) { const r3 = await fetch(`${B}/api/client-error`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify({ message: `flood ${i}` }) }); if (r3.status === 429) { flood = i; break; } }
check(flood !== null && flood <= 20, "Flood the crash-report endpoint", `blocked after ${flood}`);

// --- PIN guessing for a pensioner
const book = await (await fetch(`${B}/api/auth/pensioner/demo-book?no=PEN-K-1012`)).json();
let jar = (await fetch(`${B}/api/auth/pensioner/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qrText: book.qrText }) })).headers.get("set-cookie")?.split(";")[0];
let blockedAt = null;
for (let i = 0; i < 8; i++) { const r2 = await fetch(`${B}/api/auth/pensioner/pin`, { method: "POST", headers: { "content-type": "application/json", cookie: jar }, body: JSON.stringify({ pin: String(1000 + i) }) }); if (r2.status === 429) { blockedAt = i; break; } }
check(blockedAt !== null && blockedAt <= 5, "Guess a pensioner's 4-digit PIN", `blocked after ${blockedAt} tries`);
// --- Son holds up his mother's photo: the face matches, and his script just claims "she blinked".
const zBook = await (await fetch(`${B}/api/auth/pensioner/demo-book?no=PEN-K-1001`)).json();
const zFace = (await q(`select "enrolledFaceDescriptor" as d from "Pensioner" where "pensionNo"='PEN-K-1001'`))[0]?.d;
const zJar = (await fetch(`${B}/api/auth/pensioner/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qrText: zBook.qrText }) })).headers.get("set-cookie")?.split(";")[0];
if (zFace?.length === 128) {
  const photo = zFace.map((x) => x + 0.01);
  const noTicket = await fetch(`${B}/api/auth/pensioner/face`, { method: "POST", headers: { "content-type": "application/json", cookie: zJar }, body: JSON.stringify({ descriptor: photo, livenessPassed: true, challenges: [{ action: "blink", done: true, ms: 900 }, { action: "turn_left", done: true, ms: 900 }] }) });
  check(noTicket.status === 401, "Log in as a widow with her photo and a fake 'liveness passed'", `got ${noTicket.status}`);
  const tk = await (await fetch(`${B}/api/auth/pensioner/challenge`, { method: "POST", headers: { cookie: zJar } })).json();
  const wrong = [...tk.sequence].reverse().map((action) => ({ action, done: true, ms: 900 }));
  const wrongOrder = await fetch(`${B}/api/auth/pensioner/face`, { method: "POST", headers: { "content-type": "application/json", cookie: zJar }, body: JSON.stringify({ descriptor: photo, livenessPassed: true, ticket: tk.token, challenges: wrong }) });
  check(wrongOrder.status === 401, "Log in with a liveness ticket but not the movements the server asked for", `got ${wrongOrder.status}`);
}
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
// --- New officer desk (cases, helper links, corrections): cross-site, cross-office and wrong-role attempts.
{
  const zc = await caseOf("PEN-K-1001");
  const evil = { origin: "https://evil.example" };
  check((await sana.call(`/api/cases/${zc.id}/officer`, { method: "POST", headers: evil, body: JSON.stringify({ action: "stop", note: "Forged from another website" }) })).status === 403, "Make a logged-in officer stop a pension from another website (CSRF)");
  check((await widow.call("/api/consents", { method: "GET" })).ok && (await widow.call(`/api/cases/${zc.id}/appeal`, { method: "POST", headers: { origin: "null" } })).status === 403, "Send a request from a sandboxed page with origin null");
  const rubId = (await (await rubina.call("/api/auth/me")).json()).id;
  check((await naveed.post("/api/helper-links", { action: "link", pensionerId: zc.pensionerId, helperId: rubId, fields: ["name"], note: "Linking across offices to see her data." })).status === 404, "Officer of another office links a helper to a Karachi widow");
  check((await rubina.post("/api/helper-links", { action: "link", pensionerId: zc.pensionerId, helperId: rubId, fields: ["name", "face", "cnic"], note: "Giving myself more access please." })).status === 403, "Helper widens their own permission");
  check((await rubina.post("/api/cases", { all: true })).status === 403, "Helper opens cases");
  await widow.post("/api/corrections", { field: "fatherOrHusbandName", newValue: "Abdul Ghafoor" });
  const corr = (await q(`select id from "DataCorrectionRequest" where status='pending' order by "createdAt" desc limit 1`))[0];
  if (corr) {
    check((await naveed.post(`/api/corrections/${corr.id}`, { action: "accept", note: "Accepting from another office." })).status === 404, "Officer of another office changes a Karachi widow's data");
    check((await auditor.post(`/api/corrections/${corr.id}`, { action: "accept", note: "Auditor trying to change data." })).status === 403, "Auditor (read-only) changes a widow's data");
    check((await widow.post(`/api/corrections/${corr.id}`, { action: "accept", note: "Accepting my own request now." })).status === 403, "Pensioner approves her own data change");
  }
  check((await widow.post("/api/corrections", { field: "cnicMock", newValue: "42101-1234567-1" })).status === 400, "Change a CNIC to a real-looking number");
}
// --- Anonymous visitors flood the public scam checker (it calls a paid-per-use AI if a key is set).
{
  let stoppedAt = null;
  for (let i = 0; i < 14; i++) { const r = await fetch(`${B}/api/messages/check`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.66.66.66" }, body: JSON.stringify({ text: `flood test number ${i} send pin` }) }); if (r.status === 429) { stoppedAt = i; break; } }
  check(stoppedAt !== null && stoppedAt <= 10, "Flood the public scam checker without logging in", `blocked after ${stoppedAt}`);
  const onMap = (await q(`select count(*)::int as n from "CheckedMessage" where text like 'flood test number%' and "submittedById" is not null`))[0]?.n;
  check(onMap === 0, "Poison the Scam Map with anonymous fake reports");
}
// --- Sister attack: Zainab's sister is registered herself (Fatima's record here) and looks like her.
{
  const A = (await q(`select "enrolledFaceDescriptor" as d from "Pensioner" where "pensionNo"='PEN-K-1001'`))[0]?.d;
  const fat = (await q(`select id from "Pensioner" where "pensionNo"='PEN-K-1002'`))[0];
  if (A?.length === 128 && fat) {
    // A unit direction u and an orthogonal unit v, to place faces at chosen distances.
    const u = A.map((_, i) => (i % 2 ? 1 : -1) / Math.sqrt(128));
    const v = A.map((_, i) => (i < 64 ? 1 : -1) / Math.sqrt(128));
    const Bf = A.map((x, i) => x + 0.45 * u[i]);                   // the sister's enrolled face: 0.45 from Zainab
    const L = A.map((x, i) => x + 0.2854 * u[i] + 0.2508 * v[i]);  // the sister live: 0.38 from Zainab, 0.30 from herself
    const enr = await sana.post(`/api/pensioners/${fat.id}/enroll-face`, { descriptor: Bf });
    const zb = await (await fetch(`${B}/api/auth/pensioner/demo-book?no=PEN-K-1001`)).json();
    const jar2 = (await fetch(`${B}/api/auth/pensioner/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qrText: zb.qrText }) })).headers.get("set-cookie")?.split(";")[0];
    const tk = await (await fetch(`${B}/api/auth/pensioner/challenge`, { method: "POST", headers: { cookie: jar2 } })).json();
    const r = await fetch(`${B}/api/auth/pensioner/face`, { method: "POST", headers: { "content-type": "application/json", cookie: jar2 }, body: JSON.stringify({ descriptor: L, livenessPassed: true, ticket: tk.token, challenges: tk.sequence.map((action) => ({ action, done: true, ms: 900 })) }) });
    check(enr.ok && r.status === 401, "Sister who looks alike logs in as the widow with her own face", `enrol ${enr.status}, login ${r.status}`);
  }
}
// Change PIN / change password.
{
  const zRow = (await q(`select "enrolledFaceDescriptor" as d from "Pensioner" where id=$1`, [zainab.pensionerId]))[0];
  let face = zRow?.d?.length === 128 ? zRow.d : null;
  if (!face) { face = vec(5); await sana.post(`/api/pensioners/${zainab.pensionerId}/enroll-face`, { descriptor: face }); }
  const fresh = await login("03026619470", "Zainab786");
  const pinTry = async (u, body) => { const t = await (await u.post("/api/account/pin/challenge")).json(); return { t, r: await u.post("/api/account/pin", { descriptor: face, livenessPassed: true, ticket: t.token, challenges: doneAll(t), ...body }) }; };
  const son = await pinTry(fresh, { currentPin: "4826", newPin: "5739", descriptor: vec(99) });
  check(son.r.status === 401, "Son who saw her PIN changes it with his own face", `got ${son.r.status}`);
  const weak = await pinTry(fresh, { currentPin: "4826", newPin: "1234" });
  check(weak.r.status === 400, "Set an easy PIN like 1234", `got ${weak.r.status}`);
  const wrongOld = await pinTry(fresh, { currentPin: "0000", newPin: "5739" });
  check(wrongOld.r.status === 401, "Change her PIN without knowing the old one", `got ${wrongOld.r.status}`);
  check((await fresh.post("/api/account/password", { current: "Zainab786", next: "NewPass12345" })).status === 403, "Pensioner changes password instead (skipping the face check)");
  const good = await pinTry(fresh, { currentPin: "4826", newPin: "5739" });
  const fresh2 = await login("03026619470", "Zainab786");
  const replay = await fresh2.post("/api/account/pin", { currentPin: "5739", newPin: "6284", descriptor: face, livenessPassed: true, ticket: good.t.token, challenges: doneAll(good.t) });
  check(good.r.ok && replay.status === 401, "Reuse a finished face check to change the PIN again", `first ${good.r.status}, replay ${replay.status}`);
  const meId = async (u) => (await (await u.call("/api/auth/me")).json()).id;
  check((await meId(widow)) === null && (await meId(fresh)) === null && (await meId(fresh2)) !== null, "Keep using an older login after the PIN was changed");
  check((await rubina.post("/api/account/pin", { currentPin: "4826", newPin: "5739", descriptor: face, livenessPassed: true, challenges: [] })).status === 403, "Helper changes a pensioner's PIN");
  const f1 = await login("03349182746", "Farhan%Help6"), f2 = await login("03349182746", "Farhan%Help6");
  check((await f1.post("/api/account/password", { current: "wrong-one", next: "Brand9NewPass" })).status === 401, "Change a helper's password without the old one");
  check((await f1.post("/api/account/password", { current: "Farhan%Help6", next: "short1" })).status === 400, "Set a weak new password");
  const pc = await f1.post("/api/account/password", { current: "Farhan%Help6", next: "Brand9NewPass" });
  check(pc.ok && (await meId(f2)) === null, "Stolen second login keeps working after the password change", `change ${pc.status}`);
  const f3 = await login("03349182746", "Brand9NewPass");
  const cross = await fetch(`${B}/api/account/password`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: f3.cookie }, body: JSON.stringify({ current: "Brand9NewPass", next: "Another9Pass" }) });
  check(cross.status === 403, "Another website changes the password in the background (CSRF)", `got ${cross.status}`);
}
const hdr = await fetch(`${B}/login`);
check(hdr.headers.get("x-frame-options") === "DENY" && Boolean(hdr.headers.get("x-content-type-options")) && /frame-ancestors 'none'/.test(hdr.headers.get("content-security-policy") ?? ""), "Load the site inside another site's frame (clickjacking)");

console.log(out.join("\n"));
console.log(`\n${n} attacks, ${holes} hole(s)`);
await db.end();
process.exit(holes ? 1 : 0);
