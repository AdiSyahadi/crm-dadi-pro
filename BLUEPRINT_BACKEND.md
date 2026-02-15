# 🏗️ CRM-DADI — Backend Blueprint

> **Version:** 1.0.0  
> **Date:** 2026-02-09  
> **Type:** SaaS-Ready CRM Backend  
> **Integration:** WhatsApp SaaS API (Teman)

---

## 1. Tech Stack

| Layer | Technology | Alasan |
|-------|-----------|--------|
| **Runtime** | Node.js 20 LTS | Stable, performant, ecosystem besar |
| **Framework** | Express.js + TypeScript | Mature, middleware ecosystem, type-safe |
| **Database** | PostgreSQL 16 | Relational, JSONB support, scalable |
| **ORM** | Prisma | Type-safe queries, migration system, great DX |
| **Cache** | Redis | Session, rate limiting, real-time pub/sub |
| **Auth** | JWT + Refresh Token | Stateless, scalable, industry standard |
| **Validation** | Zod | Runtime type validation, TypeScript-first |
| **Queue** | BullMQ (Redis-based) | Background jobs, scheduled tasks, retries |
| **Realtime** | Socket.IO | WebSocket untuk live chat updates |
| **File Storage** | Local + S3-compatible | Media caching dari WA API |
| **Logging** | Pino | Fast structured logging |
| **Testing** | Vitest + Supertest | Fast unit & integration tests |
| **API Docs** | Swagger/OpenAPI | Auto-generated API documentation |

---

## 2. Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│         (Browser / Mobile App / External API)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX / Reverse Proxy                      │
│              (SSL Termination, Rate Limiting)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXPRESS.JS SERVER                           │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Middleware   │  │   Routes     │  │   Socket.IO       │   │
│  │ Chain        │  │   Layer      │  │   (Realtime)      │   │
│  │             │  │              │  │                   │   │
│  │ - CORS      │  │ /api/auth    │  │ - chat:message    │   │
│  │ - Helmet    │  │ /api/chats   │  │ - chat:typing     │   │
│  │ - Morgan    │  │ /api/contacts│  │ - chat:status     │   │
│  │ - Auth      │  │ /api/broadcast│ │ - notification    │   │
│  │ - RateLimit │  │ /api/webhook │  │ - instance:status │   │
│  │ - Tenant    │  │ /api/users   │  │                   │   │
│  │ - Validate  │  │ /api/teams   │  │                   │   │
│  └─────────────┘  │ /api/settings│  └───────────────────┘   │
│                    │ /api/analytics│                          │
│                    │ /api/templates│                          │
│                    └──────────────┘                           │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  SERVICE LAYER                        │    │
│  │                                                      │    │
│  │  AuthService    ChatService     ContactService       │    │
│  │  UserService    BroadcastService WebhookService      │    │
│  │  TeamService    TemplateService  AnalyticsService    │    │
│  │  TenantService  InstanceService  NotificationService │    │
│  │  TagService     NoteService      AutomationService   │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                          │                                   │
│              ┌───────────┼───────────┐                       │
│              ▼           ▼           ▼                       │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐             │
│  │   Prisma     │ │  Redis   │ │  WA API      │             │
│  │   (PostgreSQL)│ │  Cache   │ │  Client      │             │
│  └──────────────┘ └──────────┘ └──────────────┘             │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        ▼
                          ┌──────────────────────┐
                          │  WhatsApp SaaS API   │
                          │  (API Teman Anda)    │
                          │                      │
                          │  Base URL:           │
                          │  https://wa-api.com  │
                          │  Auth: X-API-Key     │
                          └──────────────────────┘
