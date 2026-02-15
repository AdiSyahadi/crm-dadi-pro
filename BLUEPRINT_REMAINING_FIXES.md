# Blueprint: Remaining CRM-DADI Fixes

Dokumen ini menjelaskan pekerjaan yang tersisa untuk integrasi WhatsApp CRM,
berdasarkan deep review codebase dan informasi terbaru dari WA API.

Terakhir di-review: 10 Feb 2026

---

## Status Saat Ini

### Yang Sudah Selesai ✅
- Kirim pesan teks dari CRM ke WhatsApp (realtime via WA API)
- Terima pesan masuk via webhook + Socket.IO (realtime)
- Filter @lid conversations (skip di sync, webhook, dan API list)
- Filter self-chat (skip nomor instance sendiri)
- Filter group chats
- Pass instance_id ke WA API saat fetch conversations
- Socket.IO event handling (chat:message, message:status)
- Webhook handler untuk semua event (message.received, message.sent, message.delivered, message.read)
- Frontend polling sebagai fallback (60 detik)
- Backend polling sebagai fallback (120 detik, top 5 conversations)

### Yang Perlu Dikerjakan 🔧
1. Fix bug: parameter order salah di `sendMedia` (BUG — kirim media selalu gagal)
2. Fix bug: `sendMedia` missing `@lid` dan `@g.us` handling di phone extraction (BUG)
3. Fix bug: broadcast hanya kirim text, tidak support media (BUG)
4. Fix bug: dead code di `webhook.service.ts` (MINOR)
5. Fix bug: webhook duplicate message — tidak ada dedup check (RACE CONDITION)
6. Fix media URL authentication (CRITICAL — media tidak bisa ditampilkan)
7. Sync data awal
8. Cleanup debug logging

---

## Fix 1: Media URL Authentication (CRITICAL)

### Masalah
WA API sekarang membutuhkan authentication untuk mengakses file media di `/uploads/*`.
Tanpa header auth → 401 "Authentication required to access files".

CRM menyimpan `media_url` dari WA API di database.
Contoh URL: `http://localhost:3001/uploads/media/gambar.jpg`

Frontend langsung render URL ini di tag `<img>`, `<video>`, `<audio>`, `<a>`.
Browser **tidak bisa** menambahkan custom header ke tag HTML media.
Jadi semua media (gambar, video, audio, dokumen, sticker) akan gagal load → broken image.

### Tempat yang Terdampak

**Frontend** — hanya `frontend/src/app/dashboard/chat/page.tsx`:
- Line 362-363: `<img src={msg.media_url}>` — IMAGE, VIEW_ONCE
- Line 365-366: `<video src={msg.media_url}>` — VIDEO
- Line 368-369: `<audio src={msg.media_url}>` — AUDIO
- Line 371-372: `<a href={msg.media_url}>` — DOCUMENT
- Line 374-375: `<img src={msg.media_url}>` — STICKER

**Backend** — media_url disimpan apa adanya dari WA API di:
- `sync.service.ts` line 144: `media_url: rm.media_url || null`
- `webhook.service.ts` line 107: `mediaUrl: data.media_url || null`
- `message.service.ts` line 127: `media_url: mediaUrl` (outgoing)

Backend menyimpan URL asli WA API — ini benar, tidak perlu diubah.
Yang perlu diubah hanya cara frontend mengakses URL tersebut.

### Solusi: Backend Media Proxy

Buat endpoint proxy di CRM backend yang:
1. Menerima request dari frontend (sudah authenticated via JWT)
2. Ambil WA API key dari database berdasarkan organizationId user
3. Fetch media dari WA API dengan `X-API-Key` header
4. Stream response (binary data + content-type) ke frontend

**Kenapa proxy?**
- WA API tidak support signed URL
- Mengirim API key ke frontend = security risk (exposed di browser DevTools)
- Proxy menjaga API key tetap di server side
- Satu endpoint, handle semua jenis media

### Implementasi Detail

#### A. Backend: `GET /api/media/proxy?url=<encoded_url>`

