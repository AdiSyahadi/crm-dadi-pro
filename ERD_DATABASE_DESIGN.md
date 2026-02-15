# 🗄️ CRM-DADI — ERD & Database Design

> **Version:** 1.0.0  
> **Date:** 2026-02-09  
> **Database:** PostgreSQL 16  
> **ORM:** Prisma

---

## 1. Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ORGANIZATION                                         │
│                                   (Multi-Tenant Root)                                    │
└────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
         │          │          │          │          │          │          │
         │ 1:N      │ 1:N     │ 1:N     │ 1:N     │ 1:N     │ 1:N     │ 1:N
         ▼          ▼          ▼          ▼          ▼          ▼          ▼
    ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
    │  USER   │ │  TEAM  │ │WA_INST.│ │ CONTACT │ │  TAG   │ │AUTOMAT.│ │MSG_TEMPLATE  │
    └────┬────┘ └───┬────┘ └───┬────┘ └────┬────┘ └───┬────┘ └────────┘ └──────┬───────┘
         │          │          │           │          │                         │
         │          │          │           │          │                         │
         ▼          ▼          │           ▼          ▼                         ▼
    ┌─────────┐ ┌────────┐    │     ┌───────────┐                        ┌──────────┐
    │REFRESH  │ │TEAM    │    │     │CONTACT_TAG│                        │BROADCAST │
    │TOKEN    │ │MEMBER  │    │     └───────────┘                        └─────┬────┘
    └─────────┘ └────────┘    │                                                │
                              │                                                ▼
                              ▼                                          ┌───────────┐
                        ┌──────────────┐                                 │BROADCAST  │
                        │ CONVERSATION │                                 │RECIPIENT  │
                        └──────┬───────┘                                 └───────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌─────────┐ ┌────────┐ ┌────────────┐
              │ MESSAGE │ │CONV.   │ │CONV.       │
              │         │ │ASSIGN. │ │LABEL       │
              └─────────┘ └────────┘ └────────────┘


    Standalone (linked to User):
    ┌──────────────┐  ┌──────────────┐
    │ NOTIFICATION │  │ ACTIVITY_LOG │
    └──────────────┘  └──────────────┘
```

---

## 2. Detailed ERD with Fields & Relations

### 2.1 Core: Organization → Users → Teams

```
┌──────────────────────────────────┐
│         ORGANIZATION             │
├──────────────────────────────────┤
│ PK  id              UUID         │
│     name            VARCHAR      │
│ UQ  slug            VARCHAR      │──────────── untuk subdomain (slug.crm.com)
│     plan            ENUM         │──────────── FREE|STARTER|PROFESSIONAL|ENTERPRISE
│                                  │
│     wa_api_base_url  VARCHAR     │──────────── URL API WA teman
│     wa_api_key       VARCHAR     │──────────── Encrypted
│     wa_organization_id VARCHAR   │
│                                  │
│     max_users        INT (3)     │
│     max_contacts     INT (500)   │
│     max_broadcasts_per_month INT │
│     settings         JSONB       │
│                                  │
│     is_active        BOOLEAN     │
│     trial_ends_at    TIMESTAMP   │
│     created_at       TIMESTAMP   │
│     updated_at       TIMESTAMP   │
└──────────┬───────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────┐        ┌──────────────────────────────┐
│            USER                  │        │       REFRESH_TOKEN          │
├──────────────────────────────────┤        ├──────────────────────────────┤
│ PK  id              UUID         │   1:N  │ PK  id            UUID       │
│ FK  organization_id UUID         │───────▶│ FK  user_id       UUID       │
│                                  │        │ UQ  token_hash    VARCHAR    │
│     email           VARCHAR      │        │     device_info   VARCHAR    │
│     password_hash   VARCHAR      │        │     ip_address    VARCHAR    │
│     name            VARCHAR      │        │     expires_at    TIMESTAMP  │
│     avatar_url      VARCHAR      │        │     revoked_at    TIMESTAMP  │
│     phone           VARCHAR      │        │     created_at    TIMESTAMP  │
│     role            ENUM         │        └──────────────────────────────┘
│     ── OWNER|ADMIN|SUPERVISOR    │
│        |AGENT                    │
│                                  │
│     is_active        BOOLEAN     │
│     is_online        BOOLEAN     │
│     last_seen_at     TIMESTAMP   │
│     email_verified_at TIMESTAMP  │
│     preferences      JSONB       │
│     notification_settings JSONB  │
│     created_at       TIMESTAMP   │
│     updated_at       TIMESTAMP   │
│                                  │
│ UQ  (organization_id, email)     │
└──────────────────────────────────┘

