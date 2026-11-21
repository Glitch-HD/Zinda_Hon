"use client";
import Script from "next/script";
import Link from "next/link";
import SayButton from "@/components/ui/SayButton";

// Swagger UI for the public API, served from our own site (works without outside CDNs).
export default function Docs() {
  return (
    <div>
      <div className="card mb-4 space-y-2">
        <h1 className="text-2xl font-bold">API for banks <span className="ur">بینکوں کے لیے اے پی آئی</span></h1>
        <p><b>In simple words:</b> this page is for computer programmers at banks and other government offices, not for pensioners. A bank pays the pension into her account. Before it pays, the bank&apos;s computer can ask our computer one question: <b>&ldquo;Has this pensioner done her proof of life this year?&rdquo;</b> Our system answers <i>verified</i>, <i>waiting</i>, <i>with an officer</i> or <i>stopped</i>, and nothing more.</p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Each bank gets its own secret <b>API key</b> from our admin. No key, no answer.</li>
          <li>A key can only do what it is allowed (its <b>scopes</b>), and only a limited number of times per minute.</li>
          <li>The bank only gets an answer if <b>she agreed</b> to share her case status. If she withdraws, the next request is refused.</li>
          <li>Every request is written in the audit log, so she and the auditor can see which bank asked, and when.</li>
          <li>An admin can cancel a key at once if a bank misuses it.</li>
        </ul>
        <p className="text-sm muted">The list below is the technical description (OpenAPI / Swagger). Everything here is simulated: no real bank is connected. Pensioners never need this page; go back <Link href="/login">home</Link>.</p>
        <SayButton big ur="یہ صفحہ پنشنرز کے لیے نہیں، بینکوں کے کمپیوٹر پروگرامرز کے لیے ہے۔ بینک پنشن بھیجنے سے پہلے ہمارے نظام سے پوچھ سکتا ہے کہ کیا اس پنشنر نے اس سال ثبوتِ حیات دیا ہے۔ ہر بینک کے پاس اپنی خفیہ چابی ہوتی ہے، اور جواب صرف تب ملتا ہے جب پنشنر نے اجازت دی ہو۔ ہر سوال ریکارڈ میں لکھا جاتا ہے۔" en="This page is for computer programmers at banks, not for pensioners. Before paying a pension, a bank can ask our system whether this pensioner has done her proof of life this year. Each bank has its own secret key, and it only gets an answer if the pensioner agreed. Every request is written in the record." />
      </div>
      <link rel="stylesheet" href="/swagger/swagger-ui.css" />
      <div id="swagger" style={{ background: "#fff", borderRadius: 12 }} />
      <Script src="/swagger/swagger-ui-bundle.js" strategy="afterInteractive"
        onReady={() => { (window as unknown as { SwaggerUIBundle: (o: object) => void }).SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger" }); }} />
    </div>
  );
}
