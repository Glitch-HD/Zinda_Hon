// Every time shown on screen is Pakistan time (PKT, UTC+5, no daylight saving). The server runs in UTC,
// so formatting with the server's clock would show times 5 hours behind.
const PKT_MS = 5 * 60 * 60 * 1000;
const shift = (d: Date | string) => new Date(new Date(d).getTime() + PKT_MS).toISOString();

/** "2026-11-22 15:47" in Pakistan time (with seconds when asked). */
export function pkt(d: Date | string, seconds = false) {
  return shift(d).slice(0, seconds ? 19 : 16).replace("T", " ");
}
/** "2026-11-22" in Pakistan time. */
export function pktDay(d: Date | string) {
  return shift(d).slice(0, 10);
}
/** "22 Nov 2026" in Pakistan time. */
export function pktDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
}
/** "15:47" in Pakistan time. */
export function pktTime(d: Date | string) {
  return shift(d).slice(11, 16);
}