┌──────────────────────────────────┐        ┌──────────────────────────────┐
│            TEAM                  │        │       TEAM_MEMBER            │
├──────────────────────────────────┤        ├──────────────────────────────┤
│ PK  id              UUID         │   1:N  │ PK  id            UUID       │
│ FK  organization_id UUID         │───────▶│ FK  team_id       UUID       │
│                                  │        │ FK  user_id       UUID       │
│     name            VARCHAR      │        │     is_leader     BOOLEAN    │
│     description     VARCHAR      │        │     joined_at     TIMESTAMP  │
│     color           VARCHAR      │        │                              │
│     auto_assign     BOOLEAN      │        │ UQ  (team_id, user_id)       │
│     assign_strategy ENUM         │        └──────────────────────────────┘
│     ── ROUND_ROBIN|LEAST_BUSY    │
│        |MANUAL                   │
│     max_open_chats  INT (20)     │
│     created_at      TIMESTAMP    │
│     updated_at      TIMESTAMP    │
│                                  │
│ UQ  (organization_id, name)      │
└──────────────────────────────────┘
```

### 2.2 WhatsApp Instance

```
┌──────────────────────────────────┐
│         WA_INSTANCE              │
├──────────────────────────────────┤
│ PK  id              UUID         │
│ FK  organization_id UUID         │──── dari Organization
│                                  │
│     wa_instance_id  VARCHAR      │──── ID dari WA API teman
│     name            VARCHAR      │
│     phone_number    VARCHAR      │
│     status          ENUM         │──── CONNECTED|DISCONNECTED|CONNECTING|QR_PENDING
│                                  │
│     health_score    INT          │──── Cached dari WA API
│     daily_message_count INT      │
│     daily_limit     INT          │
│     warming_phase   VARCHAR      │
│                                  │
│     is_default      BOOLEAN      │──── Instance default untuk kirim
│     last_synced_at  TIMESTAMP    │
│     connected_at    TIMESTAMP    │
│     created_at      TIMESTAMP    │
│     updated_at      TIMESTAMP    │
│                                  │
│ UQ  (organization_id,            │
│      wa_instance_id)             │
└──────────────────────────────────┘
       │
       │ 1:N → Conversation, Message, Contact, Broadcast
       ▼
```

### 2.3 Contacts & Tags

```
┌──────────────────────────────────┐
│           CONTACT                │
├──────────────────────────────────┤
│ PK  id              UUID         │
│ FK  organization_id UUID         │
│ FK  instance_id     UUID (null)  │──── dari WA_INSTANCE
│                                  │
│     wa_contact_id   VARCHAR      │──── ID dari WA API teman
│     phone_number    VARCHAR      │
│     name            VARCHAR      │
│     email           VARCHAR      │
│     avatar_url      VARCHAR      │
│                                  │
│     company         VARCHAR      │
│     job_title       VARCHAR      │
│     address         VARCHAR      │
│     city            VARCHAR      │
│     notes           TEXT         │
│     source          ENUM         │──── WHATSAPP|MANUAL|IMPORT|API|WEBSITE
│     stage           ENUM         │──── NEW|LEAD|QUALIFIED|CUSTOMER|VIP|CHURNED
│                                  │
│     custom_fields   JSONB        │──── Flexible fields: {"company":"PT ABC","role":"CEO"}
│                                  │
│     is_subscribed   BOOLEAN      │──── opt-in/opt-out
│     last_message_at TIMESTAMP    │
│     first_message_at TIMESTAMP   │
│     total_messages  INT          │
│                                  │
│     is_blocked      BOOLEAN      │
│     blocked_reason  VARCHAR      │
│     created_at      TIMESTAMP    │
│     updated_at      TIMESTAMP    │
│                                  │
│ UQ  (organization_id,            │
│      phone_number)               │
│ IDX (organization_id, stage)     │
│ IDX (organization_id,            │
│      last_message_at)            │
│ IDX (phone_number)               │
└────────────┬─────────────────────┘
             │
             │ N:M (via CONTACT_TAG)
             ▼
