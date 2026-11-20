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
ok((await officer2.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Called her; book was photocopied by a shop. Verified in person." }) })).ok, "a second officer approves with a written check");

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

// Error monitoring: a phone's crash report is stored and the health check counts errors.
ok((await fetch(`${BASE}/api/client-error`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "smoke test crash", page: "/smoke" }) })).ok, "a phone can report a crash");
const health = await (await fetch(`${BASE}/api/health`)).json();
ok(typeof health.errorsLastHour === "number", "health check reports recent errors");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll smoke checks passed");
process.exit(failures ? 1 : 0);
