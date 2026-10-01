# Improvement Plan CS CoPilot

Dokumen acuan product + development. Bahasa sengaja non-engineering.

Batasan tetap: AI **hanya** punya Knowledge Base (Notion). AI **tidak** punya akses database, API, account, order, atau production. Tidak ada rencana integrasi database/API di plan ini.

---

## 1. Current Problem

Contoh sekarang:

| Giliran | Yang terjadi | Masalah |
|---|---|---|
| CS: "Kenapa saldo poin 0?" | AI menjelaskan isi knowledge + source | Sudah benar, tapi berhenti di penjelasan umum. CS tidak tahu harus ngapain. |
| CS: "berikut nomor akunnya 018381492" | AI: "Informasi akun sudah diterima. Tim kami akan memeriksa kasus ini dan memverifikasi data terkait." | (1) Terdengar seperti AI/tim sudah akan cek, padahal AI tidak punya akses. (2) Tidak ada langkah cek konkret. (3) Tidak ada Suggested Reply yang berguna. (4) Jawaban generik, bisa dipakai untuk issue apa saja. |

Kelemahan lain yang ditemukan di code saat ini:

1. **Kalimat "akan memeriksa" ditulis dengan suara AI/tim**, bukan sebagai langkah untuk CS. Termasuk kalimat konfirmasi akun yang baru saja saya tambahkan ("Tim kami akan memeriksa saldo poin customer...") ikut melanggar prinsip ini dan harus diganti di Phase 1.
2. **Nomor akun/order diperlakukan sebagai "syarat yang terpenuhi"**, lalu jawaban selesai. Seharusnya nomor itu hanya **info case** yang dipakai untuk menyusun langkah dan balasan.
3. **Tidak ada bagian Next Action.** Knowledge hanya punya `Customer Action` dan `Customer Reply`, tidak ada langkah cek untuk CS.
4. **Satu bentuk jawaban untuk semua situasi.** Pertanyaan umum, known issue, dan case spesifik dijawab dengan pola sama.
5. **Draft balasan tidak membedakan "belum dicek" dan "sudah dicek".**
6. **Tidak ada status jelas saat knowledge kurang.** Hanya panel "Data customer diperlukan" yang membingungkan (data customer siapa? diminta ke siapa?).

---

## 2. Target Behavior

CS CoPilot = **asisten kerja CS**, bukan FAQ bot.

AI yang ideal:

- Menjawab **hanya dari knowledge**, dan menyebut sumbernya.
- Memahami **tahap case**: baru tanya, sudah kasih info case, sudah ada hasil cek dari CS.
- Selalu menutup dengan **"Langkah selanjutnya untuk CS"**, bukan "tim kami akan cek".
- Membuat **Suggested Reply** yang jujur: pengecekan ditulis sebagai *akan dilakukan* (oleh tim CS manusia), bukan *sudah dilakukan*, kecuali CS sendiri melaporkan hasilnya.
- Berkata terus terang saat knowledge tidak cukup, lalu memberi langkah aman yang umum untuk CS (eskalasi / minta info tambahan), tanpa mengarang.

Aturan suara:

| Boleh | Tidak boleh |
|---|---|
| "Perlu diverifikasi lewat Point History." | "Saya akan mengecek akun ini." |
| "Akun 018381492 dicatat sebagai info case." | "Akun 018381492 sudah kami periksa." |
| "Draft ini menjanjikan pengecekan. Pastikan CS benar-benar mengeceknya." | "Saldo sudah dikembalikan." |

---

## 3. Conversation Flow

```
CS bertanya / lapor
      │
      ▼
[1] Deteksi intent (lihat bagian 5)
      │
      ▼
[2] Cari knowledge (Notion → sudah ada: retrieval + project scope)
      │
      ├── tidak ada / tidak cukup ──► "Knowledge belum tersedia" + langkah aman umum + eskalasi
      │
      ▼
[3] Jawaban berbasis knowledge (apa itu, penyebab yang diketahui)
      │
      ▼
[4] Pemahaman case (info apa sudah ada, apa belum)
      │
      ▼
[5] Langkah selanjutnya untuk CS (dari knowledge saja)
      │
      ▼
[6] Suggested Reply (sesuai tahap case)
      │
      ▼
[7] Source + status knowledge
```

