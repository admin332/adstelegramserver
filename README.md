# Adsingo

Telegram Mini App marketplace for advertising with escrow deals, verified channel statistics, and auto-posting.

**Demo Bot**: [@adsingo_bot](https://t.me/adsingo_bot)  
**Mini App**: [Launch App](https://t.me/adsingo_bot)

---

## Features

- **Two-sided marketplace** — Advertisers create campaigns, channel owners list channels
- **Verified channel stats** — Bot API + MTProto for subscribers, views, engagement, language distribution
- **TON escrow payments** — Unique wallet per deal, AES-256-GCM encrypted mnemonics
- **Creative workflow** — Brief → Draft → Approval loop via Telegram bot
- **Auto-posting** — Scheduled publishing with post integrity verification
- **Channel team** — Owner + managers with permission-based access
- **24h timeouts** — Automatic refunds with configurable splits (100% / 70-30)
- **Draft versioning** — Advertiser can select any previous draft version

---

## Architecture

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

---

## Deal Lifecycle

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
  ┌─────────┐       │    ┌────────┐      ┌─────────────┐      │      ┌───────────┐
  │ pending │───────┼───▶│ escrow │─────▶│ in_progress │──────┼─────▶│ completed │
  └────┬────┘       │    └───┬────┘      └──────┬──────┘      │      └───────────┘
       │            │        │                  │              │
       │            │        │                  │              │
       ▼            │        ▼                  ▼              │
  ┌─────────┐       │   ┌───────────┐     ┌───────────┐       │
  │ expired │       │   │ cancelled │     │ cancelled │       │
  │(no pay) │       │   │(timeout)  │     │(post del) │       │
  └─────────┘       │   └───────────┘     └───────────┘       │
                    └──────────────────────────────────────────┘

Statuses:
- pending     — Deal created, awaiting payment
- escrow      — Payment received, awaiting draft from channel owner
- in_progress — Draft approved, post scheduled or published
- completed   — Post verified, funds released to channel owner
- cancelled   — Deal cancelled (timeout, post deleted, manual)
- expired     — Payment not received within timeout
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| TanStack Query | Server state management |
| TonConnect UI React | TON wallet integration |
| Framer Motion | Animations |

### Backend
| Technology | Purpose |
|------------|---------|
| Supabase | PostgreSQL + Edge Functions + Auth |
| Deno | Edge functions runtime |
| @ton/ton + @ton/crypto | TON blockchain SDK |
| Telegram Bot API | Bot interactions, posting |
| MTProto (VPS proxy) | Advanced channel statistics |
| pg_cron | Scheduled jobs |

---

## Database Schema

### Core Tables

```sql
users
├── id (uuid, PK)
├── telegram_id (bigint, unique)
├── first_name, last_name, username
├── wallet_address (text)
└── is_premium (boolean)

channels
├── id (uuid, PK)
├── telegram_chat_id (bigint)
├── username, title, description
├── owner_id (uuid, FK → users)
├── category (text)
├── subscribers_count, avg_views, engagement
├── price_post, price_1_24, price_2_48
├── bot_is_admin, verified (boolean)
└── stats_updated_at (timestamptz)

channel_admins
├── id (uuid, PK)
├── channel_id (uuid, FK → channels)
├── user_id (uuid, FK → users)
├── role (enum: 'owner' | 'manager')
├── permissions (jsonb)
└── telegram_member_status (text)

campaigns
├── id (uuid, PK)
├── owner_id (uuid, FK → users)
├── name, text
├── campaign_type (text: 'ready_post' | 'prompt')
├── media_urls (jsonb)
├── button_text, button_url
└── is_active (boolean)

deals
├── id (uuid, PK)
├── advertiser_id (uuid, FK → users)
├── channel_id (uuid, FK → channels)
├── campaign_id (uuid, FK → campaigns)
├── status (enum: pending/escrow/in_progress/completed/cancelled/expired)
├── escrow_address, escrow_mnemonic_encrypted
├── escrow_balance (numeric)
├── total_price, price_per_post
├── posts_count, duration_hours
├── scheduled_at, posted_at, completed_at
├── author_draft, author_drafts (jsonb)
├── is_draft_approved (boolean)
├── telegram_message_ids (jsonb)
└── cancellation_reason (text)

reviews
├── id (uuid, PK)
├── channel_id (uuid, FK → channels)
├── reviewer_id (uuid, FK → users)
├── deal_id (uuid, FK → deals)
├── rating (integer, 1-5)
└── comment (text)
```

---

## Edge Functions

39 edge functions organized by domain:

### Authentication
| Function | Description |
|----------|-------------|
| `telegram-auth` | Validates Telegram initData with HMAC-SHA256 |

### Channels
| Function | Description |
|----------|-------------|
| `verify-channel` | Verifies bot admin status, fetches initial stats |
| `refresh-channel-stats` | Updates channel statistics from Telegram |
| `mtproto-channel-stats` | Fetches detailed stats via MTProto VPS proxy |
| `channel-team` | Manages channel admins (owner/managers) |
| `update-channel-settings` | Updates channel prices and settings |
| `user-channels` | Lists user's channels (as owner or manager) |
| `detect-bot-channels` | Detects channels where bot was added as admin |

### Deals
| Function | Description |
|----------|-------------|
| `create-deal` | Creates deal with unique escrow wallet |
| `deal-action` | Handles deal state transitions |
| `check-escrow-payments` | Monitors escrow wallet for incoming payments |
| `user-deals` | Lists user's deals (as advertiser or channel team) |
| `notify-deal-payment` | Sends payment notifications to parties |

### Creative Workflow
| Function | Description |
|----------|-------------|
| `submit-draft` | Channel owner submits draft via bot |
| `review-draft` | Advertiser approves/rejects draft |
| `telegram-webhook` | Handles bot callbacks for draft workflow |

### Publishing
| Function | Description |
|----------|-------------|
| `publish-scheduled-posts` | Posts approved creatives at scheduled time |
| `verify-post-integrity` | Checks posts aren't deleted/edited |
| `complete-posted-deals` | Completes deals after duration expires |

### Automation
| Function | Description |
|----------|-------------|
| `auto-timeout-deals` | 24h timeouts for no-draft/no-review |
| `auto-refund-expired-deals` | Refunds expired pending deals |
| `admin-cancel-deal` | Admin-initiated deal cancellation |
| `admin-complete-deal` | Admin-initiated deal completion |

### Campaigns
| Function | Description |
|----------|-------------|
| `create-campaign` | Creates advertiser campaign |
| `update-campaign` | Updates campaign content |
| `delete-campaign` | Deletes campaign |
| `upload-campaign-media` | Handles media uploads to storage |
| `send-campaign-preview` | Sends campaign preview to bot |

---

## Security

### Authentication
- **HMAC-SHA256** validation of Telegram `initData`
- Session stored in Supabase Auth with custom claims

### Escrow Security
- **Unique wallet per deal** — No shared hot wallet
- **AES-256-GCM** encryption for mnemonic storage
- **32-byte encryption key** stored as environment secret
- Funds released only after post integrity verified

### Database Security
- **Row Level Security (RLS)** on all tables
- Service role used only for sensitive operations
- Channel team verification on financial operations

### Bot Security
- Webhook signature validation
- Rate limiting on sensitive endpoints
- Admin status re-verification before posting

---

## Local Development

### Prerequisites
- Node.js 18+
- npm or bun
- Supabase CLI (optional, for local development)

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-repo/adsingo.git
cd adsingo

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Environment Variables

Create `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# For edge functions (set in Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# TON
TONCENTER_API_KEY=your-toncenter-api-key
ENCRYPTION_KEY=64-hex-chars-for-aes-256

# MTProto (optional, for detailed stats)
MTPROTO_API_ID=your-api-id
MTPROTO_API_HASH=your-api-hash
MTPROTO_VPS_URL=https://your-mtproto-proxy.com
MTPROTO_VPS_SECRET=your-vps-secret
```

---

## Deployment

### 1. Supabase Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push database migrations
supabase db push

# Deploy edge functions
supabase functions deploy
```

### 2. Telegram Bot Configuration

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Set webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-project.supabase.co/functions/v1/telegram-webhook"}'
```
3. Enable inline mode and add Mini App via BotFather

### 3. pg_cron Jobs

Set up scheduled jobs in Supabase SQL editor:

```sql
-- Check escrow payments every 5 minutes
SELECT cron.schedule(
  'check-escrow-payments',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/check-escrow-payments',
    headers := '{"Authorization": "Bearer your-anon-key"}'::jsonb
  )$$
);

-- Publish scheduled posts every 5 minutes
SELECT cron.schedule(
  'publish-scheduled-posts',
  '*/5 * * * *',
  $$SELECT net.http_post(...)$$
);

-- Auto-timeout deals every 30 minutes
SELECT cron.schedule(
  'auto-timeout-deals',
  '*/30 * * * *',
  $$SELECT net.http_post(...)$$
);

-- Verify post integrity every hour
SELECT cron.schedule(
  'verify-post-integrity',
  '0 * * * *',
  $$SELECT net.http_post(...)$$
);
```

### 4. MTProto VPS (Optional)

For advanced channel statistics, deploy MTProto proxy:

```bash
# On your VPS
git clone https://github.com/AdsIngo/mtproto-proxy.git
cd mtproto-proxy
npm install
npm start
```

Configure environment variables in edge functions to point to your VPS.

---

## Key Design Decisions

### 1. Unique Escrow Wallet Per Deal
**Why**: Maximum security — funds are isolated per deal. Even if one wallet is compromised, other deals are safe.

**Implementation**: 
- New TON wallet generated for each deal
- Mnemonic encrypted with AES-256-GCM before storage
- Wallet monitored for incoming payments via TonCenter API

### 2. Draft Versioning
**Why**: Advertisers often want to revert to earlier versions after multiple revisions.

**Implementation**:
- All drafts stored in `author_drafts` JSONB array
- Each draft includes text, entities, media, and timestamp
- Advertiser can select any previous version for approval

### 3. 24h Timeouts with Splits
**Why**: Fair handling of stalled deals — different refund ratios based on who is at fault.

**Implementation**:
- No draft within 24h → 100% refund to advertiser
- No review within 24h → 70% to advertiser, 30% to channel (work was done)
- Configurable via app_settings table

### 4. Channel Team Model
**Why**: Large channels have multiple managers; all should receive notifications.

**Implementation**:
- `channel_admins` table with owner/manager roles
- Permissions stored as JSONB (can_accept_deals, can_post, etc.)
- Team members verified against Telegram on sensitive operations

### 5. Post Integrity Verification
**Why**: Channel owners might delete posts early to reduce ad visibility.

**Implementation**:
- `verify-post-integrity` checks post existence via Bot API
- If deleted before duration expires → deal cancelled, funds refunded
- Multiple checks throughout post duration

---

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| pg_cron requires superuser | Application-level toggle via `cron_job_settings` table |
| MTProto not supported in Deno | VPS proxy with HTTP API |
| Edge function timeout: 150s | Batch processing for large operations |
| TonConnect callback issues in TMA | localStorage polling for wallet connection |
| Supabase storage 50MB limit | External media hosting for large files |
| Bot API 20 messages/second | Queue system for bulk notifications |

---

## AI Usage Disclosure

**~85% of code written with AI assistance**

| Component | AI Involvement |
|-----------|----------------|
| Architecture design | Human (with AI brainstorming) |
| Business logic | AI-assisted with human review |
| Edge functions | AI-generated with manual testing |
| UI/UX components | AI-generated |
| Database schema | Human design, AI-assisted SQL |
| Security measures | Human review of AI suggestions |

---

## Future Improvements

- [ ] Multi-post scheduling with intervals
- [ ] Channel analytics dashboard for owners
- [ ] Dispute resolution system with arbitration
- [ ] Advertiser reputation system
- [ ] Batch escrow operations for efficiency
- [ ] Multi-language support
- [ ] Native iOS/Android apps via Capacitor
- [ ] Advertiser targeting (by category, location)
- [ ] A/B testing for ad creatives
- [ ] Revenue sharing with referrals

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Team

Developed by **AGDX Team**

---

## Acknowledgments

- [Supabase](https://supabase.com) — Backend infrastructure
- [TON Foundation](https://ton.org) — Blockchain platform
- [Telegram](https://telegram.org) — Mini Apps platform
- [TanStack](https://tanstack.com) — React Query
