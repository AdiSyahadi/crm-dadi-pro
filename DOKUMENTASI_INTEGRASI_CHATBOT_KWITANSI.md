# Dokumentasi Integrasi Chatbot Eksternal → Auto-Kwitansi CRM

## Ringkasan

Ketika user membuat chatbot sendiri (misal menggunakan **n8n**, **Botpress**, **Dialogflow**, atau script custom), chatbot tersebut bisa mengirim notifikasi pembayaran ke CRM. CRM akan otomatis:

1. Mencocokkan pembayaran dengan **Deal** yang ada
2. Menutup Deal sebagai **WON**
3. **Membuat kwitansi (receipt) otomatis** dalam format PDF
4. **Mengirim kwitansi via WhatsApp** ke customer

Semua ini terjadi secara otomatis dalam 1 kali request API.

---

## Alur Lengkap

```
Customer bayar
      ↓
Chatbot/n8n mendeteksi pembayaran
      ↓
Chatbot kirim POST ke CRM webhook
      ↓
CRM cocokkan deal (tracking_code / deal_id / phone)
      ↓
Deal otomatis di-close sebagai WON
      ↓
Kwitansi PDF otomatis dibuat
      ↓
Kwitansi dikirim via WhatsApp ke customer
```

---

## Endpoint API

```
POST https://crm.abdashboard.com/api/webhook/payment-callback
```

### Header

| Header | Nilai | Keterangan |
|---|---|---|
| `Content-Type` | `application/json` | Wajib |
| `X-Webhook-Secret` | `<WEBHOOK_SECRET>` | Sama dengan env `WEBHOOK_SECRET` di backend. Opsional tapi sangat disarankan |

### Body (JSON)

| Field | Type | Wajib | Keterangan |
|---|---|---|---|
| `amount` | `number` | ✅ Ya | Jumlah pembayaran (contoh: `150000`) |
| `tracking_code` | `string` | Salah satu wajib | Kode tracking dari tracked link CRM |
| `deal_id` | `string` | Salah satu wajib | ID deal di CRM |
| `phone_number` | `string` | Salah satu wajib | Nomor HP customer (format: `6281234567890`) |
| `payment_method` | `string` | Opsional | Metode bayar (contoh: `"Bank Transfer BCA"`, `"QRIS"`) |
| `payment_ref` | `string` | Opsional | Referensi/ID transaksi dari payment gateway |
| `payer_name` | `string` | Opsional | Nama pembayar |
| `metadata` | `object` | Opsional | Data tambahan apapun |

> **Minimal 1 identifier wajib diisi**: `tracking_code`, `deal_id`, atau `phone_number`

### Prioritas Pencocokan Deal

1. **`tracking_code`** — Paling akurat. CRM mencocokkan dengan TrackedLink yang terhubung ke deal
2. **`deal_id`** — Langsung ke deal spesifik
3. **`phone_number`** — Mencari deal terbaru yang masih terbuka dari kontak dengan nomor tersebut

---

## Contoh Request

### Contoh 1: Pakai `phone_number` (Paling Mudah)

```bash
curl -X POST https://crm.abdashboard.com/api/webhook/payment-callback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: rahasia123" \
  -d '{
    "phone_number": "6281234567890",
    "amount": 150000,
    "payment_method": "Bank Transfer BCA",
    "payment_ref": "TRX-20250505-001",
    "payer_name": "Budi Santoso"
  }'
```

### Contoh 2: Pakai `deal_id` (Paling Spesifik)

```bash
curl -X POST https://crm.abdashboard.com/api/webhook/payment-callback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: rahasia123" \
  -d '{
    "deal_id": "clxxxxxxxxxxxxxxxxxx",
    "amount": 250000,
    "payment_method": "QRIS",
    "payment_ref": "QRIS-12345",
    "payer_name": "Andi"
  }'
```

### Contoh 3: Pakai `tracking_code`

```bash
curl -X POST https://crm.abdashboard.com/api/webhook/payment-callback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: rahasia123" \
  -d '{
    "tracking_code": "abc123def",
    "amount": 500000,
    "payment_method": "Midtrans",
    "payment_ref": "MT-67890"
  }'
```

---

## Response

### Sukses (200)

```json
{
  "success": true,
  "deal_id": "clxxxxxxxxxxxxxxxxxx",
  "deal_number": "DEAL-001",
  "action": "auto_closed_won",
  "message": "Deal auto-closed as WON"
}
```

### Deal Tidak Ditemukan (404)

```json
{
  "success": false,
  "message": "No matching deal found"
}
```

### Deal Sudah Ditutup (200)

```json
{
  "success": true,
  "deal_id": "clxxxxxxxxxxxxxxxxxx",
  "deal_number": "DEAL-001",
  "action": "activity_logged",
  "message": "Deal already WON, payment activity recorded"
}
```

### Error (400)

```json
{
  "error": "amount (number) is required"
}
```

---

## Apa yang Terjadi di CRM Secara Otomatis

Setelah request berhasil, CRM akan melakukan **semua ini otomatis**:

| # | Aksi | Detail |
|---|---|---|
| 1 | Deal di-close WON | Stage → WON, closed_status → WON |
| 2 | Activity payment dicatat | Type: PAYMENT_RECEIVED |
| 3 | Activity WON dicatat | Type: WON |
| 4 | Webhook event dikirim | Event: `deal.won` (jika ada webhook subscriber) |
| 5 | **Kwitansi PDF dibuat** | Nomor format: `RCP-202505-0001` |
| 6 | **Kwitansi dikirim via WA** | PDF dikirim ke customer lewat WhatsApp |
| 7 | Status kwitansi diupdate | Status: SENT, sent_via_wa: true |

