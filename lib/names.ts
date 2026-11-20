// Name matching for messy records (Challenge 03).
// Pakistani names are written many ways in English letters: Muhammad / Mohammad / Muhammed / Mohd.
// We normalise common spelling variants first, then compare with Jaro-Winkler similarity.
// A similarity score is never enough on its own to merge two people: the decision engine
// also needs a matching CNIC or date of birth, and doubtful matches go to a human.

const TOKEN_ALIASES: Record<string, string> = {
  mohammad: "muhammad",
  mohammed: "muhammad",
  muhammed: "muhammad",
  mohamad: "muhammad",
  muhamad: "muhammad",
  mohd: "muhammad",
  md: "muhammad",
  mhd: "muhammad",
  mohamed: "muhammad",
  ahmad: "ahmed",
  ahmet: "ahmed",
  hussain: "husain",
  hussein: "husain",
  husein: "husain",
  hassan: "hasan",
  begam: "begum",
  baigum: "begum",
  bibi: "bibi",
  bi: "bibi",
  fatima: "fatima",
  fatimah: "fatima",
  fathima: "fatima",
  ayesha: "aisha",
  aysha: "aisha",
  aishah: "aisha",
  ayisha: "aisha",
  khatoon: "khatun",
  khaton: "khatun",
  abdul: "abdul",
  abdal: "abdul",
  abdur: "abdul",
  abdel: "abdul",
  zainab: "zainab",
  zaynab: "zainab",
  zenab: "zainab",
  rasheed: "rashid",
  rashid: "rashid",
  shareef: "sharif",
  rafeeq: "rafiq",
  siddique: "siddiq",
  siddiqui: "siddiq",
  sadiq: "sadiq",
  saddiq: "sadiq",
  noor: "nur",
  nour: "nur",
};

// Honorifics and joining words that don't identify the person.
const DROP_TOKENS = new Set(["mr", "mrs", "ms", "miss", "syed", "syeda", "sayyid", "haji", "hajji", "w/o", "d/o", "s/o", "wife", "of", "late"]);

function simplifyToken(token: string): string {
  if (TOKEN_ALIASES[token]) return TOKEN_ALIASES[token];
  let t = token;
  t = t.replace(/ee/g, "i").replace(/oo/g, "u").replace(/ph/g, "f");
  t = t.replace(/(.)\1+/g, "$1"); // collapse doubled letters: "hassan" -> "hasan"
  t = t.replace(/h$/, ""); // trailing h: "fatimah" -> "fatima"
  return TOKEN_ALIASES[t] ?? t;
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s/]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !DROP_TOKENS.has(t))
    .map(simplifyToken)
    .filter((t) => t.length > 0);
  return cleaned.join(" ");
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (a.length === 0 || b.length === 0) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Similarity of two names from 0 to 1, after normalising spelling variants.
 * Token order is ignored ("Bibi Fatima" vs "Fatima Bibi").
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const sortedA = na.split(" ").sort().join(" ");
  const sortedB = nb.split(" ").sort().join(" ");
  return Math.max(jaroWinkler(na, nb), jaroWinkler(sortedA, sortedB));
}

export function normalizeCnic(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 13 ? digits : null;
}
