-- รันไฟล์นี้ใน Supabase > SQL Editor ครั้งเดียว เพื่อสร้างตารางที่ระบบใช้

-- ตารางรายวิชา (admin เพิ่ม / แก้ชื่อ / ลบได้จากหน้าเว็บ)
create table if not exists public.subjects (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ตารางคะแนน: นักเรียน 1 คน มีคะแนนได้ 1 รายการต่อวิชา
create table if not exists public.student_scores (
  id          bigint generated always as identity primary key,
  -- ช่วงรหัสนักเรียนตรวจที่ API (ตั้งใน public/config.js) ตรงนี้ตรวจแค่ว่าเป็นตัวเลข
  student_id  text not null check (student_id ~ '^[0-9]{1,20}$'),
  subject     text not null,
  score       numeric not null check (score >= 0 and score <= 100),
  pic         text,
  created_at  timestamptz not null default now(),
  unique (student_id, subject)
);

-- ถ้ามีตาราง student_scores จากเวอร์ชันเดิมอยู่แล้ว ให้เพิ่มเงื่อนไขเหล่านี้แทน
-- (ลบเครื่องหมาย -- หน้าบรรทัดออกก่อนรัน)
-- alter table public.student_scores add constraint student_scores_student_subject_key unique (student_id, subject);
-- alter table public.student_scores drop constraint if exists student_scores_student_id_check;
-- alter table public.student_scores add constraint student_scores_student_id_check check (student_id ~ '^[0-9]{1,20}$');

-- เปิด Row Level Security โดยไม่มี policy: เข้าถึงได้เฉพาะผ่าน API ของ Vercel (service role key)
alter table public.subjects enable row level security;
alter table public.student_scores enable row level security;
