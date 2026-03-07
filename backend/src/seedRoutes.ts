// backend/src/seedRoutes.ts
// Run: npx ts-node --transpile-only src/seedRoutes.ts
import prisma from './config/prisma';

const realRoutes = [
  { code: 'RT001', name: 'KARIAINI' },
  { code: 'RT002', name: 'KAMAE' },
  { code: 'RT003', name: 'SULMAC' },
  { code: 'RT004', name: 'KAGERAINI' },
  { code: 'RT005', name: 'GATHWARIGA' },
  { code: 'RT006', name: 'ITOMBOYA' },
  { code: 'RT007', name: 'RURII' },
  { code: 'RT008', name: 'KADAI' },
  { code: 'RT009', name: 'BENKA' },
  { code: 'RT010', name: 'MAGANA MERI' },
  { code: 'RT011', name: 'THIRIRIKA' },
  { code: 'RT012', name: 'AMIGO' },
  { code: 'RT013', name: 'HEROES' },
  { code: 'RT014', name: 'NGUMO' },
  { code: 'RT015', name: 'GATAMAIYU' },
  { code: 'RT016', name: 'MUIRI' },
  { code: 'RT017', name: 'GITHOITO' },
  { code: 'RT018', name: 'BURUGU' },
  { code: 'RT019', name: 'KARIKO' },
  { code: 'RT020', name: 'KIANDUTU' },
  { code: 'RT021', name: 'KAGUONGO' },
  { code: 'RT022', name: 'HATO' },
  { code: 'RT023', name: 'CIRINGI IKUMI' },
  { code: 'RT024', name: 'MUSEVENI' },
  { code: 'RT025', name: "KING'ARATUA" },
  { code: 'RT026', name: 'BATHI' },
  { code: 'RT027', name: 'NDURIRI' },
  { code: 'RT028', name: 'KANGUCHU' },
  { code: 'RT029', name: 'EVENING SHIFT' },
];

async function main() {
  console.log('=== Gutoria Routes Dedup Fix ===\n');

  // Step 1: Get all routes currently in DB
  const allRoutes = await prisma.route.findMany({ orderBy: { id: 'asc' } });
  console.log(`Found ${allRoutes.length} routes in DB\n`);

  // Step 2: Group by name — keep the one with RT0XX code, or lowest id
  const byName = new Map<string, typeof allRoutes>();
  for (const r of allRoutes) {
    const key = r.name.trim().toUpperCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r);
  }

  let moved = 0, deletedRoutes = 0;

  for (const [name, group] of byName.entries()) {
    if (group.length <= 1) continue;

    // Prefer the RT0XX coded one, else lowest id
    const keeper = group.find(r => /^RT\d{3}$/.test(r.code))
      ?? group.sort((a, b) => a.id - b.id)[0];
    const dupes = group.filter(r => r.id !== keeper.id);

    console.log(`"${name}": keeping id=${keeper.id} (${keeper.code}), removing ${dupes.map(d => `id=${d.id}`).join(', ')}`);

    for (const dupe of dupes) {
      // Move farmers
      const f = await prisma.farmer.updateMany({ where: { routeId: dupe.id }, data: { routeId: keeper.id } });
      if (f.count > 0) { console.log(`  → Moved ${f.count} farmers`); moved += f.count; }

      // Move collections
      await prisma.milkCollection.updateMany({ where: { routeId: dupe.id }, data: { routeId: keeper.id } });

      // Delete dupe
      await prisma.route.delete({ where: { id: dupe.id } });
      deletedRoutes++;
    }
  }

  // Step 3: Fix codes on keepers to match RT0XX
  for (const real of realRoutes) {
    const existing = await prisma.route.findFirst({ where: { name: real.name } });
    if (existing && existing.code !== real.code) {
      await prisma.route.update({ where: { id: existing.id }, data: { code: real.code } });
      console.log(`  Fixed code: "${real.name}" → ${real.code}`);
    }
  }

  const total = await prisma.route.count();
  console.log(`\n✓ Moved ${moved} farmers, deleted ${deletedRoutes} duplicate routes`);
  console.log(`Total routes in DB: ${total} (should be 29)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
