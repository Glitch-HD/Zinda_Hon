// Seed data. PROTOTYPE ONLY: every name, CNIC, phone number and amount below is invented.
// Mock CNICs all start with 00000 so they can never be a real Pakistani CNIC.
// The data is deliberately messy (Challenge 03): spelling variants, a missing CNIC,
// a duplicate person, a 104-year-old "ghost pensioner" and a person with a death record.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeName } from "../lib/names";
import { DEFAULT_RULE_CONFIG } from "../lib/decision";

const prisma = new PrismaClient();
const YEAR = 2026;
const DEMO_PASSWORD = "demo1234";
const DEMO_PIN = "1234";

// Pensioners log in with their pension book QR + face, or a 4-digit PIN as backup.
// Runs on every deploy so databases seeded before PINs existed get one too.
async function ensurePensionerPins() {
  const users = await prisma.user.findMany({ where: { role: "PENSIONER", pinHash: null }, select: { id: true } });
  if (!users.length) return;
  const pinHash = await bcrypt.hash(DEMO_PIN, 10);
  await prisma.user.updateMany({ where: { id: { in: users.map((u) => u.id) } }, data: { pinHash } });
  console.log(`Set demo PIN for ${users.length} pensioner account(s).`);
}


// More example people with a range of names (widows and retired workers, women and men), added on
// every deploy if missing so older databases get them too. Two of them have app accounts and pension
// books for the demo login. All invented; CNICs start with 00000.
const EXTRA_PEOPLE = [
  { pensionNo: "PEN-K-1011", name: "Sakina Baloch", nameUr: "سکینہ بلوچ", cnic: "00000-1000011-4", spouse: "Late Dad Muhammad", dob: "1956-08-08", type: "family", amount: 27500, bank: "MB-5011", area: "Lyari", phone: "03000000007",
    nadra: { name: "Sakeena Baloch", spouse: "Dad Mohammad" } },
  { pensionNo: "PEN-K-1012", name: "Ghulam Rasool", nameUr: "غلام رسول", cnic: "00000-1000012-5", spouse: undefined, dob: "1949-02-17", type: "self", amount: 45000, bank: "MB-5012", area: "Korangi", phone: "03000000008",
    nadra: { name: "Gh. Rasool", spouse: undefined } },
  { pensionNo: "PEN-K-1013", name: "Mumtaz Begum", nameUr: "ممتاز بیگم", cnic: "00000-1000013-6", spouse: "Late Iqbal Hussain", dob: "1950-10-03", type: "family", amount: 26500, bank: "MB-5013", area: "Lyari",
    nadra: { name: "Mumtaz Begam", spouse: "Iqbal Husain" } },
  { pensionNo: "PEN-K-1014", name: "Allah Rakhi", nameUr: "اللہ رکھی", cnic: "00000-1000014-7", spouse: "Late Muhammad Bakhsh", dob: "1947-06-21", type: "family", amount: 24000, bank: "MB-5014", area: "Malir",
    nadra: { name: "Allah Rakhee", spouse: "M. Bux" } },
  { pensionNo: "PEN-K-1015", name: "Abdul Ghafoor", nameUr: "عبدالغفور", cnic: "00000-1000015-8", spouse: undefined, dob: "1952-12-11", type: "self", amount: 39000, bank: "MB-5015", area: "Orangi",
    nadra: { name: "Abdul Ghafur", spouse: undefined } },
  { pensionNo: "PEN-K-1016", name: "Nasreen Akhtar", nameUr: "نسرین اختر", cnic: "00000-1000016-9", spouse: "Late Javed Iqbal", dob: "1958-03-29", type: "family", amount: 28500, bank: "MB-5016", area: "Lyari",
    nadra: { name: "Nasrin Akhter", spouse: "Javaid Iqbal" } },
  { pensionNo: "PEN-K-1017", name: "Kaneez Fatima", nameUr: "کنیز فاطمہ", cnic: "00000-1000017-1", spouse: "Late Syed Anwar Ali", dob: "1951-01-15", type: "family", amount: 31000, bank: "MB-5017", area: "Gulshan",
    nadra: { name: "Kaniz Fatima", spouse: "Syed Anwer Ali" } },
  { pensionNo: "PEN-K-1018", name: "Razia Sultana", nameUr: "رضیہ سلطانہ", cnic: "00000-1000018-2", spouse: "Late Khalid Mehmood", dob: "1954-09-09", type: "family", amount: 29500, bank: "MB-5018", area: "Lyari",
    nadra: { name: "Razia Sultan", spouse: "Khalid Mahmood" } },
];

