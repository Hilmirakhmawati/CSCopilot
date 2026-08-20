# Inwan Store — Notion Knowledge (Draft)

Siap copy-paste ke Notion. Struktur per page + isi awal.

Tanda `[PERLU DIKONFIRMASI]` = harus dicek ke Figma / ke sistem asli sebelum dipakai chatbot.
Jangan ubah status page ke **Active** selama masih ada tanda ini.

---

## Struktur folder Notion

```
Inwan Store Knowledge
├── 00 — Knowledge Control
├── 01 — Project Overview
├── 02 — SOP Account & Login
├── 03 — SOP Pesanan & Pembayaran
├── 04 — SOP Pengiriman
├── 05 — SOP Pengembalian & Refund
├── 06 — Escalation Matrix
├── 07 — Response Rules
├── 08 — FAQ Customer
├── 09 — Glossary
└── 10 — Change Log
```

Aktifkan untuk MVP pertama (use case: login & account):

```
00, 01, 02, 06, 07
```

Sisanya Draft dulu.

---

# Page: 00 — Knowledge Control

# Knowledge Control — Inwan Store

## Status Dokumen

| Status | Arti | Boleh dipakai chatbot? |
|---|---|---|
| Draft | Sedang dibuat | Tidak |
| Review | Menunggu dicek | Tidak |
| **Active** | Disetujui | **Ya** |
| Archived | Tidak berlaku | Tidak |

## Aturan

1. Hanya dokumen **Active** yang boleh jadi source jawaban chatbot.
2. Setiap dokumen wajib punya Owner, Reviewer, Last reviewed, Status.
3. Dokumen usang dipindah ke Archive, tidak dihapus.
4. Semua perubahan dicatat di `10 — Change Log`.
5. Dilarang menyimpan di page: password, OTP, API key, token, data pribadi customer.

## Daftar Dokumen (buat sebagai Notion database/table)

| Dokumen | Kategori | Status | Owner | Reviewer | Last reviewed | Versi |
|---|---|---|---|---|---|---|
| 01 — Project Overview | Umum | Draft | [nama kamu] | [nama] | 14 Agu 2026 | 1.0 |
| 02 — SOP Account & Login | Account | Draft | [nama kamu] | [nama] | 14 Agu 2026 | 1.0 |
| 06 — Escalation Matrix | Umum | Draft | [nama kamu] | [nama] | 14 Agu 2026 | 1.0 |
| 07 — Response Rules | Umum | Draft | [nama kamu] | [nama] | 14 Agu 2026 | 1.0 |

---

# Page: 01 — Project Overview

# Inwan Store — Project Overview

## Informasi Dasar

- **Nama project:** Inwan Store
- **Jenis:** [PERLU DIKONFIRMASI — toko online / marketplace / storefront satu brand?]
- **Deskripsi singkat:** [PERLU DIKONFIRMASI]
- **Target customer:** [PERLU DIKONFIRMASI]

## Platform

- **Website:** [PERLU DIKONFIRMASI — URL]
- **Mobile app:** [PERLU DIKONFIRMASI — ada / tidak]
- **Admin/dashboard internal:** [PERLU DIKONFIRMASI — URL, siapa yang boleh akses]

## Fitur Utama (isi dari Figma)

- [PERLU DIKONFIRMASI — daftar layar/fitur: home, katalog, product detail, cart, checkout, payment, order tracking, profile, dll.]

## Metode Pembayaran

- [PERLU DIKONFIRMASI — transfer bank, VA, e-wallet, COD, kartu?]

## Pengiriman

- [PERLU DIKONFIRMASI — kurir yang dipakai, estimasi, area layanan]

## Tim Terkait

- Customer Support
- Project Manager: [nama]
- Developer: [nama]
- Internal System Team: [nama/tim]
- [Tim lain — PERLU DIKONFIRMASI]

## Owner

- Project owner: [nama]
- Knowledge owner: [nama]
- Support reviewer: [nama]
- Status: Draft
- Last reviewed: 14 Agustus 2026

---

# Page: 02 — SOP Account & Login

> Ini page utama untuk use case MVP pertama.

# SOP Account & Login — Inwan Store

## Issue yang Dicakup

1. Customer tidak bisa login
2. Lupa password
3. Email reset tidak diterima
4. Akun terkunci
5. Login sosial media gagal [PERLU DIKONFIRMASI — ada login Google/Facebook?]
6. Verifikasi email/OTP [PERLU DIKONFIRMASI — alur registrasi seperti apa di Figma?]
7. Ubah email / nomor HP

## Issue 1 — Customer Tidak Bisa Login

### Kemungkinan Penyebab

- Email atau password salah
- Masih memakai password lama setelah reset
- Session lama masih aktif
- Akun terkunci karena terlalu banyak percobaan gagal [PERLU DIKONFIRMASI — ada limit percobaan? berapa?]
- Gangguan sistem

### Informasi yang Ditanyakan ke Customer

1. Email yang dipakai (JANGAN minta password)
2. Pesan error persis yang muncul [PERLU DIKONFIRMASI — daftar pesan error di Figma]
3. Apakah baru ganti password
4. Browser/device yang dipakai
5. Apakah sudah coba device lain
6. Kapan mulai terjadi

### Langkah Penyelesaian

1. Pastikan email terdaftar [PERLU DIKONFIRMASI — CS bisa cek email customer di admin? bagaimana caranya?]
2. Pastikan customer memakai password terbaru
3. Minta customer logout dari semua perangkat
4. Minta customer coba browser incognito / clear cache
5. Jika masih gagal → arahkan reset password (Issue 2)
6. Jika akun terkunci → Issue 4
7. Jika tetap gagal → eskalasi (lihat 06 — Escalation Matrix)