```

---

## 3. Folder Structure

```
backend/
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── seed.ts                    # Seed data
│   └── migrations/                # Auto-generated migrations
│
├── src/
│   ├── index.ts                   # Entry point
│   ├── app.ts                     # Express app setup
│   ├── server.ts                  # HTTP + Socket.IO server
│   │
│   ├── config/
│   │   ├── index.ts               # All config exports
│   │   ├── database.ts            # DB connection config
│   │   ├── redis.ts               # Redis connection config
│   │   ├── cors.ts                # CORS config
│   │   ├── socket.ts              # Socket.IO config
│   │   └── wa-api.ts              # WhatsApp API config
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT verification
│   │   ├── tenant.middleware.ts    # Multi-tenant isolation
│   │   ├── rbac.middleware.ts      # Role-based access control
│   │   ├── rate-limit.middleware.ts # Rate limiting
│   │   ├── validate.middleware.ts  # Zod validation
│   │   ├── error.middleware.ts     # Global error handler
│   │   └── upload.middleware.ts    # File upload handling
│   │
│   ├── routes/
│   │   ├── index.ts               # Route aggregator
│   │   ├── auth.routes.ts         # /api/auth/*
│   │   ├── user.routes.ts         # /api/users/*
│   │   ├── team.routes.ts         # /api/teams/*
│   │   ├── chat.routes.ts         # /api/chats/*
│   │   ├── contact.routes.ts      # /api/contacts/*
│   │   ├── broadcast.routes.ts    # /api/broadcasts/*
│   │   ├── template.routes.ts     # /api/templates/*
│   │   ├── webhook.routes.ts      # /api/webhook/*
│   │   ├── instance.routes.ts     # /api/instances/*
│   │   ├── tag.routes.ts          # /api/tags/*
│   │   ├── analytics.routes.ts    # /api/analytics/*
│   │   ├── settings.routes.ts     # /api/settings/*
│   │   └── automation.routes.ts   # /api/automations/*
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── team.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── contact.controller.ts
│   │   ├── broadcast.controller.ts
│   │   ├── template.controller.ts
│   │   ├── webhook.controller.ts
│   │   ├── instance.controller.ts
│   │   ├── tag.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── settings.controller.ts
│   │   └── automation.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts         # Login, register, token refresh
│   │   ├── user.service.ts         # User CRUD, profile
│   │   ├── team.service.ts         # Team management
│   │   ├── chat.service.ts         # Chat/conversation logic
│   │   ├── contact.service.ts      # Contact CRUD, import/export
│   │   ├── broadcast.service.ts    # Broadcast campaigns
│   │   ├── template.service.ts     # Message templates
│   │   ├── webhook.service.ts      # Webhook processing
│   │   ├── instance.service.ts     # WA instance management
│   │   ├── tag.service.ts          # Tag management
│   │   ├── analytics.service.ts    # Dashboard analytics
│   │   ├── notification.service.ts # In-app notifications
│   │   ├── automation.service.ts   # Auto-reply rules
│   │   └── wa-api.service.ts       # WhatsApp API client wrapper
│   │
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── redis.ts               # Redis client singleton
│   │   ├── socket.ts              # Socket.IO instance
│   │   ├── queue.ts               # BullMQ queue setup
│   │   ├── logger.ts              # Pino logger
│   │   └── errors.ts             # Custom error classes
│   │
│   ├── validators/
│   │   ├── auth.validator.ts      # Auth request schemas
│   │   ├── chat.validator.ts
│   │   ├── contact.validator.ts
│   │   ├── broadcast.validator.ts
│   │   ├── template.validator.ts
│   │   └── common.validator.ts    # Shared schemas (pagination, etc)
│   │
│   ├── workers/
│   │   ├── broadcast.worker.ts    # Process broadcast queue
│   │   ├── webhook.worker.ts      # Process incoming webhooks
│   │   ├── sync.worker.ts         # Sync contacts/messages from WA API
│   │   ├── analytics.worker.ts    # Aggregate analytics data
│   │   └── cleanup.worker.ts      # Cleanup old data
│   │
│   ├── socket/
│   │   ├── index.ts               # Socket.IO setup & auth
│   │   ├── chat.handler.ts        # Chat realtime events
│   │   └── notification.handler.ts # Notification events
│   │
│   ├── types/
│   │   ├── index.ts               # Global types
│   │   ├── auth.types.ts
│   │   ├── chat.types.ts
│   │   ├── contact.types.ts
│   │   ├── wa-api.types.ts        # WA API response types
│   │   └── socket.types.ts
│   │
│   └── utils/
│       ├── phone.ts               # Phone number formatting
│       ├── jid.ts                 # JID parsing (628xxx@s.whatsapp.net)
│       ├── pagination.ts          # Pagination helpers
│       ├── crypto.ts              # Hashing, encryption
│       ├── date.ts                # Date formatting
│       └── response.ts           # Standardized API responses
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   ├── auth.test.ts
│   │   ├── chat.test.ts
│   │   └── contact.test.ts
│   └── helpers/
│       ├── setup.ts
│       └── factories.ts           # Test data factories
│
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 4. Database Schema (Prisma)

### 4.1 Multi-Tenant & Auth

```prisma
// ============================================
// TENANT & AUTH
// ============================================

model Organization {
  id                String   @id @default(uuid())
  name              String
  slug              String   @unique        // untuk subdomain: slug.crm-dadi.com
  plan              Plan     @default(FREE)
  
  // WA API Config
  wa_api_base_url   String                  // Base URL API teman
  wa_api_key        String                  // Encrypted API key
  wa_organization_id String?                // Org ID di WA API
  
  // Limits
  max_users         Int      @default(3)
  max_contacts      Int      @default(500)
  max_broadcasts_per_month Int @default(5)
  
  // Metadata
  settings          Json     @default("{}")  // org-level settings
  is_active         Boolean  @default(true)
  trial_ends_at     DateTime?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  users             User[]
  teams             Team[]
  contacts          Contact[]
  conversations     Conversation[]
  broadcasts        Broadcast[]
  templates         MessageTemplate[]
  tags              Tag[]
  automations       Automation[]
  wa_instances      WAInstance[]
  webhook_configs   WebhookConfig[]
  
  @@map("organizations")
}

enum Plan {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

model User {
  id                String   @id @default(uuid())
  organization_id   String
  organization      Organization @relation(fields: [organization_id], references: [id])
  
  email             String
  password_hash     String
  name              String
  avatar_url        String?
  phone             String?
  role              UserRole @default(AGENT)
  
  is_active         Boolean  @default(true)
  is_online         Boolean  @default(false)
  last_seen_at      DateTime?
  email_verified_at DateTime?
  
  // Preferences
  preferences       Json     @default("{}")
  notification_settings Json @default("{}")
  
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  teams             TeamMember[]
  assigned_conversations ConversationAssignment[]
  messages_sent     Message[]
  activities        ActivityLog[]
  refresh_tokens    RefreshToken[]
  notifications     Notification[]
  
  @@unique([organization_id, email])
  @@map("users")
}

enum UserRole {
  OWNER       // Full access, billing, org settings
  ADMIN       // Manage users, settings, all chats
  SUPERVISOR  // View all chats, assign agents, reports
  AGENT       // Handle assigned chats only
}

model RefreshToken {
  id          String   @id @default(uuid())
  user_id     String
  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  token_hash  String   @unique
  device_info String?
  ip_address  String?
  expires_at  DateTime
  revoked_at  DateTime?
  
  created_at  DateTime @default(now())
  
  @@map("refresh_tokens")
}

model Team {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  
  name            String
  description     String?
  color           String   @default("#3B82F6") // untuk UI badge
  
  // Auto-assignment settings
  auto_assign     Boolean  @default(false)
  assign_strategy AssignStrategy @default(ROUND_ROBIN)
  max_open_chats  Int      @default(20) // per agent
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  // Relations
  members         TeamMember[]
  assigned_conversations ConversationAssignment[]
  
  @@unique([organization_id, name])
  @@map("teams")
}

enum AssignStrategy {
  ROUND_ROBIN     // Giliran merata
  LEAST_BUSY      // Agent dengan chat paling sedikit
  MANUAL          // Manual assign saja
}

model TeamMember {
  id        String   @id @default(uuid())
  team_id   String
  team      Team     @relation(fields: [team_id], references: [id], onDelete: Cascade)
  user_id   String
  user      User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  is_leader Boolean  @default(false)
  joined_at DateTime @default(now())
  
  @@unique([team_id, user_id])
  @@map("team_members")
}
```

