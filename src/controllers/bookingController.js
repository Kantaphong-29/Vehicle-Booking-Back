const prisma = require('../config/prisma');
const { fillBookingPdf } = require('../utils/pdfFiller');

const MAX_PASSENGERS = 10;

// POST /api/bookings
// อาจารย์/บุคลากร (USER) สร้างคำขอใช้รถ
async function createBooking(req, res) {
  try {
    const {
      purpose, purposeDetail, destination, street, province, route,
      startDateTime, endDateTime, pickupLocation, tripType,
      speakerName, speakerPhone, controllerName, controllerPhone,
      budgetSource, passengers // array ของชื่อผู้ร่วมเดินทาง
    } = req.body;

    if (!purpose || !destination || !startDateTime || !endDateTime) {
      return res.status(400).json({
        message: 'กรุณากรอกวัตถุประสงค์, สถานที่ไปราชการ และวัน-เวลาไป-กลับให้ครบถ้วน'
      });
    }

    if (passengers && passengers.length > MAX_PASSENGERS) {
      return res.status(400).json({
        message: `จำนวนผู้ร่วมเดินทางต้องไม่เกิน ${MAX_PASSENGERS} คนต่อคัน`
      });
    }

    const booking = await prisma.booking.create({
      data: {
        requesterId: req.user.id,
        purpose,
        purposeDetail,
        destination,
        street,
        province,
        route,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        pickupLocation,
        tripType,
        speakerName,
        speakerPhone,
        controllerName,
        controllerPhone,
        budgetSource,
        passengers: passengers?.length
          ? { create: passengers.map((name) => ({ name })) }
          : undefined
      },
      include: { passengers: true, requester: { select: { id: true, name: true, department: true } } }
    });

    res.status(201).json({ message: 'ส่งคำขอใช้รถสำเร็จ รอการอนุมัติ', booking });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างคำขอ', error: err.message });
  }
}

// GET /api/bookings
// USER เห็นเฉพาะคำขอของตัวเอง / STAFF, ADMIN เห็นทั้งหมด (filter ได้ผ่าน query ?status=)
async function getBookings(req, res) {
  try {
    const { status } = req.query;
    const isStaffOrAdmin = ['STAFF', 'ADMIN'].includes(req.user.role);

    const bookings = await prisma.booking.findMany({
      where: {
        ...(isStaffOrAdmin ? {} : { requesterId: req.user.id }),
        ...(status ? { status } : {})
      },
      include: {
        requester: { select: { id: true, name: true, department: true, phone: true } },
        vehicle: true,
        driver: true,
        passengers: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล', error: err.message });
  }
}

// GET /api/bookings/:id
async function getBookingById(req, res) {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { requester: true, vehicle: true, driver: true, passengers: true }
    });

    if (!booking) return res.status(404).json({ message: 'ไม่พบคำขอนี้' });

    const isOwner = booking.requesterId === req.user.id;
    const isStaffOrAdmin = ['STAFF', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดูคำขอนี้' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

// PATCH /api/bookings/:id/approve  (STAFF, ADMIN)
// อนุมัติคำขอ พร้อมมอบหมายรถและคนขับได้ในขั้นตอนเดียวกัน
async function approveBooking(req, res) {
  try {
    const id = Number(req.params.id);
    const { vehicleId, driverId } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ message: 'ไม่พบคำขอนี้' });
    if (booking.status !== 'PENDING') {
      return res.status(400).json({ message: 'คำขอนี้ถูกดำเนินการไปแล้ว' });
    }

    // ตรวจสอบว่ารถ/คนขับที่จะมอบหมาย ว่างในช่วงเวลานั้นหรือไม่
    if (vehicleId) {
      const overlap = await prisma.booking.findFirst({
        where: {
          vehicleId,
          status: 'APPROVED',
          id: { not: id },
          AND: [
            { startDateTime: { lte: booking.endDateTime } },
            { endDateTime: { gte: booking.startDateTime } }
          ]
        }
      });
      if (overlap) return res.status(409).json({ message: 'รถคันนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: 'APPROVED',
        vehicleId: vehicleId || null,
        driverId: driverId || null,
        approvedById: req.user.id,
        rejectReason: null
      },
      include: { vehicle: true, driver: true, requester: true }
    });

    res.json({ message: 'อนุมัติคำขอเรียบร้อย', booking: updated });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอนุมัติ', error: err.message });
  }
}

// PATCH /api/bookings/:id/reject  (STAFF, ADMIN)
async function rejectBooking(req, res) {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ message: 'ไม่พบคำขอนี้' });
    if (booking.status !== 'PENDING') {
      return res.status(400).json({ message: 'คำขอนี้ถูกดำเนินการไปแล้ว' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'REJECTED', rejectReason: reason || null, approvedById: req.user.id }
    });

    res.json({ message: 'ปฏิเสธคำขอเรียบร้อย', booking: updated });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

