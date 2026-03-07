// backend/src/seedEmployees.ts
// Run: npx ts-node --transpile-only src/seedEmployees.ts
import prisma from './config/prisma';

// ── 35 Graders (K-Unity SACCO) ────────────────────────────────
const graders = [
  { name: 'NICHOLUS MWANGI',            bankAccount: '00411000000302', salary: 16500 },
  { name: 'FREDRICK NJOROGE',           bankAccount: '02111000000078', salary: 12500 },
  { name: 'JOHN KARANJA',               bankAccount: '0041-16952',     salary: 18500 },
  { name: 'JOHN MWANGI MUTHEE',         bankAccount: '00411-299',      salary: 12500 },
  { name: 'FRANCIS GITHURI MUHUHU',     bankAccount: '004153-118',     salary: 12500 },
  { name: 'DAVID NJENGA',               bankAccount: '0041-17084',     salary: 17500 },
  { name: 'JAMES MWANGI',               bankAccount: '02133000000541', salary: 21500 },
  { name: 'FRANCIS WAINAINA',           bankAccount: '00410000017069', salary: 21500 },
  { name: 'JACOB MACHARIA',             bankAccount: '00410000016591', salary: 21500 },
  { name: 'SAMUEL NJUGUNA',             bankAccount: '02110000000351', salary: 21500 },
  { name: 'MICHAEL NJOROGE MUTHAMA',    bankAccount: '02133000000624', salary: 17500 },
  { name: 'STEPHEN KARANJA',            bankAccount: '0041100000301',  salary: 15500 },
  { name: 'JOHN NJOGU',                 bankAccount: '00410000017078', salary: 14500 },
  { name: 'SAMSON WAITHAKA WAINAINA',   bankAccount: '0041-17109',     salary:  9500 },
  { name: 'SAMUEL GICHUKI',             bankAccount: '02111000000084', salary: 32500 },
  { name: "BETHWEL KARANJA NDUNG'U",    bankAccount: '00411-332',      salary: 15500 },
  { name: 'SIMON GITAU MWAURA',         bankAccount: '00411-351',      salary:  2500 },
  { name: 'JAMES MBUGUA GITHURA',       bankAccount: '02111-95',       salary: 15500 },
  { name: 'JOHN MURIGI NJUGUNA',        bankAccount: '02111-94',       salary: 15500 },
  { name: 'EDWARD KAMAU GITHINJI',      bankAccount: '0211-290',       salary: 47500 },
  { name: 'FARAJ MWANDIME',             bankAccount: '02133-601',      salary: 11500 },
  { name: 'JAMES OBAGI BOSIRE',         bankAccount: '00411-396',      salary: 12500 },
  { name: 'BETHWEL KAMUNDIA KURIA',     bankAccount: '02111-098',      salary: 18500 },
  { name: 'DANIEL MUIGAI KARIUKI',      bankAccount: '02133-663',      salary: 12500 },
  { name: 'SIMON WAWERU WANGARI',       bankAccount: '00411-319',      salary: 12500 },
  { name: 'DENIS OREU',                 bankAccount: '00411-391',      salary: 12500 },
  { name: 'JOHN MBUI KINYANJUI',        bankAccount: '00411-402',      salary: 12500 },
  { name: 'SAMSON OLADARU LULU',        bankAccount: '00411-411',      salary: 15500 },
  { name: 'JEFFREY KAMAU NJOKI',        bankAccount: '00711-318',      salary: 32500 },
  { name: 'PAUL KARIUKI MURICHU',       bankAccount: '00410000017018', salary:  2500 },
  { name: 'BENJAMIN MBURU KINYANJUI',   bankAccount: '02111-142',      salary: 12500 },
  { name: 'JOSEPH NJOROGE ESTHER',      bankAccount: '02111-136',      salary: 12500 },
  { name: "PAUL NG'ANG'A NGARUIYA",     bankAccount: '02133-738',      salary: 15000 },
  { name: 'JESSE KARANJA NYAMBURA',     bankAccount: '02111-184',      salary: 12500 },
  { name: 'JOSIAH GITAU BOSIRE',        bankAccount: '02111-182',      salary: 12500 },
];

