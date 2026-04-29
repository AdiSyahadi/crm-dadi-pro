# CRM-DADI — Google Slides Portfolio Catalog
# Panduan Narasi untuk Screen Recording

---

## STRUKTUR SLIDE (Total: ~25 Slide)

---

### ═══════════════════════════════════════
### BAGIAN 1: PEMBUKA (Slide 1-3)
### ═══════════════════════════════════════

---

## SLIDE 1 — Cover
**Visual:** Logo/nama project besar, tagline, nama developer

**Teks di Slide:**
- **CRM-DADI**
- WhatsApp CRM & Sales Automation Platform
- Multi-Tenant SaaS — Production-Grade Architecture
- Dikembangkan oleh: [Nama Kamu]

**Narasi Screen Record:**
> "Halo, perkenalkan ini CRM-DADI — sebuah platform CRM berbasis WhatsApp yang 
> saya bangun sebagai SaaS multi-tenant. Project ini mencakup integrasi real-time 
> WhatsApp, pipeline penjualan, otomasi broadcast, dan sistem billing lengkap. 
> Mari saya tunjukkan fitur-fiturnya satu per satu."

---

## SLIDE 2 — Tech Stack
**Visual:** Icon grid teknologi (2 kolom: Frontend & Backend)

**Teks di Slide:**

| Frontend | Backend |
|----------|---------|
| Next.js 14 | Express.js 5 |
| TypeScript | TypeScript |
| TailwindCSS | Prisma ORM 7 |
| Zustand (State) | MySQL 8 |
| React Query v5 | Redis (Cache) |
| Socket.IO | BullMQ (Queue) |
| Recharts | JWT + Refresh Token |
| shadcn/ui | Zod Validation |

**Infra:** Docker Compose · 4 Container · CI/CD Ready

**Narasi:**
> "Tech stack yang saya gunakan sudah production-level. Frontend pakai Next.js 14 
> dengan TypeScript, state management pakai Zustand dan React Query, 
> UI pakai shadcn/ui dan TailwindCSS. Backend pakai Express 5, Prisma ORM, 
> MySQL, Redis untuk caching, dan BullMQ untuk background job. 
> Semuanya di-containerize pakai Docker."

---

## SLIDE 3 — Architecture Overview
**Visual:** Diagram arsitektur sederhana (bisa pakai diagram di slide)

**Komponen:**
```
[Browser] ←→ [Next.js Frontend :3002]
                    ↕ (API + WebSocket)
            [Express Backend :5000]
             ↕         ↕         ↕
         [MySQL]   [Redis]   [WA API]
                    ↕
            [BullMQ Workers]
```

**Fitur Arsitektur:**
- Multi-tenant (isolasi per organisasi)
- Real-time via Socket.IO
- 6 Background Workers
- Webhook dispatcher
- 4 tier subscription

**Narasi:**
> "Arsitekturnya dirancang sebagai multi-tenant SaaS. Setiap organisasi 
> terisolasi datanya. Frontend dan backend berkomunikasi lewat REST API 
> dan WebSocket untuk real-time. Ada 6 background worker yang jalan 
> di belakang untuk broadcast, scheduled message, SLA monitoring, 
> task reminder, deal monitoring, dan subscription management."

---

### ═══════════════════════════════════════
### BAGIAN 2: FITUR UTAMA (Slide 4-8)
### ═══════════════════════════════════════

---

## SLIDE 4 — Dashboard & Login
**Screen Record:** Tampilkan halaman login → masuk → dashboard

**Teks di Slide:**
- **Dashboard Overview**
- Ringkasan KPI: total kontak, pesan hari ini, deal aktif, revenue
- Role-based access (5 level): Super Admin, Owner, Admin, Supervisor, Agent
- JWT Authentication + Refresh Token

**Narasi:**
> "Setelah login, user masuk ke dashboard. Di sini terlihat ringkasan 
> seluruh aktivitas — jumlah kontak, pesan masuk, deal yang sedang berjalan, 
> dan total revenue. Sistem punya 5 level role: mulai dari Agent yang cuma 
> bisa chat, sampai Owner yang bisa atur billing dan tim."

