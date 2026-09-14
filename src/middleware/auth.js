const jwt = require('jsonwebtoken');

// ตรวจสอบว่า request มี token ที่ถูกต้องหรือไม่ (ต้อง login ก่อน)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization; // รูปแบบ: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

// ตรวจสอบสิทธิ์ตาม role เช่น authorize('STAFF', 'ADMIN')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
