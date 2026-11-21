import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { answerFromRulebook } from "@/lib/claude";
import { searchRulebook, RULEBOOK } from "@/data/rulebook";
import { audit } from "@/lib/audit";

// RAG: answer from the (mock) official rulebook only, and show which sections were used.
const Body = z.object({ question: z.string().min(3).max(500) });

export const POST = handle(async (req: Request) => {
  // Public: the rules are public information. Visitors without a login get tighter limits per network.
  const user = await getSessionUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (user) await rateLimit(`ask:${user.id}`, 20, 60);
  else { await rateLimit(`ask:anon:${ip}`, 10, 600); await rateLimit(`ask:anon:day:${ip}`, 40, 86400); }
  const { question } = Body.parse(await req.json());
  const sections = searchRulebook(question, 4);
  const ai = await answerFromRulebook(question, sections);
  await audit({ tenantId: user?.tenantId ?? null, actorType: "AI", actorId: ai ? ai.model : "none", action: "rulebook_answer", details: { sections: sections.map((s) => s.id), answerable: ai?.data.answerable ?? false } });
  if (!ai) {
    // The AI is down or not configured: show the closest official rules instead of an AI answer.
    const matched = searchRulebook(question, 2);
    return NextResponse.json({ answerUr: "ابھی AI مددگار دستیاب نہیں۔ نیچے قواعد کے متعلقہ حصے ہیں۔ مزید مدد کے لیے پنشن افسر سے بات کریں۔", answerEn: "The AI helper is not available right now. These are the closest sections of the rulebook. A pension officer can help with anything else.", sources: matched.map((s) => ({ id: s.id, title: s.title, text: s.text })) });
  }
  if (!ai.data.answerable) {
    return NextResponse.json({ answerUr: "اس سوال کا جواب قواعد میں نہیں ملا۔ پنشن افسر آپ کی مدد کرے گا۔", answerEn: "The rulebook does not answer this. A pension officer will help you.", sources: [] });
  }
  const cited = RULEBOOK.filter((s) => ai.data.cited_sections.includes(s.id));
  return NextResponse.json({ answerUr: ai.data.answer_ur, answerEn: ai.data.answer_en, sources: cited.map((s) => ({ id: s.id, title: s.title, text: s.text })) });
});
