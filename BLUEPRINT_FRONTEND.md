# 🎨 CRM-DADI — Frontend Blueprint

> **Version:** 1.0.0  
> **Date:** 2026-02-09  
> **Type:** SaaS-Ready CRM Frontend  
> **Integration:** CRM-DADI Backend API

---

## 1. Tech Stack

| Layer | Technology | Alasan |
|-------|-----------|--------|
| **Framework** | Next.js 14 (App Router) | SSR, file-based routing, API routes, RSC |
| **Language** | TypeScript | Type safety end-to-end |
| **Styling** | TailwindCSS 3 | Utility-first, rapid UI development |
| **UI Components** | shadcn/ui | Accessible, customizable, Radix-based |
| **Icons** | Lucide React | Consistent, lightweight icon set |
| **State (Global)** | Zustand | Lightweight, simple, no boilerplate |
| **State (Server)** | TanStack Query (React Query) | Caching, refetching, optimistic updates |
| **Forms** | React Hook Form + Zod | Performant forms + runtime validation |
| **Realtime** | Socket.IO Client | Live chat, notifications, status updates |
| **Charts** | Recharts | Simple, responsive chart library |
| **Tables** | TanStack Table | Headless, sortable, filterable tables |
| **Date** | date-fns | Lightweight date formatting |
| **Toast** | Sonner | Beautiful toast notifications |
| **File Upload** | react-dropzone | Drag & drop file upload |
| **Emoji** | emoji-mart | Emoji picker for chat |
| **Audio** | use-sound | Notification sounds |
| **Testing** | Playwright + Vitest | E2E + unit tests |

---