**Demo Flow:**
1. Buka halaman login
2. Login dengan akun demo
3. Tunjukkan dashboard cards
4. Tunjukkan sidebar menu (scroll semua menu)

---

## SLIDE 5 — Real-time Chat
**Screen Record:** Buka halaman Chat, kirim pesan, terima balasan

**Teks di Slide:**
- **WhatsApp Chat Real-time**
- 12+ tipe pesan: teks, gambar, video, dokumen, lokasi, stiker, kontak, poll
- Status tracking: Sent → Delivered → Read (centang biru)
- Typing indicator & read receipts
- Auto-assign agent (Round Robin / Least Busy)
- Reply, reaction, forward support

**Narasi:**
> "Ini halaman chat utama. Semua pesan WhatsApp masuk secara real-time 
> lewat WebSocket. Kita bisa kirim berbagai tipe media — foto, video, 
> dokumen, bahkan lokasi. Setiap pesan punya status tracking dari sent 
> sampai read. Ada juga fitur auto-assign untuk mendistribusikan chat 
> ke agent secara otomatis."

**Demo Flow:**
1. Buka halaman Chat
2. Pilih satu conversation
3. Kirim pesan teks
4. Kirim gambar/dokumen
5. Tunjukkan status centang (sent/delivered/read)
6. Tunjukkan conversation list (unread badge)

---

## SLIDE 6 — Contact Management
**Screen Record:** Buka Contacts, tunjukkan tabel, lead score, duplikat

**Teks di Slide:**
- **Contact Management**
- Lifecycle stages: New → Lead → Qualified → Customer → VIP → Churned
- Lead Scoring otomatis (0-100): berdasarkan aktivitas, deal, recency
- Deteksi Duplikat & Merge kontak
- Tag/label management
- Timeline aktivitas per kontak
- Import/export kontak

**Narasi:**
> "Halaman kontak ini bukan cuma daftar nama. Setiap kontak punya lifecycle 
> stage dari New sampai VIP. Ada lead scoring otomatis yang menghitung skor 
> 0-100 berdasarkan aktivitas pesan, deal, dan kapan terakhir aktif. 
> Kita juga bisa deteksi kontak duplikat dan merge mereka supaya data tetap bersih."

**Demo Flow:**
1. Buka Contacts → tunjukkan tabel + kolom Skor
2. Klik tombol "Hitung Skor" (lead scoring)
3. Pindah ke tab "Duplikat" → tunjukkan grup duplikat
4. Klik salah satu kontak → tunjukkan detail/timeline

---

## SLIDE 7 — Sales Pipeline (Deals)
**Screen Record:** Buka Deals, tunjukkan kanban, drag deal, tutup WON

**Teks di Slide:**
- **Sales Pipeline & Deal Management**
- Kanban board: Kualifikasi → Proposal → Negosiasi → Penutupan
- Deal value, win probability, expected close date
- Rotten deal alert (indikator kuning untuk deal stagnan)
- Activity log per deal
- Tracked Links: kirim link, lacak klik, auto-close saat bayar
- Auto-generate kwitansi PDF & kirim via WhatsApp

**Narasi:**
> "Ini fitur pipeline penjualan. Tampilannya kanban board yang bisa 
> di-drag antar tahap. Setiap deal punya value, probabilitas menang, 
> dan tanggal target closing. Deal yang stagnan otomatis ditandai kuning 
> sebagai rotten deal. Yang unik, kita bisa kirim tracked link ke customer, 
> kalau mereka bayar, deal otomatis closed dan kwitansi PDF ter-generate 
> lalu dikirim lewat WhatsApp."

**Demo Flow:**
1. Buka Deals → tunjukkan kanban view
2. Drag satu deal dari Kualifikasi ke Proposal
3. Klik satu deal → tunjukkan detail dialog (tabs: Detail, Links, Kwitansi)
4. Switch ke list view → tunjukkan deal yang rotten (kuning)
5. Tunjukkan satu deal WON

---

## SLIDE 8 — Sales Forecasting
**Screen Record:** Buka halaman Forecasting

