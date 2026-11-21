"use client";
import SayButton from "./ui/SayButton";

export type FaqItem = { q: string; qUr: string; a: string; aUr: string };

// Questions and answers. Each question has its own Listen button, so it can be heard before it is opened.
export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq">
      {items.map((f) => (
        <details key={f.q}>
          <summary>
            <span className="faq-q"><span className="en">{f.q}</span><span className="ur faq-ur">{f.qUr}</span></span>
            <SayButton ur={`${f.qUr} ${f.aUr}`} en={`${f.q} ${f.a}`} />
          </summary>
          <p className="en">{f.a}</p><p className="ur faq-a-ur">{f.aUr}</p>
        </details>
      ))}
    </div>
  );
}
