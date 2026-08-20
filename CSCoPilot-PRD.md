# PRD — CSCoPilot
## AI Decision Support System for Customer Support

**Versi:** MVP
**Durasi:** 1 bulan
**Platform:** Web
**Sumber Requirement:** `Team4-CScopilot.md`
**Project Type:** Internal Business Improvement

---

## Daftar Isi

1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Latar Belakang](#2-latar-belakang)
3. [Tujuan Produk](#3-tujuan-produk)
4. [Non-Goals](#4-non-goals)
5. [Pengguna dan Stakeholder](#5-pengguna-dan-stakeholder)
6. [Nilai Bisnis](#6-nilai-bisnis)
7. [Ruang Lingkup MVP](#7-ruang-lingkup-mvp)
8. [User Journey](#8-user-journey)
9. [Functional Requirements](#9-functional-requirements)
10. [Struktur Data Minimum](#10-struktur-data-minimum)
11. [Business Rules](#11-business-rules)
12. [Rancangan Halaman untuk Design](#12-rancangan-halaman-untuk-design)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [MVP Success Metrics](#15-mvp-success-metrics)
16. [Risiko dan Mitigasi](#16-risiko-dan-mitigasi)
17. [Asumsi](#17-asumsi)
18. [Dependencies](#18-dependencies)
19. [Deliverables](#19-deliverables)
20. [Estimasi Mandays](#20-estimasi-mandays)
21. [Estimasi Komposisi Tim](#21-estimasi-komposisi-tim)
22. [Dasar Perhitungan Budget](#22-dasar-perhitungan-budget)
23. [Rencana Delivery Satu Bulan](#23-rencana-delivery-satu-bulan)
24. [Definition of Done](#24-definition-of-done) ⭐
25. [Test Plan & Checklist](#25-test-plan--checklist)

---

## 1. Ringkasan Produk

CSCoPilot adalah modul AI yang diintegrasikan ke Internal System Timedoor untuk membantu Customer Support bekerja lebih cepat, konsisten, dan efisien dalam menangani tiket.

MVP berfokus pada:

1. **Dashboard Customer Support**
2. **Knowledge Hub**
3. **AI Response Assistant**
4. **Authentication**
5. **Database**

Notion tetap menjadi **single source of truth** untuk dokumentasi perusahaan. CSCoPilot menggunakan informasi yang telah disinkronkan dari Notion tanpa menggantikan atau menduplikasi pusat dokumentasi tersebut.

AI berfungsi sebagai **Decision Support System**, bukan pengambil keputusan. Semua draft balasan wajib ditinjau dan divalidasi Customer Support sebelum digunakan kepada client.

---

## 2. Latar Belakang

Customer Support saat ini masih mencari informasi secara manual dari berbagai sumber, seperti:

- SOP
- FAQ
- Troubleshooting guide
- Template balasan
- Referensi penyelesaian masalah

Informasi yang tersebar menyebabkan:

- Waktu pencarian informasi lebih lama.
- Proses penanganan tiket kurang efisien.
- Jawaban berpotensi tidak konsisten.
- Ketergantungan pada pengalaman individu meningkat.
- Risiko human error meningkat.
- Onboarding Customer Support baru menjadi lebih lambat.

---

## 3. Tujuan Produk

### 3.1 Tujuan Utama

Menyediakan satu platform internal untuk membantu Customer Support:

- Menemukan informasi yang relevan dengan lebih cepat.
- Mengakses dokumentasi yang tersinkronisasi dari Notion.
- Menyusun draft balasan berdasarkan knowledge perusahaan.
- Mengurangi pekerjaan manual yang berulang.
- Meningkatkan konsistensi jawaban.
- Mengurangi ketergantungan pada pengalaman individu.

### 3.2 Tujuan MVP

MVP dinyatakan berhasil apabila:

1. Customer Support dapat menemukan SOP, FAQ, troubleshooting guide, atau template balasan yang relevan dalam satu platform sekitar 3 menit.
2. AI dapat menghasilkan draft balasan yang sesuai konteks dan standar komunikasi perusahaan.
3. Draft dapat digunakan dengan penyesuaian minimal.
4. Customer Support tetap melakukan validasi sebelum draft digunakan kepada client.

---

## 4. Non-Goals

Fitur berikut tidak termasuk dalam MVP:

- Integrasi WhatsApp API.
- Aplikasi mobile.
- AI auto reply kepada client.
- AI learning otomatis.
- Analytics dashboard.
- AI Ticket Analyzer.
- Case Intelligence.
- Pengambilan keputusan otomatis oleh AI.
- Pengiriman balasan otomatis ke client.
- Penggantian Notion sebagai pusat dokumentasi.
- Pengeditan dokumen utama Notion melalui CSCoPilot.

---

## 5. Pengguna dan Stakeholder

### 5.1 Pengguna Utama

| Pengguna | Kebutuhan |
|---|---|
| Customer Support | Mencari knowledge dan membuat draft balasan dengan cepat |

### 5.2 Pengguna Pendukung

| Pengguna | Kebutuhan |
|---|---|
| Project Manager | Memahami status dan penggunaan sistem sesuai kebutuhan operasional |
| Developer | Mengelola pengembangan, integrasi, dan pemeliharaan sistem |

### 5.3 Stakeholder

| Stakeholder | Kepentingan |
|---|---|
| Management | Produktivitas, efisiensi, kualitas layanan, dan cost saving |
| Product Owner / Internal System Team | Integrasi, arah produk, dan keberlanjutan sistem |

Tidak ada kebutuhan role atau permission khusus selain akses internal yang diperlukan untuk MVP. Detail role matrix mengikuti sistem internal atau ditentukan sebelum development dimulai.

---

## 6. Nilai Bisnis

### 6.1 Productivity

- Mengurangi waktu pencarian SOP dan dokumentasi.
- Mempercepat penyusunan balasan kepada client.
- Mengurangi pekerjaan manual yang berulang.

### 6.2 Cost Saving

- Mengurangi waktu onboarding Customer Support baru.
- Mengurangi waktu koordinasi antar tim.
- Mengurangi waktu investigasi kasus yang serupa.

### 6.3 Quality Improvement

- Meningkatkan konsistensi jawaban kepada client.
- Mendorong penggunaan SOP dan template balasan.
- Mengurangi human error.

### 6.4 Employee Experience

- Mempermudah akses terhadap informasi.
- Mempercepat proses pembelajaran anggota baru.
- Mengurangi ketergantungan pada pengalaman individu.

### 6.5 Strategic Value

- Dokumentasi tetap terpusat di Notion.
- Knowledge perusahaan dapat dimanfaatkan tanpa memindahkan source of truth.
- Menjadi fondasi pengembangan CSCoPilot pada tahap berikutnya.

---

## 7. Ruang Lingkup MVP

### 7.1 Scope Summary

| Fitur | Platform / Teknologi |
|---|---|
| Web application | Next.js + TypeScript |
| UI foundation | shadcn/ui + Radix UI primitives |
| Custom styling | Tailwind CSS + CSS variables/design tokens |
| Icons | Lucide React |
| Dashboard Customer Support | Next.js App Router + shadcn/ui |
| Knowledge Hub | Next.js + PostgreSQL / Supabase |
| Search | PostgreSQL full-text search / indexed query |
| AI Response Assistant | Claude API melalui official Anthropic SDK |
| Authentication | Auth.js / NextAuth |
| Database | PostgreSQL melalui Supabase |
| Server/API layer | Next.js Route Handlers / Server Actions |
| Input validation | Zod |
| Data fetching/state | Server Components; client state seminimal mungkin |
| Testing | Vitest + Testing Library + Playwright |
| Deployment | Platform hosting yang mendukung Next.js |
| Source control & CI | Git + repository CI pipeline |

### 7.2 Technical Stack

#### 7.2.1 Frontend dan Application Framework

| Layer | Teknologi | Penggunaan |
|---|---|---|
| Language | TypeScript | Type safety untuk UI, API, dan service layer |
| Framework | Next.js | Web application, routing, rendering, dan server integration |
| Routing | Next.js App Router | Route halaman dan nested layout |
| Rendering | React Server Components | Default untuk halaman yang tidak memerlukan interaksi browser |
| Client interaction | React Client Components | Search input, generate draft, edit draft, copy, dan state interaktif |
| Package manager | npm / pnpm | Dipilih satu dan dikunci pada repository |

#### 7.2.2 UI, Wireframe, dan Custom Design System

`shadcn/ui` digunakan sebagai **UI foundation** untuk wireframe, prototype, dan implementasi komponen. Komponennya di-copy ke repository sehingga dapat dikustomisasi, bukan diperlakukan sebagai library UI tertutup.

| Area | Teknologi / Aturan |
|---|---|
| Component foundation | shadcn/ui |
| Accessible primitives | Radix UI melalui komponen shadcn/ui |
| Styling | Tailwind CSS |
| Design tokens | CSS variables untuk warna, radius, spacing, typography, dan shadow |
| Icons | Lucide React |
| Custom branding | Tailwind theme dan CSS variables milik CSCoPilot |
| Responsive layout | Tailwind responsive utilities; target utama desktop Customer Support |
| Accessibility | Semantic HTML, keyboard navigation, focus state, label, contrast, dan ARIA bila diperlukan |
| Component ownership | Komponen yang digunakan di aplikasi disimpan di `components/ui` dan dapat dikustomisasi |

##### Aturan Customisasi UI

1. Gunakan komponen shadcn/ui sebagai baseline agar pembuatan wireframe dan implementasi konsisten.
2. Gunakan Tailwind CSS untuk layout, spacing, responsive behavior, state, dan custom visual style.
3. Simpan warna brand dan token desain di CSS variables; jangan menulis warna berulang pada setiap halaman.
4. Jangan menambahkan library UI lain untuk kebutuhan yang sudah dicakup shadcn/ui.
5. Komponen custom dibuat hanya jika kebutuhan tidak tersedia atau tidak cocok dengan komponen shadcn/ui.
6. Semua komponen custom harus memiliki state minimal: default, hover, focus, disabled, loading, error, dan empty apabila relevan.
7. Wireframe menggunakan komponen sederhana terlebih dahulu; visual polish tidak boleh mengubah acceptance criteria.

##### Komponen UI MVP

- `Button`: generate, copy, navigation, logout.
- `Input` dan `Textarea`: search dan konteks client.
- `Card`: feature card dan knowledge result.
- `Badge`: kategori dan status sinkronisasi.
- `Alert`: disclaimer validasi manusia dan error.
- `Skeleton`: loading list/detail.
- `Dialog` atau `Sheet`: detail atau informasi tambahan bila diperlukan.
- `Select` atau `Tabs`: filter kategori.
- `Dropdown Menu`: menu user/logout.
- `Pagination`: navigasi hasil jika data melebihi limit.

#### 7.2.3 Backend dan API

| Layer | Teknologi | Penggunaan |
|---|---|---|
| API framework | Next.js Route Handlers | Endpoint HTTP di `app/api/**/route.ts` |
| Server mutation | Server Actions atau Route Handlers | Dipilih berdasarkan kebutuhan; jangan menduplikasi logic |
| Service layer | TypeScript server modules | Logic knowledge, sync, dan AI dipisahkan dari route handler |
| API response | JSON dengan format konsisten | Error code dan message aman untuk client |
| Validation | Zod | Validasi body, query, dan environment variable |
| Authentication check | Auth.js / NextAuth server session | Proteksi halaman dan endpoint |
| Error handling | Typed application errors | Mapping error database/provider ke HTTP status |

API MVP:

```text
GET  /api/knowledge
GET  /api/knowledge/[id]
POST /api/ai/draft
POST /api/sync/notion
GET  /api/sync/status
GET  /api/health
GET/POST /api/auth/[...nextauth]
```

#### 7.2.4 Database dan Data Access

| Layer | Teknologi | Penggunaan |
|---|---|---|
| Database | PostgreSQL | Penyimpanan knowledge terindeks dan metadata sinkronisasi |
| Managed database | Supabase | Hosting PostgreSQL dan environment database |
| Data access | Supabase server client atau PostgreSQL client resmi | Akses database dari server |
| Schema migration | Migration tool yang dipilih pada technical design | Versioning schema dan deployment |
| Search | PostgreSQL indexed query/full-text search | Search judul dan isi knowledge MVP |
| Security | Server-only credentials; RLS bila akses client-side diperlukan | Membatasi akses data |

Tabel minimum:

- `knowledge_items`: data hasil sinkronisasi Notion.
- `sync_runs`: histori status sinkronisasi dan jumlah perubahan.
- Tabel user/session mengikuti adapter dan konfigurasi Auth.js apabila diperlukan.

Database bukan source of truth dokumentasi. Notion tetap menjadi sumber utama.

#### 7.2.5 Authentication dan Authorization

- **Auth.js / NextAuth:** session, login, logout, dan protected route.
- Provider login mengikuti konfigurasi Internal System Timedoor.
- Session check dilakukan pada server untuk halaman protected dan endpoint sensitif.
- Credential authentication disimpan sebagai environment variable/secret manager.
- MVP tidak menambahkan role matrix kompleks; akses mengikuti pengguna internal yang telah diotorisasi.

#### 7.2.6 Integrasi Notion

- **Notion API official client:** membaca halaman knowledge yang diizinkan.
- Credential Notion hanya digunakan di server.
- Sync mengubah data Notion menjadi representasi terstruktur di PostgreSQL.
- Upsert menggunakan ID halaman Notion sebagai identitas sumber.
- Sync mencatat status, waktu, jumlah created/updated/failed, dan error aman.
- Tidak ada editor atau write-back ke dokumen utama Notion pada MVP.

#### 7.2.7 Integrasi Claude

- **Official Anthropic SDK** digunakan pada server.
- Claude API hanya dipanggil dari server-side route/service.
- API key tidak boleh masuk ke browser bundle, URL, log, atau response.
- Prompt menerima konteks client dan knowledge yang telah dipilih/retrieved.
- Output diperlakukan sebagai draft; Customer Support tetap melakukan validasi.
- Timeout, provider failure, invalid key, dan rate limit dipetakan ke error response aman.
- Histori percakapan tidak disimpan permanen pada MVP kecuali ada persetujuan baru.

#### 7.2.8 Data Fetching dan State Management

- Gunakan Server Components dan server-side data fetching sebagai default.
- Gunakan Client Components hanya untuk interaksi yang memerlukan browser state.
- Gunakan state lokal React untuk input, loading, error, dan hasil draft.
- Tidak menambahkan Redux/Zustand pada MVP tanpa kebutuhan nyata.
- Jika kebutuhan cache client muncul, pilih satu library setelah profiling; jangan menambah dependency di awal.

#### 7.2.9 Testing

| Jenis | Teknologi | Scope |
|---|---|---|
| Unit/component test | Vitest + Testing Library | Utility, validation, service, dan komponen UI penting |
| End-to-end test | Playwright | Login, Knowledge Hub, generate draft, dan protected route |
| API/integration test | Vitest atau Playwright | Route handler, database/provider mock, dan error handling |
| Static check | TypeScript compiler + ESLint | Type error dan coding rule |
| Formatting | Prettier atau formatter repository | Konsistensi format |

Test minimum wajib mencakup success, loading, empty, error, unauthorized, dan session expiry state.

#### 7.2.10 Deployment dan Operations

| Area | Teknologi / Aturan |
|---|---|
| Hosting | Hosting yang mendukung Next.js App Router dan server runtime |
| Database hosting | Supabase |
| Environment | Development, staging/UAT, dan production bila tersedia |
| Secrets | Environment variable atau secret manager platform |
| CI | Install, lint, typecheck, test, dan production build |
| Monitoring | Runtime logs dan provider error logs minimum |
| Health check | `GET /api/health` |
| Sync trigger | Cron/scheduler atau trigger internal sesuai technical design |
| Rollback | Deployment version rollback dan database migration discipline |

#### 7.2.11 Environment Variable Minimum

Nama final mengikuti standar repository, tetapi minimal memerlukan:

```text
DATABASE_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
AUTH_SECRET
NOTION_API_KEY
NOTION_KNOWLEDGE_PARENT_ID
ANTHROPIC_API_KEY
CRON_SECRET
```

Aturan:

- Jangan commit file `.env` berisi secret.
- Sediakan `.env.example` tanpa nilai credential.
- Validasi environment variable saat server start atau saat feature digunakan.
- Jangan expose secret melalui variable prefix `NEXT_PUBLIC_`.

#### 7.2.12 Struktur Folder Referensi

```text
app/
├── (auth)/login/page.tsx
├── (protected)/dashboard/page.tsx
├── (protected)/knowledge/page.tsx
├── (protected)/knowledge/[id]/page.tsx
├── (protected)/assistant/page.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── knowledge/route.ts
│   ├── knowledge/[id]/route.ts
│   ├── ai/draft/route.ts
│   ├── sync/notion/route.ts
│   ├── sync/status/route.ts
│   └── health/route.ts
├── layout.tsx
└── globals.css

components/
├── ui/                    # Komponen shadcn/ui yang digunakan
├── layout/                # Header, navigation, protected shell
├── knowledge/             # Knowledge list, card, filter, detail
└── assistant/             # Context form, draft result, source list

lib/
├── auth.ts
├── db.ts
├── validations.ts
├── errors.ts
├── notion/
├── anthropic/
└── services/
    ├── knowledge.service.ts
    ├── sync.service.ts
    └── ai.service.ts

supabase/
└── migrations/
```

#### 7.2.13 Technical Definition of Done

- [ ] Stack final disetujui: Next.js, TypeScript, shadcn/ui, Tailwind CSS, Supabase/PostgreSQL, Auth.js/NextAuth, Notion API, official Anthropic SDK.
- [ ] `shadcn/ui` terpasang dan komponen yang digunakan tersimpan di repository.
- [ ] Tailwind theme/CSS variables berisi token visual CSCoPilot.
- [ ] Tidak ada duplikasi UI library tanpa alasan yang disetujui.
- [ ] Komponen UI memiliki focus, disabled, loading, dan error state yang relevan.
- [ ] Server-only integration untuk Notion dan Claude terverifikasi.
- [ ] Secret tidak menggunakan prefix `NEXT_PUBLIC_`.
- [ ] `.env.example` tersedia dan `.env` tidak masuk version control.
- [ ] Database migration dapat dijalankan pada environment baru.
- [ ] Lint, typecheck, unit test, E2E test, dan production build lulus.
- [ ] API error response tidak membocorkan stack trace atau credential.
- [ ] Technical handoff menjelaskan setup, env, migration, sync, dan deployment.

---

## 7.3 Ringkasan Keputusan Teknologi

| Keputusan | Pilihan MVP | Alasan |
|---|---|---|
| Web framework | Next.js + TypeScript | Satu framework untuk UI dan server API |
| UI foundation | shadcn/ui | Komponen accessible, source code dimiliki repository, mudah dikustomisasi |
| Custom design | Tailwind CSS + CSS variables | Custom branding cepat tanpa menambah UI library lain |
| Authentication | Auth.js / NextAuth | Sesuai requirement dan mendukung protected route |
| Database | PostgreSQL/Supabase | Relational data, managed service, cocok untuk MVP |
| Knowledge source | Notion API | Notion tetap single source of truth |
| AI provider | Claude API + official Anthropic SDK | Sesuai requirement AI Response Assistant |
| Validation | Zod | Validasi input API dan environment |
| Testing | Vitest, Testing Library, Playwright | Unit, component, integration, dan E2E coverage |
| State management | React state + Server Components | Minim dependency dan cukup untuk MVP |
| Deployment | Next.js-compatible hosting + Supabase | Operasional sederhana dan mudah di-roll back |

---

## 8. User Journey

### 8.1 Journey: Akses Sistem

1. Customer Support membuka CSCoPilot.
2. Customer Support melakukan login melalui authentication yang tersedia.
3. Sistem memvalidasi sesi pengguna.
4. Pengguna diarahkan ke Dashboard Customer Support.
5. Pengguna dapat memilih:
   - Knowledge Hub.
   - AI Response Assistant.

### 8.2 Journey: Mencari Informasi

1. Customer Support membuka Knowledge Hub.
2. Customer Support memasukkan kata kunci atau memilih kategori knowledge.
3. Sistem menampilkan hasil yang relevan.
4. Customer Support membuka detail knowledge.
5. Customer Support membaca SOP, FAQ, troubleshooting guide, atau template balasan.
6. Customer Support menggunakan informasi tersebut untuk menangani kebutuhan client.

### 8.3 Journey: Membuat Draft Balasan

1. Customer Support membuka AI Response Assistant.
2. Customer Support memasukkan konteks atau pertanyaan client.
3. Sistem mengambil informasi relevan dari Knowledge Hub.
4. Sistem mengirimkan konteks tersebut ke Claude API.
5. AI menghasilkan draft balasan.
6. Customer Support membaca draft.
7. Customer Support melakukan penyesuaian apabila diperlukan.
8. Customer Support memvalidasi draft.
9. Customer Support menggunakan draft secara manual pada kanal komunikasi yang tersedia di luar MVP.

CSCoPilot tidak mengirimkan balasan otomatis kepada client.

---

## 9. Functional Requirements

### 9.1 Authentication

#### AUTH-01 — Login
Sistem harus menyediakan akses login untuk pengguna internal yang berwenang.

#### AUTH-02 — Validasi Sesi
Sistem harus memvalidasi sesi pengguna sebelum mengakses halaman internal.

#### AUTH-03 — Protected Page
Halaman Dashboard, Knowledge Hub, dan AI Response Assistant hanya dapat diakses oleh pengguna yang telah terautentikasi.

#### AUTH-04 — Logout
Pengguna dapat keluar dari sistem melalui fungsi logout.

#### AUTH-05 — Session Expiry
Sistem harus menangani sesi yang sudah tidak valid atau telah berakhir.

#### AUTH-06 — Error State
Sistem harus menampilkan pesan yang sesuai apabila:
- Login gagal.
- Sesi tidak valid.
- Pengguna tidak memiliki akses.
- Terjadi gangguan authentication provider.

**Teknologi:** NextAuth.
**Detail provider login:** mengikuti konfigurasi Internal System dan perlu dikonfirmasi sebelum development.

---

### 9.2 Dashboard Customer Support

Dashboard merupakan halaman awal setelah login.

#### DASH-01 — Landing Page
Sistem harus mengarahkan pengguna ke Dashboard setelah login berhasil.

#### DASH-02 — Navigasi Fitur MVP
Dashboard harus menyediakan akses ke:
- Knowledge Hub.
- AI Response Assistant.

#### DASH-03 — Informasi Produk
Dashboard dapat menampilkan konteks singkat mengenai fungsi CSCoPilot sebagai alat bantu Customer Support.

#### DASH-04 — Navigasi Internal
Pengguna dapat berpindah dari Dashboard ke fitur MVP tanpa harus login ulang selama sesi masih valid.

#### DASH-05 — Batasan Dashboard
Dashboard MVP tidak mencakup:
- Analytics.
- Statistik tiket.
- Performance metrics.
- Case intelligence.
- Monitoring produktivitas.

---

### 9.3 Knowledge Hub

Knowledge Hub adalah pusat akses terhadap informasi yang telah disinkronkan dari Notion.

#### KH-01 — Akses Knowledge Hub
Pengguna yang telah login dapat membuka Knowledge Hub.

#### KH-02 — Kategori Knowledge
Knowledge Hub harus mendukung kategori informasi:
- SOP.
- FAQ.
- Troubleshooting guide.
- Template balasan.

#### KH-03 — Pencarian Knowledge
Pengguna dapat mencari informasi berdasarkan kata kunci.
Pencarian minimal digunakan untuk menemukan knowledge yang relevan berdasarkan judul atau isi data yang tersedia dalam sistem.

#### KH-04 — Tampilan Hasil Pencarian
Sistem harus menampilkan:
- Judul knowledge.
- Kategori knowledge.
- Ringkasan atau cuplikan informasi.
- Status ketersediaan data.
- Akses menuju detail knowledge.

#### KH-05 — Detail Knowledge
Pengguna dapat membuka detail knowledge dan membaca informasi yang tersedia.

#### KH-06 — Data Terstruktur
Data Knowledge Hub harus dapat dibedakan berdasarkan kategori agar pengguna dapat memahami jenis informasi yang sedang digunakan.

#### KH-07 — Data Bersumber dari Notion
Informasi yang tersedia pada Knowledge Hub harus berasal dari dokumentasi yang telah disinkronkan dari Notion.

#### KH-08 — Notion sebagai Source of Truth
Perubahan isi utama dokumentasi tetap dilakukan pada Notion, bukan melalui Knowledge Hub.

#### KH-09 — Data Terbaru
Knowledge Hub harus menggunakan hasil sinkronisasi terakhir yang berhasil.

#### KH-10 — Empty State
Sistem harus menampilkan kondisi kosong apabila:
- Belum ada knowledge yang tersedia.
- Hasil pencarian tidak ditemukan.
- Data sinkronisasi belum tersedia.

#### KH-11 — Error State
Sistem harus menampilkan pesan apabila:
- Data Knowledge Hub gagal dimuat.
- Proses sinkronisasi gagal.
- Database tidak dapat diakses.

#### KH-12 — Batasan Knowledge Hub
Knowledge Hub MVP tidak mencakup:
- Editor dokumen Notion.
- Manajemen dokumen penuh.
- Upload dokumen manual.
- Approval workflow dokumentasi.
- Version management kompleks.
- Dashboard analytics knowledge.

---

### 9.4 Sinkronisasi Notion

Requirement sumber menyatakan bahwa CSCoPilot menggunakan informasi yang telah disinkronkan dari Notion. Detail teknis mekanisme sinkronisasi belum ditentukan pada file requirement.

#### SYNC-01 — Sumber Data
Notion menjadi sumber utama data untuk:
- SOP.
- FAQ.
- Troubleshooting guide.
- Template balasan.

#### SYNC-02 — Data yang Digunakan
Sistem hanya menggunakan data yang diperlukan oleh MVP untuk pencarian dan AI Response Assistant.

#### SYNC-03 — Tidak Menggantikan Notion
CSCoPilot tidak menjadi tempat utama pembuatan atau pemeliharaan dokumentasi perusahaan.

#### SYNC-04 — Status Sinkronisasi
Sistem perlu memiliki informasi internal mengenai hasil sinkronisasi terakhir agar Knowledge Hub tidak menggunakan data yang tidak diketahui statusnya.

Detail tampilan status sinkronisasi untuk pengguna belum diwajibkan oleh requirement. Untuk estimasi MVP, status dapat dikelola di level sistem atau log internal tanpa membuat halaman admin khusus.

#### SYNC-05 — Sinkronisasi Gagal
Apabila sinkronisasi gagal:
- Data hasil sinkronisasi terakhir tidak boleh dianggap sebagai data terbaru.
- Sistem harus mencatat kegagalan untuk kebutuhan troubleshooting.
- Knowledge Hub tetap mengikuti kebijakan data terakhir yang telah disepakati oleh Product Owner.

#### SYNC-06 — Dependency
Implementasi sinkronisasi membutuhkan:
- Akses ke workspace atau sumber Notion.
- Struktur halaman Notion yang konsisten.
- Mapping kategori knowledge.
- Mekanisme autentikasi atau akses Notion.
- Keputusan apakah data disimpan sebagai index, cache, atau representasi terstruktur di PostgreSQL/Supabase.

---

### 9.5 AI Response Assistant

AI Response Assistant menggunakan Claude API untuk menghasilkan draft balasan berdasarkan knowledge yang relevan.

#### AI-01 — Input Konteks Client
Customer Support dapat memasukkan konteks pertanyaan atau kebutuhan client.

#### AI-02 — Input Knowledge Context
Sistem harus menggunakan informasi yang relevan dari Knowledge Hub sebagai referensi AI.

#### AI-03 — Integrasi Claude API
Sistem mengirimkan konteks dan knowledge yang relevan ke Claude API.

#### AI-04 — Draft Balasan
AI harus menghasilkan draft balasan yang:
- Sesuai dengan konteks pertanyaan client.
- Mengacu pada SOP, FAQ, troubleshooting guide, atau template balasan yang relevan.
- Mengikuti standar komunikasi perusahaan.
- Dapat disesuaikan oleh Customer Support.

#### AI-05 — Tampilan Draft
Draft balasan ditampilkan pada area yang mudah dibaca dan dapat direview oleh Customer Support.

#### AI-06 — Edit Draft
Customer Support dapat melakukan penyesuaian terhadap draft sebelum digunakan.

#### AI-07 — Penggunaan Manual
Customer Support dapat menyalin atau menggunakan draft secara manual.

#### AI-08 — Validasi Manusia
Sistem harus memperjelas bahwa draft AI wajib ditinjau oleh Customer Support.

#### AI-09 — Tidak Ada Auto Reply
AI tidak boleh:
- Mengirim balasan otomatis.
- Mengirim pesan ke client.
- Mengambil keputusan final atas nama Customer Support.
- Mengubah data client tanpa tindakan manual pengguna.

#### AI-10 — Respons Tidak Relevan
Apabila knowledge yang relevan tidak tersedia, sistem harus memberi indikasi bahwa hasil AI membutuhkan pemeriksaan lebih lanjut.

AI tidak boleh memberikan kesan bahwa draft selalu benar atau telah disetujui perusahaan.

#### AI-11 — Loading State
Sistem harus menampilkan status proses saat menunggu respons Claude API.

#### AI-12 — Error State
Sistem harus menangani:
- Claude API tidak tersedia.
- Koneksi internet terganggu.
- API key tidak valid.
- Request timeout.
- Rate limit.
- Respons AI gagal diproses.

#### AI-13 — Prompt
Prompt harus mengarahkan AI untuk:
- Menggunakan knowledge yang diberikan sebagai referensi.
- Tidak mengambil keputusan final.
- Menghasilkan draft, bukan mengirimkan balasan.
- Mengikuti konteks dan standar perusahaan.
- Menyatakan keterbatasan apabila informasi tidak cukup.

Prompt harus dapat dievaluasi secara berkala.

#### AI-14 — Data Sensitif
API key Claude tidak boleh disimpan di client-side atau ditampilkan kepada pengguna.

#### AI-15 — Batasan AI Assistant
AI Response Assistant MVP tidak mencakup:
- Pembelajaran otomatis dari histori tiket.
- AI Ticket Analyzer.
- Case Intelligence.
- Analisis performa Customer Support.
- Pengiriman otomatis.
- Integrasi WhatsApp.
- Pengambilan keputusan otomatis.

---

### 9.6 Database

#### DB-01 — Database Platform
Sistem menggunakan PostgreSQL melalui Supabase.

#### DB-02 — Penyimpanan Knowledge
Database dapat menyimpan representasi data yang dibutuhkan untuk:
- Pencarian Knowledge Hub.
- Pengelompokan kategori.
- Penyediaan context kepada AI Response Assistant.
- Informasi sinkronisasi.

#### DB-03 — Tidak Menjadi Source of Truth
Database CSCoPilot bukan pengganti Notion sebagai source of truth.

#### DB-04 — Data Sinkronisasi
Sistem perlu membedakan data berdasarkan status sinkronisasi agar data yang gagal diperbarui tidak dianggap sebagai data terbaru tanpa penanda.

#### DB-05 — Data Pengguna
Database atau authentication layer dapat menyimpan data minimum yang diperlukan untuk mengelola akses dan sesi pengguna.

#### DB-06 — Data AI
Penyimpanan histori seluruh percakapan AI tidak termasuk kebutuhan eksplisit MVP. Jika diperlukan, keputusan penyimpanan harus disepakati sebelum implementation karena berdampak pada:
- Privacy.
- Storage.
- Cost.
- Retention.
- Estimasi development.

#### DB-07 — Database Error
Sistem harus menampilkan error yang sesuai apabila database tidak tersedia atau query gagal.

---

## 10. Struktur Data Minimum

Struktur berikut digunakan sebagai dasar estimasi dan desain teknis. Detail field final ditentukan pada fase technical design.

### 10.1 Knowledge Item

| Field | Keterangan |
|---|---|
| ID | Identitas knowledge |
| Title | Judul dokumen atau knowledge |
| Category | SOP, FAQ, troubleshooting, atau template |
| Content | Isi knowledge yang dibutuhkan aplikasi |
| Source Reference | Referensi sumber Notion |
| Sync Status | Status sinkronisasi |
| Last Synced At | Waktu sinkronisasi terakhir |
| Created At | Waktu data dibuat |
| Updated At | Waktu data diperbarui |

### 10.2 User / Session
Dikelola melalui NextAuth dan konfigurasi Internal System.

### 10.3 AI Request
Penyimpanan permanen tidak termasuk scope default MVP. Data yang dibutuhkan hanya diproses selama request berlangsung, kecuali Product Owner menyetujui kebutuhan penyimpanan.

---

## 11. Business Rules

| ID | Rule |
|---|---|
| BR-01 | Notion tetap menjadi single source of truth. |
| BR-02 | CSCoPilot menggunakan data yang telah disinkronkan dari Notion. |
| BR-03 | Knowledge Hub hanya menyediakan akses dan pencarian terhadap knowledge yang tersedia. |
| BR-04 | AI menggunakan Knowledge Hub sebagai referensi dalam membuat draft. |
| BR-05 | AI tidak menggantikan keputusan Customer Support. |
| BR-06 | Semua draft AI harus divalidasi Customer Support. |
| BR-07 | AI tidak boleh mengirim balasan otomatis kepada client. |
| BR-08 | Hanya pengguna terautentikasi yang dapat mengakses fitur internal. |
| BR-09 | Kualitas output AI bergantung pada kelengkapan dan kualitas dokumentasi Notion. |
| BR-10 | Jika knowledge tidak cukup, hasil AI harus dianggap membutuhkan pemeriksaan manual. |
| BR-11 | WhatsApp API dan kanal pengiriman client tidak termasuk MVP. |
| BR-12 | AI learning otomatis tidak dilakukan pada MVP. |
| BR-13 | Analytics dan Case Intelligence tidak ditampilkan pada MVP. |

---

## 12. Rancangan Halaman untuk Design

### 12.1 Login Page
Komponen minimum:
- Logo atau identitas Internal System.
- Form login sesuai provider NextAuth.
- Loading state.
- Error state.
- Session expired state.

### 12.2 Dashboard Page
Komponen minimum:
- Header.
- Informasi pengguna atau sesi.
- Navigasi Knowledge Hub.
- Navigasi AI Response Assistant.
- Logout.
- Deskripsi singkat fungsi CSCoPilot.

Tidak perlu menampilkan analytics atau statistik.

### 12.3 Knowledge Hub Page
Komponen minimum:
- Page title.
- Search input.
- Kategori knowledge.
- Daftar hasil.
- Empty state.
- Loading state.
- Error state.

### 12.4 Knowledge Detail Page
Komponen minimum:
- Judul knowledge.
- Kategori.
- Isi knowledge.
- Referensi sumber.
- Informasi sinkronisasi yang relevan apabila diperlukan dalam desain.

Tidak terdapat fungsi edit utama Notion.

### 12.5 AI Response Assistant Page
Komponen minimum:
- Input konteks atau pertanyaan client.
- Area informasi knowledge yang digunakan.
- Tombol generate draft.
- Loading state.
- Area hasil draft.
- Fungsi edit draft.
- Fungsi copy draft.
- Informasi bahwa draft wajib divalidasi.
- Error state.

### 12.6 State yang Wajib Didesain
- Loading.
- Empty.
- Error.
- Unauthorized.
- Session expired.
- No relevant knowledge.
- Claude API unavailable.
- Database unavailable.
- Sync data unavailable.
- Draft berhasil dibuat.
- Draft gagal dibuat.

---

## 13. Non-Functional Requirements

### 13.1 Platform
- Berbasis web.
- Menggunakan Next.js.
- Tidak mencakup aplikasi mobile.

### 13.2 Authentication
- Menggunakan NextAuth.
- Halaman internal harus terlindungi.
- Session pengguna harus dikelola dengan aman.

### 13.3 Data Source
- Notion merupakan sumber utama dokumentasi.
- Data yang digunakan harus berasal dari proses sinkronisasi yang disepakati.
- Sistem tidak boleh membuat source of truth kedua.

### 13.4 AI Integration
- Integrasi menggunakan Claude API.
- API key hanya disimpan di server atau environment variable.
- Sistem harus memiliki handling untuk error dan timeout.
- Prompt perlu dapat dievaluasi berkala.

### 13.5 Database
- Menggunakan PostgreSQL/Supabase.
- Struktur data harus mendukung pencarian dan penggunaan knowledge oleh AI.
- Data sinkronisasi perlu memiliki status yang dapat ditelusuri.

### 13.6 Usability
- Alur pencarian harus sederhana bagi Customer Support.
- Informasi kategori harus mudah dipahami.
- Draft AI harus mudah dibaca dan diedit.
- Validasi manual harus terlihat jelas dalam UI.

### 13.7 Reliability
Sistem harus menampilkan kondisi error secara jelas apabila:
- Notion sync gagal.
- Database gagal.
- Claude API gagal.
- Koneksi internet terganggu.
- Session pengguna berakhir.

### 13.8 Security
- API key Claude tidak boleh masuk ke browser.
- Data hanya dapat diakses oleh pengguna internal yang terautentikasi.
- Input pengguna harus divalidasi pada server.
- Credential pihak ketiga tidak boleh ditulis ke prompt atau disimpan dalam data knowledge.

---

## 14. Acceptance Criteria

### 14.1 Authentication

#### AC-AUTH-01
**Given** pengguna internal belum login
**When** pengguna membuka halaman internal
**Then** sistem mengarahkan pengguna ke halaman login.

#### AC-AUTH-02
**Given** pengguna berhasil login
**When** authentication berhasil divalidasi
**Then** pengguna dapat mengakses Dashboard.

#### AC-AUTH-03
**Given** session pengguna tidak valid
**When** pengguna membuka halaman protected
**Then** sistem menolak akses dan meminta login kembali.

---

### 14.2 Dashboard

#### AC-DASH-01
**Given** pengguna berhasil login
**When** pengguna masuk ke sistem
**Then** Dashboard ditampilkan.

#### AC-DASH-02
Dashboard menyediakan akses menuju Knowledge Hub dan AI Response Assistant.

#### AC-DASH-03
Dashboard tidak menampilkan analytics dashboard atau fitur di luar scope MVP.

---

### 14.3 Knowledge Hub

#### AC-KH-01
Pengguna dapat membuka Knowledge Hub setelah login.

#### AC-KH-02
Knowledge Hub menampilkan kategori SOP, FAQ, troubleshooting guide, dan template balasan apabila data tersedia.

#### AC-KH-03
Pengguna dapat melakukan pencarian menggunakan kata kunci.

#### AC-KH-04
Hasil pencarian menampilkan knowledge yang relevan beserta judul dan kategorinya.

#### AC-KH-05
Pengguna dapat membuka dan membaca detail knowledge.

#### AC-KH-06
Knowledge yang ditampilkan berasal dari data hasil sinkronisasi Notion.

#### AC-KH-07
Apabila hasil pencarian kosong, sistem menampilkan empty state yang jelas.

#### AC-KH-08
Apabila database atau data sinkronisasi gagal dimuat, sistem menampilkan error state.

#### AC-KH-09
Pengguna tidak dapat mengubah dokumen utama Notion dari Knowledge Hub MVP.

---

### 14.4 AI Response Assistant

#### AC-AI-01
Pengguna dapat memasukkan konteks pertanyaan client.

#### AC-AI-02
Sistem menggunakan knowledge yang relevan dari Knowledge Hub sebagai context AI.

#### AC-AI-03
Sistem dapat mengirim request ke Claude API.

#### AC-AI-04
Sistem menampilkan draft balasan berdasarkan konteks dan knowledge yang tersedia.

#### AC-AI-05
Draft dapat diedit oleh Customer Support.

#### AC-AI-06
Draft dapat disalin atau digunakan secara manual oleh Customer Support.

#### AC-AI-07
Sistem menampilkan informasi bahwa draft wajib divalidasi oleh Customer Support.

#### AC-AI-08
Sistem tidak mengirim draft otomatis kepada client.

#### AC-AI-09
Apabila knowledge tidak cukup relevan, sistem tidak menampilkan hasil seolah-olah telah tervalidasi.

#### AC-AI-10
Apabila Claude API gagal, sistem menampilkan error dan tidak menyebabkan aplikasi berhenti secara keseluruhan.

---

### 14.5 Notion Synchronization

#### AC-SYNC-01
Knowledge Hub dapat menggunakan data yang berasal dari sinkronisasi Notion.

#### AC-SYNC-02
Data sinkronisasi memiliki status atau metadata yang dapat digunakan untuk mengetahui kondisi data.

#### AC-SYNC-03
Notion tetap menjadi tempat utama pemeliharaan dokumentasi.

#### AC-SYNC-04
Kegagalan sinkronisasi dapat ditelusuri oleh tim teknis.

---

## 15. MVP Success Metrics

### 15.1 Information Retrieval

**Target:**
Customer Support dapat menemukan SOP, FAQ, troubleshooting guide, atau template balasan yang relevan dalam satu platform sekitar 3 menit.

**Metode pengukuran:**
- UAT menggunakan skenario pencarian yang umum.
- Pengukuran waktu dari pencarian dimulai sampai knowledge relevan ditemukan.
- Perbandingan terhadap proses manual apabila data baseline tersedia.

### 15.2 Draft Quality

**Target:**
Draft AI sesuai konteks dan standar perusahaan serta dapat digunakan dengan penyesuaian minimal.

**Metode pengukuran:**
- UAT oleh Customer Support.
- Penilaian relevansi terhadap konteks client.
- Penilaian kesesuaian dengan SOP atau template.
- Penilaian jumlah penyesuaian yang diperlukan.

### 15.3 Human Validation

**Target:**
Seluruh draft AI ditinjau Customer Support sebelum digunakan kepada client.

**Metode pengukuran:**
- Validasi melalui alur UI.
- Tidak tersedia tombol atau proses auto-send.
- Konfirmasi penggunaan manual pada UAT.

---

## 16. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Dokumentasi Notion tidak lengkap | Output AI kurang relevan | Audit dan rapikan knowledge sebelum UAT |
| Struktur Notion tidak konsisten | Data sulit dipetakan | Menetapkan mapping kategori dan format data |
| Sinkronisasi gagal | Knowledge tidak terbaru | Menyimpan status sinkronisasi dan error log |
| Koneksi internet tidak stabil | Request Claude API gagal | Menyediakan loading, timeout, dan error state |
| Prompt AI kurang sesuai | Draft tidak konsisten | Evaluasi prompt menggunakan skenario UAT |
| API rate limit | Request AI tertunda atau gagal | Menampilkan error yang informatif dan retry sesuai kebutuhan |
| Validasi manusia diabaikan | Risiko kesalahan komunikasi | Menampilkan peringatan dan tidak menyediakan auto-send |
| Scope melebar | MVP tidak selesai dalam satu bulan | Menjaga daftar out of scope sebagai batas delivery |
| Provider authentication belum ditentukan | Development tertunda | Konfirmasi konfigurasi NextAuth sebelum sprint dimulai |

---

## 17. Asumsi

1. Tim memiliki akses yang diperlukan ke Internal System Timedoor.
2. Tim memiliki akses ke dokumentasi Notion yang relevan.
3. Struktur SOP, FAQ, troubleshooting guide, dan template balasan dapat dipetakan.
4. Supabase/PostgreSQL tersedia atau dapat disiapkan pada awal project.
5. Claude API dapat digunakan pada environment development dan production.
6. Authentication provider untuk NextAuth tersedia atau dapat dikonfigurasi.
7. Customer Support tersedia untuk memberikan sample case dan melakukan UAT.
8. Tidak ada kebutuhan pengiriman pesan otomatis pada MVP.
9. Tidak ada kebutuhan aplikasi mobile pada MVP.
10. Notion tetap dikelola sebagai pusat dokumentasi perusahaan.
11. Detail mekanisme sinkronisasi Notion perlu ditentukan pada technical design.
12. Detail penyimpanan histori AI belum termasuk asumsi default MVP.

---

## 18. Dependencies

- Akses Notion.
- Struktur dan taxonomy dokumentasi.
- Notion authentication atau integration credential.
- Supabase project.
- PostgreSQL schema.
- Claude API key dan account.
- NextAuth configuration.
- Internal System integration point.
- Environment variable management.
- Hosting atau deployment environment.
- UAT scenario dari Customer Support.
- Approval prompt dan standar komunikasi perusahaan.

---

## 19. Deliverables

### 19.1 Product dan Design
- User flow MVP.
- Information architecture.
- Wireframe.
- UI design:
  - Login.
  - Dashboard.
  - Knowledge Hub.
  - Knowledge detail.
  - AI Response Assistant.
  - Loading, empty, error, unauthorized, dan session expired state.
- Prototype untuk alur pencarian dan pembuatan draft.
- Design handoff ke developer.

### 19.2 Development
- Next.js web application.
- NextAuth authentication.
- Dashboard.
- Knowledge Hub.
- PostgreSQL/Supabase integration.
- Notion synchronization sesuai desain teknis yang disetujui.
- Claude API integration.
- AI Response Assistant.
- Error handling.
- Protected routes.
- Deployment configuration.

### 19.3 QA dan UAT
- Test scenario authentication.
- Test scenario Knowledge Hub.
- Test scenario sinkronisasi.
- Test scenario AI draft.
- Negative test untuk API error.
- UAT bersama Customer Support.
- Bug fixing hasil UAT.
- Release checklist.

---

## 20. Estimasi Mandays

Estimasi berikut merupakan breakdown per modul untuk MVP satu bulan. Nilai final dapat berubah setelah detail sinkronisasi Notion, provider authentication, dan struktur Internal System dikonfirmasi.

### 20.1 Mandays per Modul

| No | Module Name | Estimated Day(s) | Design | FE (Next.js) | Backend | QA | Note |
|---:|---|---:|---:|---:|---:|---:|---|
|  | **Planning** | **4** | **1** | **0,5** | **1,5** | **1** | DB design, design planning, development env preparation |
| 1 | **User** | **28,5** | **5** | **12,5** | **8** | **3** | Modul Customer Support |
| 1.1 | 　Authentication | 4,5 | 1 | 2 | 1 | 0,5 | NextAuth, login, logout, session, protected route |
| 1.2 | 　Dashboard | 3 | 1 | 1,5 | 0 | 0,5 | Landing page + navigasi fitur |
| 1.3 | 　Knowledge Hub | 11,5 | 2 | 5 | 3 | 1,5 | Search, filter kategori, list, detail, state |
| 1.4 | 　AI Response Assistant | 9,5 | 1 | 4 | 4 | 0,5 | Claude API, draft, edit, copy, error handling |
| 2 | **Admin** | **11,5** | **0** | **0,5** | **9** | **2** | Proses internal; bukan halaman admin pada MVP |
| 2.1 | 　Database & API Foundation | 3 | 0 | 0 | 3 | 0 | Supabase, schema, migration, index, service layer |
| 2.2 | 　Notion Sync | 4 | 0 | 0 | 3,5 | 0,5 | Mapping, upsert, incremental, duplicate prevention |
| 2.3 | 　Sync status & Logging | 1,5 | 0 | 0 | 1 | 0,5 | sync_runs, status, error log |
| 2.4 | 　Security & External Integration | 3 | 0 | 0,5 | 1,5 | 1 | Server-only secret, validation, error mapping, health check |
| 3 | **QA, UAT & Release** | **5** | **0** | **0,5** | **0,5** | **4** | Integration, UAT, bug fix, deployment, dokumentasi |
|  | **TOTAL** | **49** | **6** | **14** | **19** | **10** | **Base estimate untuk 30 hari kerja** |

### 20.2 Rekapitulasi per Role

| Role | Mandays | % |
|---|---:|---:|
| Design | 6 MD | 12% |
| FE (Next.js) | 14 MD | 29% |
| Backend | 19 MD | 39% |
| QA | 10 MD | 20% |
| **Total** | **49 MD** | **100%** |

### 20.3 Model Eksekusi — Parallel Tim

Total **49 MD** diselesaikan dalam **30 hari kerja kalender** melalui eksekusi paralel 4 role:

| Role | Orang | Hari Kerja Efektif | Mulai |
|---|---:|---:|---|
| Designer | 1 | ~6 hari | Hari 1 |
| Frontend Developer | 1 | ~14 hari | Hari 3 |
| Backend Developer | 1 | ~19 hari | Hari 2 (critical path) |
| QA Engineer | 1 | ~10 hari | Minggu 3 |

**Critical path:** Backend (19 MD). Bila hanya 1 orang fullstack mengerjakan semua secara berurutan, MVP **tidak** dapat selesai dalam 1 bulan.

### 20.4 Contingency

Disarankan menambahkan contingency **10–15%** karena terdapat dependency yang belum memiliki detail teknis final, terutama:
- Sinkronisasi Notion.
- Struktur data Notion.
- Authentication provider.
- Integrasi Internal System.
- Kualitas dan kelengkapan dokumentasi.
- Evaluasi prompt AI.

| Perhitungan | Estimasi |
|---|---:|
| Base estimate | 49 MD |
| Contingency 10% | 4,9 MD |
| Contingency 15% | 7,35 MD |
| **Recommended planning range** | **53,9–56,35 MD** |

Untuk budgeting, angka praktis yang dapat digunakan adalah **54–57 mandays**.

---

## 21. Estimasi Komposisi Tim

MVP satu bulan membutuhkan pekerjaan paralel. Contoh komposisi:

| Role | Kontribusi Perkiraan |
|---|---:|
| Product Manager / Business Analyst | 3–5 MD |
| UX/UI Designer | 5–7 MD |
| Frontend Developer | 10–13 MD |
| Backend / Full-stack Developer | 14–17 MD |
| QA Engineer | 5–7 MD |
| DevOps / Deployment Support | 2–3 MD |
| **Total** | **39–52 MD** |

Satu orang dapat memegang lebih dari satu role, tetapi total effort tetap mengacu pada mandays pekerjaan.

---

## 22. Dasar Perhitungan Budget

### 22.1 Development Budget

```text
Development Budget = Total Mandays × Rate per Manday
```

Contoh struktur:

```text
Frontend Mandays × Frontend Rate
+ Backend Mandays × Backend Rate
+ UI/UX Mandays × UI/UX Rate
+ QA Mandays × QA Rate
+ PM/BA Mandays × PM/BA Rate
+ DevOps Mandays × DevOps Rate
```

### 22.2 Operational Budget

Komponen berikut perlu dihitung terpisah dari mandays:

- Claude API usage.
- Supabase/PostgreSQL plan.
- Hosting Next.js.
- Logging atau monitoring apabila digunakan.
- Domain atau internal hosting apabila diperlukan.
- Notion integration atau credential management apabila terdapat biaya.
- Environment development dan production.

### 22.3 Contingency Budget

Tambahkan contingency project sebesar **10–15%** untuk:
- Perubahan mapping data Notion.
- Perbaikan kualitas prompt.
- Error integrasi API.
- Perubahan konfigurasi authentication.
- Bug hasil UAT.
- Penyesuaian deployment.

---

## 23. Rencana Delivery Satu Bulan

### Minggu 1 — Foundation
- Finalisasi requirement dan acceptance criteria.
- Finalisasi user flow.
- Wireframe.
- Technical design awal.
- Setup Next.js.
- Setup Supabase/PostgreSQL.
- Setup NextAuth.
- Konfirmasi akses Notion dan Claude API.

### Minggu 2 — Core Platform
- Implementasi layout dan Dashboard.
- Implementasi authentication.
- Implementasi protected routes.
- Implementasi schema database.
- Implementasi data mapping Knowledge Hub.
- Mulai implementasi sinkronisasi Notion.
- UI Knowledge Hub.

### Minggu 3 — Feature Completion
- Penyelesaian Knowledge Hub.
- Search dan category flow.
- Knowledge detail.
- Integrasi Claude API.
- Implementasi AI Response Assistant.
- Draft display dan editing.
- Error, loading, dan empty state.

### Minggu 4 — Quality dan Release
- Integration testing.
- Prompt evaluation.
- UAT dengan Customer Support.
- Bug fixing.
- Security dan access review.
- Deployment.
- Release checklist.
- Dokumentasi penggunaan MVP.

---

## 24. Definition of Done

> Bagian ini menjadi acuan utama QA dan UAT. Setiap kategori harus berstatus **✅ DONE** sebelum MVP dideklarasikan selesai dan dirilis.

### 24.1 Functional Completion — Authentication

- [ ] Halaman login tersedia dan dapat diakses.
- [ ] Login berhasil menggunakan akun internal yang valid.
- [ ] Login gagal menampilkan pesan error yang sesuai untuk kredensial salah.
- [ ] Setelah login, pengguna diarahkan ke Dashboard.
- [ ] Halaman Dashboard, Knowledge Hub, dan AI Response Assistant bersifat protected.
- [ ] Akses langsung ke URL protected tanpa sesi valid mengarahkan ke halaman login.
- [ ] Fungsi logout tersedia dan menghapus sesi.
- [ ] Setelah logout, halaman protected tidak dapat diakses dengan session lama.
- [ ] Session expiry ditangani: pengguna diminta login kembali dengan pesan yang jelas.
- [ ] Refresh halaman tidak menyebabkan logout tidak terduga selama sesi masih valid.

### 24.2 Functional Completion — Dashboard

- [ ] Dashboard tampil otomatis setelah login.
- [ ] Dashboard menampilkan navigasi ke Knowledge Hub.
- [ ] Dashboard menampilkan navigasi ke AI Response Assistant.
- [ ] Tombol logout tersedia di Dashboard.
- [ ] Navigasi antar fitur tidak memerlukan login ulang.
- [ ] Dashboard TIDAK menampilkan analytics, statistik tiket, atau performance metrics.

### 24.3 Functional Completion — Knowledge Hub

- [ ] Knowledge Hub dapat dibuka dari Dashboard.
- [ ] Daftar knowledge ditampilkan dengan judul dan kategori.
- [ ] Kategori yang didukung: SOP, FAQ, Troubleshooting guide, Template balasan.
- [ ] Filter atau pemilihan kategori berfungsi.
- [ ] Search input menerima kata kunci.
- [ ] Hasil pencarian menampilkan knowledge yang relevan berdasarkan judul/isi.
- [ ] Hasil pencarian menampilkan judul, kategori, dan ringkasan/cuplikan.
- [ ] Klik hasil pencarian membuka halaman detail knowledge.
- [ ] Halaman detail menampilkan judul, kategori, isi, dan referensi sumber.
- [ ] Knowledge yang ditampilkan berasal dari data sinkronisasi Notion (bukan hardcode).
- [ ] Tidak terdapat fungsi edit dokumen Notion dari Knowledge Hub.
- [ ] Empty state tampil ketika belum ada knowledge.
- [ ] Empty state tampil ketika hasil pencarian tidak ditemukan.
- [ ] Error state tampil ketika database tidak dapat diakses.

### 24.4 Functional Completion — Notion Synchronization

- [ ] Sinkronisasi Notion dapat dijalankan (manual trigger atau terjadwal sesuai desain teknis).
- [ ] Data hasil sinkronisasi tersimpan di PostgreSQL/Supabase.
- [ ] Knowledge dari Notion muncul di Knowledge Hub setelah sinkronisasi.
- [ ] Status sinkronisasi tercatat di sistem (last synced, success/fail).
- [ ] Kegagalan sinkronisasi tercatat dalam log untuk troubleshooting.
- [ ] Knowledge Hub menggunakan hasil sinkronisasi terakhir yang berhasil.
- [ ] Perubahan di Notion ter-refleksi di Knowledge Hub setelah sinkronisasi berjalan.
- [ ] Tidak ada duplikasi data ketika sinkronisasi dijalankan ulang.

### 24.5 Functional Completion — AI Response Assistant

- [ ] AI Response Assistant dapat dibuka dari Dashboard.
- [ ] Input konteks client tersedia dan menerima teks.
- [ ] Tombol generate draft tersedia.
- [ ] Sistem mengambil knowledge relevan dari Knowledge Hub sebagai context.
- [ ] Request dikirim ke Claude API melalui server (bukan langsung dari browser).
- [ ] Draft balasan ditampilkan setelah respons Claude API diterima.
- [ ] Draft mengacu pada knowledge yang relevan (SOP/FAQ/troubleshooting/template).
- [ ] Draft dapat diedit oleh Customer Support.
- [ ] Fungsi copy draft tersedia.
- [ ] Tidak ada tombol auto-send ke client.
- [ ] Tidak ada mekanisme pengiriman otomatis ke kanal eksternal.
- [ ] Peringatan "draft wajib divalidasi" tampil jelas di UI.
- [ ] Indikator tampil ketika knowledge tidak cukup relevan.
- [ ] Loading state tampil selama menunggu respons Claude API.
- [ ] Error state tampil ketika Claude API gagal/timeout/rate limit.
- [ ] Aplikasi tidak crash ketika AI gagal; pengguna tetap dapat mencoba ulang.

### 24.6 Quality — Error & Edge Case Handling

- [ ] Semua halaman memiliki loading state.
- [ ] Semua halaman memiliki empty state.
- [ ] Semua halaman memiliki error state.
- [ ] Unauthorized access ditangani (redirect ke login).
- [ ] Session expired ditangani.
- [ ] Database unavailable menampilkan pesan error yang informatif.
- [ ] Claude API unavailable menampilkan pesan error yang informatif.
- [ ] Sinkronisasi gagal tidak menyebabkan data korup.
- [ ] Input kosong pada search/AI ditangani (validasi).
- [ ] Input karakter khusus/panjang ditangani tanpa error.

### 24.7 Quality — Security

- [ ] API key Claude HANYA di server / environment variable.
- [ ] API key Claude tidak ter-expose di client bundle (verifikasi network/build).
- [ ] Semua halaman internal protected oleh middleware/auth check.
- [ ] Input pengguna divalidasi di server sebelum diproses.
- [ ] Credential pihak ketiga tidak masuk ke prompt atau data knowledge.
- [ ] Tidak ada data sensitif yang dicatat di log aplikasi.
- [ ] Notion credential tersimpan dengan aman (tidak hardcode).

### 24.8 Quality — Usability & UI

- [ ] Semua state wajib (lihat 12.6) sudah didesain dan diimplementasi.
- [ ] Alur pencarian dapat diselesaikan dalam ~3 menit pada skenario umum.
- [ ] Kategori knowledge mudah dibedakan secara visual.
- [ ] Draft AI mudah dibaca dan diedit.
- [ ] Peringatan validasi manual terlihat jelas.
- [ ] Navigasi konsisten di seluruh halaman.
- [ ] Responsive untuk layar desktop (target utama CS).

### 24.9 Testing

- [ ] Test scenario authentication dijalankan dan lulus.
- [ ] Test scenario Dashboard dijalankan dan lulus.
- [ ] Test scenario Knowledge Hub dijalankan dan lulus.
- [ ] Test scenario pencarian dijalankan dan lulus.
- [ ] Test scenario detail knowledge dijalankan dan lulus.
- [ ] Test scenario sinkronisasi Notion dijalankan dan lulus.
- [ ] Test scenario AI draft generation dijalankan dan lulus.
- [ ] Test scenario edit draft dijalankan dan lulus.
- [ ] Negative test API error (timeout, rate limit, invalid key) dijalankan.
- [ ] Negative test database unavailable dijalankan.
- [ ] Negative test sinkronisasi gagal dijalankan.
- [ ] Cross-browser test (minimal Chrome + Edge) lulus.
- [ ] UAT bersama Customer Support dijalankan minimal 1 siklus.
- [ ] Feedback UAT terdokumentasi dan ditindaklanjuti.

### 24.10 Defect Management

- [ ] Tidak ada bug dengan severity **Critical** yang masih open.
- [ ] Tidak ada bug dengan severity **High** yang masih open.
- [ ] Bug severity **Medium/Low** terdokumentasi dengan keputusan (fix / defer).
- [ ] Setiap bug memiliki langkah reproduksi yang jelas.

### 24.11 Data Quality

- [ ] Knowledge yang tersinkronisasi memiliki judul yang jelas.
- [ ] Knowledge memiliki kategori yang benar.
- [ ] Tidak ada knowledge duplikat.
- [ ] Referensi sumber Notion tersedia untuk setiap knowledge.
- [ ] Last synced timestamp tercatat.

### 24.12 Documentation

- [ ] Dokumen PRD final disetujui Product Owner.
- [ ] Design handoff lengkap untuk semua halaman dan state.
- [ ] Dokumentasi teknis sinkronisasi Notion tersedia.
- [ ] Dokumentasi environment variable / setup tersedia.
- [ ] Panduan penggunaan MVP untuk Customer Support tersedia.
- [ ] Release notes MVP tersedia.

### 24.13 Deployment & Release

- [ ] Environment variable production terkonfigurasi (Claude API key, Notion credential, Supabase, NextAuth).
- [ ] Database production (Supabase) siap dan schema ter-deploy.
- [ ] Build production berhasil tanpa error.
- [ ] Aplikasi dapat diakses di environment production.
- [ ] Login berfungsi di production.
- [ ] Sinkronisasi Notion berfungsi di production.
- [ ] Claude API berfungsi di production.
- [ ] Protected routes berfungsi di production.
- [ ] Smoke test production lulus.
- [ ] Tidak ada fitur out-of-scope yang ikut ter-deploy.

### 24.14 Sign-off

- [ ] QA Engineer sign-off.
- [ ] Developer lead sign-off.
- [ ] Product Owner sign-off.
- [ ] Customer Support representative sign-off (hasil UAT).
- [ ] MVP dinyatakan **DONE** dan siap dirilis.

---

## 25. Test Plan & Checklist

### 25.1 Lingkup Pengujian

Pengujian mencakup: functional, negative/error, security, usability, dan UAT.

### 25.2 Test Scenario — Authentication

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-AUTH-01 | Buka URL protected tanpa login | Redirect ke halaman login | ☐ |
| TC-AUTH-02 | Login dengan kredensial valid | Berhasil, masuk Dashboard | ☐ |
| TC-AUTH-03 | Login dengan kredensial salah | Pesan error, tetap di halaman login | ☐ |
| TC-AUTH-04 | Klik logout | Sesi berakhir, redirect ke login | ☐ |
| TC-AUTH-05 | Akses protected setelah logout | Redirect ke login (sesi lama invalid) | ☐ |
| TC-AUTH-06 | Session expired | Pengguna diminta login ulang | ☐ |

### 25.3 Test Scenario — Dashboard

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-DASH-01 | Login berhasil | Langsung ke Dashboard | ☐ |
| TC-DASH-02 | Klik menu Knowledge Hub | Pindah ke Knowledge Hub | ☐ |
| TC-DASH-03 | Klik menu AI Response Assistant | Pindah ke AI Assistant | ☐ |
| TC-DASH-04 | Periksa elemen Dashboard | Tidak ada analytics/statistik | ☐ |

### 25.4 Test Scenario — Knowledge Hub

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-KH-01 | Buka Knowledge Hub | Daftar knowledge tampil | ☐ |
| TC-KH-02 | Pilih kategori SOP | Hanya knowledge kategori SOP tampil | ☐ |
| TC-KH-03 | Cari dengan kata kunci valid | Hasil relevan tampil | ☐ |
| TC-KH-04 | Cari dengan kata kunci tak ada | Empty state tampil | ☐ |
| TC-KH-05 | Klik salah satu hasil | Halaman detail terbuka | ☐ |
| TC-KH-06 | Periksa detail knowledge | Judul, kategori, isi, sumber lengkap | ☐ |
| TC-KH-07 | Cek sumber data | Berasal dari Notion (bukan hardcode) | ☐ |
| TC-KH-08 | Database dimatikan/disimulasikan down | Error state tampil | ☐ |
| TC-KH-09 | Knowledge Hub kosong | Empty state tampil | ☐ |

### 25.5 Test Scenario — Notion Synchronization

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-SYNC-01 | Jalankan sinkronisasi | Data tersimpan ke DB | ☐ |
| TC-SYNC-02 | Setelah sync, cek Knowledge Hub | Knowledge baru muncul | ☐ |
| TC-SYNC-03 | Ubah dokumen di Notion, sync ulang | Perubahan ter-refleksi | ☐ |
| TC-SYNC-04 | Jalankan sync dua kali | Tidak ada duplikasi | ☐ |
| TC-SYNC-05 | Simulasikan Notion tidak dapat diakses | Kegagalan tercatat di log | ☐ |
| TC-SYNC-06 | Cek status sinkronisasi | Last synced + success/fail tercatat | ☐ |

### 25.6 Test Scenario — AI Response Assistant

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-AI-01 | Buka AI Response Assistant | Input konteks tersedia | ☐ |
| TC-AI-02 | Masukkan konteks, klik generate | Loading state tampil | ☐ |
| TC-AI-03 | Tunggu respons | Draft balasan tampil | ☐ |
| TC-AI-04 | Periksa draft | Mengacu pada knowledge relevan | ☐ |
| TC-AI-05 | Edit draft | Perubahan tersimpan di area draft | ☐ |
| TC-AI-06 | Klik copy | Draft tersalin ke clipboard | ☐ |
| TC-AI-07 | Cari tombol auto-send | Tidak ada (validasi non-eksistensi) | ☐ |
| TC-AI-08 | Cek peringatan validasi | Tampil jelas | ☐ |
| TC-AI-09 | Konteks tanpa knowledge relevan | Indikator perlu pemeriksaan manual | ☐ |
| TC-AI-10 | Claude API gagal (simulasi) | Error state, aplikasi tidak crash | ☐ |
| TC-AI-11 | Timeout request | Error state informatif | ☐ |
| TC-AI-12 | Input kosong lalu generate | Validasi mencegah / beri pesan | ☐ |
| TC-AI-13 | Cek network request | API key tidak ter-expose di browser | ☐ |

### 25.7 Test Scenario — Security

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-SEC-01 | Inspect client bundle | Tidak ada Claude API key | ☐ |
| TC-SEC-02 | Akses protected route tanpa sesi | Ditolak, redirect login | ☐ |
| TC-SEC-03 | Kirim request manipulasi sesi | Ditolak | ☐ |
| TC-SEC-04 | Input XSS / script di search | Tidak dieksekusi | ☐ |
| TC-SEC-05 | Input sangat panjang | Ditolak/ditangani, tidak crash | ☐ |

### 25.8 Test Scenario — Cross Browser & Performance

| ID | Skenario | Expected Result | Status |
|---|---|---|---|
| TC-PERF-01 | Buka di Chrome | Berfungsi normal | ☐ |
| TC-PERF-02 | Buka di Edge | Berfungsi normal | ☐ |
| TC-PERF-03 | Knowledge Hub load time | Wajar (<3-5 detik) | ☐ |
| TC-PERF-04 | Search response time | Wajar | ☐ |
| TC-PERF-05 | AI draft response time | Wajar (dengan loading state) | ☐ |

### 25.9 UAT Skenario (Customer Support)

UAT dilakukan oleh Customer Support menggunakan skenario kasus nyata.

| ID | Skenario UAT | Target | Status |
|---|---|---|---|
| UAT-01 | Cari SOP relevan dari kasus nyata | Ditemukan dalam ~3 menit | ☐ |
| UAT-02 | Cari FAQ relevan | Ditemukan dalam ~3 menit | ☐ |
| UAT-03 | Cari troubleshooting guide | Ditemukan dalam ~3 menit | ☐ |
| UAT-04 | Cari template balasan | Ditemukan dalam ~3 menit | ☐ |
| UAT-05 | Generate draft dari kasus nyata | Draft relevan dengan konteks | ☐ |
| UAT-06 | Penyesuaian draft minimal | Draft dapat digunakan sedikit edit | ☐ |
| UAT-07 | Validasi manual dilakukan | CS mengkonfirmasi review sebelum pakai | ☐ |
| UAT-08 | Overall usability feedback | CS puas dengan alur | ☐ |

### 25.10 Exit Criteria Pengujian

MVP siap rilis ketika SELURUH kondisi terpenuhi:

- [ ] 100% Test Scenario dengan severity Critical/High lulus.
- [ ] Tidak ada bug Critical/High open.
- [ ] Minimal 1 siklus UAT Customer Support selesai.
- [ ] Smoke test production lulus.
- [ ] Definition of Done (section 24) seluruhnya tercentang.
- [ ] Sign-off dari QA, Developer Lead, Product Owner, dan Customer Support representative.

---

*Dokumen ini bersifat living document dan dapat diperbarui seiring finalisasi detail teknis pada fase development.*
