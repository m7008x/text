// โค้ดที่ใช้ร่วมกันระหว่าง API (ไฟล์ที่ขึ้นต้นด้วย _ จะไม่ถูก Vercel ทำเป็น endpoint)
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const APP_CONFIG = require('../public/config.js');

// ต้องตั้ง ADMIN_SECRET ใน Vercel เสมอ ไม่มีค่าเริ่มต้นในโค้ด (ถ้าไม่ตั้ง ระบบ admin จะใช้ไม่ได้)
const SECRET = process.env.ADMIN_SECRET || '';

// สร้างรายการรหัสนักเรียนจาก public/config.js (รักษาจำนวนหลักเดิม เช่น เลข 0 นำหน้า)
function buildStudentIds(first, count) {
  const start = BigInt(String(first));
  const width = String(first).length;
  return Array.from({ length: Number(count) }, (_, i) => (start + BigInt(i)).toString().padStart(width, '0'));
}
const STUDENT_IDS = buildStudentIds(APP_CONFIG.firstStudentId, APP_CONFIG.studentCount);

function isValidStudentId(id) {
  return STUDENT_IDS.includes(String(id || '').trim());
}

// เทียบข้อความแบบใช้เวลาเท่ากันเสมอ กันการเดารหัสจากเวลาตอบกลับ
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function verifyToken(authHeader) {
  if (!SECRET) return false;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน Vercel Environment Variables');
  }
  return createClient(url, key);
}

module.exports = { SECRET, STUDENT_IDS, isValidStudentId, safeEqual, sign, verifyToken, getSupabase };
