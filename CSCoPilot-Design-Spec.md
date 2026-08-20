# CSCoPilot — Design Spec untuk Figma

**Versi:** 1.0
**Acuan wireframe:** `CSCoPilot-Wireframe-Dashboard.html`
**Acuan produk:** `PRD-CSCoPilot-Chatbot.md` v0.2
**Ukuran frame:** Desktop 1440×900, Mobile 390×844

Dokumen ini berisi semua nilai yang dibutuhkan untuk membangun file Figma. Setiap angka di sini sudah dipakai di wireframe, jadi hasil Figma akan konsisten dengan yang sudah dilihat stakeholder.

---

## 1. Cara memakai dokumen ini di Figma

Urutan pengerjaan yang paling cepat:

1. Buat **Color styles** dari tabel di Bagian 2.
2. Buat **Text styles** dari tabel di Bagian 3.
3. Buat **Effect styles** dan **Corner radius** dari Bagian 4–5.
4. Buat **Components** dari Bagian 6 (button, badge, card, input, avatar, chat bubble).
5. Susun **Layout** halaman dari Bagian 7 memakai komponen di atas.
6. Buat **Prototype flow** dari Bagian 8.

Jangan menggambar bebas. Semua warna dan ukuran diambil dari styles, supaya kalau nanti ada perubahan cukup diubah di satu tempat.

---

## 2. Color styles

Buat sebagai Figma color styles dengan nama persis seperti kolom "Nama style". Titik dua (`/`) membuat folder otomatis di Figma.

### Brand

| Nama style | Hex | Dipakai untuk |
|---|---|---|
| `Brand/Primary` | `#10AF13` | Tombol utama, logo, avatar, bubble user, accent |
| `Brand/Primary Hover` | `#0C8C10` | State hover tombol, teks accent di atas background terang |
| `Brand/Primary Soft` | `#EFFAF0` | Background nav item aktif, background chip lembut |
| `Brand/Primary Line` | `#C6E8C9` | Border kartu profil, border chip accent |
| `Brand/Primary Deep` | `#0C4A0E` | Ujung gelap gradient panel login |

### Neutral

| Nama style | Hex | Dipakai untuk |
|---|---|---|
| `Neutral/Background` | `#F7FAF8` | Background aplikasi (area konten) |
| `Neutral/Surface` | `#FFFFFF` | Kartu, sidebar, topbar, composer |
| `Neutral/Ink` | `#142016` | Teks utama, judul |
| `Neutral/Muted` | `#647568` | Teks sekunder, label, placeholder |
| `Neutral/Line` | `#DFE8E0` | Semua border dan garis pemisah |
| `Neutral/Track` | `#EEF3EF` | Track bar chart di dashboard |
| `Neutral/Label` | `#94A3B8` | Label uppercase kecil (RECENT, COBA TANYAKAN) |
| `Neutral/Hover` | `#F1F5F2` | Background hover item sidebar |
| `Neutral/Login BG` | `#0F172A` | Background gelap halaman login |

### Semantic

| Nama style | Hex | Dipakai untuk |
|---|---|---|
| `Semantic/Success` | `#059669` | Teks status berhasil |
| `Semantic/Warning BG` | `#FFFBEB` | Background blok klarifikasi dan alert |
| `Semantic/Warning Line` | `#FDE68A` | Border blok klarifikasi dan alert |
| `Semantic/Warning Ink` | `#92400E` | Teks di dalam blok klarifikasi |
| `Semantic/Warning Ink Strong` | `#78350F` | Judul tebal di dalam blok klarifikasi |

### Error

| Nama style | Hex | Dipakai untuk |
|---|---|---|
| `Error/BG` | `#FEF2F2` | Background alert login gagal |
| `Error/Line` | `#FECACA` | Border alert login gagal |
| `Error/Ink` | `#991B1B` | Teks isi alert |
| `Error/Ink Strong` | `#7F1D1D` | Judul alert |
| `Error/Field Line` | `#FCA5A5` | Border input yang bermasalah |
| `Error/Focus Ring` | `#FEE2E2` | Focus ring input yang bermasalah |
| `Error/Message` | `#B91C1C` | Teks error kecil di bawah input |