### 4.2 WhatsApp Instance & Contacts

```prisma
// ============================================
// WHATSAPP INSTANCES
// ============================================

model WAInstance {
  id                String   @id @default(uuid())
  organization_id   String
  organization      Organization @relation(fields: [organization_id], references: [id])
  
  wa_instance_id    String            // ID dari WA API teman
  name              String
  phone_number      String?
  status            InstanceStatus @default(DISCONNECTED)
  
  // Cached dari WA API
  health_score      Int?
  daily_message_count Int @default(0)
  daily_limit       Int?
  warming_phase     String?
  
  is_default        Boolean  @default(false) // Instance default untuk kirim
  last_synced_at    DateTime?
  connected_at      DateTime?
  
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  conversations     Conversation[]
  messages          Message[]
  contacts          Contact[]
  broadcasts        Broadcast[]
  
  @@unique([organization_id, wa_instance_id])
  @@map("wa_instances")
}

enum InstanceStatus {
  CONNECTED
  DISCONNECTED
  CONNECTING
  QR_PENDING
}

// ============================================
// CONTACTS
// ============================================

model Contact {
  id                String   @id @default(uuid())
  organization_id   String
  organization      Organization @relation(fields: [organization_id], references: [id])
  instance_id       String?
  instance          WAInstance? @relation(fields: [instance_id], references: [id])
  
  // Identity
  wa_contact_id     String?           // ID dari WA API teman
  phone_number      String
  name              String?
  email             String?
  avatar_url        String?
  
  // CRM Fields
  company           String?
  job_title         String?
  address           String?
  city              String?
  notes             String?           @db.Text
  source            ContactSource @default(WHATSAPP)
  stage             ContactStage  @default(NEW)
  
  // Custom fields (flexible)
  custom_fields     Json     @default("{}")
  
  // Engagement
  is_subscribed     Boolean  @default(true)  // opt-in/opt-out
  last_message_at   DateTime?
  first_message_at  DateTime?
  total_messages    Int      @default(0)
  
  // Metadata
  is_blocked        Boolean  @default(false)
  blocked_reason    String?
  
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  tags              ContactTag[]
  conversations     Conversation[]
  broadcast_recipients BroadcastRecipient[]
  activities        ActivityLog[]
  
  @@unique([organization_id, phone_number])
  @@index([organization_id, stage])
  @@index([organization_id, last_message_at])
  @@index([phone_number])
  @@map("contacts")
}

enum ContactSource {
  WHATSAPP        // Dari incoming WA message
  MANUAL          // Input manual
  IMPORT          // CSV/Excel import
  API             // Via API
  WEBSITE         // Dari form website
}

enum ContactStage {
  NEW             // Baru masuk
  LEAD            // Prospek
  QUALIFIED       // Sudah qualify
  CUSTOMER        // Sudah beli
  VIP             // Customer premium
  CHURNED         // Sudah tidak aktif
}

model Tag {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  
  name            String
  color           String   @default("#6B7280")
  description     String?
  
  created_at      DateTime @default(now())
  
  // Relations
  contacts        ContactTag[]
  
  @@unique([organization_id, name])
  @@map("tags")
}

model ContactTag {
  contact_id String
  contact    Contact @relation(fields: [contact_id], references: [id], onDelete: Cascade)
  tag_id     String
  tag        Tag     @relation(fields: [tag_id], references: [id], onDelete: Cascade)
  
  assigned_at DateTime @default(now())
  
  @@id([contact_id, tag_id])
  @@map("contact_tags")
}
```

### 4.3 Conversations & Messages

