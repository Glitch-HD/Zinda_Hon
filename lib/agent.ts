import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "./db";
import { audit } from "./audit";
import { lookupIdentity } from "./case-service";
import { getActiveRule } from "./rules";
import { nameSimilarity, normalizeCnic } from "./names";
import { searchRulebook } from "@/data/rulebook";
import { CLAUDE_MODEL, GROQ_MODELS, getClient, parseJson, fitToSchema, type JsonSchema } from "./claude";
import type { SessionUser } from "./auth";
import {
  AGENT_TOOLS, REQUIRED_TOOLS, AgentReport, NO_FACTS, applyGuardrails, checklistReport,
  type AgentToolName, type CaseFacts, type GuardrailNote,
} from "./agent-guardrails";

// The officer's AI case assistant: an agent that plans its own investigation of ONE proof-of-life case
// by calling read-only tools over our records and the mock NADRA, bank and death-registry services,
// then hands in a report. It can never approve, stop or change anything; the officer decides.
// Every step is written to the audit log as an AGENT action.
//
// Privacy: the model sees only what it needs. CNICs and account numbers are masked to the last
// 4 digits, and face data is never sent (only "matched / not matched").

const MAX_TOOL_CALLS = 10;
const TIME_BUDGET_MS = 50_000;

export type AgentStep = {
  n: number;
  tool: AgentToolName | "submit_report";
  args: Record<string, unknown>;
  summary: string;
  data?: unknown;
  error?: string;
  thought?: string;
  ms: number;
};
export type AgentEvent =
  | { type: "start"; runId: string; mode: "ai" | "checklist"; model: string | null }
  | { type: "step"; step: AgentStep }
  | { type: "note"; text: string }
  | { type: "report"; report: AgentReport; guardrails: GuardrailNote[]; mode: "ai" | "checklist"; model: string | null; ms: number; runId: string };

const mask = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `•••••${d.slice(-4)}` : v ? "••••" : null;
};
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

// ---------------- The tools (read-only, scoped to the one case being investigated) ----------------

type Ctx = { caseId: string; tenantId: string; facts: CaseFacts; identity?: Awaited<ReturnType<typeof lookupIdentity>> };
type ToolOut = { summary: string; data: unknown };

const TOOL_INFO: Record<AgentToolName, { description: string; params: z.ZodObject<z.ZodRawShape> }> = {
  case_overview: { description: "Start here. The case, the pensioner (masked), this year's proof-of-life evidence (face, liveness, pension book QR), the latest automatic decision and its checks, and the officer's notes.", params: z.object({}) },
  check_nadra: { description: "Look up the pensioner in the mock NADRA identity service: name, husband/father name, date of birth, marital status, and how well they agree with the pension record.", params: z.object({}) },
  check_death_registry: { description: "Check the mock death registry for this person's CNIC.", params: z.object({}) },
  check_bank_activity: { description: "Read the mock bank account: last activity, withdrawals in the last 90 days, account holder name, and whether money moved after any recorded death.", params: z.object({}) },
  find_possible_duplicates: { description: "Find other pension records in this office that look like the same person (same CNIC, or same birth date and a very similar name).", params: z.object({}) },
  past_years: { description: "This pensioner's proof-of-life history in earlier years: outcomes and whether an officer had to step in.", params: z.object({}) },
  search_rulebook: { description: "Search the official (mock) pension rulebook. Returns the matching sections with their ids (R1, R2, ...).", params: z.object({ question: z.string().min(2).max(200) }) },
};

async function identity(ctx: Ctx) {
  if (!ctx.identity) {
    const c = await prisma.case.findUniqueOrThrow({ where: { id: ctx.caseId } });
    ctx.identity = await lookupIdentity(c.pensionerId);
  }
  return ctx.identity;
}

