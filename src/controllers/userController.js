const prisma = require('../config/prisma');

const SAFE_SELECT = {
  id: true, name: true, email: true, phone: true, department: true, role: true, createdAt: true
};

// GET /api/users (ADMIN)
async function getUsers(req, res) {
  const users = await prisma.user.findMany({ select: SAFE_SELECT, orderBy: { id: 'asc' } });
  res.json(users);
}

// PATCH /api/users/:id/role (ADMIN) - กำหนดสิทธิ์ USER / STAFF / ADMIN
async function updateUserRole(req, res) {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;

    if (!['USER', 'STAFF', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'role ไม่ถูกต้อง' });
    }

    const user = await prisma.user.update({ where: { id }, data: { role }, select: SAFE_SELECT });
    res.json({ message: 'อัปเดตสิทธิ์ผู้ใช้งานเรียบร้อย', user });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

// DELETE /api/users/:id (ADMIN)
async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'ลบบัญชีผู้ใช้งานเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

module.exports = { getUsers, updateUserRole, deleteUser };
