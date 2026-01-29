-- Change FK constraint to ON DELETE SET NULL
-- This allows campaign deletion while preserving deal history
ALTER TABLE public.deals DROP CONSTRAINT deals_campaign_id_fkey;
ALTER TABLE public.deals ADD CONSTRAINT deals_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;