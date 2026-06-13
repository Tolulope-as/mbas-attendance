
CREATE TABLE public.lecturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  course_code text NOT NULL,
  level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecturers TO anon, authenticated;
GRANT ALL ON public.lecturers TO service_role;
ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lecturers" ON public.lecturers FOR SELECT USING (true);
CREATE POLICY "Public insert lecturers" ON public.lecturers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update lecturers" ON public.lecturers FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  matric_no text NOT NULL UNIQUE,
  passkey_credential jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update students" ON public.students FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id uuid NOT NULL REFERENCES public.lecturers(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  level text NOT NULL,
  session_date date NOT NULL,
  start_time time NOT NULL,
  expiry_timestamp bigint NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attendance_sessions_status_idx ON public.attendance_sessions(status, expiry_timestamp DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO anon, authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sessions" ON public.attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON public.attendance_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sessions" ON public.attendance_sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  matric_no text NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX attendance_records_session_idx ON public.attendance_records(session_id, checked_in_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO anon, authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read records" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Public insert records" ON public.attendance_records FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
ALTER TABLE public.attendance_sessions REPLICA IDENTITY FULL;
