# Pertanyaan: Media Upload & Attachment untuk CRM

## Konteks

CRM-DADI perlu fitur **melampirkan media** (image, video, audio, document) di:
1. **Chat** — user kirim media ke kontak WhatsApp dari halaman chat
2. **Broadcast** — user lampirkan media (gambar promo, PDF, dll) ke broadcast massal

Backend sudah menggunakan endpoint `POST /api/v1/messages/send-media` yang membutuhkan parameter `media_url` berupa **URL publik** (HTTPS). Masalahnya, user CRM perlu **upload file dari komputer mereka**, bukan input URL manual.

---

## Pertanyaan

### 1. Apakah WA API menyediakan endpoint untuk upload file?

Apakah ada endpoint seperti:
```
POST /api/v1/media/upload
```
Yang menerima file upload (multipart/form-data) dan mengembalikan URL publik yang bisa langsung dipakai di `send-media`?

Jika ya, mohon info:
- **Endpoint URL** lengkap
- **Method** (POST)
- **Content-Type** (multipart/form-data?)
- **Parameter/field name** untuk file-nya (misal `file`, `media`, dll)
- **Max file size** per tipe media
- **Response format** — khususnya field yang berisi URL publik file yang sudah di-upload
- **Apakah perlu `instance_id`** sebagai parameter?
- **Berapa lama file disimpan?** (permanent / temporary / ada expiry?)

### 2. Jika tidak ada endpoint upload, bagaimana rekomendasi handling media?

Apakah user harus:
- Host file sendiri di cloud storage (S3, Google Cloud Storage, dll)?
- Atau ada cara lain yang disarankan?

### 3. Apakah ada batasan format file yang lebih spesifik?

Dari API-REFERENCE.md sudah ada info:

| Type | Format | Max Size |
|------|--------|----------|
| image | JPG, PNG, WEBP | 16 MB |
| video | MP4, MPEG, MOV | 64 MB |
| audio | MP3, WAV, OGG, M4A | 16 MB |
| document | PDF, DOC, XLS, TXT, ZIP | 100 MB |

Apakah ada batasan tambahan yang belum terdokumentasi? Misalnya:
- Resolusi maksimal untuk image/video?
- Durasi maksimal untuk video/audio?
- Format yang sering gagal?

### 4. Apakah `media_url` harus HTTPS, atau HTTP juga boleh?

Dari docs disebutkan SSRF protection memblokir `localhost`, IP internal, `file://`, `ftp://`. Apakah `http://` (tanpa S) dari domain publik tetap diterima?

### 5. Webhook event untuk media message

Saat menerima pesan media masuk (incoming), apakah webhook payload `message.received` menyertakan:
- `media_url` — URL untuk download media?
- `media_mime_type` — MIME type file?
- `filename` — nama file asli (untuk document)?
- `file_size` — ukuran file?

Atau apakah ada endpoint terpisah untuk download/get media dari message yang masuk?

---

## Kebutuhan CRM

Fitur yang akan diimplementasikan setelah jawaban diterima:

1. **Chat — Tombol Attachment**: User klik icon 📎, pilih file dari komputer, file di-upload, lalu dikirim via `send-media`
2. **Broadcast — Lampiran Media**: User bisa attach 1 file media ke broadcast (gambar promo, PDF katalog, dll)
3. **Preview media sebelum kirim**: Tampilkan preview image/video sebelum user klik kirim
