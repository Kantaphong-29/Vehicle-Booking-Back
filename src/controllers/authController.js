const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// POST /api/auth/register
// สมัครสมาชิก (โดยทั่วไป role เริ่มต้นคือ USER, ADMIN เป็นผู้กำหนด role STAFF/ADMIN ทีหลังผ่าน userController)
async function register(req, res) {
  try {
    const { name, email, password, phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อ, อีเมล และรหัสผ่าน' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, phone, department },
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true }
    });

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', user });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก', error: err.message });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }
    });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: err.message });
  }
}

// GET /api/auth/me
async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, phone: true, department: true, role: true, avatarUrl: true }
  });
  res.json(user);
}

// PATCH /api/auth/me
// แก้ไขข้อมูลโปรไฟล์ตัวเอง: ชื่อ, เบอร์โทร, ภาควิชา, รูปโปรไฟล์ (ไม่รวมรหัสผ่าน/อีเมล)
async function updateProfile(req, res) {
  try {
    const { name, phone, department, avatarUrl } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ message: 'ชื่อห้ามเว้นว่าง' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {})
      },
      select: { id: true, name: true, email: true, phone: true, department: true, role: true, avatarUrl: true }
    });

    res.json({ message: 'อัปเดตโปรไฟล์เรียบร้อย', user });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์', error: err.message });
  }
}

// PATCH /api/auth/me/password
// เปลี่ยนรหัสผ่าน ต้องยืนยันรหัสผ่านเดิมก่อนเสมอ
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });

    res.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน', error: err.message });
  }
}

module.exports = { register, login, me, updateProfile, changePassword };