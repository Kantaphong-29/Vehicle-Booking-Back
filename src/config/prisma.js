const { PrismaClient } = require('@prisma/client');

// ใช้ instance เดียวทั้งแอป กันปัญหา connection เกิน limit ตอน dev (hot reload)
const prisma = new PrismaClient();

module.exports = prisma;