### Badge

| Nama style | Hex | Dipakai untuk |
|---|---|---|
| `Badge/Neutral BG` | `#E2E8F0` | Background badge default, avatar user di bubble |
| `Badge/Neutral Ink` | `#334155` | Teks badge default |
| `Badge/Green BG` | `#CDEECF` | Background badge kategori source |
| `Badge/Green Ink` | `#0C8C10` | Teks badge kategori source |
| `Badge/Amber BG` | `#FEF3C7` | Background badge perhatian |
| `Badge/Amber Ink` | `#92400E` | Teks badge perhatian |

### Gradient

`Login/Brand Panel` — Linear gradient 135°, dari `#10AF13` (0%) ke `#0C4A0E` (100%).

---

## 3. Text styles

**Typeface:** Inter. Fallback bila Inter tidak tersedia: Segoe UI.
**Base size:** 14px. **Base line-height:** 1.5.

| Nama style | Size | Weight | Line height | Letter spacing | Warna default | Dipakai untuk |
|---|---|---|---|---|---|---|
| `Display/Login` | 38 | 700 | 1.15 | −0.02em | Putih | Headline panel login |
| `Heading/XL` | 30 | 700 | 1.2 | 0 | `Neutral/Ink` | Judul form login |
| `Heading/L` | 24 | 700 | 1.25 | −0.02em | `Neutral/Ink` | Judul empty state |
| `Heading/M` | 19 | 750 | 1.3 | 0 | `Neutral/Ink` | Judul halaman di topbar |
| `Heading/S` | 16 | 700 | 1.3 | 0 | `Neutral/Ink` | Nama brand di sidebar |
| `Heading/XS` | 15 | 700 | 1.35 | 0 | `Neutral/Ink` | Judul section dashboard |
| `Stat/Value` | 30 | 750 | 1.1 | −0.02em | `Neutral/Ink` | Angka besar di stat card |
| `Body/Default` | 14 | 400 | 1.5 | 0 | `Neutral/Ink` | Teks umum |
| `Body/Chat` | 14 | 400 | 1.75 | 0 | `Neutral/Ink` | Isi chat bubble (lebih lega untuk dibaca) |
| `Body/Strong` | 14 | 650 | 1.5 | 0 | `Neutral/Ink` | Tombol, penekanan |
| `Body/S` | 13 | 400 | 1.6 | 0 | `Neutral/Muted` | Teks pendukung, isi alert |
| `Body/S Strong` | 13 | 700 | 1.2 | 0 | `Neutral/Ink` | Nama user di kartu profil |
| `Caption` | 12 | 400 | 1.5 | 0 | `Neutral/Muted` | Teks kecil, isi source chip |
| `Caption/Strong` | 12 | 700 | 1.3 | 0 | `Brand/Primary` | Eyebrow di topbar |
| `Micro` | 11 | 400 | 1.5 | 0 | `Neutral/Muted` | Timestamp, catatan bawah |
| `Micro/Strong` | 11 | 700 | 1.3 | 0 | `Badge/Neutral Ink` | Teks badge |
| `Label/Uppercase` | 10 | 700 | 1.4 | 0.16em | `Neutral/Label` | RECENT, COBA TANYAKAN, label stat card |

**Aturan penting:** teks label uppercase (`Label/Uppercase`) selalu ditulis huruf besar semua di layer teksnya — jangan mengandalkan efek visual saja.

---

## 4. Corner radius

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `radius/full` | 999 | Badge, suggestion chip, avatar bulat, kartu user di topbar, bar chart |
| `radius/xl` | 18 | Kotak login |
| `radius/lg` | 16 | Composer box |
| `radius/base` | 14 | Kartu, panel, chat bubble, logo |
| `radius/md` | 12 | Kartu profil, tombol send, logo kecil |
| `radius/sm` | 10 | Input, tombol, alert, blok klarifikasi |
| `radius/xs` | 9 | Source chip, item sidebar |
| `radius/tail` | 4 | Sudut "ekor" chat bubble (kiri-atas untuk bot, kanan-atas untuk user) |

---

## 5. Effect styles (shadow)

