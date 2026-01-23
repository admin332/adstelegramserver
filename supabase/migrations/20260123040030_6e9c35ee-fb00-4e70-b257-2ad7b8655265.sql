-- Add auth_user_id column to link with Supabase Auth users
ALTER TABLE public.users 
ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make telegram_id nullable for email-based users
ALTER TABLE public.users 
ALTER COLUMN telegram_id DROP NOT NULL;

-- Create index for fast lookup by auth_user_id
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);

-- Add unique constraint to prevent duplicate auth_user_id entries
ALTER TABLE public.users 
ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);

-- Add policy for users to view their profile via auth_user_id
CREATE POLICY "Users can view own profile via auth_user_id"
ON public.users
FOR SELECT
USING (auth.uid() = auth_user_id);

-- Add policy for users to update their profile via auth_user_id
CREATE POLICY "Users can update own profile via auth_user_id"
ON public.users
FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Add policy for authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);