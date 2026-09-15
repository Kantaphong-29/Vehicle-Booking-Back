const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "https://vehicle-booking-front-x425.vercel.app"],
  credentials: true
}));
app.use(express.json({ limit: '5mb' })); // เพิ่ม limit เพื่อรองรับรูปโปรไฟล์แบบ base64

app.get('/', (req, res) => {
  res.json({ message: 'Vehicle Booking API - คณะศึกษาศาสตร์ มหาวิทยาลัยศิลปากร' });
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/users', userRoutes);

// จัดการ route ที่ไม่มีอยู่
app.use((req, res) => {
  res.status(404).json({ message: 'ไม่พบ endpoint ที่ร้องขอ' });
});

// จัดการ error กลาง ๆ
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์', error: err.message });
});

module.exports = app;