const TOOLS: Record<AgentToolName, (ctx: Ctx, args: Record<string, unknown>) => Promise<ToolOut>> = {
  async case_overview(ctx) {
    const c = await prisma.case.findUniqueOrThrow({
      where: { id: ctx.caseId },
      include: { pensioner: true, decisions: { orderBy: { createdAt: "desc" }, take: 3, include: { ruleVersion: { select: { version: true } } } }, evidence: { orderBy: { createdAt: "desc" } } },
    });
    const rule = await getActiveRule(ctx.tenantId);
    const latest = (type: string) => c.evidence.find((e) => e.type === type);
    const count = (type: string) => c.evidence.filter((e) => e.type === type).length;
    const face = latest("face_match");
    const live = latest("liveness");
    const doc = latest("document");
    const docD = (doc?.details ?? {}) as { qrValid?: boolean | null; fieldsMatch?: boolean | null };
    const ai = c.decisions.find((d) => d.decidedBy === "ai");
    const trace = (ai?.auditTrace ?? {}) as { checks?: { check: string; status: string; detail: string }[]; redFlags?: string[] };
    const p = c.pensioner;
    const age = p.dateOfBirth ? new Date().getFullYear() - p.dateOfBirth.getFullYear() : null;

    ctx.facts.faceMismatch = Boolean(face && face.score !== null && face.score > rule.config.face.looseDistance);
    ctx.facts.livenessFailed = Boolean(live && live.passed === false);
    ctx.facts.documentInvalid = Boolean(doc && (docD.qrValid === false || docD.fieldsMatch === false));
    ctx.facts.overMaxAge = age !== null && age > rule.config.anomaly.maxAgeYears;
    ctx.facts.proofMissing = !face || !live;

    const evidence = {
      face: face ? { matched: !ctx.facts.faceMismatch, strong: face.score !== null && face.score <= rule.config.face.strictDistance, attempts: count("face_match") } : "not given yet",
      liveness: live ? { passed: Boolean(live.passed), attempts: count("liveness") } : "not given yet",
      pension_book_qr: doc ? { signature_valid: docD.qrValid ?? null, details_match: docD.fieldsMatch ?? null, attempts: count("document") } : "not scanned yet",
    };
    const data = {
      case: { year: c.year, status: c.status, priority: c.priority, risk_flags: c.riskFlags, officer_notes: c.officerNotes ?? null },
      pensioner: { name: p.name, pension_no: p.pensionNo, type: p.pensionType === "family" ? "family (widow) pension" : "own pension", age, area: p.area, monthly_amount_rs: p.monthlyAmount, cnic: mask(p.cnicMock), status: p.status },
      evidence,
      latest_automatic_decision: ai ? { outcome: ai.outcome, confidence: ai.confidence, rule_version: ai.ruleVersion.version, red_flags: trace.redFlags ?? [], checks: (trace.checks ?? []).map((x) => `${x.check}: ${x.status} (${x.detail})`) } : "none yet",
      rule_now: { version: rule.version, auto_approve_needs_confidence: Math.round((1 - rule.config.costs.humanReviewPkr / rule.config.costs.wrongApprovalPkr) * 10000) / 10000, flag_age_over: rule.config.anomaly.maxAgeYears },
    };
    const parts = [`${p.name}, ${age ?? "?"} y, ${c.year} case ${c.status.toLowerCase().replaceAll("_", " ")}`];
    parts.push(face ? (ctx.facts.faceMismatch ? "face does NOT match" : "face matches") : "no selfie yet");
    if (doc) parts.push(ctx.facts.documentInvalid ? "pension book QR FAILED" : "pension book QR valid");
    if (live) parts.push(live.passed ? "liveness passed" : "liveness FAILED");
    return { summary: parts.join(" · "), data };
  },

  async check_nadra(ctx) {
    const id = await identity(ctx);
    ctx.facts.cnicMismatch = id.cnicMatch === false;
    ctx.facts.identityUnconfirmed = !id.nadra;
    if (!id.nadra) return { summary: "No NADRA record could be matched (searched by CNIC, then by birth date + similar name).", data: { found: false, matched_by: id.matchedBy } };
    const data = {
      found: true,
      matched_by: id.matchedBy.replaceAll("_", " "),
      nadra_name: id.nadra.name,
      pension_record_name: id.pensioner.name,
      name_similarity: Math.round(id.nameSimilarity * 100) / 100,
      husband_or_father_nadra: id.nadra.fatherOrHusbandName,
      husband_or_father_pension_record: id.pensioner.fatherOrHusbandName,
      husband_or_father_similarity: id.spouseSimilarity === null ? null : Math.round(id.spouseSimilarity * 100) / 100,
      cnic_agrees: id.cnicMatch,
      date_of_birth_agrees: id.dobMatch,
      marital_status: id.nadra.maritalStatus,
    };
    return { summary: `Found by ${data.matched_by}: "${id.nadra.name}" · name ${Math.round(id.nameSimilarity * 100)}% similar · CNIC ${id.cnicMatch === null ? "unknown" : id.cnicMatch ? "agrees" : "DIFFERS"} · birth date ${id.dobMatch === null ? "unknown" : id.dobMatch ? "agrees" : "DIFFERS"}`, data };
  },

  async check_death_registry(ctx) {
    const id = await identity(ctx);
    ctx.facts.deathRecord = Boolean(id.death);
    if (!id.death) return { summary: "No death record for this CNIC.", data: { found: false, searched_cnic: mask(id.pensioner.cnicMock ?? id.nadra?.cnic) } };
    return { summary: `DEATH RECORD FOUND: ${day(id.death.dateOfDeath)}, ${id.death.registeredAt}.`, data: { found: true, name_on_record: id.death.name, date_of_death: day(id.death.dateOfDeath), registered_at: id.death.registeredAt } };
  },

  async check_bank_activity(ctx) {
    const id = await identity(ctx);
    if (!id.bank) return { summary: "No bank account on file, or the account was not found.", data: { found: false } };
    const afterDeath = Boolean(id.death && id.bank.lastActivity && id.bank.lastActivity > id.death.dateOfDeath);
    ctx.facts.bankActivityAfterDeath = afterDeath;
    const holderSim = Math.round(nameSimilarity(id.bank.holderName, id.pensioner.name) * 100) / 100;
    const data = { found: true, account: mask(id.bank.accountNo), holder_name: id.bank.holderName, holder_name_similarity: holderSim, last_activity: day(id.bank.lastActivity), withdrawals_last_90_days: id.bank.withdrawalsLast90Days, activity_after_recorded_death: afterDeath };
    return { summary: `Last used ${data.last_activity ?? "unknown"} · ${id.bank.withdrawalsLast90Days} withdrawal(s) in 90 days${afterDeath ? " · USED AFTER RECORDED DEATH" : ""}`, data };
  },

  async find_possible_duplicates(ctx) {
    const id = await identity(ctx);
    ctx.facts.duplicates = id.duplicates.length;
    if (!id.duplicates.length) return { summary: "No other pension record looks like this person.", data: { duplicates: [] } };
    const rows = await prisma.pensioner.findMany({ where: { id: { in: id.duplicates.map((d) => d.id) } } });
    const myCnic = normalizeCnic(id.pensioner.cnicMock);
    const data = {
      duplicates: rows.map((o) => ({
        pension_no: o.pensionNo, name: o.name, status: o.status, area: o.area,
        same_cnic: Boolean(myCnic && normalizeCnic(o.cnicMock) === myCnic),
        same_birth_date: day(o.dateOfBirth) === day(id.pensioner.dateOfBirth),
        name_similarity: Math.round(nameSimilarity(o.name, id.pensioner.name) * 100) / 100,
        same_bank_account: Boolean(o.bankAccountNo && o.bankAccountNo === id.pensioner.bankAccountNo),
      })),
    };
    return { summary: `${rows.length} possible duplicate(s): ${rows.map((o) => `${o.pensionNo} ${o.name}`).join(", ")}`, data };
  },

  async past_years(ctx) {
    const c = await prisma.case.findUniqueOrThrow({ where: { id: ctx.caseId } });
    const past = await prisma.case.findMany({ where: { pensionerId: c.pensionerId, year: { lt: c.year } }, orderBy: { year: "desc" }, include: { decisions: { orderBy: { createdAt: "asc" } } } });
    if (!past.length) return { summary: "No earlier years on record.", data: { years: [] } };
    const years = past.map((p) => ({
      year: p.year,
      final_status: p.status,
      automatic_outcome: p.decisions.find((d) => d.decidedBy === "ai")?.outcome ?? null,
      officer_stepped_in: p.decisions.some((d) => d.decidedBy !== "ai"),
    }));
    return { summary: years.map((y) => `${y.year}: ${y.final_status.toLowerCase()}${y.officer_stepped_in ? " (officer checked)" : " (automatic)"}`).join(" · "), data: { years } };
  },

  async search_rulebook(_ctx, args) {
    const q = String(args.question ?? "");
    const hits = searchRulebook(q, 3);
    return { summary: `${hits.map((h) => `${h.id} ${h.title}`).join(" · ")}`, data: { sections: hits } };
  },
};