┌──────────────────────┐        ┌──────────────────────────────┐
│     CONTACT_TAG      │        │           TAG                │
│    (Junction Table)  │        ├──────────────────────────────┤
├──────────────────────┤        │ PK  id            UUID       │
│ PK  (contact_id,     │        │ FK  organization_id UUID     │
│      tag_id)         │        │                              │
│ FK  contact_id UUID  │◀──────▶│     name          VARCHAR    │
│ FK  tag_id     UUID  │        │     color         VARCHAR    │
│     assigned_at TIME │        │     description   VARCHAR    │
└──────────────────────┘        │     created_at    TIMESTAMP  │
                                │                              │
                                │ UQ  (organization_id, name)  │
                                └──────────────────────────────┘

Relasi: Contact ◀──N:M──▶ Tag (via ContactTag)
```

### 2.4 Conversations & Messages (Core Chat)

```
┌──────────────────────────────────────┐
│          CONVERSATION                │
├──────────────────────────────────────┤
│ PK  id                  UUID         │
│ FK  organization_id     UUID         │
│ FK  instance_id         UUID         │──── dari WA_INSTANCE
│ FK  contact_id          UUID         │──── dari CONTACT
│                                      │
│     chat_jid            VARCHAR      │──── 628xxx@s.whatsapp.net
│                                      │
│     status              ENUM         │──── OPEN|PENDING|RESOLVED|CLOSED
│     priority            ENUM         │──── LOW|MEDIUM|HIGH|URGENT
│                                      │
│     unread_count        INT          │──── Cached counter
│     total_messages      INT          │──── Cached counter
│                                      │
│     last_message_at     TIMESTAMP    │
│     last_message_preview VARCHAR     │──── "Hello, I need help..."
│     last_message_direction ENUM      │──── INCOMING|OUTGOING
│                                      │
│     assigned_to_user_id UUID (null)  │──── FK → USER
│     assigned_to_team_id UUID (null)  │──── FK → TEAM
│                                      │
│     resolved_at         TIMESTAMP    │
│     resolved_by_id      UUID (null)  │
│                                      │
│     first_response_at   TIMESTAMP    │──── SLA tracking
│     sla_deadline_at     TIMESTAMP    │
│                                      │
│     created_at          TIMESTAMP    │
│     updated_at          TIMESTAMP    │
│                                      │
│ UQ  (organization_id, chat_jid,      │
│      instance_id)                    │
│ IDX (organization_id, status,        │
│      last_message_at)                │
│ IDX (organization_id,                │
│      assigned_to_user_id)            │
└───────────┬──────────────────────────┘
            │
            │ 1:N
            ▼
┌──────────────────────────────────────┐
│            MESSAGE                   │
├──────────────────────────────────────┤
│ PK  id                  UUID         │
│     organization_id     VARCHAR      │
│ FK  conversation_id     UUID         │──── dari CONVERSATION
│ FK  instance_id         UUID         │──── dari WA_INSTANCE
│                                      │
│     wa_message_id       VARCHAR      │──── ID dari WA API
│                                      │
│     direction           ENUM         │──── INCOMING|OUTGOING
│     message_type        ENUM         │──── TEXT|IMAGE|VIDEO|AUDIO|DOCUMENT|
│                                      │     LOCATION|STICKER|CONTACT_CARD|SYSTEM
│     content             TEXT         │──── Text body
│     caption             VARCHAR      │──── Media caption
│                                      │
│     ── Media Fields ──               │
│     media_url           VARCHAR      │──── URL dari WA API
│     media_local_path    VARCHAR      │──── Cached locally
│     media_mime_type     VARCHAR      │
│     media_size          INT          │──── bytes
│     filename            VARCHAR      │
│                                      │
│     ── Location Fields ──            │
│     latitude            FLOAT        │
│     longitude           FLOAT        │
│     location_name       VARCHAR      │
│     location_address    VARCHAR      │
│                                      │
│     ── Status ──                     │
│     status              ENUM         │──── PENDING|SENT|DELIVERED|READ|FAILED|RECEIVED
│     error_message       VARCHAR      │
│                                      │
│     ── Metadata ──                   │
│ FK  sent_by_user_id     UUID (null)  │──── Agent yang kirim
│     is_from_broadcast   BOOLEAN      │
│     broadcast_id        VARCHAR      │
│     is_internal_note    BOOLEAN      │──── Internal note (bukan WA msg)
│                                      │
│     created_at          TIMESTAMP    │
│     updated_at          TIMESTAMP    │
│                                      │
│ IDX (conversation_id, created_at)    │
│ IDX (organization_id, created_at)    │
│ IDX (wa_message_id)                  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│     CONVERSATION_ASSIGNMENT          │
├──────────────────────────────────────┤
│ PK  id                UUID           │
│ FK  conversation_id   UUID           │──── dari CONVERSATION
│ FK  user_id           UUID (null)    │──── dari USER
│ FK  team_id           UUID (null)    │──── dari TEAM
│                                      │
│     assigned_by_id    UUID (null)     │
│     reason            VARCHAR        │──── "auto-assigned"|"manual"|"transfer"
│     assigned_at       TIMESTAMP      │
│     unassigned_at     TIMESTAMP      │
│     is_active         BOOLEAN        │
│                                      │
│ IDX (conversation_id, is_active)     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      CONVERSATION_LABEL              │
├──────────────────────────────────────┤
│ PK  id                UUID           │
│ FK  conversation_id   UUID           │──── dari CONVERSATION
│                                      │
│     label             VARCHAR        │
│     color             VARCHAR        │
│                                      │
│ UQ  (conversation_id, label)         │
└──────────────────────────────────────┘
```

### 2.5 Broadcasts & Templates

```
┌──────────────────────────────────────┐
│       MESSAGE_TEMPLATE               │
├──────────────────────────────────────┤
│ PK  id                UUID           │
│ FK  organization_id   UUID           │
│                                      │
│     name              VARCHAR        │
│     category          VARCHAR        │──── "greeting"|"follow-up"|"promo"
│     content           TEXT           │──── "Hi {{name}}, your order {{order_id}}..."
│     media_url         VARCHAR        │
│     media_type        ENUM           │
│                                      │
│     variables         JSONB          │──── ["name","company","order_id"]
│                                      │
│     is_active         BOOLEAN        │
│     usage_count       INT            │
│     created_by_id     UUID           │
│     created_at        TIMESTAMP      │
│     updated_at        TIMESTAMP      │
│                                      │
│ UQ  (organization_id, name)          │
└───────────┬──────────────────────────┘
            │
            │ 1:N (optional)
            ▼