// ── 38 Shopkeepers (K-Unity SACCO) ───────────────────────────
const shopkeepers = [
  { name: 'DANCAN WAWERU W',          bankAccount: '0071-22351',  salary: 10000 },
  { name: 'WALTER KIPRUTO',           bankAccount: '0071-22322',  salary: 15000 },
  { name: 'PHILIP WAIGANJO',          bankAccount: '002211-171',  salary: 15000 },
  { name: 'JULIUS GACHERU',           bankAccount: '002211-198',  salary: 15000 },
  { name: 'ONESMUS KIRITO',           bankAccount: '00711-326',   salary: 15000 },
  { name: 'DENNIS KABERA',            bankAccount: '002211-207',  salary: 15000 },
  { name: 'NJOROGE MATHU',            bankAccount: '02211-199',   salary: 17000 },
  { name: 'BONIFACE NGIGI',           bankAccount: '00411-601',   salary: 15000 },
  { name: 'DAVID M NGIGI',            bankAccount: '0071-22378',  salary: 15000 },
  { name: 'JOHN NJOROGE',             bankAccount: '02211-208',   salary: 15000 },
  { name: 'JOSEPH LUSWETI',           bankAccount: '02211-209',   salary: 10000 },
  { name: 'JAMES BORO',               bankAccount: '0071-22348',  salary:  9000 },
  { name: 'PATRICK KAMAU',            bankAccount: '00711-319',   salary: 15000 },
  { name: 'JAMES MAINA',              bankAccount: '0071-22355',  salary: 15000 },
  { name: 'PAUL MWIKO',               bankAccount: '02211-618',   salary: 15500 },
  { name: 'KELVIN MWAURA G',          bankAccount: '0071-22396',  salary: 15000 },
  { name: 'JOSEPH KAHIGA',            bankAccount: '0071-22458',  salary: 10000 },
  { name: 'SAMUEL MWANGI',            bankAccount: '02211-238',   salary: 15000 },
  { name: 'JOSEPH KAMAU',             bankAccount: '00633-899',   salary: 17000 },
  { name: 'MBUGUA KINUNGI',           bankAccount: '0071-22457',  salary: 15000 },
  { name: 'PETERSON KARIUKI',         bankAccount: '00633-894',   salary: 16000 },
  { name: 'JOSEPH KIMANI',            bankAccount: '00611-576',   salary: 16000 },
  { name: 'FRANCIS NDUNGU',           bankAccount: '00611-537',   salary: 16000 },
  { name: 'MWAURA GATUMA',            bankAccount: '02211-269',   salary:  8000 },
  { name: 'PETER WANJIRU',            bankAccount: '02211-262',   salary:  8000 },
  { name: 'JOHN NJOROGE K',           bankAccount: '0071-22556',  salary:  9578 },
  { name: 'SIMON CHEGE',              bankAccount: '0071-21940',  salary: 29000 },
  { name: 'JEREMIAH KAREITHI',        bankAccount: '0071-22558',  salary: 15000 },
  { name: 'PETER GATHUO',             bankAccount: '00411-697',   salary: 15000 },
  { name: 'SAMUEL NJOROGE M',         bankAccount: '0071-22541',  salary: 12000 },
  { name: 'KIMANI GITHINJI',          bankAccount: '00733-1037',  salary: 14415 },
  { name: 'GATHURA PAUL KINYANJUI',   bankAccount: '0071-22598',  salary: 15000 },
  { name: 'PETER NJAMBA',             bankAccount: '0071-22627',  salary: 15000 },
  { name: 'HARUN KARUKU WAMBUI',      bankAccount: '0071-22621',  salary:  6500 },
  { name: 'JOSEPH NJUGUNA NJERI',     bankAccount: '0071-22645',  salary:  8000 },
  { name: 'PETER N KAHIGA',           bankAccount: '02211-324',   salary: 15000 },
  { name: 'BENJAMIN KAGWI',           bankAccount: '00711-325',   salary: 11115 },
  { name: 'EVANS KIPCHUMBA',          bankAccount: '02211-335',   salary:  5000 },
];

function makeCode(role: string, index: number): string {
  const prefix = role === 'GRADER' ? 'GR' : 'SK';
  return `${prefix}${String(index).padStart(3, '0')}`;
}

async function main() {
  console.log('=== Seeding Employees ===\n');

  let created = 0, updated = 0;

  const upsertEmployee = async (data: any, role: string, idx: number) => {
    const code = makeCode(role, idx);
    const existing = await prisma.employee.findUnique({ where: { code } });
    const payload = {
      code,
      name:          data.name,
      phone:         '0000000000', // placeholder — update individually later
      role,
      salary:        data.salary,
      paymentMethod: 'K-UNITY',
      bankName:      'K-Unity SACCO',
      bankAccount:   data.bankAccount.replace(/^;/, '').trim(), // strip leading semicolons
      isActive:      true,
    };
    if (existing) {
      await prisma.employee.update({ where: { code }, data: payload });
      updated++;
    } else {
      await prisma.employee.create({ data: { ...payload, passwordHash: '' } as any });
      created++;
    }
    console.log(`  ${existing ? '↺' : '✓'} [${code}] ${data.name} — KES ${data.salary.toLocaleString()}`);
  };

  console.log('--- GRADERS ---');
  for (let i = 0; i < graders.length; i++) {
    await upsertEmployee(graders[i], 'GRADER', i + 1);
  }

  console.log('\n--- SHOPKEEPERS ---');
  for (let i = 0; i < shopkeepers.length; i++) {
    await upsertEmployee(shopkeepers[i], 'SHOPKEEPER', i + 1);
  }

  const total = await prisma.employee.count({ where: { isActive: true } });
  console.log(`\n✓ Done — ${created} created, ${updated} updated`);
  console.log(`Total active employees in DB: ${total}`);
  console.log('\nNote: Phone numbers are placeholders (0000000000).');
  console.log('Update them individually via the Staff Payroll page.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