// ---------------- Talking to the model (Groq or Claude), with tool calling ----------------

type Call = { id: string; name: string; args: Record<string, unknown> };
type Turn = { text: string; calls: Call[] };
interface Provider {
  model: string;
  next(): Promise<Turn>;
  answer(results: { id: string; name: string; content: string; isError?: boolean }[]): void;
  nudge(text: string): void;
}

const SYSTEM = `You are the case assistant for a pension officer at a MOCK pension office in Pakistan (a prototype; all people and records are invented).
Your job: investigate ONE yearly proof-of-life case for a pensioner (often an elderly widow) and hand the officer a short, honest report, so they can decide faster and more safely.

How to work:
- You can only READ records through the tools. You cannot approve, stop or change anything. The officer decides.
- Start with case_overview. Then check what matters: check_nadra, check_death_registry and check_bank_activity are always needed; find_possible_duplicates and past_years when identity or history could matter; search_rulebook when a rule decides the question.
- Call each tool at most once. Before a tool call, you may say one short sentence about why.
- Finish by calling submit_report exactly once.

Rules for the report:
- Every finding must come from a tool result, and its "source" must name that tool. Never invent a fact, number or date.
- A wrong approval (paying someone who has died) costs far more than a slow one. If anything serious is unresolved, recommend "officer_review" or "ask_more_proof", never "approve".
- "investigate_stop" only when the death registry or bank evidence strongly suggests the person has died; the officer must still verify in person.
- "approve" only when identity, liveness, the pension book and all records agree and nothing serious was found.
- confidence = your probability that the recommendation is right.
- headline: one sentence. summary_en: 2 to 4 short sentences. summary_ur: the same in simple Urdu script.
- questions_for_officer: what the officer should ask or check next (can be empty). rules_cited: rulebook ids like "R4" you relied on.`;