┌──────────────────────────────────────┐
│          BROADCAST                   │
├──────────────────────────────────────┤
│ PK  id                UUID           │
│ FK  organization_id   UUID           │
│ FK  instance_id       UUID           │──── dari WA_INSTANCE
│ FK  template_id       UUID (null)    │──── dari MESSAGE_TEMPLATE
│                                      │
│     name              VARCHAR        │
│     message_content   TEXT           │
│     media_url         VARCHAR        │
│     media_type        ENUM           │
│                                      │
│     status            ENUM           │──── DRAFT|SCHEDULED|SENDING|PAUSED|
│                                      │     COMPLETED|CANCELLED|FAILED
│     scheduled_at      TIMESTAMP      │
│     started_at        TIMESTAMP      │
│     completed_at      TIMESTAMP      │
│                                      │
│     ── Stats (Cached) ──             │
│     total_recipients  INT            │
│     sent_count        INT            │
│     delivered_count   INT            │
│     read_count        INT            │
│     failed_count      INT            │
│                                      │
│     delay_min_seconds INT (5)        │
│     delay_max_seconds INT (15)       │
│                                      │
│     created_by_id     UUID           │
│     created_at        TIMESTAMP      │
│     updated_at        TIMESTAMP      │
└───────────┬──────────────────────────┘
            │
            │ 1:N
            ▼
