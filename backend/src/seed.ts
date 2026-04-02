// src/seed.ts — seeds Gutoria (dairyId=1) with test data
import { prisma } from './config/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const dairyId = 1;

  // Admin
  await prisma.employee.upsert({
    where: { dairyId_code: { dairyId, code: 'ADMIN001' } },
    create: { dairyId, code: 'ADMIN001', name: 'Gutoria Admin', phone: '254700000000', role: 'ADMIN', salary: 0, passwordHash: await bcrypt.hash('gutoria2024', 12), paymentMethod: 'MPESA', isActive: true },
    update: {},
  });

  // Grader
  await prisma.employee.upsert({
    where: { dairyId_code: { dairyId, code: 'GR001' } },
    create: { dairyId, code: 'GR001', name: 'Test Grader', phone: '254711111111', role: 'GRADER', salary: 15000, passwordHash: await bcrypt.hash('grader2024', 12), paymentMethod: 'MPESA', mpesaPhone: '254711111111', isActive: true },
    update: {},
  });

  // Route
  const route = await prisma.route.upsert({
    where: { dairyId_code: { dairyId, code: 'R01' } },
    create: { dairyId, code: 'R01', name: 'Test Route' },
    update: {},
  });

  // Farmer
  await prisma.farmer.upsert({
    where: { dairyId_code: { dairyId, code: 'FM0001' } },
    create: { dairyId, code: 'FM0001', name: 'Test Farmer', phone: '254722222222', routeId: route.id, pricePerLitre: 50, paymentMethod: 'MPESA', mpesaPhone: '254722222222', isActive: true },
    update: {},
  });

  console.log('✅ Seed complete for dairyId=1 (Gutoria)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