## 2. Folder Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   ├── sounds/
│   │   ├── notification.mp3
│   │   └── message.mp3
│   └── images/
│       ├── empty-chat.svg
│       ├── empty-contacts.svg
│       └── onboarding/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (providers)
│   │   ├── page.tsx                  # Landing → redirect to /login or /dashboard
│   │   ├── globals.css               # Tailwind + custom styles
│   │   │
│   │   ├── (auth)/                   # Auth group (no sidebar)
│   │   │   ├── layout.tsx            # Auth layout (centered card)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   │
│   │   └── (dashboard)/              # Dashboard group (with sidebar)
│   │       ├── layout.tsx            # Dashboard layout (sidebar + topbar)
│   │       │
│   │       ├── dashboard/
│   │       │   └── page.tsx          # Overview / Analytics
│   │       │
│   │       ├── chats/
│   │       │   ├── page.tsx          # Chat inbox (conversation list + chat panel)
│   │       │   └── [id]/
│   │       │       └── page.tsx      # Specific chat (deep link)
│   │       │
│   │       ├── contacts/
│   │       │   ├── page.tsx          # Contact list
│   │       │   ├── [id]/
│   │       │   │   └── page.tsx      # Contact detail
│   │       │   └── import/
│   │       │       └── page.tsx      # Import contacts
│   │       │
│   │       ├── broadcasts/
│   │       │   ├── page.tsx          # Broadcast list
│   │       │   ├── new/
│   │       │   │   └── page.tsx      # Create broadcast
│   │       │   └── [id]/
│   │       │       └── page.tsx      # Broadcast detail + stats
│   │       │
│   │       ├── templates/
│   │       │   └── page.tsx          # Message templates
│   │       │
│   │       ├── deals/
│   │       │   ├── page.tsx          # Deals list + pipeline board
│   │       │   ├── new/
│   │       │   │   └── page.tsx      # Create new deal
│   │       │   ├── [id]/
│   │       │   │   └── page.tsx      # Deal detail + activity
│   │       │   └── report/
│   │       │       └── page.tsx      # Closing report & analytics
│   │       │
│   │       ├── automations/
│   │       │   ├── page.tsx          # Automation rules list
│   │       │   └── new/
│   │       │       └── page.tsx      # Create automation
│   │       │
│   │       ├── analytics/
│   │       │   └── page.tsx          # Detailed analytics
│   │       │
│   │       ├── team/
│   │       │   └── page.tsx          # Team & user management
│   │       │
│   │       └── settings/
│   │           ├── page.tsx          # General settings
│   │           ├── instances/
│   │           │   └── page.tsx      # WA instance management
│   │           ├── webhooks/
│   │           │   └── page.tsx      # Webhook configuration
│   │           ├── api-keys/
│   │           │   └── page.tsx      # API key management
│   │           ├── business-hours/
│   │           │   └── page.tsx      # Business hours config
│   │           └── quick-replies/
│   │               └── page.tsx      # Quick reply shortcuts
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── command.tsx           # Command palette (Ctrl+K)
│   │   │   ├── textarea.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── label.tsx
│   │   │   └── ... (other shadcn components)
│   │   │
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # Main sidebar navigation
│   │   │   ├── topbar.tsx            # Top bar (search, notifications, profile)
│   │   │   ├── mobile-nav.tsx        # Mobile bottom navigation
│   │   │   ├── breadcrumb.tsx        # Page breadcrumbs
│   │   │   └── page-header.tsx       # Page title + actions
│   │   │
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   ├── register-form.tsx
│   │   │   ├── forgot-password-form.tsx
│   │   │   └── social-login-buttons.tsx
│   │   │
│   │   ├── chat/
│   │   │   ├── chat-layout.tsx        # 3-column layout wrapper
│   │   │   ├── conversation-list.tsx  # Left sidebar: conversation list
│   │   │   ├── conversation-item.tsx  # Single conversation row
│   │   │   ├── conversation-filters.tsx # Filter tabs (All, Mine, Unassigned)
│   │   │   ├── chat-panel.tsx         # Center: chat messages area
│   │   │   ├── chat-header.tsx        # Chat header (contact name, actions)
│   │   │   ├── message-list.tsx       # Scrollable message list
│   │   │   ├── message-bubble.tsx     # Single message bubble
│   │   │   ├── message-input.tsx      # Input area (text, attach, emoji, send)
│   │   │   ├── message-media.tsx      # Media preview (image, video, doc)
│   │   │   ├── message-status.tsx     # Tick marks (sent, delivered, read)
│   │   │   ├── typing-indicator.tsx   # "Agent is typing..." indicator
│   │   │   ├── contact-panel.tsx      # Right sidebar: contact details
│   │   │   ├── contact-info.tsx       # Contact info card
│   │   │   ├── contact-tags.tsx       # Tags display + edit
│   │   │   ├── contact-notes.tsx      # Notes section
│   │   │   ├── contact-activities.tsx # Activity timeline
│   │   │   ├── quick-reply-picker.tsx # Quick reply shortcut selector
│   │   │   ├── emoji-picker.tsx       # Emoji picker wrapper
│   │   │   ├── attachment-menu.tsx    # Attach file menu (image, doc, location)
│   │   │   ├── assign-dialog.tsx      # Assign to agent/team dialog
│   │   │   ├── chat-search.tsx        # Search within chat
│   │   │   └── empty-chat.tsx         # Empty state (no chat selected)
│   │   │
│   │   ├── contacts/
│   │   │   ├── contact-table.tsx      # Contacts data table
│   │   │   ├── contact-filters.tsx    # Filter bar (stage, tag, source)
│   │   │   ├── contact-form.tsx       # Create/edit contact form
│   │   │   ├── contact-detail-card.tsx # Contact detail view
│   │   │   ├── contact-stage-badge.tsx # Stage badge (NEW, LEAD, etc)
│   │   │   ├── contact-import-wizard.tsx # CSV import wizard
│   │   │   ├── contact-export-dialog.tsx # Export dialog
│   │   │   └── contact-merge-dialog.tsx  # Merge duplicate contacts
│   │   │
│   │   ├── broadcast/
│   │   │   ├── broadcast-list.tsx     # Broadcast campaigns list
│   │   │   ├── broadcast-card.tsx     # Single broadcast card
│   │   │   ├── broadcast-wizard.tsx   # Multi-step create wizard
│   │   │   ├── broadcast-step-audience.tsx  # Step 1: Select audience
│   │   │   ├── broadcast-step-message.tsx   # Step 2: Compose message
│   │   │   ├── broadcast-step-schedule.tsx  # Step 3: Schedule
│   │   │   ├── broadcast-step-review.tsx    # Step 4: Review & send
│   │   │   ├── broadcast-stats.tsx    # Broadcast statistics
│   │   │   ├── recipient-table.tsx    # Recipients + delivery status
│   │   │   └── audience-selector.tsx  # Select contacts by tag/stage/filter
│   │   │
│   │   ├── templates/
│   │   │   ├── template-list.tsx      # Template cards grid
│   │   │   ├── template-card.tsx      # Single template card
│   │   │   ├── template-editor.tsx    # Template editor with variables
│   │   │   ├── template-preview.tsx   # Preview rendered template
│   │   │   └── variable-inserter.tsx  # Insert {{variable}} helper
│   │   │
│   │   ├── deals/
│   │   │   ├── deal-pipeline-board.tsx  # Kanban board (drag & drop stages)
│   │   │   ├── deal-pipeline-column.tsx # Single stage column
│   │   │   ├── deal-card.tsx            # Deal card in pipeline
│   │   │   ├── deal-list-view.tsx       # Table/list view alternative
│   │   │   ├── deal-form.tsx            # Create/edit deal form
│   │   │   ├── deal-detail-panel.tsx    # Deal detail sidebar
│   │   │   ├── deal-stage-badge.tsx     # Stage badge with color
│   │   │   ├── deal-value-input.tsx     # Currency value input (Rp)
│   │   │   ├── deal-product-table.tsx   # Products/services in deal
│   │   │   ├── deal-activity-timeline.tsx # Activity history
│   │   │   ├── deal-won-dialog.tsx      # Mark as WON dialog
│   │   │   ├── deal-lost-dialog.tsx     # Mark as LOST dialog (with reason)
│   │   │   ├── deal-filters.tsx         # Filter by stage, agent, value
│   │   │   ├── closing-report.tsx       # Closing report dashboard
│   │   │   ├── closing-summary-cards.tsx # KPI cards (won, lost, rate, value)
│   │   │   ├── closing-by-agent.tsx     # Agent performance table
│   │   │   ├── closing-by-month.tsx     # Monthly trend chart
│   │   │   ├── closing-funnel.tsx       # Pipeline funnel visualization
│   │   │   ├── closing-lost-reasons.tsx # Lost reasons pie chart
│   │   │   └── closing-export.tsx       # Export report to PDF/Excel
│   │   │
│   │   ├── automations/
│   │   │   ├── automation-list.tsx    # Automation rules list
│   │   │   ├── automation-card.tsx    # Single rule card
│   │   │   ├── automation-builder.tsx # Visual rule builder
│   │   │   ├── trigger-selector.tsx   # Select trigger type
│   │   │   └── action-selector.tsx    # Select action type
│   │   │
│   │   ├── analytics/
│   │   │   ├── stats-cards.tsx        # KPI cards row
│   │   │   ├── message-chart.tsx      # Message volume line chart
│   │   │   ├── response-time-chart.tsx # Response time chart
│   │   │   ├── agent-leaderboard.tsx  # Agent performance table
│   │   │   ├── contact-growth-chart.tsx # Contact growth chart
│   │   │   ├── broadcast-stats-chart.tsx # Broadcast performance
│   │   │   ├── channel-breakdown.tsx  # Messages by instance
│   │   │   └── date-range-picker.tsx  # Date range selector
│   │   │
│   │   ├── team/
│   │   │   ├── user-table.tsx         # Users list table
│   │   │   ├── invite-user-dialog.tsx # Invite new user
│   │   │   ├── user-role-select.tsx   # Role selector
│   │   │   ├── team-list.tsx          # Teams list
│   │   │   ├── team-card.tsx          # Team card with members
│   │   │   └── team-form.tsx          # Create/edit team
│   │   │
│   │   ├── settings/
│   │   │   ├── instance-card.tsx      # WA instance status card
│   │   │   ├── instance-qr-dialog.tsx # QR code scan dialog
│   │   │   ├── webhook-config-form.tsx # Webhook configuration
│   │   │   ├── business-hours-editor.tsx # Business hours grid
│   │   │   ├── quick-reply-list.tsx   # Quick replies management
│   │   │   └── danger-zone.tsx        # Danger zone (delete org, etc)
│   │   │
│   │   └── shared/
│   │       ├── data-table.tsx         # Reusable data table wrapper
│   │       ├── empty-state.tsx        # Empty state illustration
│   │       ├── loading-state.tsx      # Loading skeleton
│   │       ├── error-state.tsx        # Error state with retry
│   │       ├── confirm-dialog.tsx     # Confirmation dialog
│   │       ├── search-input.tsx       # Debounced search input
│   │       ├── phone-input.tsx        # Phone number input with country
│   │       ├── tag-input.tsx          # Tag input with autocomplete
│   │       ├── file-upload.tsx        # File upload dropzone
│   │       ├── user-avatar.tsx        # User avatar with online status
│   │       ├── relative-time.tsx      # "2 minutes ago" component
│   │       ├── pagination.tsx         # Pagination controls
│   │       ├── status-dot.tsx         # Online/offline dot indicator
│   │       ├── command-palette.tsx    # Ctrl+K global search
│   │       └── notification-bell.tsx  # Notification bell + dropdown
│   │
│   ├── hooks/
│   │   ├── use-auth.ts               # Auth state & actions
│   │   ├── use-socket.ts             # Socket.IO connection
│   │   ├── use-chat.ts               # Chat-specific socket events
│   │   ├── use-notifications.ts      # Notification state + sound
│   │   ├── use-debounce.ts           # Debounce hook
│   │   ├── use-media-query.ts        # Responsive breakpoints
│   │   ├── use-local-storage.ts      # Persistent local state
│   │   ├── use-clipboard.ts          # Copy to clipboard
│   │   ├── use-infinite-scroll.ts    # Infinite scroll for messages
│   │   ├── use-keyboard-shortcut.ts  # Keyboard shortcuts
│   │   └── use-online-status.ts      # Browser online/offline
│   │
│   ├── stores/
│   │   ├── auth.store.ts             # Auth state (user, token, org)
│   │   ├── chat.store.ts             # Active chat state
│   │   ├── ui.store.ts               # UI state (sidebar, panels, modals)
│   │   └── notification.store.ts     # Notification state
│   │
│   ├── services/
│   │   ├── api.ts                    # Axios instance + interceptors
│   │   ├── auth.api.ts               # Auth API calls
│   │   ├── chat.api.ts               # Chat/conversation API calls
│   │   ├── contact.api.ts            # Contact API calls
│   │   ├── broadcast.api.ts          # Broadcast API calls
│   │   ├── template.api.ts           # Template API calls
│   │   ├── instance.api.ts           # Instance API calls
│   │   ├── analytics.api.ts          # Analytics API calls
│   │   ├── team.api.ts               # Team/user API calls
│   │   ├── automation.api.ts         # Automation API calls
│   │   ├── settings.api.ts           # Settings API calls
│   │   ├── tag.api.ts                # Tag API calls
│   │   └── notification.api.ts       # Notification API calls
│   │
│   ├── lib/
│   │   ├── utils.ts                  # cn() helper, misc utils
│   │   ├── constants.ts              # App constants
│   │   ├── phone.ts                  # Phone formatting utils
│   │   ├── date.ts                   # Date formatting utils
│   │   ├── validators.ts             # Shared Zod schemas
│   │   └── socket.ts                 # Socket.IO client setup
│   │
│   ├── types/
│   │   ├── index.ts                  # Global types
│   │   ├── auth.ts                   # Auth types
│   │   ├── chat.ts                   # Chat/message types
│   │   ├── contact.ts                # Contact types
│   │   ├── broadcast.ts              # Broadcast types
│   │   ├── template.ts               # Template types
│   │   ├── analytics.ts              # Analytics types
│   │   ├── team.ts                   # Team/user types
│   │   ├── automation.ts             # Automation types
│   │   └── api.ts                    # API response types
│   │
│   └── providers/
│       ├── query-provider.tsx        # TanStack Query provider
│       ├── socket-provider.tsx       # Socket.IO provider
│       ├── theme-provider.tsx        # Dark/light theme
│       └── auth-provider.tsx         # Auth context provider
│
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── components.json                   # shadcn/ui config
├── package.json
├── Dockerfile
└── README.md
```

---

## 3. Page Layouts & UI Design

### 3.1 Auth Pages (No Sidebar)

```
┌──────────────────────────────────────────────┐
│                                              │
│           ┌──────────────────┐               │
│           │    🟢 CRM-DADI   │               │
│           │                  │               │
│           │  ┌────────────┐  │               │
│           │  │   Email     │  │               │
│           │  └────────────┘  │               │
│           │  ┌────────────┐  │               │
│           │  │  Password   │  │               │
│           │  └────────────┘  │               │
│           │                  │               │
│           │  [  Login  ]     │               │
│           │                  │               │
│           │  Forgot password?│               │
│           │  Don't have      │               │
│           │  account? Register│              │
│           └──────────────────┘               │
│                                              │
│          Background: gradient/pattern         │
└──────────────────────────────────────────────┘
```

### 3.2 Dashboard Layout (With Sidebar)

```
┌────┬───────────────────────────────────────────────┐
│    │  🔍 Search (Ctrl+K)    🔔 Notif   👤 Profile │ ← Topbar
│ S  ├───────────────────────────────────────────────┤
│ I  │                                               │
│ D  │              PAGE CONTENT                     │
│ E  │                                               │
│ B  │                                               │
│ A  │                                               │
│ R  │                                               │
│    │                                               │
│ 📊 │                                               │
│ 💬 │                                               │
│ 👥 │                                               │
│ 📢 │                                               │
│ 📝 │                                               │
│ ⚡ │                                               │
│ 📈 │                                               │
│ 👨‍👩‍👧‍👦│                                               │
│ ⚙️ │                                               │
└────┴───────────────────────────────────────────────┘
```

**Sidebar Navigation Items:**

| Icon | Label | Route | Role |
|------|-------|-------|------|
| 📊 | Dashboard | `/dashboard` | All |
| 💬 | Chats | `/chats` | All |
| 👥 | Contacts | `/contacts` | All |
| 📢 | Broadcasts | `/broadcasts` | Admin+ |
| � | Deals | `/deals` | All |
| �📝 | Templates | `/templates` | Admin+ |
| ⚡ | Automations | `/automations` | Admin+ |
| 📈 | Analytics | `/analytics` | Supervisor+ |
| � | Closing Report | `/deals/report` | Supervisor+ |
| �👨‍👩‍👧‍👦 | Team | `/team` | Admin+ |
| ⚙️ | Settings | `/settings` | Admin+ |

### 3.3 Chat Page (Core — 3 Column Layout)

```
┌────┬──────────────┬─────────────────────────┬──────────────┐
│    │ CONVERSATIONS │      CHAT PANEL         │ CONTACT INFO │
│ S  │              │                         │              │
│ I  │ 🔍 Search    │ ┌─────────────────────┐ │ 👤 John Doe  │
│ D  │              │ │ John Doe    ● Online│ │ 📱 628xxx    │
│ E  │ [All][Mine]  │ │ Assigned to: You    │ │              │
│ B  │ [Unassigned] │ ├─────────────────────┤ │ Stage: LEAD  │
│ A  │              │ │                     │ │ Tags: [vip]  │
│ R  │ ┌──────────┐ │ │  💬 Customer msg    │ │              │
│    │ │ John Doe │ │ │                     │ │ ── Notes ──  │
│    │ │ Hello!   │ │ │     Agent reply 💬  │ │ VIP customer │
│    │ │ 2m ago 🟢│ │ │                     │ │              │
│    │ └──────────┘ │ │  💬 Customer msg    │ │ ── Activity ─│
│    │ ┌──────────┐ │ │                     │ │ • Assigned   │
│    │ │ Jane S.  │ │ │     Agent reply 💬  │ │ • Tag added  │
│    │ │ Thanks!  │ │ │                     │ │ • Created    │
│    │ │ 5m ago   │ │ ├─────────────────────┤ │              │
│    │ └──────────┘ │ │ 😊 📎 Type message..│ │              │
│    │ ...          │ │ [Quick] [Send ➤]    │ │              │
│    │              │ └─────────────────────┘ │              │
└────┴──────────────┴─────────────────────────┴──────────────┘
      ~280px                ~flex                ~320px

