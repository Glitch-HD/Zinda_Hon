// End-to-end smoke test against a running server: node tests/smoke.mjs http://localhost:3000
const BASE = process.argv[2] ?? "http://localhost:3000";
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) failures++; };

async function login(phone, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, password }) });
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  return { res, cookie, call: (path, opts = {}) => fetch(`${BASE}${path}`, { ...opts, headers: { "content-type": "application/json", cookie, ...(opts.headers ?? {}) } }) };
}
const vec = (seed) => Array.from({ length: 128 }, (_, i) => Math.sin(seed * 31 + i) * 0.1);
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const bad = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: "03026619470", password: "wrong" }) });
ok(bad.status === 401, "wrong password is rejected");

const widow = await login("03026619470", "Zainab786");
const officer = await login("03214417832", "Sana@Pension24");
const helper = await login("03012654398", "Rubina@Lyari8");
const officer2 = await login("03332290615", "Bilal#Korangi7");
const officer3 = await login("03000000013", "Uzma@Check2");
ok(widow.res.ok && officer.res.ok && helper.res.ok, "demo users can log in");

// Role enforcement on the server.
ok((await widow.call("/api/admin/rules", { method: "POST", body: "{}" })).status === 403, "pensioner cannot publish rules (403)");
ok((await fetch(`${BASE}/api/cases/x`)).status === 401, "no login gives 401");

// Find the widow's case through the officer's view of pension books (via DB-backed page) — use helper's API instead.
const page = await (await widow.call("/pensioner")).text();
const caseId = page.match(/\/case\/([a-z0-9]+)/)?.[1];
ok(Boolean(caseId), "pensioner home links to her case");

// Officer enrols her face (mock descriptor).
const pid = (await (await widow.call(`/api/cases/${caseId}`)).json()).pensioner.id;
ok((await officer.call(`/api/pensioners/${pid}/enroll-face`, { method: "POST", body: JSON.stringify({ descriptor: vec(1) }) })).ok, "officer enrols face");

// Different face → mismatch → ask again.
const ev = (body) => widow.call(`/api/cases/${caseId}/evidence`, { method: "POST", body: JSON.stringify(body) });
// The server chooses the order of movements and signs it (one-time ticket).
const t1 = await (await widow.call(`/api/cases/${caseId}/challenge`, { method: "POST" })).json();
ok(Array.isArray(t1.sequence) && t1.sequence.length >= 2 && typeof t1.token === "string", "server issues a liveness ticket");
const live1 = await (await ev({ type: "liveness", clientActionId: id(), passed: true, challenges: t1.sequence.map((a, i) => ({ action: a, done: true, ms: 800 + i * 150 })), ticket: t1.token })).json();
ok(live1.passed === true, "liveness in the server's order passes");
await ev({ type: "face_match", clientActionId: id(), descriptor: vec(7), ticket: t1.token });
let r = await (await widow.call(`/api/cases/${caseId}/submit`, { method: "POST" })).json();
ok(r.outcome === "ASK_MORE_PROOF" && r.askFor.includes("selfie"), `different face asks for a new selfie (got ${r.outcome})`);

// Same face + duplicate send (idempotency) + forged QR.
const faceId = id();
await ev({ type: "face_match", clientActionId: faceId, descriptor: vec(1) });
const dup = await (await ev({ type: "face_match", clientActionId: faceId, descriptor: vec(1) })).json();
ok(dup.duplicate === true, "a step sent twice is stored once");
const forged = await (await ev({ type: "document", clientActionId: id(), qrText: "ZH1|PEN-K-1001|Zainab Bibi|00000-1000001-2|90000|deadbeefdeadbeefdeadbeef" })).json();
ok(forged.details.qrValid === false, "edited pension book QR is detected");
r = await (await widow.call(`/api/cases/${caseId}/submit`, { method: "POST" })).json();
ok(r.outcome === "SEND_TO_OFFICER", `forged book goes to an officer (got ${r.outcome})`);

