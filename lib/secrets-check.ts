// Simple, explainable strength rules for new passwords and PINs (no list of leaked passwords is needed
// for these: they block the guesses a relative or a scammer would try first).
export function passwordProblem(pw: string, phone: string, name: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 100) return "That is too long.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use both letters and numbers.";
  const low = pw.toLowerCase();
  if (low.includes(phone.slice(-7))) return "Do not use your phone number.";
  const first = name.split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 3 && low.includes(first)) return "Do not use your name.";
  if (/^(.)\1+$/.test(pw) || /password|zindahon|123456/.test(low)) return "That password is too easy to guess.";
  return null;
}

export function pinProblem(pin: string, birthYear?: number | null): { en: string; ur: string } | null {
  if (!/^\d{4}$/.test(pin)) return { en: "The PIN must be 4 numbers.", ur: "پن چار ہندسوں کا ہونا چاہیے۔" };
  if (/^(\d)\1{3}$/.test(pin)) return { en: "Do not use the same number four times.", ur: "ایک ہی ہندسہ چار بار نہ لکھیں۔" };
  if ("0123456789".includes(pin) || "9876543210".includes(pin)) return { en: "Do not use numbers in a row like 1234.", ur: "1234 جیسے لگاتار ہندسے نہ لکھیں۔" };
  if (birthYear && pin === String(birthYear)) return { en: "Do not use your birth year; family members know it.", ur: "اپنی پیدائش کا سال نہ لکھیں، گھر والے جانتے ہیں۔" };
  return null;
}