Contoh tahapan percakapan saldo poin 0:

| # | CS | AI fokus |
|---|---|---|
| 1 | "Kenapa saldo poin 0?" | Known Issue → Jawaban + Langkah Next Action + minta info case yang berguna + source |
| 2 | "018381492" (angka tanpa label) | Tanya singkat: akun atau pesanan? (tidak menebak) |
| 3 | "akun" | Catat sebagai nomor akun, susun Next Action + Suggested Reply tahap "akan dicek" |
| 4 | "saya cek, ada adjustment manual minggu lalu" | Catat sebagai hasil cek dari CS, susun reply tahap "hasil cek" |
| 5 | "buat balasan yang lebih singkat" | Revisi draft, tidak mengulang penjelasan |

---

## 4. AI Response Structure

Satu struktur tetap, tapi bagian boleh kosong sesuai intent.

```
JAWABAN
  Penjelasan dari knowledge (2–4 kalimat). Tanpa klaim cek data.

PEMAHAMAN CASE
  Info dari CS:   akun 018381492 (diterima, belum diverifikasi)
  Belum ada:      hasil Point History, tanggal kejadian
  Tahap case:     Info diterima – belum dicek

LANGKAH SELANJUTNYA (untuk CS)
  1. Cek saldo poin saat ini
  2. Cek Point History / riwayat transaksi
  3. ...
  (hanya langkah yang ada di knowledge)

SARAN BALASAN
  Draft untuk customer/client, sesuai tahap case.

SUMBER
  Judul artikel Notion + link + "Terakhir diverifikasi: ..."
  Status: Knowledge lengkap / Sebagian / Belum tersedia
```

Aturan tampilan:

- Chat bubble = **Jawaban** saja (singkat).
- Panel samping/bawah = Pemahaman Case, Langkah Selanjutnya, Saran Balasan, Sumber.
- Bagian kosong **tidak ditampilkan** (jangan tampilkan "Langkah selanjutnya: -").
- Nomor akun/order **tidak diulang di Jawaban**; boleh muncul di Saran Balasan karena CS yang kirim ke customer.

---

## 5. Intent Classification

Dipakai untuk memilih bentuk jawaban. Cukup 7 intent.

| Intent | Kapan | Respon utama |
|---|---|---|
| **General Question** | "Apa itu poin?", "Cara kerja voucher?" | Jawaban dari knowledge + source. Next Action opsional. |
| **Known Issue** | "Kenapa saldo poin 0?" (cocok artikel issue) | Jawaban + Next Action + info case yang berguna. |
| **Case-specific Issue** | CS menyebut customer/akun/order tertentu | Pemahaman Case + Next Action + Suggested Reply. |
| **Troubleshooting** | "Terus dicek di mana?", "Langkahnya gimana?" | Hanya Next Action rinci dari knowledge. |
| **Case Update (hasil cek dari CS)** | "Sudah saya cek, saldonya 500 tapi tampil 0" | Catat sebagai fakta dari CS, ubah tahap case, update Next Action + reply. |
| **Suggested Reply Request** | "Buatkan balasan", "yang lebih singkat" | Draft saja. Tidak mengulang jawaban. |
| **Out of Knowledge** | Tidak ada artikel yang cocok | Status "Belum tersedia" + langkah aman umum + eskalasi. |

Tambahan percakapan (sudah ada di code, tetap dipakai): sapaan, penutup, feedback draft, klarifikasi ("itu aja?"), topik lain.

Aturan prioritas: pesan **terbaru** menentukan intent. Riwayat hanya memberi konteks.

---

## 6. Knowledge Base Structure (Notion)

