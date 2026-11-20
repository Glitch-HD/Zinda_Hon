// One piece of text in both languages. The language switch at the top hides one of them with CSS,
// so pages need no reload and server pages can use this too.
export default function T({ en, ur, enClass = "", urClass = "", sep = " " }: { en: React.ReactNode; ur: React.ReactNode; enClass?: string; urClass?: string; sep?: string }) {
  return (
    <>
      <span className={`ur ${urClass}`}>{ur}</span>
      <span className="both-only">{sep}</span>
      <span className={`en ${enClass}`}>{en}</span>
    </>
  );
}