**Teks di Slide:**
- **Sales Forecasting**
- Pipeline tertimbang (value × probabilitas)
- Proyeksi revenue 30 hari ke depan
- Win rate trend: 30, 60, 90 hari
- Revenue aktual vs proyeksi
- Daftar deal segera closing

**Narasi:**
> "Halaman forecasting ini menampilkan proyeksi penjualan. Pipeline value 
> dihitung berdasarkan bobot probabilitas di setiap tahap. Win rate 
> ditampilkan untuk 30, 60, dan 90 hari terakhir. Di bawah ada daftar 
> deal yang segera closing dalam 30 hari ke depan."

**Demo Flow:**
1. Buka Forecasting
2. Tunjukkan 4 KPI cards
3. Tunjukkan chart pipeline per tahap
4. Scroll ke tabel closing soon

---

### ═══════════════════════════════════════
### BAGIAN 3: MARKETING & OTOMASI (Slide 9-12)
### ═══════════════════════════════════════

---

## SLIDE 9 — Broadcast
**Screen Record:** Buka Broadcasts, buat campaign baru

**Teks di Slide:**
- **Broadcast Campaign**
- Kirim pesan massal ke ratusan kontak
- Filter target: tag, label, lifecycle stage
- Support media: gambar, video, dokumen
- Statistik real-time: terkirim, delivered, dibaca
- Rate limiting & queue management (BullMQ)
- Kuota per plan (Starter: 5/bulan, Pro: 30/bulan)

**Narasi:**
> "Fitur broadcast untuk kirim pesan massal. Kita bisa pilih target 
> berdasarkan tag atau label. Pengiriman diproses di background 
> lewat queue supaya tidak overload. Statistik pengiriman bisa 
> dipantau real-time — berapa yang terkirim, delivered, dan dibaca."

**Demo Flow:**
1. Buka Broadcasts → tunjukkan list campaign
2. Klik "Buat Broadcast" → tunjukkan form (pilih kontak, tulis pesan)
3. Tunjukkan salah satu broadcast → statistik delivery

---

## SLIDE 10 — Scheduled Messages & Templates
**Screen Record:** Buka Scheduled Messages dan Templates

**Teks di Slide:**
- **Scheduled Messages**
- Penjadwalan pesan otomatis (sekali kirim / recurring)
- Cron expression untuk jadwal kompleks
- Support timezone
- Target berdasarkan tag

- **Message Templates**
- Library template siap pakai
- Variable replacement ({{nama}}, {{nomor}})
- Kategori & quick search

**Narasi:**
> "Scheduled messages memungkinkan penjadwalan pesan — bisa satu kali 
> atau berulang dengan cron expression. Misalnya, kirim reminder setiap 
> Senin jam 9 pagi. Templates menyimpan pesan yang sering dipakai 
> supaya agent tidak perlu ketik ulang."

**Demo Flow:**
1. Buka Scheduled Messages → tunjukkan list
2. Tunjukkan form jadwal (datetime picker, cron)
3. Pindah ke Templates → tunjukkan list template
4. Pindah ke Quick Reply → tunjukkan shortcut

---

## SLIDE 11 — Chatbot & Auto-Response
**Screen Record:** Buka Chatbot, tunjukkan rules

**Teks di Slide:**
- **Chatbot & Auto-Response Engine**
- Trigger types: keyword match, first message, outside business hours
- Action: reply teks, assign agent, set tag
- Business hours configuration
- Cooldown period (anti-spam)
- Fallback response

**Narasi:**
> "Sistem chatbot bisa dikonfigurasi tanpa coding. Kita set trigger — 
> misalnya kalau customer kirim keyword 'harga', otomatis balas 
> dengan daftar harga. Ada juga auto-response untuk pesan pertama 
> dan di luar jam kerja."

**Demo Flow:**
1. Buka Chatbot → tunjukkan list rules
2. Tunjukkan detail satu rule (trigger + action)
3. Buka Settings → tunjukkan business hours config

---

## SLIDE 12 — Task & Reminder
**Screen Record:** Buka Tasks, buat task, tunjukkan reminder

**Teks di Slide:**
- **Task Management**
- Buat tugas terkait deal, kontak, atau conversation
- Assign ke anggota tim
- Priority: Low, Medium, High, Urgent
- Reminder otomatis (1 menit interval check)
- Summary cards: todo, in progress, done, overdue

