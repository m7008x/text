const { verifyToken, getSupabase } = require('./_lib');

// จัดการรายวิชา: ทุกคนดูรายชื่อวิชาได้ ส่วนเพิ่ม / แก้ชื่อ / ลบ ต้องเป็น Admin
module.exports = async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('id', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (!verifyToken(req.headers.authorization)) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ Admin ก่อนทำรายการ' });
    }

    // POST: เพิ่มวิชา
    if (req.method === 'POST') {
      const name = String((req.body || {}).name || '').trim();
      if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อวิชา' });

      const { data: dup } = await supabase.from('subjects').select('id').eq('name', name).limit(1);
      if (dup && dup.length) return res.status(409).json({ error: `มีวิชา "${name}" อยู่แล้ว` });

      const { data, error } = await supabase.from('subjects').insert([{ name }]).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ data: data[0] });
    }

    // PUT: แก้ชื่อวิชา (คะแนนเดิมของวิชานั้นจะเปลี่ยนชื่อตามด้วย)
    if (req.method === 'PUT') {
      const id = (req.body && req.body.id) || req.query.id;
      const name = String((req.body || {}).name || '').trim();
      if (!id || !name) return res.status(400).json({ error: 'ข้อมูลสำหรับแก้ไขวิชาไม่ครบ' });

      const { data: old, error: oErr } = await supabase.from('subjects').select('*').eq('id', id).single();
      if (oErr || !old) return res.status(404).json({ error: 'ไม่พบวิชาที่ต้องการแก้ไข' });

      const { data: dup } = await supabase.from('subjects').select('id').eq('name', name).neq('id', id).limit(1);
      if (dup && dup.length) return res.status(409).json({ error: `มีวิชา "${name}" อยู่แล้ว` });

      const oldName = old.name;
      const { data, error } = await supabase.from('subjects').update({ name }).eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });

      await supabase.from('student_scores').update({ subject: name }).eq('subject', oldName);
      return res.status(200).json({ data: data[0] });
    }

    // DELETE: ลบวิชา พร้อมคะแนนทั้งหมดของวิชานั้น
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ไม่พบรหัสวิชาที่ต้องการลบ' });

      const { data: old, error: oErr } = await supabase.from('subjects').select('*').eq('id', id).single();
      if (oErr || !old) return res.status(404).json({ error: 'ไม่พบวิชาที่ต้องการลบ' });

      const { error: sErr } = await supabase.from('student_scores').delete().eq('subject', old.name);
      if (sErr) return res.status(500).json({ error: sErr.message });

      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
