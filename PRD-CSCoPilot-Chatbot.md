# Product Requirements Document — CSCoPilot Chatbot

**Version:** Draft 0.2
**Status:** Proposal
**Target:** MVP 1 bulan
**Product type:** Internal chatbot untuk Customer Support

## 1. Project Information

**Project Title:** CSCoPilot — Internal AI Chatbot for Customer Support
**Project Type:** ☑ Internal Business Improvement
**Project Stage:** 1-month MVP
**Target Platform:** Web application
**Target Users:** Internal Customer Support team

## 2. Ringkasan

CSCoPilot adalah chatbot internal berbasis AI yang membantu Customer Support memahami issue dan menemukan solusi dari knowledge perusahaan melalui satu chatbot.

Agent cukup menuliskan issue melalui chat. Chatbot memahami konteks, mencari informasi relevan dari Notion, dan memberikan jawaban lengkap dengan source reference. Chatbot hanya berupa satu interface percakapan — tanpa Knowledge Hub terpisah, tanpa AI Response Assistant terpisah, tanpa draft balasan, dan tanpa approval workflow.

Notion tetap menjadi **single source of truth**. Dokumen yang disetujui di Notion diindeks agar dapat dicari chatbot. Database hanya menyimpan user, histori chat, dan metadata pencarian.

MVP ini ditujukan untuk validasi dengan user dan use case terbatas, bukan production penuh.

**Prinsip utama:** Chatbot membantu agent menemukan dan memahami informasi; agent tetap menggunakan jawaban sesuai prosedur internal.

## 3. Masalah

Customer Support Agent saat ini perlu:

- Membuka banyak dokumen untuk mencari solusi.
- Mengulang investigasi untuk issue yang mirip.
- Mengandalkan pengalaman individual.

Dampaknya: waktu respons lebih lama, jawaban tidak konsisten, dan proses onboarding agent lebih sulit. Masalah ini berdampak pada Support Lead, Knowledge Owner, dan management.

## 4. Solution Overview

CSCoPilot menyediakan satu chatbot internal sebagai interface utama. Agent menulis issue, lalu chatbot:

1. Memahami konteks pertanyaan dan meminta klarifikasi bila informasi belum cukup.
2. Mencari knowledge yang relevan dari Notion.
3. Menampilkan kemungkinan penyebab dan langkah penyelesaian.
4. Menyertakan source reference agar jawaban dapat diverifikasi.
5. Melanjutkan percakapan berdasarkan pertanyaan berikutnya.

**Catatan peran:**
- Chatbot = interface agent.
- Notion = source of truth.
- Database = histori percakapan dan metadata pencarian.
- AI = pemahaman issue dan retrieval jawaban.
- Customer Support = pengambil keputusan akhir.

Tidak ada draft balasan, approval workflow, atau auto-reply sebagai fitur.

## 5. Users & Stakeholders

| Users | Stakeholders |
|---|---|
| Customer Support | Management |
| | Project Manager |
| | Product Owner / Internal System Team |
| | Developer |

**Customer Support** satu-satunya pengguna chatbot — menulis issue dan membaca jawaban. **Management, Project Manager, Product Owner, dan Developer** adalah stakeholder yang menilai progres, scope, dan hasil pilot, bukan pengguna harian chatbot.

## 6. Expected Value

| Category | Expected Benefit |
|---|---|
| **Productivity** | Mengurangi waktu pencarian SOP dan dokumentasi. Mengurangi pekerjaan investigasi yang berulang. |
| **Cost Saving** | Mengurangi waktu onboarding Customer Support baru. Mengurangi waktu koordinasi antar tim untuk kasus serupa. |
| **Quality Improvement** | Meningkatkan konsistensi informasi melalui jawaban berbasis source resmi. Mengurangi human error dalam penyampaian informasi. |
| **Employee Experience** | Mempermudah agent memperoleh informasi tanpa harus mengetahui lokasi dokumen. Mempercepat proses pembelajaran anggota tim baru. |
| **Knowledge Management** | Dokumentasi tetap terpusat di Notion sebagai single source of truth tanpa duplikasi data. |
| **Future Foundation** | Menjadi fondasi pengembangan CSCoPilot pada tahap berikutnya. |

