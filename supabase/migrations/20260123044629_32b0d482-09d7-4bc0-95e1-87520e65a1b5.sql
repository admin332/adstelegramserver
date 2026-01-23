-- Создаём таблицу для хранения настроек приложения
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать настройки
CREATE POLICY "Anyone can read settings"
ON public.app_settings FOR SELECT
USING (true);

-- Политика: только админы могут изменять настройки
CREATE POLICY "Admins can manage settings"
ON public.app_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Начальное значение - тестовый режим выключен
INSERT INTO public.app_settings (key, value)
VALUES ('test_mode', '{"enabled": false}');