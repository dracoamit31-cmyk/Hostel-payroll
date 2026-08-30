-- ==============================================================================
-- HostelOps Row Level Security (RLS) Policies
-- Role-based access control (Owner, Manager, Staff, Inventory Manager)
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

-- 2. Helper Functions for RLS Queries
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_property()
RETURNS UUID AS $$
  SELECT property_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- PROPERTIES POLICIES
-- ==============================================================================
-- Authenticated users can view properties
CREATE POLICY "Allow authenticated users to read properties"
ON public.properties FOR SELECT
TO authenticated
USING (true);

-- Owners can insert/update/delete properties
CREATE POLICY "Allow owners full property management"
ON public.properties FOR ALL
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

-- Managers can update their assigned property
CREATE POLICY "Allow managers to update assigned property"
ON public.properties FOR UPDATE
TO authenticated
USING (
  public.current_user_role() = 'manager' AND id = public.current_user_property()
)
WITH CHECK (
  public.current_user_role() = 'manager' AND id = public.current_user_property()
);

-- ==============================================================================
-- USERS POLICIES
-- ==============================================================================
-- Users can view their own profile, managers can view staff in same property, owners see all
CREATE POLICY "Users can view relevant profiles"
ON public.users FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (public.current_user_role() IN ('manager', 'inventory_manager') AND property_id = public.current_user_property())
);

-- Users can update their own profile; owners/managers can manage staff
CREATE POLICY "Users and managers can update profiles"
ON public.users FOR UPDATE
TO authenticated
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

-- Owners and managers can insert staff profiles
CREATE POLICY "Owners and managers can create users"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() IN ('owner', 'manager')
  OR id = auth.uid()
);

-- ==============================================================================
-- TASK CATEGORIES & TASKS POLICIES
-- ==============================================================================
CREATE POLICY "Allow authenticated to view task categories"
ON public.task_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow managers and owners to manage task categories"
ON public.task_categories FOR ALL
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'));

-- Tasks: Staff can read tasks in their property, owners/managers see all in property/system
CREATE POLICY "View tasks for assigned property"
ON public.tasks FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR property_id = public.current_user_property()
  OR created_by = auth.uid()
);

-- Create tasks: Authenticated users can create tasks in their property
CREATE POLICY "Create tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() = 'owner'
  OR property_id = public.current_user_property()
  OR created_by = auth.uid()
);

-- Update tasks (e.g. claim, complete, approve, reject)
CREATE POLICY "Update tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR property_id = public.current_user_property()
  OR created_by = auth.uid()
);

-- ==============================================================================
-- ATTENDANCE POLICIES
-- ==============================================================================
CREATE POLICY "Staff can view and mark their own attendance"
ON public.attendance_records FOR ALL
TO authenticated
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

-- ==============================================================================
-- LEAVE, WEEK-OFF & CORRECTION REQUEST POLICIES
-- ==============================================================================
CREATE POLICY "Manage leave requests"
ON public.leave_requests FOR ALL
TO authenticated
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

CREATE POLICY "Manage week off requests"
ON public.week_off_requests FOR ALL
TO authenticated
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

CREATE POLICY "Manage attendance correction requests"
ON public.attendance_correction_requests FOR ALL
TO authenticated
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

-- Vouchers policy
CREATE POLICY "Manage vouchers"
ON public.vouchers FOR ALL
TO authenticated
USING (
  created_by = auth.uid()
  OR public.current_user_role() = 'owner'
  OR public.current_user_role() = 'manager'
)
WITH CHECK (
  created_by = auth.uid()
  OR public.current_user_role() = 'owner'
  OR public.current_user_role() = 'manager'
);
