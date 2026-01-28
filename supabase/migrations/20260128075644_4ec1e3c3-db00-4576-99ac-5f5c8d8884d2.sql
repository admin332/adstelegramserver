-- Выдаём права на cron.job для функции с SECURITY DEFINER
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT SELECT, UPDATE ON TABLE cron.job TO postgres;