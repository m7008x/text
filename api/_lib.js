// โค้ดที่ใช้ร่วมกันระหว่าง API (ไฟล์ที่ขึ้นต้นด้วย _ จะไม่ถูก Vercel ทำเป็น endpoint)
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SECRET = process.env.ADMIN_SECRET || 'vercel-supabase-secret-key-2026';

// รหัสนักเรียนที่ใช้ได้: 68319030001 - 68319030020
const STUDENT_IDS = Array.from({ length: 20 }, (_, i) => String(68319030001 + i));

function isValidStudentId(id) {
  return STUDENT_IDS.includes(String(id || '').trim());
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (sig !== expectedSig) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน Vercel Environment Variables');
  }
  return createClient(url, key);
}

module.exports = { SECRET, STUDENT_IDS, isValidStudentId, verifyToken, getSupabase };
