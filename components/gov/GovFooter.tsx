import Link from "next/link";
import GovSeal from "./GovSeal";

export default function GovFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="gov-foot" data-no-voice>
      <div className="gov-foot-inner">
        <div className="gov-foot-col gov-foot-about">
          <div className="flex items-center gap-3"><GovSeal size={46} /><b className="text-lg">Zinda Hon <span className="ur always" style={{ lineHeight: 1.5 }}>زندہ ہوں</span></b></div>
          <p>Once a year, widows and retired people keep their pension going from home: a face check with a blink, a scan of the pension book, and send. Helpers and shops can assist; officers decide the hard cases.</p>
        </div>
        <div className="gov-foot-col">
          <h4>Citizen services</h4>
          <Link href="/login">Prove I am alive</Link>
          <Link href="/login#signup">Create an account</Link>
          <Link href="/check-message">Is this message a scam?</Link>
          <Link href="/ask">Ask about pension rules</Link>
          <Link href="/consent">Who can see my data</Link>
        </div>
        <div className="gov-foot-col">
          <h4>For staff and partners</h4>
          <Link href="/officer">Pension officers</Link>
          <Link href="/admin">Administration</Link>
          <Link href="/auditor">Audit and transparency</Link>
          <Link href="/docs">API for banks and departments</Link>
        </div>
        <div className="gov-foot-col">
          <h4>Contact (simulated)</h4>
          <p>Phone: 0300-0000000</p>
          <p>Email: help@zindahon.example</p>
          <p>Online 24 hours; offices Mon to Fri, 9 AM to 5 PM</p>
        </div>
      </div>
      <div className="gov-foot-bar">
        <span>© {year} Zinda Hon prototype. Not an official government service. All people, CNICs, payments and NADRA records are simulated.</span>
      </div>
    </footer>
  );
}