┌──────────────────────────────────────┐
│      BROADCAST_RECIPIENT             │
├──────────────────────────────────────┤
│ PK  id                  UUID         │
│ FK  broadcast_id        UUID         │──── dari BROADCAST
│ FK  contact_id          UUID         │──── dari CONTACT
│                                      │
│     phone_number        VARCHAR      │
│     personalized_message TEXT        │──── Setelah variable replacement
│                                      │
│     status              ENUM         │──── PENDING|SENT|DELIVERED|READ|FAILED
│     wa_message_id       VARCHAR      │
│     error_message       VARCHAR      │
│     sent_at             TIMESTAMP    │
│     delivered_at        TIMESTAMP    │
│     read_at             TIMESTAMP    │
│                                      │
│ IDX (broadcast_id, status)           │
└──────────────────────────────────────┘
```

### 2.6 Deals / Closing (Sales Pipeline)

```
┌──────────────────────────────────────┐
│             DEAL                     │
├──────────────────────────────────────┤
│ PK  id                  UUID         │
│ FK  organization_id     UUID         │──── dari ORGANIZATION
│ FK  contact_id          UUID         │──── dari CONTACT
│ FK  conversation_id     UUID (null)  │──── dari CONVERSATION (optional)
│                                      │
│     title               VARCHAR      │──── "Paket Premium - John Doe"
│     description         TEXT         │
│ UQ  deal_number         VARCHAR      │──── Auto: DEAL-2026-0001
│                                      │
│     stage               ENUM         │──── QUALIFICATION|PROPOSAL|
│                                      │     NEGOTIATION|CLOSING|WON|LOST
│     pipeline            VARCHAR      │──── "default" (multi-pipeline)
│                                      │
│     value               DECIMAL(15,2)│──── Nilai deal (Rp)
│     currency            VARCHAR      │──── "IDR"
│     win_probability     INT          │──── 0-100%
│                                      │
│ FK  assigned_to_id      UUID (null)  │──── dari USER
│                                      │
│     expected_close_date TIMESTAMP    │──── Target closing
│     actual_close_date   TIMESTAMP    │──── Tanggal real closing
│                                      │
│     closed_status       ENUM (null)  │──── WON|LOST
│     lost_reason         VARCHAR      │──── Alasan kalah (jika LOST)
│     won_notes           TEXT         │──── Catatan closing (jika WON)
│                                      │
│     products            JSONB        │──── [{name, qty, price, subtotal}]
│     source              VARCHAR      │──── "whatsapp"|"referral"|"website"
│     custom_fields       JSONB        │
│     is_archived         BOOLEAN      │
│                                      │
│     created_at          TIMESTAMP    │
│     updated_at          TIMESTAMP    │
│                                      │
│ IDX (organization_id, stage)         │
│ IDX (organization_id, assigned_to_id)│
│ IDX (organization_id, closed_status) │
│ IDX (organization_id,                │
│      expected_close_date)            │
└───────────┬──────────────────────────┘
            │
            │ 1:N
            ▼
┌──────────────────────────────────────┐
│        DEAL_ACTIVITY                 │
├──────────────────────────────────────┤
│ PK  id              UUID             │
│ FK  deal_id         UUID             │──── dari DEAL
│     user_id         UUID (null)      │
│                                      │
│     type            ENUM             │──── STAGE_CHANGED|VALUE_CHANGED|
│                                      │     ASSIGNED|NOTE_ADDED|
│                                      │     PRODUCT_ADDED|WON|LOST|
│                                      │     REOPENED|CREATED
│     title           VARCHAR          │──── "Stage changed to PROPOSAL"
│     description     VARCHAR          │
│     metadata        JSONB            │──── {old_stage, new_stage, ...}
│                                      │
│     created_at      TIMESTAMP        │
│                                      │
│ IDX (deal_id, created_at)            │
└──────────────────────────────────────┘

Relasi:
  ORGANIZATION (1) ──▶ (N) DEAL
  CONTACT (1) ────────▶ (N) DEAL
  CONVERSATION (1) ───▶ (N) DEAL (optional)
  USER (1) ───────────▶ (N) DEAL (assigned_to)
  DEAL (1) ───────────▶ (N) DEAL_ACTIVITY