### Jangan Dilakukan

- Jangan minta password customer
- Jangan minta kode OTP customer
- Jangan klaim "sistem sedang down" tanpa pengecekan
- Jangan janji waktu penyelesaian tanpa konfirmasi

## Issue 2 — Lupa Password

### Langkah (sesuai alur di Figma — PERLU DIKONFIRMASI)

1. Buka halaman login Inwan Store
2. Klik [PERLU DIKONFIRMASI — label tombol: "Forgot password?"]
3. Masukkan email terdaftar
4. Cek inbox + folder spam
5. Buka link reset [PERLU DIKONFIRMASI — link atau kode OTP? berapa lama kedaluwarsa?]
6. Buat password baru [PERLU DIKONFIRMASI — aturan password minimal]
7. Login ulang

## Issue 3 — Email Reset Tidak Diterima

### Langkah

1. Pastikan email benar
2. Cek folder spam/promosi
3. Tunggu [PERLU DIKONFIRMASI — berapa menit?]
4. Minta ulang email reset
5. Jika tetap tidak ada → eskalasi ke Internal System Team

## Issue 4 — Akun Terkunci

### Tanda

- [PERLU DIKONFIRMASI — pesan error yang muncul di Figma]

### Tindakan

1. Jangan minta customer terus mencoba login
2. Catat: email customer, pesan error, waktu kejadian, device
3. [PERLU DIKONFIRMASI — prosedur unlock: otomatis setelah X menit? CS bisa unlock dari admin? harus eskalasi?]

## Issue 5 — Ubah Email / Nomor HP

[PERLU DIKONFIRMASI — apakah customer bisa self-service dari profile, atau harus lewat CS?]

## Data Wajib untuk Eskalasi

- Email customer (tanpa password)
- Pesan error
- Waktu kejadian
- Browser & device
- Langkah yang sudah dicoba
- Screenshot jika perlu

## Owner

- Owner: [nama] — Reviewer: [nama] — Status: **Draft** — Last reviewed: 14 Agustus 2026

---

# Page: 06 — Escalation Matrix

# Escalation Matrix — Inwan Store

| Jenis Issue | Tim Tujuan | Data Wajib | Prioritas |
|---|---|---|---|
| Login gagal setelah semua langkah dicoba | Internal System Team | Email, pesan error, waktu, device, langkah yang dicoba | Medium |
| Akun terkunci perlu unlock manual | Internal System Team | Email, waktu kejadian | Medium |
| Email reset tidak terkirim | Internal System Team | Email, waktu request, hasil cek spam | Medium |
| Pembayaran gagal / saldo terpotong status gagal | [PERLU DIKONFIRMASI — tim payment?] | ID order, ID transaksi, nominal, waktu, metode bayar | **High** |
| Refund tidak masuk | [PERLU DIKONFIRMASI] | ID order, bukti refund, waktu | High |
| Pesanan tidak sampai / salah barang | [PERLU DIKONFIRMASI — tim fulfillment?] | ID order, kurir, resi, foto | Medium |
| Bug website/app | Developer | URL/layar, screenshot, device, langkah reproduksi | Medium |
| Banyak customer kena masalah sama | Project Manager + Developer | Jumlah customer, waktu mulai, contoh kasus | **High** |

## Aturan Eskalasi

- Jangan kirim password/OTP customer
- Data wajib harus lengkap sebelum diteruskan
- Gunakan channel resmi: [PERLU DIKONFIRMASI — channel apa?]
- Catat waktu eskalasi

---

# Page: 07 — Response Rules

# Response Rules — Inwan Store

## Format Jawaban Chatbot

Setiap jawaban harus berisi:

1. **Kemungkinan penyebab** — didukung source
2. **Langkah pengecekan** — berurutan
3. **Solusi** — sesuai SOP
4. **Kapan eskalasi** — kondisi + tim tujuan
5. **Source** — judul dokumen + tanggal update

## Aturan Keras

1. Jawaban hanya dari dokumen berstatus **Active**
2. Tidak ada source → katakan: *"Saya belum menemukan prosedur yang sesuai di knowledge Inwan Store. Silakan lakukan pengecekan manual atau eskalasi ke tim terkait."*
3. Informasi kurang → minta klarifikasi, jangan menebak
4. Dilarang mengarang prosedur yang tidak ada di source
5. Dilarang meminta password / OTP customer
6. Dilarang memakai SOP project lain
7. Dilarang janji kompensasi/refund tanpa SOP
8. Chatbot tidak mengirim apa pun ke customer — Customer Support yang memutuskan

---

# Page: 10 — Change Log

# Change Log

| Tanggal | Dokumen | Perubahan | Alasan | Oleh | Direview |
|---|---|---|---|---|---|
| 14 Agu 2026 | Semua | Pembuatan awal draft | Persiapan CSCoPilot MVP | [nama] | — |

---

## Checklist sebelum status → Active

- [ ] Semua `[PERLU DIKONFIRMASI]` sudah diisi
- [ ] Label tombol & pesan error dicek langsung dari Figma Inwan Store
- [ ] Prosedur internal (unlock akun, cek email di admin) diisi dari sistem asli
- [ ] Nama tim eskalasi sesuai struktur asli
- [ ] 1–2 CS sudah review bahasa dan langkah
- [ ] Change Log diisi