Satu halaman = satu issue/topik. Field baru ditandai ★. Field lama tetap didukung supaya artikel yang sudah ada tidak rusak.

| Field | Fungsi | Status |
|---|---|---|
| Title | Nama issue | ada |
| Category | Points / Login / Payment / Product / Server | ada |
| Project | Project/scope | ada |
| Keywords / Alias ★ | Cara CS menyebut issue ("poin 0", "saldo kosong") | baru |
| Customer Safe Summary | Penjelasan aman ke customer | ada |
| Known Cause ★ | Penyebab yang sudah diketahui (internal) | baru |
| Required Case Info ★ | Info yang perlu dikumpulkan CS (ganti `Required Context`) | baru |
| Troubleshooting Steps ★ | Langkah cek untuk CS, berurutan | baru |
| Escalate When ★ | Kondisi harus eskalasi + ke siapa | baru |
| Customer Reply | Template balasan | ada |
| Do Not Say ★ | Kalimat/klaim yang dilarang untuk issue ini | baru |
| Last Verified ★ | Tanggal terakhir dicek kebenarannya | baru |
| Owner ★ | Siapa yang bertanggung jawab atas isi | baru |

### Template umum

```
Title:               <nama issue>
Category:            <Points | Login | Payment | Product | Server>
Keywords / Alias:    <3–8 cara CS menyebut issue>
Customer Safe Summary:
  <penjelasan singkat, aman dibaca customer>
Known Cause:
  <penyebab yang diketahui, atau "Belum diketahui">
Required Case Info:
  - <info 1>
  - <info 2>
Troubleshooting Steps:
  1. <langkah cek>
  2. <langkah cek>
Escalate When:
  - <kondisi> → <tim/PIC>
Customer Reply:
  <template, pakai tense "akan dicek" bila belum dicek>
Do Not Say:
  - <klaim yang dilarang>
Last Verified:       <tanggal>
Owner:               <nama/tim>
```

### Contoh isi

**Point Balance 0**

```
Keywords: saldo poin 0, poin kosong, poin hilang, poin jadi nol
Customer Safe Summary: Beberapa akun sempat menampilkan saldo poin 0 secara tidak akurat akibat kendala teknis. Saldo disesuaikan setelah audit.
Known Cause: Kendala sinkronisasi saldo.
Required Case Info:
  - Nomor akun (atau email akun)
  - Perkiraan saldo sebelumnya
  - Kapan saldo mulai tampil 0
Troubleshooting Steps:
  1. Cek saldo poin saat ini di akun tersebut.
  2. Cek Point History.
  3. Cek transaksi terkait (pesanan/redeem) di sekitar waktu kejadian.
  4. Cek apakah ada penyesuaian manual.
  5. Bandingkan saldo seharusnya vs saldo yang tampil.
Escalate When:
  - Saldo tampil 0 tapi Point History menunjukkan saldo positif → tim Point/Engineering
  - Selisih tidak bisa dijelaskan transaksi → tim Point/Engineering
Do Not Say: "Saldo sudah dikembalikan", "Poin sudah diperbaiki"
```

**Login Issue**

```
Keywords: tidak bisa login, login gagal, password salah, akun terkunci
Required Case Info: Email/ID akun, pesan error persis, perangkat/browser, kapan mulai terjadi
Troubleshooting Steps:
  1. Pastikan email/ID benar.
  2. Coba reset password sesuai SOP.
  3. Cek apakah akun terkunci (SOP unlock).
  4. Coba perangkat/browser lain.
Escalate When: Reset berhasil tapi tetap gagal login → tim Engineering
Do Not Say: "Akun sudah dibuka kuncinya" (kecuali CS yang melakukan dan melapor)
```

**Payment Issue**

