"use client";
import { usePathname } from "next/navigation";
import SayButton from "@/components/ui/SayButton";

// "Listen to this page": every page explains itself out loud, in Urdu and English. One list here, so a
// new page only needs one more line. Pages are matched by their address.
type T = { ur: string; en: string };
const PAGES: [RegExp, T][] = [
  // The front page has its own big Listen buttons in the hero, so it is not listed here.
  [/^\/__front__$/, { ur: "یہ زندہ ہوں ہے، پنشن کے ثبوتِ حیات کی سروس۔ پنشن لینے والی خواتین گھر بیٹھے فون سے سال میں ایک بار ثبوت دیتی ہیں: کیمرے میں دیکھیں، پنشن بک دکھائیں، اور بس۔ نیچے 'آپ کون ہیں' میں اپنا خانہ دبائیں۔ کوئی بھی پیغام جانچ سکتا ہے یا قواعد پوچھ سکتا ہے، لاگ اِن کے بغیر۔", en: "This is Zinda Hon, the pension proof-of-life service. Pensioners prove once a year, from home, that they are alive: look at the camera, show the pension book, done. Below, under Who are you, press your box. Anyone can check a message or ask about the rules without logging in." }],
  [/^\/pensioner/, { ur: "یہ آپ کا صفحہ ہے۔ اوپر بڑا رنگین دائرہ بتاتا ہے کہ آپ کی پنشن کا کیا حال ہے: سبز یعنی سب ٹھیک، پیلا یعنی کچھ کرنا باقی ہے، لال یعنی پنشن رکی ہوئی ہے۔ ثبوتِ حیات دینے کے لیے سبز بٹن دبائیں۔", en: "This is your page. The big coloured circle shows your pension: green means all is well, amber means something is still to do, red means the pension is stopped. Press the green button to give proof of life." }],
  [/^\/case\//, { ur: "یہاں آپ ثبوتِ حیات دیتی ہیں۔ چار قدم ہیں: کیمرے میں دیکھیں، آنکھ جھپکائیں اور سر گھمائیں، پنشن بک کا کیو آر دکھائیں، پھر بھیجیں۔ ہر قدم کے بعد آپ کا کام فون میں محفوظ ہو جاتا ہے۔", en: "Here you give proof of life. Four steps: look at the camera, blink and turn your head, show your pension book QR, then send. Your progress is saved on the phone after every step." }],
  [/^\/consent/, { ur: "یہاں آپ دیکھ سکتی ہیں کہ آپ کا ڈیٹا کس کے پاس ہے۔ کسی سے بھی اجازت ایک بٹن سے واپس لے سکتی ہیں۔ اگر آپ کی معلومات غلط ہیں تو درستی کی درخواست بھیجیں۔", en: "Here you can see who has your data. You can take back permission from anyone with one button. If your details are wrong, send a correction request." }],
  [/^\/helper/, { ur: "یہ مددگار کا صفحہ ہے۔ یہاں ان خاندانوں کی فہرست ہے جن کی آپ مدد کرتے ہیں، اور ہر ایک کی پنشن کا حال۔ آپ صرف وہی دیکھ سکتے ہیں جس کی انہوں نے اجازت دی ہے۔", en: "This is the helper page. It lists the families you help and each one's pension status. You can only see what each family allowed." }],
  [/^\/shopkeeper/, { ur: "یہ دکاندار کا صفحہ ہے۔ اگر کسی گاہک کو پنشن یا امداد کا کوئی پیغام آیا ہو تو پیسے بھیجنے سے پہلے اسے یہاں جانچیں۔", en: "This is the shopkeeper page. If a customer got a pension or relief message, check it here before anyone sends money." }],
  [/^\/check-message/, { ur: "یہاں کوئی بھی مشکوک پیغام لکھیں یا بولیں۔ ہم بتائیں گے کہ یہ دھوکہ ہے یا نہیں۔ کبھی کسی کو اپنا پن یا پیسے نہ دیں۔", en: "Type or say any suspicious message here. We will tell you if it is a scam. Never give anyone your PIN or money." }],
  [/^\/ask/, { ur: "یہاں پنشن کے قواعد کے بارے میں سوال پوچھیں۔ جواب صرف سرکاری قواعد سے آتا ہے اور سنایا بھی جاتا ہے۔", en: "Ask about the pension rules here. Answers come only from the official rules, and are read out to you." }],
  [/^\/docs/, { ur: "یہ صفحہ بینکوں کے کمپیوٹر پروگرامرز کے لیے ہے، پنشنرز کے لیے نہیں۔", en: "This page is for computer programmers at banks, not for pensioners." }],
  [/^\/scam-map/, { ur: "یہ دھوکے کا نقشہ ہے۔ یہ دکھاتا ہے کہ کن علاقوں میں سب سے زیادہ جعلی پیغام آ رہے ہیں، تاکہ افسر ان علاقوں کو خبردار کر سکیں۔", en: "This is the scam map. It shows which areas are getting the most fake messages, so officers can warn those areas." }],
  [/^\/evaluation/, { ur: "یہ جانچ کا صفحہ ہے۔ یہ دکھاتا ہے کہ ہمارا نظام کتنی بار صحیح تھا، کتنی بار غلط خبردار کیا، اور کتنا وقت اور خرچ لگا۔", en: "This is the evaluation page. It shows how often our system was right, how often it raised a false alarm, and how much time and cost it took." }],
  [/^\/officer\/case\//, { ur: "یہ ایک کیس کی جانچ کا صفحہ ہے۔ بائیں طرف ریکارڈز کا موازنہ ہے، دائیں طرف اے آئی کی جانچ۔ آپ منظور، مزید ثبوت، یا وجہ لکھ کر روک سکتے ہیں۔", en: "This is a case review. On the left the records are compared, on the right the AI checks. You can approve, ask for more proof, or stop with a written reason." }],
  [/^\/officer\/families/, { ur: "یہاں آپ اس سال کے کیس کھولتے ہیں، اجازت کے ساتھ مددگار جوڑتے ہیں، اور معلومات کی درستی کی درخواستیں منظور یا رد کرتے ہیں۔", en: "Here you open this year's cases, link helpers with permission, and accept or reject data correction requests." }],
  [/^\/officer\/enroll/, { ur: "یہاں دفتر میں یا گھر جا کر کسی کا چہرہ رجسٹر کیا جاتا ہے، صرف جب نادرا کے پاس تصویر نہ ہو۔", en: "Here a face is enrolled at the office or on a home visit, only when NADRA has no usable photo." }],
  [/^\/officer\/pension-books/, { ur: "یہاں ہر پنشنر کی پنشن بک کا دستخط شدہ کیو آر کوڈ ہے۔ ڈاؤن لوڈ کر کے پرنٹ کریں۔ لال والا جعلی نمونہ ہے۔", en: "Here is every pensioner's signed pension book QR code. Download and print them. The red one is a forged sample for the demo." }],
  [/^\/officer\/messages/, { ur: "یہ وہ پیغام ہیں جن پر اے آئی کو یقین نہیں تھا۔ آپ بتائیں کہ اصل میں کیا تھا، اس سے ہماری درستی کے اعداد ایماندار رہتے ہیں۔", en: "These are messages the AI was unsure about. Say what they really were; this keeps our accuracy numbers honest." }],
  [/^\/officer/, { ur: "یہ پنشن افسر کا صفحہ ہے۔ سب سے اوپر وہ کیس ہیں جن پر آپ کا فیصلہ چاہیے، سب سے خطرناک پہلے۔", en: "This is the pension officer page. At the top are the cases that need your decision, the riskiest first." }],
  [/^\/admin\/mock-nadra/, { ur: "یہ نقلی نادرا کا صفحہ ہے، صرف نمائش کے لیے۔ یہاں کسی کی شناختی کارڈ والی تصویر کے نمبر لوڈ یا مٹائے جاتے ہیں۔", en: "This is the simulated NADRA screen, for the demo only. Here a CNIC photo's face numbers are loaded or wiped." }],
  [/^\/admin/, { ur: "یہ ایڈمن کا صفحہ ہے۔ یہاں جانچ کے قواعد بدلے جاتے ہیں، بینکوں کی چابیاں بنتی ہیں، اور مددگاروں کا ریکارڈ دیکھا جاتا ہے۔ قواعد نرم کرنے کے لیے دوسرے ایڈمن کی منظوری چاہیے۔", en: "This is the admin page. Here the checking rules are changed, bank keys are made, and helpers' records are seen. Making rules looser needs a second admin." }],
  [/^\/auditor/, { ur: "یہ آڈیٹر کا صفحہ ہے۔ یہاں ہر فیصلہ اور ہر کارروائی کا ریکارڈ ہے۔ آڈیٹر صرف دیکھ سکتا ہے، کچھ بدل نہیں سکتا۔", en: "This is the auditor page. It holds the record of every decision and every action. The auditor can only look, never change anything." }],
];

export default function PageListen() {
  const path = usePathname() ?? "/";
  const t = PAGES.find(([re]) => re.test(path))?.[1];
  if (!t) return null;
  return (
    <div className="page-listen">
      <SayButton ur={t.ur} en={t.en} />
      <span className="muted text-sm"><span className="en">Listen to this page</span> <span className="ur">یہ صفحہ سنیں</span></span>
    </div>
  );
}