// Officer can't stop without a reason; then approves.
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "stop", note: "" }) })).status === 400, "stopping needs a written reason");
// Separation of duties: the officer who enrolled her face may not approve her; a second officer can.
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Called her; book was photocopied by a shop. Verified in person." }) })).status === 403, "the officer who enrolled the face cannot also approve");
ok((await officer2.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "x" }) })).status === 400, "approving despite open risks needs a written check");
ok((await officer2.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "AI case assistant (summary)\nAI: looks fine\n- point one" }) })).status === 400, "text pasted from the AI does not count as the officer's own check");
const ap = await officer2.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Called her; book was photocopied by a shop. Verified in person." }) });
if (ap.status === 202) {
  ok((await ap.json()).pending === true, "a serious risk turns one officer's approval into a proposal");
  ok((await officer2.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Called her; book was photocopied by a shop. Verified in person." }) })).status === 409, "the same officer cannot confirm their own proposal");
  ok((await officer3.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Second check: saw her at the office with the original book today." }) })).ok, "a different officer confirms the approval");
} else ok(ap.ok, "a second officer approves with a written check");

// A closed case can be reopened by an officer with a written reason; an open case cannot.
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Trying again on a closed case." }) })).status === 409, "a closed case cannot be decided again");
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "reopen", note: "appeal" }) })).status === 400, "reopening needs a written reason");
ok((await widow.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "reopen", note: "I want my case opened again please." }) })).status === 403, "a pensioner cannot reopen a case herself");
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "reopen", note: "Family brought new papers to the office; checking again." }) })).ok, "an officer reopens a closed case with a reason");
const reopened = await (await widow.call(`/api/cases/${caseId}`)).json();
ok((reopened.case?.status ?? reopened.status) === "WITH_OFFICER", `a reopened case goes back to the officer queue (got ${reopened.case?.status ?? reopened.status})`);
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "reopen", note: "Family brought new papers to the office; checking again." }) })).status === 409, "an open case cannot be reopened");
// Appeal: she can ask for a re-check from the app; the officer who stopped it may not reopen it.
ok((await widow.call(`/api/cases/${caseId}/appeal`, { method: "POST" })).status === 409, "an open case cannot be appealed");
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "stop", note: "Testing the appeal path in smoke." }) })).ok, "an officer stops the pension");
ok((await widow.call(`/api/cases/${caseId}/appeal`, { method: "POST" })).ok, "the widow appeals from the app");
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "reopen", note: "Reopening my own stop decision." }) })).status === 403, "the officer who stopped it cannot handle the appeal");
ok((await officer3.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "reopen", note: "Appeal received; checking it again independently." }) })).ok, "a different officer reopens it on appeal");

// Consent withdrawal really cuts off the helper.
const consents = (await (await widow.call("/api/consents")).json()).consents;
const helperConsent = consents.find((c) => c.granteeType === "helper");
const helperView1 = await helper.call(`/api/cases/${caseId}`);
ok(helperView1.ok, "helper can see the case while consent is active");
await widow.call(`/api/consents/${helperConsent.id}`, { method: "POST", body: JSON.stringify({ action: "withdraw" }) });
ok((await helper.call(`/api/cases/${caseId}`)).status === 403, "after withdrawal the helper gets 403 at once");
await widow.call(`/api/consents/${helperConsent.id}`, { method: "POST", body: JSON.stringify({ action: "restore" }) });

// Scam checker works even without Claude (falls back to warning signs, never calls a scam "safe").
const scam = await (await widow.call("/api/messages/check", { method: "POST", body: JSON.stringify({ text: "Aap ki pension ki imdadi raqam jari. Fee 500 Easypaisa par bhejain aur apna PIN code batain: 03001234567" }) })).json();
ok(scam.label === "scam" || scam.route === "human_review", `obvious scam is not called genuine (got ${scam.label}/${scam.route})`);

