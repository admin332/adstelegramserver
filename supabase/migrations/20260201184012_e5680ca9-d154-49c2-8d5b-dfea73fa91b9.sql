-- Grant UPDATE permission on cron.job table to postgres role (function owner)
GRANT UPDATE ON cron.job TO postgres;

-- Also ensure the function is owned by postgres for proper permissions
ALTER FUNCTION public.admin_manage_cron_jobs(text, bigint, boolean, text) OWNER TO postgres;