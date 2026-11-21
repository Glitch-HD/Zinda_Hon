import Link from "next/link";

// Shown on the pages anyone may use without logging in (scam check, pension rules), so a widow, a
// shopkeeper's customer or a judge can try them straight from the home page.
export default function PublicTop({ title, titleUr }: { title: string; titleUr: string }) {
  return (
    <div className="card mb-6 flex flex-wrap items-center gap-3 justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title} <span className="ur">{titleUr}</span></h1>
        <p className="muted text-sm"><span className="en">No login needed. Nothing you type here is linked to your name.</span> <span className="ur">لاگ اِن کی ضرورت نہیں۔</span></p>
      </div>
      <div className="flex gap-2">
        <Link className="btn btn-ghost btn-sm" href="/login"><span className="en">← Home</span> <span className="ur">واپس</span></Link>
        <Link className="btn btn-sm" href="/login#start"><span className="en">Log in</span> <span className="ur">لاگ اِن</span></Link>
      </div>
    </div>
  );
}
