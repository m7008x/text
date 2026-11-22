const { SECRET, safeEqual, sign } = require('./_lib');

// token มีอายุ 12 ชั่วโมง
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function createToken(username) {
  const payload = Buffer.from(JSON.stringify({ user: username, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  // ไม่มีรหัสเริ่มต้นในโค้ด: ต้องตั้งค่าใน Vercel ก่อนถึงจะเข้า admin ได้
  if (!validUser || !validPass || !SECRET) {
    return res.status(500).json({
      error: 'ยังไม่ได้ตั้งค่า ADMIN_USERNAME, ADMIN_PASSWORD และ ADMIN_SECRET ใน Vercel Environment Variables',
    });
  }

  const { username, password } = req.body || {};
  const userOk = safeEqual(username || '', validUser);
  const passOk = safeEqual(password || '', validPass);

  if (userOk && passOk) {
    return res.status(200).json({ ok: true, token: createToken(username) });
  }

  // หน่วงเวลาเล็กน้อยเมื่อรหัสผิด ให้เดารหัสได้ช้าลง
  await new Promise(r => setTimeout(r, 800));
  return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
};