## 7. Target User

### Primary user — Customer Support Agent

Membutuhkan jawaban cepat dan langkah troubleshooting berbasis knowledge internal.

### Stakeholder — Support Lead, Management, Project Manager, Product Owner

Membutuhkan visibility terhadap adopsi, konsistensi jawaban, dan hasil pilot.

## 8. Use Case Utama

### UC-01 — Mencari solusi issue melalui chat

Agent menulis issue menggunakan bahasa natural. Chatbot memahami konteks, mencari knowledge yang relevan, lalu memberikan kemungkinan penyebab dan langkah penyelesaian.

### UC-02 — Verifikasi source

Agent membuka referensi yang digunakan chatbot untuk memverifikasi informasi sebelum digunakan kepada client.

### UC-03 — Melanjutkan percakapan

Agent dapat memberikan informasi tambahan tanpa mengulang seluruh konteks issue.

## 9. User Flow

```text
Agent login
  ↓
Agent membuka chatbot dan menulis issue
  ↓
Chatbot memahami konteks
  ↓
Sistem mencari knowledge relevan dari Notion
  ↓
Chatbot menampilkan analisis, solusi, dan source
  ↓
Agent melanjutkan percakapan atau mengambil tindakan sesuai prosedur
```

## 10. Functional Requirements

### FR-01 — Chat interface

- Menampilkan percakapan user dan chatbot.
- Mendukung input teks.
- Menampilkan status loading.
- Menampilkan error yang jelas.
- Menyimpan konteks selama satu sesi.
- Memiliki tombol mulai percakapan baru.

### FR-02 — Issue understanding

Chatbot harus dapat:

- Memahami bahasa natural.
- Mengidentifikasi inti issue.
- Meminta klarifikasi jika informasi kurang.

### FR-03 — Knowledge-grounded response

- Jawaban menggunakan knowledge internal yang tersedia.
- Source ditampilkan pada jawaban.
- Source memiliki judul dan waktu update jika tersedia.
- Jika source tidak ditemukan, chatbot menyatakan keterbatasannya.
- Chatbot tidak boleh mengklaim kepastian tanpa evidence.

### FR-04 — Conversation history

- Menampilkan sesi percakapan milik user.
- Menyimpan waktu, pesan, dan source.
- User dapat membuka kembali sesi sebelumnya.
- User dapat memulai sesi baru.

### FR-05 — Access control

- Hanya user yang sudah login yang dapat mengakses chatbot.
- API key dan credentials tidak boleh dikirim ke browser.

## 11. Contoh Percakapan

**Agent:**

> Customer tidak bisa login setelah mengganti password.

**CSCoPilot:**

> Saya menemukan dua kemungkinan penyebab: session lama masih aktif atau password baru belum tersinkronisasi. Coba logout dari seluruh perangkat, lalu login melalui browser incognito. Jika masih gagal, lakukan reset password ulang.
>
> **Source:** Authentication Troubleshooting v2

## 12. Data dan Arsitektur

### Sumber knowledge

- MVP: Notion sebagai source utama.
- Notion tetap menjadi source of truth.
- Sistem mengambil salinan terindeks untuk pencarian.

### Database

Rekomendasi: PostgreSQL melalui Supabase.

Data minimal:

- `users`
- `conversations`
- `messages`
- `knowledge_documents`
- `knowledge_chunks`
- `sources`
- `sync_logs`

### Arsitektur

```text
Web Chatbot — Next.js
        ↓
Backend API / Server Actions
        ↓
Retrieval layer — keyword atau vector search
        ↓
PostgreSQL + pgvector
        ↓
Notion sync
        ↓
LLM provider
```

