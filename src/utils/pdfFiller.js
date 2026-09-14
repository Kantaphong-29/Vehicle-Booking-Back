const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const TEMPLATE_PATH = path.join(__dirname, '../assets/pdf/car-request-template.pdf');
const FONT_REGULAR_PATH = path.join(__dirname, '../assets/fonts/THSarabun.ttf');
const FIELD_FONT_SIZE = 8;

// ตำแหน่งจริงของ 2 ตัวเลือกจอดรถแบบ "คงที่" ในฟอร์ม (ต้องตรงกับข้อความในหน้า NewBooking.jsx)
const PICKUP_FACULTY = 'ที่จอดรถคณะศึกษาศาสตร์';
const PICKUP_RECTOR = 'สำนักงานอธิการบดี วิทยาเขตพระราชวังสนามจันทร์';

// ชื่อคนขับ 6 คนที่พิมพ์ตายตัวอยู่ในฟอร์มหน้า 3 (เรียงบนลงล่างตามที่ปรากฏในตาราง)
// เทียบกับ booking.driver.name แล้วกาช่องซ้าย (driver_pick_N) + ขวา (vehicle_pick_N) ของแถวที่ตรงกัน
const KNOWN_DRIVERS = [
  { row: 1, name: 'นายธนากร สอนพา' },
  { row: 2, name: 'นายสุรศักดิ์ ผุยรอด' },
  { row: 3, name: 'นายพิชัย ทองเรือนเหมือน' },
  { row: 4, name: 'นายพงศ์ภัทร์ วิวัตกุลไชย์' },
  { row: 5, name: 'นายวีรพงษ์ เดชกำแหง' },
  { row: 6, name: 'นายอนิวรรตน์ ทองดอนอ่อน' },
];


