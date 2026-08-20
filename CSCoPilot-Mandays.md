# CSCoPilot — Mandays Estimation (1 Month MVP)

**Project:** CSCoPilot – AI Decision Support System for Customer Support  
**Target:** MVP selesai dalam **30 hari kerja (1 bulan)**  
**Execution model:** Tim paralel, bukan sekuensial  
**Frontend:** Next.js + TypeScript + shadcn/ui + Tailwind CSS  
**Backend:** Next.js Route Handlers, PostgreSQL/Supabase, Notion API, Claude API

---

## 1. Asumsi Tim (Parallel Execution)

MVP 30 hari kerja **hanya mungkin jika tim bekerja paralel**, bukan satu orang mengerjakan semua secara berurutan.

| Role | Orang | Hari Kerja Efektif | Catatan |
|---|---:|---:|---|
| Designer | 1 | ~6 hari | Full di minggu 1–2, lalu review di minggu 3–4 |
| Frontend Developer | 1 | ~14 hari | Mulai hari ke-3 setelah design awal ready |
| Backend Developer | 1 | ~19 hari | **Critical path.** Mulai hari ke-2 |
| QA Engineer | 1 | ~10 hari | Mulai minggu 3 saat fitur ready |
| **Total effort** | **4** | **~49 MD** | Diselesaikan dalam **30 hari kerja kalender** |

> Total **49 MD** dikerjakan oleh 4 orang paralel → selesai dalam **30 hari kerja**. Bila hanya 1 orang fullstack, MVP **tidak** bisa selesai dalam 1 bulan.

---

## 2. Mandays Table

| No | Module Name | Estimated Day(s) | Design | FE (Next.js) | Backend | QA | Note |
|---:|---|---:|---:|---:|---:|---:|---|
|  | **Planning** | **4** | **1** | **0,5** | **1,5** | **1** | DB design, design planning, development env preparation |
| 1 | **User** | **28,5** | **5** | **12,5** | **8** | **3** | Modul Customer Support |
| 1.1 | Authentication | 4,5 | 1 | 2 | 1 | 0,5 | NextAuth, login, logout, session, protected route |
| 1.2 | Dashboard | 3 | 1 | 1,5 | 0 | 0,5 | Landing page + navigasi fitur |
| 1.3 | Knowledge Hub | 11,5 | 2 | 5 | 3 | 1,5 | Search, filter kategori, list, detail, state |
| 1.4 | AI Response Assistant | 9,5 | 1 | 4 | 4 | 0,5 | Claude API, draft, edit, copy, error handling |
| 2 | **Admin** | **11,5** | **0** | **0,5** | **9** | **2** | Proses internal; bukan halaman admin pada MVP |
| 2.1 | Database & API Foundation | 3 | 0 | 0 | 3 | 0 | Supabase, schema, migration, index, service layer |
| 2.2 | Notion Sync | 4 | 0 | 0 | 3,5 | 0,5 | Mapping, upsert, incremental, duplicate prevention |
| 2.3 | Sync status & Logging | 1,5 | 0 | 0 | 1 | 0,5 | sync_runs, status, error log |
| 2.4 | Security & External Integration | 3 | 0 | 0,5 | 1,5 | 1 | Server-only secret, validation, error mapping, health check |
| 3 | **QA, UAT & Release** | **5** | **0** | **0,5** | **0,5** | **4** | Integration, UAT, bug fix, deployment, dokumentasi |
|  | **TOTAL** | **49** | **6** | **14** | **19** | **10** | **Base estimate untuk 30 hari kerja** |

---

## 3. Rekapitulasi Per Role

| Role | Mandays | % |
|---|---:|---:|
| Design | 6 MD | 12% |
| Frontend | 14 MD | 29% |
| Backend | 19 MD | 39% |
| QA | 10 MD | 20% |
| **Total** | **49 MD** | **100%** |

**Critical path:** Backend (19 MD). Backend dev membutuhkan ~19 hari kerja. Karena dimulai hari ke-2 dan total ada 30 hari, **masih ada buffer ~8 hari** untuk dependency, bug fix, dan integrasi.

---

## 4. Timeline 30 Hari Kerja (6 Minggu × 5 Hari)

### Minggu 1 (Hari 1–5) — Foundation & Design

| Hari | Design | Frontend | Backend | QA |
|---:|---|---|---|---|
| 1 | Requirement + user flow | — | DB design + API contract | — |
| 2 | Wireframe login + dashboard | — | Supabase setup + schema | — |
| 3 | Wireframe Knowledge Hub | Next.js setup + layout | Migration + service layer | — |
| 4 | Wireframe AI Assistant | Login page + NextAuth FE | NextAuth config | — |
| 5 | Design system + shadcn setup | Dashboard + protected route | Knowledge API (GET list) | — |

**Output minggu 1:** Design awal siap, FE foundation siap, DB + Auth siap.

### Minggu 2 (Hari 6–10) — Core Build

