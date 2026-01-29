

# Удаление/замена упоминаний Lovable на AGDX

## Обзор

Проект содержит упоминания "Lovable" в нескольких местах. Заменим их на "AGDX" (вашу компанию разработки).

## Найденные файлы с упоминаниями

| Файл | Тип упоминания | Можно изменить? |
|------|----------------|-----------------|
| `index.html` | meta author, twitter:site | Да |
| `README.md` | Документация проекта | Да |
| `vite.config.ts` | lovable-tagger плагин | Нет (системная зависимость) |
| `package.json` | lovable-tagger зависимость | Нет (системная зависимость) |
| `bun.lock`, `package-lock.json` | Lock-файлы | Автоматически обновляются |

## Изменения

### 1. index.html

**Строка 13** - автор:
```html
<!-- Было -->
<meta name="author" content="Lovable" />

<!-- Станет -->
<meta name="author" content="AGDX" />
```

**Строка 22** - Twitter аккаунт:
```html
<!-- Было -->
<meta name="twitter:site" content="@Lovable" />

<!-- Станет -->
<meta name="twitter:site" content="@agdx_dev" />
```

Также уберу устаревшие TODO-комментарии:
- Строка 10: `<!-- TODO: Set the document title... -->`
- Строка 15: `<!-- TODO: Update og:title... -->`

### 2. README.md

Полностью перепишу README под ваш проект Adsingo с информацией о AGDX:

```markdown
# Adsingo

Маркетплейс Telegram-рекламы с безопасными сделками (Escrow), верифицированной статистикой каналов и автопостингом.

## Технологии

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase (Backend)
- TON Blockchain (Escrow-платежи)

## Разработка

Разработано командой AGDX.

## Локальный запуск

npm install
npm run dev

## Деплой

Проект автоматически разворачивается на Lovable Cloud.
```

### 3. Файлы, которые НЕ трогаем

- **vite.config.ts** - `lovable-tagger` это системный плагин Lovable, который обеспечивает работу редактора. Удаление сломает проект.
- **package.json** - Зависимость `lovable-tagger` необходима для работы.
- **Lock-файлы** - Обновляются автоматически.

## Файлы к изменению

| Файл | Действие |
|------|----------|
| `index.html` | Заменить Lovable → AGDX |
| `README.md` | Переписать под Adsingo/AGDX |

## Результат

После изменений:
- В meta-тегах автор будет "AGDX"
- Twitter будет ссылаться на ваш аккаунт
- README будет содержать актуальную информацию о проекте
- Системные зависимости останутся работать корректно