Mobile: Stacked view (list → chat → swipe for contact)
```

### 3.4 Dashboard Page

```
┌────┬────────────────────────────────────────────────┐
│    │  Dashboard              [Today ▾] [7d] [30d]  │
│ S  ├────────────────────────────────────────────────┤
│ I  │                                                │
│ D  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ E  │  │ 156  │ │  23  │ │ 4.2m │ │  89% │         │
│ B  │  │Total │ │Open  │ │Avg   │ │Resol.│         │
│ A  │  │Chats │ │Chats │ │Reply │ │Rate  │         │
│ R  │  └──────┘ └──────┘ └──────┘ └──────┘         │
│    │                                                │
│    │  ┌─────────────────────┐ ┌──────────────────┐ │
│    │  │                     │ │  Agent Perf.     │ │
│    │  │  Message Volume     │ │                  │ │
│    │  │  📈 Line Chart      │ │  1. Adi - 45msg │ │
│    │  │                     │ │  2. Budi - 32msg│ │
│    │  │                     │ │  3. Cici - 28msg│ │
│    │  └─────────────────────┘ └──────────────────┘ │
│    │                                                │
│    │  ┌─────────────────────┐ ┌──────────────────┐ │
│    │  │  Contact Growth     │ │  Recent Chats    │ │
│    │  │  📊 Bar Chart       │ │  • John: Hello   │ │
│    │  │                     │ │  • Jane: Thanks  │ │
│    │  └─────────────────────┘ └──────────────────┘ │
└────┴────────────────────────────────────────────────┘
```

### 3.5 Deals Page — Pipeline Board (Kanban)

```
┌────┬──────────────────────────────────────────────────────────────────────┐
│    │  Deals (45)           [+ New Deal]  [📋 List] [▦ Board]  [📊 Report] │
│ S  ├──────────────────────────────────────────────────────────────────────┤
│ I  │  🔍 Search deals...    Agent: [All ▾]    Value: [All ▾]              │
│ D  ├──────────────────────────────────────────────────────────────────────┤
│ E  │                                                                     │
│ B  │  QUALIFICATION(5)  PROPOSAL(3)   NEGOTIATION(4)  CLOSING(2)         │
│ A  │  Rp 15jt           Rp 12jt       Rp 28jt         Rp 8jt             │
│ R  │  ┌──────────┐      ┌──────────┐  ┌──────────┐    ┌──────────┐      │
│    │  │ Deal #001│      │ Deal #004│  │ Deal #008│    │ Deal #012│      │
│    │  │ John Doe │      │ Jane S.  │  │ Bob K.   │    │ Alice W. │      │
│    │  │ Rp 5jt   │      │ Rp 3jt   │  │ Rp 10jt  │    │ Rp 4jt   │      │
│    │  │ 📅 Feb 15│      │ 📅 Feb 20│  │ 📅 Feb 25│    │ 📅 Feb 28│      │
│    │  │ 👤 Adi   │      │ 👤 Budi  │  │ 👤 Adi   │    │ 👤 Cici  │      │
│    │  └──────────┘      └──────────┘  └──────────┘    └──────────┘      │
│    │  ┌──────────┐      ┌──────────┐  ┌──────────┐                      │
│    │  │ Deal #002│      │ Deal #005│  │ Deal #009│    ┌──────────┐      │
│    │  │ PT ABC   │      │ CV XYZ   │  │ PT DEF   │    │ Deal #013│      │
│    │  │ Rp 3jt   │      │ Rp 5jt   │  │ Rp 8jt   │    │ Rp 4jt   │      │
│    │  └──────────┘      └──────────┘  └──────────┘    └──────────┘      │
│    │  ...               ...           ...                                │
│    │                                                                     │
│    │  ── Drag & drop cards between columns to change stage ──           │
│    │                                                                     │
│    │  ┌─────────────────────────────────────────────────────────────┐    │
│    │  │ WON (28) ✅  Rp 89jt    │  LOST (12) ❌  Rp 31jt          │    │
│    │  └─────────────────────────────────────────────────────────────┘    │
└────┴──────────────────────────────────────────────────────────────────────┘
```

### 3.6 Closing Report Page

```
┌────┬──────────────────────────────────────────────────────────────────────┐
│    │  Closing Report         [This Month ▾] [Export PDF] [Export Excel]   │
│ S  ├──────────────────────────────────────────────────────────────────────┤
│ I  │  Agent: [All ▾]    Source: [All ▾]    Period: [📅 Feb 1 - Feb 9]    │
│ D  ├──────────────────────────────────────────────────────────────────────┤
│ E  │                                                                     │
│ B  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ A  │  │    28    │ │    12    │ │   70%    │ │ Rp 89jt  │ │  12.5    │  │
│ R  │  │  Deals   │ │  Deals   │ │   Win    │ │  Total   │ │  Avg     │  │
│    │  │   WON ✅ │ │  LOST ❌ │ │  Rate    │ │  Revenue │ │  Days    │  │
│    │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│    │                                                                     │
│    │  ┌──────────────────────────┐  ┌──────────────────────────────────┐ │
│    │  │  Pipeline Funnel         │  │  Monthly Trend                   │ │
│    │  │                          │  │                                  │ │
│    │  │  Qualification ████████  │  │  Jan ████████ Won: 15  Lost: 8  │ │
│    │  │  Proposal      ██████    │  │  Feb ██████   Won: 13  Lost: 4  │ │
│    │  │  Negotiation   ████      │  │                                  │ │
│    │  │  Closing       ███       │  │  📈 Win rate trending UP         │ │
│    │  │  Won           ██        │  │                                  │ │
│    │  └──────────────────────────┘  └──────────────────────────────────┘ │
│    │                                                                     │
│    │  ┌──────────────────────────┐  ┌──────────────────────────────────┐ │
│    │  │  Agent Performance       │  │  Lost Reasons                   │ │
│    │  │                          │  │                                  │ │
│    │  │  # Agent  Won Lost Rate  │  │  🥧 Pie Chart:                  │ │
│    │  │  1 Adi    12   3   80%  │  │  - Harga mahal (42%)            │ │
│    │  │  2 Budi    9   5   64%  │  │  - Pilih kompetitor (33%)       │ │
│    │  │  3 Cici    7   4   64%  │  │  - Budget belum ada (25%)       │ │
│    │  │                          │  │                                  │ │
│    │  │  Total Revenue per Agent │  │                                  │ │
│    │  │  Adi:  Rp 45jt           │  │                                  │ │
│    │  │  Budi: Rp 28jt           │  │                                  │ │
│    │  │  Cici: Rp 16jt           │  │                                  │ │
│    │  └──────────────────────────┘  └──────────────────────────────────┘ │
│    │                                                                     │
│    │  ┌──────────────────────────────────────────────────────────────┐   │
│    │  │  Avg Time per Stage (days)                                   │   │
│    │  │  Qualification: 2.1d → Proposal: 3.5d → Negotiation: 4.2d  │   │
│    │  │  → Closing: 2.7d    Total avg: 12.5 days                    │   │
│    │  └──────────────────────────────────────────────────────────────┘   │
└────┴──────────────────────────────────────────────────────────────────────┘
```

### 3.7 Contacts Page

```
┌────┬────────────────────────────────────────────────┐
│    │  Contacts (1,234)    [+ Add] [Import] [Export] │
│ S  ├────────────────────────────────────────────────┤
│ I  │  🔍 Search contacts...                        │
│ D  │  [All] [New] [Lead] [Customer] [VIP]          │
│ E  │  Tags: [vip ×] [premium ×]  [+ Add filter]   │
│ B  ├────────────────────────────────────────────────┤
│ A  │  ☐ │ Name        │ Phone      │ Stage │ Tags  │
│ R  │  ──┼─────────────┼────────────┼───────┼────── │
│    │  ☐ │ 👤 John Doe │ 628xxx     │ 🟢VIP │ [vip] │
│    │  ☐ │ 👤 Jane S.  │ 628xxx     │ 🔵Lead│ [web] │
│    │  ☐ │ 👤 Bob K.   │ 628xxx     │ 🟡New │       │
│    │  ☐ │ 👤 Alice W. │ 628xxx     │ 🟢Cust│ [ref] │
│    │  ...                                          │
│    ├────────────────────────────────────────────────┤
│    │  ◀ 1 2 3 ... 62 ▶     Showing 1-20 of 1,234  │
└────┴────────────────────────────────────────────────┘
```

### 3.6 Broadcast Page — Create Wizard

```
Step 1: Audience          Step 2: Message           Step 3: Schedule
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Select Recipients│     │ Compose Message  │     │ When to Send?    │
│                  │     │                  │     │                  │
│ ○ All contacts   │     │ Template: [▾]    │     │ ○ Send now       │
│ ○ By tag         │     │                  │     │ ○ Schedule       │
│   [vip] [lead]   │     │ ┌──────────────┐ │     │   📅 Date picker │
│ ○ By stage       │     │ │ Hi {{name}}, │ │     │   🕐 Time picker │
│   [Customer]     │     │ │              │ │     │                  │
│ ○ Custom filter  │     │ │ Your order   │ │     │ Delay: 5-15s     │
│                  │     │ │ is ready!    │ │     │                  │
│ 📊 234 recipients│     │ └──────────────┘ │     │ ┌──────────────┐ │
│                  │     │ 📎 Attach media  │     │ │   Preview    │ │
│ [Next →]         │     │ [← Back] [Next →]│     │ │   234 msgs   │ │
└──────────────────┘     └──────────────────┘     │ └──────────────┘ │
                                                  │ [← Back] [Send] │
                                                  └──────────────────┘
