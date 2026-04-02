// src/controllers/farmer.controller.ts
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// Format phone to 254XXXXXXXXX
function formatPhone(phone: string): string {
  if (!phone) return '';
  const p = String(phone).replace(/\s+/g, '').replace(/^\'+/, '');
  if (p.startsWith('254') && p.length >= 12) return p.substring(0, 12);
  if (p.startsWith('0') && p.length === 10) return '254' + p.substring(1);
  if (p.startsWith('+254')) return p.substring(1, 13);
  if (p.length === 9) return '254' + p;
  return p;
}

export async function getFarmers(req: Request, res: Response) {
  const { routeId, search, page = '1', limit = '50', isActive } = req.query;
  const where: any = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  else where.isActive = true;
  if (routeId) where.routeId = Number(routeId);
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { code: { contains: String(search), mode: 'insensitive' } },
      { phone: { contains: String(search) } },
    ];
  }

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
    where: { dairyId: req.dairyId!, id: Number(req.params.id) },
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
  const data = { ...req.body, phone: formatPhone(req.body.phone), mpesaPhone: formatPhone(req.body.mpesaPhone || req.body.phone) };
  const farmer = await prisma.farmer.create({ data });
  res.status(201).json(farmer);
}

export async function updateFarmer(req: Request, res: Response) {
  const data = { ...req.body };
  if (data.phone) data.phone = formatPhone(data.phone);
  if (data.mpesaPhone) data.mpesaPhone = formatPhone(data.mpesaPhone);
  const farmer = await prisma.farmer.update({ where: { id: Number(req.params.id) }, data });
  res.json(farmer);
}

export async function deleteFarmer(req: Request, res: Response) {
  await prisma.farmer.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ message: 'Farmer deactivated' });
}

// Fix all existing phone numbers to 254 format
export async function fixPhoneNumbers(req: Request, res: Response) {
  const farmers = await prisma.farmer.findMany({ select: { id: true, phone: true, mpesaPhone: true } });
  let updated = 0;
  for (const f of farmers) {
    const phone = formatPhone(f.phone);
    const mpesaPhone = f.mpesaPhone ? formatPhone(f.mpesaPhone) : phone;
    if (phone !== f.phone || mpesaPhone !== f.mpesaPhone) {
      await prisma.farmer.update({ where: { id: f.id }, data: { phone, mpesaPhone } });
      updated++;
    }
  }
  res.json({ message: `Fixed ${updated} phone numbers to 254 format` });
}

export async function importFarmers(req: Request, res: Response) {
  if (!req.file) throw new AppError(400, 'No file uploaded');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer as any);
  const ws = wb.worksheets[0];
  let created = 0, updated = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = String(row.getCell(1).value || '').trim();
    if (!code) continue;
    const routeCode = String(row.getCell(5).value || '').trim();
    const route = await prisma.route.findFirst({ where: { dairyId: req.dairyId!, code: routeCode } });
    if (!route) continue;
    const phone = formatPhone(String(row.getCell(4).value || ''));
    const data: any = {
      code, name: String(row.getCell(2).value || '').trim(),
      idNumber: String(row.getCell(3).value || '').trim() || null,
      phone, routeId: route.id,
      pricePerLitre: Number(row.getCell(6).value) || 46,
      paymentMethod: String(row.getCell(7).value || 'MPESA').toUpperCase() === 'BANK' ? 'BANK' : 'MPESA',
      mpesaPhone: phone,
      bankName: String(row.getCell(8).value || '').trim() || null,
      bankAccount: String(row.getCell(9).value || '').trim() || null,
      isActive: true,
    };
    const existing = await prisma.farmer.findUnique({ where: { dairyId: req.dairyId!, code } });
    if (existing) { await prisma.farmer.update({ where: { code }, data }); updated++; }
    else { await prisma.farmer.create({ data }); created++; }
  }
  res.json({ created, updated });
}

export async function exportFarmers(req: Request, res: Response) {
  const farmers = await prisma.farmer.findMany({
    include: { route: { select: { code: true, name: true } } },
    orderBy: [{ route: { code: 'asc' } }, { name: 'asc' }],
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Farmers');
  ws.addRow(['Code', 'Name', 'ID Number', 'Phone', 'Route Code', 'Price/L', 'Payment', 'Bank Name', 'Bank Account', 'Active']);
  farmers.forEach((f) => ws.addRow([f.code, f.name, f.idNumber, f.phone, f.route.code, Number(f.pricePerLitre), f.paymentMethod, f.bankName, f.bankAccount, f.isActive]));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=farmers.xlsx');
  await wb.xlsx.write(res);
}
