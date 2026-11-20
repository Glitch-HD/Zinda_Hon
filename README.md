# Zinda Hon (زندہ ہوں) — PROTOTYPE

> **Prototype, not an official service.** Every person, CNIC, pension, bank account and death record in this system is invented. No real personal data is used.

**We help elderly widow pensioners renew their yearly proof-of-life to keep their pension, even though they cannot read forms, their fingerprints fail, their signal is weak, and scammers send them fake "pension update" messages.**

Built for Coder's Cup '26, Hagrid's Hackathon: *The Last Mile: AI on Public Rails*.

## The three people we serve

| Person in the brief | In Zinda Hon | What they do |
| --- | --- | --- |
| The widow (can't read, weak signal) | Pensioner on a family pension | Proves she is alive by Urdu voice prompts, a selfie with a liveness check, and a scan of her pension book QR. Progress is saved on the phone. |
| The shopkeeper (fake relief messages) | Mobile-wallet cash-out agent | Checks suspicious "pension" / "relief payment" messages; results feed the Scam Map. |
| The helper (40 families, one phone) | Social worker | Helper Mode: switches between families, each with their own consent. |

## The core decision rule

A wrong approval (paying a dead person for a year) costs **Rs 360,000** in our mock program. One officer review costs about **Rs 2,000**. So the system approves on its own only when

```
P(wrong) × 360,000 < 2,000   →   confidence ≥ 99.44%
```

Otherwise it **asks for more proof** (retake selfie, rescan book, confirm name by voice) or **sends the case to a pension officer** with every check attached. **The system never stops a pension on its own**; only an officer can, and must write a reason. Both costs are admin-editable rule values (no code change), and every decision records the rule version it used.

## What is real and what is simulated

| Part | Real or simulated |
| --- | --- |
| Login, roles, server-side permission checks, audit log, consent checks | **Real** (working code) |
| Decision engine, rule versions, Digital Twin replay | **Real** |
| Face match (face-api, 128-number descriptors) and liveness (MediaPipe blink / head turn) | **Real**, runs in the browser. Not bank-grade anti-spoofing. |
| Pension book QR signature check (HMAC) | **Real** |
| Scam classifier, rulebook answers, explanations (Groq gpt-oss-120b, or Claude when its key is set, plus warning signs) | **Real** AI calls |
| Officer's AI case assistant (an agent that calls tools) | **Real** AI tool calling (Groq gpt-oss-120b, or Claude); a fixed checklist runs when no key is set or the AI fails |
| Urdu speech-to-text (Whisper on Groq) and text-to-speech (Azure neural voice) | **Real** services when keys are set; falls back to the phone's own voice |
| NADRA, bank / Raast, death registry | **Simulated** mock services with deliberately messy data |
| Pension program, amounts, rulebook | **Simulated** (our own invented rules) |
| People, CNICs (all start with `00000`), phone numbers | **Simulated** |
| SMS notifications | **Simulated** (in-app only) |

## Brief requirements → where they are

| Requirement | Where |
| --- | --- |
| JWT login + role-based access (6 roles) | `lib/auth.ts`, every route calls `requireUser([...])` |
| Dashboard, case management (create / assign / escalate / close) | `/pensioner`, `/helper`, `/officer`, `lib/case-service.ts` |
| Public REST API with API keys + OpenAPI docs | `/api/v1/*`, `/docs`, keys created in `/admin` |
| Audit log of every user, AI and agent action | `lib/audit.ts`, viewable at `/auditor` (filter by actor; "AI case assistant" tab lists every agent run) |
| Autonomous agent with tool calling | Officer case page → "Investigate with AI assistant": `lib/agent.ts`, `lib/agent-guardrails.ts`, `POST /api/cases/:id/agent` |
| Consent: see, share, withdraw, correct | `/consent`, `lib/consent.ts` (checked live on every request) |
| Mock identity, payment and data services | `/api/v1/mock/*`, seeded in `prisma/seed.ts` |
| Platform extras: rule editor, officer queue (priority + confidence), offline mode, multi-tenant, rate limiting | `/admin`, `/officer`, `public/sw.js` + `lib/client/queue.ts`, `tenantId` on every record, `lib/ratelimit.ts` |
| AI: computer vision, voice, classification + routing, structured outputs, explainability, guardrails, anomaly detection, RAG, evaluation | `lib/client/face.ts`, `lib/client/voice.ts`, `lib/claude.ts`, `lib/decision.ts`, `/ask`, `/evaluation` |
| Bonus: Helper Mode, Offline-First Sync, Digital Twin, Scam Map | `/helper`, `lib/client/queue.ts`, `/admin` → "Test on past cases first", `/scam-map` |
| Database with migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Monitoring, logs, tests | `/api/health`, Vercel logs, `npm test` (unit), `npm run test:smoke` (end-to-end) |

## The officer's AI case assistant (agent)

On any case page an officer can press **🕵️ Investigate with AI assistant**. The assistant plans its own
investigation and the officer watches each step live:

- **Tools it can call (read-only):** `case_overview`, `check_nadra`, `check_death_registry`, `check_bank_activity`,
  `find_possible_duplicates`, `past_years`, `search_rulebook`, then `submit_report`.
- **It cannot act.** No tool approves, stops or changes anything. The officer decides.
- **Privacy:** CNICs and account numbers reach the model masked to the last 4 digits; face data never leaves (only "matched / not matched").
- **Guardrails in plain code** (`lib/agent-guardrails.ts`, unit-tested), applied after the model answers:
  1. A report is refused until NADRA, the death registry and the bank have been checked.
  2. Findings that cite a check the assistant never ran are removed.
  3. Serious facts from the records (death record, money used after death, duplicates, failed proof, ...) are always added if the model left them out.
  4. "Approve" is never shown while a serious fact is open; the model's approving words are replaced and the officer sees what was overruled.
  5. Confidence is capped at 60% while a serious fact is open.
- **Limits:** at most 10 tool calls and 50 seconds; if the AI is slow, fails or no key is set, a fixed checklist finishes the job and says so.
- **Audit:** the request, every tool call and the report are audit-log rows (`AGENT` actor), and each run is saved (`AgentRun`).
- **Measured:** `/evaluation` runs the assistant on 10 labelled cases (5 with a problem planted in the demo data,
  5 clean) and shows whether it found each problem by itself, whether its suggestion was safe before and after
  the safety rules, and false alarms (`lib/agent-eval.ts`).

## Security and insider fraud

`npm run test:attack -- <url> <database-url>` runs 50 attacks against a fresh local copy (forged login tokens,
other roles, other offices, helpers outside their families, staff faking proof, face swaps, replays, PIN
guessing, forged pension books, forged or replayed liveness tickets, one admin loosening the rules alone,
API keys, audit tampering, crash-report flooding). All are blocked. Controls against insiders:

- **Helper:** only sees families the office linked and who gave consent; cannot change bank account or CNIC;
  10% of helper-done proofs go to an officer at random; a helper doing more than 15 proofs a year has every
  further one checked; a pensioner seen only through a helper three years running goes to an officer.
- **Officer:** cannot submit proof of life for anyone; cannot enrol a face already used by another pensioner;
  replacing a face needs a reason and sends this year's case to an officer; cannot approve someone whose face
  they enrolled in the last year; approving with open risks (death record, duplicate, no proof) needs a
  written check of 30+ characters and appears on the auditor's "Risky actions" list.
- **Replays:** the exact same face numbers twice, or numbers almost identical to the enrolment photo, go to an officer.
- **Audit log:** append-only in the database itself (a trigger refuses UPDATE, DELETE and TRUNCATE).
  To wipe demo data, drop the database or disable the trigger as the database owner.
- **Liveness ticket:** the server picks the random order of movements (blink, turn left, turn right) and signs
  it with the case and a one-time number. The phone must do exactly that order and send the ticket back; a
  missing, forged, reused or other-case ticket fails. The selfie carries the same ticket, so a selfie sent on
  its own goes to an officer. Tickets last 24 hours so the check still works offline.
- **Admins (four-eyes rule):** a rule change that makes any check looser (higher face distance, lower required
  confidence, higher age limit, book not required...) waits until a different admin approves it. Stricter
  changes apply at once. Both names are in the audit log.
- **Helper trust score:** officers see the record of the helper who sent a proof (stopped pensions, replayed
  selfies, refused bank or CNIC changes, withdrawn consent, passed spot checks); admins see all helpers.
- **Limits we state openly:** the face and movement detection itself still runs on the phone, so a skilled
  attacker with a modified app could fake the camera; the ticket, record checks, replay checks, random spot
  checks and separation of duties are there because of that. Production would use a certified liveness service.

## Reliability and monitoring

- **CI:** `.github/workflows/ci.yml` runs on every push: type check, unit tests, production build, then starts
  the app on a fresh Postgres and runs the smoke test and the attack suite. A red check means do not demo that commit.
- **Error monitoring in the app:** every unexpected server error and every crash on a person's phone is stored
  (scrubbed of numbers) and shown on the admin's System health card, grouped by message, with counts of AI
  fallbacks. `/api/health` reports errors in the last hour for an uptime monitor.

## Weak network and offline

- The face check files (about 20 MB) download ahead of time into a cache that survives app updates: by
  themselves on Wi-Fi or 4G, or when the person taps "Get ready", with progress and a time estimate for
  their connection. After that the face check works with no signal, and steps are queued until it returns.
- On 2G, data saver, or if the download fails, the photo step offers "Ask an officer to visit": the case goes
  to an officer with the reason. Nothing is approved or stopped automatically.
- Urdu voice: device voice when it has Urdu; otherwise Azure if configured; otherwise a free online Urdu voice
  (turn off with `FREE_TTS=off`); otherwise on-screen text.
- Area scam warning: pensioners and helpers see and hear which scam trick was reported in their area this week.

## Evaluation

`/evaluation` (admin presses Run) measures, on our own labelled data, with 95% error margins:

- **Scam checker:** 100 invented messages (`data/eval-messages.ts`): 55 scams, 45 genuine; English, Urdu script and
  Roman Urdu; 27 deliberately hard ones (real bank messages that mention OTPs, scams with no warning words).
  Shows catches, false alarms, results by language and difficulty, and every wrong answer. Only the latest run counts.
- **AI case assistant:** see above.
- Runs go a few items per request with a progress bar, to stay inside the hosting time limit and Groq's free rate limit.
  Test-set messages are kept off the Scam Map and the officer's message queue unless asked for.

## Demo accounts

All people are invented. The phone numbers are never contacted (SMS is simulated in-app).

| Role | Name | Phone | Password | PIN |
| --- | --- | --- | --- | --- |
| Pension officer (Karachi) | Sana Qureshi | 03214417832 | Sana@Pension24 | |
| Pension officer (Karachi) | Bilal Ahmed | 03332290615 | Bilal#Korangi7 | |
| Pension officer (Hyderabad) | Naveed Memon | 03003108847 | Naveed!Hyd52 | |
| Admin | Kamran Siddiqui | 03452876104 | Kamran$Admin9 | |
| Admin (second approver) | Hira Farooq | 03000000012 | Hira@Rules5 | |
| Auditor | Nadia Hussain | 03127739025 | Nadia&Audit3 | |
| Helper (Lyari) | Rubina Shaikh | 03012654398 | Rubina@Lyari8 | |
| Helper (Korangi) | Farhan Ali | 03349182746 | Farhan%Help6 | |
| Shopkeeper | Imran Baig | 03225501987 | Imran*Shop4 | |
| Shopkeeper | Saleem Jokhio | 03468820431 | Saleem+Mart2 | |
| Pensioner (widow) | Zainab Bibi | 03026619470 | Zainab786 | 4826 |
| Pensioner (widow) | Sakina Baloch | 03154407218 | Sakina4321 | 1357 |
| Pensioner (retired teacher) | Ghulam Rasool | 03317065529 | Rasool1949 | 1949 |

Pensioners normally log in without typing: pension book QR (print them from Officer → Pension books), then face, or the PIN.

## Messy data on purpose (Challenge 03)

The seed includes: spelling variants (Zainab / Zenab, Muhammad / Mohammad / Mohd), a pension record with a missing CNIC, the same widow registered twice under different spellings, a CNIC that differs between pension and NADRA records, a 104-year-old pensioner, and a pensioner with a death record whose bank account is still active.

## Run locally

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, QR_SIGNING_SECRET (+ AI keys if you have them)
npx prisma migrate deploy
npm run db:seed
npm run dev               # http://localhost:3000
npm test                  # unit tests
npm run test:smoke        # end-to-end checks against a running server
```

## Deploy (Vercel + Supabase)

1. Create a Supabase project. Copy the **pooled** connection string (port 6543) as `DATABASE_URL` (add `?pgbouncer=true&connection_limit=1`) and the **direct** one (port 5432) as `DIRECT_URL`.
2. Import the GitHub repo in Vercel and set these environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `QR_SIGNING_SECRET` (each secret: 32+ random characters), `GROQ_API_KEY` (free; powers speech-to-text and, when there is no Anthropic key, the text AI too), optionally `ANTHROPIC_API_KEY`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`.
3. Deploy. The build runs migrations and seeds the demo data automatically (the seed skips itself if data already exists).

## Known limits (said honestly)

- Liveness stops a printed photo but not a skilled video replay; low scores go to an officer.
- Face thresholds are starting values; we measure them on our test faces and show the results on `/evaluation`.
- The face check needs about 20 MB of files once; on 2G that is slow, so the app offers a home visit instead.
- Small test sets mean wide error margins on the evaluation page.