```

---

## 4. State Management

### 4.1 Zustand Stores

```typescript
// === Auth Store ===
interface AuthStore {
  user: User | null;
  organization: Organization | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// === Chat Store ===
interface ChatStore {
  // Active state
  activeConversationId: string | null;
  activeConversation: Conversation | null;

  // Realtime
  typingUsers: Record<string, string[]>; // conversationId → userId[]
  onlineUsers: Set<string>;

  // Unread
  totalUnreadCount: number;

  // Actions
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  markAsRead: (conversationId: string) => void;
  incrementUnread: (conversationId: string) => void;
}

// === UI Store ===
interface UIStore {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Chat panels
  contactPanelOpen: boolean;
  toggleContactPanel: () => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: string) => void;

  // Command palette
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;

  // Mobile
  mobileView: 'list' | 'chat' | 'contact';
  setMobileView: (view: string) => void;
}

// === Notification Store ===
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  soundEnabled: boolean;

  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  toggleSound: () => void;
}
```

### 4.2 TanStack Query Keys

```typescript
export const queryKeys = {
  // Auth
  me: ['auth', 'me'],

  // Conversations
  conversations: (filters?: ConversationFilters) =>
    ['conversations', filters],
  conversation: (id: string) =>
    ['conversations', id],
  messages: (conversationId: string, page?: number) =>
    ['messages', conversationId, page],

  // Contacts
  contacts: (filters?: ContactFilters) =>
    ['contacts', filters],
  contact: (id: string) =>
    ['contacts', id],

  // Broadcasts
  broadcasts: (filters?: BroadcastFilters) =>
    ['broadcasts', filters],
  broadcast: (id: string) =>
    ['broadcasts', id],
  broadcastRecipients: (id: string) =>
    ['broadcasts', id, 'recipients'],

  // Templates
  templates: () => ['templates'],
  template: (id: string) => ['templates', id],

  // Analytics
  dashboard: (period: string) =>
    ['analytics', 'dashboard', period],
  messageVolume: (period: string) =>
    ['analytics', 'messages', period],
  agentPerformance: (period: string) =>
    ['analytics', 'agents', period],

  // Instances
  instances: () => ['instances'],
  instanceStatus: (id: string) =>
    ['instances', id, 'status'],

  // Tags
  tags: () => ['tags'],

  // Teams
  teams: () => ['teams'],
  users: () => ['users'],

  // Automations
  automations: () => ['automations'],

  // Notifications
  notifications: () => ['notifications'],

  // Settings
  settings: () => ['settings'],
  businessHours: () => ['settings', 'business-hours'],
  quickReplies: () => ['settings', 'quick-replies'],
};
```

---

## 5. Realtime (Socket.IO) Integration

### 5.1 Socket Provider

```typescript
// Lifecycle:
// 1. User login → connect socket with JWT
// 2. Socket authenticated → join org room
// 3. Open chat → join conversation room
// 4. Receive events → update stores + React Query cache
// 5. User logout → disconnect socket

