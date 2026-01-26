-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Anyone can view active channels" ON public.channels;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;

-- Channels: владельцы видят свои + все видят активные верифицированные
CREATE POLICY "View channels"
ON public.channels FOR SELECT
USING (owner_id = auth.uid() OR (is_active = true AND verified = true));

-- Channels: владельцы могут обновлять свои каналы
CREATE POLICY "Owners can update own channels"
ON public.channels FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Campaigns: владельцы видят свои + все видят активные
CREATE POLICY "View campaigns"
ON public.campaigns FOR SELECT
USING (owner_id = auth.uid() OR is_active = true);

-- Campaigns: владельцы могут обновлять свои кампании
CREATE POLICY "Owners can update own campaigns"
ON public.campaigns FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Campaigns: владельцы могут удалять свои кампании
CREATE POLICY "Owners can delete own campaigns"
ON public.campaigns FOR DELETE
USING (owner_id = auth.uid());