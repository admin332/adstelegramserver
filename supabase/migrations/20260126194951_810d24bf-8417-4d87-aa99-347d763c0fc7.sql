-- Drop the problematic recursive policy that causes infinite recursion
DROP POLICY IF EXISTS "Channel admins can view co-admins" ON public.channel_admins;

-- Also fix the channels policy that references channel_admins and causes recursion
DROP POLICY IF EXISTS "Authenticated view channels" ON public.channels;

-- Recreate a simpler channels policy without the recursive subquery
CREATE POLICY "Authenticated view channels" ON public.channels
FOR SELECT USING (
  (owner_id = auth.uid()) OR 
  ((is_active = true) AND (verified = true))
);