// Connection flow:
const socket = io(BACKEND_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});
```

### 5.2 Event Handling

```typescript
// === Incoming Message ===
socket.on('chat:message', (data) => {
  // 1. Update React Query cache (add message to conversation)
  queryClient.setQueryData(
    queryKeys.messages(data.conversation_id),
    (old) => addMessageToCache(old, data.message)
  );

  // 2. Update conversation list (move to top, update preview)
  queryClient.invalidateQueries(queryKeys.conversations());

  // 3. If not active chat → increment unread
  if (chatStore.activeConversationId !== data.conversation_id) {
    chatStore.incrementUnread(data.conversation_id);
    // Play notification sound
    playNotificationSound();
  }

  // 4. Show browser notification (if tab not focused)
  if (document.hidden) {
    showBrowserNotification(data.message);
  }
});

// === Typing Indicator ===
socket.on('chat:typing', (data) => {
  chatStore.setTyping(data.conversation_id, data.user_id, true);
  // Auto-clear after 3 seconds
  setTimeout(() => {
    chatStore.setTyping(data.conversation_id, data.user_id, false);
  }, 3000);
});

// === Message Status Update ===
socket.on('message:status', (data) => {
  chatStore.updateMessageStatus(data.message_id, data.status);
});

// === Instance Status ===
socket.on('instance:status', (data) => {
  queryClient.invalidateQueries(queryKeys.instanceStatus(data.instance_id));
  if (data.status === 'DISCONNECTED') {
    toast.error('WhatsApp instance disconnected!');
  }
});
```

---

## 6. API Service Layer

### 6.1 Axios Instance

```typescript
// src/services/api.ts

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await authStore.getState().refreshToken();
        // Retry original request
        return api(error.config);
      } catch {
        authStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 7. Key UI/UX Patterns

### 7.1 Chat Message Input

```
┌──────────────────────────────────────────────────┐
│ 😊  📎  │ Type a message...              │ ⚡ ➤ │
└──────────────────────────────────────────────────┘
  │    │                                     │  │
  │    │                                     │  └─ Send button
  │    │                                     └─ Quick replies
  │    └─ Attachment menu:
  │       ┌────────────┐
  │       │ 📷 Image   │
  │       │ 📄 Document│
  │       │ 📍 Location│
  │       └────────────┘
  └─ Emoji picker (emoji-mart)

Keyboard shortcuts:
  Enter        → Send message
  Shift+Enter  → New line
  /            → Quick reply search
  Ctrl+E       → Toggle emoji picker
```

### 7.2 Conversation List Item

```
┌──────────────────────────────────────┐
│ 👤  John Doe              2m ago     │
│     ● Online                         │
│     "Hello, I need help with..."     │
│     [vip] [customer]        🔵 3     │ ← unread badge
└──────────────────────────────────────┘
```

### 7.3 Message Bubble

```
Incoming (left-aligned, gray bg):
┌──────────────────────────┐
│ Hello, I need help with  │
│ my order #12345          │
│                  10:30 AM│
└──────────────────────────┘

Outgoing (right-aligned, blue bg):
              ┌──────────────────────────┐
              │ Hi John! Let me check    │
              │ your order right away.   │
              │ 10:32 AM ✓✓             │ ← double tick = delivered
              └──────────────────────────┘

Internal Note (center, yellow bg, dashed border):
      ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
      │ 📝 Internal Note             │
      │ Customer is VIP, handle      │
      │ with priority — Agent Adi    │
      │                    10:35 AM  │
      └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

System Message (center, no bg):
         ── Chat assigned to Adi ──
              10:36 AM
```

### 7.4 Contact Detail Panel

```
┌──────────────────────────┐
│      👤                   │
│    John Doe               │
│    📱 +62 812-3456-789    │
│    📧 john@email.com      │
│    🏢 PT ABC - CEO        │
│                           │
│ Stage: [🟢 Customer ▾]   │
│                           │
│ Tags:                     │
│ [vip ×] [premium ×] [+]  │
│                           │
│ ─── Custom Fields ───     │
│ Company: PT ABC           │
│ Role: CEO                 │
│ City: Jakarta             │
│                           │
│ ─── Notes ───             │
│ VIP customer since 2025.  │
│ Prefers morning contact.  │
│ [Edit]                    │
│                           │
│ ─── Activity ───          │
│ • 10:30 Message received  │
│ • 10:28 Tag "vip" added   │
│ • 10:00 Chat assigned     │
│ • 09:55 Contact created   │
│                           │
│ ─── Quick Actions ───     │
│ [📞 Call] [📧 Email]      │
│ [🚫 Block] [🗑️ Delete]   │
└──────────────────────────┘
```

---

## 8. Responsive Design

### Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| **Mobile** | < 768px | Single column, bottom nav, stacked views |
| **Tablet** | 768-1024px | 2 columns (list + chat), contact panel as sheet |
| **Desktop** | 1024-1440px | 3 columns (list + chat + contact panel) |
| **Wide** | > 1440px | 3 columns with wider chat area |

### Mobile Chat Flow

```
Step 1: Conversation List     Step 2: Chat Panel        Step 3: Contact Info
┌──────────────────┐         ┌──────────────────┐      ┌──────────────────┐
│ 💬 Chats         │         │ ← John Doe  ⋮   │      │ ← Contact Info   │
│                  │ ──tap──▶│                  │──i──▶│                  │
│ ┌──────────────┐ │         │ Messages...      │      │ 👤 John Doe      │
│ │ John Doe     │ │         │                  │      │ 📱 628xxx        │
│ │ Hello!    2m │ │         │                  │      │ Stage: Customer  │
│ └──────────────┘ │         │                  │      │ Tags: [vip]      │
│ ┌──────────────┐ │         │ ┌──────────────┐ │      │                  │
│ │ Jane Smith   │ │         │ │ Type msg...  │ │      │ Notes...         │
│ │ Thanks!   5m │ │         │ └──────────────┘ │      │ Activity...      │
│ └──────────────┘ │         │                  │      │                  │
│                  │         │                  │      │                  │
├──────────────────┤         └──────────────────┘      └──────────────────┘
│ 📊 💬 👥 📢 ⚙️  │ ← Bottom nav (mobile only)
└──────────────────┘
```

---

## 9. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Open command palette (global search) |
| `Ctrl + /` | Toggle sidebar |
| `Ctrl + N` | New conversation / contact |
| `Ctrl + Enter` | Send message |
| `Escape` | Close panel / dialog |
| `↑ / ↓` | Navigate conversation list |
| `Ctrl + Shift + E` | Toggle emoji picker |
| `Ctrl + Shift + A` | Assign chat dialog |
| `Ctrl + Shift + R` | Resolve chat |
| `/` (in input) | Quick reply search |

---

## 10. Theme System

### Font: Inter

**Primary Font:** `Inter` (Google Fonts)  
**Fallback:** `system-ui, -apple-system, sans-serif`

**Kenapa Inter?**
- Dirancang khusus untuk UI/screen — bukan print
- Readability sangat tinggi di ukuran kecil (12-14px) — penting untuk CRM yang data-dense
- Dipakai oleh: Linear, Vercel, Notion, Figma, GitHub — semua top-tier SaaS
- Variable font — satu file, semua weight (300-700), loading cepat
- Fitur OpenType: tabular numbers (angka rata di tabel), case-sensitive punctuation
- Gratis, open source, di-maintain aktif

**Font Weights yang Dipakai:**

| Weight | Nama | Penggunaan |
|--------|------|------------|
| 400 | Regular | Body text, chat messages, form inputs |
| 500 | Medium | Labels, menu items, table headers |
| 600 | SemiBold | Page titles, card headers, buttons |
| 700 | Bold | KPI numbers, emphasis, headings |

**Font Sizes:**

| Token | Size | Usage |
|-------|------|-------|
| `text-xs` | 11px | Timestamps, badges, meta info |
| `text-sm` | 13px | Secondary text, table cells, sidebar items |
| `text-base` | 14px | Body text, chat messages, form inputs |
| `text-lg` | 16px | Card titles, section headers |
| `text-xl` | 18px | Page titles |
| `text-2xl` | 24px | Dashboard KPI numbers |
| `text-3xl` | 30px | Hero/landing numbers |

**Setup:**

```typescript
// next.config.js — menggunakan next/font (optimal loading)
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Di layout.tsx:
<body className={`${inter.variable} font-sans`}>
```

```css
/* tailwind.config.ts */
fontFamily: {
  sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
}
```

---

### Color Palette — Brand Colors (Solid)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   #B6FFFA        #98E4FF        #80B3FF        #687EFF         │
│   ██████████     ██████████     ██████████     ██████████       │
│   Lightest       Light          Medium         Primary          │
│   (Backgrounds)  (Hover/Cards)  (Accents)      (CTA/Buttons)   │
│                                                                 │
│   Cyan-Mint      Sky Blue       Blue           Indigo-Blue      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Color Roles:**

| Color | HEX | Role | Dipakai Untuk |
|-------|-----|------|---------------|
| **Primary** | `#687EFF` | Brand utama, CTA | Buttons, links, active tabs, send button, sidebar active |
| **Primary Hover** | `#5A6FE6` | Primary darker | Button hover state |
| **Secondary** | `#80B3FF` | Accent, secondary actions | Secondary buttons, icons, badges, selected items |
| **Tertiary** | `#98E4FF` | Highlights, cards | Card borders, hover backgrounds, tags, chat bubble outgoing |
| **Surface** | `#B6FFFA` | Light backgrounds | Page backgrounds, sidebar bg, table row hover, notification bg |
| **Surface Muted** | `#E8FFFE` | Even lighter (10% opacity) | Subtle backgrounds, alternating rows |

**Full CSS Variables:**

```css
:root {
  /* ===== BRAND COLORS (Solid) ===== */
  --color-primary:       #687EFF;    /* Indigo-Blue — main brand */
  --color-primary-hover: #5A6FE6;    /* Primary darkened 10% */
  --color-primary-light: #687EFF1A;  /* Primary 10% opacity — subtle bg */
  --color-secondary:     #80B3FF;    /* Blue — secondary actions */
  --color-tertiary:      #98E4FF;    /* Sky Blue — highlights */
  --color-surface:       #B6FFFA;    /* Cyan-Mint — light backgrounds */
  --color-surface-muted: #E8FFFE;    /* Surface even lighter */

  /* ===== NEUTRALS ===== */
  --color-background:    #FFFFFF;    /* Page background */
  --color-foreground:    #1A1A2E;    /* Primary text — dark navy */
  --color-text-secondary:#64748B;    /* Secondary text — slate */
  --color-text-muted:    #94A3B8;    /* Muted text — lighter slate */
  --color-border:        #E2E8F0;    /* Borders — light gray */
  --color-border-hover:  #CBD5E1;    /* Border hover — slightly darker */
  --color-card:          #FFFFFF;    /* Card background */
  --color-sidebar:       #F8FFFE;    /* Sidebar background — very light mint */
  --color-input:         #F8FAFC;    /* Input background */

  /* ===== SEMANTIC COLORS ===== */
  --color-success:       #22C55E;    /* Green — online, success */
  --color-error:         #EF4444;    /* Red — error, offline, destructive */
  --color-warning:       #F59E0B;    /* Amber — warning, away */
  --color-info:          #80B3FF;    /* Blue (secondary) — info */

  /* ===== CHAT SPECIFIC ===== */
  --color-chat-incoming: #F1F5F9;    /* Light gray — customer messages */
  --color-chat-outgoing: #687EFF;    /* Primary — agent messages */
  --color-chat-outgoing-text: #FFFFFF; /* White text on outgoing */
  --color-chat-note:     #FEF9C3;    /* Light yellow — internal notes */
  --color-chat-system:   #F1F5F9;    /* Light gray — system messages */

  /* ===== SIDEBAR ===== */
  --color-sidebar-bg:    #1A1A2E;    /* Dark navy sidebar */
  --color-sidebar-text:  #CBD5E1;    /* Light text on dark sidebar */
  --color-sidebar-active:#687EFF;    /* Primary — active menu item */
  --color-sidebar-hover: #2A2A4A;    /* Slightly lighter navy on hover */

  /* ===== FONT ===== */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
}
```

**Tailwind Config Extension:**

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#687EFF',
          hover: '#5A6FE6',
          light: '#687EFF1A',
          50: '#F0F2FF',
          100: '#E0E4FF',
          200: '#C1C9FF',
          300: '#A1AEFF',
          400: '#8293FF',
          500: '#687EFF',    // ← Main
          600: '#5A6FE6',
          700: '#4C5FCC',
          800: '#3E4FB3',
          900: '#303F99',
        },
        secondary: {
          DEFAULT: '#80B3FF',
          light: '#80B3FF1A',
          50: '#F0F7FF',
          500: '#80B3FF',    // ← Main
          600: '#6BA0E6',
          700: '#568DCC',
        },
        tertiary: {
          DEFAULT: '#98E4FF',
          light: '#98E4FF1A',
          50: '#F0FBFF',
          500: '#98E4FF',    // ← Main
          600: '#7DD4F0',
        },
        surface: {
          DEFAULT: '#B6FFFA',
          light: '#E8FFFE',
          50: '#F5FFFE',
          500: '#B6FFFA',    // ← Main
          600: '#9AE6E1',
        },
        sidebar: {
          DEFAULT: '#1A1A2E',
          hover: '#2A2A4A',
          active: '#687EFF',
          text: '#CBD5E1',
        },
        chat: {
          incoming: '#F1F5F9',
          outgoing: '#687EFF',
          note: '#FEF9C3',
          system: '#F1F5F9',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
};
```

---

### Color Usage Map (Per Component)

```
┌─────────────────────────────────────────────────────────────────┐
│ SIDEBAR (#1A1A2E dark navy)                                     │
│                                                                 │
│  Logo area                                                      │
│  ┌─────────────────┐                                            │
│  │ 🟢 CRM-DADI     │ ← Logo text: #FFFFFF                      │
│  └─────────────────┘                                            │
│                                                                 │
│  Menu items:                                                    │
│  ┌─────────────────┐                                            │
│  │ 💬 Chats        │ ← Active: bg #687EFF, text #FFFFFF        │
│  ├─────────────────┤                                            │
│  │ 👥 Contacts     │ ← Normal: text #CBD5E1                    │
│  ├─────────────────┤                                            │
│  │ 📢 Broadcasts   │ ← Hover: bg #2A2A4A                       │
│  └─────────────────┘                                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT (#FFFFFF)                                          │
│                                                                 │
│  Buttons:                                                       │
│  [Primary #687EFF] [Secondary outline #80B3FF] [Ghost]          │
│                                                                 │
│  Cards:                                                         │
│  ┌──────────────────────┐                                       │
│  │ bg: #FFFFFF           │ ← border: #E2E8F0                   │
│  │ hover: #F8FFFE        │ ← surface-light                     │
│  └──────────────────────┘                                       │
│                                                                 │
│  Tags/Badges:                                                   │
│  [VIP] bg: #B6FFFA text: #1A1A2E                               │
│  [Lead] bg: #98E4FF text: #1A1A2E                              │
│  [New] bg: #80B3FF text: #FFFFFF                               │
│  [Urgent] bg: #EF4444 text: #FFFFFF                            │
│                                                                 │
│  Chat bubbles:                                                  │
│  Incoming: bg #F1F5F9, text #1A1A2E                            │
│  Outgoing: bg #687EFF, text #FFFFFF                            │
│  Note:     bg #FEF9C3, text #1A1A2E, border dashed #F59E0B    │
│                                                                 │
│  Table row hover: bg #F8FFFE (surface-light)                   │
│  Selected row:    bg #B6FFFA (surface)                         │
│  Active tab:      border-bottom #687EFF                        │
│                                                                 │
│  KPI Cards:                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                          │
│  │ #687E│ │ #80B3│ │ #98E4│ │ #B6FF│ ← top border accent      │
│  │ 156  │ │  23  │ │ 4.2m │ │  89% │                          │
│  │ Total│ │ Open │ │ Avg  │ │ Rate │                          │
│  └──────┘ └──────┘ └──────┘ └──────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### Status Colors (Tetap Universal)

| Status | Color | HEX | Usage |
|--------|-------|-----|-------|
| Online/Connected | 🟢 Green | `#22C55E` | User online, WA connected |
| Offline/Error | 🔴 Red | `#EF4444` | User offline, WA disconnected, error |
| Away/Warning | 🟡 Amber | `#F59E0B` | User away, warming phase |
| Info/Active | 🔵 Primary | `#687EFF` | Unread badge, active state |
| Neutral | ⚪ Gray | `#94A3B8` | Default, inactive |

---

## 11. Performance Optimizations

| Technique | Implementation |
|-----------|---------------|
| **Virtualized Lists** | `@tanstack/react-virtual` for conversation list & message list |
| **Infinite Scroll** | Messages loaded in pages (50/page), scroll up to load more |
| **Optimistic Updates** | Send message → show immediately → confirm from server |
| **Image Lazy Loading** | Media in messages loaded on viewport enter |
| **Debounced Search** | 300ms debounce on search inputs |
| **Memoization** | `React.memo` on message bubbles, conversation items |
| **Code Splitting** | Dynamic imports for heavy pages (analytics, broadcast wizard) |
| **Prefetching** | Prefetch conversation messages on hover |
| **Service Worker** | Cache static assets, offline indicator |
| **Bundle Size** | Tree-shaking, dynamic imports, analyze with `@next/bundle-analyzer` |

---

## 12. Notification System

### In-App Notifications

```
┌──────────────────────────────────┐
│ 🔔 Notifications          Mark all│
├──────────────────────────────────┤
│ 🔵 New message from John Doe    │
│    "Hello, I need help..."      │
│    2 minutes ago                 │
├──────────────────────────────────┤
│ 🔵 Chat assigned to you         │
│    Jane Smith → You              │
│    5 minutes ago                 │
├──────────────────────────────────┤
│    Broadcast "Promo Feb" done    │
│    234 sent, 12 failed           │
│    1 hour ago                    │
├──────────────────────────────────┤
│ 🔴 WA Instance disconnected     │
│    "Customer Service" offline    │
│    2 hours ago                   │
└──────────────────────────────────┘
```

### Browser Notifications

```typescript
// Trigger when:
// 1. New incoming message (tab not focused)
// 2. Chat assigned to you
// 3. WA instance disconnected
// 4. Broadcast completed/failed

// With sound:
// - message.mp3 for new messages
// - notification.mp3 for other events
```

---

## 13. Error & Loading States

### Loading States

```
Skeleton loading for:
- Conversation list → animated gray bars
- Chat messages → bubble-shaped skeletons
- Contact table → table row skeletons
- Dashboard cards → card-shaped skeletons
- Analytics charts → chart-shaped skeletons
```

### Empty States

```
Each page has a custom empty state:
- No chats → illustration + "No conversations yet"
- No contacts → illustration + "Add your first contact"
- No broadcasts → illustration + "Create your first broadcast"
- No search results → "No results for 'keyword'"
- Chat not selected → "Select a conversation to start chatting"
```

### Error States

```
- API error → "Something went wrong" + [Retry] button
- Network error → "You're offline" banner (top)
- WA disconnected → "WhatsApp disconnected" banner + [Reconnect]
- 403 Forbidden → "You don't have permission"
- 404 Not Found → "Page not found" + [Go Home]
```

---

## 14. Security (Frontend)

| Measure | Implementation |
|---------|---------------|
| **Token Storage** | Access token in memory (Zustand), refresh token in httpOnly cookie |
| **Auto Logout** | On 401 after refresh fails |
| **Route Guards** | Middleware checks auth before rendering dashboard pages |
| **Role Guards** | Components hidden based on user role |
| **Input Sanitization** | DOMPurify for rendering user-generated content |
| **CSP Headers** | Content Security Policy via Next.js config |
| **CSRF** | SameSite cookie + custom header |
| **XSS** | React auto-escapes, no `dangerouslySetInnerHTML` |

---

## 15. Environment Variables (Frontend)

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CRM-DADI
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Features flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_AUTOMATIONS=true
NEXT_PUBLIC_ENABLE_BROADCASTS=true
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

---

## 16. Deployment

```
Frontend:
├── Vercel (recommended) — zero-config Next.js hosting
├── Docker + Nginx — self-hosted option
└── Netlify — alternative

Build:
  next build → static + server pages
  Output: .next/

Docker:
  FROM node:20-alpine
  WORKDIR /app
  COPY . .
  RUN npm ci && npm run build
  CMD ["npm", "start"]
  EXPOSE 3001
```

---

## 17. Development Workflow

```
1. Clone repo
2. cp .env.example .env.local
3. npm install
4. npm run dev          → http://localhost:3001
5. npm run build        → Production build
6. npm run test         → Run tests
7. npm run lint         → ESLint
8. npm run storybook    → Component preview (optional)
```

---

*End of Frontend Blueprint*