```
Keywords: pembayaran gagal, sudah bayar belum masuk, double charge
Required Case Info: Nomor pesanan, metode bayar, nominal, waktu bayar, bukti bayar
Troubleshooting Steps:
  1. Cek status pembayaran di sistem pembayaran.
  2. Cocokkan nominal dan waktu dengan bukti bayar.
  3. Cek apakah pesanan masih menunggu pembayaran atau sudah kedaluwarsa.
Escalate When: Dana terpotong, pesanan belum berubah status > SLA → tim Finance
Do Not Say: "Dana sudah dikembalikan" / janji refund tanpa persetujuan
```

**Product Issue**

```
Keywords: produk tidak masuk, kode tidak valid, produk tidak sesuai
Required Case Info: Nomor pesanan, kode/nama produk, pesan error, screenshot
Troubleshooting Steps:
  1. Cek status pesanan dan status pengiriman produk.
  2. Cocokkan kode produk dengan pesanan.
  3. Cek apakah ada known issue untuk produk tersebut.
Escalate When: Pesanan sukses tapi produk tidak terkirim → tim Product/Fulfillment
```

**Server Issue**

```
Keywords: aplikasi error, tidak bisa dibuka, down, lemot
Required Case Info: Waktu kejadian, fitur terdampak, pesan error, jumlah customer terdampak
Troubleshooting Steps:
  1. Cek channel status/incident resmi.
  2. Cek apakah ada laporan serupa dalam jam yang sama.
  3. Minta customer coba ulang setelah beberapa menit / perbarui aplikasi.
Escalate When: Banyak laporan serupa, atau tidak ada pengumuman incident → on-call Engineering
Do Not Say: Estimasi waktu pulih tanpa konfirmasi tim teknis
```

Catatan: Jika field `Troubleshooting Steps` kosong, AI **tidak boleh** membuat langkah sendiri. Lihat bagian 8.

---

## 7. Context & Case Information

Semua info dari CS = **info case dari CS**, bukan fakta terverifikasi.

| Info | Perlakuan AI |
|---|---|
| Account number / email | Dicatat sebagai info case. Tidak diklaim valid. Dipakai di Next Action dan Saran Balasan. |
| Order number | Sama. Jangan menebak jenis angka tanpa label; tanya jika ambigu. |
| Product code | Dicatat; dipakai mencocokkan artikel Product. |
| Error message | Dicatat persis. Jika cocok keyword artikel, dipakai untuk memilih artikel. Tidak ditafsirkan di luar knowledge. |
| Screenshot / video | AI tidak bisa melihat. Dicatat sebagai "ada lampiran dari CS". Jangan menyimpulkan isinya. |
| Info tambahan (tanggal, saldo, perangkat) | Dicatat sebagai fakta dari CS, dengan label "menurut CS". |
| Hasil cek dari CS | Mengubah tahap case (bagian 3), dipakai di balasan sebagai fakta dari CS. |

Panel **Pemahaman Case** menampilkan tiga hal:

1. **Info diterima** (dari CS, belum diverifikasi).
2. **Info yang masih berguna** (dari `Required Case Info` yang belum diberikan).
3. **Tahap case**: `Info diterima – belum dicek` → `Sedang dicek CS` → `Ada hasil cek` → `Perlu eskalasi`.

Privasi: nomor akun/email tidak diulang di bubble chat dan tidak disimpan ke log audit dalam bentuk mentah.

---

## 8. Next Action Logic

Aturan keras: **Next Action = salinan/ringkasan `Troubleshooting Steps` dari artikel yang cocok. Tidak ada sumber, tidak ada langkah.**

Urutan keputusan:

1. Artikel cocok dan punya `Troubleshooting Steps` → tampilkan langkah berurutan.
2. Info case dari CS sudah ada → langkah yang sudah terjawab ditandai selesai; tampilkan sisanya.
3. Ada hasil cek dari CS yang memenuhi `Escalate When` → tampilkan "Perlu eskalasi ke <PIC>" dari knowledge.
4. Artikel cocok tapi `Troubleshooting Steps` kosong → tampilkan:
   > "Knowledge untuk issue ini belum punya langkah pengecekan. Saran aman: kumpulkan info case berikut, lalu eskalasi ke PIC terkait."
   (hanya memakai `Required Case Info` dan `Escalate When` bila ada)