```prisma
// ============================================
// CONVERSATIONS & MESSAGES
// ============================================

model Conversation {
  id                String   @id @default(uuid())
  organization_id   String
  organization      Organization @relation(fields: [organization_id], references: [id])
  instance_id       String
  instance          WAInstance @relation(fields: [instance_id], references: [id])
  contact_id        String
  contact           Contact  @relation(fields: [contact_id], references: [id])
  
  // WA identifiers
  chat_jid          String            // 628xxx@s.whatsapp.net
  
  // Status
  status            ConversationStatus @default(OPEN)
  priority          Priority           @default(MEDIUM)
  
  // Counters (cached)
  unread_count      Int      @default(0)
  total_messages    Int      @default(0)
  
  // Timestamps
  last_message_at   DateTime?
  last_message_preview String?        // Preview text untuk sidebar
  last_message_direction MessageDirection?
  
  // Assignment
  assigned_to_user_id String?
  assigned_to_team_id String?
  
  // Resolution
  resolved_at       DateTime?
  resolved_by_id    String?
  
  // SLA
  first_response_at DateTime?         // Waktu pertama agent reply
  sla_deadline_at   DateTime?
  
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  messages          Message[]
  assignments       ConversationAssignment[]
  labels            ConversationLabel[]
  
  @@unique([organization_id, chat_jid, instance_id])
  @@index([organization_id, status, last_message_at])
  @@index([organization_id, assigned_to_user_id])
  @@map("conversations")
}

enum ConversationStatus {
  OPEN            // Aktif, perlu ditangani
  PENDING         // Menunggu response customer
  RESOLVED        // Sudah selesai
  CLOSED          // Ditutup permanen
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model ConversationAssignment {
  id              String   @id @default(uuid())
  conversation_id String
  conversation    Conversation @relation(fields: [conversation_id], references: [id])
  
  user_id         String?
  user            User?    @relation(fields: [user_id], references: [id])
  team_id         String?
  team            Team?    @relation(fields: [team_id], references: [id])
  
  assigned_by_id  String?
  reason          String?           // "auto-assigned", "manual", "transfer"
  
  assigned_at     DateTime @default(now())
  unassigned_at   DateTime?
  is_active       Boolean  @default(true)
  
  @@index([conversation_id, is_active])
  @@map("conversation_assignments")
}

model ConversationLabel {
  id              String   @id @default(uuid())
  conversation_id String
  conversation    Conversation @relation(fields: [conversation_id], references: [id], onDelete: Cascade)
  
  label           String
  color           String   @default("#3B82F6")
  
  @@unique([conversation_id, label])
  @@map("conversation_labels")
}

model Message {
  id                String   @id @default(uuid())
  organization_id   String
  conversation_id   String
  conversation      Conversation @relation(fields: [conversation_id], references: [id])
  instance_id       String
  instance          WAInstance @relation(fields: [instance_id], references: [id])
  
  // WA identifiers
  wa_message_id     String?           // ID dari WA API
  
  // Content
  direction         MessageDirection
  message_type      MessageType
  content           String?  @db.Text  // Text content
  caption           String?            // Media caption
  
  // Media
  media_url         String?            // URL dari WA API
  media_local_path  String?            // Cached locally
  media_mime_type   String?
  media_size        Int?               // bytes
  filename          String?
  
  // Location
  latitude          Float?
  longitude         Float?
  location_name     String?
  location_address  String?
  
  // Status
  status            MessageStatus @default(PENDING)
  error_message     String?
  
  // Metadata
  sent_by_user_id   String?           // Agent yang kirim (null = system/auto)
  sent_by           User?    @relation(fields: [sent_by_user_id], references: [id])
  is_from_broadcast Boolean  @default(false)
  broadcast_id      String?
  
  // Internal note (bukan WA message, catatan internal agent)
  is_internal_note  Boolean  @default(false)
  
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  @@index([conversation_id, created_at])
  @@index([organization_id, created_at])
  @@index([wa_message_id])
  @@map("messages")
}

enum MessageDirection {
  INCOMING    // Dari customer
  OUTGOING    // Dari agent/system
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  LOCATION
  STICKER
  CONTACT_CARD
  SYSTEM        // System message (assigned, resolved, etc)
}

enum MessageStatus {
  PENDING       // Belum dikirim
  SENT          // Terkirim ke WA API
  DELIVERED     // Sampai ke HP customer
  READ          // Dibaca customer
  FAILED        // Gagal kirim
  RECEIVED      // Incoming message diterima
}
```

### 4.4 Broadcasts & Templates

```prisma
// ============================================
// BROADCASTS & TEMPLATES
// ============================================

model MessageTemplate {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  
  name            String
  category        String?           // "greeting", "follow-up", "promo", etc
  content         String   @db.Text // Bisa pakai {{name}}, {{company}}, dll
  media_url       String?
  media_type      MessageType?
  
  // Variables yang bisa dipakai
  variables       Json     @default("[]") // ["name", "company", "order_id"]
  
  is_active       Boolean  @default(true)
  usage_count     Int      @default(0)
  
  created_by_id   String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  // Relations
  broadcasts      Broadcast[]
  
  @@unique([organization_id, name])
  @@map("message_templates")
}

model Broadcast {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  instance_id     String
  instance        WAInstance @relation(fields: [instance_id], references: [id])
  template_id     String?
  template        MessageTemplate? @relation(fields: [template_id], references: [id])
  
  name            String
  message_content String   @db.Text
  media_url       String?
  media_type      MessageType?
  
  // Schedule
  status          BroadcastStatus @default(DRAFT)
  scheduled_at    DateTime?
  started_at      DateTime?
  completed_at    DateTime?
  
  // Stats
  total_recipients Int     @default(0)
  sent_count      Int      @default(0)
  delivered_count Int      @default(0)
  read_count      Int      @default(0)
  failed_count    Int      @default(0)
  
  // Settings
  delay_min_seconds Int    @default(5)
  delay_max_seconds Int    @default(15)
  
  created_by_id   String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  // Relations
  recipients      BroadcastRecipient[]
  
  @@map("broadcasts")
}

enum BroadcastStatus {
  DRAFT
  SCHEDULED
  SENDING
  PAUSED
  COMPLETED
  CANCELLED
  FAILED
}

model BroadcastRecipient {
  id            String   @id @default(uuid())
  broadcast_id  String
  broadcast     Broadcast @relation(fields: [broadcast_id], references: [id], onDelete: Cascade)
  contact_id    String
  contact       Contact  @relation(fields: [contact_id], references: [id])
  
  phone_number  String
  personalized_message String? @db.Text // Setelah variable replacement
  
  status        MessageStatus @default(PENDING)
  wa_message_id String?
  error_message String?
  sent_at       DateTime?
  delivered_at  DateTime?
  read_at       DateTime?
  
  @@index([broadcast_id, status])
  @@map("broadcast_recipients")
}
```

### 4.5 Deals / Closing (Sales Pipeline)