File baru: `backend/src/controllers/media.controller.ts`
File baru: `backend/src/routes/media.routes.ts`

```typescript
// media.controller.ts — pseudocode
async proxy(req: Request, res: Response) {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  // SSRF protection: hanya izinkan URL dari WA API
  const org = await prisma.organization.findUnique({
    where: { id: req.user.organizationId },
    select: { wa_api_base_url: true, wa_api_key: true },
  });

  if (!org?.wa_api_base_url || !org?.wa_api_key) {
    return res.status(400).json({ error: 'WA API not configured' });
  }

  // Validasi: URL harus dimulai dengan WA API base URL
  // Contoh: wa_api_base_url = "http://localhost:3001/api/v1"
  //         Allowed prefix  = "http://localhost:3001/"
  const allowedOrigin = new URL(org.wa_api_base_url).origin;
  if (!url.startsWith(allowedOrigin)) {
    return res.status(403).json({ error: 'URL not allowed' });
  }

  // Fetch dari WA API dengan auth
  const response = await axios.get(url, {
    headers: { 'X-API-Key': org.wa_api_key },
    responseType: 'stream',
    timeout: 30000,
  });

  // Forward headers
  res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
  if (response.headers['content-length']) {
    res.set('Content-Length', response.headers['content-length']);
  }
  res.set('Cache-Control', 'private, max-age=3600'); // cache 1 jam di browser

  // Stream binary data
  response.data.pipe(res);
}
```

```typescript
// media.routes.ts
import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();
router.use(authenticate, tenantGuard);
router.get('/proxy', mediaController.proxy);
export default router;
```

Register di `routes/index.ts`:
```typescript
import mediaRoutes from './media.routes';
router.use('/media', mediaRoutes);
```

**Edge cases yang di-handle:**
- URL kosong → 400
- WA API tidak configured → 400
- URL bukan dari WA API (SSRF attempt) → 403
- WA API return 401 (key invalid) → forward error
- WA API return 404 (file deleted) → forward error
- Timeout → 30 detik timeout, axios akan throw error
- File besar → streaming, tidak buffer di memory

#### B. Frontend: Helper function + update 5 tempat

File: `frontend/src/app/dashboard/chat/page.tsx`

```typescript
// Helper: proxy media URL melalui CRM backend
const getMediaUrl = (url: string | null): string => {
  if (!url) return '';
  // Jika URL sudah mengarah ke CRM backend (outgoing media), return apa adanya
  // Jika URL dari WA API, proxy melalui backend
  return `${API_BASE_URL}/media/proxy?url=${encodeURIComponent(url)}`;
};
```

Catatan: `API_BASE_URL` = `http://localhost:5000/api` (dari `lib/api.ts`).
Tapi karena frontend pakai axios instance `api` yang sudah ada baseURL,
lebih baik pakai full URL agar `<img src>` bisa langsung akses.

Perlu juga import `API_BASE_URL` atau hardcode.
Lebih proper: buat constant di `lib/api.ts`:
```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
```
Ini sudah ada di line 3, tapi belum di-export. Perlu tambah `export`.

Update 5 tempat rendering media di chat page (line 362-375):
- IMAGE/VIEW_ONCE: `<img src={getMediaUrl(msg.media_url)}>`
- VIDEO: `<video src={getMediaUrl(msg.media_url)}>`
- AUDIO: `<audio src={getMediaUrl(msg.media_url)}>`
- DOCUMENT: `<a href={getMediaUrl(msg.media_url)}>`
- STICKER: `<img src={getMediaUrl(msg.media_url)}>`

**Tapi ada masalah:** `<img>` dan `<video>` tag tidak bisa kirim JWT header.
Proxy endpoint butuh auth. Solusinya: tambahkan JWT token sebagai query parameter
di URL proxy, ATAU gunakan cookie-based auth.

**Solusi yang dipilih:** Tambah token sebagai query parameter.
Ini aman karena:
- URL hanya digunakan di browser user sendiri
- HTTPS akan encrypt URL di production
- Token short-lived (15 menit)