5. Tidak ada artikel → status "Belum tersedia", langkah aman umum: kumpulkan info case, cek apakah ada artikel serupa, eskalasi ke atasan/PIC. Tanpa menebak penyebab.

Setiap langkah di UI punya tanda sumber (nomor artikel / link) agar CS bisa cross-check.

---

## 9. Suggested Reply

Draft dibuat dari: `Customer Reply` (template) + tahap case + info case.

| Tahap case | Isi balasan |
|---|---|
| Info diterima – belum dicek | Terima kasih, info akun dicatat, **akan** dicek (riwayat poin + transaksi), kabar menyusul. Tanpa hasil. |
| Ada hasil cek | Menyampaikan hasil **sesuai laporan CS**, langkah berikutnya sesuai knowledge. |
| Perlu eskalasi | Menyampaikan kasus diteruskan ke tim terkait, tanpa janji waktu kecuali ada di knowledge. |
| Out of Knowledge | Terima kasih, kasus dicatat, perlu pengecekan lebih lanjut. Tanpa penyebab karangan. |

Aturan:

- Gaya sapaan mengikuti bahasa CS ("Kak", "Bapak/Ibu" → ikut input atau default netral).
- Hindari kata yang menyatakan hasil: "sudah dicek", "sudah dikembalikan", "sudah normal" kecuali CS yang melaporkan.
- Tampilkan catatan kecil di bawah draft bila draft berisi janji: *"Draft ini menjanjikan pengecekan. Pastikan pengecekan benar-benar dilakukan sebelum dikirim."*
- Kalimat dari `Do Not Say` tidak boleh muncul.
- Tombol revisi: lebih singkat / lebih formal / tanpa sapaan. Revisi tidak mengulang jawaban.

---

## 10. Source & Confidence

**Source** (wajib selama ada knowledge):

- Judul artikel, link Notion, `Last Verified`.
- Jika memakai >1 artikel, semua ditampilkan.
- Jika `Last Verified` > 90 hari, tambah label "Knowledge sudah lama, cek ulang".

**Confidence**: tidak perlu angka/persen (menyesatkan untuk CS). Gunakan **status knowledge** dengan 3 label:

| Status | Arti | Tampilan |
|---|---|---|
| Lengkap | Artikel cocok, ada langkah cek, ada template balasan | hijau |
| Sebagian | Artikel cocok tapi ada field kosong (mis. tanpa langkah cek) | kuning + daftar yang kosong |
| Belum tersedia | Tidak ada artikel yang cocok | merah/abu + langkah aman + eskalasi |

Jika knowledge tidak cukup, AI wajib: (1) bilang apa yang tidak ada, (2) tidak mengarang penyebab, (3) memberi langkah aman umum, (4) menyarankan CS menambahkan artikel (tombol "Lapor knowledge kurang" lebih baik daripada dugaan).

---

## 11. Guardrails

AI **tidak boleh**:

| Larangan | Contoh pelanggaran |
|---|---|
| Hallucination | Menyebut penyebab yang tidak ada di knowledge |
| Fabricated investigation | "Saya sudah cek, saldo Anda 500" |
| Fabricated account data | Menyebut saldo, status, riwayat akun |
| False confirmation | "Sudah diperbaiki", "Refund diproses", "Akun sudah dibuka" |
| Klaim akses | "Tim kami akan mengecek akun 018381492" dengan suara AI sebagai pihak yang mengecek |
| Menebak jenis angka | Mengira angka tanpa label adalah akun |
| Mengulang PII | Menampilkan ulang nomor/email di bubble |
| Janji di luar knowledge | SLA, estimasi waktu, kompensasi tanpa dasar |
| Membocorkan internal | `Known Cause`, `Escalate When` ditulis ke customer |
| Mencampur project | Memakai knowledge Project A untuk case Project B |