### Hosting MVP

- Web application: Vercel.
- Database: Supabase PostgreSQL.
- Secrets: environment variables atau secret manager.
- AI API: server-side only.
- Source knowledge: Notion API.

## 13. Non-Functional Requirements

### Security

- API key tidak boleh berada di client.
- Data dikirim melalui HTTPS.
- Conversation hanya dapat diakses oleh user yang berwenang.

### Performance

- Response awal chatbot maksimal 5 detik pada kondisi normal.
- Loading state ditampilkan selama proses berlangsung.
- Timeout dan retry diberlakukan pada API eksternal.

### Reliability

- Error provider AI tidak boleh menghapus histori chat.
- Jika knowledge tidak ditemukan, chatbot memberikan fallback yang jujur.
- Sinkronisasi gagal harus tercatat dan dapat diulang.

### Usability

- Agent dapat memulai chat tanpa training panjang.
- Jawaban mudah dipindai.
- Source terlihat jelas.
- Keyboard dan mobile layout tetap usable.

## 14. Scope — 1-Month MVP

### Included Features

| Feature List | Platform / Tech Stack |
|---|---|
| Internal chatbot conversation interface | Next.js / React |
| Natural-language issue input | Next.js + server-side API |
| AI-generated answer berdasarkan knowledge internal | Claude API |
| Integrasi Notion terbatas | Notion API |
| Scheduled sync dan indexing dokumen terpilih | Backend server-side process |
| Source reference pada jawaban chatbot | PostgreSQL / Supabase |
| Conversation history | PostgreSQL / Supabase |
| Authentication internal dasar | NextAuth atau provider yang disetujui |

### Out of Scope

| Feature List | Why Out of Scope |
|---|---|
| Chatbot customer-facing dan AI auto-reply | MVP hanya untuk internal Customer Support. Chatbot tidak mengirim jawaban otomatis ke client. |
| Integrasi WhatsApp, Zendesk, Freshdesk, atau Slack | Membutuhkan API integration, permission, dan testing tambahan. |
| Mobile application | MVP difokuskan pada web application. |
| Integrasi banyak knowledge source | MVP hanya menggunakan Notion sebagai source utama. |
| Real-time synchronization | MVP menggunakan scheduled synchronization sederhana. |
| OCR, image, audio, dan video understanding | MVP berfokus pada issue berbasis teks. |
| Analytics dashboard dan AI Ticket Analyzer | Fitur analitik serta analisis kasus lanjutan dikembangkan setelah chatbot tervalidasi. |

### Minggu 1 — Chat experience

- UI chat, message state, loading, error, dan new conversation.
- Validasi flow dengan mock response.

### Minggu 2 — Knowledge integration

- Integrasi Notion API.
- Sinkronisasi dokumen terpilih.
- Indexing sederhana.
- Source reference.

### Minggu 3 — AI chatbot

- Integrasi Claude API server-side.
- Retrieval knowledge.
- Respons berbasis source.
- Conversation context dan pertanyaan lanjutan.

### Minggu 4 — Stabilization

- Authentication dasar.
- Penyimpanan histori.
- Testing dengan kasus nyata.
- Deployment MVP.

## 15. MVP Success Criteria

- Agent dapat menyampaikan issue melalui bahasa natural.
- Chatbot memberikan jawaban relevan berdasarkan knowledge internal.
- Jawaban menampilkan source reference atau menyatakan jika source tidak ditemukan.
- Chatbot dapat meminta klarifikasi ketika konteks belum cukup.
- Agent dapat melanjutkan percakapan tanpa mengulang seluruh konteks.
- Waktu pencarian solusi lebih rendah dibandingkan baseline manual.
- Agent pilot menggunakan chatbot pada kasus support nyata.
- Histori percakapan tersimpan dan dapat diakses sesuai role.

### Suggested pilot metrics