| Nama style | Nilai | Dipakai untuk |
|---|---|---|
| `Shadow/Card Profile` | X 0, Y 4, Blur 14, `#10AF13` 6% | Kartu profil di sidebar |
| `Shadow/Login Box` | X 0, Y 25, Blur 70, `#000000` 33% | Kotak login |
| `Shadow/Focus Ring` | X 0, Y 0, Blur 0, Spread 3, `#D9F3DB` | State focus input dan composer |

---

## 6. Components

Buat setiap item di bawah sebagai Figma Component dengan Variants sesuai kolom "Variant".

### 6.1 Button

| Properti | Nilai |
|---|---|
| Padding | 12 atas/bawah, 15 kiri/kanan |
| Radius | `radius/sm` (10) |
| Text style | `Body/Strong` |
| Gap ikon–teks | 8 |
| Height | Hug (hasil ±44) |

| Variant | Fill | Teks | Border |
|---|---|---|---|
| `Primary / Default` | `Brand/Primary` | Putih | — |
| `Primary / Hover` | `Brand/Primary Hover` | Putih | — |
| `Soft / Default` | `Brand/Primary Soft` | `Brand/Primary Hover` | 1px `Brand/Primary Line` |
| `Soft / Hover` | `#DFF5E0` | `Brand/Primary Hover` | 1px `Brand/Primary Line` |

### 6.2 Send button

Ukuran tetap 40×40, radius `radius/md` (12), fill `Brand/Primary`, ikon panah putih 16px, rata tengah. Variant `Hover` memakai `Brand/Primary Hover`; variant `Disabled` memakai fill `#CBD5E1`.

### 6.3 Suggestion chip

| Properti | Nilai |
|---|---|
| Padding | 9 atas/bawah, 16 kiri/kanan |
| Radius | `radius/full` |
| Fill | `Neutral/Surface` |
| Border | 1px `Neutral/Line` |
| Text style | `Caption` ukuran 12.5, warna `Neutral/Muted` |

Variant `Hover`: border `Brand/Primary Line`, fill `Brand/Primary Soft`, teks `Brand/Primary Hover`.

### 6.4 Badge

| Properti | Nilai |
|---|---|
| Padding | 3 atas/bawah, 9 kiri/kanan |
| Radius | `radius/full` |
| Text style | `Micro/Strong` |

Variant: `Neutral` (`Badge/Neutral BG` + `Badge/Neutral Ink`), `Green` (`Badge/Green BG` + `Badge/Green Ink`), `Amber` (`Badge/Amber BG` + `Badge/Amber Ink`).

### 6.5 Input field

| Properti | Nilai |
|---|---|
| Padding | 12 atas/bawah, 14 kiri/kanan |
| Radius | `radius/sm` (10) |
| Fill | `Neutral/Surface` |
| Border | 1px `Neutral/Line` |
| Text style | `Body/Default` |
| Label di atas | `Micro/Strong`, warna `Neutral/Muted`, jarak ke input 6 |

Variant `Focus`: border `Brand/Primary` + effect `Shadow/Focus Ring`.

Variant `Error`: border 1px `Error/Field Line`, effect focus `Error/Focus Ring`. Label di atas berubah warna `Error/Message`. Tambahkan teks kecil (`Micro`, warna `Error/Message`) di bawah input untuk pesan spesifik ("Masukkan email perusahaan Anda.").

### 6.5b Form alert (login gagal)

Dipakai di atas form login saat kredensial salah. Sembunyikan secara default (komponen ini hanya tampil pada state error).

| Properti | Nilai |
|---|---|
| Padding | 13 atas/bawah, 15 kiri/kanan |
| Radius | `radius/sm` (10) |
| Fill | `Error/BG` |
| Border | 1px `Error/Line` |
| Layout | Horizontal, gap 10, ikon `⚠` di kiri rata atas |
| Judul | `Body/S` bold, warna `Error/Ink Strong` |
| Isi | `Body/S`, warna `Error/Ink` |

Teks default: judul "Email atau password salah", isi "Periksa kembali email dan password Anda, lalu coba lagi." Jarak dari alert ke field pertama sama seperti jarak antar field (18).

