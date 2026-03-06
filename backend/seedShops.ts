// backend/src/seedShops.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding 64 shops...");
  const shops = [
    { code: "KCU_FREEAREA", name: "FREE AREA", unit: "KCU" },
    { code: "KCU_KABIRIA", name: "KABIRIA", unit: "KCU" },
    { code: "KCU_MARATHON", name: "MARATHON", unit: "KCU" },
    { code: "KCU_MODERNA", name: "MODERN A", unit: "KCU" },
    { code: "KCU_MODERNB", name: "MODERN B", unit: "KCU" },
    { code: "KCU_MUGENI", name: "MUGENI", unit: "KCU" },
    { code: "KCU_MUHORO", name: "MUHORO", unit: "KCU" },
    { code: "KCU_NEWLARI", name: "NEW LARI", unit: "KCU" },
    { code: "KCU_SATTELITE", name: "SATTELITE", unit: "KCU" },
    { code: "KCU_UPLAND1", name: "UPLAND 1", unit: "KCU" },
    { code: "KCU_UPLAND2", name: "UPLAND 2", unit: "KCU" },
    { code: "KCU_UPLAND3", name: "UPLAND 3", unit: "KCU" },
    { code: "KCU_SPARKS", name: "SPARKS", unit: "KCU" },
    { code: "KCU_EZEKIEL", name: "EZEKIEL", unit: "KCU" },
    { code: "KCQ_CHEGE", name: "CHEGE", unit: "KCQ" },
    { code: "KCQ_COAST", name: "COAST", unit: "KCQ" },
    { code: "KCQ_COLLIN", name: "COLLIN", unit: "KCQ" },
    { code: "KCQ_CONGO", name: "CONGO", unit: "KCQ" },
    { code: "KCQ_GIKAMBURA", name: "GIKAMBURA", unit: "KCQ" },
    { code: "KCQ_HARMED", name: "HARMED", unit: "KCQ" },
    { code: "KCQ_JANEA", name: "JANE A", unit: "KCQ" },
    { code: "KCQ_JANEB", name: "JANE B", unit: "KCQ" },
    { code: "KCQ_KARIS", name: "KARIS", unit: "KCQ" },
    { code: "KCQ_LANGAT", name: "LANG\'AT", unit: "KCQ" },
    { code: "KCQ_MURAGE", name: "MURAGE", unit: "KCQ" },
    { code: "KCQ_MWANGI", name: "MWANGI", unit: "KCQ" },
    { code: "KCQ_NGINA2", name: "NGINA 2", unit: "KCQ" },
    { code: "KCQ_NGINARD", name: "NGINA RD", unit: "KCQ" },
    { code: "KCQ_NJENGA", name: "NJENGA", unit: "KCQ" },
    { code: "KCQ_RUTHIGITI", name: "RUTHIGITI", unit: "KCQ" },
    { code: "KCQ_SOKO", name: "SOKO", unit: "KCQ" },
    { code: "KCQ_UPLAND56", name: "UPLAND 56", unit: "KCQ" },
    { code: "KCQ_UPLANDK", name: "UPLAND K", unit: "KCQ" },
    { code: "KDE_BETH", name: "BETH", unit: "KDE" },
    { code: "KDE_BRAYO", name: "BRAYO", unit: "KDE" },
    { code: "KDE_COLLEGE", name: "COLLEGE", unit: "KDE" },
    { code: "KDE_CARWASH", name: "CARWASH", unit: "KDE" },
    { code: "KDE_CORNER", name: "CORNER", unit: "KDE" },
    { code: "KDE_KIKUYU", name: "KIKUYU", unit: "KDE" },
    { code: "KDE_MITHONGE", name: "MITHONGE", unit: "KDE" },
    { code: "KDE_NDWARU", name: "NDWARU", unit: "KDE" },
    { code: "KDE_NGANDOA", name: "NGANDO A", unit: "KDE" },
    { code: "KDE_NGANDOB", name: "NGANDO B", unit: "KDE" },
    { code: "KDE_NGANDOC", name: "NGANDO C", unit: "KDE" },
    { code: "KDE_SAMMY", name: "SAMMY", unit: "KDE" },
    { code: "KDE_THOGOTO", name: "THOGOTO", unit: "KDE" },
    { code: "KDE_TONYA", name: "TONY A", unit: "KDE" },
    { code: "KCN_GEORGE", name: "GEORGE", unit: "KCN" },
    { code: "KCN_KEN", name: "KEN", unit: "KCN" },
    { code: "KCN_MM1", name: "MM1", unit: "KCN" },
    { code: "KCN_MM2", name: "MM2", unit: "KCN" },
    { code: "KCN_MM3", name: "MM3", unit: "KCN" },
    { code: "KCN_POLICE", name: "POLICE", unit: "KCN" },
    { code: "KCN_MUGENI", name: "MUGENI", unit: "KCN" },
    { code: "KCN_NJUGUNA", name: "NJUGUNA", unit: "KCN" },
    { code: "KCN_PETER", name: "PETER", unit: "KCN" },
    { code: "KBP_JUJATOWN", name: "JUJA TOWN", unit: "KBP" },
    { code: "KBP_JUJAFARMEVAN", name: "JUJA FARM-evans", unit: "KBP" },
    { code: "KBP_JUJAGATECJIM", name: "JUJA GATE C-jimmy", unit: "KBP" },
    { code: "KBP_LAICAGACHORO", name: "LAICA GACHORORO-njau", unit: "KBP" },
    { code: "KBP_KAMAU", name: "KAMAU", unit: "KBP" },
    { code: "KBP_HIGHLAND", name: "Highland", unit: "KBP" },
    { code: "OTHERS_PAUL", name: "PAUL", unit: "OTHERS" },
    { code: "OTHERS_GICHUKI", name: "GICHUKI", unit: "OTHERS" },
  ];
  let created = 0;
  for (const s of shops) {
    try {
      await prisma.shop.upsert({
        where: { code: s.code },
        update: { name: s.name, unit: s.unit },
        create: { code: s.code, name: s.name, unit: s.unit },
      });
      created++;
    } catch (e: any) { console.error(`  Failed: ${s.code} - ${e.message}`); }
  }
  console.log(`Done! ${created}/64 shops seeded.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());