function findDriverRow(driverName) {
  if (!driverName) return null;
  const normalize = (s) => s.replace(/\s+/g, '').replace(/^นาย/, '');
  const target = normalize(driverName);
  const found = KNOWN_DRIVERS.find((d) => {
    const known = normalize(d.name);
    return known.includes(target) || target.includes(known);
  });
  return found ? found.row : null;
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const pad2 = (n) => String(n).padStart(2, '0');
const thaiDayName = (d) => THAI_DAYS[d.getDay()];
const thaiMonthName = (d) => THAI_MONTHS[d.getMonth()];
const buddhistYear = (d) => String(d.getFullYear() + 543);
const thaiTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;


function setText(form, name, value) {
  if (value === undefined || value === null || value === '') return;
  let field;
  try {
    field = form.getTextField(name);
  } catch (err) {
    console.warn(`[pdfFiller] ไม่พบฟิลด์ข้อความ "${name}" ในเทมเพลต — ข้ามไป`);
    return;
  }
  try {
    field.setFontSize(FIELD_FONT_SIZE); // ฟอนต์ TH Sarabun ขนาด 10 ตามที่กำหนด
  } catch (err) {
    // บางฟิลด์ (เช่น location1) ไม่มี /DA เป็นของตัวเอง กำหนดขนาดตายตัวไม่ได้ — ใช้ขนาดอัตโนมัติแทน
    console.warn(`[pdfFiller] ตั้งขนาดฟอนต์ 8 ให้ฟิลด์ "${name}" ไม่ได้ (ไม่มี /DA) จะใช้ขนาดอัตโนมัติแทน`);
  }
  field.setText(String(value));
}

function setCheck(form, name, checked = true) {
  if (!checked) return;
  try {
    form.getCheckBox(name).check();
  } catch (err) {
    console.warn(`[pdfFiller] ไม่พบช่องกาเครื่องหมาย "${name}" ในเทมเพลต — ข้ามไป`);
  }
}

function setRadio(form, groupName, exportValue) {
  if (!exportValue) return;
  try {
    form.getRadioGroup(groupName).select(exportValue);
  } catch (err) {
    console.warn(`[pdfFiller] ไม่พบกลุ่มตัวเลือก "${groupName}" หรือค่า "${exportValue}" — ข้ามไป`);
  }
}

/**
 * กรอกข้อมูลคำขอใช้รถ (booking) ลงในฟอร์ม PDF จริง แล้วคืนค่าเป็น Buffer ของ PDF ที่กรอกแล้ว
 * @param {object} booking   ผลลัพธ์จาก prisma ที่ include: requester, vehicle, driver, passengers
 * @param {object} options
 * @param {boolean} options.flatten  true = ล็อกฟิลด์ให้แก้ไขไม่ได้อีก (เหมาะกับตอนพิมพ์ใบสุดท้าย)
 */
async function fillBookingPdf(booking, { flatten = false } = {}) {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  // ฝังฟอนต์ไทย (TH Sarabun) — ฟิลด์ในเทมเพลตอ้างอิง Helvetica ซึ่งไม่มีตัวอักษรไทยอยู่เลย
  // ถ้าไม่ฝังฟอนต์นี้ ข้อความไทยที่กรอกจะกลายเป็นช่องว่าง/ไม่แสดงผลตอนเปิดไฟล์
  const thaiFontBytes = fs.readFileSync(FONT_REGULAR_PATH);
  const thaiFont = await pdfDoc.embedFont(thaiFontBytes, { subset: true });

  const form = pdfDoc.getForm();

  const requester = booking.requester || {};
  const start = new Date(booking.startDateTime);
  const end = new Date(booking.endDateTime);

  // ===================== หน้า 1: แบบคำขอใช้ยานพาหนะ =====================

  // --- ผู้ขอใช้รถ / หน่วยงาน / สถานที่ไปราชการ ---
  setText(form, 'name', requester.name);
  // NOTE: schema.prisma ยังไม่มีฟิลด์ "ตำแหน่ง" ของผู้ใช้ (User มีแค่ name/department/phone)
  // ถ้าจะให้ช่องนี้มีข้อมูลจริง ต้องเพิ่มคอลัมน์ position ใน User ก่อน
  setText(form, 'position', requester.position);
  setText(form, 'major', requester.department);
  setText(form, 'location', booking.destination);
  setText(form, 'road', booking.street);
  setText(form, 'province', booking.province);

  // --- วัตถุประสงค์การเดินทาง ---
  // group_2 (เลือกได้ 1 ใน 3): toggle_1=นิเทศฝึกประสบการณ์ฯ / toggle_2=นิเทศฝึกงาน / toggle_3=สอบสอน
  // group_3 (เลือกได้ 1 ใน 3): toggle_4=ประชุม/อบรม/สัมมนา / toggle_5=รับอาจารย์พิเศษ / toggle_6=ส่งอาจารย์พิเศษ
  // toggle_7 = นำนักศึกษาไปศึกษาดูงาน (class/subject = ระดับ/รายวิชา — ไม่มีในฐานข้อมูลปัจจุบัน)
  // toggle_8 = รับวิทยากร (subject2, name4, phone)   toggle_9 = ส่งวิทยากร (subject3, name4, phone)
  // toggle_10 = อื่น ๆ (fill_1)
  switch (booking.purpose) {
    case 'SUPERVISION':
      // enum SUPERVISION ครอบคลุมทั้ง "นิเทศฝึกประสบการณ์ฯ" และ "สอบสอน" รวมกัน แต่ในฟอร์มจริง
      // นี่คือกลุ่มตัวเลือกเดียว (radio) เลือกได้แค่ 1 ค่า จึงเลือกตัวที่พบบ่อยที่สุดเป็นค่าเริ่มต้น
      setRadio(form, 'group_2', 'toggle_1');
      break;

    case 'MEETING':
      setRadio(form, 'group_3', 'toggle_4');
      break;

    case 'PICKUP_SPEAKER':
      // ระบบยังไม่แยก "รับ" กับ "ส่ง" วิทยากรออกจากกัน (purpose เดียวคลุมทั้งคู่) — ถือเป็น "รับวิทยากร" เป็นหลัก
      setCheck(form, 'toggle_8', true);
      setText(form, 'subject2', booking.purposeDetail);
      setText(form, 'name4', booking.speakerName);
      setText(form, 'phone', booking.speakerPhone);
      break;

    case 'STUDY_VISIT':
      setCheck(form, 'toggle_7', true);
      break;

    case 'OTHER':
      setCheck(form, 'toggle_10', true);
      setText(form, 'fill_1', booking.purposeDetail);
      break;

    default:
      break;
  }

  // --- วัน-เวลาเดินทาง ---
  setText(form, 'day', thaiDayName(start));
  setText(form, 'date', start.getDate());
  setText(form, 'month', thaiMonthName(start));
  setText(form, 'years', buddhistYear(start));
  setText(form, 'time', thaiTime(start));   // เวลาออกจากคณะฯ
  setText(form, 'time1', thaiTime(end));    // เวลาถึงปลายทาง (ประมาณเดียวกับเวลากลับ ถ้าไม่ได้แยกเก็บ)
  setText(form, 'time2', thaiTime(end));    // เวลาออกจากปลายทางขากลับ
  setText(form, 'time4', thaiTime(end));    // เวลาถึงคณะฯ ขากลับ
  setText(form, 'people', booking.passengers?.length || 0);
  setText(form, 'road1', booking.route);

  // --- จุดต้นทางที่ให้รถออก (toggle_11/toggle_12 = checkbox เดี่ยว ไม่ใช่ radio) ---
  if (booking.pickupLocation === PICKUP_FACULTY) {
    setCheck(form, 'toggle_11', true);
  } else if (booking.pickupLocation === PICKUP_RECTOR) {
    setCheck(form, 'toggle_12', true);
  } else if (booking.pickupLocation) {
    // "อื่น ๆ (ระบุ)" ไปแชร์ radio group เดียวกัน (group_4) กับตัวเลือก "ไป-กลับ/เที่ยวเดียว" ด้านล่าง
    // เป็นข้อจำกัดของฟิลด์ในไฟล์ต้นฉบับเอง (ผู้ออกแบบฟอร์มใน Acrobat รวม 2 กลุ่มคำถามไว้ในปุ่มวิทยุกลุ่มเดียว)
    // โค้ดนี้จึงให้ "ประเภทเที่ยว" (ไป-กลับ/เที่ยวเดียว) มีสิทธิ์ก่อน ส่วนช่องข้อความ "อื่น ๆ ระบุ" ยังคงกรอกให้เสมอ
    setText(form, 'fill_2', booking.pickupLocation);
  }

  // --- ประเภทเที่ยว: group_4 เลือกได้ 1 ใน 3 (toggle_13=อื่นๆ(ต้นทาง) / toggle_14=ไปกลับ / toggle_15=เที่ยวเดียว) ---
  setRadio(form, 'group_4', booking.tripType === 'ONE_WAY' ? 'toggle_15' : 'toggle_14');

  // --- ผู้ควบคุมการเดินทาง / แหล่งงบประมาณ ---
  setText(form, 'name5', booking.controllerName);
  setText(form, 'phone1', booking.controllerPhone);
  // หมายเหตุ: บรรทัด "ค่าน้ำมันเชื้อเพลิง/ค่าตอบแทนนอกเวลาฯ/ค่าทางด่วน เบิกจ่ายจาก (คณะฯ)/(อื่นๆ)"
  // (booking.budgetSource) ไม่มีฟิลด์ฟอร์มรองรับเลยในเทมเพลตนี้ (ตรวจสอบพิกัดทุกฟิลด์แล้วไม่พบ)
  // ถ้าต้องการให้กรอกอัตโนมัติได้ ต้องเข้า Acrobat Prepare Form แล้วเพิ่มฟิลด์ตรงบรรทัดนั้นก่อน

  // --- ผลการพิจารณา (toggle_16 = อนุญาต / toggle_17 = อื่น ๆ ระบุ) ---
  if (booking.status === 'APPROVED') {
    setCheck(form, 'toggle_16', true);
  } else if (booking.status === 'REJECTED') {
    setCheck(form, 'toggle_17', true);
    // ช่อง "อื่น ๆ ระบุ...." ตรงนี้ไม่มีฟิลด์ฟอร์มรองรับในเทมเพลต จึงวาดข้อความทับตำแหน่งบรรทัดนั้นโดยตรง
    if (booking.rejectReason) {
      const page1 = pdfDoc.getPages()[0];
      page1.drawText(String(booking.rejectReason).slice(0, 60), {
        x: 392,
        y: 194,
        size: FIELD_FONT_SIZE,
        font: thaiFont,
        color: rgb(0, 0, 0),
      });
    }
  }

  // --- รายชื่อผู้ร่วมเดินทาง (หน้า 2, ฟิลด์ชื่อ "1" ถึง "10" เรียงบนลงล่าง สูงสุด 10 คน) ---
  (booking.passengers || []).slice(0, 10).forEach((passenger, index) => {
    setText(form, String(index + 1), passenger.name);
  });

  // ===================== หน้า 3: ใบคำสั่งนำยานพาหนะออกปฏิบัติราชการ =====================
  // ส่วนนี้กรอกได้ก็ต่อเมื่อคำขออนุมัติแล้ว (มีวัน-เวลาที่ยืนยันแน่นอน)
  setText(form, 'location1', booking.destination);
  setText(form, 'day1', thaiDayName(start));
  setText(form, 'date1', start.getDate());
  setText(form, 'month1', thaiMonthName(start));
  setText(form, 'years11', buddhistYear(start));
  setText(form, 'time5', thaiTime(start));
  setText(form, 'time6', thaiTime(end));

  // --- เลือกคนขับรถ: กาช่องซ้าย(ชื่อคนขับ)+ขวา(โตโยต้า) ของแถวที่ตรงกัน กาได้เฉพาะ 6 คน
  // ที่มีชื่อพิมพ์ตายตัวอยู่ในฟอร์มนี้เท่านั้น ถ้าคนขับที่มอบหมายไม่ตรงกับ 6 คนนี้จะไม่กาอะไรให้
  // (กันกาผิดแถว) และแจ้งเตือนไว้ใน log แทน
  if (booking.driver?.name) {
    const row = findDriverRow(booking.driver.name);
    if (row) {
      setCheck(form, `driver_pick_${row}`, true);
      setCheck(form, `vehicle_pick_${row}`, true);
    } else {
      console.warn(`[pdfFiller] ไม่พบชื่อคนขับ "${booking.driver.name}" ในรายชื่อ 6 คนที่พิมพ์ไว้ในฟอร์ม — ข้ามการกาช่องเลือกคนขับ`);
    }
  }

  // 'name6' ("กับ...") และช่องหมวดเติมน้ำมันเชื้อเพลิงท้ายหน้า 3 (toggle_13_2 ... toggle_24,
  // undefined_8/undefined_9) ไม่มีข้อมูลที่ตรงกันในฐานข้อมูลปัจจุบัน (เป็นหมวดบัญชี/ประเภทนักศึกษา
  // ภายในของกองคลัง) จึงเว้นว่างไว้ให้เจ้าหน้าที่กรอกด้วยมือ

  // สร้าง appearance ใหม่ให้ "ทุก" ฟิลด์โดยบังคับใช้ฟอนต์ไทยที่ฝังไว้ ต้องทำเป็นขั้นตอนสุดท้าย
  // (หลังกรอกค่าทั้งหมดแล้ว) ไม่งั้นตัวอักษรไทยจะถูกวาดด้วย Helvetica เริ่มต้นของฟิลด์ (ไม่มีตัวอักษรไทย)
  // แล้วกลายเป็นช่องว่างตอนเปิดไฟล์
  form.updateFieldAppearances(thaiFont);

  if (flatten) {
    form.flatten();
  }

  const filledBytes = await pdfDoc.save();
  return Buffer.from(filledBytes);
}

module.exports = { fillBookingPdf };
