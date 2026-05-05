# Media File API Guide — Akses & Upload Media

## Cara Akses Media File

Ada **2 path** untuk akses file media yang sudah di-upload/diterima:

| Path | Auth | Cocok untuk |
|------|------|-------------|
| `/media/{orgId}/{file}` | **Tidak perlu** | CRM, webhook consumer, embed langsung |
| `/uploads/{orgId}/{file}` | JWT / API Key | Dashboard internal |

---

## 1. Public Media URL (Recommended untuk CRM)

```
GET https://wapi.abdashboard.com/media/{orgId}/{uuid-filename}.jpg
```

- **Tanpa auth** — bisa diakses langsung dari browser, CRM, webhook consumer
- Ini URL yang dikembalikan oleh API saat upload dan saat menerima pesan media (webhook)
- Keamanan: filename pakai **UUID v4** (122-bit random, tidak bisa di-guess)
- Rate limited: **60 request/menit** per IP
- Security headers: `no-store` cache, `nosniff` content type

### Contoh URL

```
https://wapi.abdashboard.com/media/876b59c2-7218-42ee-ac56-0b717a60bfe2/a1b2c3d4-e5f6-7890-abcd-1234567890ab.jpg
```

### Cara Pakai di CRM

```html
<!-- Langsung embed di HTML -->
<img src="https://wapi.abdashboard.com/media/{orgId}/{filename}.jpg" />

<!-- Atau download via JS -->
<a href="https://wapi.abdashboard.com/media/{orgId}/{filename}.pdf" download>Download</a>
```

---

## 2. Authenticated Upload URL

```
GET https://wapi.abdashboard.com/uploads/{orgId}/{uuid-filename}.jpg
X-API-Key: wa_xxxxxxxxxxxx
```

atau

```
Authorization: Bearer <JWT_TOKEN>
```

- Butuh auth — hanya untuk akses dari dashboard internal
- File fisiknya **sama** dengan `/media/`, hanya beda route dan auth requirement

---

## 3. Upload Media File

### Via External API (API Key) — Recommended untuk CRM

```
POST /api/v1/media/upload
X-API-Key: wa_xxxxxxxxxxxx
Content-Type: multipart/form-data
```

Form fields:
- `file` (required) — file binary
- `type` (optional) — `image`, `video`, `audio`, atau `document`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://wapi.abdashboard.com/media/{orgId}/a1b2c3d4-uuid.jpg",
    "media_type": "image",
    "mime_type": "image/jpeg",
    "file_size": 123456,
    "original_name": "photo.jpg"
  }
}
```

> URL di response sudah pakai `/media/` prefix — **langsung bisa diakses tanpa auth**.

### Via Internal API (JWT)

```
POST /api/uploads
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

Response sama, tapi URL menggunakan `/uploads/` prefix (butuh auth untuk akses).

---

## 4. File Type & Size Limits

| Type | Allowed MIME Types | Max Size |
|------|--------------------|----------|
| `image` | jpeg, png, gif, webp | 16 MB |
| `video` | mp4, mpeg, quicktime, webm | 64 MB |
| `audio` | mpeg, wav, ogg, mp4 | 16 MB |
| `document` | pdf, doc, docx, xls, xlsx, txt, csv | 100 MB |

---

## 5. Contoh cURL

### Upload file

```bash
# Upload gambar
curl -X POST https://wapi.abdashboard.com/api/v1/media/upload \
  -H "X-API-Key: wa_xxxxxxxxxxxx" \
  -F "file=@/path/to/photo.jpg" \
  -F "type=image"

# Upload dokumen
curl -X POST https://wapi.abdashboard.com/api/v1/media/upload \
  -H "X-API-Key: wa_xxxxxxxxxxxx" \
  -F "file=@/path/to/document.pdf" \
  -F "type=document"
```

### Akses file (public, tanpa auth)

```bash
# Download langsung
curl -O https://wapi.abdashboard.com/media/{orgId}/{filename}.jpg

# Cek file ada atau tidak
curl -I https://wapi.abdashboard.com/media/{orgId}/{filename}.jpg
```

---

## 6. Contoh JavaScript

```javascript
const API_URL = 'https://wapi.abdashboard.com';
const API_KEY = 'wa_xxxxxxxxxxxx';

// Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('type', 'image');

const uploadRes = await fetch(`${API_URL}/api/v1/media/upload`, {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY },
  body: formData,
});
const { data } = await uploadRes.json();

console.log(data.url);
// → "https://wapi.abdashboard.com/media/{orgId}/uuid.jpg"

// Tampilkan di CRM
document.getElementById('preview').src = data.url;
```

---

## 7. Media dari Pesan Masuk (Webhook)

Saat menerima pesan media via webhook, field `media_url` sudah menggunakan path `/media/`:

```json
{
  "event": "message",
  "data": {
    "type": "image",
    "content": "",
    "media_url": "https://wapi.abdashboard.com/media/{orgId}/media_1714900000000.jpg",
    "media_type": "image/jpeg",
    "media_size": 54321
  }
}
```

URL tersebut bisa langsung diakses tanpa auth — tinggal embed di CRM.

---

## Ringkasan

| Kebutuhan | Endpoint / Path | Auth |
|-----------|-----------------|------|
| Upload file | `POST /api/v1/media/upload` | API Key |
| Akses file (CRM/public) | `GET /media/{orgId}/{file}` | Tidak perlu |
| Akses file (dashboard) | `GET /uploads/{orgId}/{file}` | JWT / API Key |
| Kirim media ke WA | `POST /api/v1/messages/send-media` | API Key |

**TL;DR:** Path yang benar untuk akses media dari CRM adalah **`/media/{orgId}/{filename}`** — tanpa auth, langsung bisa di-embed.
