// src/controllers/farmer.controller.ts
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export async function getFarmers(req: Request, res: Response) {
  const { routeId, search, page = '1', limit = '50' } = req.query;
  const where: any = { isActive: true };
  if (routeId) where.routeId = Number(routeId);
  if (search) where.name = { contains: String(search) };

  const [total, farmers] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.farmer.findMany({
      where,
      include: { route: { select: { id: true, code: true, name: true } } },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { name: 'asc' },
    }),
  ]);

  res.json({ data: farmers, total, page: Number(page), limit: Number(limit) });
}

export async function getFarmer(req: Request, res: Response) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      route: true,
      collections: { orderBy: { collectedAt: 'desc' }, take: 31 },
      advances: { orderBy: { advanceDate: 'desc' }, take: 10 },
    },
  });
  if (!farmer) throw new AppError(404, 'Farmer not found');
  res.json(farmer);
}

export async function createFarmer(req: Request, res: Response) {
  const farmer = await prisma.farmer.create({ data: req.body });
  res.status(201).json(farmer);
}

export async function updateFarmer(req: Request, res: Response) {
  const farmer = await prisma.farmer.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.json(farmer);
}

export async function deleteFarmer(req: Request, res: Response) {
  await prisma.farmer.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.json({ message: 'Farmer deactivated' });
}

// ─── Excel Import ──────────────────────────────────────────────────────────────
export async function importFarmers(req: Request, res: Response) {
  if (!req.file) throw new AppError(400, 'No file uploaded');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const ws = wb.worksheets[0];

  const rows: any[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const code = String(row.getCell(1).value ?? '').trim();
    const name = String(row.getCell(2).value ?? '').trim();
    if (!code || !name) return;
    rows.push({
      code,
      name,
      idNumber:      String(row.getCell(3).value ?? '').trim() || null,
      phone:         String(row.getCell(4).value ?? '').trim(),
      routeId:       Number(row.getCell(5).value),
      pricePerLitre: Number(row.getCell(6).value) || 46,
      paymentMethod: String(row.getCell(7).value ?? 'MPESA').toUpperCase().trim(),
      mpesaPhone:    String(row.getCell(8).value ?? '').trim() || null,
      bankName:      String(row.getCell(9).value ?? '').trim() || null,
      bankAccount:   String(row.getCell(10).value ?? '').trim() || null,
      paidOn15th:    String(row.getCell(11).value ?? '').toLowerCase() === 'yes',
    });
  });

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const data of rows) {
    try {
      if (!data.routeId || isNaN(data.routeId)) {
        errors.push(`Row for ${data.code}: invalid routeId`);
        skipped++;
        continue;
      }
      const existing = await prisma.farmer.findUnique({ where: { code: data.code } });
      if (existing) {
        await prisma.farmer.update({ where: { code: data.code }, data });
        updated++;
      } else {
        await prisma.farmer.create({ data });
        created++;
      }
    } catch (e: any) {
      errors.push(`Row for ${data.code}: ${e.message}`);
      skipped++;
    }
  }

  res.json({ message: `Import complete`, created, updated, skipped, errors: errors.slice(0, 20) });
}

// ─── Excel Export ──────────────────────────────────────────────────────────────
export async function exportFarmers(req: Request, res: Response) {
  const farmers = await prisma.farmer.findMany({
    where: { isActive: true },
    include: { route: true },
    orderBy: { name: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Farmers');
  ws.columns = [
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'ID Number', key: 'idNumber', width: 16 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Route', key: 'route', width: 20 },
    { header: 'Price/Litre', key: 'pricePerLitre', width: 12 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'M-Pesa Phone', key: 'mpesaPhone', width: 16 },
    { header: 'Paid on 15th', key: 'paidOn15th', width: 12 },
  ];

  farmers.forEach((f) =>
    ws.addRow({
      ...f,
      route: f.route.name,
      paidOn15th: f.paidOn15th ? 'Yes' : 'No',
    })
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=farmers.xlsx');
  await wb.xlsx.write(res);
  res.end();
}
