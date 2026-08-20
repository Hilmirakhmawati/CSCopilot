# CSCoPilot — Project Document

## 1. Project Information

**Project Title:** CSCoPilot – Internal AI Chatbot for Customer Support  
**Project Type:** ☑ Internal Business Improvement  
**Project Stage:** 1-month MVP  
**Target Platform:** Web application  
**Target Users:** Internal Customer Support team

---

## 2. Project Overview

### What are you building?

CSCoPilot adalah chatbot internal berbasis AI yang membantu Customer Support memahami issue dan menemukan solusi berdasarkan knowledge perusahaan.

Agent cukup menuliskan issue melalui chat. Chatbot memahami konteks, mencari informasi relevan dari Notion, lalu memberikan jawaban dan source reference. CSCoPilot hanya berupa satu chatbot, tanpa modul Knowledge Hub atau AI Response Assistant terpisah.

Notion tetap menjadi **single source of truth**. Dokumen yang disetujui di Notion akan diindeks agar dapat dicari chatbot. Database hanya menyimpan user, histori chat, dan metadata pencarian.

MVP ini ditujukan untuk validasi dengan user dan use case terbatas, bukan production penuh.

---

## 3. Business Problem

### What problem does it solve? Who experiences it? Why is it important?

Customer Support masih mencari SOP, FAQ, troubleshooting guide, dan referensi penyelesaian masalah secara manual dari berbagai sumber. Proses ini memperlambat respons, mengulang investigasi, membuat jawaban kurang konsisten, dan meningkatkan ketergantungan pada pengalaman individual.

Masalah terutama dialami Customer Support Agent, serta berdampak pada Support Lead, Knowledge Owner, dan management.

---

## 4. Solution Overview

### How will it solve the problem?

CSCoPilot menyediakan satu chatbot internal sebagai interface utama. Agent menulis issue, lalu chatbot:

1. Memahami konteks pertanyaan.
2. Meminta klarifikasi jika informasi belum cukup.
3. Mencari knowledge yang relevan dari Notion.
4. Menampilkan kemungkinan penyebab dan langkah penyelesaian.
5. Menyertakan source reference agar jawaban dapat diverifikasi.
6. Melanjutkan percakapan berdasarkan pertanyaan berikutnya.

Tidak ada Knowledge Hub, AI Response Assistant, draft balasan, approval workflow, atau auto-reply sebagai fitur terpisah. Chatbot hanya membantu agent menemukan dan memahami informasi; jawaban tetap digunakan oleh agent sesuai prosedur internal.

```text
Agent menulis issue
  ↓
Chatbot memahami pertanyaan
  ↓
Chatbot mencari knowledge relevan
  ↓
Chatbot memberikan jawaban + source
  ↓
Agent melanjutkan percakapan atau mengambil tindakan
```

---

## 5. Users & Stakeholders

| Users | Stakeholders |
|---|---|
| Customer Support Agent | Management |
| Support Lead | Project Manager |
|  | Product Owner / Internal System Team |
|  | Knowledge Owner / Documentation Owner |
|  | Developer |

### Peran utama

**Customer Support Agent** menggunakan chatbot untuk mencari dan memahami solusi issue.  
**Support Lead** memvalidasi workflow dan kualitas jawaban.  
**Knowledge Owner** menjaga kelengkapan dokumentasi Notion.  
**Product Owner / Internal System Team** menentukan prioritas dan scope.  
**Management** menilai manfaat bisnis dan hasil pilot.

---

## 6. Expected Value

| Category | Expected Benefit |
|---|---|
| **Productivity** | Mengurangi waktu pencarian solusi dan investigasi berulang. |
| **Cost Saving** | Mengurangi waktu onboarding dan koordinasi untuk kasus serupa. |
| **Quality Improvement** | Meningkatkan konsistensi informasi melalui jawaban berbasis source resmi. |
| **Employee Experience** | Agent dapat bertanya dengan bahasa natural tanpa harus mengetahui lokasi dokumen. |
| **Knowledge Management** | Notion tetap menjadi source of truth tanpa menduplikasi dokumentasi utama. |
| **Future Foundation** | Menjadi fondasi untuk pengembangan fitur chatbot berikutnya. |

---

## 7. Scope — 1-Month MVP

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
| Web deployment MVP | Vercel |

### MVP User Flow

```text
Agent login → membuka chatbot → menulis issue
→ chatbot mencari knowledge → chatbot memberikan jawaban + source
→ agent melanjutkan percakapan atau mengambil tindakan sesuai prosedur
```

### Database MVP

Rekomendasi: **PostgreSQL melalui Supabase**.

Database menyimpan:

- User dan role.
- Histori conversation.
- Pesan user dan chatbot.
- Metadata dokumen dan source.
- Data hasil indexing atau knowledge chunks.
- Waktu sinkronisasi dan status error.

Notion tetap menjadi source of truth. Supabase berfungsi sebagai application database dan indexed copy untuk pencarian chatbot.

### Hosting MVP

- **Web application:** Vercel
- **Database:** Supabase PostgreSQL
- **AI:** Claude API melalui server-side request
- **Knowledge source:** Notion API
- **Secrets:** Environment variables atau secret manager

