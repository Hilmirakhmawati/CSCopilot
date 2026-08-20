## **1\. Project Information**

**Project Title** 	: **CSCoPilot – AI Decision Support System for Customer Support**

**Project Type (Pick 1 ☑ )**  
☑ Internal Business Improvement  
☐ New Business / Product Innovation

## **2\. Project Overview** 

What are you building?

| *CS CoPilot merupakan modul Artificial Intelligence (AI) yang akan diintegrasikan ke dalam Internal System Timedoor untuk membantu Customer Support bekerja lebih cepat, konsisten, dan efisien dalam menangani tiket. Pada tahap Minimum Viable Product (MVP), pengembangan difokuskan pada dua fitur utama, yaitu Knowledge Hub dan AI Response Assistant. Knowledge Hub menyediakan akses cepat terhadap SOP, FAQ, troubleshooting guide, dan template balasan yang dibutuhkan Customer Support. AI Response Assistant memanfaatkan informasi tersebut untuk membantu menghasilkan draft balasan yang sesuai dengan standar perusahaan. Notion tetap menjadi single source of truth sebagai pusat dokumentasi perusahaan. CS CoPilot tidak menyimpan ataupun menduplikasi seluruh dokumen, melainkan memanfaatkan informasi yang telah disinkronkan dari Notion sehingga dokumentasi tetap terpusat dan konsisten.* |
| :---- |

## **3\. Business Problem** 

What problem does it solve? Who experiences it? Why is it important?

| *Saat ini Customer Support masih mengandalkan proses manual ketika menangani tiket dari client. Customer Support perlu membuka berbagai sumber dokumentasi untuk mencari SOP, troubleshooting guide, template balasan, maupun referensi penyelesaian masalah sebelum dapat memberikan respon kepada client. Karena informasi tersebar di beberapa tempat, proses pencarian membutuhkan waktu lebih lama dan sering bergantung pada pengalaman masing-masing anggota tim. Kondisi ini menyebabkan proses penanganan tiket menjadi kurang efisien, jawaban kepada client berpotensi tidak konsisten, meningkatkan risiko human error, serta memperlambat proses onboarding Customer Support baru.* |
| :---- |

## **4\. Solution Overview**

How will it solve the problem? 

| *Pada tahap MVP, CS CoPilot menyediakan dua fitur utama yang saling terintegrasi. Knowledge Hub menjadi pusat akses informasi bagi Customer Support untuk menemukan SOP, FAQ, troubleshooting guide, dan template balasan secara lebih cepat. Seluruh informasi berasal dari dokumentasi perusahaan yang telah disinkronkan dari Notion sehingga tidak terjadi duplikasi data. AI Response Assistant memanfaatkan informasi dari Knowledge Hub untuk membantu menghasilkan draft balasan kepada client sesuai konteks pertanyaan dan standar komunikasi perusahaan. Draft yang dihasilkan tetap akan ditinjau oleh Customer Support sebelum dikirim kepada client sehingga AI berfungsi sebagai Decision Support System, bukan sebagai pengambil keputusan.* |
| :---- |

## **5\. Users & Stakeholders** 

| Users | Stakeholder |
| ----- | ----- |
| Customer Support  | Management  |
| Project Manager  | Product Owner / Internal System Team  |
| Developer  |  |

## **6\. Expected Value** 

| Category | Expected Benefit |
| ----- | ----- |
|  Productivity | Mengurangi waktu pencarian SOP dan dokumentasi. Mempercepat penyusunan balasan kepada client. Mengurangi pekerjaan manual yang berulang.  |
|  Cost Saving | Mengurangi waktu onboarding Customer Support baru. Mengurangi waktu koordinasi antar tim. Mengurangi waktu investigasi untuk kasus yang serupa. |
|  Quality Improvement | Meningkatkan konsistensi jawaban kepada client. Standarisasi penggunaan SOP dan template balasan. Mengurangi human error dalam penyampaian informasi.  |
|  Employee Experience | Mempermudah Customer Support memperoleh informasi yang dibutuhkan. Mempercepat proses pembelajaran anggota tim baru. Mengurangi ketergantungan pada pengalaman individu. |
|  Other (Add as much as possible) | Dokumentasi tetap terpusat di Notion sebagai **single source of truth**. Mempermudah pemanfaatan knowledge perusahaan tanpa duplikasi data. Menjadi fondasi pengembangan CS CoPilot pada tahap berikutnya. |