```typescript
const getMediaUrl = (url: string | null): string => {
  if (!url) return '';
  const token = localStorage.getItem('accessToken') || '';
  return `${API_BASE_URL}/media/proxy?url=${encodeURIComponent(url)}&token=${token}`;
};
```

Backend proxy juga perlu handle auth dari query parameter:
```typescript
// Di media.controller.ts, sebelum authenticate middleware:
// Atau: tambahkan logic di proxy handler untuk accept token dari query
const token = req.query.token as string;
if (token && !req.headers.authorization) {
  req.headers.authorization = `Bearer ${token}`;
}
```

**Lebih proper:** Buat middleware khusus untuk media route yang accept token
dari query parameter, lalu jalankan authenticate middleware biasa.

---

## Fix 2: Bug — Parameter Order Salah di sendMedia (BUG)

### Masalah
Di `message.service.ts` line 141:
```typescript
const result = await waClient.sendMedia(instance.wa_instance_id, phone, mediaUrl, caption, mediaType);
```

Tapi signature `WAApiClient.sendMedia` di `wa-api.client.ts` line 83:
```typescript
async sendMedia(instanceId: string, phone: string, message: string, mediaUrl: string, mediaType?: string, chatJid?: string)
```

Parameter ke-3 adalah `message` (caption), tapi dipanggil dengan `mediaUrl`.
Parameter ke-4 adalah `mediaUrl`, tapi dipanggil dengan `caption`.

**Akibat:** Saat kirim media dari CRM:
- `media_url` yang dikirim ke WA API berisi caption text (salah)
- `caption` yang dikirim ke WA API berisi media URL (salah)
- Pengiriman media akan selalu gagal

### Fix
Tukar urutan parameter di pemanggilan `message.service.ts` line 141:
```typescript
// SEBELUM (salah):
const result = await waClient.sendMedia(instance.wa_instance_id, phone, mediaUrl, caption, mediaType);

// SESUDAH (benar):
const result = await waClient.sendMedia(instance.wa_instance_id, phone, caption || '', mediaUrl, mediaType, conversation.chat_jid);
```

Juga tambahkan `chatJid` parameter agar konsisten dengan `sendText`.

---

## Fix 3: Bug — sendMedia Missing @lid/@g.us Handling (BUG)

### Masalah
Di `message.service.ts` line 140:
```typescript
const phone = conversation.chat_jid.replace('@s.whatsapp.net', '');
```

Ini hanya handle `@s.whatsapp.net`. Bandingkan dengan `sendText` (line 70):
```typescript
const phone = chatJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '').replace(/@g\.us$/, '');
```

`sendText` handle 3 suffix, tapi `sendMedia` hanya handle 1.
Jika conversation pakai `@lid` JID, phone akan berisi `628xxx@lid` → WA API reject.

Juga: `sendMedia` tidak pass `chatJid` ke `waClient.sendMedia()`, jadi `@lid` conversations
tidak bisa kirim media sama sekali (karena `to` field akan salah).

### Fix
```typescript
// SEBELUM:
const phone = conversation.chat_jid.replace('@s.whatsapp.net', '');
const result = await waClient.sendMedia(instance.wa_instance_id, phone, caption || '', mediaUrl, mediaType);

// SESUDAH:
const chatJid = conversation.chat_jid;
const phone = chatJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '').replace(/@g\.us$/, '');
const result = await waClient.sendMedia(instance.wa_instance_id, phone, caption || '', mediaUrl, mediaType, chatJid);
```

Ini sudah termasuk fix dari Fix 2 (parameter order).

---

## Fix 4: Bug — Broadcast Tidak Support Media (BUG)

### Masalah
Di `broadcast.service.ts` line 206-211, `processBroadcast` hanya kirim text:
```typescript
const result = await waClient.sendText(
  broadcast.instance.wa_instance_id,
  recipient.phone_number,
  recipient.personalized_message || broadcast.message_content
);
```

