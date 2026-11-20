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

export function claudeAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function structured<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 4000): Promise<{ data: z.infer<T>; ms: number; usage: { input: number; output: number } } | null> {
  const c = getClient();
  if (!c) return null;
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
    return { data: checked.data, ms: Date.now() - started, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
  } catch (err) {
    console.error("[claude] call failed", err);
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
