const prisma = require('../config/prisma');

async function getDrivers(req, res) {
  const drivers = await prisma.driver.findMany({ orderBy: { id: 'asc' } });
  res.json(drivers);
}

async function createDriver(req, res) {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'กรุณาระบุชื่อและเบอร์โทรศัพท์' });

    const driver = await prisma.driver.create({ data: { name, phone } });
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

async function updateDriver(req, res) {
  try {
    const id = Number(req.params.id);
    const { name, phone, status } = req.body;
    const driver = await prisma.driver.update({ where: { id }, data: { name, phone, status } });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

async function deleteDriver(req, res) {
  try {
    const id = Number(req.params.id);
    await prisma.driver.delete({ where: { id } });
    res.json({ message: 'ลบข้อมูลพนักงานขับรถเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

module.exports = { getDrivers, createDriver, updateDriver, deleteDriver };
