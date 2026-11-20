// End-to-end smoke test against a running server: node tests/smoke.mjs http://localhost:3000
const BASE = process.argv[2] ?? "http://localhost:3000";
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) failures++; };

async function login(phone) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, password: "demo1234" }) });
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  return { res, cookie, call: (path, opts = {}) => fetch(`${BASE}${path}`, { ...opts, headers: { "content-type": "application/json", cookie, ...(opts.headers ?? {}) } }) };
}
const vec = (seed) => Array.from({ length: 128 }, (_, i) => Math.sin(seed * 31 + i) * 0.1);
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const bad = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: "03000000006", password: "wrong" }) });
ok(bad.status === 401, "wrong password is rejected");

const widow = await login("03000000006");
const officer = await login("03000000001");
const helper = await login("03000000004");
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
await ev({ type: "liveness", clientActionId: id(), passed: true, challenges: [{ action: "blink", done: true, ms: 900 }, { action: "turn_left", done: true, ms: 1200 }] });
await ev({ type: "face_match", clientActionId: id(), descriptor: vec(7) });
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
ok((await officer.call(`/api/cases/${caseId}/officer`, { method: "POST", body: JSON.stringify({ action: "approve", note: "Called her; book was photocopied by a shop. Verified in person." }) })).ok, "officer approves");

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

// Public API needs a key.
ok((await fetch(`${BASE}/api/v1/mock/nadra/0000010000012`)).status === 401, "public API rejects requests without a key");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll smoke checks passed");
process.exit(failures ? 1 : 0);
