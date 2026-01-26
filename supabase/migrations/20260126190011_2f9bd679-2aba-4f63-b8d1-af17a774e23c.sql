-- Backfill: добавить владельцев существующих каналов в channel_admins
INSERT INTO public.channel_admins (channel_id, user_id, role, permissions, telegram_member_status)
SELECT 
  c.id as channel_id,
  c.owner_id as user_id,
  'owner'::channel_role as role,
  '{"can_edit_posts": true, "can_view_stats": true, "can_view_finance": true, "can_withdraw": true, "can_manage_admins": true, "can_approve_ads": true}'::jsonb as permissions,
  'creator' as telegram_member_status
FROM public.channels c
WHERE c.owner_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.channel_admins ca 
  WHERE ca.channel_id = c.id AND ca.user_id = c.owner_id
);