```prisma
// ============================================
// DEALS / CLOSING (Sales Pipeline)
// ============================================

model Deal {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  contact_id      String
  contact         Contact  @relation(fields: [contact_id], references: [id])
  conversation_id String?
  conversation    Conversation? @relation(fields: [conversation_id], references: [id])

  // Deal Info
  title           String            // "Paket Premium - John Doe"
  description     String?  @db.Text
  deal_number     String   @unique  // Auto-generated: DEAL-2026-0001

  // Pipeline
  stage           DealStage @default(QUALIFICATION)
  pipeline        String    @default("default") // Bisa punya multiple pipeline

  // Value
  value           Decimal   @default(0) @db.Decimal(15, 2)  // Nilai deal (Rp)
  currency        String    @default("IDR")

  // Probability
  win_probability Int       @default(0) // 0-100%

  // Assignment
  assigned_to_id  String?
  assigned_to     User?    @relation(fields: [assigned_to_id], references: [id])

  // Dates
  expected_close_date DateTime?      // Target tanggal closing
  actual_close_date   DateTime?      // Tanggal deal benar-benar close
  
  // Closing Info
  closed_status   DealClosedStatus?  // WON atau LOST
  lost_reason     String?            // Alasan kalah (jika LOST)
  won_notes       String?  @db.Text  // Catatan closing (jika WON)

  // Product/Service
  products        Json     @default("[]")  // [{name, qty, price, subtotal}]

  // Source
  source          String?           // "whatsapp", "referral", "website"

  // Metadata
  custom_fields   Json     @default("{}")
  is_archived     Boolean  @default(false)

  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  // Relations
  activities      DealActivity[]

  @@index([organization_id, stage])
  @@index([organization_id, assigned_to_id])
  @@index([organization_id, closed_status])
  @@index([organization_id, expected_close_date])
  @@map("deals")
}

enum DealStage {
  QUALIFICATION   // Identifikasi kebutuhan
  PROPOSAL        // Kirim penawaran
  NEGOTIATION     // Negosiasi harga/terms
  CLOSING         // Proses closing
  WON             // Deal berhasil ✅
  LOST            // Deal gagal ❌
}

enum DealClosedStatus {
  WON
  LOST
}

model DealActivity {
  id          String   @id @default(uuid())
  deal_id     String
  deal        Deal     @relation(fields: [deal_id], references: [id], onDelete: Cascade)

  user_id     String?
  
  type        DealActivityType
  title       String            // "Stage changed to PROPOSAL"
  description String?           // Detail tambahan
  metadata    Json     @default("{}")  // {old_stage, new_stage, old_value, new_value}

  created_at  DateTime @default(now())

  @@index([deal_id, created_at])
  @@map("deal_activities")
}

enum DealActivityType {
  STAGE_CHANGED     // Pindah stage
  VALUE_CHANGED     // Nilai deal berubah
  ASSIGNED          // Di-assign ke agent
  NOTE_ADDED        // Catatan ditambah
  PRODUCT_ADDED     // Produk ditambah
  WON               // Deal won
  LOST              // Deal lost
  REOPENED          // Deal dibuka lagi
  CREATED           // Deal dibuat
}
```

---

### 4.6 Automations, Notifications & Activity Log

```prisma
// ============================================
// AUTOMATIONS (Auto-Reply Rules)
// ============================================

model Automation {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  
  name            String
  description     String?
  
  // Trigger
  trigger_type    AutomationTrigger
  trigger_config  Json              // Conditions, keywords, etc
  
  // Action
  action_type     AutomationAction
  action_config   Json              // Reply message, assign team, add tag, etc
  
  // Settings
  is_active       Boolean  @default(true)
  priority        Int      @default(0)  // Higher = checked first
  execution_count Int      @default(0)
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  @@map("automations")
}

enum AutomationTrigger {
  MESSAGE_RECEIVED      // Pesan masuk
  KEYWORD_MATCH         // Keyword tertentu
  FIRST_MESSAGE         // Pesan pertama dari contact baru
  CONTACT_CREATED       // Contact baru dibuat
  NO_REPLY_TIMEOUT      // Tidak ada reply dalam X menit
  BUSINESS_HOURS        // Di luar jam kerja
}

enum AutomationAction {
  SEND_REPLY            // Kirim auto-reply
  ASSIGN_TEAM           // Assign ke team
  ASSIGN_USER           // Assign ke user
  ADD_TAG               // Tambah tag ke contact
  SET_STAGE             // Update contact stage
  SEND_NOTIFICATION     // Kirim notifikasi ke agent
  WEBHOOK               // Trigger external webhook
}

// ============================================
// NOTIFICATIONS
// ============================================

model Notification {
  id          String   @id @default(uuid())
  user_id     String
  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  type        NotificationType
  title       String
  body        String
  data        Json     @default("{}")  // Extra data (conversation_id, contact_id, etc)
  
  is_read     Boolean  @default(false)
  read_at     DateTime?
  
  created_at  DateTime @default(now())
  
  @@index([user_id, is_read, created_at])
  @@map("notifications")
}

enum NotificationType {
  NEW_MESSAGE           // Pesan baru masuk
  ASSIGNED              // Chat di-assign ke kamu
  MENTION               // Di-mention di internal note
  BROADCAST_COMPLETED   // Broadcast selesai
  INSTANCE_DISCONNECTED // WA instance disconnect
  SYSTEM                // System notification
}

// ============================================
// ACTIVITY LOG (Audit Trail)
// ============================================

model ActivityLog {
  id              String   @id @default(uuid())
  organization_id String
  user_id         String?
  user            User?    @relation(fields: [user_id], references: [id])
  contact_id      String?
  contact         Contact? @relation(fields: [contact_id], references: [id])
  
  action          String            // "contact.created", "chat.assigned", etc
  entity_type     String            // "contact", "conversation", "broadcast"
  entity_id       String?
  
  details         Json     @default("{}")
  ip_address      String?
  
  created_at      DateTime @default(now())
  
  @@index([organization_id, created_at])
  @@index([entity_type, entity_id])
  @@map("activity_logs")
}

// ============================================
// WEBHOOK CONFIG (untuk terima dari WA API)
// ============================================

model WebhookConfig {
  id              String   @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])
  
  wa_instance_id  String           // Instance ID di WA API
  webhook_url     String           // URL CRM kita yang didaftarkan ke WA API
  webhook_secret  String?
  events          Json             // ["message.received", "message.sent", ...]
  
  is_active       Boolean  @default(true)
  last_received_at DateTime?
  failure_count   Int      @default(0)
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  
  @@unique([organization_id, wa_instance_id])
  @@map("webhook_configs")
}
```