const REPORT_TOOL_DESC = "Hand in your final report to the officer. Call this exactly once, after the checks.";

function toolSchemas() {
  const clean = (s: unknown) => { const { $schema: _drop, ...rest } = s as Record<string, unknown>; return rest; };
  const tools = AGENT_TOOLS.map((name) => ({ name, description: TOOL_INFO[name].description, schema: clean(z.toJSONSchema(TOOL_INFO[name].params)) }));
  tools.push({ name: "submit_report" as AgentToolName, description: REPORT_TOOL_DESC, schema: clean(z.toJSONSchema(AgentReport)) });
  return tools;
}

function groqProvider(firstUser: string, deadline: number): Provider {
  const tools = toolSchemas().map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.schema } }));
  const messages: Record<string, unknown>[] = [{ role: "system", content: SYSTEM }, { role: "user", content: firstUser }];
  const models = [...GROQ_MODELS];
  let chosen: string | null = null;
  return {
    get model() { return `groq/${chosen ?? models[0]}`; },
    async next() {
      // Keep the model that worked; if it stumbles (busy, or a malformed tool call), the others can
      // carry on the same conversation, since they all speak the same format.
      const tryModels = chosen ? [chosen, ...models.filter((m) => m !== chosen)] : models;
      let lastErr = "";
      for (const model of tryModels) {
        const left = deadline - Date.now();
        if (left < 3000) { lastErr ||= "out of time"; break; }
        const res = await fetch(`${process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1"}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
          signal: AbortSignal.timeout(Math.min(25_000, left)),
          body: JSON.stringify({ model, messages, tools, tool_choice: "auto", parallel_tool_calls: false, temperature: 0.1, max_tokens: 2500 }),
        });
        if (!res.ok) {
          lastErr = `${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
          console.error("[agent] groq", lastErr);
          if (res.status === 401 || res.status === 403) break;
          continue;
        }
        chosen = model;
        const body = await res.json();
        const msg = body?.choices?.[0]?.message ?? {};
        messages.push({ role: "assistant", content: msg.content ?? "", ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) });
        const calls: Call[] = (msg.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => {
          let args: Record<string, unknown> = {};
          try { args = (parseJson(tc.function.arguments || "{}") as Record<string, unknown>) ?? {}; } catch { args = { __bad_json: tc.function.arguments }; }
          return { id: tc.id, name: tc.function.name, args };
        });
        return { text: typeof msg.content === "string" ? msg.content : "", calls };
      }
      throw new Error(lastErr || "Groq did not answer");
    },
    answer(results) {
      for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
    },
    nudge(text) { messages.push({ role: "user", content: text }); },
  };
}

