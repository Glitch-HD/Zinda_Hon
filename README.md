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
| Audit log of every user, AI and agent action | `lib/audit.ts`, viewable at `/auditor` |
| Consent: see, share, withdraw, correct | `/consent`, `lib/consent.ts` (checked live on every request) |
| Mock identity, payment and data services | `/api/v1/mock/*`, seeded in `prisma/seed.ts` |
| Platform extras: rule editor, officer queue (priority + confidence), offline mode, multi-tenant, rate limiting | `/admin`, `/officer`, `public/sw.js` + `lib/client/queue.ts`, `tenantId` on every record, `lib/ratelimit.ts` |
| AI: computer vision, voice, classification + routing, structured outputs, explainability, guardrails, anomaly detection, RAG, evaluation | `lib/client/face.ts`, `lib/client/voice.ts`, `lib/claude.ts`, `lib/decision.ts`, `/ask`, `/evaluation` |
| Bonus: Helper Mode, Offline-First Sync, Digital Twin, Scam Map | `/helper`, `lib/client/queue.ts`, `/admin` → "Test on past cases first", `/scam-map` |
| Database with migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Monitoring, logs, tests | `/api/health`, Vercel logs, `npm test` (unit), `npm run test:smoke` (end-to-end) |

## Demo accounts

All people are invented. The phone numbers are never contacted (SMS is simulated in-app).

| Role | Name | Phone | Password | PIN |
| --- | --- | --- | --- | --- |
| Pension officer (Karachi) | Sana Qureshi | 03214417832 | Sana@Pension24 | |
| Pension officer (Karachi) | Bilal Ahmed | 03332290615 | Bilal#Korangi7 | |
| Pension officer (Hyderabad) | Naveed Memon | 03003108847 | Naveed!Hyd52 | |
| Admin | Kamran Siddiqui | 03452876104 | Kamran$Admin9 | |
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
- The face check downloads about 10 MB of models once; after that they are saved on the phone.
- Small test sets mean wide error margins on the evaluation page.
