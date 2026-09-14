const prisma = require('../config/prisma');

async function getVehicles(req, res) {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { id: 'asc' } });
  res.json(vehicles);
}

async function createVehicle(req, res) {
  try {
    const { plateNumber, brand, model, seats } = req.body;
    if (!plateNumber) return res.status(400).json({ message: 'กรุณาระบุหมายเลขทะเบียนรถ' });

    const vehicle = await prisma.vehicle.create({ data: { plateNumber, brand, model, seats } });
    res.status(201).json(vehicle);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'ทะเบียนรถนี้มีอยู่ในระบบแล้ว' });
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

async function updateVehicle(req, res) {
  try {
    const id = Number(req.params.id);
    const { plateNumber, brand, model, seats, status } = req.body;
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: { plateNumber, brand, model, seats, status }
    });
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

async function deleteVehicle(req, res) {
  try {
    const id = Number(req.params.id);
    await prisma.vehicle.delete({ where: { id } });
    res.json({ message: 'ลบข้อมูลรถเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

module.exports = { getVehicles, createVehicle, updateVehicle, deleteVehicle };
