// Starter labelled test set (invented examples). The team adds their own 100 messages here.
// label = the truth. Used by the Evaluation page to measure accuracy and false alarms honestly.
export const EVAL_MESSAGES: { text: string; sender?: string; label: "scam" | "genuine"; area?: string }[] = [
  { text: "Mubarak ho! Aap ki pension ki imdadi raqam 25,000 jari ho gayi hai. Wasooli ke liye 500 rupay fee is Easypaisa number par bhejain: 03001234567", sender: "03451234567", label: "scam", area: "Lyari" },
  { text: "Pension office: aap ki pension band ho jaye gi. Foran apna PIN code is number par bhejain.", sender: "03111234567", label: "scam", area: "Korangi" },
  { text: "Your pension account will be blocked today. Update CNIC details at http://pension-update.xyz", sender: "03211234567", label: "scam", area: "Malir" },
  { text: "آپ کی امدادی رقم منظور ہو گئی ہے۔ رقم وصول کرنے کے لیے اپنا او ٹی پی بتائیں۔", sender: "03331234567", label: "scam", area: "Lyari" },
  { text: "Congratulations! You are the lucky winner of a 50,000 relief prize. Call 03009876543 now.", sender: "03009876543", label: "scam", area: "Lyari" },
  { text: "Apne shanakhti card ki tasveer WhatsApp karein taake aap ki pension jari rahe.", sender: "03121234567", label: "scam", area: "Korangi" },
  { text: "BISP Ehsaas relief 12000 aap ke liye. Is link par click karein: bit.ly/relief-12k", sender: "03451112223", label: "scam", area: "Malir" },
  { text: "Pension office: Your yearly proof-of-life is due by 31 December. Open the Zinda Hoon app or visit the pension office. We never ask for your PIN.", sender: "8XXX", label: "genuine", area: "Lyari" },
  { text: "پنشن آفس: آپ کا اس سال کا ثبوتِ حیات مکمل ہو گیا ہے۔ شکریہ۔", sender: "8XXX", label: "genuine", area: "Lyari" },
  { text: "Pension office: your November pension of Rs 30,000 has been credited to your bank account.", sender: "8XXX", label: "genuine", area: "Korangi" },
  { text: "Reminder: Free eye camp for pensioners at the pension office on Saturday 10am.", sender: "8XXX", label: "genuine", area: "Malir" },
  { text: "Bank: Rs 30,000 received in your account ending 5001 from Pension Office (mock).", sender: "8YYY", label: "genuine", area: "Lyari" },
];
