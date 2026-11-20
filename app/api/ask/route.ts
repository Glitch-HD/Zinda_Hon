import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { answerFromRulebook, CLAUDE_MODEL } from "@/lib/claude";
import { searchRulebook, RULEBOOK } from "@/data/rulebook";
import { audit } from "@/lib/audit";

// RAG: answer from the (mock) official rulebook only, and show which sections were used.
const Body = z.object({ question: z.string().min(3).max(500) });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`ask:${user.id}`, 20, 60);
  const { question } = Body.parse(await req.json());
  const sections = searchRulebook(question, 4);
  const ai = await answerFromRulebook(question, sections);
  await audit({ tenantId: user.tenantId, actorType: "AI", actorId: ai ? CLAUDE_MODEL : "none", action: "rulebook_answer", details: { sections: sections.map((s) => s.id), answerable: ai?.data.answerable ?? false } });
  if (!ai || !ai.data.answerable) {
    return NextResponse.json({ answerUr: "اس سوال کا جواب قواعد میں نہیں ملا۔ پنشن افسر آپ کی مدد کرے گا۔", answerEn: "The rulebook does not answer this. A pension officer will help you.", sources: [] });
  }
  const cited = RULEBOOK.filter((s) => ai.data.cited_sections.includes(s.id));
  return NextResponse.json({ answerUr: ai.data.answer_ur, answerEn: ai.data.answer_en, sources: cited.map((s) => ({ id: s.id, title: s.title, text: s.text })) });
});
