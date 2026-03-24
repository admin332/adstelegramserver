CREATE OR REPLACE FUNCTION public.admin_manage_cron_jobs(p_action text, p_jobid bigint DEFAULT NULL::bigint, p_active boolean DEFAULT NULL::boolean, p_schedule text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public, cron'
AS $function$
DECLARE
  jobs_array json;
  j record;
BEGIN
  IF p_action = 'list' THEN
    SELECT json_agg(
      json_build_object(
        'jobid', jobid,
        'jobname', jobname,
        'schedule', schedule,
        'active', active,
        'command', command
      )
      ORDER BY jobid
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

  ELSIF p_action = 'toggle' THEN
    IF p_jobid IS NULL OR p_active IS NULL THEN
      RETURN json_build_object('error', 'jobid and active are required');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobid = p_jobid) THEN
      RETURN json_build_object('error', 'job_not_found');
    END IF;
    PERFORM cron.alter_job(job_id := p_jobid, active := p_active);
    RETURN json_build_object('action', 'toggle', 'jobid', p_jobid, 'active', p_active, 'success', true);

  ELSIF p_action = 'toggle_all' THEN
    IF p_active IS NULL THEN
      RETURN json_build_object('error', 'active is required');
    END IF;
    FOR j IN
      SELECT jobid FROM cron.job
      WHERE jobname IN (
        'check-escrow-payments',
        'publish-scheduled-posts',
        'auto-refund-expired-deals',
        'complete-posted-deals',
        'verify-post-integrity',
        'auto-timeout-deals'
      )
    LOOP
      PERFORM cron.alter_job(job_id := j.jobid, active := p_active);
    END LOOP;
    RETURN json_build_object('action', 'toggle_all', 'active', p_active, 'success', true);

  ELSIF p_action = 'update_schedule' THEN
    IF p_jobid IS NULL OR p_schedule IS NULL THEN
      RETURN json_build_object('error', 'jobid and schedule are required');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobid = p_jobid) THEN
      RETURN json_build_object('error', 'job_not_found');
    END IF;
    PERFORM cron.alter_job(job_id := p_jobid, schedule := p_schedule);
    RETURN json_build_object('action', 'update_schedule', 'jobid', p_jobid, 'schedule', p_schedule, 'success', true);

  ELSE
    RETURN json_build_object('error', 'unknown_action');
  END IF;
END;
$function$;