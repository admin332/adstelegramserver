-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Users are publicly readable" ON public.users;

-- Create a proper SELECT policy: admins can view all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Note: Service role policies remain for edge functions that use service_role key
-- The service role bypasses RLS anyway, so these policies are for explicit documentation