### 6.6 Avatar

| Variant | Ukuran | Radius | Fill | Teks |
|---|---|---|---|---|
| `Circle / Sidebar` | 34×34 | `radius/full` | `Brand/Primary` | Putih, 11px bold |
| `Circle / Topbar` | 32×32 | `radius/full` | `Brand/Primary` | Putih, 11px bold |
| `Square / Bot` | 30×30 | `radius/xs` (9) | `Brand/Primary` | Putih, 14px bold — isi `✦` |
| `Square / User` | 30×30 | `radius/xs` (9) | `Badge/Neutral BG` | `Badge/Neutral Ink`, 14px bold |

### 6.7 Chat bubble

Lebar maksimum 88% dari kolom chat. Jarak avatar ke bubble 12.

| Variant | Fill | Border | Teks | Radius |
|---|---|---|---|---|
| `Bot` | `Neutral/Surface` | 1px `Neutral/Line` | `Body/Chat`, `Neutral/Ink` | 14, kecuali kiri-atas 4 |
| `User` | `Brand/Primary` | 1px `Brand/Primary` | `Body/Chat`, Putih | 14, kecuali kanan-atas 4 |

Padding bubble: 14 atas/bawah, 16 kiri/kanan.

### 6.8 Source chip

Dipakai di dalam bubble bot untuk menampilkan referensi.

| Properti | Nilai |
|---|---|
| Padding | 8 atas/bawah, 11 kiri/kanan |
| Radius | `radius/xs` (9) |
| Fill | `#F8FAFC` |
| Border | 1px `Neutral/Line` |
| Layout | Horizontal, gap 8, item rata tengah |
| Isi | Ikon dokumen → judul source (`Caption` bold, `Neutral/Ink`) → Badge `Green` di ujung kanan |

Jarak antar source chip 6. Jarak dari teks jawaban ke chip pertama 12.

### 6.9 Clarification block

Dipakai saat chatbot meminta informasi tambahan.

| Properti | Nilai |
|---|---|
| Padding | 12 atas/bawah, 14 kiri/kanan |
| Radius | `radius/sm` (10) |
| Fill | `Semantic/Warning BG` |
| Border | 1px `Semantic/Warning Line` |
| Judul | `Body/S` bold, warna `Semantic/Warning Ink Strong`, jarak ke isi 2 |
| Isi | `Body/S`, warna `Semantic/Warning Ink` |

### 6.10 Card / Panel

| Properti | Nilai |
|---|---|
| Padding | 22 atas/bawah, 24 kiri/kanan |
| Radius | `radius/base` (14) |
| Fill | `Neutral/Surface` |
| Border | 1px `Neutral/Line` |

Varian `Stat card` memakai padding 18/20 dan isi: label (`Label/Uppercase`) → jarak 8 → angka (`Stat/Value`) → jarak 6 → keterangan (`Caption`, `Neutral/Muted`).

### 6.11 Sidebar nav item

| Properti | Nilai |
|---|---|
| Padding | 11 atas/bawah, 12 kiri/kanan |
| Radius | `radius/xs` (9) |
| Gap ikon–teks | 10 |
| Text style | `Body/Default` weight 600 |

Variant `Default`: teks `Neutral/Muted`, fill transparan.
Variant `Hover`: fill `Neutral/Hover`, teks `Neutral/Ink`.
Variant `Active`: fill `Brand/Primary Soft`, teks `Brand/Primary Hover`.

### 6.12 Thread item (riwayat percakapan)

| Properti | Nilai |
|---|---|
| Padding | 10 atas/bawah, 12 kiri/kanan |
| Radius | `radius/xs` (9) |
| Jarak antar item | 2 |
| Baris 1 | `Body/Default`, `Neutral/Ink`, potong dengan ellipsis bila panjang |
| Baris 2 | `Micro`, `Neutral/Muted`, jarak dari baris 1 = 2 |

Variant `Active`: fill `Brand/Primary Soft`, baris 1 jadi weight 600 warna `Brand/Primary Hover`.

---

## 7. Layout halaman

### 7.1 Struktur global (desktop 1440×900)