- Average time to find a solution.
- Percentage of answers with valid source reference.
- Number of active pilot agents.
- Number of real support conversations.
- Agent usefulness rating.
- Chatbot response latency.
- Percentage of questions requiring clarification.

## 16. Risks & Assumptions

### Risks

- Kualitas jawaban bergantung pada kelengkapan dan keakuratan Notion.
- Source stale dapat menghasilkan solusi yang tidak relevan.
- AI atau Notion API dapat mengalami error, downtime, atau rate limit.
- Biaya AI meningkat seiring jumlah chat dan panjang konteks.
- Agent dapat terlalu bergantung pada jawaban chatbot tanpa verifikasi.
- Perubahan scope dapat membuat target satu bulan tidak realistis.

### Mitigations

- Source reference dan metadata last updated.
- Chatbot menyatakan keterbatasan jika source tidak ditemukan.
- Timeout, retry terbatas, dan error state.
- Monitoring penggunaan token.
- Edukasi bahwa chatbot adalah alat bantu, bukan pengganti prosedur resmi.
- Scope dikunci pada satu use case dan satu source.

### Assumptions

- Akses Notion API dan dokumen pilot tersedia.
- Satu use case support diprioritaskan.
- Agent dan Support Lead tersedia untuk pilot.
- Baseline metrik dapat dikumpulkan sebelum pilot.

## 17. AI Integration

**Will AI be used?** ☑ Yes

### AI Capability

CSCoPilot memanfaatkan Claude API untuk memahami issue, mencari konteks dari knowledge internal yang telah disinkronkan dari Notion, dan menjawab pertanyaan lanjutan. AI menggunakan source yang telah diindeks, bukan hanya pengetahuan umum model.

Pada tahap MVP, AI difokuskan untuk mempercepat pencarian informasi dan pemahaman issue. Chatbot berfungsi sebagai alat bantu pencarian dan pemahaman informasi — tidak mengirim pesan kepada client, tidak mengambil keputusan operasional secara otomatis, dan tidak menggantikan SOP atau tanggung jawab Customer Support.

### Business Purpose

Pemanfaatan AI bertujuan mengurangi waktu pencarian solusi, mempercepat pemahaman issue, dan meningkatkan konsistensi informasi berdasarkan dokumentasi perusahaan. MVP ini juga menjadi fondasi pengembangan CSCoPilot secara bertahap pada fase berikutnya.

## 18. Acceptance Criteria MVP

- Agent dapat login dan mengirim issue melalui chatbot.
- Chatbot menjawab berdasarkan knowledge yang tersedia.
- Source reference ditampilkan.
- Chatbot meminta klarifikasi jika konteks tidak cukup.
- Agent dapat melanjutkan percakapan dengan konteks yang sama.
- Histori chat tersimpan.
- API key tidak terekspos di frontend.
- Error AI atau Notion ditampilkan tanpa kehilangan data.
- Kegagalan sinkronisasi tidak menghapus data sebelumnya.
- Tidak ada auto-send kepada client.

## 19. Keputusan yang Dibutuhkan Saat Kickoff

1. Use case support pertama yang diprioritaskan.
2. Dokumen Notion untuk pilot.
3. Agent dan Support Lead peserta pilot.
4. Provider AI dan kebijakan data.
5. Kebijakan penyimpanan histori chat.
6. Baseline metric dan target MVP.
7. Interval sinkronisasi Notion.
8. Kriteria keputusan setelah pilot: scale, revisi, atau stop.

## 20. Product Positioning

> **CSCoPilot adalah chatbot internal yang membantu Customer Support memahami issue dan menemukan solusi berbasis knowledge perusahaan.**

CSCoPilot bukan chatbot customer-facing, bukan sistem auto-reply, bukan Knowledge Hub, bukan AI Response Assistant terpisah, dan bukan pengganti Customer Support. Pada MVP, chatbot menjadi satu-satunya interface; knowledge retrieval, Notion sync, database, dan AI processing bekerja di belakang layar.
