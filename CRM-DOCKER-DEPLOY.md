# CRM-DADI — Docker Deployment Guide

> **CRM SaaS dengan integrasi WhatsApp API** — Panduan lengkap deploy menggunakan Docker.
> Berjalan berdampingan dengan WAAPI-DADI (WhatsApp API milik teman).

---

## Daftar Isi

1. [Arsitektur & Stack](#arsitektur--stack)
2. [Prasyarat](#prasyarat)
3. [Struktur File Docker](#struktur-file-docker)
4. [Langkah Deploy](#langkah-deploy)
5. [Konfigurasi Environment](#konfigurasi-environment)
6. [Port Mapping](#port-mapping)
7. [Integrasi dengan WAAPI-DADI](#integrasi-dengan-waapi-dadi)
8. [Migrasi Data dari XAMPP](#migrasi-data-dari-xampp)
9. [Perintah Docker Penting](#perintah-docker-penting)
10. [Deploy di VPS / Server Production](#deploy-di-vps--server-production)
11. [Troubleshooting](#troubleshooting)
12. [FAQ](#faq)

---

## Arsitektur & Stack

```
┌──────────────────────────────────────────────────────────────┐
│                  Docker Network (crm-network)                │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐  │
│  │  MySQL   │  │  Redis   │  │      CRM Backend          │  │
│  │  8.0     │  │  7-alpine│  │  Express 5 + Prisma 7     │  │
│  │  :3308   │  │  :6380   │  │  Socket.IO + BullMQ       │  │
│  │          │  │          │  │  :5000                     │  │
│  └────┬─────┘  └────┬─────┘  └────────────┬──────────────┘  │
│       │              │                     │                 │
│       └──────────────┴─────────────────────┘                 │
│                              │                               │
│                    ┌─────────┴──────────┐                    │
│                    │   CRM Frontend     │                    │
│                    │   Next.js 14       │                    │
│                    │   :3002            │                    │
│                    └────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
                              │
                    (host.docker.internal)
                              │
┌──────────────────────────────────────────────────────────────┐
│              WAAPI-DADI (Docker terpisah)                     │
│                                                              │
│  waapi-backend  :3001   (WhatsApp Baileys API)               │
│  waapi-frontend :3000   (WA API Dashboard)                   │
│  waapi-mysql    :3307                                        │
│  waapi-redis    :6379                                        │
└──────────────────────────────────────────────────────────────┘
```

| Service          | Image / Build    | Deskripsi                                     |
| ---------------- | ---------------- | --------------------------------------------- |
| **MySQL**        | `mysql:8.0`      | Database CRM (multi-tenant)                   |
| **Redis**        | `redis:7-alpine` | Queue BullMQ + cache                          |
| **CRM Backend**  | `./backend`      | Express 5, Prisma 7, Socket.IO, TypeScript    |
| **CRM Frontend** | `./frontend`     | Next.js 14 (App Router, standalone mode)      |

---

## Prasyarat

| Software             | Minimum Version | Keterangan                                |
| -------------------- | --------------- | ----------------------------------------- |
| **Docker Desktop**   | v4.x+           | https://www.docker.com/products/docker-desktop |
| **Docker Compose**   | v2.x+ (bawaan)  | Sudah include dalam Docker Desktop        |
| **WAAPI-DADI**       | Running         | WhatsApp API harus sudah deploy & running |

> **Catatan Windows:** Pastikan Docker Desktop sudah running (ikon Docker di system tray). WSL2 backend direkomendasikan.

### Disk & RAM

- **RAM:** 2 GB minimum (4 GB direkomendasikan, karena WAAPI-DADI juga jalan)
- **Disk:** 2 GB untuk images + data
- **CPU:** 2 core minimum

---

## Struktur File Docker

```
CRM-DADI/
├── docker-compose.yml          # Orchestrator semua service CRM
├── .env.docker                 # Template environment variables
├── .env                        # Environment aktif (copy dari .env.docker)
│
├── backend/
│   ├── Dockerfile              # Multi-stage build (deps → build → production)
│   ├── .dockerignore           # Exclude node_modules, dist, .env, dll
│   ├── docker-entrypoint.sh    # Startup script (prisma db push + node server)
│   ├── prisma/
│   │   └── schema.prisma       # Database schema (22 tabel)
│   └── src/                    # Source code TypeScript
│
└── frontend/
    ├── Dockerfile              # Multi-stage build (deps → build → standalone)
    ├── .dockerignore           # Exclude node_modules, .next, .env
    └── src/                    # Source code Next.js
```

---

## Langkah Deploy

### Step 1: Clone Repository

```bash
git clone https://github.com/AdiSyahadi/CRM_DADI.git
cd CRM_DADI
```

### Step 2: Buat File `.env`

```bash
# Linux / macOS
cp .env.docker .env

# Windows (PowerShell)
Copy-Item .env.docker .env
```

### Step 3: Edit `.env` (WAJIB)

Buka file `.env`, lalu ganti minimal value berikut:

```dotenv
# WAJIB DIGANTI! Generate secret:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=random_string_64_byte_anda
JWT_REFRESH_SECRET=random_string_64_byte_lain

# Ganti password MySQL production
MYSQL_ROOT_PASSWORD=password_kuat_anda

# WA API credentials (dari WAAPI-DADI)
WA_API_KEY=wa_xxxxxxxxxxxxx
WA_ORGANIZATION_ID=uuid-organization-id
```

> **Tips generate JWT secret:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```
> Jalankan 2x untuk mendapat 2 secret berbeda.

### Step 4: Pastikan WAAPI-DADI Sudah Running

```bash
# Cek container WA API
docker ps --filter "name=waapi-"

# Output yang diharapkan:
# waapi-backend    Up (port 3001)
# waapi-frontend   Up (port 3000)
# waapi-mysql      Up (healthy)
# waapi-redis      Up (healthy)
```

> **Penting:** CRM backend berkomunikasi dengan WA API via `host.docker.internal:3001`. WAAPI-DADI **harus** sudah running sebelum CRM digunakan.

### Step 5: Build & Start CRM

```bash
docker compose up -d --build
```

Proses pertama kali membutuhkan waktu **5-10 menit** (download images, npm install, build TypeScript & Next.js).

**Yang terjadi saat startup:**
1. MySQL & Redis start dan menunggu healthy
2. Backend build: `npm ci` → `prisma generate` → `tsc` → production image
3. Frontend build: `npm ci` → `next build` (standalone) → production image
4. Backend container start: `prisma db push` (sync schema) → `node dist/server.js`
5. Frontend container start: `node server.js` (Next.js standalone)

### Step 6: Verifikasi

```bash
# Cek semua container running
docker ps -a --filter "name=crm-"

# Output yang diharapkan:
# crm-mysql      Up (healthy)    0.0.0.0:3308->3306/tcp
# crm-redis      Up (healthy)    0.0.0.0:6380->6379/tcp
# crm-backend    Up              0.0.0.0:5000->5000/tcp
# crm-frontend   Up              0.0.0.0:3002->3002/tcp
```

```bash
# Cek backend logs
docker logs crm-backend --tail 20
```

Jika sukses, Anda akan melihat:
```
✅ Database schema synced
🚀 Starting CRM-DADI backend...
✅ Redis connected
✅ Database connected (MySQL via XAMPP)
✅ Socket.IO initialized
✅ Broadcast worker started
📡 Sync polling started (every 120s)

🚀 CRM-DADI Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server:    http://localhost:5000
🌍 Env:       production
📦 Redis:     redis://redis:6379
🔌 Socket.IO: Ready
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 7: Buka Aplikasi

| Service      | URL                          |
| ------------ | ---------------------------- |
| CRM Frontend | http://localhost:3002         |
| CRM Backend  | http://localhost:5000         |
| CRM API      | http://localhost:5000/api     |

---

## Konfigurasi Environment

### File `.env` — Referensi Lengkap

```dotenv
# ============================
# MySQL
# ============================
MYSQL_ROOT_PASSWORD=root          # Password root MySQL
MYSQL_DATABASE=crm_dadi           # Nama database
MYSQL_PORT=3308                   # Port MySQL di host (3308 agar tidak bentrok dengan WAAPI)

# ============================
# Redis
# ============================
REDIS_PORT=6380                   # Port Redis di host (6380 agar tidak bentrok dengan WAAPI)

# ============================
# Backend
# ============================
NODE_ENV=production
BACKEND_PORT=5000                 # Port backend di host
APP_URL=http://localhost:5000     # URL backend
FRONTEND_URL=http://localhost:3002 # URL frontend

# JWT - WAJIB DIGANTI!
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# WA API Integration
WA_API_BASE_URL=http://host.docker.internal:3001  # WA API di host machine
WA_API_KEY=                       # API key dari WAAPI-DADI
WA_ORGANIZATION_ID=               # Organization ID dari WAAPI-DADI

# Webhook
WEBHOOK_SECRET=                   # Secret untuk validasi webhook dari WA API

# CORS
CORS_ORIGIN=http://localhost:3002 # Sesuaikan dengan domain frontend

# ============================
# Frontend
# ============================
FRONTEND_PORT=3002
NEXT_PUBLIC_API_URL=http://localhost:5000/api   # Backend API URL (dari browser)
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000     # Socket.IO URL (dari browser)
```

### Variable Penting untuk Production

| Variable                | Default                          | Production                    |
| ----------------------- | -------------------------------- | ----------------------------- |
| `MYSQL_ROOT_PASSWORD`   | `root`                           | Password kuat!                |
| `JWT_SECRET`            | (template)                       | Random 64 byte hex            |
| `JWT_REFRESH_SECRET`    | (template)                       | Random 64 byte hex (beda)     |
| `CORS_ORIGIN`           | `http://localhost:3002`          | `https://crm.yourdomain.com` |
| `NEXT_PUBLIC_API_URL`   | `http://localhost:5000/api`      | `https://api-crm.yourdomain.com/api` |
| `NEXT_PUBLIC_SOCKET_URL`| `http://localhost:5000`          | `https://api-crm.yourdomain.com` |
| `APP_URL`               | `http://localhost:5000`          | `https://api-crm.yourdomain.com` |
| `FRONTEND_URL`          | `http://localhost:3002`          | `https://crm.yourdomain.com` |
| `WA_API_BASE_URL`       | `http://host.docker.internal:3001` | `http://waapi-backend:3001` (jika same network) |

---

## Port Mapping

### CRM-DADI Ports

| Service      | Container Port | Host Port (default) | Konfigurasi      |
| ------------ | -------------- | ------------------- | ---------------- |
| MySQL        | 3306           | **3308**            | `MYSQL_PORT`     |
| Redis        | 6379           | **6380**            | `REDIS_PORT`     |
| Backend      | 5000           | **5000**            | `BACKEND_PORT`   |
| Frontend     | 3002           | **3002**            | `FRONTEND_PORT`  |

### WAAPI-DADI Ports (sudah terpakai)

| Service      | Host Port |
| ------------ | --------- |
| WA Backend   | 3001      |
| WA Frontend  | 3000      |
| WA MySQL     | 3307      |
| WA Redis     | 6379      |

> **Port dipilih agar tidak bentrok** antara CRM-DADI dan WAAPI-DADI yang jalan di mesin yang sama.

---

## Integrasi dengan WAAPI-DADI

CRM-DADI berkomunikasi dengan WhatsApp API (WAAPI-DADI) melalui:

### 1. REST API (CRM → WA API)

CRM backend mengirim request ke WA API untuk:
- Mengirim pesan WhatsApp
- Mengambil history pesan
- Mengelola instance WhatsApp
- Broadcast messaging

```
CRM Backend (Docker) → host.docker.internal:3001 → WAAPI Backend (Docker)
```

### 2. Webhook (WA API → CRM)

WA API mengirim event ke CRM saat ada pesan masuk, status berubah, dll:

```
WAAPI Backend → http://host.docker.internal:5000/api/webhook/wa → CRM Backend
```

### Konfigurasi Webhook di WA API

Setelah CRM running, set webhook URL di WA API dashboard (http://localhost:3000):

1. Buka WA API Dashboard → Settings → Webhook
2. Set URL: `http://host.docker.internal:5000/api/webhook/wa`
3. Events: `message.received`, `message.sent`, `message.delivered`, `message.read`

### Konfigurasi di `.env`

```dotenv
WA_API_BASE_URL=http://host.docker.internal:3001
WA_API_KEY=wa_xxxxxxxxxxxxx          # Dari WA API dashboard
WA_ORGANIZATION_ID=uuid-org-id       # Dari WA API
```

---

## Migrasi Data dari XAMPP

Jika sebelumnya CRM berjalan dengan MySQL XAMPP lokal, ikuti langkah berikut untuk migrasi data ke Docker MySQL:

### Step 1: Export dari XAMPP MySQL

```powershell
# Windows (PowerShell) — XAMPP MySQL biasanya di C:\xampp\mysql\bin
& "C:\xampp\mysql\bin\mysqldump.exe" -u root crm_dadi --result-file="backup_xampp.sql"
```

```bash
# Linux / macOS
mysqldump -u root crm_dadi > backup_xampp.sql
```

### Step 2: Import ke Docker MySQL

```powershell
# Windows (PowerShell)
Get-Content backup_xampp.sql | docker exec -i crm-mysql mysql -u root -proot crm_dadi
```

```bash
# Linux / macOS
docker exec -i crm-mysql mysql -u root -proot crm_dadi < backup_xampp.sql
```

### Step 3: Verifikasi Data

```bash
docker exec crm-mysql mysql -u root -proot crm_dadi -e "
  SELECT 'contacts' as tbl, COUNT(*) as cnt FROM contacts
  UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
  UNION ALL SELECT 'messages', COUNT(*) FROM messages
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'organizations', COUNT(*) FROM organizations;
"
```

### Step 4: Restart Backend

```bash
docker compose restart backend
```

### Step 5: Cleanup

```powershell
# Hapus file backup
Remove-Item backup_xampp.sql
```

> **Catatan:** Setelah migrasi, login dengan akun yang sama seperti sebelumnya. Semua data chat, kontak, dan percakapan akan tersedia.

---

## Perintah Docker Penting

### Lifecycle

```bash
# Build & start semua service
docker compose up -d --build

# Start (tanpa rebuild)
docker compose up -d

# Stop semua service (data tetap)
docker compose down

# Stop & HAPUS semua data (reset total)
docker compose down -v

# Restart satu service
docker compose restart backend
docker compose restart frontend
```

### Monitoring

```bash
# Status semua CRM container
docker ps -a --filter "name=crm-"

# Lihat logs real-time
docker compose logs -f

# Logs satu service saja
docker logs crm-backend --tail 50
docker logs crm-frontend --tail 50

# Logs follow (real-time)
docker logs -f crm-backend
```

### Database

```bash
# Masuk MySQL CLI
docker exec -it crm-mysql mysql -u root -proot crm_dadi

# Backup database
docker exec crm-mysql mysqldump -u root -proot crm_dadi > backup.sql

# Restore database (Linux/Mac)
docker exec -i crm-mysql mysql -u root -proot crm_dadi < backup.sql

# Restore database (Windows PowerShell)
Get-Content backup.sql | docker exec -i crm-mysql mysql -u root -proot crm_dadi
```

### Rebuild Satu Service

```bash
# Rebuild backend saja (setelah update code)
docker compose up -d --build backend

# Rebuild frontend saja (setelah update code atau ganti NEXT_PUBLIC_ env)
docker compose up -d --build frontend
```

### Update ke Versi Terbaru

```bash
git pull origin main
docker compose up -d --build
```

---

## Deploy di VPS / Server Production

### Minimum VPS Specs

- **OS:** Ubuntu 22.04 / Debian 12
- **RAM:** 4 GB minimum (CRM + WAAPI berdua)
- **CPU:** 2 core
- **Disk:** 20 GB SSD
- **Port:** 80, 443 (HTTP/HTTPS)

### Quick Deploy Script

```bash
# 1. Install Docker (jika belum)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout & login kembali

# 2. Clone CRM project
git clone https://github.com/AdiSyahadi/CRM_DADI.git
cd CRM_DADI

# 3. Setup environment
cp .env.docker .env
nano .env
# Edit: MYSQL_ROOT_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
# Edit: APP_URL, FRONTEND_URL, CORS_ORIGIN → pakai domain/IP server
# Edit: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL → pakai domain/IP server
# Edit: WA_API_BASE_URL, WA_API_KEY, WA_ORGANIZATION_ID

# 4. Deploy
docker compose up -d --build

# 5. Verifikasi
docker ps -a --filter "name=crm-"
docker logs crm-backend --tail 20
```

### Nginx Reverse Proxy (HTTPS)

Untuk production dengan domain + SSL:

```nginx
# /etc/nginx/sites-available/crm-dadi

# CRM Frontend
server {
    listen 80;
    server_name crm.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name crm.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# CRM Backend API
server {
    listen 80;
    server_name api-crm.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api-crm.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api-crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-crm.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (untuk Socket.IO realtime chat)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Setup Nginx + SSL:
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
sudo ln -s /etc/nginx/sites-available/crm-dadi /etc/nginx/sites-enabled/
sudo certbot --nginx -d crm.yourdomain.com -d api-crm.yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

Update `.env` untuk production:
```dotenv
APP_URL=https://api-crm.yourdomain.com
FRONTEND_URL=https://crm.yourdomain.com
CORS_ORIGIN=https://crm.yourdomain.com
NEXT_PUBLIC_API_URL=https://api-crm.yourdomain.com/api
NEXT_PUBLIC_SOCKET_URL=https://api-crm.yourdomain.com
```

Rebuild frontend (karena `NEXT_PUBLIC_*` di-embed saat build):
```bash
docker compose up -d --build frontend
```

---

## Troubleshooting

### Backend container restart loop

```bash
# Cek error logs
docker logs crm-backend --tail 50
```

**Penyebab umum:**
- MySQL belum healthy → tunggu 30 detik, backend akan retry
- `prisma db push` gagal → cek DATABASE_URL di environment
- Port 5000 sudah terpakai → ubah `BACKEND_PORT` di `.env`

### Frontend blank / API error

1. Pastikan `NEXT_PUBLIC_API_URL` di `.env` benar
2. **Rebuild frontend** setelah ganti URL (karena NEXT_PUBLIC_ di-embed saat build):
   ```bash
   docker compose up -d --build frontend
   ```
3. Pastikan CORS di backend sesuai:
   ```dotenv
   CORS_ORIGIN=http://localhost:3002
   ```

### Port sudah dipakai

```
Error: bind: Only one usage of each socket address
```

**Solusi:** Ubah port di `.env`:
```dotenv
MYSQL_PORT=3309      # Jika 3308 sudah terpakai
REDIS_PORT=6381      # Jika 6380 sudah terpakai
BACKEND_PORT=5001    # Jika 5000 sudah terpakai
FRONTEND_PORT=3003   # Jika 3002 sudah terpakai
```

### MySQL container restart loop

```bash
docker logs crm-mysql --tail 30

# Biasanya karena volume rusak, reset:
docker compose down -v
docker compose up -d --build
```

> **Warning:** `docker compose down -v` menghapus SEMUA data!

### CRM tidak bisa connect ke WA API

```bash
# Test koneksi dari CRM backend ke WA API
docker exec crm-backend wget -qO- http://host.docker.internal:3001/api/v1/instances 2>&1 | head -5
```

Jika gagal:
- Pastikan WAAPI-DADI container running
- Pastikan `WA_API_BASE_URL=http://host.docker.internal:3001` di `.env`
- Di Linux, `host.docker.internal` mungkin tidak tersedia — gunakan IP host atau tambahkan `extra_hosts` di docker-compose.yml

### Reset total (fresh install)

```bash
docker compose down -v     # Hapus semua container + volume + data
docker compose up -d --build  # Build ulang dari awal
```

### Windows: docker command not found

```powershell
# Refresh PATH di PowerShell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
```

Atau buka terminal baru setelah install Docker Desktop.

---

## FAQ

### Q: Apakah perlu install Node.js di komputer?
**A:** Tidak. Semua sudah di dalam Docker container (Node.js 20).

### Q: Apakah perlu install MySQL di komputer?
**A:** Tidak. MySQL 8.0 sudah berjalan di Docker container. XAMPP tidak diperlukan lagi setelah migrasi.

### Q: Berapa lama build pertama kali?
**A:** 5-10 menit tergantung koneksi internet (download images ± 500MB, npm install, build TypeScript + Next.js).

### Q: Data hilang kalau container dihapus?
**A:** Tidak, selama pakai `docker compose down` (tanpa `-v`). Data MySQL, Redis, dan uploads disimpan di Docker volumes yang persistent.

### Q: Bisa diakses dari jaringan lain / internet?
**A:** Secara default hanya `localhost`. Untuk akses dari luar:
1. Ganti semua URL di `.env` ke IP/domain server
2. Rebuild frontend: `docker compose up -d --build frontend`
3. Buka port di firewall

### Q: WAAPI-DADI harus jalan di mesin yang sama?
**A:** Tidak harus. Jika WA API di server lain, ganti `WA_API_BASE_URL` ke URL server tersebut (misal `http://192.168.1.100:3001`).

### Q: Bagaimana update ke versi terbaru?
**A:**
```bash
git pull origin main
docker compose up -d --build
```

### Q: WhatsApp session hilang setelah restart CRM?
**A:** Tidak. WhatsApp session dikelola oleh WAAPI-DADI, bukan CRM. Selama WAAPI-DADI running, session tetap aktif.

### Q: Bagaimana backup database?
**A:**
```bash
# Backup
docker exec crm-mysql mysqldump -u root -proot crm_dadi > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i crm-mysql mysql -u root -proot crm_dadi < backup_20260216.sql
```

---

## File Reference

| File                              | Fungsi                                              |
| --------------------------------- | --------------------------------------------------- |
| `docker-compose.yml`              | Orchestrator: define semua service CRM & network     |
| `.env.docker`                     | Template environment variables                       |
| `.env`                            | Environment aktif (JANGAN commit ke git!)            |
| `backend/Dockerfile`              | Multi-stage build: TypeScript → production           |
| `backend/.dockerignore`           | Exclude files dari Docker build context              |
| `backend/docker-entrypoint.sh`    | Startup: prisma db push → node server                |
| `backend/prisma/schema.prisma`    | Database schema (22 tabel, Prisma 7)                 |
| `frontend/Dockerfile`             | Multi-stage build: Next.js → standalone              |
| `frontend/.dockerignore`          | Exclude files dari Docker build context              |
| `frontend/next.config.mjs`        | Next.js config (standalone output, ESLint disabled)  |

---

## Tech Stack Detail

### Backend
- **Runtime:** Node.js 20 (Alpine)
- **Framework:** Express 5
- **ORM:** Prisma 7 dengan `@prisma/adapter-mariadb`
- **Database:** MySQL 8.0
- **Cache/Queue:** Redis 7 + BullMQ
- **Realtime:** Socket.IO 4
- **Auth:** JWT (access + refresh token)
- **Validation:** Zod 4
- **Language:** TypeScript 5

### Frontend
- **Framework:** Next.js 14 (App Router, standalone output)
- **UI:** TailwindCSS + shadcn/ui + Radix UI
- **State:** Zustand + TanStack Query
- **Charts:** Recharts
- **Icons:** Lucide React
- **Realtime:** Socket.IO Client

### Fitur CRM
- Multi-tenant (banyak organisasi)
- RBAC (Owner, Admin, Supervisor, Agent)
- WhatsApp chat realtime (via WAAPI-DADI)
- Contact management
- Deal/Sales pipeline
- Broadcast messaging
- Message templates
- Analytics dashboard
- Team management

---

*Dokumen ini dibuat untuk CRM-DADI v1.0 — CRM SaaS dengan integrasi WhatsApp*
*Last updated: February 2026*