### Syarat Kwitansi Otomatis Terkirim via WA

- Kontak deal harus punya `phone_number`
- Deal harus terhubung ke `conversation_id` (ada percakapan WA aktif)
- WhatsApp API harus terkonfigurasi dan aktif

Jika WA tidak tersedia, kwitansi tetap dibuat (bisa dilihat di menu Kwitansi di CRM), hanya tidak terkirim otomatis.

---

## Setup di Organisasi

### 1. Konfigurasi Receipt (Kwitansi)

Buka **Pengaturan → Kwitansi** di CRM, lalu isi:

- **Nama Organisasi** — Muncul di header kwitansi
- **Alamat** — Alamat organisasi
- **Telepon** — Nomor telepon organisasi
- **Logo** — Logo yang muncul di kwitansi (opsional)

### 2. Set WEBHOOK_SECRET (Opsional tapi Disarankan)

Di file `.env` backend, set:

```env
WEBHOOK_SECRET=rahasia-yang-kuat-dan-unik
```

Lalu gunakan secret yang sama di header `X-Webhook-Secret` saat memanggil API.

---

## Contoh Integrasi dengan n8n

### Flow n8n:

```
[Trigger: Webhook / Cron / Email]
  → [IF: Pembayaran terdeteksi]
    → [HTTP Request: POST ke CRM payment-callback]
```

### Node HTTP Request di n8n:

| Setting | Nilai |
|---|---|
| Method | POST |
| URL | `https://crm.abdashboard.com/api/webhook/payment-callback` |
| Header 1 | `Content-Type: application/json` |
| Header 2 | `X-Webhook-Secret: <secret>` |
| Body | JSON (lihat contoh di atas) |

### Contoh Body di n8n (Expression):

```json
{
  "phone_number": "{{ $json.customer_phone }}",
  "amount": {{ $json.payment_amount }},
  "payment_method": "{{ $json.payment_channel }}",
  "payment_ref": "{{ $json.transaction_id }}",
  "payer_name": "{{ $json.customer_name }}"
}
```

---

## Contoh Integrasi dengan Botpress / Custom Bot

### Node.js / JavaScript:

```javascript
const axios = require('axios');

async function notifyCRM(payment) {
  try {
    const response = await axios.post(
      'https://crm.abdashboard.com/api/webhook/payment-callback',
      {
        phone_number: payment.customerPhone,
        amount: payment.amount,
        payment_method: payment.method,
        payment_ref: payment.transactionId,
        payer_name: payment.customerName,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'rahasia123',
        },
      }
    );

    console.log('CRM response:', response.data);
    // response.data.action === 'auto_closed_won' → berhasil
    // Kwitansi sudah otomatis dibuat dan dikirim via WA
  } catch (error) {
    console.error('Gagal notifikasi CRM:', error.response?.data || error.message);
  }
}

// Contoh pemakaian
notifyCRM({
  customerPhone: '6281234567890',
  amount: 150000,
  method: 'Bank Transfer BCA',
  transactionId: 'TRX-001',
  customerName: 'Budi',
});
```

### Python:

```python
import requests

def notify_crm(phone, amount, method, ref, name):
    response = requests.post(
        'https://crm.abdashboard.com/api/webhook/payment-callback',
        json={
            'phone_number': phone,
            'amount': amount,
            'payment_method': method,
            'payment_ref': ref,
            'payer_name': name,
        },
        headers={
            'Content-Type': 'application/json',
            'X-Webhook-Secret': 'rahasia123',
        }
    )
    print(response.json())
    # Kwitansi otomatis dibuat & dikirim via WA

# Contoh
notify_crm('6281234567890', 150000, 'QRIS', 'TRX-001', 'Budi')
```

---

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---|---|---|
| `"No matching deal found"` | Tidak ada deal terbuka yang cocok | Pastikan deal sudah dibuat di CRM dan belum di-close |
| `"Invalid or missing webhook secret"` | Header `X-Webhook-Secret` salah | Cocokkan dengan env `WEBHOOK_SECRET` di backend |
| Kwitansi dibuat tapi tidak terkirim WA | Kontak tidak punya conversation | Pastikan sudah ada percakapan WA aktif dengan kontak |
| Kwitansi kosong / salah | Receipt config belum diisi | Isi konfigurasi kwitansi di Pengaturan → Kwitansi |
| `amount (number) is required` | Amount bukan number | Kirim amount sebagai number, bukan string |

---

## FAQ

**Q: Apakah deal harus sudah ada di CRM?**
A: Ya. Payment callback akan mencocokkan pembayaran dengan deal yang sudah ada. Jika deal tidak ditemukan, response akan `"No matching deal found"`.

**Q: Bagaimana jika customer bayar tapi belum ada deal?**
A: Buat deal dulu di CRM (bisa manual atau via API), lalu baru kirim payment callback.

**Q: Apakah bisa pakai Midtrans/Flip sekaligus chatbot custom?**
A: Ya. Midtrans dan Flip punya webhook masing-masing (`/api/webhook/midtrans` dan `/api/webhook/flip`). Payment callback (`/api/webhook/payment-callback`) adalah endpoint terpisah untuk integrasi custom apapun.

**Q: Apakah kwitansi bisa di-customize?**
A: Ya. Buka Pengaturan → Kwitansi untuk mengatur nama organisasi, alamat, logo, dll.

**Q: Bagaimana jika pembayaran double (dikirim 2x)?**
A: Request kedua akan mengembalikan `"Deal already WON, payment activity recorded"` — deal tidak di-close ulang, hanya aktivitas payment yang dicatat.
