// src/debugShopsApi.ts
// Run: npx ts-node --transpile-only src/debugShopsApi.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== Simulating GET /api/shops ===\n");

  // Test 1: plain findMany (what the route does)
  try {
    const shops = await prisma.shop.findMany({
      orderBy: [{ unit: 'asc' }, { name: 'asc' }],
    });
    console.log(`✓ Plain findMany: ${shops.length} shops`);
  } catch (e: any) {
    console.error("✗ Plain findMany failed:", e.message);
  }

  // Test 2: with keeper include (what shop.routes.ts does)
  try {
    const shops = await prisma.shop.findMany({
      include: {
        keeper: { select: { id: true, name: true } },
        _count: { select: { sales: true } },
      },
      orderBy: [{ unit: 'asc' }, { name: 'asc' }],
    });
    console.log(`✓ With keeper include: ${shops.length} shops`);
    console.log("  Sample:", JSON.stringify(shops[0], null, 2));
  } catch (e: any) {
    console.error("✗ With keeper include failed:", e.message);
    console.error("  Code:", e.code);
  }

  // Test 3: without keeper (fallback)
  try {
    const shops = await prisma.shop.findMany({
      select: { id: true, code: true, name: true, unit: true },
      orderBy: [{ unit: 'asc' }, { name: 'asc' }],
    });
    console.log(`✓ Select only (no include): ${shops.length} shops`);
    console.log("  Sample:", shops[0]);
  } catch (e: any) {
    console.error("✗ Select only failed:", e.message);
  }
}

main().finally(() => prisma.$disconnect());