| Area | Ukuran |
|---|---|
| Sidebar | Lebar tetap 270, tinggi penuh, fill `Neutral/Surface`, border kanan 1px `Neutral/Line` |
| Topbar | Tinggi tetap 80, fill `Neutral/Surface`, border bawah 1px `Neutral/Line`, padding kiri/kanan 32 |
| Area konten | Sisa ruang, fill `Neutral/Background` |

Gunakan Auto Layout horizontal untuk `Sidebar + Main`, lalu Auto Layout vertikal di dalam `Main` untuk `Topbar + Konten`.

### 7.2 Isi sidebar (dari atas ke bawah)

1. **Brand block** — tinggi 80, padding kiri/kanan 26, border bawah 1px `Neutral/Line`. Isi: logo 40×40 radius 12 fill `Brand/Primary` berisi `✦` → gap 12 → teks "CSCoPilot" (`Heading/S`) dengan subteks "Support chatbot" (`Micro`).
2. **Nav** — padding 16 atas, 14 kiri/kanan. Item: `▤ Dashboard`, `✦ Chatbot`. Gap antar item 2.
3. **Tombol New chat** — margin 8 atas, 14 kiri/kanan; komponen Button variant `Soft`, lebar penuh, teks "＋ New chat".
4. **Riwayat** — label "RECENT" (`Label/Uppercase`, padding 14 atas / 6 kiri) lalu daftar Thread item. Area ini yang memanjang dan bisa di-scroll.
5. **Kartu profil** — menempel di bawah. Border atas 1px `Neutral/Line`, padding 15. Isi kartu: padding 12, radius `radius/md`, border 1px `Brand/Primary Line`, effect `Shadow/Card Profile`. Susunan: Avatar `Circle/Sidebar` → gap 10 → nama (`Body/S Strong`) + role (`Micro`) → tombol keluar `↪` di ujung kanan.

### 7.3 Topbar

Kiri: eyebrow "Customer Support Timedoor Indonesia" (`Caption/Strong`) → jarak 2 → judul halaman (`Heading/M`).

Kanan: **kartu user yang sedang login**. Radius `radius/full`, border 1px `Neutral/Line`, fill `Neutral/Surface`, padding 6 kiri / 14 kanan / 6 atas-bawah, gap 10. Isi: Avatar `Circle/Topbar` → nama user (`Body/S Strong` ukuran 12.5) + role (`Micro`).

### 7.4 Halaman Login (frame terpisah 1440×900)

Background `Neutral/Login BG`, kotak login rata tengah.

Kotak login: lebar maksimum 940, radius `radius/xl` (18), effect `Shadow/Login Box`, dua kolom dengan rasio `1.05 : 0.95`.

- **Kolom kiri** — fill gradient `Login/Brand Panel`, padding 58. Isi: logo + nama brand di atas, headline `Display/Login` didorong ke bawah, lalu paragraf penjelasan (`Body/Default`, warna `#D9F3DB`).
- **Kolom kanan** — fill putih, padding 58. Isi berurutan: eyebrow "Internal System" (`Caption/Strong`) → judul "Welcome back" (`Heading/XL`) → subteks (`Body/Default`, `Neutral/Muted`) → Input "Email perusahaan" → Input "Password" → Dropdown "Masuk sebagai" → Button `Primary` lebar penuh "Masuk →" → catatan kecil rata tengah (`Micro`, `Neutral/Label`).

Jarak antar field 18. Jarak field terakhir ke tombol 22.

### 7.4b Halaman Login — state error (frame terpisah 1440×900)

Duplikat frame Login, ubah hanya kolom kanan. Layout, ukuran, dan posisi tombol tidak berubah — supaya prototype terasa seperti satu halaman yang sama.

Tiga kondisi error yang perlu digambar:

| Kondisi | Yang muncul |
|---|---|
| Field kosong | Input "Email perusahaan" dan/atau "Password" memakai variant `Error`, dengan pesan di bawahnya: "Masukkan email perusahaan Anda." / "Masukkan password Anda." Alert tidak muncul. |
| Email atau password salah | Komponen `Form alert` muncul di antara subteks dan field pertama. Kedua input memakai variant `Error`, tanpa pesan per-field (alert sudah menjelaskan). |
| Akun tidak berwenang | `Form alert` dengan judul "Akun tidak memiliki akses" dan isi "Akun ini belum terdaftar sebagai user internal CSCoPilot. Hubungi Support Lead untuk aktivasi." Input kembali normal. |

