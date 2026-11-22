const { STUDENT_IDS, isValidStudentId, verifyToken, getSupabase } = require('./_lib');

const ID_RANGE_MSG = `รหัสนักเรียนต้องอยู่ระหว่าง ${STUDENT_IDS[0]} - ${STUDENT_IDS[STUDENT_IDS.length - 1]}`;

// ตรวจข้อมูลที่ส่งมาจากฟอร์ม Insert / Edit
async function validatePayload(supabase, body) {
  const student_id = String(body.student_id || '').trim();
  const subject = String(body.subject || '').trim();
  const score = Number(body.score);
  const pic = body.pic ? String(body.pic).trim() : null;

  if (!isValidStudentId(student_id)) return { error: ID_RANGE_MSG };
  if (!subject) return { error: 'กรุณาเลือกรายวิชา' };
  if (body.score === '' || body.score === null || body.score === undefined || isNaN(score) || score < 0 || score > 100) {
    return { error: 'คะแนนต้องอยู่ระหว่าง 0 - 100' };
  }

  // วิชาต้องมีอยู่ในตาราง subjects (admin เพิ่มวิชาได้ที่หน้า Admin)
  const { data: subj, error } = await supabase.from('subjects').select('id').eq('name', subject).limit(1);
  if (error) return { error: error.message };
  if (!subj || !subj.length) return { error: `ไม่พบวิชา "${subject}" กรุณาเพิ่มวิชาก่อน` };

  return { value: { student_id, subject, score, pic } };
}

// รูป (Pic) เป็นของนักเรียนแต่ละคน: เมื่อบันทึกรูปใหม่ ให้ใช้รูปเดียวกันทุกวิชาของนักเรียนคนนั้น
async function syncStudentPic(supabase, student_id, pic) {
  if (!pic) return;
  await supabase.from('student_scores').update({ pic }).eq('student_id', student_id);
}

module.exports = async function handler(req, res) {
  try {
    const supabase = getSupabase();

    // ตรวจสอบสถานะการเชื่อมต่อ Vercel <-> Supabase
    if (req.method === 'GET' && req.query.health === '1') {
      const { error } = await supabase.from('student_scores').select('id').limit(1);
      if (error) return res.status(500).json({ connected: false, error: error.message });
      return res.status(200).json({ connected: true });
    }

    // GET: ค้นหารายบุคคล (สำหรับนักเรียน) หรือดึงทั้งหมด (เฉพาะ Admin)
    if (req.method === 'GET') {
      const studentId = (req.query.student_id || '').trim();

      if (studentId) {
        if (!isValidStudentId(studentId)) {
          return res.status(404).json({ error: ID_RANGE_MSG, data: [] });
        }
        const { data, error } = await supabase
          .from('student_scores')
          .select('*')
          .eq('student_id', studentId)
          .order('id', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
      }

      if (!verifyToken(req.headers.authorization)) {
        return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เข้าถึงข้อมูลทั้งหมดได้' });
      }

      const { data, error } = await supabase
        .from('student_scores')
        .select('*')
        .order('id', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    // ตั้งแต่ตรงนี้ (Insert / Edit / Delete) ต้องเป็น Admin
    if (!verifyToken(req.headers.authorization)) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ Admin ก่อนทำรายการ' });
    }

    // POST: เพิ่มคะแนน (Insert)
    if (req.method === 'POST') {
      const { value, error: vErr } = await validatePayload(supabase, req.body || {});
      if (vErr) return res.status(400).json({ error: vErr });

      // นักเรียน 1 คน มีคะแนนได้ 1 รายการต่อวิชา
      const { data: dup } = await supabase
        .from('student_scores')
        .select('id')
        .eq('student_id', value.student_id)
        .eq('subject', value.subject)
        .limit(1);
      if (dup && dup.length) {
        return res.status(409).json({ error: `รหัส ${value.student_id} มีคะแนนวิชา "${value.subject}" แล้ว ให้ใช้ปุ่มแก้ไขแทน` });
      }

      const { data, error } = await supabase.from('student_scores').insert([value]).select();
      if (error) return res.status(500).json({ error: error.message });
      await syncStudentPic(supabase, value.student_id, value.pic);
      return res.status(201).json({ data: data[0] });
    }

    // PUT: แก้ไขคะแนน (Edit) — รับ id ได้ทั้งจาก ?id= และจาก body
    if (req.method === 'PUT') {
      const id = (req.body && req.body.id) || req.query.id;
      if (!id) return res.status(400).json({ error: 'ไม่พบรหัสรายการที่ต้องการแก้ไข' });

      const { value, error: vErr } = await validatePayload(supabase, req.body || {});
      if (vErr) return res.status(400).json({ error: vErr });

      const { data: dup } = await supabase
        .from('student_scores')
        .select('id')
        .eq('student_id', value.student_id)
        .eq('subject', value.subject)
        .neq('id', id)
        .limit(1);
      if (dup && dup.length) {
        return res.status(409).json({ error: `รหัส ${value.student_id} มีคะแนนวิชา "${value.subject}" อยู่แล้วในอีกรายการ` });
      }

      // ถ้าไม่ได้ใส่ลิงก์รูปมา ให้คงรูปเดิมไว้
      if (!value.pic) delete value.pic;
      const { data, error } = await supabase.from('student_scores').update(value).eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });
      if (!data || !data.length) return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการแก้ไข' });
      await syncStudentPic(supabase, value.student_id, value.pic);
      return res.status(200).json({ data: data[0] });
    }

    // DELETE: ลบคะแนน (Delete)
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ไม่พบรหัสรายการที่ต้องการลบ' });

      const { error } = await supabase.from('student_scores').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