```

---

### 2.7 Automations, Notifications & Logs

```
┌──────────────────────────────────────┐
│          AUTOMATION                  │
├──────────────────────────────────────┤
│ PK  id                UUID           │
│ FK  organization_id   UUID           │
│                                      │
│     name              VARCHAR        │
│     description       VARCHAR        │
│                                      │
│     trigger_type      ENUM           │──── MESSAGE_RECEIVED|KEYWORD_MATCH|
│                                      │     FIRST_MESSAGE|CONTACT_CREATED|
│                                      │     NO_REPLY_TIMEOUT|BUSINESS_HOURS
│     trigger_config    JSONB          │──── {"keywords":["help","price"],"match":"contains"}
│                                      │
│     action_type       ENUM           │──── SEND_REPLY|ASSIGN_TEAM|ASSIGN_USER|
│                                      │     ADD_TAG|SET_STAGE|SEND_NOTIFICATION|WEBHOOK
│     action_config     JSONB          │──── {"message":"Thanks for contacting us!"}
│                                      │
│     is_active         BOOLEAN        │
│     priority          INT            │──── Higher = checked first
│     execution_count   INT            │
│     created_at        TIMESTAMP      │
│     updated_at        TIMESTAMP      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│         NOTIFICATION                 │
├──────────────────────────────────────┤
│ PK  id              UUID             │
│ FK  user_id         UUID             │──── dari USER
│                                      │
│     type            ENUM             │──── NEW_MESSAGE|ASSIGNED|MENTION|
│                                      │     BROADCAST_COMPLETED|
│                                      │     INSTANCE_DISCONNECTED|SYSTEM
│     title           VARCHAR          │
│     body            VARCHAR          │
│     data            JSONB            │──── {"conversation_id":"xxx","contact_id":"yyy"}
│                                      │
│     is_read         BOOLEAN          │
│     read_at         TIMESTAMP        │
│     created_at      TIMESTAMP        │
│                                      │
│ IDX (user_id, is_read, created_at)   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│        ACTIVITY_LOG                  │
├──────────────────────────────────────┤
│ PK  id              UUID             │
│     organization_id VARCHAR          │
│ FK  user_id         UUID (null)      │──── dari USER (null = system)
│ FK  contact_id      UUID (null)      │──── dari CONTACT
│                                      │
│     action          VARCHAR          │──── "contact.created"|"chat.assigned"|
│                                      │     "message.sent"|"broadcast.started"
│     entity_type     VARCHAR          │──── "contact"|"conversation"|"broadcast"
│     entity_id       VARCHAR          │
│                                      │
│     details         JSONB            │──── {"old_stage":"NEW","new_stage":"LEAD"}
│     ip_address      VARCHAR          │
│     created_at      TIMESTAMP        │
│                                      │
│ IDX (organization_id, created_at)    │
│ IDX (entity_type, entity_id)         │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│       WEBHOOK_CONFIG                 │
├──────────────────────────────────────┤
│ PK  id                UUID           │
│ FK  organization_id   UUID           │
│                                      │
│     wa_instance_id    VARCHAR        │──── Instance ID di WA API
│     webhook_url       VARCHAR        │──── URL CRM kita
│     webhook_secret    VARCHAR        │
│     events            JSONB          │──── ["message.received","message.sent"]
│                                      │
│     is_active         BOOLEAN        │
│     last_received_at  TIMESTAMP      │
│     failure_count     INT            │
│     created_at        TIMESTAMP      │
│     updated_at        TIMESTAMP      │
│                                      │
│ UQ  (organization_id,                │
│      wa_instance_id)                 │
└──────────────────────────────────────┘
```

---

## 3. Relationship Summary (All Foreign Keys)

```
ORGANIZATION (1) ──────▶ (N) USER
ORGANIZATION (1) ──────▶ (N) TEAM
ORGANIZATION (1) ──────▶ (N) WA_INSTANCE
ORGANIZATION (1) ──────▶ (N) CONTACT
ORGANIZATION (1) ──────▶ (N) TAG
ORGANIZATION (1) ──────▶ (N) CONVERSATION
ORGANIZATION (1) ──────▶ (N) BROADCAST
ORGANIZATION (1) ──────▶ (N) MESSAGE_TEMPLATE
ORGANIZATION (1) ──────▶ (N) AUTOMATION
ORGANIZATION (1) ──────▶ (N) WEBHOOK_CONFIG

USER (1) ──────────────▶ (N) REFRESH_TOKEN
USER (1) ──────────────▶ (N) NOTIFICATION
USER (1) ──────────────▶ (N) ACTIVITY_LOG
USER (N) ◀────────────▶ (N) TEAM              via TEAM_MEMBER
USER (1) ──────────────▶ (N) CONVERSATION_ASSIGNMENT
USER (1) ──────────────▶ (N) MESSAGE           (sent_by_user_id)

TEAM (1) ──────────────▶ (N) TEAM_MEMBER
TEAM (1) ──────────────▶ (N) CONVERSATION_ASSIGNMENT

WA_INSTANCE (1) ──────▶ (N) CONTACT
WA_INSTANCE (1) ──────▶ (N) CONVERSATION
WA_INSTANCE (1) ──────▶ (N) MESSAGE
WA_INSTANCE (1) ──────▶ (N) BROADCAST

CONTACT (1) ───────────▶ (N) CONVERSATION
CONTACT (N) ◀──────────▶ (N) TAG               via CONTACT_TAG
CONTACT (1) ───────────▶ (N) BROADCAST_RECIPIENT
CONTACT (1) ───────────▶ (N) ACTIVITY_LOG

CONVERSATION (1) ──────▶ (N) MESSAGE
CONVERSATION (1) ──────▶ (N) CONVERSATION_ASSIGNMENT
CONVERSATION (1) ──────▶ (N) CONVERSATION_LABEL