**Narasi:**
> "Fitur task management untuk tracking pekerjaan tim. Setiap task bisa 
> dikaitkan ke deal atau kontak. Ada pengingat otomatis yang dicek setiap 
> menit — kalau sudah mendekati deadline, notifikasi dikirim ke agent."

**Demo Flow:**
1. Buka Tasks → tunjukkan summary cards
2. Klik "Buat Tugas" → isi form (judul, assign, deal, reminder)
3. Tunjukkan inline status change di tabel

---

### ═══════════════════════════════════════
### BAGIAN 4: ANALYTICS & SERVICE (Slide 13-15)
### ═══════════════════════════════════════

---

## SLIDE 13 — Analytics
**Screen Record:** Buka Analytics, scroll chart

**Teks di Slide:**
- **Analytics Dashboard**
- Volume pesan (30 hari): incoming vs outgoing area chart
- Pertumbuhan kontak: bar chart
- Performa agent: response time, chat handled, rating
- Export data ke CSV

**Narasi:**
> "Halaman analitik menampilkan tren volume pesan 30 hari terakhir, 
> pertumbuhan kontak baru, dan performa setiap agent — berapa chat 
> yang ditangani, waktu respons rata-rata, dan rating mereka."

**Demo Flow:**
1. Buka Analytics
2. Tunjukkan area chart volume pesan
3. Scroll ke bar chart kontak
4. Tunjukkan agent performance section

---

## SLIDE 14 — CSAT & SLA
**Screen Record:** Buka CSAT dan SLA

**Teks di Slide:**
- **CSAT (Customer Satisfaction)**
- Survey otomatis setelah conversation selesai
- Rating 1-5 bintang + feedback teks
- Laporan rata-rata CSAT per agent

- **SLA (Service Level Agreement)**
- Target first response time & resolution time
- Warning otomatis saat mendekati breach
- Escalation untuk breach
- Hari libur dikecualikan dari perhitungan SLA

**Narasi:**
> "CSAT mengukur kepuasan customer lewat survey otomatis setelah chat selesai. 
> SLA memastikan tim merespons dalam waktu yang ditentukan. Kalau mendekati 
> batas waktu, sistem kirim warning. Kalau sudah breach, otomatis eskalasi. 
> Hari libur otomatis dikecualikan dari perhitungan."

**Demo Flow:**
1. Buka CSAT → tunjukkan list rating + rata-rata
2. Buka SLA → tunjukkan settings (first response, resolution time)

---

## SLIDE 15 — Kwitansi / Receipt
**Screen Record:** Buka Receipts, buat kwitansi, preview PDF

**Teks di Slide:**
- **Kwitansi / Invoice Generator**
- 5 tipe: Invoice, Donasi, Zakat, Layanan, Custom
- Auto-generate PDF profesional
- Kirim langsung via WhatsApp
- White-label: logo, warna, tanda tangan
- Auto-generate saat payment callback

**Narasi:**
> "Fitur kwitansi bisa generate PDF profesional untuk berbagai kebutuhan — 
> invoice, donasi, zakat, layanan. Tampilannya bisa di-custom dengan logo 
> dan warna organisasi. Kwitansi bisa langsung dikirim ke customer lewat WhatsApp. 
> Yang lebih keren, kalau customer bayar lewat tracked link, kwitansi otomatis 
> ter-generate dan terkirim."

**Demo Flow:**
1. Buka Receipts → tunjukkan list + summary cards
2. Klik "Buat Kwitansi" → isi form (items, qty, harga)
3. Preview PDF hasil generate
4. Buka Settings → tab Kwitansi → tunjukkan branding config

---

### ═══════════════════════════════════════
### BAGIAN 5: ADMINISTRASI (Slide 16-19)
### ═══════════════════════════════════════

---

## SLIDE 16 — Team Management
**Screen Record:** Buka Team, tunjukkan anggota + roles

**Teks di Slide:**
- **Team Management**
- 5 Roles: Owner, Admin, Supervisor, Agent, (Super Admin)
- Invite via email
- Auto-assignment strategy: Round Robin, Least Busy
- Per-agent queue & workload tracking