Frame yang wajib dibuat minimal satu: kondisi "Email atau password salah". Dua kondisi lain cukup sebagai state di komponen, tidak harus jadi frame sendiri.

Aturan perilaku yang perlu dicatat di Figma (pakai sticky note, bukan digambar): error hilang begitu user mulai mengetik ulang, dan pesan error tidak pernah menyebutkan field mana yang benar — supaya tidak membocorkan email mana yang terdaftar.

### 7.5 Halaman Chatbot

Kolom chat lebar maksimum 760, rata tengah, padding kiri/kanan 24. Jarak antar pesan 22. Padding atas area chat 32.

**Composer** menempel di bawah, fill `Neutral/Surface`, border atas 1px `Neutral/Line`, padding 22 atas / 32 kiri-kanan / 26 bawah. Isi composer disusun vertikal dengan gap 16:

1. Label "COBA TANYAKAN" (`Label/Uppercase`) → jarak 10 → baris Suggestion chip (gap 10, boleh turun ke baris berikutnya).
2. Composer box: border 1px `Neutral/Line`, radius `radius/lg` (16), padding 14 dengan padding kiri 20, gap 14. Isi: area teks yang memanjang + Send button di kanan. State focus: border `Brand/Primary` + `Shadow/Focus Ring`.
3. Catatan bawah rata tengah (`Micro`, `Neutral/Muted`).

**Empty state** (saat percakapan baru): rata tengah, padding atas 60. Isi: kotak ikon 52×52 radius 14 fill `Brand/Primary Soft` berisi `✦` warna `Brand/Primary` → jarak 18 → judul (`Heading/L`) → jarak 8 → paragraf (`Body/Default`, `Neutral/Muted`, lebar maks 420).

### 7.6 Halaman Dashboard

Konten lebar maksimum 1080, rata tengah, padding 32 kiri-kanan / 32 atas / 44 bawah. Jarak antar blok besar 26.

**Blok 1 — Ringkasan.** Judul section (`Heading/XS`) + periode (`Caption`) rata kanan, jarak ke isi 14. Di bawahnya 4 Stat card dalam grid, gap 16, lebar minimum tiap kartu 190 (otomatis menyesuaikan).

Isi stat card: Percakapan `128`, Agent aktif `7`, Jawaban dengan source `86%`, Butuh klarifikasi `19%`.

**Blok 2 — Dua kolom**, rasio `1.35 : 1`, gap 20, rata atas.

- **Kolom kiri — Issue paling sering ditanyakan.** Panel berisi daftar baris. Tiap baris: nama issue (memanjang) → bar chart lebar 150 tinggi 7 radius penuh (track `Neutral/Track`, isi `Brand/Primary`) → angka lebar 32 rata kanan (`Caption`, angka rata kolom). Padding tiap baris 11 atas/bawah, dipisah garis 1px `Neutral/Line` kecuali baris terakhir.
- **Kolom kanan** — dua panel bertumpuk, gap 20:
  - *Status sinkronisasi Notion*: daftar baris label–nilai, gap 12. Label `Body/S` warna `Neutral/Muted`, nilai `Body/Default` bold. Baris status memakai Badge `Green`.
  - *Perlu perhatian*: berisi komponen Alert (padding 15, radius `radius/sm`, fill `Semantic/Warning BG`, border 1px `Semantic/Warning Line`, judul bold `Semantic/Warning Ink Strong`).

**Blok 3 — Catatan scope.** Kotak dengan border putus-putus 1px `Neutral/Line`, radius `radius/sm`, padding 14/16, teks `Caption` warna `Neutral/Muted`. Isinya menjelaskan bahwa analytics lanjutan berada di luar scope MVP.

### 7.7 Mobile (390×844)

