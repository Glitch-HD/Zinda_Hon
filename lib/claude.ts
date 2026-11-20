import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// All Claude calls in one place. Every answer is forced into a fixed schema (structured outputs)
// and validated. If Claude is unavailable, refuses, or returns something invalid, callers get null
// and fall back to the safe path (send to a human) instead of guessing.

export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ timeout: 45_000, maxRetries: 2 });
  return client;
}

// Free fallback: when there is no Anthropic key, the same calls go to an open model on Groq
// (OpenAI-compatible API, JSON mode). The answer is checked against the same schema.
export const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";

export function claudeAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** True when any text AI (Claude, or the free Groq fallback) is configured. */
export function textAiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY);
}

type Structured<T> = { data: T; ms: number; usage: { input: number; output: number }; model: string };

async function structured<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 4000): Promise<Structured<z.infer<T>> | null> {
  const c = getClient();
  if (!c) return process.env.GROQ_API_KEY ? structuredGroq(schema, system, user, maxTokens) : null;
  const started = Date.now();
  try {
    const res = await c.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    const checked = schema.safeParse(res.parsed_output);
    if (!checked.success) return null;
    return { data: checked.data, ms: Date.now() - started, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens }, model: CLAUDE_MODEL };
  } catch (err) {
    console.error("[claude] call failed", err);
    return null;
  }
}

// Models to try on Groq, in order. Groq retires models from time to time, so if one is gone
// (or busy) the next is tried. GROQ_TEXT_MODEL, if set, is tried first.
export const GROQ_MODELS = [...new Set([GROQ_TEXT_MODEL, "llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"])];

/** The last Groq problem, for the admin "AI check" page. Never contains the key. */
export let lastAiError: string | null = null;

export type JsonSchema = { type?: string; properties?: Record<string, JsonSchema>; items?: JsonSchema; maxLength?: number; maxItems?: number; minimum?: number; maximum?: number; enum?: unknown[] };

/** Small models sometimes write a sentence too long or a number out of range. Trim and clamp to the
 *  schema before validating, instead of throwing a good answer away. Wrong labels are NOT fixed here. */
export function fitToSchema(v: unknown, js: JsonSchema): unknown {
  if (js.type === "object" && v && typeof v === "object" && js.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, sub] of Object.entries(js.properties)) if (k in (v as object)) out[k] = fitToSchema((v as Record<string, unknown>)[k], sub);
    return out;
  }
  if (js.type === "array" && Array.isArray(v)) return (js.maxItems ? v.slice(0, js.maxItems) : v).map((x) => (js.items ? fitToSchema(x, js.items) : x));
  if (js.type === "string" && typeof v === "string" && js.maxLength && v.length > js.maxLength) return v.slice(0, js.maxLength - 1) + "…";
  if (js.type === "string" && js.enum && typeof v === "string" && !js.enum.includes(v) && js.enum.includes("other")) return "other";
  if (js.type === "number" && typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) v = Number(v);
  if (js.type === "number" && typeof v === "number") {
    if (v > 1 && js.maximum === 1 && v <= 100) v = v / 100; // "85" meaning 85%
    if (js.minimum !== undefined) v = Math.max(js.minimum, v as number);
    if (js.maximum !== undefined) v = Math.min(js.maximum, v as number);
  }
  if (js.type === "boolean" && (v === "true" || v === "false")) return v === "true";
  return v;
}

export function parseJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
}

async function structuredGroq<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens: number): Promise<Structured<z.infer<T>> | null> {
  const started = Date.now();
  const js = z.toJSONSchema(schema) as JsonSchema;
  const problems: string[] = [];
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch(`${process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1"}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${system}\n\nReply with ONE JSON object only, matching this JSON Schema exactly (no extra keys, keep within the max lengths):\n${JSON.stringify(js)}` },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        problems.push(`${model}: HTTP ${res.status} ${text}`);
        console.error("[groq-text]", model, "HTTP", res.status, text);
        if (res.status === 401 || res.status === 403) break; // bad key: other models will fail the same way
        continue;
      }
      const body = await res.json();
      const raw = body?.choices?.[0]?.message?.content;
      if (typeof raw !== "string") { problems.push(`${model}: empty reply`); continue; }
      const checked = schema.safeParse(fitToSchema(parseJson(raw), js));
      if (!checked.success) {
        problems.push(`${model}: answer did not fit the format (${checked.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")})`);
        console.error("[groq-text]", model, "schema mismatch", checked.error.issues.slice(0, 3));
        continue;
      }
      lastAiError = null;
      return { data: checked.data, ms: Date.now() - started, usage: { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0 }, model: `groq/${model}` };
    } catch (err) {
      problems.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
      console.error("[groq-text]", model, "call failed", err);
    }
  }
  lastAiError = problems.join(" | ").slice(0, 1500);
  return null;
}