async function ensureExtraPeople() {
  const karachi = await prisma.tenant.findFirst({ where: { name: "Mock Pension Office, Karachi" } });
  const helper = await prisma.user.findUnique({ where: { phone: "03000000004" } });
  if (!karachi || !helper) return;
  let added = 0;
  for (const p of EXTRA_PEOPLE) {
    if (await prisma.pensioner.findUnique({ where: { pensionNo: p.pensionNo } })) continue;
    let userId: string | undefined;
    if (p.phone && !(await prisma.user.findUnique({ where: { phone: p.phone } }))) {
      const u = await prisma.user.create({ data: { tenantId: karachi.id, role: "PENSIONER", name: `${p.name} (mock)`, phone: p.phone, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10), area: p.area } });
      userId = u.id;
    }
    const pensioner = await prisma.pensioner.create({
      data: {
        tenantId: karachi.id, userId, pensionNo: p.pensionNo, cnicMock: p.cnic, name: p.name, nameUr: p.nameUr, nameNormalized: normalizeName(p.name),
        fatherOrHusbandName: p.spouse, dateOfBirth: new Date(p.dob), pensionType: p.type, monthlyAmount: p.amount, bankAccountNo: p.bank, area: p.area,
      },
    });
    await prisma.mockNadraRecord.create({ data: { cnic: p.cnic, name: p.nadra.name, fatherOrHusbandName: p.nadra.spouse, dateOfBirth: new Date(p.dob), maritalStatus: p.type === "family" ? "widowed" : "married", address: `${p.area}, Karachi (mock)` } });
    if (!(await prisma.mockBankAccount.findUnique({ where: { accountNo: p.bank } }))) {
      await prisma.mockBankAccount.create({ data: { accountNo: p.bank, holderName: p.name.toUpperCase(), cnic: p.cnic, lastActivity: new Date("2026-11-05"), withdrawalsLast90Days: 3 } });
    }
    await prisma.case.create({ data: { tenantId: karachi.id, pensionerId: pensioner.id, year: YEAR, status: "DUE" } });
    if (p.area === "Lyari") {
      await prisma.helperLink.create({ data: { helperId: helper.id, pensionerId: pensioner.id } });
      await prisma.consent.create({ data: { pensionerId: pensioner.id, granteeType: "helper", granteeId: helper.id, granteeName: helper.name, fields: ["name", "case_status", "face", "cnic"] } });
    }
    await prisma.consent.create({ data: { pensionerId: pensioner.id, granteeType: "department", granteeId: karachi.id, granteeName: karachi.name, fields: ["name", "cnic", "bank_account", "face", "case_status"] } });
    added++;
  }
  if (added) console.log(`Added ${added} more example pensioner(s).`);
}