### Out of Scope

| Feature List | Why Out of Scope |
|---|---|
| Knowledge Hub sebagai halaman terpisah | Semua interaksi dilakukan melalui chatbot. |
| AI Response Assistant sebagai modul terpisah | Fungsi chatbot sudah mencakup pemahaman dan jawaban issue. |
| Draft balasan dan approval workflow | Bukan bagian dari konsep chatbot MVP. |
| AI auto-reply atau auto-send | Membutuhkan integrasi dan risiko operasional lebih tinggi. |
| WhatsApp, Zendesk, atau Freshdesk integration | Membutuhkan integrasi dan pengujian tambahan. |
| Public/customer-facing chatbot | MVP hanya untuk internal Customer Support. |
| Mobile application | Fokus pada MVP web. |
| Banyak knowledge source sekaligus | Fokus pada Notion sebagai satu source. |
| AI learning otomatis | Membutuhkan data historis dan governance tambahan. |
| OCR, image, dan video understanding | Membutuhkan pipeline tambahan. |
| Analytics dashboard lanjutan | Diprioritaskan setelah data penggunaan MVP tersedia. |
| AI Ticket Analyzer & Case Intelligence | Dikembangkan setelah chatbot tervalidasi. |

---

## 8. MVP Success Criteria

### How will success be measured?

- Agent dapat menyampaikan issue melalui bahasa natural.
- Chatbot memberikan jawaban relevan berdasarkan knowledge internal.
- Jawaban menampilkan source reference atau menyatakan jika source tidak ditemukan.
- Chatbot dapat meminta klarifikasi ketika konteks belum cukup.
- Agent dapat melanjutkan percakapan tanpa mengulang seluruh konteks.
- Waktu pencarian solusi lebih rendah dibandingkan baseline manual.
- Agent pilot menggunakan chatbot pada kasus support nyata.
- Histori percakapan tersimpan dan dapat diakses sesuai role.

Target angka ditentukan setelah baseline dan peserta pilot disepakati.

### Suggested pilot metrics

- Average time to find a solution.
- Percentage of answers with valid source reference.
- Number of active pilot agents.
- Number of real support conversations.
- Agent usefulness rating.
- Chatbot response latency.
- Percentage of questions requiring clarification.

---

## 9. Risks & Assumptions

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
- Provider AI disetujui stakeholder.
- Baseline metrik dapat dikumpulkan sebelum pilot.

---

## 10. AI Integration

### Will AI be used?

☑ Yes

### AI Capability

Claude API digunakan melalui chatbot untuk memahami issue, mencari konteks dari knowledge internal, menjelaskan kemungkinan solusi, dan menjawab pertanyaan lanjutan.

AI menggunakan source Notion yang telah diindeks, bukan hanya pengetahuan umum model. Chatbot dapat memahami bahasa natural, meminta klarifikasi, menemukan informasi relevan, merangkum troubleshooting step, dan menampilkan source reference.

### Safety Principle

Chatbot berfungsi sebagai alat bantu pencarian dan pemahaman informasi. Chatbot tidak mengirim pesan kepada client, tidak mengambil keputusan operasional secara otomatis, dan tidak menggantikan SOP atau tanggung jawab Customer Support.

### Business Purpose

AI digunakan untuk mengurangi waktu pencarian solusi, mempercepat pemahaman issue, dan meningkatkan konsistensi informasi berdasarkan dokumentasi perusahaan.

---

## 11. One-Month Delivery Plan

### Week 1 — Chat experience

- UI chat, input, message state, loading, error, dan new conversation.
- Validasi flow dengan mock response.

### Week 2 — Knowledge source

- Integrasi Notion API.
- Pemilihan dokumen pilot.
- Scheduled sync dan indexing.
- Source reference pada jawaban.

### Week 3 — AI chatbot

- Integrasi Claude API server-side.
- Retrieval knowledge.
- Respons berbasis source.
- Conversation context dan pertanyaan lanjutan.

### Week 4 — Stabilization and pilot

- Authentication dasar.
- Histori percakapan.
- Testing kasus nyata.
- Security check dan deployment ke Vercel/Supabase.

---

## 12. Acceptance Criteria

MVP siap diuji jika:

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

---

## 13. Key Decisions Required at Kickoff

1. Use case support pertama.
2. Dokumen Notion untuk pilot.
3. Agent dan Support Lead peserta pilot.
4. Provider AI dan kebijakan data.
5. Kebijakan penyimpanan histori chat.
6. Baseline metric dan target MVP.
7. Role dan permission user.
8. Interval sinkronisasi Notion.
9. Kriteria keputusan setelah pilot: scale, revisi, atau stop.

---

## 14. Product Positioning

> **CSCoPilot adalah chatbot internal yang membantu Customer Support memahami issue dan menemukan solusi berbasis knowledge perusahaan.**

CSCoPilot bukan chatbot customer-facing, bukan sistem auto-reply, bukan Knowledge Hub, bukan AI Response Assistant terpisah, dan bukan pengganti Customer Support. Pada MVP, chatbot menjadi satu-satunya interface; knowledge retrieval, Notion sync, database, dan AI processing bekerja di belakang layar.