| Hari | Design | Frontend | Backend | QA |
|---:|---|---|---|---|
| 6 | UI Knowledge Hub | Knowledge list + search | Knowledge API (detail) | — |
| 7 | UI AI Assistant | Category filter | Notion API client + mapping | — |
| 8 | State design (loading/empty/error) | Knowledge detail page | Initial sync script | — |
| 9 | Review FE build | State components | Upsert + duplicate prevention | — |
| 10 | Review sync | Knowledge Hub polish | Sync status + logging | — |

**Output minggu 2:** Knowledge Hub fungsional end-to-end, Notion sync berjalan.

### Minggu 3 (Hari 11–15) — Feature Completion

| Hari | Design | Frontend | Backend | QA |
|---:|---|---|---|---|
| 11 | AI Assistant final | AI Assistant input form | Claude API integration (server) | Test plan final |
| 12 | Handoff design | Generate button + loading | Prompt + knowledge retrieval | Smoke test Knowledge Hub |
| 13 | — | Draft result display | Error handling Claude | Test Knowledge detail |
| 14 | — | Edit + copy draft | Timeout + rate limit | Test Notion sync |
| 15 | — | Validation disclaimer + source list | AI route hardening | Test AI draft (happy path) |

**Output minggu 3:** AI Response Assistant fungsional, semua fitur MVP completed.

### Minggu 4 (Hari 16–20) — Hardening & Integration

| Hari | Design | Frontend | Backend | QA |
|---:|---|---|---|---|
| 16 | Visual polish | Empty/error/unauthorized state | Security review (secret, validation) | Negative test (API fail) |
| 17 | — | Session expired state | Health check + error mapping | Security test (key exposure) |
| 18 | — | Responsive + a11y | Performance check | Regression test |
| 19 | — | Bug fix UAT prep | Bug fix | Bug fix |
| 20 | Design review | Bug fix | Bug fix | Integration test full |

**Output minggu 4:** Semua state lengkap, security pass, regression pass.

### Minggu 5 (Hari 21–25) — UAT

| Hari | Design | Frontend | Backend | QA |
|---:|---|---|---|---|
| 21 | — | UAT support | UAT support | UAT siklus 1 (CS) |
| 22 | — | UAT support | UAT support | UAT siklus 1 |
| 23 | — | Bug fix | Bug fix | UAT feedback compile |
| 24 | — | Bug fix | Bug fix | UAT siklus 2 |
| 25 | — | Final polish | Final polish | UAT sign-off |

**Output minggu 5:** UAT selesai, bug Critical/High = 0.

### Minggu 6 (Hari 26–30) — Release

| Hari | Design | Frontend | Backend | QA |
|---:|---|---|---|---|
| 26 | — | Deploy prep | Production env + secrets | Smoke test staging |
| 27 | — | Deploy | DB migration production | Smoke test production |
| 28 | Dokumentasi penggunaan | Dokumentasi FE | Dokumentasi teknis | Test evidence + release note |
| 29 | — | Final check | Final check | Final regression |
| 30 | — | **Release** | **Release** | **Sign-off + release** |

**Output minggu 6:** MVP production ready, documented, signed-off.

---

## 5. Detail Effort Per Modul

### Planning — 3 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Design | 1 | Requirement, user flow, design direction |
| FE | 0,5 | Next.js setup, shadcn/ui init, struktur folder |
| Backend | 1,5 | DB design, API contract, env, Supabase setup |

### Authentication — 4,5 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Design | 1 | Login page, error, session expired |
| FE | 2 | Login UI, NextAuth FE, protected route, logout |
| Backend | 1 | NextAuth config, session, middleware |
| QA | 0,5 | Login valid/invalid, protected, logout |

### Dashboard — 3 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Design | 1 | Layout, navigation card, user info |
| FE | 1,5 | Dashboard page, navigasi fitur |
| QA | 0,5 | Navigasi, no out-of-scope fitur |

### Knowledge Hub — 12,5 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Design | 3 | List, search, filter, detail, state |
| FE | 5 | List, search, filter, detail, pagination, state |
| Backend | 3 | `GET /api/knowledge`, detail, search query, validation |
| QA | 1,5 | Search, filter, detail, empty, error |

### AI Response Assistant — 10,5 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Design | 2 | Input, generate, draft, source, disclaimer, state |
| FE | 4 | Context form, generate, loading, draft, edit, copy |
| Backend | 4 | `POST /api/ai/draft`, Claude SDK, retrieval, prompt, error |
| QA | 0,5 | Happy path, no-knowledge, error provider |

### Database Foundation — 3 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Backend | 3 | Supabase, schema `knowledge_items` + `sync_runs`, index, service layer |

### Notion Synchronization — 4 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Backend | 3,5 | Notion client, mapping, upsert, incremental, duplicate prevention |
| QA | 0,5 | Sync awal, update, duplicate, failure |

### Sync Status & Logging — 1,5 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| Backend | 1 | `POST /api/sync/notion`, `GET /api/sync/status`, logging |
| QA | 0,5 | Status read, error log tanpa secret |