Padahal broadcast punya field `media_url` dan `media_type` (line 89-90).
Jika user buat broadcast dengan media, media tidak akan terkirim — hanya text-nya saja.

### Fix
```typescript
// Cek apakah broadcast punya media
let result;
if (broadcast.media_url) {
  result = await waClient.sendMedia(
    broadcast.instance.wa_instance_id,
    recipient.phone_number,
    recipient.personalized_message || broadcast.message_content || '',
    broadcast.media_url,
    broadcast.media_type || 'image'
  );
} else {
  result = await waClient.sendText(
    broadcast.instance.wa_instance_id,
    recipient.phone_number,
    recipient.personalized_message || broadcast.message_content
  );
}
```

---

## Fix 5: Dead Code di webhook.service.ts (MINOR)

### Masalah
Di `webhook.service.ts` line 54:
```typescript
let contact: any = null;

if (!contact) {  // ← selalu true, karena contact baru saja di-set null
  contact = await prisma.contact.findFirst({...});
}
```

`if (!contact)` selalu true karena `contact` baru di-declare sebagai `null`.
Ini dead code — `if` statement tidak berguna.

### Fix
Hapus `if (!contact)` wrapper, langsung assign:
```typescript
let contact = await prisma.contact.findFirst({
  where: { organization_id: organizationId, phone_number: phone },
});
```

---

## Fix 6: Webhook Duplicate Message — Race Condition (RACE CONDITION)

### Masalah
Di `webhook.service.ts`, `_processIncomingForInstance` **tidak cek** apakah message
dengan `wa_message_id` yang sama sudah ada di database. Setiap webhook call langsung
`messageService.saveIncomingMessage()` → create baru.

Ini berbeda dengan `sync.service.ts` yang cek:
```typescript
const existing = await prisma.message.findFirst({
  where: { wa_message_id: waMessageId, organization_id: organizationId },
});
if (existing) continue;
```

**Akibat:**
- Jika WA API retry webhook (max 5 attempts), pesan yang sama bisa masuk 5x
- Jika polling sync juga berjalan bersamaan, pesan bisa duplikat
- Frontend akan menampilkan pesan yang sama berkali-kali

### Fix
Tambahkan dedup check di `webhook.service.ts` sebelum save:
```typescript
const waMessageId = data.message_id || data.key?.id || '';

// Skip jika message sudah ada (dedup — webhook bisa retry)
if (waMessageId) {
  const existing = await prisma.message.findFirst({
    where: { wa_message_id: waMessageId, organization_id: organizationId },
  });
  if (existing) return { contact, conversation, message: existing };
}
```

Taruh setelah `findOrCreate` conversation (line 93) dan sebelum `saveIncomingMessage` (line 100).

---

## Fix 7: Sync Data Awal

### Masalah
Setelah WA API di-reset, ada ~5 pesan dari testing. CRM database kosong.
Perlu trigger full sync agar data awal masuk.

### Langkah
1. Pastikan backend running
2. Trigger sync via existing endpoint: `POST /api/instances/:id/sync`
3. Verifikasi data masuk dengan benar (tanpa @lid, tanpa self-chat)

Tidak perlu perubahan kode — endpoint sudah ada dan filter sudah benar.

---

## Fix 8: Cleanup Debug Logging

### Masalah
Ada console.log debug yang ditambahkan selama development.
Ini mengotori log production dan bisa leak sensitive data.

### Yang Dihapus
File: `backend/src/services/webhook.service.ts`
- Line 99: `console.log('Webhook: saving message for conversation...')`
- Line 125: `console.log('Webhook: emitted chat:message to org...')`

File: `backend/src/services/message.service.ts`
- Line 71: `console.log('SendText: to=...')` — leak nomor telepon
- Line 73: `console.log('SendText result:...')` — leak API response

### Yang Dipertahankan
File: `backend/src/controllers/webhook.controller.ts`
- Line 36: `console.log('Webhook received: ...')` — berguna untuk monitoring event

