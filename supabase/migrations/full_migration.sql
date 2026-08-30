-- ==============================================================================
-- HostelOps Robust Clean Supabase Migration (Idempotent & Error-Free)
-- Run this in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geofence_radius_m INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'inventory_manager', 'staff')),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    staff_type TEXT,
    shift_start TEXT,
    shift_end TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.task_categories(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'approved', 'rejected', 'settled')),
    last_action_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    last_action_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'online', 'unpaid')),
    amount NUMERIC(10, 2),
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clock_in_time TEXT,
    clock_in_selfie_url TEXT,
    clock_in_lat DOUBLE PRECISION,
    clock_in_lng DOUBLE PRECISION,
    clock_out_time TEXT,
    clock_out_selfie_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'late', 'on_leave', 'week_off')),
    marked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_attendance_user_date UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.week_off_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    requested_dates TEXT[] NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_property_id ON public.users(property_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_tasks_property_id ON public.tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_records(user_id, date);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_property()
RETURNS UUID AS $$
  SELECT property_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Drop existing policies if re-running to avoid "policy already exists" error
DROP POLICY IF EXISTS "Allow authenticated users to read properties" ON public.properties;
DROP POLICY IF EXISTS "Allow owners full property management" ON public.properties;
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.users;
DROP POLICY IF EXISTS "Users and managers can update profiles" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated to view task categories" ON public.task_categories;
DROP POLICY IF EXISTS "View tasks for assigned property" ON public.tasks;
DROP POLICY IF EXISTS "Create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Staff attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Leave requests policy" ON public.leave_requests;
DROP POLICY IF EXISTS "Week off requests policy" ON public.week_off_requests;
DROP POLICY IF EXISTS "Attendance correction policy" ON public.attendance_correction_requests;
DROP POLICY IF EXISTS "Vouchers policy" ON public.vouchers;

-- Create Policies
CREATE POLICY "Allow authenticated users to read properties"
ON public.properties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow owners full property management"
ON public.properties FOR ALL TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

CREATE POLICY "Users can view relevant profiles"
ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() IN ('manager', 'inventory_manager') AND property_id = public.current_user_property())
);

CREATE POLICY "Users and managers can update profiles"
ON public.users FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND property_id = public.current_user_property())
)
WITH CHECK (
  id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND property_id = public.current_user_property())
);

CREATE POLICY "Allow authenticated to view task categories"
ON public.task_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "View tasks for assigned property"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR property_id = public.current_user_property()
  OR created_by = auth.uid()
);

CREATE POLICY "Create tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'owner'
  OR property_id = public.current_user_property()
  OR created_by = auth.uid()
);

CREATE POLICY "Update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR property_id = public.current_user_property()
  OR created_by = auth.uid()
);

CREATE POLICY "Staff attendance"
ON public.attendance_records FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
)
WITH CHECK (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
);

CREATE POLICY "Leave requests policy"
ON public.leave_requests FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
)
WITH CHECK (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
);

CREATE POLICY "Week off requests policy"
ON public.week_off_requests FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
)
WITH CHECK (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
);

CREATE POLICY "Attendance correction policy"
ON public.attendance_correction_requests FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
)
WITH CHECK (
  user_id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() = 'manager' AND user_id IN (
    SELECT id FROM public.users WHERE property_id = public.current_user_property()
  ))
);

CREATE POLICY "Vouchers policy"
ON public.vouchers FOR ALL TO authenticated
USING (
  created_by = auth.uid()
  OR public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  created_by = auth.uid()
  OR public.current_user_role() IN ('owner', 'manager')
);

-- 5. STORAGE BUCKETS (Public so images/proofs render cleanly)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('task-proofs', 'task-proofs', true),
  ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT (id) DO UPDATE SET public = true;
