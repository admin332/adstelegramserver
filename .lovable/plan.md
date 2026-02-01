
# План: Подготовка README.md для GitHub-конкурса

## Цель
Создать полную документацию проекта Adsingo для конкурса Telegram Mini App. README должен содержать:
- Описание проекта и архитектуры
- Инструкции по запуску и деплою
- Ключевые технические решения
- Известные ограничения
- Указание на использование AI

---

## Структура нового README.md

### 1. Заголовок и краткое описание
- Название: **Adsingo**
- Описание: Telegram Mini App маркетплейс рекламы с эскроу-сделками, верифицированной статистикой и автопостингом

### 2. Features (Ключевые функции)
- ✅ Двусторонний маркетплейс (рекламодатели + владельцы каналов)
- ✅ Верифицированная статистика каналов (Bot API + MTProto)
- ✅ TON эскроу-платежи (уникальный кошелёк на каждую сделку)
- ✅ Творческий воркфлоу (бриф → черновик → одобрение)
- ✅ Автопостинг с проверкой целостности
- ✅ Команда канала (владелец + менеджеры)
- ✅ 24-часовые таймауты с автовозвратами

### 3. Tech Stack
```
Frontend:
- React 18 + TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- TonConnect UI React

Backend:
- Supabase (PostgreSQL + Edge Functions)
- Deno runtime
- TON SDK (@ton/ton, @ton/crypto)
- Telegram Bot API
- MTProto (через VPS proxy)
```

### 4. Architecture Overview
ASCII-диаграмма системы:
```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM MINI APP                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Channels   │  │   Deals     │  │   Profile/Create    │  │
│  │  Marketplace│  │   Manager   │  │   Campaign Manager  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │telegram-auth │ │ create-deal  │ │ publish-scheduled  │   │
│  │telegram-wh   │ │ deal-action  │ │ verify-integrity   │   │
│  │verify-channel│ │check-escrow  │ │ auto-timeout       │   │
│  └──────────────┘ └──────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   TELEGRAM      │ │   TON NETWORK   │ │    POSTGRESQL       │
│   Bot API       │ │   TonCenter     │ │    + RLS Policies   │
│   MTProto VPS   │ │   Escrow Wallet │ │    + pg_cron        │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

### 5. Deal Lifecycle Flow
ASCII-диаграмма жизненного цикла сделки:
```
pending → escrow → in_progress → completed
   │         │          │
   │         │          └──→ cancelled (post_deleted)
   │         │
   │         └──→ cancelled (owner_timeout / advertiser_timeout)
   │
   └──→ expired (payment timeout)
```

### 6. Database Schema (ключевые таблицы)
- `users` - пользователи Telegram
- `channels` - верифицированные каналы
- `channel_admins` - команда канала (owner/manager)
- `campaigns` - рекламные кампании (ready_post/prompt)
- `deals` - сделки с эскроу
- `reviews` - отзывы о каналах

### 7. Edge Functions (39 функций)
Категоризация:
- **Auth**: telegram-auth
- **Channels**: verify-channel, refresh-channel-stats, channel-team
- **Deals**: create-deal, deal-action, check-escrow-payments
- **Publishing**: publish-scheduled-posts, verify-post-integrity
- **Automation**: auto-timeout-deals, auto-refund-expired-deals
- **Bot**: telegram-webhook (draft handling, approvals)

### 8. Security Measures
- HMAC-SHA256 validation of Telegram initData
- AES-256-GCM encryption for escrow mnemonics
- Row Level Security (RLS) policies
- Service role for sensitive operations
- Escrow: unique wallet per deal

### 9. Environment Variables
```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=

# TON
TONCENTER_API_KEY=
ENCRYPTION_KEY=  # 64 hex chars for AES-256

# MTProto (optional, for detailed stats)
MTPROTO_API_ID=
MTPROTO_API_HASH=
MTPROTO_VPS_URL=
MTPROTO_VPS_SECRET=
```

### 10. Local Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test
```

### 11. Deployment
Инструкции для:
- Supabase project setup
- Edge functions deployment
- Telegram Bot configuration
- pg_cron jobs setup

### 12. Key Design Decisions
1. **Unique escrow wallet per deal** - максимальная безопасность средств
2. **Draft versioning** - рекламодатель может выбрать любую из предыдущих версий
3. **24h timeouts with splits** - 100% refund при no-draft, 70/30 при no-review
4. **Channel team** - owner + managers, уведомления всем
5. **Post integrity verification** - проверка что пост не удалён

### 13. Known Limitations
- pg_cron management requires superuser (workaround: application-level toggle)
- MTProto requires VPS proxy (Deno doesn't support native modules)
- Edge function timeout: 150 seconds
- TonConnect in TMA: callback issues (workaround: localStorage polling)

### 14. AI Usage Disclosure
**~85% code written with AI assistance (Lovable)**
- Architecture design: Human
- Business logic: AI-assisted with human review
- Edge functions: AI-generated with manual testing
- UI/UX: AI-generated

### 15. Future Improvements
- Multi-post scheduling with intervals
- Channel analytics dashboard
- Dispute resolution system
- Advertiser reputation system
- Batch escrow operations

---

## Технические детали

### Файл для изменения
| Файл | Действие |
|------|----------|
| `README.md` | Полная переработка (~300 строк) |

### Структура README
1. Title + badges
2. Demo links (bot, mini app)
3. Features list
4. Architecture diagram
5. Tech stack
6. Quick start
7. Environment setup
8. Deployment guide
9. Design decisions
10. Limitations
11. AI disclosure
12. License

---

## Примечания
- Убраны все упоминания "Lovable" как платформы
- Добавлены deployment инструкции для self-hosted Supabase
- Указан процент AI-кода (85%)
- Документация на английском для международного конкурса