**Narasi:**
> "Manajemen tim mendukung 5 level role. Owner bisa invite anggota baru 
> dan set strategi auto-assignment — Round Robin untuk distribusi merata, 
> atau Least Busy untuk assign ke agent yang paling sedikit chatnya."

---

## SLIDE 17 — WhatsApp Instances
**Screen Record:** Buka Instances, tunjukkan QR scan

**Teks di Slide:**
- **WhatsApp Instance Management**
- Scan QR untuk connect device
- Multi-instance support (sesuai plan)
- Status monitoring (connected/disconnected)
- Daily message limit per instance
- Webhook configuration per instance

**Narasi:**
> "Setiap organisasi bisa punya multiple WhatsApp instance sesuai plan mereka. 
> Koneksi dilakukan lewat QR scan. Status setiap instance dimonitor real-time — 
> kalau disconnect, admin langsung dapat notifikasi."

---

## SLIDE 18 — Settings & Webhooks
**Screen Record:** Buka Settings, scroll semua tab

**Teks di Slide:**
- **Organization Settings**
- Profil organisasi
- Business hours & timezone
- Auto-response rules
- Webhook integration (custom URL + secret)
- Rotten deal threshold
- Receipt branding
- Notification preferences

**Narasi:**
> "Halaman settings mencakup semua konfigurasi organisasi. Yang menarik 
> adalah webhook integration — organisasi bisa set URL webhook sendiri 
> untuk menerima event seperti pesan baru, deal won, atau ticket created. 
> Semua webhook ditandatangani dengan HMAC untuk keamanan."

---

## SLIDE 19 — Billing & Plans
**Screen Record:** Buka Billing, tunjukkan plan comparison

**Teks di Slide:**
- **Subscription & Billing**
- 4 Tier: Free, Starter, Professional, Enterprise
- Feature gating per plan (20+ feature flags)
- Quota enforcement (contacts, deals, broadcasts, storage)
- Invoice auto-generation
- Payment: bank transfer + Midtrans gateway
- Admin payment verification workflow

**Narasi:**
> "Sistem billing mendukung 4 tier subscription. Setiap fitur dan kuota 
> dikontrol per plan — misalnya free plan cuma 100 kontak dan 1 instance, 
> sementara enterprise unlimited. Pembayaran bisa lewat transfer bank 
> atau payment gateway Midtrans."

---

### ═══════════════════════════════════════
### BAGIAN 6: ENTERPRISE FEATURES (Slide 20-22)
### ═══════════════════════════════════════

---

## SLIDE 20 — Multi-Tenant & Security
**Visual:** Diagram isolasi data + security layers

**Teks di Slide:**
- **Enterprise Architecture**
- ✅ Multi-tenant: data isolation per organisasi
- ✅ JWT + Refresh Token authentication
- ✅ HMAC webhook signature verification
- ✅ Rate limiting per endpoint
- ✅ Zod runtime input validation
- ✅ Activity logging & audit trail
- ✅ Role-based access control (RBAC) — 5 levels

**Narasi:**
> "Dari sisi arsitektur, project ini dirancang enterprise-grade. Setiap 
> organisasi datanya terisolasi total. Autentikasi pakai JWT dengan 
> refresh token rotation. Semua input divalidasi pakai Zod. 
> Ada rate limiting, audit trail, dan role-based access 5 level."

---

## SLIDE 21 — Real-time & Background Processing
**Visual:** Diagram Socket.IO + Worker architecture

**Teks di Slide:**
- **Real-time Engine (Socket.IO)**
- Live message updates per conversation room
- Typing indicators
- Delivery & read status
- Broadcast progress tracking
- Online presence

- **Background Workers (6 processors)**
- Broadcast queue (BullMQ)
- Scheduled message executor
- SLA watchdog (5 min interval)
- Task reminder (1 min interval)
- Rotten deal checker (hourly)
- Subscription expiry handler

