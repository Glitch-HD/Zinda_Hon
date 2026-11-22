// Shown at once while the next page is prepared on the server, so a tap never feels ignored:
// a short "Opening…" line plus grey shapes where the page will appear.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <div className="page-loading">
        <span className="page-loading-dot" aria-hidden />
        <span><span className="ur">کھل رہا ہے…</span> <span className="en">Opening…</span></span>
      </div>
      <div aria-hidden="true" className="space-y-3">
        <div className="skel" style={{ height: 34, width: "55%" }} />
        <div className="skel" style={{ height: 96 }} />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <div className="skel" style={{ height: 90 }} /><div className="skel" style={{ height: 90 }} /><div className="skel" style={{ height: 90 }} />
        </div>
      </div>
    </div>
  );
}
