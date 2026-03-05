import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Gutoria Dairies...');

  const passwordHash = await bcrypt.hash('Admin@2024', 12);
  await prisma.employee.upsert({
    where: { code: 'ADMIN001' },
    update: {},
    create: { code: 'ADMIN001', name: 'Jeff Kamau', phone: '0700000001', role: 'ADMIN', salary: 0, passwordHash, paymentMethod: 'MPESA', isActive: true },
  });
  console.log('Admin created: ADMIN001');

  const graderHash = await bcrypt.hash('Grader@2024', 12);
  const grader = await prisma.employee.upsert({
    where: { code: 'GRD001' },
    update: {},
    create: { code: 'GRD001', name: 'Peter Mwangi', phone: '0711000001', role: 'GRADER', salary: 25000, passwordHash: graderHash, paymentMethod: 'MPESA', mpesaPhone: '0711000001', isActive: true },
  });
  console.log('Grader created: GRD001');

  const routeNames = [
    { code: 'RT001', name: 'Kiambu North' },
    { code: 'RT002', name: 'Kiambu South' },
    { code: 'RT003', name: 'Limuru East' },
    { code: 'RT004', name: 'Tigoni' },
    { code: 'RT005', name: 'Lari' },
  ];
  const routes = [];
  for (const r of routeNames) {
    const route = await prisma.route.upsert({ where: { code: r.code }, update: {}, create: r });
    routes.push(route);
    console.log('Route created:', r.code, '-', r.name);
  }

  const farmersData = [
    { code: 'F001', name: 'John Kariuki',   phone: '0722111001', idx: 0, price: 45 },
    { code: 'F002', name: 'Mary Wanjiku',   phone: '0722111002', idx: 0, price: 45 },
    { code: 'F003', name: 'James Njoroge',  phone: '0722111003', idx: 1, price: 44 },
    { code: 'F004', name: 'Grace Waithira', phone: '0722111004', idx: 1, price: 44 },
    { code: 'F005', name: 'Samuel Kamau',   phone: '0722111005', idx: 2, price: 46 },
    { code: 'F006', name: 'Alice Muthoni',  phone: '0722111006', idx: 2, price: 46 },
    { code: 'F007', name: 'David Gitau',    phone: '0722111007', idx: 3, price: 45 },
    { code: 'F008', name: 'Rose Njeri',     phone: '0722111008', idx: 3, price: 45 },
  ];
  for (const f of farmersData) {
    await prisma.farmer.upsert({
      where: { code: f.code },
      update: {},
      create: { code: f.code, name: f.name, phone: f.phone, routeId: routes[f.idx].id, pricePerLitre: f.price, paymentMethod: 'MPESA', mpesaPhone: f.phone, isActive: true },
    });
    console.log('Farmer created:', f.code, '-', f.name);
  }

  const allFarmers = await prisma.farmer.findMany();
  let count = 0;
  for (let daysAgo = 2; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(7, 0, 0, 0);
    for (const farmer of allFarmers) {
      const litres = parseFloat((Math.random() * 15 + 5).toFixed(1));
      await prisma.milkCollection.create({ data: { farmerId: farmer.id, routeId: farmer.routeId, graderId: grader.id, litres, collectedAt: date, synced: true } });
      count++;
    }
  }
  console.log('Collections created:', count);

  console.log('\nDone! Login with:');
  console.log('  Admin  -> ADMIN001 / Admin@2024');
  console.log('  Grader -> GRD001   / Grader@2024');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());