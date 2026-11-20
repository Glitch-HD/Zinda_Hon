"use client";
import VoiceCommand from "./ui/VoiceCommand";

// The pensioner's home page can be used by voice alone: she says what she wants.
export default function PensionerVoice({ caseHref }: { caseHref: string | null }) {
  const go = (href: string) => () => { window.location.href = href; };
  const commands = [
    ...(caseHref ? [{ id: "start", words: ["شروع", "ثبوت", "زندہ", "تصویر", "start", "shuru", "saboot"], confirmUr: "ثبوتِ حیات شروع ہو رہا ہے۔", run: go(caseHref) }] : []),
    { id: "message", words: ["پیغام", "میسج", "مسیج", "دھوکہ", "message", "sms", "paigham"], confirmUr: "پیغام جانچنے کا صفحہ کھل رہا ہے۔", run: go("/check-message") },
    { id: "ask", words: ["سوال", "پوچھ", "مدد", "ask", "sawal", "question"], confirmUr: "سوال پوچھنے کا صفحہ کھل رہا ہے۔", run: go("/ask") },
    { id: "data", words: ["ڈیٹا", "اجازت", "معلومات", "data", "ijazat"], confirmUr: "آپ کی معلومات کا صفحہ کھل رہا ہے۔", run: go("/consent") },
  ];
  return (
    <VoiceCommand
      promptUr={caseHref ? "بولیں: شروع، پیغام، سوال، یا میرا ڈیٹا۔" : "بولیں: پیغام، سوال، یا میرا ڈیٹا۔"}
      promptEn={caseHref ? 'Say "start", "message", "question" or "my data".' : 'Say "message", "question" or "my data".'}
      commands={commands}
    />
  );
}
