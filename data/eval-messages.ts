// Labelled test set for the scam checker: 100 invented messages (no real people, numbers or links).
// label = the truth. lang = how it is written. hard = a message that is easy to get wrong
// (a real message that mentions OTPs or links, or a scam with no obvious warning words).
// Used by the Evaluation page to measure accuracy and false alarms honestly.
export type EvalMessage = { text: string; sender?: string; label: "scam" | "genuine"; area?: string; lang: "en" | "ur" | "roman"; hard?: boolean };

export const EVAL_MESSAGES: EvalMessage[] = [
  // ---------- Scams: fake relief payments with a "release fee" ----------
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001201", text: "Mubarak ho! Aap ki pension ki imdadi raqam 25,000 jari ho gayi hai. Wasooli ke liye 500 rupay fee is Easypaisa number par bhejain: 03000001201" },
  { lang: "roman", label: "scam", area: "Korangi", sender: "03000001202", text: "Ehsaas program se aap ke naam 12,000 rupay mansoor hue hain. Processing charges 300 JazzCash par bhej dein, raqam 1 ghante mein aa jaye gi." },
  { lang: "ur", label: "scam", area: "Malir", sender: "03000001203", text: "مبارک ہو! بینظیر انکم سپورٹ سے آپ کی 25000 کی قسط منظور ہو گئی ہے۔ وصولی کے لیے 1000 روپے فیس ایزی پیسہ پر بھیجیں۔" },
  { lang: "en", label: "scam", area: "Orangi", sender: "03000001204", text: "Dear pensioner, a winter relief bonus of Rs 18,000 is approved. Send Rs 700 processing fee to JazzCash 03000001204 to receive it today." },
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001205", text: "Pension barhane ka naya hukam aa gaya. Arrears 40,000 lene ke liye pehle 1500 fee is account mein jama karwain. Aaj aakhri din hai." },
  { lang: "ur", label: "scam", area: "Korangi", sender: "03000001206", text: "حکومت پاکستان کی طرف سے بیوہ خواتین کے لیے 30 ہزار امداد۔ رجسٹریشن فیس 500 روپے جاز کیش کریں۔" },
  { lang: "en", label: "scam", area: "Gulshan", sender: "03000001207", text: "Govt Relief Cell: Rs 15,000 Ramzan package reserved for your CNIC. Transfer Rs 450 verification charges to Easypaisa 03000001207 within 2 hours." },
  { lang: "roman", label: "scam", area: "Malir", sender: "03000001208", text: "Aap ka naam flood relief list mein aa gaya hai. 20,000 rupay ke liye 800 rupay tax pehle bhejna zaroori hai." },
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001209", hard: true, text: "Assalam o alaikum amma ji, main pension office se Rashid bol raha hoon. Aap ka bakaya check tayyar hai, bas courier ke 350 rupay bhej dein." },
  { lang: "ur", label: "scam", area: "Orangi", sender: "03000001210", text: "آپ کی رکی ہوئی پنشن بحال ہو گئی ہے۔ بقایا جات کے لیے 2000 روپے سرکاری فیس اس نمبر پر بھیجیں۔" },

  // ---------- Scams: asking for a PIN, OTP or password ----------
  { lang: "roman", label: "scam", area: "Korangi", sender: "03000001211", text: "Pension office: aap ki pension band ho jaye gi. Foran apna PIN code is number par bhejain." },
  { lang: "ur", label: "scam", area: "Lyari", sender: "03000001212", text: "آپ کی امدادی رقم منظور ہو گئی ہے۔ رقم وصول کرنے کے لیے اپنا او ٹی پی بتائیں۔" },
  { lang: "en", label: "scam", area: "Malir", sender: "03000001213", text: "Your ATM card will be blocked tonight. Reply with the 4-digit PIN to keep your pension account active." },
  { lang: "roman", label: "scam", area: "Gulshan", sender: "03000001214", text: "Abhi aap ke phone par 6 number ka code aya hoga, wo humein bata dein taake aap ki imdad aap ke account mein transfer ho sake." },
  { lang: "ur", label: "scam", area: "Korangi", sender: "03000001215", text: "بینک سے بات کر رہے ہیں۔ آپ کا اکاؤنٹ بند ہونے والا ہے۔ ابھی جو کوڈ آیا ہے وہ ہمیں بتائیں۔" },
  { lang: "en", label: "scam", area: "Orangi", sender: "03000001216", text: "Pension verification pending. Share your mobile wallet password with our officer on 03000001216 to complete biometric update." },
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001217", hard: true, text: "Beta main aap ki khala ki taraf se. Unhon ne kaha aap ke phone par jo code aya hai wo mujhe bhej do, unka account khulna hai." },
  { lang: "ur", label: "scam", area: "Malir", sender: "03000001218", text: "زندہ ہوں ایپ اپڈیٹ: اپنی پنشن جاری رکھنے کے لیے اپنا پن نمبر اس میسج کے جواب میں لکھیں۔" },
  { lang: "en", label: "scam", area: "Gulshan", sender: "03000001219", text: "NADRA biometric failed for your pension. To avoid suspension reply with the OTP you just received." },
  { lang: "roman", label: "scam", area: "Korangi", sender: "03000001220", text: "Easypaisa account verification: aap ka account 24 ghante mein band ho jaye ga. MPIN reply karein." },

  // ---------- Scams: fake links and "updates" ----------
  { lang: "en", label: "scam", area: "Malir", sender: "03000001221", text: "Your pension account will be blocked today. Update CNIC details at http://pension-update.xyz" },
  { lang: "roman", label: "scam", area: "Malir", sender: "03000001222", text: "BISP Ehsaas relief 12000 aap ke liye. Is link par click karein: bit.ly/relief-12k" },
  { lang: "en", label: "scam", area: "Lyari", sender: "03000001223", text: "Proof of life overdue! Complete it here in 2 minutes or lose your pension: www.zinda-hon-verify.top" },
  { lang: "ur", label: "scam", area: "Orangi", sender: "03000001224", text: "اپنی پنشن کی تصدیق کے لیے اس لنک پر کلک کریں اور اپنی تفصیل درج کریں: pension-gov-pk.xyz" },
  { lang: "roman", label: "scam", area: "Gulshan", sender: "03000001225", text: "Naya pension card banwane ke liye form bharain: wa.me/923000001225 warna agle mahine pension nahi aaye gi." },
  { lang: "en", label: "scam", area: "Korangi", sender: "03000001226", text: "SBP notice: all pension accounts must be re-verified. Visit https://sbp-pension-check.top before Friday." },
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001227", hard: true, text: "Pension wali amma ji, apni tasdeeq ke liye ye app download karein: pension-helper.apk. Install karte waqt sab permission allow karein." },
  { lang: "ur", label: "scam", area: "Malir", sender: "03000001228", text: "آپ کا پنشن اکاؤنٹ عارضی طور پر معطل ہے۔ بحالی کے لیے یہاں لاگ ان کریں: www.pension-bahali.xyz" },

  // ---------- Scams: CNIC photo and personal details ----------
  { lang: "roman", label: "scam", area: "Korangi", sender: "03000001229", text: "Apne shanakhti card ki tasveer WhatsApp karein taake aap ki pension jari rahe." },
  { lang: "ur", label: "scam", area: "Lyari", sender: "03000001230", text: "اپنے شناختی کارڈ کی دونوں طرف کی تصویر اور بینک کارڈ کی تصویر اس نمبر پر بھیجیں تاکہ امداد مل سکے۔" },
  { lang: "en", label: "scam", area: "Gulshan", sender: "03000001231", text: "To receive the widow support grant, send a photo of your CNIC (front and back) and your selfie holding it to this number." },
  { lang: "roman", label: "scam", area: "Orangi", sender: "03000001232", text: "Aap ki pension file mein ghalti hai. Apna CNIC number, maa ka naam aur bank account number reply karein." },
  { lang: "en", label: "scam", area: "Malir", sender: "03000001233", hard: true, text: "Hello, this is the census team. For the senior citizens survey please reply with your CNIC number, date of birth and bank name." },

  // ---------- Scams: prizes and lotteries ----------
  { lang: "en", label: "scam", area: "Lyari", sender: "03000001234", text: "Congratulations! You are the lucky winner of a 50,000 relief prize. Call 03000001234 now." },
  { lang: "roman", label: "scam", area: "Korangi", sender: "03000001235", text: "Jeeto Pakistan lucky draw mein aap ka number nikla hai! Inaam 2 lakh aur motorcycle. Rabta karein 03000001235" },
  { lang: "ur", label: "scam", area: "Malir", sender: "03000001236", text: "مبارک ہو! آپ کا موبائل نمبر قرعہ اندازی میں منتخب ہو گیا ہے۔ انعام لینے کے لیے فوراً کال کریں۔" },
  { lang: "en", label: "scam", area: "Gulshan", sender: "03000001237", text: "Your SIM won Rs 500,000 in the Senior Citizens Lucky Draw 2026. Contact our manager on 03000001237 to claim." },
  { lang: "roman", label: "scam", area: "Orangi", sender: "03000001238", text: "Bank ki taraf se pensioners ke liye inaami scheme. Aap ne 75,000 jeete hain. Claim ke liye 1000 tax bhejain." },
  { lang: "ur", label: "scam", area: "Lyari", sender: "03000001239", text: "حج قرعہ اندازی میں آپ کا نام آیا ہے۔ کاغذات کے لیے 5000 روپے جمع کرائیں اور اس نمبر پر رابطہ کریں۔" },

  // ---------- Scams: impersonation and pressure (often no obvious "scam words") ----------
  { lang: "roman", label: "scam", area: "Korangi", sender: "03000001240", hard: true, text: "Ammi main Bilal, mera phone gum ho gaya, ye naya number hai. Hospital mein hoon, foran 5000 is number par Easypaisa kar dein, baad mein samjhata hoon." },
  { lang: "en", label: "scam", area: "Malir", sender: "03000001241", hard: true, text: "This is Inspector Khan, FIA cyber crime. Your CNIC was used in money laundering. Pay Rs 20,000 security now or police will come to your house today." },
  { lang: "ur", label: "scam", area: "Gulshan", sender: "03000001242", hard: true, text: "خالہ جان میں آپ کا بھانجا ہوں، نیا نمبر ہے۔ ایک ضروری کام ہے، ابھی 3000 روپے جاز کیش کر دیں، شام کو واپس کر دوں گا۔" },
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001243", hard: true, text: "Pension office se bol raha hoon. Aap ka zinda hone ka saboot reject ho gaya. Ghar bethe dobara karwana hai to 1200 rupay bhejein, warna daftar aana paray ga." },
  { lang: "en", label: "scam", area: "Orangi", sender: "03000001244", hard: true, text: "Dear customer your parcel from Pension Department is held at customs. Pay Rs 950 clearance to release it." },
  { lang: "ur", label: "scam", area: "Korangi", sender: "03000001245", hard: true, text: "آپ کے شوہر کی پنشن کا کیس دوبارہ کھولا گیا ہے۔ وکیل کی فیس 4000 روپے بھیجیں ورنہ پنشن ختم ہو جائے گی۔" },
  { lang: "roman", label: "scam", area: "Malir", sender: "03000001246", hard: true, text: "Main aap ke bank ka manager hoon. Aap ke account se ghalat transaction hui hai, wapas lane ke liye mujhe call karein 03000001246." },
  { lang: "en", label: "scam", area: "Lyari", sender: "03000001247", text: "URGENT: pension stopped due to missing biometric. Call 03000001247 immediately to restart payments." },
  { lang: "roman", label: "scam", area: "Gulshan", sender: "03000001248", text: "Aap ki beti ka accident ho gaya hai, hum Jinnah hospital se bol rahe hain. Operation ke liye abhi 10,000 bhejein." },
  { lang: "ur", label: "scam", area: "Orangi", sender: "03000001249", text: "پنشن آفس: آپ کا نام مرنے والوں کی فہرست میں آ گیا ہے۔ زندہ ثابت کرنے کے لیے فوراً 1500 روپے فیس بھیجیں۔" },
  { lang: "en", label: "scam", area: "Korangi", sender: "03000001250", text: "Your electricity will be cut today for unpaid bill. Pay Rs 3,400 now by JazzCash to 03000001250 to avoid disconnection." },
  { lang: "roman", label: "scam", area: "Lyari", sender: "03000001251", text: "Sasta qarza sirf CNIC par! Pensioners ke liye 1 lakh bina sood. Advance 2000 bhejein aur aaj hi qarza payein." },
  { lang: "ur", label: "scam", area: "Malir", sender: "03000001252", text: "آپ کا پرائز بانڈ نکلا ہے۔ رقم کی منتقلی کے لیے اپنا اکاؤنٹ نمبر اور پن کوڈ بھیجیں۔" },
  { lang: "en", label: "scam", area: "Gulshan", sender: "03000001253", text: "Job offer for your grandson: Rs 80,000 salary in Dubai. Registration fee Rs 5,000 by Easypaisa. Limited seats, reply today." },
  { lang: "roman", label: "scam", area: "Orangi", sender: "03000001254", hard: true, text: "Zinda Hon team: aap ki selfie clear nahi thi. Dobara bhejne ke bajaye 500 rupay de kar manual verification karwa lein." },
  { lang: "en", label: "scam", area: "Lyari", sender: "03000001255", hard: true, text: "Hi it's Sana from the pension office. I can approve your case faster if you send a small thank-you on JazzCash. Many widows do this." },

  // ---------- Genuine: official pension office messages (mock short code 8XXX) ----------
  { lang: "en", label: "genuine", area: "Lyari", sender: "8XXX", text: "Pension office: Your yearly proof-of-life is due by 31 December. Open the Zinda Hon app or visit the pension office. We never ask for your PIN." },
  { lang: "ur", label: "genuine", area: "Lyari", sender: "8XXX", text: "پنشن آفس: آپ کا اس سال کا ثبوتِ حیات مکمل ہو گیا ہے۔ شکریہ۔" },
  { lang: "en", label: "genuine", area: "Korangi", sender: "8XXX", text: "Pension office: your November pension of Rs 30,000 has been credited to your bank account." },
  { lang: "en", label: "genuine", area: "Malir", sender: "8XXX", text: "Reminder: Free eye camp for pensioners at the pension office on Saturday 10am." },
  { lang: "roman", label: "genuine", area: "Korangi", sender: "8XXX", text: "Pension office: aap ka saal ka saboot-e-hayat 15 December tak baqi hai. Zinda Hon app ya daftar se karwa lein. Hum kabhi PIN nahi maangte." },
  { lang: "ur", label: "genuine", area: "Malir", sender: "8XXX", text: "پنشن آفس: آپ کی دسمبر کی پنشن آپ کے بینک اکاؤنٹ میں جمع کر دی گئی ہے۔ کوئی فیس نہیں ہے۔" },
  { lang: "en", label: "genuine", area: "Gulshan", sender: "8XXX", text: "Pension office: an officer has reviewed your case and approved it. Your pension continues. No action needed." },
  { lang: "roman", label: "genuine", area: "Orangi", sender: "8XXX", text: "Pension office: aap ki selfie saaf nahi thi. Barah-e-karam Zinda Hon app mein dobara tasveer lein ya kisi helper ki madad lein." },
  { lang: "ur", label: "genuine", area: "Lyari", sender: "8XXX", text: "پنشن آفس: آپ کا کیس افسر کے پاس ہے۔ آپ کی پنشن بند نہیں ہوئی۔ ہم جلد رابطہ کریں گے۔" },
  { lang: "en", label: "genuine", area: "Korangi", sender: "8XXX", hard: true, text: "Pension office: beware of fake messages asking for a fee or your PIN. We never charge fees and never ask for codes. Report suspicious messages in the Zinda Hon app." },
  { lang: "roman", label: "genuine", area: "Malir", sender: "8XXX", hard: true, text: "Pension office: khabardar! Koi bhi aap se OTP, PIN ya fee maange to wo dhoka hai. Pension office kabhi aisa nahi karta." },
  { lang: "ur", label: "genuine", area: "Gulshan", sender: "8XXX", hard: true, text: "پنشن آفس: کوئی شخص امداد کے نام پر فیس یا کوڈ مانگے تو ہرگز نہ دیں۔ یہ دھوکہ ہے۔" },
  { lang: "en", label: "genuine", area: "Orangi", sender: "8XXX", text: "Pension office: your helper Rubina can now see your case. You can withdraw this permission anytime in the app under My data." },
  { lang: "roman", label: "genuine", area: "Lyari", sender: "8XXX", text: "Pension office: Itwar ko daftar band rahe ga. Saboot-e-hayat app se kisi bhi waqt ho sakta hai." },
  { lang: "en", label: "genuine", area: "Korangi", sender: "8XXX", hard: true, text: "Pension office: the pension increase of 7% announced in the budget will be added automatically from July. You do not need to apply or pay anything." },
  { lang: "ur", label: "genuine", area: "Malir", sender: "8XXX", text: "پنشن آفس: آپ کی معلومات میں تبدیلی کی درخواست موصول ہو گئی ہے۔ افسر جلد دیکھیں گے۔" },
  { lang: "en", label: "genuine", area: "Gulshan", sender: "8XXX", hard: true, text: "Pension office: we could not verify your pension book QR. Please visit the office with your original book, or call the helpline printed on the book." },

  // ---------- Genuine: banks (they mention OTPs, but to warn, not to ask) ----------
  { lang: "en", label: "genuine", area: "Lyari", sender: "8YYY", text: "Bank: Rs 30,000 received in your account ending 5001 from Pension Office (mock)." },
  { lang: "en", label: "genuine", area: "Korangi", sender: "8YYY", hard: true, text: "Your OTP for login is 482913. Do not share this code with anyone. Bank staff will never ask for it." },
  { lang: "roman", label: "genuine", area: "Malir", sender: "8YYY", hard: true, text: "Bank: aap ke account se Rs 5,000 ATM se nikale gaye. Agar ye aap ne nahi kiya to card ki pusht wale number par call karein." },
  { lang: "ur", label: "genuine", area: "Gulshan", sender: "8YYY", hard: true, text: "بینک: آپ کا او ٹی پی 735120 ہے۔ یہ کوڈ کسی کو نہ بتائیں، بینک کبھی یہ کوڈ نہیں مانگتا۔" },
  { lang: "en", label: "genuine", area: "Orangi", sender: "8YYY", text: "Bank: your debit card ending 5012 will expire next month. Collect your new card from your branch with your CNIC." },
  { lang: "en", label: "genuine", area: "Lyari", sender: "8YYY", text: "Bank: Rs 2,500 paid to K-Electric bill from your account ending 5009. Available balance Rs 21,340." },
  { lang: "roman", label: "genuine", area: "Korangi", sender: "8YYY", text: "Bank: aap ke account mein Rs 27,500 pension jama hui. Shukriya." },
  { lang: "en", label: "genuine", area: "Malir", sender: "8YYY", hard: true, text: "Bank alert: we noticed a login from a new device. If this was not you, call the number on the back of your card. Never share your PIN." },

  // ---------- Genuine: family, neighbours and everyday life ----------
  { lang: "roman", label: "genuine", area: "Lyari", sender: "03000001301", text: "Ammi main kal shaam aaon ga, dawai le kar. Khana bana ke rakhna." },
  { lang: "ur", label: "genuine", area: "Korangi", sender: "03000001302", text: "اماں جان، عید پر بچوں کے ساتھ آ رہے ہیں۔ آپ اپنا خیال رکھیں۔" },
  { lang: "en", label: "genuine", area: "Malir", sender: "03000001303", text: "Aunty, the doctor moved your appointment to Thursday 11am. I will pick you up at 10." },
  { lang: "roman", label: "genuine", area: "Gulshan", sender: "03000001304", hard: true, text: "Khala, Rubina hoon. Kal aap ka saboot-e-hayat app se kar dein ge, apni pension wali kitaab tayyar rakhna." },
  { lang: "roman", label: "genuine", area: "Orangi", sender: "03000001305", text: "Behan ji, masjid mein Jumma ke baad dars hai. Aap bhi aa jana." },
  { lang: "ur", label: "genuine", area: "Lyari", sender: "03000001306", text: "باجی، دودھ والا آج نہیں آئے گا۔ کل صبح آئے گا۔" },
  { lang: "en", label: "genuine", area: "Korangi", sender: "03000001307", text: "Grandma, I passed my exams! Will come show you the result on Sunday." },
  { lang: "roman", label: "genuine", area: "Malir", sender: "03000001308", hard: true, text: "Ammi maine aap ke account mein 3000 bhej diye hain dawai ke liye. Bank wala message aye to check kar lena." },
  { lang: "ur", label: "genuine", area: "Gulshan", sender: "03000001309", text: "محلے کی کمیٹی کی میٹنگ اتوار کو عصر کے بعد ہے۔ ضرور آئیں۔" },
  { lang: "roman", label: "genuine", area: "Orangi", sender: "03000001310", text: "Dukaan par aap ka saman aa gaya hai, chawal aur daal. Jab chahein le jayein." },
  { lang: "en", label: "genuine", area: "Lyari", sender: "03000001311", hard: true, text: "Hi Aunty, this is Dr. Ahmed's clinic. Your blood test report is ready. Please collect it with your slip. No payment due." },
  { lang: "roman", label: "genuine", area: "Korangi", sender: "03000001312", text: "Bhai jaan, Abbu ki barsi par Quran khwani Jumeraat ko hai. Aap sab ko dawat hai." },
  { lang: "ur", label: "genuine", area: "Malir", sender: "03000001313", text: "امی، میں نے آپ کے فون میں زندہ ہوں ایپ ڈال دی ہے۔ ہرے بٹن کو دبانا ہے بس۔" },
  { lang: "en", label: "genuine", area: "Gulshan", sender: "03000001314", text: "K-Electric: planned maintenance in your area on Tuesday 9am to 1pm. We regret the inconvenience." },
  { lang: "roman", label: "genuine", area: "Orangi", sender: "03000001315", hard: true, text: "Amma ji, main Imran dukaan wala. Aap ka pension wala message check kar liya, wo asli hai, fikar na karein." },
  { lang: "en", label: "genuine", area: "Lyari", sender: "03000001316", text: "Union council: free polio drops for children this Monday at the community centre." },
  { lang: "ur", label: "genuine", area: "Korangi", sender: "03000001317", hard: true, text: "یونین کونسل: زندہ ہونے کے سرٹیفکیٹ کے لیے دفتر آئیں، اصل شناختی کارڈ ساتھ لائیں۔ کوئی فیس نہیں۔" },
  { lang: "roman", label: "genuine", area: "Malir", sender: "03000001318", text: "Phuppo, Sara ki shaadi ki tareekh 12 January pakki ho gayi. Card jald bhejein ge." },
  { lang: "en", label: "genuine", area: "Gulshan", sender: "03000001319", text: "Pharmacy: your monthly medicines are ready for pickup. Total Rs 1,850, pay at the counter." },
  { lang: "roman", label: "genuine", area: "Orangi", sender: "03000001320", text: "Aapa, kal bijli ka bill jama karwa diya tha. Raseed aap ki almari mein rakh di hai." },
];
