# Vehicle Booking API
ระบบบริการจองรถตู้ออนไลน์ คณะศึกษาศาสตร์ มหาวิทยาลัยศิลปากร (Backend)

Stack: Node.js + Express + Prisma + MySQL

## การติดตั้ง

```bash
npm install
cp .env.example .env
# แก้ไข .env ให้ตรงกับฐานข้อมูล vehicle_booking_db ของคุณ (จาก phpMyAdmin)

npx prisma migrate dev --name init   # สร้างตารางตาม schema.prisma
npx prisma generate

npm run dev   # รันเซิร์ฟเวอร์แบบ dev (nodemon)
```

เซิร์ฟเวอร์จะรันที่ `http://localhost:5000`

## โครงสร้างโปรเจค

```
src/
  config/prisma.js        - Prisma client
  middleware/auth.js      - ตรวจสอบ login (JWT) และสิทธิ์ตาม role
  controllers/            - logic การทำงานแต่ละส่วน
  routes/                 - เส้นทาง API
  app.js                  - ตั้งค่า Express app
  server.js               - จุดเริ่มรันเซิร์ฟเวอร์
prisma/schema.prisma      - โครงสร้างฐานข้อมูล (users, vehicles, drivers, bookings, passengers)
```

## Role การใช้งาน
- **USER** อาจารย์/บุคลากร: สร้างคำขอใช้รถ, ดูคำขอของตัวเอง, ยกเลิกคำขอ
- **STAFF** ผู้ควบคุมหน่วยยานพาหนะ: อนุมัติ/ปฏิเสธคำขอ, มอบหมายรถ+คนขับ, จัดการข้อมูลรถ/คนขับ
- **ADMIN** ผู้ดูแลระบบ: จัดการบัญชีผู้ใช้และสิทธิ์ทั้งหมด (รวมสิทธิ์ของ STAFF)

## รายการ API หลัก

### Auth
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|---|---|---|---|
| POST | /api/auth/register | สมัครสมาชิก | ทุกคน |
| POST | /api/auth/login | เข้าสู่ระบบ (คืน JWT token) | ทุกคน |
| GET | /api/auth/me | ดูข้อมูลตัวเอง | login แล้ว |

### Bookings (คำขอใช้รถ)
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|---|---|---|---|
| GET | /api/bookings/vehicles/available?startDateTime=&endDateTime= | เช็ครถว่างในช่วงเวลา | login แล้ว |
| POST | /api/bookings | ยื่นคำขอใช้รถ | USER |
| GET | /api/bookings?status= | ดูรายการคำขอ | login แล้ว |
| GET | /api/bookings/:id | ดูรายละเอียดคำขอ | เจ้าของ/STAFF/ADMIN |
| PATCH | /api/bookings/:id/approve | อนุมัติ + มอบหมายรถ/คนขับ | STAFF, ADMIN |
| PATCH | /api/bookings/:id/reject | ปฏิเสธคำขอ | STAFF, ADMIN |
| PATCH | /api/bookings/:id/cancel | ยกเลิกคำขอของตัวเอง | USER (เจ้าของ) |

### Vehicles / Drivers / Users
CRUD มาตรฐาน ดูรายละเอียดใน `src/routes/*.js`

## ตัวอย่างการเรียก API (login)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@su.ac.th","password":"123456"}'
```

นำ `token` ที่ได้ไปใส่ใน header ของ request ถัดไป:
```
Authorization: Bearer <token>
```
