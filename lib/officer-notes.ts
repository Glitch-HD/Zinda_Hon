/**
 * The officer's own words in a note, with any text pasted from the AI case assistant removed. An
 * approval against the evidence must be justified by a person, not by the AI's own report.
 */
export function ownWords(note: string) {
  return note.split("\n").filter((line) => {
    const l = line.trim();
    return l && !l.startsWith("AI case assistant (") && !l.startsWith("AI: ") && !l.startsWith("- ") && l !== "I checked these points myself before deciding.";
  }).join(" ").replace(/\s+/g, " ").trim();
}

