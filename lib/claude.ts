import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// All Claude calls in one place. Every answer is forced into a fixed schema (structured outputs)
// and validated. If Claude is unavailable, refuses, or returns something invalid, callers get null
// and fall back to the safe path (send to a human) instead of guessing.

export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ timeout: 45_000, maxRetries: 2 });
  return client;
}

// Free fallback: when there is no Anthropic key, the same calls go to an open model on Groq
// (OpenAI-compatible API, JSON mode). The answer is checked against the same schema.
export const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";

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

async function structuredGroq<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens: number): Promise<Structured<z.infer<T>> | null> {
  const started = Date.now();
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\n\nReply with ONE JSON object only, matching this JSON Schema exactly (no extra keys, respect max lengths):\n${jsonSchema}` },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[groq-text] HTTP", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const body = await res.json();
    const raw = body?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;
    const checked = schema.safeParse(JSON.parse(raw));
    if (!checked.success) {
      console.error("[groq-text] schema mismatch", checked.error.issues.slice(0, 3));
      return null;
    }
    return { data: checked.data, ms: Date.now() - started, usage: { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0 }, model: `groq/${GROQ_TEXT_MODEL}` };
  } catch (err) {
    console.error("[groq-text] call failed", err);
    return null;
  }
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