---

## 5. API Routes Detail

### 5.1 Authentication

```
POST   /api/auth/register          # Register org + owner user
POST   /api/auth/login             # Login → JWT + refresh token
POST   /api/auth/refresh           # Refresh access token
POST   /api/auth/logout            # Revoke refresh token
POST   /api/auth/forgot-password   # Send reset email
POST   /api/auth/reset-password    # Reset password with token
GET    /api/auth/me                # Get current user profile
PATCH  /api/auth/me                # Update profile
PATCH  /api/auth/me/password       # Change password
```

### 5.2 Users & Teams (Admin)

```
GET    /api/users                  # List org users
POST   /api/users                  # Invite user
GET    /api/users/:id              # Get user detail
PATCH  /api/users/:id              # Update user (role, status)
DELETE /api/users/:id              # Deactivate user

GET    /api/teams                  # List teams
POST   /api/teams                  # Create team
GET    /api/teams/:id              # Get team detail
PATCH  /api/teams/:id              # Update team
DELETE /api/teams/:id              # Delete team
POST   /api/teams/:id/members      # Add member
DELETE /api/teams/:id/members/:userId  # Remove member
```

### 5.3 Chats (Core CRM)

```
GET    /api/chats                  # List conversations (sidebar)
       ?status=OPEN,PENDING
       ?assigned_to=me|unassigned|user_id
       ?search=keyword
       ?tag=vip
       ?page=1&limit=20

GET    /api/chats/:id              # Get conversation detail + contact info
GET    /api/chats/:id/messages     # Get messages (paginated, newest first)
       ?page=1&limit=50
POST   /api/chats/:id/messages     # Send message (text/media/location)
POST   /api/chats/:id/notes        # Add internal note
PATCH  /api/chats/:id/status       # Update status (resolve, reopen, close)
PATCH  /api/chats/:id/assign       # Assign to user/team
PATCH  /api/chats/:id/priority     # Set priority
POST   /api/chats/:id/labels       # Add label
DELETE /api/chats/:id/labels/:label # Remove label
GET    /api/chats/:id/activities   # Activity log for this chat
```

### 5.4 Contacts

```
GET    /api/contacts               # List contacts
       ?search=keyword
       ?stage=NEW,LEAD,CUSTOMER
       ?tag=vip
       ?source=WHATSAPP
       ?sort=last_message_at
       ?page=1&limit=20

POST   /api/contacts               # Create contact
GET    /api/contacts/:id           # Get contact detail
PATCH  /api/contacts/:id           # Update contact
DELETE /api/contacts/:id           # Delete contact
GET    /api/contacts/:id/chats     # Get contact's conversations
GET    /api/contacts/:id/activities # Contact activity log
POST   /api/contacts/import        # Import from CSV/Excel
GET    /api/contacts/export        # Export to CSV
POST   /api/contacts/:id/tags      # Add tags
DELETE /api/contacts/:id/tags/:tagId # Remove tag
```

### 5.5 Broadcasts

```
GET    /api/broadcasts             # List broadcasts
POST   /api/broadcasts             # Create broadcast (draft)
GET    /api/broadcasts/:id         # Get broadcast detail + stats
PATCH  /api/broadcasts/:id         # Update draft
DELETE /api/broadcasts/:id         # Delete broadcast
POST   /api/broadcasts/:id/send    # Start sending
POST   /api/broadcasts/:id/pause   # Pause sending
POST   /api/broadcasts/:id/resume  # Resume sending
POST   /api/broadcasts/:id/cancel  # Cancel broadcast
GET    /api/broadcasts/:id/recipients # List recipients + status
```

### 5.6 Templates

```
GET    /api/templates              # List templates
POST   /api/templates              # Create template
GET    /api/templates/:id          # Get template
PATCH  /api/templates/:id          # Update template
DELETE /api/templates/:id          # Delete template
POST   /api/templates/:id/preview  # Preview with sample data
```

### 5.7 WA Instances

```
GET    /api/instances              # List WA instances (from WA API)
GET    /api/instances/:id/status   # Get instance status
POST   /api/instances/sync         # Sync instances from WA API
```

### 5.8 Tags

```
GET    /api/tags                   # List all tags
POST   /api/tags                   # Create tag
PATCH  /api/tags/:id               # Update tag
DELETE /api/tags/:id               # Delete tag
```

### 5.9 Deals / Closing

```
GET    /api/deals                  # List deals (with filters)
       ?stage=QUALIFICATION,PROPOSAL,NEGOTIATION,CLOSING
       ?assigned_to=me|user_id
       ?closed_status=WON|LOST
       ?min_value=1000000&max_value=50000000
       ?expected_close_from=2026-02-01&expected_close_to=2026-02-28
       ?sort=value|created_at|expected_close_date
       ?page=1&limit=20

POST   /api/deals                  # Create new deal
GET    /api/deals/:id              # Get deal detail
PATCH  /api/deals/:id              # Update deal
DELETE /api/deals/:id              # Delete deal (soft: archive)

PATCH  /api/deals/:id/stage        # Move deal to next/prev stage
POST   /api/deals/:id/won          # Mark deal as WON (closing berhasil)
POST   /api/deals/:id/lost         # Mark deal as LOST (closing gagal)
POST   /api/deals/:id/reopen       # Reopen closed deal

GET    /api/deals/:id/activities   # Deal activity timeline
POST   /api/deals/:id/notes        # Add note to deal

GET    /api/deals/pipeline         # Pipeline view (deals grouped by stage)
       ?pipeline=default
       ?assigned_to=me

GET    /api/deals/report           # Closing report & analytics
       ?period=today|7d|30d|90d|custom
       ?from=2026-01-01&to=2026-02-09
       ?assigned_to=user_id
       ?group_by=agent|stage|source|month
```