**Narasi:**
> "Real-time communication pakai Socket.IO dengan room-based architecture. 
> Setiap conversation punya room sendiri. Di background, ada 6 worker 
> yang jalan terus-menerus — termasuk SLA watchdog yang cek setiap 5 menit, 
> task reminder setiap 1 menit, dan broadcast queue yang proses pengiriman 
> massal supaya tidak overload WhatsApp API."

---

## SLIDE 22 — Database Design
**Visual:** Simplified ERD diagram (bisa screenshot dari ERD tool)

**Teks di Slide:**
- **25+ Database Models**
- Relational design with Prisma ORM
- Optimized indexes for multi-tenant queries
- Cascade delete for data cleanup
- JSON fields for flexible config (settings, metadata)
- UUID primary keys
- Audit timestamps (created_at, updated_at)

**Narasi:**
> "Database terdiri dari 25+ model yang saling terelasi. Setiap tabel 
> punya organization_id dengan index untuk query multi-tenant yang cepat. 
> Schema di-manage pakai Prisma ORM dengan type-safe query."

---

### ═══════════════════════════════════════
### BAGIAN 7: PENUTUP (Slide 23-25)
### ═══════════════════════════════════════

---

## SLIDE 23 — Project Stats
**Visual:** Angka-angka besar (dashboard style)

**Teks di Slide:**
- **Project in Numbers**
- 286+ patches (tracked improvements)
- 120+ files per commit
- 25+ database models
- 35+ API endpoints groups
- 19+ frontend pages
- 40+ services
- 6 background workers
- 4 subscription tiers
- 20+ feature flags
- 12+ message types

**Narasi:**
> "Secara keseluruhan, project ini sudah melewati 286 patch dengan tracking 
> yang ketat. Ada 25+ model database, 35+ group API endpoint, 19+ halaman 
> frontend, dan 40+ service di backend. Setiap perubahan didokumentasikan 
> dan diverifikasi sebelum deploy."

---

## SLIDE 24 — Development Process
**Visual:** Screenshot CSV tracking / terminal

**Teks di Slide:**
- **Engineering Process**
- Strict patch-based workflow (1 patch = 1 objective)
- Mandatory verification before deploy
- CSV-based changelog tracking
- Docker containerization (4 containers)
- Hot-reload development
- Incremental deployment

**Narasi:**
> "Proses development mengikuti strict protocol — setiap perubahan 
> adalah 1 patch dengan 1 objektif. Setiap patch diverifikasi build-nya, 
> dicek regresinya, dan dicatat di CSV. Deployment menggunakan Docker 
> dengan 4 container yang bisa di-deploy secara incremental."

---

## SLIDE 25 — Closing / Contact
**Visual:** Clean closing slide

**Teks di Slide:**
- **CRM-DADI**
- Full-Stack WhatsApp CRM — Production SaaS Architecture
- [Nama Kamu]
- [GitHub URL]
- [LinkedIn / Portfolio URL]
- [Email]

**Narasi:**
> "Itulah CRM-DADI — sebuah WhatsApp CRM yang saya bangun dari nol 
> dengan arsitektur production-grade. Terima kasih sudah melihat, 
> silakan hubungi saya untuk diskusi lebih lanjut."

---

## TIPS SCREEN RECORDING

1. **Resolusi:** Record di 1920x1080
2. **Browser:** Pakai Chrome, zoom 90% supaya UI terlihat penuh
3. **Urutan demo:** Ikuti slide order di atas
4. **Narasi:** Bicara pelan dan jelas, pause di setiap transisi
5. **Speed:** Kalau scroll/navigasi, jangan terlalu cepat
6. **Data dummy:** Pastikan ada data sample yang menarik (kontak, deal, chat)
7. **Durasi target:** 8-12 menit total (30-40 detik per slide)
8. **Musik:** Tambahkan background music pelan di editing

## TIPS GOOGLE SLIDES DESIGN

1. **Color palette:** Pakai 2-3 warna utama (biru #1a56db + abu-abu + putih)
2. **Font:** Inter atau Poppins (clean & modern)
3. **Screenshot:** Crop rapi, tambahkan drop shadow
4. **Layout:** Jangan terlalu ramai — max 5-6 bullet per slide
5. **Transisi:** Pakai "Fade" atau "Slide from right" yang simpel
