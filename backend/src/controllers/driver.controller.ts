import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// GET /api/driver/trips?driverId=1&date=2024-09-01
export const getTrips = async (req: Request, res: Response) => {
  const { driverId, date, month, year } = req.query;
  const where: any = {};
  if (driverId) where.driverId = parseInt(driverId as string);
  if (date) {
    const d = new Date(date as string);
    where.tripDate = { gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()), lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) };
  }
  if (month && year) {
    where.tripDate = { gte: new Date(parseInt(year as string), parseInt(month as string) - 1, 1), lt: new Date(parseInt(year as string), parseInt(month as string), 1) };
  }
  const trips = await prisma.driverTrip.findMany({
    where,
    include: {
      driver: { select: { id: true, name: true, code: true } },
      shopDrops: { include: { shop: { select: { id: true, name: true, code: true } } } },
      expenses: true,
    },
    orderBy: { tripDate: 'desc' },
  });
  res.json(trips);
};

// POST /api/driver/trips/upsert
export const upsertTrip = async (req: Request, res: Response) => {
  const { driverId, tripDate, routesCovered, totalLitres, status, notes } = req.body;
  const date = new Date(tripDate);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const existing = await prisma.driverTrip.findFirst({
    where: { driverId: parseInt(driverId), tripDate: { gte: startOfDay, lt: endOfDay } },
  });

  let trip;
  if (existing) {
    trip = await prisma.driverTrip.update({
      where: { id: existing.id },
      data: { routesCovered, totalLitres: totalLitres || 0, status: status || 'PENDING', notes },
    });
  } else {
    trip = await prisma.driverTrip.create({
      data: { driverId: parseInt(driverId), tripDate: new Date(tripDate), routesCovered, totalLitres: totalLitres || 0, status: status || 'PENDING', notes },
    });
  }

  const full = await prisma.driverTrip.findUnique({
    where: { id: trip.id },
    include: {
      driver: { select: { id: true, name: true, code: true } },
      shopDrops: { include: { shop: { select: { id: true, name: true, code: true } } } },
      expenses: true,
    },
  });
  res.json(full);
};

// POST /api/driver/drops
export const createDrop = async (req: Request, res: Response) => {
  const { tripId, shopId, litres, droppedAt } = req.body;
  const drop = await prisma.shopDrop.create({
    data: {
      tripId: parseInt(tripId),
      shopId: parseInt(shopId),
      litres: litres || 0,
      droppedAt: droppedAt ? new Date(droppedAt) : new Date(),
    },
    include: { shop: { select: { id: true, name: true, code: true } } },
  });
  res.json(drop);
};

// PUT /api/driver/drops/:id
export const updateDrop = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { litres, droppedAt } = req.body;
  const drop = await prisma.shopDrop.update({
    where: { id: parseInt(id) },
    data: { litres: litres !== undefined ? litres : undefined, droppedAt: droppedAt ? new Date(droppedAt) : undefined },
    include: { shop: { select: { id: true, name: true, code: true } } },
  });
  res.json(drop);
};

// DELETE /api/driver/drops/:id
export const deleteDrop = async (req: Request, res: Response) => {
  await prisma.shopDrop.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
};

// POST /api/driver/expenses
export const createExpense = async (req: Request, res: Response) => {
  const { tripId, description, amount, expenseDate } = req.body;
  const expense = await prisma.driverExpense.create({
    data: {
      tripId: parseInt(tripId),
      description,
      amount: amount || 0,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    },
  });
  res.json(expense);
};

// PUT /api/driver/expenses/:id
export const updateExpense = async (req: Request, res: Response) => {
  const { description, amount } = req.body;
  const expense = await prisma.driverExpense.update({
    where: { id: parseInt(req.params.id) },
    data: { description, amount },
  });
  res.json(expense);
};

// DELETE /api/driver/expenses/:id
export const deleteExpense = async (req: Request, res: Response) => {
  await prisma.driverExpense.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
};

// GET /api/driver/summary?driverId=1&month=9&year=2024
export const getDriverSummary = async (req: Request, res: Response) => {
  const { driverId, month, year } = req.query;
  const m = parseInt(month as string);
  const y = parseInt(year as string);

  const trips = await prisma.driverTrip.findMany({
    where: {
      driverId: parseInt(driverId as string),
      tripDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
    },
    include: {
      shopDrops: { include: { shop: { select: { name: true } } } },
      expenses: true,
    },
    orderBy: { tripDate: 'asc' },
  });

  const totalLitres = trips.reduce((s, t) => s + Number(t.totalLitres), 0);
  const totalExpenses = trips.flatMap(t => t.expenses).reduce((s, e) => s + Number(e.amount), 0);
  const totalDrops = trips.flatMap(t => t.shopDrops).reduce((s, d) => s + Number(d.litres), 0);

  res.json({ trips, summary: { totalTrips: trips.length, totalLitres, totalDrops, totalExpenses } });
};