Cek otomatis sebelum menampilkan jawaban (pola kata): "sudah kami cek", "sudah diperiksa", "sudah dikembalikan", "sudah diperbaiki", "saya akan mengecek". Jika terdeteksi di suara AI atau di draft tanpa izin CS, ganti dengan versi netral atau tolak output.

---

## 12. Implementation Roadmap

### Phase 1 – Knowledge & Search (fondasi, 1–2 minggu)
- Tambah field Notion: `Keywords/Alias`, `Troubleshooting Steps`, `Escalate When`, `Do Not Say`, `Last Verified`, `Required Case Info`.
- Update sync Notion → Supabase untuk membaca field baru (field lama tetap jalan).
- Isi 5 artikel prioritas (Point 0, Login, Payment, Product, Server).
- Perbaiki kalimat "akan memeriksa" di semua respons deterministic dan prompt Claude.

### Phase 2 – Intent & Case Understanding (1–2 minggu)
- Tambah 7 intent (bagian 5), termasuk **Case Update**.
- Tambah `case_state` (info diterima, info yang kurang, tahap case).
- Panel Pemahaman Case di UI.
- Tes regresi: transkrip saldo poin 0 (angka tanpa label, label "akun", typo, hasil cek dari CS).

### Phase 3 – Next Action (1 minggu)
- Bagian "Langkah selanjutnya" dari `Troubleshooting Steps` + penanda sumber.
- Logika eskalasi dari `Escalate When`.
- Fallback "Sebagian"/"Belum tersedia" tanpa mengarang.

### Phase 4 – Suggested Reply (1 minggu)
- Draft berbasis tahap case + template.
- Catatan peringatan jika draft berisi janji.
- Tombol revisi (singkat / formal).
- Filter kata terlarang + `Do Not Say`.

### Phase 5 – Feedback/Learning (berjalan)
- Tombol 👍/👎 + alasan singkat per jawaban.
- Tombol "Lapor knowledge kurang" → membuat daftar kebutuhan artikel baru.
- Laporan mingguan: pertanyaan "Belum tersedia", artikel dengan 👎 terbanyak, artikel kedaluwarsa.
- AI **tidak** belajar sendiri; perbaikan = update artikel Notion oleh Owner.

---

## 13. Example Before vs After

### Sebelum

> **CS:** Kenapa saldo poin 0?
> **AI:** Beberapa akun sempat menampilkan saldo poin 0 secara tidak akurat akibat kendala teknis. Tim kami melakukan audit dan penyesuaian saldo secara manual. *(Source: Notion)*
>
> **CS:** berikut adalah nomor akunnya 018381492
> **AI:** Informasi akun atau nomor pesanan sudah diterima. Tim kami akan memeriksa kasus ini dan memverifikasi data terkait.

### Sesudah

> **CS:** Kenapa saldo poin 0?
>
> **Jawaban**
> Pernah ada kendala teknis yang membuat beberapa akun menampilkan saldo poin 0 secara tidak akurat. Saldo disesuaikan setelah audit.
>
> **Info case yang berguna**
> Nomor akun, perkiraan saldo sebelumnya, kapan mulai tampil 0.
>
> **Sumber:** Point Balance 0 · Terakhir diverifikasi 12 Sep · Status: Lengkap

> **CS:** 018381492
>
> **Jawaban**
> Mohon pastikan, angka itu nomor akun atau nomor pesanan?

