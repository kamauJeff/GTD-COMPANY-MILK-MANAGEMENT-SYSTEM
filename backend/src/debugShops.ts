// src/debugShops.ts
// Run: npx ts-node --transpile-only src/debugShops.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking DB connection & shops table ===\n");

  try {
    // Raw count
    const count = await prisma.shop.count();
    console.log(`Shop count: ${count}`);

    if (count === 0) {
      console.log("\nTable is EMPTY. Inserting one test shop...");
      const s = await prisma.shop.create({
        data: { code: "TEST_001", name: "TEST SHOP", unit: "KCU" }
      });
      console.log("Created:", s);
      console.log("\nNow run seedShops.ts again.");
      return;
    }

    // List first 10
    const shops = await prisma.shop.findMany({ take: 10, orderBy: { id: 'asc' } });
    console.log(`\nFirst ${shops.length} shops:`);
    shops.forEach(s => console.log(`  [${s.id}] ${s.code} | ${s.name} | unit=${s.unit}`));

    // Check unit field specifically
    const withUnit = await prisma.shop.count({ where: { unit: { not: null } } });
    const noUnit   = await prisma.shop.count({ where: { unit: null } });
    console.log(`\nWith unit set: ${withUnit}`);
    console.log(`Without unit:  ${noUnit}`);

    // Group by unit
    const units = await prisma.$queryRaw<{unit:string,cnt:number}[]>`
      SELECT unit, COUNT(*) as cnt FROM dbo.Shop GROUP BY unit
    `;
    console.log("\nShops by unit:", units);

  } catch (e: any) {
    console.error("ERROR:", e.message);
    console.error("Code:", e.code);
  }
}

main().finally(() => prisma.$disconnect());
