const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ข้อมูลจากใบคำสั่งนำยานพาหนะออกปฏิบัติราชการ คณะศึกษาศาสตร์ มหาวิทยาลัยศิลปากร
const drivers = [
  { name: 'นายธนากร สอนพา', phone: '0892020714' },
  { name: 'นายสุรศักดิ์ ผุยรอด', phone: '0806511177' },
  { name: 'นายพิชัย ทองเรือนเหมือน', phone: '0925879702' },
  { name: 'นายพงศ์ภัทร์ วิวัตกุลไชย์', phone: '0924818147' },
  { name: 'นายวีรพงษ์ เดชกำแหง', phone: '0923833344' },
  { name: 'นายอนิวรรตน์ ทองดอนอ่อน', phone: '0656524936' },
];

// รถประจำของคนขับแต่ละคน (ยี่ห้อโตโยต้าทั้งหมดตามเอกสาร)
const vehicles = [
  { plateNumber: 'นค 6716', brand: 'Toyota' },
  { plateNumber: 'นค 4838', brand: 'Toyota' },
  { plateNumber: 'นค 5499', brand: 'Toyota' },
  { plateNumber: 'นค 5179', brand: 'Toyota' },
  { plateNumber: 'นค 3407', brand: 'Toyota' },
  { plateNumber: 'นค 2881', brand: 'Toyota' },
];

async function seedDrivers() {
  for (const d of drivers) {
    const existing = await prisma.driver.findFirst({ where: { phone: d.phone } });
    if (existing) {
      console.log(`  - มีอยู่แล้ว: ${d.name} (${d.phone})`);
      continue;
    }
    await prisma.driver.create({ data: d });
    console.log(`  + เพิ่มคนขับ: ${d.name} (${d.phone})`);
  }
}

async function seedVehicles() {
  for (const v of vehicles) {
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber: v.plateNumber } });
    if (existing) {
      console.log(`  - มีอยู่แล้ว: ${v.plateNumber}`);
      continue;
    }
    await prisma.vehicle.create({ data: v });
    console.log(`  + เพิ่มรถ: ${v.plateNumber} (${v.brand})`);
  }
}

async function main() {
  console.log('กำลังเพิ่มข้อมูลคนขับรถ...');
  await seedDrivers();
  console.log('กำลังเพิ่มข้อมูลรถตู้...');
  await seedVehicles();
  console.log('เสร็จสิ้น');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