> **CS:** akun
>
> **Jawaban**
> Nomor akun dicatat sebagai info case. Berdasarkan knowledge, penyebab saldo 0 perlu diverifikasi lewat Point History akun tersebut.
>
> **Pemahaman Case**
> - Info dari CS: nomor akun (belum diverifikasi)
> - Belum ada: perkiraan saldo sebelumnya, kapan mulai tampil 0
> - Tahap: Info diterima – belum dicek
>
> **Langkah Selanjutnya (untuk CS)**
> 1. Cek saldo poin saat ini
> 2. Cek Point History
> 3. Cek transaksi terkait
> 4. Cek apakah ada penyesuaian manual
> 5. Bandingkan saldo seharusnya vs yang tampil
> *Eskalasi bila Point History menunjukkan saldo positif tapi tampil 0 → tim Point/Engineering.*
>
> **Saran Balasan**
> "Baik Kak, untuk akun ini akan kami bantu cek terlebih dahulu terkait saldo poinnya. Kami akan memeriksa riwayat poin dan transaksi terkait, lalu kami kabari hasilnya ya, Kak."
> *Draft ini menjanjikan pengecekan. Pastikan pengecekan dilakukan sebelum dikirim.*
>
> **Sumber:** Point Balance 0 · Status: Lengkap

> **CS:** sudah saya cek, ada adjustment manual minggu lalu tapi saldo masih 0
>
> **Pemahaman Case**
> - Hasil cek (menurut CS): ada adjustment manual minggu lalu, saldo tampil 0
> - Tahap: Ada hasil cek → memenuhi kriteria eskalasi
>
> **Langkah Selanjutnya**
> Eskalasi ke tim Point/Engineering dengan: nomor akun, tanggal adjustment, saldo tampil.
>
> **Saran Balasan**
> "Baik Kak, terima kasih infonya. Kasus ini kami teruskan ke tim terkait untuk ditindaklanjuti. Kami kabari lagi setelah ada update ya, Kak."

---

## 14. MVP Recommendation

Fitur paling berdampak dengan kompleksitas terendah:

| # | Fitur | Alasan |
|---|---|---|
| 1 | **Hapus klaim "tim akan memeriksa" dari suara AI** + filter kata terlarang | Menyelesaikan masalah kepercayaan paling besar; hanya perubahan wording/prompt. |
| 2 | **Field `Troubleshooting Steps` + `Escalate When` di Notion**, tampil sebagai **Langkah Selanjutnya** | Ini yang membuat AI terasa berguna untuk CS. |
| 3 | **Panel Pemahaman Case** (info diterima, info kurang, tahap) | Memperlakukan nomor akun sebagai info case, bukan "syarat terpenuhi". |
| 4 | **Saran Balasan sesuai tahap** (akan dicek vs ada hasil) + catatan peringatan | Balasan jujur dan siap pakai. |
| 5 | **Status knowledge: Lengkap / Sebagian / Belum tersedia** + source + Last Verified | CS bisa cross-check dan tahu kapan jangan percaya penuh. |
| 6 | **Intent Case Update** ("sudah saya cek...") | Membuat percakapan terasa nyambung ke hasil kerja CS. |

Tunda (bukan MVP): confidence persen, revisi nada otomatis lengkap, laporan mingguan, tombol feedback detail.

### Ukuran sukses MVP
- 0 respons yang menyatakan AI/tim "sudah/akan mengecek" dengan suara AI.
- ≥ 80% jawaban untuk issue di 5 artikel prioritas punya Langkah Selanjutnya.
- CS menilai draft "bisa dipakai tanpa edit besar" ≥ 70% (tombol 👍/👎).
- 100% jawaban punya source atau status "Belum tersedia".

---

## Lampiran – Pemetaan ke Code

| Perubahan | File |
|---|---|
| Field Notion baru + sync | `lib/notion*`, `lib/knowledge*`, skema Supabase |
| Intent + tahap case | `lib/retrieval.ts` (`pointAnswer`, `continuationSignal`) |
| Struktur output (`case_understanding`, `next_actions`, `knowledge_status`) | `lib/assistant-types.ts` (`GroundedAnswer`) |
| Prompt + guardrail + filter kata | `lib/anthropic.ts` |
| Panel UI | `app/(protected)/assistant/page.tsx` |
| Template penulisan knowledge | `docs/knowledge-authoring.md` |
| Tes regresi | `lib/assistant-check.ts`, `scripts/knowledge-evaluation.json` |
