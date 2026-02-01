-- Drop existing function and create extended version
DROP FUNCTION IF EXISTS public.manage_cron_jobs(text);

-- Create extended function for admin cron management
CREATE OR REPLACE FUNCTION public.admin_manage_cron_jobs(
  p_action text,
  p_jobid bigint DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_schedule text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  job_record record;
  jobs_array json;
BEGIN
  -- Action: list - get all cron jobs for our app
  IF p_action = 'list' THEN
    SELECT json_agg(
      json_build_object(
        'jobid', jobid,
        'jobname', jobname,
        'schedule', schedule,
        'active', active,
        'command', command
      )
    )
    INTO jobs_array
    FROM cron.job
    WHERE jobname IN (
      'check-escrow-payments',
      'publish-scheduled-posts',
      'auto-refund-expired-deals',
      'complete-posted-deals',
      'verify-post-integrity',
      'auto-timeout-deals'
    );
    
    RETURN COALESCE(jobs_array, '[]'::json);

  -- Action: toggle - enable/disable specific job
  ELSIF p_action = 'toggle' THEN
    IF p_jobid IS NULL OR p_active IS NULL THEN
      RETURN json_build_object('error', 'jobid and active are required');
    END IF;
    
    UPDATE cron.job 
    SET active = p_active 
    WHERE jobid = p_jobid;
    
    RETURN json_build_object(
      'action', 'toggle',
      'jobid', p_jobid,
      'active', p_active,
      'success', true
    );

  -- Action: toggle_all - enable/disable all jobs
  ELSIF p_action = 'toggle_all' THEN
    IF p_active IS NULL THEN
      RETURN json_build_object('error', 'active is required');
    END IF;
    
    UPDATE cron.job 
    SET active = p_active 
    WHERE jobname IN (
      'check-escrow-payments',
      'publish-scheduled-posts',
      'auto-refund-expired-deals',
      'complete-posted-deals',
      'verify-post-integrity',
      'auto-timeout-deals'
    );
    
    RETURN json_build_object(
      'action', 'toggle_all',
      'active', p_active,
      'success', true
    );

  -- Action: update_schedule - change schedule for specific job
  ELSIF p_action = 'update_schedule' THEN
    IF p_jobid IS NULL OR p_schedule IS NULL THEN
      RETURN json_build_object('error', 'jobid and schedule are required');
    END IF;
    
    UPDATE cron.job 
    SET schedule = p_schedule 
    WHERE jobid = p_jobid;
    
    RETURN json_build_object(
      'action', 'update_schedule',
      'jobid', p_jobid,
      'schedule', p_schedule,
      'success', true
    );

  ELSE
    RETURN json_build_object('error', 'unknown_action');
  END IF;
END;
$function$;