// ---------- Scam message checker (classification + routing) ----------

export const ScamResult = z.object({
  label: z.enum(["scam", "genuine", "unsure"]),
  confidence: z.number().min(0).max(1),
  scam_type: z.enum(["fake_relief_payment", "fake_pension_update", "otp_or_pin_request", "prize_or_lottery", "impersonation", "other", "none"]),
  red_flags: z.array(z.string()).max(8),
  explanation_en: z.string().max(400),
  explanation_ur: z.string().max(400),
});
export type ScamResult = z.infer<typeof ScamResult>;

const SCAM_SYSTEM = `You check SMS and WhatsApp messages received by elderly pensioners and shopkeepers in Pakistan for scams.
This is a prototype; all programs mentioned are simulated. Facts about our (mock) pension program:
- The pension office NEVER asks for a PIN, OTP, password or CNIC photo by SMS or WhatsApp.
- Pension is paid automatically to the pensioner's own bank account; there is no "release fee".
- Official messages come only from the short code 8XXX (mock) and never contain links other than the official Zinda Hon website.
- Yearly proof-of-life is done in the Zinda Hon app or at the pension office, never by calling a number in a message.
Messages may be in Urdu script, Roman Urdu or English.
Label "scam" only with clear signs; label "genuine" only if it fits the facts above; otherwise "unsure".
Be calibrated: confidence is your probability that the label is right. Blocking a real message also harms people.
Write explanation_ur in simple Urdu script a person with little schooling understands, one or two short sentences.`;

export async function classifyMessage(text: string, sender: string | null, context: { pendingPayment: boolean | null }) {
  const user = `Sender: ${sender ?? "unknown"}
Our mock pension system says a payment for this person is currently pending: ${context.pendingPayment === null ? "unknown (no pensioner linked)" : context.pendingPayment ? "yes" : "no"}
Message:
"""${text.slice(0, 2000)}"""`;
  return structured(ScamResult, SCAM_SYSTEM, user, 2000);
}

// ---------- Plain-language explanation of a decision ----------

export const Explanation = z.object({
  reason_ur: z.string().max(300),
  reason_en: z.string().max(300),
  next_step_ur: z.string().max(200),
});

export async function explainDecision(trace: unknown) {
  const system = `You explain a pension proof-of-life decision to an elderly Pakistani pensioner who may not read well.
Use only the facts in the trace. Never invent rules, amounts or dates. Never say the pension is stopped unless an officer stopped it.
reason_ur: one or two very short sentences in simple Urdu script, suitable to be read aloud. reason_en: the same in plain English.
next_step_ur: what the person should do next, in one short Urdu sentence.`;
  return structured(Explanation, system, `Decision trace (JSON):\n${JSON.stringify(trace).slice(0, 12000)}`, 1500);
}

// ---------- Answers from the official (mock) rulebook, with sources ----------

export const RuleAnswer = z.object({
  answer_ur: z.string().max(600),
  answer_en: z.string().max(600),
  cited_sections: z.array(z.string()).max(5),
  answerable: z.boolean(),
});

export async function answerFromRulebook(question: string, sections: { id: string; title: string; text: string }[]) {
  const system = `Answer a pensioner's question ONLY from the rulebook sections given. Cite the section ids you used.
If the sections do not contain the answer, set answerable=false and say in Urdu that a pension officer will help; do not guess.
Write answer_ur in simple Urdu script.`;
  const user = `Question: ${question.slice(0, 500)}\n\nRulebook sections:\n${sections.map((s) => `[${s.id}] ${s.title}\n${s.text}`).join("\n\n")}`;
  return structured(RuleAnswer, system, user, 2000);
}