**Closing Report Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_deals": 45,
      "total_value": 125000000,
      "won_deals": 28,
      "won_value": 89000000,
      "lost_deals": 12,
      "lost_value": 31000000,
      "open_deals": 5,
      "open_value": 5000000,
      "win_rate": 70.0,
      "avg_deal_value": 3178571,
      "avg_closing_days": 12.5
    },
    "by_agent": [
      {
        "user_id": "xxx",
        "user_name": "Adi",
        "total_deals": 15,
        "won": 12,
        "lost": 3,
        "win_rate": 80.0,
        "total_value": 45000000,
        "avg_closing_days": 10.2
      }
    ],
    "by_stage": [
      { "stage": "QUALIFICATION", "count": 2, "value": 3000000 },
      { "stage": "PROPOSAL", "count": 1, "value": 2000000 },
      { "stage": "WON", "count": 28, "value": 89000000 },
      { "stage": "LOST", "count": 12, "value": 31000000 }
    ],
    "by_source": [
      { "source": "whatsapp", "count": 30, "won": 22, "value": 70000000 },
      { "source": "referral", "count": 10, "won": 5, "value": 15000000 }
    ],
    "by_month": [
      { "month": "2026-01", "won": 15, "lost": 8, "value": 48000000 },
      { "month": "2026-02", "won": 13, "lost": 4, "value": 41000000 }
    ],
    "lost_reasons": [
      { "reason": "Harga terlalu mahal", "count": 5 },
      { "reason": "Pilih kompetitor", "count": 4 },
      { "reason": "Budget belum ada", "count": 3 }
    ],
    "avg_time_per_stage": {
      "QUALIFICATION": 2.1,
      "PROPOSAL": 3.5,
      "NEGOTIATION": 4.2,
      "CLOSING": 2.7
    }
  }
}
```

### 5.10 Automations

```
GET    /api/automations            # List automations
POST   /api/automations            # Create automation rule
GET    /api/automations/:id        # Get automation detail
PATCH  /api/automations/:id        # Update automation
DELETE /api/automations/:id        # Delete automation
PATCH  /api/automations/:id/toggle # Enable/disable
```

### 5.11 Webhook (Receive from WA API)

```
POST   /api/webhook/whatsapp       # Receive webhook from WA API
GET    /api/webhook/config         # List webhook configs
PUT    /api/webhook/config         # Setup/update webhook on WA API
DELETE /api/webhook/config/:instanceId # Remove webhook
```

### 5.11 Analytics

```
GET    /api/analytics/dashboard    # Dashboard overview stats
       ?period=today|7d|30d|custom
       ?from=2026-02-01&to=2026-02-09

GET    /api/analytics/messages     # Message volume chart data
GET    /api/analytics/response-time # Avg response time
GET    /api/analytics/agents       # Agent performance
GET    /api/analytics/contacts     # Contact growth
GET    /api/analytics/broadcasts   # Broadcast performance
```

### 5.12 Settings

```
GET    /api/settings               # Get org settings
PATCH  /api/settings               # Update org settings
GET    /api/settings/business-hours # Get business hours
PATCH  /api/settings/business-hours # Update business hours
GET    /api/settings/quick-replies  # Get quick reply shortcuts
POST   /api/settings/quick-replies  # Add quick reply
PATCH  /api/settings/quick-replies/:id
DELETE /api/settings/quick-replies/:id
```

### 5.13 Notifications

```
GET    /api/notifications          # List notifications
PATCH  /api/notifications/:id/read # Mark as read
POST   /api/notifications/read-all # Mark all as read
```

---

## 6. WhatsApp API Client Wrapper

```typescript
// src/services/wa-api.service.ts

interface WAApiConfig {
  baseUrl: string;
  apiKey: string;
}

class WAApiService {
  constructor(private config: WAApiConfig) {}

  // === INSTANCES ===
  async listInstances(): Promise<WAInstance[]>
  async getInstanceStatus(instanceId: string): Promise<WAInstanceStatus>

  // === MESSAGES ===
  async sendText(instanceId: string, to: string, message: string): Promise<WASendResult>
  async sendMedia(instanceId: string, to: string, mediaUrl: string, mediaType: string, caption?: string): Promise<WASendResult>
  async sendLocation(instanceId: string, to: string, lat: number, lng: number, name?: string, address?: string): Promise<WASendResult>
  async getMessages(params: WAMessageQuery): Promise<WAPaginatedResult<WAMessage>>

  // === CONTACTS ===
  async listContacts(params: WAContactQuery): Promise<WAPaginatedResult<WAContact>>
  async createContact(data: WACreateContact): Promise<WAContact>
  async getContact(contactId: string): Promise<WAContact>
  async updateContact(contactId: string, data: WAUpdateContact): Promise<WAContact>
  async deleteContact(contactId: string): Promise<void>

  // === CONVERSATIONS ===
  async listConversations(params: WAConversationQuery): Promise<WAPaginatedResult<WAConversation>>

