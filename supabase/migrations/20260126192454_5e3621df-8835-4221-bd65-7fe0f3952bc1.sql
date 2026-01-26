-- Update channels RLS to allow public/anon read for active verified channels
-- while admin access is handled via backend functions

-- Drop existing policy
DROP POLICY IF EXISTS "View channels" ON public.channels;

-- Create policy for authenticated users (owners and admins via channel_admins)
CREATE POLICY "Authenticated view channels" ON public.channels
FOR SELECT
TO authenticated
USING (
  -- Owner can always see their channels
  owner_id = auth.uid()
  OR
  -- Users in channel_admins can see those channels
  id IN (
    SELECT channel_id FROM public.channel_admins WHERE user_id = auth.uid()
  )
  OR
  -- Active and verified channels are public
  (is_active = true AND verified = true)
);

-- Create policy for anonymous users (public catalog)
CREATE POLICY "Public view active channels" ON public.channels
FOR SELECT
TO anon
USING (
  is_active = true AND verified = true
);