-- Rework admin_manage_cron_jobs to avoid direct UPDATE on cron.job (not grantable from our role)
-- Use cron.alter_job which is the supported API for modifying pg_cron jobs.

CREATE OR REPLACE FUNCTION public.admin_manage_cron_jobs(
  p_action text,
  p_jobid bigint DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_schedule text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, cron'
AS $function$
DECLARE
  jobs_array json;
  j record;
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

  -- Action: toggle - enable/disable specific job
  ELSIF p_action = 'toggle' THEN
    IF p_jobid IS NULL OR p_active IS NULL THEN
      RETURN json_build_object('error', 'jobid and active are required');
    END IF;

    SELECT * INTO j FROM cron.job WHERE jobid = p_jobid;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'job_not_found');
    END IF;

    PERFORM cron.alter_job(j.jobid, j.schedule, j.command, j.database, j.username, p_active);

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

    FOR j IN
      SELECT *
      FROM cron.job
      WHERE jobname IN (
        'check-escrow-payments',
        'publish-scheduled-posts',
        'auto-refund-expired-deals',
        'complete-posted-deals',
        'verify-post-integrity',
        'auto-timeout-deals'
      )
    LOOP
      PERFORM cron.alter_job(j.jobid, j.schedule, j.command, j.database, j.username, p_active);
    END LOOP;

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

    SELECT * INTO j FROM cron.job WHERE jobid = p_jobid;
    IF NOT FOUND THEN
      RETURN json_build_object('error', 'job_not_found');
    END IF;

    PERFORM cron.alter_job(j.jobid, p_schedule, j.command, j.database, j.username, j.active);

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