MESSAGE_TEMPLATE (1) ──▶ (N) BROADCAST

BROADCAST (1) ─────────▶ (N) BROADCAST_RECIPIENT

DEAL ── Relations:
ORGANIZATION (1) ──────▶ (N) DEAL
CONTACT (1) ───────────▶ (N) DEAL
CONVERSATION (1) ──────▶ (N) DEAL              (optional)
USER (1) ──────────────▶ (N) DEAL              (assigned_to)
DEAL (1) ──────────────▶ (N) DEAL_ACTIVITY
```

---

## 4. Indexes Strategy

### Primary Indexes (Performance Critical)

| Table | Index | Purpose |
|-------|-------|---------|
| `contacts` | `(organization_id, phone_number)` UNIQUE | Lookup contact by phone |
| `contacts` | `(organization_id, stage)` | Filter by pipeline stage |
| `contacts` | `(organization_id, last_message_at)` | Sort by recent activity |
| `contacts` | `(phone_number)` | Cross-org phone lookup |
| `conversations` | `(organization_id, chat_jid, instance_id)` UNIQUE | Find conversation by JID |
| `conversations` | `(organization_id, status, last_message_at)` | Chat inbox query |
| `conversations` | `(organization_id, assigned_to_user_id)` | "My chats" filter |
| `messages` | `(conversation_id, created_at)` | Chat history pagination |
| `messages` | `(organization_id, created_at)` | Global message search |
| `messages` | `(wa_message_id)` | Status update lookup |
| `notifications` | `(user_id, is_read, created_at)` | Unread notifications |
| `activity_logs` | `(organization_id, created_at)` | Audit trail |
| `activity_logs` | `(entity_type, entity_id)` | Entity history |
| `broadcast_recipients` | `(broadcast_id, status)` | Broadcast progress |
| `deals` | `(organization_id, stage)` | Pipeline board query |
| `deals` | `(organization_id, assigned_to_id)` | "My deals" filter |
| `deals` | `(organization_id, closed_status)` | Closing report (WON/LOST) |
| `deals` | `(organization_id, expected_close_date)` | Deals closing soon |
| `deal_activities` | `(deal_id, created_at)` | Deal activity timeline |

---

## 5. Data Flow Diagrams

### 5.1 Incoming Message Flow (Webhook → Database)

```
WA API Webhook POST
        │
        ▼
┌───────────────────┐
│ 1. Parse webhook  │
│    payload        │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌─────────────────┐
│ 2. Find Contact   │────▶│ CONTACT table   │
│    by phone_number│     │ (upsert)        │
│    or create new  │     └─────────────────┘
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌─────────────────┐
│ 3. Find/Create    │────▶│ CONVERSATION    │
│    Conversation   │     │ table (upsert)  │
│    by chat_jid    │     └─────────────────┘
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌─────────────────┐
│ 4. Save Message   │────▶│ MESSAGE table   │
│                   │     │ (insert)        │
└────────┬──────────┘     └─────────────────┘
         │
         ▼
┌───────────────────┐
│ 5. Update Counters│
│    - unread_count  │──── CONVERSATION.unread_count++
│    - total_messages│──── CONVERSATION.total_messages++
│    - last_message  │──── CONVERSATION.last_message_at
│    - contact stats │──── CONTACT.total_messages++
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 6. Run Automations│──── Check AUTOMATION rules
│    (if matched)   │     → SEND_REPLY / ASSIGN / TAG
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 7. Emit Socket.IO │──── Real-time to browser
│    + Notification  │──── NOTIFICATION table (insert)
└───────────────────┘
```

### 5.2 Send Message Flow (Agent → WA API)

```
Agent clicks "Send"
        │
        ▼
┌───────────────────┐     ┌─────────────────┐
│ 1. Save Message   │────▶│ MESSAGE table   │
│    status=PENDING  │     │ (insert)        │
└────────┬──────────┘     └─────────────────┘
         │
         ▼
┌───────────────────┐
│ 2. Call WA API    │
│    POST /messages │
│    /send-text     │
└────────┬──────────┘
         │
    ┌────┴────┐
    ▼         ▼
 SUCCESS    FAILED
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Update  │ │Update  │
│MESSAGE │ │MESSAGE │
│status= │ │status= │
│SENT    │ │FAILED  │
│wa_msg_id│ │error_msg│
└───┬────┘ └────────┘
    │
    ▼
