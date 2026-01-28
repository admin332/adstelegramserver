-- Функция для автоматического управления cron jobs
CREATE OR REPLACE FUNCTION public.manage_cron_jobs(action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_deals boolean;
  result json;
BEGIN
  -- Проверяем есть ли активные сделки
  SELECT EXISTS (
    SELECT 1 FROM public.deals 
    WHERE status IN ('pending', 'escrow', 'in_progress')
  ) INTO has_active_deals;

  IF action = 'activate' THEN
    -- Включаем все jobs
    UPDATE cron.job SET active = true 
    WHERE jobid IN (1, 3, 4, 5, 6);
    
    result := json_build_object(
      'action', 'activated',
      'jobs_affected', 5
    );
    
  ELSIF action = 'check_and_deactivate' THEN
    -- Отключаем только если нет активных сделок
    IF NOT has_active_deals THEN
      UPDATE cron.job SET active = false 
      WHERE jobid IN (1, 3, 4, 5, 6);
      
      result := json_build_object(
        'action', 'deactivated',
        'reason', 'no_active_deals'
      );
    ELSE
      result := json_build_object(
        'action', 'kept_active',
        'reason', 'has_active_deals'
      );
    END IF;
    
  ELSE
    result := json_build_object('error', 'unknown_action');
  END IF;
  
  RETURN result;
END;
$$;