## 

## **7\. Scope (1-Month MVP)**

Included Features:

| Feature List | Platform / Tech Stack |
| ----- | ----- |
| Dashboard Customer Support  | Web / Nextjs |
| Knowledge Hub *(SOP, FAQ, troubleshooting, template balasan)* | Next.js \+ PostgreSQL / Supabase |
| AI Response Assistant *(Draft balasan berbasis Knowledge Hub)* | Claude API |
| Authentication   | NextAuth |
| Database   | PostgreSQL/Supabase |

Out of Scope:

| Feature List | Why Out of Scope |
| :---- | :---- |
| WhatsApp API Integration | Membutuhkan integrasi eksternal dan pengujian tambahan. |
| Mobile Application | Fokus pada MVP berbasis web. |
| AI Auto Reply ke Client | Tetap memerlukan validasi Customer Support. |
| AI Learning Otomatis | Membutuhkan data historis yang lebih banyak dan waktu pengembangan lebih panjang. |
| Analytics Dashboard | Diprioritaskan pada fase pengembangan berikutnya agar MVP dapat selesai dalam satu bulan. |
| AI Ticket Analyzer & Case Intelligence  | Akan dikembangkan setelah MVP selesai.  |

## 

## **8\. MVP Success Criteria** 

How will success be measured?

| *Keberhasilan MVP diukur berdasarkan dua indikator utama: Efisiensi Pencarian Informasi: Customer Support dapat menemukan SOP, FAQ, troubleshooting guide, atau template balasan yang relevan dalam satu platform kurang lebih 3 menit, sehingga lebih cepat dibandingkan proses manual saat ini. Kualitas Draft Balasan: AI Response Assistant mampu menghasilkan draft balasan berdasarkan informasi dari Knowledge Hub yang sesuai konteks dan standar perusahaan, sehingga dapat digunakan Customer Support dengan penyesuaian minimal sebelum dikirim ke client. Seluruh rekomendasi AI tetap melalui proses validasi Customer Support. AI berfungsi sebagai Decision Support System, yaitu membantu, bukan menggantikan pengambilan keputusan.* |
| :---- |

**9\. Risks & Assumptions**

1. Kualitas rekomendasi AI bergantung pada kelengkapan dokumentasi di Notion.  
2. Sinkronisasi data dari Notion harus berjalan dengan baik agar informasi tetap terbaru.  
3. Seluruh rekomendasi AI tetap memerlukan validasi Customer Support.  
4. Integrasi AI membutuhkan koneksi internet yang stabil.  
5. Prompt AI perlu dievaluasi secara berkala agar hasil tetap relevan.

## 

## **10\. AI Integration (Optional)**

Will AI be used?  
☑ Yes

AI Capability

| *CS CoPilot memanfaatkan Generative AI (Claude API) untuk membantu Customer Support menghasilkan draft balasan berdasarkan informasi yang tersedia pada Knowledge Hub. AI menggunakan SOP, FAQ, troubleshooting guide, dan template balasan yang telah disinkronkan dari Notion sebagai referensi sebelum menghasilkan rekomendasi. Pada tahap MVP, AI difokuskan untuk mempercepat pencarian informasi dan penyusunan balasan kepada client. Seluruh hasil yang diberikan AI tetap ditinjau oleh Customer Support sebelum digunakan sehingga AI berperan sebagai Decision Support System yang membantu proses kerja, bukan menggantikan pengambilan keputusan.* |
| :---- |

Business Purpose: 

| *Pemanfaatan AI bertujuan meningkatkan produktivitas Customer Support dengan mengurangi waktu pencarian informasi, mempercepat penyusunan balasan kepada client, serta meningkatkan konsistensi layanan berdasarkan dokumentasi perusahaan. Selain memberikan manfaat langsung bagi operasional Customer Support, MVP ini juga menjadi fondasi pengembangan CS CoPilot secara bertahap melalui penambahan fitur AI pada fase berikutnya.*  |
| :---- |