// The officer's AI case assistant: streams steps, never shows "approve" while a serious fact is open,
// and cannot be run by a pensioner.
ok((await widow.call(`/api/cases/${caseId}/agent`, { method: "POST" })).status === 403, "pensioner cannot run the case assistant (403)");
const agentRes = await officer.call(`/api/cases/${caseId}/agent`, { method: "POST" });
const events = (await agentRes.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const final = events.find((e) => e.type === "report");
ok(agentRes.ok && events[0]?.type === "start" && events.some((e) => e.type === "step") && Boolean(final), "case assistant streams its steps and a report");
const tools = new Set(events.filter((e) => e.type === "step").map((e) => e.step.tool));
ok(["case_overview", "check_nadra", "check_death_registry", "check_bank_activity"].every((t) => tools.has(t)), "case assistant ran the required checks");
ok(final && (final.report.findings.every((f) => tools.has(f.source))), "every finding cites a check that really ran");
ok(final && !(final.report.recommendation === "approve" && final.report.findings.some((f) => f.severity === "serious")), "no 'approve' next to a serious finding");

// Public API needs a key.
ok((await fetch(`${BASE}/api/v1/mock/nadra/0000010000012`)).status === 401, "public API rejects requests without a key");

// Four-eyes rule: a looser rule change waits for a second admin.
const kamran = await login("03452876104", "Kamran$Admin9");
const hira = await login("03000000012", "Hira@Rules5");
const RULES = { costs: { wrongApprovalPkr: 360000, humanReviewPkr: 2000 }, face: { strictDistance: 0.4, looseDistance: 0.55, reliabilityWhenStrict: 0.998 }, liveness: { reliabilityWhenPassed: 0.999 }, document: { reliabilityWhenValid: 0.9995, required: true }, identity: { autoMinSimilarity: 0.92, askMinSimilarity: 0.8, reliabilityWhenMatched: 0.9995 }, deathRegistry: { reliabilityWhenClear: 0.9995 }, anomaly: { maxAgeYears: 100 }, maxAttempts: 2 };
const looser = structuredClone(RULES); looser.face.strictDistance = 0.45;
const prop = await kamran.call("/api/admin/rules", { method: "POST", body: JSON.stringify({ config: looser, note: "smoke: looser face" }) });
const propD = await prop.json();
ok(prop.status === 202 && propD.pending === true, "a looser rule change waits for a second admin");
ok((await kamran.call(`/api/admin/rules/requests/${propD.requestId}`, { method: "POST", body: JSON.stringify({ action: "approve" }) })).status === 403, "an admin cannot approve their own looser change");
const appr = await hira.call(`/api/admin/rules/requests/${propD.requestId}`, { method: "POST", body: JSON.stringify({ action: "approve", note: "smoke" }) });
ok(appr.ok && (await appr.json()).version > 0, "a second admin approves it and it becomes active");
const stricter = structuredClone(looser); stricter.face.strictDistance = 0.4;
const strictRes = await kamran.call("/api/admin/rules", { method: "POST", body: JSON.stringify({ config: stricter, note: "smoke: back to stricter" }) });
ok(strictRes.ok && (await strictRes.json()).version > 0, "a stricter change applies at once");

// No office visit: with her consent, her face print comes from her CNIC photo at (simulated) NADRA.
{
  const rasool = await login("03317065529", "Rasool1949");
  const admin = await login("03452876104", "Kamran$Admin9");
  const rCase = (await (await rasool.call("/pensioner")).text()).match(/\/case\/([a-z0-9]+)/)?.[1];
  const rPid = rCase && (await (await rasool.call(`/api/cases/${rCase}`)).json()).pensioner?.id;
  ok(Boolean(rPid), "Ghulam Rasool has an open case to prove");
  const fetchNadra = (who, body) => who.call(`/api/pensioners/${rPid}/nadra-face`, { method: "POST", body: JSON.stringify(body) });
  ok((await fetchNadra(rasool, { consent: true })).status === 404, "no NADRA photo yet: told to use the office or a home visit");
  ok((await officer.call("/api/mock-nadra/face", { method: "POST", body: JSON.stringify({ action: "load", cnic: "00000-1000012-5", descriptor: vec(42) }) })).status === 403, "only an admin can load a demo face into mock NADRA");
  ok((await admin.call("/api/mock-nadra/face", { method: "POST", body: JSON.stringify({ action: "load", cnic: "00000-1000012-5", descriptor: vec(42) }) })).ok, "admin loads a demo face into mock NADRA");
  ok((await fetchNadra(rasool, {})).status === 400, "the NADRA photo is not fetched without a clear yes");
  ok((await fetchNadra(widow, { consent: true })).status === 403, "another pensioner cannot fetch his NADRA photo");
  ok((await fetchNadra(rasool, { consent: true })).ok, "with his consent his face print comes from NADRA, no office visit");
  const rView = await (await rasool.call(`/api/cases/${rCase}`)).json();
  ok(rView.pensioner?.enrolled === true, "he can now start proof of life from home");
  const nadraConsent = (await (await rasool.call("/api/consents")).json()).consents.find((c) => c.granteeType === "nadra");
  ok(Boolean(nadraConsent), "the NADRA permission shows in his consent list");
  await rasool.call(`/api/consents/${nadraConsent.id}`, { method: "POST", body: JSON.stringify({ action: "withdraw" }) });
  ok((await (await rasool.call(`/api/cases/${rCase}`)).json()).pensioner?.enrolled === false, "taking back the NADRA permission deletes the face print at once");
  ok((await admin.call("/api/mock-nadra/face", { method: "POST", body: JSON.stringify({ action: "wipe" }) })).ok, "admin can wipe all demo faces after judging");
}

// Create account: only mock CNICs and phones, a pending sign-up cannot log in, an officer approves it.
const reg = (b) => fetch(`${BASE}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const offices = (await (await fetch(`${BASE}/api/auth/register`)).json()).offices;
const khi = offices.find((o) => /Karachi/.test(o.name));
const fatima = { tenantId: khi.id, role: "PENSIONER", pensionType: "family", name: "Fatima Begum", cnic: "00000-1000002-4", phone: "03000000099", dateOfBirth: "1948-07-01", pensionNo: "PEN-K-1002", password: "Fatima1948",
  husbandName: "Abdul Rasheed", husbandCnic: "00000-2000002-6", husbandDeathDate: "2018-05-12", deathCertNo: "UC-LYR-2018-0412" };
ok((await reg({ ...fatima, cnic: "42101-1234567-1" })).status === 400, "a real-looking CNIC is refused");
ok((await reg({ ...fatima, phone: "03211234567" })).status === 400, "a real-looking phone number is refused");
ok((await reg({ tenantId: khi.id, role: "SHOPKEEPER", name: "Asif Kiryana", cnic: "00000-3000001-1", phone: "03000000098", password: "AsifShop99" })).status === 400, "a shopkeeper must give the shop's name");
ok((await reg(fatima)).ok, "a widow can send a sign-up with her late husband's details");
// A widow who cannot read, filled in by her son, with only a PIN (no password).
const assisted = await reg({ tenantId: khi.id, role: "PENSIONER", pensionType: "family", name: "Khadija Bibi", cnic: "00000-1000009-2", phone: "03000000097", pensionNo: "PEN-K-1009", pin: "2580", husbandName: "Ghulam Nabi", assistedBy: { name: "Asad Nabi", phone: "03000000096", relation: "Son" } });
ok(assisted.ok, "someone can fill the form for a widow who cannot read, with only a PIN");
const early = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: fatima.phone, password: fatima.password }) });
ok(early.status === 403, "a sign-up cannot log in before an officer checks it");
const pendingReg = (await (await officer.call("/api/registrations")).json()).registrations?.find((x) => x.phone === fatima.phone);
ok(pendingReg, "the officer sees the new sign-up");
if (pendingReg) {
  ok((await widow.call(`/api/registrations/${pendingReg.id}`, { method: "POST", body: JSON.stringify({ action: "approve" }) })).status === 403, "a pensioner cannot approve sign-ups");
  ok((await officer.call(`/api/registrations/${pendingReg.id}`, { method: "POST", body: JSON.stringify({ action: "approve", note: "" }) })).status === 400, "a pensioner sign-up always needs the officer's written check (a son could know her CNIC)");
  ok((await officer.call(`/api/registrations/${pendingReg.id}`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Called her on the number in her pension file; she confirmed." }) })).ok, "the officer approves the sign-up");
  ok((await login(fatima.phone, fatima.password)).res.ok, "after approval the new pensioner can log in");
  ok(pendingReg.checks.husbandDeathFound === true && pendingReg.checks.husbandNadraSimilarity >= 0.8, "her husband's death and name are checked against the records");
}
const helpedReg = (await (await officer.call("/api/registrations")).json()).registrations?.find((x) => x.phone === "03000000097");
ok(helpedReg?.assistedBy?.relation === "Son", "the officer sees who filled the form");
if (helpedReg) ok((await officer.call(`/api/registrations/${helpedReg.id}`, { method: "POST", body: JSON.stringify({ action: "approve", note: "" }) })).status === 400, "a form filled by someone else needs the officer's written check");

// Officer desk: open cases, link helpers, accept corrections (bank/CNIC need two officers).
{
  const post = (who, path, body) => who.call(path, { method: "POST", body: JSON.stringify(body) });
  ok((await post(widow, "/api/cases", { all: true })).status === 403, "a pensioner cannot open cases");
  ok((await post(officer, "/api/cases", { all: true })).ok, "an officer opens this year's cases for everyone who has none");
  ok((await post(officer, "/api/cases", { pensionerId: pid })).status === 409, "a second case for the same year is refused");
  const rubinaId = (await (await helper.call("/api/auth/me")).json()).id;
  ok((await post(helper, "/api/helper-links", { action: "link", pensionerId: pid, helperId: rubinaId, fields: ["name"], note: "I am linking myself in." })).status === 403, "a helper cannot link themselves to a family");
  ok((await post(officer, "/api/helper-links", { action: "link", pensionerId: pid, helperId: rubinaId, fields: ["name", "face"], note: "ok" })).status === 400, "linking a helper needs a note on how she agreed");
  ok((await post(officer, "/api/helper-links", { action: "link", pensionerId: pid, helperId: rubinaId, fields: ["name", "face"], note: "She agreed in person at the office today." })).ok, "an officer links a helper with what she agreed to share");
  const after = (await (await widow.call("/api/consents")).json()).consents.find((c) => c.granteeId === rubinaId && !c.withdrawnAt);
  ok(after && after.fields.includes("case_status") && !after.fields.includes("bank_account"), "the new permission shows on her My data page, never with bank details");
  ok((await post(widow, "/api/corrections", { field: "dateOfBirth", newValue: "1850-01-01" })).status === 400, "an impossible date of birth is refused at once");
  ok((await widow.call("/api/corrections", { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify({ field: "bankAccountNo", newValue: "EVIL0000001" }) })).status === 403, "a request sent from another website is refused (CSRF)");
  ok((await post(widow, "/api/corrections", { field: "bankAccountNo", newValue: "MOCKBANK001234" })).ok, "she asks to change her bank account");
  ok((await post(widow, "/api/corrections", { field: "bankAccountNo", newValue: "MOCKBANK009999" })).status === 409, "a second request for the same field waits for the first");
  ok((await officer.call("/officer/families")).ok, "the families desk opens for an officer");
  const req = (await (await officer.call("/api/corrections")).json()).requests.find((x) => x.newValue === "MOCKBANK001234");
  ok(req, "the officer sees her request");
  if (req) {
    ok((await post(officer, `/api/corrections/${req.id}`, { action: "accept", note: "short" })).status === 400, "accepting needs a note on how it was checked");
    const first = await post(officer, `/api/corrections/${req.id}`, { action: "accept", note: "Saw her new bank letter at the office." });
    ok(first.status === 202, "a bank account change is only proposed by the first officer");
    ok((await post(officer, `/api/corrections/${req.id}`, { action: "accept", note: "Saw her new bank letter at the office." })).status === 403, "the same officer cannot confirm their own proposal");
    ok((await post(officer3, `/api/corrections/${req.id}`, { action: "accept", note: "Called her on the file number; she confirmed." })).ok, "a second officer confirms and the change is applied");
    const mine = (await (await widow.call("/api/corrections")).json()).requests.find((x) => x.id === req.id);
    ok(mine?.status === "accepted", "she can see her request was accepted");
  }
}

// Public pages: anyone can check a message or ask about the rules without logging in.
{
  const pub = await fetch(`${BASE}/check-message`, { redirect: "manual" });
  ok(pub.status === 200, `the scam check page opens without a login (got ${pub.status})`);
  ok((await fetch(`${BASE}/ask`, { redirect: "manual" })).status === 200, "the pension rules page opens without a login");
  const anon = await fetch(`${BASE}/api/messages/check`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.7.7.7" }, body: JSON.stringify({ text: "Send your PIN code and Rs 500 fee to release your relief payment today" }) });
  ok(anon.ok && ["scam", "unsure"].includes((await anon.json()).label), "a visitor without a login can check a message");
}

// Error monitoring: a phone's crash report is stored and the health check counts errors.
ok((await fetch(`${BASE}/api/client-error`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "smoke test crash", page: "/smoke" }) })).ok, "a phone can report a crash");
const health = await (await fetch(`${BASE}/api/health`)).json();
ok(typeof health.errorsLastHour === "number", "health check reports recent errors");

// Reset demo data (last, because it wipes everything): admin only, needs RESET typed, then a clean start.
{
  const kam = await login("03452876104", "Kamran$Admin9");
  ok((await officer.call("/api/admin/reset-demo", { method: "POST", body: JSON.stringify({ confirm: "RESET" }) })).status === 403, "an officer cannot reset the demo data");
  ok((await kam.call("/api/admin/reset-demo", { method: "POST", body: JSON.stringify({ confirm: "reset" }) })).status === 400, "reset needs RESET typed exactly");
  const r = await kam.call("/api/admin/reset-demo", { method: "POST", body: JSON.stringify({ confirm: "RESET" }) });
  ok(r.ok, `admin resets the demo data (${r.ok ? (await r.json()).seconds + " s" : r.status})`);
  ok((await widow.call("/api/consents")).status === 401, "after a reset every old login has ended");
  const w2 = await login("03026619470", "Zainab786");
  ok(w2.res.ok, "demo accounts work again after the reset");
  const c2 = (await (await w2.call("/pensioner")).text()).match(/\/case\/([a-z0-9]+)/)?.[1];
  const v2 = c2 ? await (await w2.call(`/api/cases/${c2}`)).json() : null;
  ok(v2?.pensioner?.enrolled === false && v2?.case?.status !== "VERIFIED", "after the reset no face is enrolled and this year's case starts fresh");
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll smoke checks passed");
process.exit(failures ? 1 : 0);