// PATCH /api/bookings/:id/cancel  (เจ้าของคำขอ ยกเลิกคำขอตัวเอง ก่อนได้รับอนุมัติ)
async function cancelBooking(req, res) {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) return res.status(404).json({ message: 'ไม่พบคำขอนี้' });
    if (booking.requesterId !== req.user.id) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ยกเลิกคำขอนี้' });
    }
    if (!['PENDING', 'APPROVED'].includes(booking.status)) {
      return res.status(400).json({ message: 'ไม่สามารถยกเลิกคำขอนี้ได้' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ message: 'ยกเลิกคำขอเรียบร้อย', booking: updated });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

// GET /api/bookings/vehicles/available?startDateTime=&endDateTime=
// ตรวจสอบรถที่ว่างในช่วงเวลาที่ต้องการ
async function getAvailableVehicles(req, res) {
  try {
    const { startDateTime, endDateTime } = req.query;
    if (!startDateTime || !endDateTime) {
      return res.status(400).json({ message: 'กรุณาระบุช่วงเวลาที่ต้องการตรวจสอบ' });
    }

    const busyVehicleIds = await prisma.booking.findMany({
      where: {
        status: 'APPROVED',
        vehicleId: { not: null },
        AND: [
          { startDateTime: { lte: new Date(endDateTime) } },
          { endDateTime: { gte: new Date(startDateTime) } }
        ]
      },
      select: { vehicleId: true }
    });

    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: 'AVAILABLE',
        id: { notIn: busyVehicleIds.map((b) => b.vehicleId) }
      }
    });

    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
}

// GET /api/bookings/:id/pdf?flatten=1
// กรอกข้อมูลคำขอนี้ลงในแบบฟอร์ม PDF จริง (ฟิลด์ AcroForm) แล้วส่งไฟล์กลับไปให้ดาวน์โหลด/แสดงผล
async function getBookingPdf(req, res) {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { requester: true, vehicle: true, driver: true, passengers: true }
    });

    if (!booking) return res.status(404).json({ message: 'ไม่พบคำขอนี้' });

    const isOwner = booking.requesterId === req.user.id;
    const isStaffOrAdmin = ['STAFF', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดูคำขอนี้' });
    }

    const flatten = req.query.flatten === '1' || req.query.flatten === 'true';
    const pdfBuffer = await fillBookingPdf(booking, { flatten });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="car-request-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF', error: err.message });
  }
}

// GET /api/bookings/calendar?start=2026-09-08&end=2026-09-14
// ส่งข้อมูลรถทั้งหมด + คำขอที่อนุมัติแล้วในช่วงวันที่ระบุ (ใช้ได้ทั้งแบบสัปดาห์/เดือน)
async function getVehicleCalendar(req, res) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ message: 'กรุณาระบุช่วงวันที่ (start, end)' });
    }

    const rangeStart = new Date(`${start}T00:00:00`);
    const rangeEnd = new Date(`${end}T23:59:59`);

    const vehicles = await prisma.vehicle.findMany({ orderBy: { id: 'asc' } });

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'APPROVED',
        vehicleId: { not: null },
        AND: [
          { startDateTime: { lte: rangeEnd } },
          { endDateTime: { gte: rangeStart } }
        ]
      },
      select: { id: true, vehicleId: true, startDateTime: true, endDateTime: true, destination: true }
    });

    res.json({ vehicles, bookings });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตารางรถ', error: err.message });
  }
}

// GET /api/bookings/stats (เฉพาะ ADMIN)
// สรุปข้อมูลสำหรับ Admin Dashboard: การ์ดสถิติ + กราฟการใช้รถย้อนหลัง 6 เดือน
async function getAdminStats(req, res) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [todayRequests, availableVehicles, pendingApprovals] = await Promise.all([
      prisma.booking.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.vehicle.count({ where: { status: 'AVAILABLE' } }),
      prisma.booking.count({ where: { status: 'PENDING' } })
    ]);

    // สถิติการใช้รถ (นับจากคำขอที่อนุมัติแล้ว) ย้อนหลัง 6 เดือน
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const recentBookings = await prisma.booking.findMany({
      where: { status: 'APPROVED', startDateTime: { gte: sixMonthsAgo } },
      select: { startDateTime: true }
    });

    const monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const monthlyUsage = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = recentBookings.filter((b) => {
        const bd = new Date(b.startDateTime);
        return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth();
      }).length;
      monthlyUsage.push({ month: monthLabels[d.getMonth()], count });
    }

    res.json({ todayRequests, availableVehicles, pendingApprovals, monthlyUsage });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ', error: err.message });
  }
}

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
  cancelBooking,
  getAvailableVehicles,
  getBookingPdf,
  getVehicleCalendar,
  getAdminStats
};
