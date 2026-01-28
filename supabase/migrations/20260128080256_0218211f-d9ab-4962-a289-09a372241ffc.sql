-- Update check-escrow-payments cron job to run every 5 minutes instead of every minute
SELECT cron.alter_job(
  job_id := 1,
  schedule := '*/5 * * * *'
);