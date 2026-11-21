// Shown at once while the next page is prepared on the server, so a tap never feels ignored.
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-dot" aria-hidden />
      <span><span className="ur">کھل رہا ہے…</span> <span className="en">Opening…</span></span>
    </div>
  );
}
