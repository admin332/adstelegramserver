-- Grant SELECT and UPDATE on cron.job to postgres (the function owner)
GRANT SELECT, UPDATE ON cron.job TO postgres;