┌───────────────────┐
│ 3. Update         │
│    Conversation   │──── last_message_at, last_message_preview
│    counters       │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 4. Emit Socket.IO │──── Confirm to sender + broadcast to room
│    "chat:message"  │
└───────────────────┘
```

### 5.3 Broadcast Flow

```
Agent creates Broadcast
        │
        ▼
┌───────────────────┐     ┌─────────────────┐
│ 1. Save Broadcast │────▶│ BROADCAST table │
│    status=DRAFT    │     │ (insert)        │
└────────┬──────────┘     └─────────────────┘
         │
         ▼
┌───────────────────┐     ┌─────────────────────┐
│ 2. Add Recipients │────▶│ BROADCAST_RECIPIENT │
│    (from filters) │     │ (bulk insert)       │
└────────┬──────────┘     └─────────────────────┘
         │
         ▼ (Agent clicks "Send")
┌───────────────────┐
│ 3. Queue Job      │──── BullMQ: broadcast queue
│    status=SENDING  │
└────────┬──────────┘
         │
         ▼ (Worker processes)
┌───────────────────────────────────┐
│ 4. For each recipient:           │
│    a. Replace {{variables}}      │
│    b. Call WA API send-text      │
│    c. Update recipient status    │
│    d. Wait random delay (5-15s)  │
│    e. Check daily limit          │
└────────┬──────────────────────────┘
         │
         ▼
┌───────────────────┐
│ 5. Update stats   │──── sent_count, failed_count
│    status=COMPLETED│
└───────────────────┘
```

---

## 6. Table Count Summary

| Category | Tables | Count |
|----------|--------|-------|
| **Auth & Tenant** | Organization, User, RefreshToken | 3 |
| **Teams** | Team, TeamMember | 2 |
| **WhatsApp** | WAInstance, WebhookConfig | 2 |
| **Contacts** | Contact, Tag, ContactTag | 3 |
| **Chat** | Conversation, Message, ConversationAssignment, ConversationLabel | 4 |
| **Broadcast** | MessageTemplate, Broadcast, BroadcastRecipient | 3 |
| **Deals** | Deal, DealActivity | 2 |
| **Automation** | Automation | 1 |
| **System** | Notification, ActivityLog | 2 |
| **Total** | | **22 tables** |

---

## 7. Enum Types Summary

| Enum | Values |
|------|--------|
| `Plan` | FREE, STARTER, PROFESSIONAL, ENTERPRISE |
| `UserRole` | OWNER, ADMIN, SUPERVISOR, AGENT |
| `AssignStrategy` | ROUND_ROBIN, LEAST_BUSY, MANUAL |
| `InstanceStatus` | CONNECTED, DISCONNECTED, CONNECTING, QR_PENDING |
| `ContactSource` | WHATSAPP, MANUAL, IMPORT, API, WEBSITE |
| `ContactStage` | NEW, LEAD, QUALIFIED, CUSTOMER, VIP, CHURNED |
| `ConversationStatus` | OPEN, PENDING, RESOLVED, CLOSED |
| `Priority` | LOW, MEDIUM, HIGH, URGENT |
| `MessageDirection` | INCOMING, OUTGOING |
| `MessageType` | TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, LOCATION, STICKER, CONTACT_CARD, SYSTEM |
| `MessageStatus` | PENDING, SENT, DELIVERED, READ, FAILED, RECEIVED |
| `BroadcastStatus` | DRAFT, SCHEDULED, SENDING, PAUSED, COMPLETED, CANCELLED, FAILED |
| `AutomationTrigger` | MESSAGE_RECEIVED, KEYWORD_MATCH, FIRST_MESSAGE, CONTACT_CREATED, NO_REPLY_TIMEOUT, BUSINESS_HOURS |
| `AutomationAction` | SEND_REPLY, ASSIGN_TEAM, ASSIGN_USER, ADD_TAG, SET_STAGE, SEND_NOTIFICATION, WEBHOOK |
| `DealStage` | QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSING, WON, LOST |
| `DealClosedStatus` | WON, LOST |
| `DealActivityType` | STAGE_CHANGED, VALUE_CHANGED, ASSIGNED, NOTE_ADDED, PRODUCT_ADDED, WON, LOST, REOPENED, CREATED |
| `NotificationType` | NEW_MESSAGE, ASSIGNED, MENTION, BROADCAST_COMPLETED, INSTANCE_DISCONNECTED, SYSTEM |

---

*End of ERD & Database Design*
