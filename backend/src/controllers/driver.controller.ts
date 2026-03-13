// src/controllers/driver.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// ── GET /api/driver/trip?date=YYYY-MM-DD  ─────────────────────────────────────
// Get or initialise today's trip for the logged-in driver
export async function getMyTrip(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const dateStr  = String(req.query.date ?? new Date().toISOString().split('T')[0]);
  const date     = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);

  const trip = await prisma.driverTrip.findUnique({
    where: { driverId_tripDate: { driverId, tripDate: date } },
    include: {
      drops:    { include: { shop: { select: { id: true, name: true, code: true } } }, orderBy: { droppedAt: 'asc' } },
      expenses: { orderBy: { createdAt: 'asc' } },
    },
  });

  res.json({ trip: trip ?? null });
}

// ── POST /api/driver/trip/start  ──────────────────────────────────────────────
// Driver logs how many litres they loaded from factory
export async function startTrip(req: Request, res: Response) {
  const driverId     = req.user!.sub;
  const { litresLoaded, notes, tripDate } = req.body;

  if (!litresLoaded || Number(litresLoaded) <= 0)
    throw new AppError(400, 'litresLoaded is required');

  const date = tripDate ? new Date(tripDate) : new Date();
  date.setUTCHours(0, 0, 0, 0);

  const trip = await prisma.driverTrip.upsert({
    where:  { driverId_tripDate: { driverId, tripDate: date } },
    update: { litresLoaded: Number(litresLoaded) },
    create: {
      driverId,
      tripDate:     date,
      litresLoaded: Number(litresLoaded),
      status:       'OPEN',
    },
    include: { drops: true, expenses: true },
  });

  res.json({ trip });
}

// ── POST /api/driver/trip/:tripId/drop  ───────────────────────────────────────
// Driver records a delivery drop at a shop
export async function addDrop(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const tripId   = Number(req.params.tripId);
  const { shopId, litres, cashCollected, notes } = req.body;

  if (!shopId || !litres) throw new AppError(400, 'shopId and litres required');

  // Verify trip belongs to this driver
  const trip = await prisma.driverTrip.findFirst({ where: { id: tripId, driverId } });
  if (!trip) throw new AppError(404, 'Trip not found');

  const drop = await prisma.shopDrop.create({
    data: {
      tripId,
      shopId:       Number(shopId),
      litres:       Number(litres),
      cashCollected: Number(cashCollected ?? 0),
      notes:        notes ?? null,
      droppedAt:    new Date(),
    },
    include: { shop: { select: { id: true, name: true, code: true } } },
  });

  // Recalculate totals on trip
  await recalcTrip(tripId);

  res.json({ drop });
}

// ── PUT /api/driver/trip/:tripId/drop/:dropId  ────────────────────────────────
// Edit a drop (e.g. correct litres or cash)
export async function editDrop(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const tripId   = Number(req.params.tripId);
  const dropId   = Number(req.params.dropId);
  const { litres, cashCollected, notes } = req.body;

  const trip = await prisma.driverTrip.findFirst({ where: { id: tripId, driverId } });
  if (!trip) throw new AppError(404, 'Trip not found');

  const drop = await prisma.shopDrop.update({
    where: { id: dropId },
    data:  { litres: Number(litres), cashCollected: Number(cashCollected ?? 0), notes: notes ?? null },
    include: { shop: { select: { id: true, name: true, code: true } } },
  });

  await recalcTrip(tripId);
  res.json({ drop });
}

// ── DELETE /api/driver/trip/:tripId/drop/:dropId  ─────────────────────────────
export async function deleteDrop(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const tripId   = Number(req.params.tripId);
  const dropId   = Number(req.params.dropId);

  const trip = await prisma.driverTrip.findFirst({ where: { id: tripId, driverId } });
  if (!trip) throw new AppError(404, 'Trip not found');

  await prisma.shopDrop.delete({ where: { id: dropId } });
  await recalcTrip(tripId);
  res.json({ ok: true });
}

// ── POST /api/driver/trip/:tripId/expense  ────────────────────────────────────
// Log a fuel/lunch/maintenance expense
export async function addExpense(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const tripId   = Number(req.params.tripId);
  const { category, amount, description, receiptNo } = req.body;

  if (!category || !amount) throw new AppError(400, 'category and amount required');

  const trip = await prisma.driverTrip.findFirst({ where: { id: tripId, driverId } });
  if (!trip) throw new AppError(404, 'Trip not found');

  const expense = await prisma.driverExpense.create({
    data: { tripId, driverId, category, amount: Number(amount), description: description ?? null, receiptNo: receiptNo ?? null },
  });

  res.json({ expense });
}

// ── DELETE /api/driver/trip/:tripId/expense/:expenseId  ───────────────────────
export async function deleteExpense(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const tripId   = Number(req.params.tripId);

  const trip = await prisma.driverTrip.findFirst({ where: { id: tripId, driverId } });
  if (!trip) throw new AppError(404, 'Trip not found');

  await prisma.driverExpense.delete({ where: { id: Number(req.params.expenseId) } });
  res.json({ ok: true });
}

// ── POST /api/driver/trip/:tripId/submit  ─────────────────────────────────────
// Driver submits end-of-day — locks the trip
export async function submitTrip(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const tripId   = Number(req.params.tripId);

  const trip = await prisma.driverTrip.findFirst({
    where:   { id: tripId, driverId },
    include: { drops: true, expenses: true },
  });
  if (!trip) throw new AppError(404, 'Trip not found');

  await recalcTrip(tripId);

  const updated = await prisma.driverTrip.update({
    where: { id: tripId },
    data:  { status: 'SUBMITTED' },
    include: { drops: { include: { shop: { select: { id: true, name: true } } } }, expenses: true },
  });

  res.json({ trip: updated });
}

// ── GET /api/driver/shops  ────────────────────────────────────────────────────
// List all shops for the driver to pick from
export async function getShops(req: Request, res: Response) {
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, code: true, location: true },
    orderBy: { name: 'asc' },
  });
  res.json({ shops });
}

// ── GET /api/driver/history?limit=7  ─────────────────────────────────────────
// Recent trips for this driver
export async function getTripHistory(req: Request, res: Response) {
  const driverId = req.user!.sub;
  const limit    = Number(req.query.limit ?? 10);

  const trips = await prisma.driverTrip.findMany({
    where:   { driverId },
    include: {
      drops:    { include: { shop: { select: { id: true, name: true } } } },
      expenses: true,
    },
    orderBy: { tripDate: 'desc' },
    take:    limit,
  });

  res.json({ trips });
}

// ── Helper: recalculate litresDelivered and variance on a trip ────────────────
async function recalcTrip(tripId: number) {
  const drops = await prisma.shopDrop.findMany({ where: { tripId } });
  const delivered = drops.reduce((s, d) => s + Number(d.litres), 0);
  const trip = await prisma.driverTrip.findUnique({ where: { id: tripId } });
  if (!trip) return;
  const variance = Number(trip.litresLoaded) - delivered;
  await prisma.driverTrip.update({
    where: { id: tripId },
    data:  { litresDelivered: delivered, litresVariance: variance },
  });
}