- Sidebar disembunyikan, dibuka lewat tombol menu.
- Topbar diganti bar tinggi 64 berisi tombol menu `☰` + nama brand.
- Chat bubble lebar maksimum 96%.
- Suggestion chip disusun satu baris yang bisa digeser ke samping.
- Padding dashboard jadi 22 kiri-kanan.
- Kotak login jadi satu kolom; panel gradient disembunyikan; padding form 38/25.

---

## 8. Prototype flow

Buat 4 frame utama dan hubungkan sebagai berikut:

| Dari | Aksi | Ke |
|---|---|---|
| Login | Klik "Masuk →" (pilihan Customer Support, kredensial benar) | Chatbot |
| Login | Klik "Masuk →" (pilihan stakeholder lain, kredensial benar) | Dashboard |
| Login | Klik "Masuk →" (field kosong atau kredensial salah) | Login — state error |
| Login — state error | Klik "Masuk →" (kredensial benar) | Chatbot / Dashboard |
| Chatbot | Klik nav "Dashboard" | Dashboard |
| Dashboard | Klik nav "Chatbot" | Chatbot |
| Chatbot | Klik "＋ New chat" | Chatbot — Empty state |
| Chatbot | Klik tombol keluar `↪` | Login |

**Catatan stat card dashboard:** empat Stat card di Blok 1 (Percakapan, Agent aktif, Jawaban dengan source, Butuh klarifikasi) **tidak diberi link apa pun** di prototype — murni tampilan angka. Halaman detail per-metrik adalah fitur analytics dashboard yang eksplisit di luar scope MVP (lihat Bagian 10).

**Aturan akses yang harus terlihat di prototype:** hanya Customer Support yang memiliki menu Chatbot beserta riwayat percakapan. Management, Project Manager, Product Owner, dan Developer masuk sebagai stakeholder dan hanya melihat Dashboard — menu Chatbot, tombol New chat, dan daftar riwayat tidak ditampilkan untuk mereka.

---

## 9. Konten contoh yang dipakai

Gunakan teks ini persis, supaya Figma dan wireframe menampilkan cerita yang sama saat dipresentasikan.

**Percakapan contoh:**

1. Bot — "Halo, ceritakan issue yang sedang ditangani. Saya akan mencari solusi dari knowledge perusahaan."
2. User — "Customer tidak bisa login setelah mengganti password."
3. Bot — dua kemungkinan penyebab (session lama masih aktif; password baru belum tersinkronisasi), lalu langkah yang disarankan, lalu dua source chip: "Panduan Reset Password" (badge FAQ) dan "Authentication Troubleshooting v2" (badge Troubleshooting).
4. User — "Customer bilang sudah coba incognito, masih gagal juga."
5. Bot — Clarification block: "Butuh informasi tambahan — Apakah customer menerima pesan error tertentu, atau halaman login hanya diam/loading terus?"

**Riwayat percakapan:** Login gagal setelah reset password (Hari ini · 10:24), Pembayaran client gagal diproses (Hari ini · 09:10), SOP keterlambatan respons (Kemarin · 16:40), Template balasan pembuka (Kemarin · 11:02).

**Suggestion chip:** "Cari SOP keterlambatan respons", "Bagaimana menangani pembayaran gagal?", "Template balasan pembuka".

**Topik dashboard:** Login & reset password (42), Pembayaran gagal diproses (27), Keterlambatan respons (19), Permintaan template balasan (14), Akses akun terkunci (9).

---

## 10. Batas scope desain

Jangan menggambar layar berikut. Semuanya berada di luar scope MVP menurut PRD, dan menambahkannya akan membuat ekspektasi stakeholder melebihi yang akan dibangun:

- Halaman Knowledge Hub dan halaman detail dokumen.
- Modul AI Response Assistant terpisah.
- Area draft balasan, tombol generate/regenerate/copy/approve, dan status approval.
- Grafik tren, filter lanjutan, dan export pada dashboard.
- Layar integrasi WhatsApp, Zendesk, Freshdesk, atau Slack.
- Tampilan aplikasi mobile native.
- Layar chatbot untuk customer.

Dashboard yang ada di spec ini terbatas pada ringkasan operasional (volume percakapan, topik, kualitas source, status sync). Selebihnya menyusul setelah pilot.