function claudeProvider(client: Anthropic, firstUser: string, deadline: number): Provider {
  const tools: Anthropic.Tool[] = toolSchemas().map((t) => ({ name: t.name, description: t.description, input_schema: t.schema as Anthropic.Tool.InputSchema }));
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: firstUser }];
  return {
    model: CLAUDE_MODEL,
    async next() {
      const res = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 16000, system: SYSTEM, tools, tool_choice: { type: "auto" }, output_config: { effort: "low" }, messages }, { timeout: Math.max(5_000, deadline - Date.now()), maxRetries: 1 });
      if (res.stop_reason === "refusal") throw new Error("Claude declined this request");
      messages.push({ role: "assistant", content: res.content });
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ");
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
      return { text, calls };
    },
    answer(results) {
      messages.push({ role: "user", content: results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content, is_error: r.isError || undefined })) });
    },
    nudge(text) { messages.push({ role: "user", content: text }); },
  };
}

// ---------------- The run ----------------

export async function runCaseAgent(caseId: string, user: SessionUser, emit: (e: AgentEvent) => void) {
  const started = Date.now();
  const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: { pensioner: { select: { name: true, pensionNo: true } } } });
  const claude = getClient();
  const mode: "ai" | "checklist" = claude || process.env.GROQ_API_KEY ? "ai" : "checklist";
  const firstUser = `Investigate the ${c.year} proof-of-life case of ${c.pensioner.name} (${c.pensioner.pensionNo}). The officer asked for a report.`;
  const provider: Provider | null = mode === "ai" ? (claude ? claudeProvider(claude, firstUser, started + TIME_BUDGET_MS) : groqProvider(firstUser, started + TIME_BUDGET_MS)) : null;

  const run = await prisma.agentRun.create({ data: { tenantId: user.tenantId, caseId, startedById: user.id, mode, model: provider?.model ?? null } });
  const ctx: Ctx = { caseId, tenantId: user.tenantId, facts: { ...NO_FACTS } };
  const steps: AgentStep[] = [];
  const called = new Set<string>();
  const actorId = () => `case-assistant/${provider?.model ?? "checklist"}`;
  emit({ type: "start", runId: run.id, mode, model: provider?.model ?? null });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "agent_investigation_requested", targetType: "case", targetId: caseId, details: { runId: run.id } });

  async function runTool(name: AgentToolName, args: Record<string, unknown>, thought?: string): Promise<{ content: string; isError: boolean }> {
    const t0 = Date.now();
    const parsed = TOOL_INFO[name].params.safeParse(args);
    let step: AgentStep;
    if (!parsed.success) {
      step = { n: steps.length + 1, tool: name, args, summary: "Bad tool input", error: parsed.error.issues.map((i) => i.message).join("; "), thought, ms: Date.now() - t0 };
    } else {
      try {
        const out = await TOOLS[name](ctx, parsed.data);
        called.add(name);
        step = { n: steps.length + 1, tool: name, args: parsed.data, summary: out.summary, data: out.data, thought, ms: Date.now() - t0 };
      } catch (err) {
        step = { n: steps.length + 1, tool: name, args, summary: "This check failed", error: err instanceof Error ? err.message : String(err), thought, ms: Date.now() - t0 };
      }
    }
    steps.push(step);
    emit({ type: "step", step });
    await audit({ tenantId: user.tenantId, actorType: "AGENT", actorId: actorId(), action: `agent_tool_${name}`, targetType: "case", targetId: caseId, details: { runId: run.id, step: step.n, args: step.args as object, result: step.summary, error: step.error ?? null } });
    return step.error ? { content: JSON.stringify({ error: step.error }), isError: true } : { content: JSON.stringify(step.data), isError: false };
  }

  let report: AgentReport | null = null;
  let fallbackReason: string | null = mode === "checklist" ? "No AI key is set on this deployment, so a fixed checklist ran instead of the AI assistant." : null;

  if (provider) {
    let toolCalls = 0;
    let nudged = 0;
    try {
      while (!report) {
        if (Date.now() - started > TIME_BUDGET_MS) { fallbackReason = "The AI assistant ran out of time, so the fixed checklist finished the job."; break; }
        if (toolCalls >= MAX_TOOL_CALLS) { fallbackReason = "The AI assistant used its step limit without a report, so the fixed checklist finished the job."; break; }
        const turn = await provider.next();
        if (!turn.calls.length) {
          if (nudged++ >= 2) { fallbackReason = "The AI assistant stopped without a report, so the fixed checklist finished the job."; break; }
          provider.nudge("Continue: call the next check, or call submit_report if you have checked enough.");
          continue;
        }
        const results: { id: string; name: string; content: string; isError?: boolean }[] = [];
        const thought = turn.text.trim().slice(0, 300) || undefined;
        for (const call of turn.calls) {
          toolCalls++;
          if (call.name === "submit_report") {
            const missing = REQUIRED_TOOLS.filter((t) => !called.has(t));
            if (missing.length) {
              results.push({ id: call.id, name: call.name, content: JSON.stringify({ error: `Not yet. First call: ${missing.join(", ")}.` }), isError: true });
              emit({ type: "note", text: `Report sent back: the assistant must first run ${missing.join(", ").replaceAll("_", " ")}.` });
              continue;
            }
            const js = z.toJSONSchema(AgentReport) as JsonSchema;
            const checked = AgentReport.safeParse(fitToSchema(call.args, js));
            if (!checked.success) {
              results.push({ id: call.id, name: call.name, content: JSON.stringify({ error: "Report did not fit the format", issues: checked.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`) }), isError: true });
              continue;
            }
            report = checked.data;
            break;
          }
          if (!(AGENT_TOOLS as readonly string[]).includes(call.name)) {
            results.push({ id: call.id, name: call.name, content: JSON.stringify({ error: `Unknown tool ${call.name}` }), isError: true });
            continue;
          }
          if (called.has(call.name) && call.name !== "search_rulebook") {
            results.push({ id: call.id, name: call.name, content: JSON.stringify({ note: "Already checked; use the earlier result." }) });
            continue;
          }
          const r = await runTool(call.name as AgentToolName, call.args, results.length === 0 ? thought : undefined);
          results.push({ id: call.id, name: call.name, ...r });
        }
        if (!report) provider.answer(results);
      }
    } catch (err) {
      console.error("[agent] model failed", err);
      fallbackReason = "The AI service did not answer, so the fixed checklist finished the job.";
    }
  }

  let finalMode: "ai" | "checklist" = mode;
  if (!report) {
    // Finish deterministically: run every check that has not run yet, then build the report by fixed rules.
    if (fallbackReason) emit({ type: "note", text: fallbackReason });
    for (const t of ["case_overview", "check_nadra", "check_death_registry", "check_bank_activity", "find_possible_duplicates", "past_years"] as AgentToolName[]) {
      if (!called.has(t)) await runTool(t, {});
    }
    report = checklistReport(ctx.facts, called, fallbackReason ?? "");
    finalMode = "checklist";
  }

  const { report: safe, notes } = applyGuardrails(report, ctx.facts, called);
  const ms = Date.now() - started;
  const model = finalMode === "ai" ? provider?.model ?? null : provider ? `${provider.model} → checklist` : null;
  await prisma.agentRun.update({ where: { id: run.id }, data: { status: "done", steps: steps as object[], report: { ...safe, guardrails: notes, fallbackReason } as object, ms, mode: finalMode, model } });
  await audit({
    tenantId: user.tenantId, actorType: "AGENT", actorId: actorId(), action: "agent_report_submitted", targetType: "case", targetId: caseId,
    details: { runId: run.id, mode: finalMode, recommendation: safe.recommendation, confidence: safe.confidence, toolsUsed: [...called], guardrails: notes.map((n) => n.rule), ms },
  });
  emit({ type: "report", report: safe, guardrails: notes, mode: finalMode, model, ms, runId: run.id });
}