### Hardening — 3 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| FE | 0,5 | Final state, a11y, responsive |
| Backend | 1,5 | Secret audit, validation, error mapping, health check |
| QA | 1 | Negative, security, regression |

### QA, UAT & Release — 5 MD

| Role | Hari | Aktivitas |
|---|---:|---|
| FE | 0,5 | Deploy support, dokumentasi |
| Backend | 0,5 | Deploy, migration, dokumentasi |
| QA | 4 | Integration, UAT 2 siklus, regression, smoke, release note |

---

## 6. API Wajib (Sudah Termasuk dalam Estimasi)

| API | Method | Modul |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Authentication |
| `/api/knowledge` | GET | Knowledge Hub |
| `/api/knowledge/[id]` | GET | Knowledge Hub |
| `/api/ai/draft` | POST | AI Response Assistant |
| `/api/sync/notion` | POST | Notion Sync |
| `/api/sync/status` | GET | Sync Status |
| `/api/health` | GET | Hardening |

---

## 7. Definition of Done Per Modul

### Planning

- [ ] Scope & acceptance criteria disetujui.
- [ ] API contract disepakati FE-BE.
- [ ] DB design disetujui.
- [ ] Akses Notion + Claude API + Supabase tersedia.
- [ ] Environment development siap.

### Authentication

- [ ] Login valid berhasil, invalid menampilkan error.
- [ ] Protected route berfungsi.
- [ ] Logout menghapus session.
- [ ] Session expiry ditangani.

### Dashboard

- [ ] Tampil setelah login.
- [ ] Navigasi Knowledge Hub + AI Assistant.
- [ ] Logout tersedia.
- [ ] Tidak ada fitur out-of-scope.

### Knowledge Hub

- [ ] Data dari hasil sync Notion.
- [ ] Search + filter kategori berfungsi.
- [ ] Detail knowledge lengkap.
- [ ] Loading, empty, error state tersedia.
- [ ] Tidak ada edit dokumen Notion.

### Notion Sync

- [ ] Credential aman di server.
- [ ] Sync awal + update berfungsi.
- [ ] Tidak ada duplikasi.
- [ ] Status + error tercatat.
- [ ] Data lama tetap aman saat sync baru gagal.

### AI Response Assistant

- [ ] Input konteks + generate berfungsi.
- [ ] Claude API dipanggil dari server.
- [ ] API key tidak ter-expose.
- [ ] Draft tampil, bisa edit + copy.
- [ ] Disclaimer validasi tampil.
- [ ] Tidak ada auto-send.
- [ ] Error provider ditangani.

### Release

- [ ] Functional + integration + negative test lulus.
- [ ] UAT 2 siklus selesai.
- [ ] Tidak ada bug Critical/High.
- [ ] Production build + smoke test lulus.
- [ ] Dokumentasi lengkap.
- [ ] Sign-off QA, Dev Lead, PO, CS.

---

## 8. Risiko yang Bisa Menggeser Timeline

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Struktur Notion tidak konsisten | +2–4 hari | Audit Notion di Planning (hari 1–2) |
| Provider auth belum dikonfirmasi | +2–3 hari | Konfirmasi sebelum hari 1 |
| Backend jadi 1 orang, sakit/berhalangan | +5–7 hari | Tambah 1 backend atau fullstack |
| Prompt AI perlu iterasi banyak | +1–2 hari | Evaluasi prompt di minggu 3 |
| Scope creep | +3–5 hari | Kunci out-of-scope di PRD |

### Buffer

- Backend: 19 MD dalam ~24 hari kerja yang tersedia → buffer **5 hari**.
- Total timeline: 50 MD dikerjakan 4 orang paralel dalam **30 hari** → buffer **realistis**.

---

## 9. Syarat MVP Bisa Selesai 30 Hari

1. **Tim minimal 4 orang paralel** (Design, FE, Backend, QA).
2. **Backend dimulai hari ke-2**, tidak menunggu design selesai.
3. **FE dimulai hari ke-3** setelah wireframe awal ready (tidak perlu final).
4. **Akses Notion, Claude API, Supabase** tersedia sebelum hari 1.
5. **Provider auth dikonfirmasi** sebelum sprint dimulai.
6. **Scope dikunci** — tidak ada penambahan fitur di tengah jalan.
7. **QA mulai minggu 3**, bukan menunggu semua fitur selesai.

Jika salah satu syarat tidak terpenuhi, tambahkan **5–10 hari kerja** atau kurangi scope (contoh: tunda Notion incremental sync ke post-MVP).

---

## 10. Ringkasan

| Item | Nilai |
|---|---:|
| Total mandays | **49 MD** |
| Tim paralel | 4 orang |
| Hari kerja kalender | **30 hari** |
| Buffer backend | ~8 hari |
| Base estimate tanpa paralel | 49 MD |
| **Achievable dalam 1 bulan?** | **Ya, dengan syarat tim paralel + scope dikunci** |