File: `backend/src/services/sync.service.ts`
- Line 284: `console.log('📡 Sync polling started...')` — startup info
- Line 294: `console.log('📡 Polled X new messages...')` — hanya muncul jika ada pesan baru

---

## Urutan Pengerjaan

```
Fase 1: Bug Fixes (backend only, simple changes)
──────────────────────────────────────────────────
1. Fix sendMedia parameter order + @lid handling
   └── 1 file: message.service.ts (3 line change)

2. Fix broadcast media support
   └── 1 file: broadcast.service.ts (add if/else block)

3. Fix webhook duplicate message (dedup check)
   └── 1 file: webhook.service.ts (add 6 lines)

4. Fix dead code webhook.service.ts
   └── 1 file: webhook.service.ts (simplify 4 lines → 2 lines)

Fase 2: Media Proxy (backend + frontend)
──────────────────────────────────────────────────
5. Fix media URL auth (proxy endpoint + frontend update)
   ├── 5a. Export API_BASE_URL dari lib/api.ts
   ├── 5b. Buat backend/src/controllers/media.controller.ts (baru)
   ├── 5c. Buat backend/src/routes/media.routes.ts (baru)
   ├── 5d. Register route di routes/index.ts
   ├── 5e. Update frontend chat page — helper + 5 media render spots
   └── 5f. Test: kirim gambar dari WA, verifikasi tampil di CRM

Fase 3: Sync + Cleanup
──────────────────────────────────────────────────
6. Sync data awal
   └── 6a. Trigger sync, verifikasi data

7. Cleanup debug logging
   └── 7a. Hapus 4 console.log, keep 3 yang berguna
```

Fase 1 dikerjakan duluan — semua bug fix backend, simple, high impact.
Fase 2 lebih complex (2 file baru + update 2 file existing).
Fase 3 terakhir — sync dan cleanup.

---

## Batasan yang Diketahui

- **Daily limit 50 pesan/instance** — CRM tidak enforce ini, WA API yang enforce.
  Jika limit tercapai, WA API return error dan CRM menampilkan "Gagal mengirim pesan".
  Enhancement masa depan: tampilkan sisa kuota di UI.

- **Webhook secret belum di-set** — Webhook tidak terverifikasi.
  Siapa saja yang tahu URL bisa kirim fake webhook.
  Untuk development OK. Production: set WEBHOOK_SECRET di kedua sisi.

- **Media file auto-delete 30 hari** — WA API hapus media setelah 30 hari.
  URL yang tersimpan di CRM akan broken.
  Enhancement masa depan: download & simpan lokal saat sync/webhook.

- **Pagination max 100** — WA API cap pagination di 100 items.
  CRM `getConversations` sudah pakai `limit=100`. Jika ada >100 conversations,
  perlu implement pagination loop. Untuk sekarang belum diperlukan.

- **Broadcast worker tidak ada BullMQ worker untuk media** — Worker hanya process
  text messages. Setelah Fix 4, worker akan support media juga.

---

## Daftar File yang Akan Diubah

| # | File | Aksi | Fix |
|---|------|------|-----|
| 1 | `backend/src/services/message.service.ts` | Edit 3 lines | Fix 1+3 (sendMedia) |
| 2 | `backend/src/services/broadcast.service.ts` | Edit ~10 lines | Fix 4 (broadcast media) |
| 3 | `backend/src/services/webhook.service.ts` | Edit ~10 lines | Fix 5+6 (dedup + dead code) |
| 4 | `backend/src/controllers/media.controller.ts` | **Baru** | Fix 6 (media proxy) |
| 5 | `backend/src/routes/media.routes.ts` | **Baru** | Fix 6 (media proxy) |
| 6 | `backend/src/routes/index.ts` | Edit 2 lines | Fix 6 (register route) |
| 7 | `frontend/src/lib/api.ts` | Edit 1 line | Fix 6 (export constant) |
| 8 | `frontend/src/app/dashboard/chat/page.tsx` | Edit ~15 lines | Fix 6 (media rendering) |

**Total: 6 file edit + 2 file baru = 8 file**