  // === WEBHOOKS ===
  async getWebhookConfig(): Promise<WAWebhookConfig[]>
  async setWebhookConfig(data: WASetWebhook): Promise<WAWebhookConfig>
  async deleteWebhookConfig(instanceId: string): Promise<void>

  // === HEALTH ===
  async healthCheck(): Promise<WAHealthResponse>
}
```

---

## 7. Webhook Processing Flow

```
WA API (Teman) ──POST──▶ /api/webhook/whatsapp
                              │
                              ▼
                    ┌─────────────────┐
                    │ Verify Signature │
                    │ (X-Webhook-Sig)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Parse Event Type │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     message.received  message.sent   connection.*
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ Find/Create│  │ Update msg │  │ Update     │
     │ Contact    │  │ status     │  │ instance   │
     │ Find/Create│  │ (DELIVERED,│  │ status     │
     │ Conversation│ │  READ)     │  │            │
     │ Save msg   │  └────────────┘  └────────────┘
     └─────┬──────┘
           │
           ▼
     ┌────────────────┐
     │ Run Automations │──▶ Auto-reply? Assign? Tag?
     └─────┬──────────┘
           │
           ▼
     ┌────────────────┐
     │ Update counters │──▶ unread_count, total_messages
     └─────┬──────────┘
           │
           ▼
     ┌────────────────┐
     │ Socket.IO emit  │──▶ Real-time ke browser agent
     │ "chat:message"  │
     └─────┬──────────┘
           │
           ▼
     ┌────────────────┐
     │ Send notif to   │──▶ Assigned agent / team
     │ assigned agent   │
     └────────────────┘
```

---

## 8. Socket.IO Events

### Server → Client (Emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:message` | `{ conversation_id, message }` | Pesan baru (incoming/outgoing) |
| `chat:updated` | `{ conversation_id, changes }` | Conversation updated (status, assign) |
| `chat:typing` | `{ conversation_id, user_id }` | Agent lain sedang typing |
| `message:status` | `{ message_id, status }` | Status update (delivered, read) |
| `instance:status` | `{ instance_id, status }` | WA instance status change |
| `notification` | `{ notification }` | New notification |
| `contact:updated` | `{ contact_id, changes }` | Contact data changed |

### Client → Server (Listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:join` | `{ conversation_id }` | Join conversation room |
| `chat:leave` | `{ conversation_id }` | Leave conversation room |
| `chat:typing` | `{ conversation_id }` | Broadcast typing indicator |
| `chat:read` | `{ conversation_id }` | Mark conversation as read |
| `user:online` | `{}` | User came online |
| `user:offline` | `{}` | User went offline |

---

## 9. Background Jobs (BullMQ)

| Queue | Job | Schedule | Description |
|-------|-----|----------|-------------|
| `broadcast` | `send-broadcast` | On demand | Process broadcast recipients |
| `webhook` | `process-webhook` | On receive | Process incoming webhook async |
| `sync` | `sync-instances` | Every 5 min | Sync instance status from WA API |
| `sync` | `sync-contacts` | Every 1 hour | Sync contacts from WA API |
| `analytics` | `aggregate-daily` | Daily 00:00 | Aggregate daily analytics |
| `cleanup` | `cleanup-old-data` | Daily 02:00 | Clean old logs, expired tokens |
| `notification` | `send-notification` | On demand | Send push/email notifications |

---

## 10. Environment Variables

```bash
# App
NODE_ENV=production
PORT=3000
APP_URL=https://crm.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_dadi

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# WhatsApp API (Teman)
WA_API_BASE_URL=https://wa-api.yourdomain.com/api/v1
WA_API_KEY=wa_your_api_key_here

# Webhook
WEBHOOK_SECRET=random-webhook-secret-string
WEBHOOK_BASE_URL=https://crm.yourdomain.com/api/webhook

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# Email (untuk forgot password, invites)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password

# Logging
LOG_LEVEL=info
```

---

## 11. Security Measures

| Layer | Implementation |
|-------|---------------|
| **Authentication** | JWT with short-lived access (15min) + refresh token (7d) |
| **Authorization** | RBAC (Owner > Admin > Supervisor > Agent) |
| **Multi-Tenant** | Every query filtered by `organization_id` via middleware |
| **Rate Limiting** | Per-IP + per-user limits via Redis |
| **Input Validation** | Zod schemas on every endpoint |
| **SQL Injection** | Prisma parameterized queries |
| **XSS** | Helmet headers + input sanitization |
| **CORS** | Whitelist frontend domain only |
| **Encryption** | WA API key encrypted at rest (AES-256) |
| **Webhook Verify** | HMAC-SHA256 signature verification |
| **Password** | bcrypt with salt rounds 12 |
| **Audit Trail** | All mutations logged to `activity_logs` |

---

## 12. Multi-Tenant Strategy

```
Setiap request melewati tenant middleware:

1. JWT decoded → user.organization_id
2. Middleware inject org_id ke req.organizationId
3. Semua service/query WAJIB filter by organization_id
4. Tidak ada cross-tenant data leak

Contoh:
  prisma.contact.findMany({
    where: {
      organization_id: req.organizationId,  // WAJIB
      ...filters
    }
  })
```

---

## 13. Deployment Architecture

```
┌─────────────────────────────────────────┐
│              Docker Compose              │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ CRM API  │  │PostgreSQL│  │ Redis  │ │
│  │ (Node.js)│  │   :5432  │  │ :6379  │ │
│  │  :3000   │  │          │  │        │ │
│  └──────────┘  └──────────┘  └────────┘ │
│                                          │
│  ┌──────────┐  ┌──────────┐              │
│  │ Worker   │  │ Nginx    │              │
│  │ (BullMQ) │  │ :80/:443 │              │
│  └──────────┘  └──────────┘              │
└─────────────────────────────────────────┘
```

---

*End of Backend Blueprint*
