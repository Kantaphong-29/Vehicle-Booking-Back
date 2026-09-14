const express = require('express');
const router = express.Router();
const {
  createBooking, getBookings, getBookingById,
  approveBooking, rejectBooking, cancelBooking, getAvailableVehicles,
  getBookingPdf, getVehicleCalendar, getAdminStats
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // ทุก route ของ booking ต้อง login ก่อน
router.get('/vehicles/available', getAvailableVehicles); // เช็ครถว่าง (ทุก role ที่ login แล้ว)
router.get('/stats', authorize('ADMIN'), getAdminStats);
router.get('/calendar', getVehicleCalendar);
router.post('/', authorize('USER'), createBooking);           // อาจารย์/บุคลากรยื่นคำขอ
router.get('/', getBookings);                                  // USER เห็นของตัวเอง / STAFF-ADMIN เห็นทั้งหมด
router.get('/:id', getBookingById);
router.get('/:id/pdf', getBookingPdf); // ดาวน์โหลด/แสดง PDF ฟอร์มจริงที่กรอกข้อมูลแล้ว
router.patch('/:id/approve', authorize('STAFF', 'ADMIN'), approveBooking);
router.patch('/:id/reject', authorize('STAFF', 'ADMIN'), rejectBooking);
router.patch('/:id/cancel', authorize('USER'), cancelBooking);


module.exports = router;