async function main() {
  const existing = await prisma.tenant.count();
  if (existing > 0) {
    console.log("Seed skipped: database already has data.");
    await ensureExtraPeople();
    await ensurePensionerPins();
    return;
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const karachi = await prisma.tenant.create({ data: { name: "Mock Pension Office, Karachi", nameUr: "فرضی پنشن آفس، کراچی" } });
  const hyderabad = await prisma.tenant.create({ data: { name: "Mock Pension Office, Hyderabad", nameUr: "فرضی پنشن آفس، حیدرآباد" } });

  const mkUser = (tenantId: string, role: string, name: string, phone: string, area?: string) =>
    prisma.user.create({ data: { tenantId, role: role as never, name, phone, passwordHash: hash, area } });

  const officer = await mkUser(karachi.id, "OFFICER", "Officer Sana (mock)", "03000000001");
  await mkUser(karachi.id, "ADMIN", "Admin Kamran (mock)", "03000000002");
  await mkUser(karachi.id, "AUDITOR", "Auditor Nadia (mock)", "03000000003");
  const helper = await mkUser(karachi.id, "HELPER", "Helper Rubina (mock social worker)", "03000000004", "Lyari");
  await mkUser(karachi.id, "SHOPKEEPER", "Shopkeeper Imran (mock wallet agent)", "03000000005", "Lyari");
  const widowUser = await mkUser(karachi.id, "PENSIONER", "Zainab Bibi (mock)", "03000000006", "Lyari");
  await mkUser(hyderabad.id, "OFFICER", "Officer Hyderabad (mock)", "03000000011");

  await prisma.ruleVersion.create({
    data: { tenantId: karachi.id, ruleKey: "proof_of_life", version: 1, config: DEFAULT_RULE_CONFIG, createdBy: "system", note: "Initial rules" },
  });
  await prisma.ruleVersion.create({
    data: { tenantId: hyderabad.id, ruleKey: "proof_of_life", version: 1, config: DEFAULT_RULE_CONFIG, createdBy: "system", note: "Initial rules" },
  });

  type P = {
    pensionNo: string; name: string; nameUr?: string; cnic: string | null; spouse?: string; dob: string; type: string;
    amount: number; bank?: string; area: string; userId?: string;
    nadra?: { name: string; cnic: string | null; dob?: string; spouse?: string; marital?: string };
    bankHolder?: string; withdrawals?: number; death?: { date: string };
  };
  const people: P[] = [
    { pensionNo: "PEN-K-1001", name: "Zainab Bibi", nameUr: "زینب بی بی", cnic: "00000-1000001-2", spouse: "Late Muhammad Rafiq", dob: "1952-03-14", type: "family", amount: 30000, bank: "MB-5001", area: "Lyari", userId: widowUser.id,
      nadra: { name: "Zenab Bibi", cnic: "00000-1000001-2", dob: "1952-03-14", spouse: "Mohammad Rafeeq", marital: "widowed" }, bankHolder: "ZAINAB BIBI", withdrawals: 3 },
    { pensionNo: "PEN-K-1002", name: "Fatima Begum", nameUr: "فاطمہ بیگم", cnic: "00000-1000002-4", spouse: "Late Abdul Rasheed", dob: "1948-07-01", type: "family", amount: 28000, bank: "MB-5002", area: "Lyari",
      nadra: { name: "Fatimah Begam", cnic: "00000-1000002-4", dob: "1948-07-01", spouse: "Abdul Rashid", marital: "widowed" }, bankHolder: "FATIMA BEGUM", withdrawals: 3 },
    { pensionNo: "PEN-K-1003", name: "Muhammad Aslam", nameUr: "محمد اسلم", cnic: "00000-1000003-5", dob: "1950-11-20", type: "self", amount: 42000, bank: "MB-5003", area: "Korangi",
      nadra: { name: "Mohd Aslam", cnic: "00000-1000003-5", dob: "1950-11-20" }, bankHolder: "M ASLAM", withdrawals: 3 },
    // Missing CNIC in pension records (bad data).
    { pensionNo: "PEN-K-1004", name: "Ayesha Khatoon", nameUr: "عائشہ خاتون", cnic: null, spouse: "Late Ghulam Hussain", dob: "1955-01-09", type: "family", amount: 25000, bank: "MB-5004", area: "Lyari",
      nadra: { name: "Aisha Khatun", cnic: "00000-1000004-6", dob: "1955-01-09", spouse: "Ghulam Husain", marital: "widowed" }, bankHolder: "AYESHA KHATOON", withdrawals: 2 },
    // Ghost pensioner: death record exists, but money is still being withdrawn.
    { pensionNo: "PEN-K-1005", name: "Noor Muhammad", nameUr: "نور محمد", cnic: "00000-1000005-7", dob: "1940-05-05", type: "self", amount: 38000, bank: "MB-5005", area: "Malir",
      nadra: { name: "Nur Mohammad", cnic: "00000-1000005-7", dob: "1940-05-05" }, bankHolder: "NOOR MUHAMMAD", withdrawals: 3, death: { date: "2024-08-17" } },
    // 104 years old (anomaly).
    { pensionNo: "PEN-K-1006", name: "Rehmat Bibi", nameUr: "رحمت بی بی", cnic: "00000-1000006-8", spouse: "Late Allah Ditta", dob: "1922-02-02", type: "family", amount: 22000, bank: "MB-5006", area: "Lyari",
      nadra: { name: "Rahmat Bibi", cnic: "00000-1000006-8", dob: "1922-02-02", spouse: "Allah Dita", marital: "widowed" }, bankHolder: "REHMAT BIBI", withdrawals: 3 },
    // Duplicate person: same widow registered twice with a different spelling and pension number.
    { pensionNo: "PEN-K-1007", name: "Shamim Akhtar", nameUr: "شمیم اختر", cnic: "00000-1000007-9", spouse: "Late Siddique Ahmed", dob: "1953-09-30", type: "family", amount: 27000, bank: "MB-5007", area: "Korangi",
      nadra: { name: "Shamim Akhtar", cnic: "00000-1000007-9", dob: "1953-09-30", spouse: "Siddiq Ahmad", marital: "widowed" }, bankHolder: "SHAMIM AKHTAR", withdrawals: 3 },
    { pensionNo: "PEN-K-1107", name: "Shameem Akhter", cnic: "00000-1000007-9", spouse: "Late Siddiq Ahmad", dob: "1953-09-30", type: "family", amount: 27000, bank: "MB-5107", area: "Malir",
      bankHolder: "SHAMEEM AKHTER", withdrawals: 3 },
    // CNIC mismatch between pension and NADRA records.
    { pensionNo: "PEN-K-1008", name: "Parveen Akhtar", nameUr: "پروین اختر", cnic: "00000-1000008-1", spouse: "Late Bashir Ahmed", dob: "1957-04-12", type: "family", amount: 26000, bank: "MB-5008", area: "Lyari",
      nadra: { name: "Parveen Akhtar", cnic: "00000-1000088-1", dob: "1957-04-12", spouse: "Bashir Ahmad", marital: "widowed" }, bankHolder: "PARVEEN AKHTAR", withdrawals: 3 },
    // Clean records for the helper's other families.
    { pensionNo: "PEN-K-1009", name: "Khadija Bibi", nameUr: "خدیجہ بی بی", cnic: "00000-1000009-2", spouse: "Late Ghulam Nabi", dob: "1951-12-25", type: "family", amount: 30000, bank: "MB-5009", area: "Lyari",
      nadra: { name: "Khadija Bibi", cnic: "00000-1000009-2", dob: "1951-12-25", spouse: "Ghulam Nabi", marital: "widowed" }, bankHolder: "KHADIJA BIBI", withdrawals: 3 },
    { pensionNo: "PEN-K-1010", name: "Haleema Sadia", nameUr: "حلیمہ سعدیہ", cnic: "00000-1000010-3", spouse: "Late Muhammad Yousuf", dob: "1954-06-18", type: "family", amount: 29000, bank: "MB-5010", area: "Lyari",
      nadra: { name: "Halima Sadia", cnic: "00000-1000010-3", dob: "1954-06-18", spouse: "Mohammed Yusuf", marital: "widowed" }, bankHolder: "HALEEMA SADIA", withdrawals: 3 },
  ];

  for (const p of people) {
    const pensioner = await prisma.pensioner.create({
      data: {
        tenantId: karachi.id, userId: p.userId, pensionNo: p.pensionNo, cnicMock: p.cnic, name: p.name, nameUr: p.nameUr,
        nameNormalized: normalizeName(p.name), fatherOrHusbandName: p.spouse, dateOfBirth: new Date(p.dob), pensionType: p.type,
        monthlyAmount: p.amount, bankAccountNo: p.bank, area: p.area,
      },
    });
    if (p.nadra) {
      await prisma.mockNadraRecord.create({
        data: { cnic: p.nadra.cnic, name: p.nadra.name, fatherOrHusbandName: p.nadra.spouse, dateOfBirth: p.nadra.dob ? new Date(p.nadra.dob) : null, maritalStatus: p.nadra.marital, address: `${p.area}, Karachi (mock)` },
      });
    }
    if (p.bank) {
      await prisma.mockBankAccount.create({
        data: { accountNo: p.bank, holderName: p.bankHolder ?? p.name, cnic: p.cnic, lastActivity: new Date("2026-11-05"), withdrawalsLast90Days: p.withdrawals ?? 0 },
      });
    }
    if (p.death) {
      await prisma.mockDeathRecord.create({ data: { cnic: p.cnic, name: p.nadra?.name ?? p.name, dateOfDeath: new Date(p.death.date), registeredAt: "Union Council Malir (mock)" } });
    }
    await prisma.case.create({ data: { tenantId: karachi.id, pensionerId: pensioner.id, year: YEAR, status: "DUE" } });

    // The helper serves the Lyari families, each with their own consent.
    if (p.area === "Lyari") {
      await prisma.helperLink.create({ data: { helperId: helper.id, pensionerId: pensioner.id } });
      await prisma.consent.create({
        data: { pensionerId: pensioner.id, granteeType: "helper", granteeId: helper.id, granteeName: helper.name, fields: ["name", "case_status", "face", "cnic"] },
      });
    }
    // Every pensioner shares their bank account with the department to receive payments.
    await prisma.consent.create({
      data: { pensionerId: pensioner.id, granteeType: "department", granteeId: karachi.id, granteeName: karachi.name, fields: ["name", "cnic", "bank_account", "face", "case_status"] },
    });
  }

  await prisma.notification.create({ data: { userId: officer.id, title: "Welcome", body: "Proof-of-life season 2026 has started (mock)." } });

  await ensureExtraPeople();
  await ensurePensionerPins();
  console.log(`Seeded 2 tenants, 7 users (password: ${DEMO_PASSWORD}), ${people.length} pensioner records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
