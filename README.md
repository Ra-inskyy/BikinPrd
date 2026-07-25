# 🚀 BikinPRD — Platform Generator PRD Berbasis AI

[![Live Website](https://img.shields.io/badge/Live_App-rainsky.web.id-2563eb?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rainsky.web.id)
[![Convex Backend](https://img.shields.io/badge/Backend-Convex_Cloud-FF6B00?style=for-the-badge&logo=convex&logoColor=white)](https://convex.dev)
[![React 19](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

> **BikinPRD** adalah aplikasi SaaS pintar modern yang mentransformasi ide produk mentah dari prompt menjadi dokumen **Product Requirement Document (PRD)** yang komprehensif, terstruktur, profesional, dan siap dieksekusi oleh tim engineering & product manager dalam hitungan detik.

---

## 🌐 Preview & Web Resmi

Aplikasi telah aktif dan terdeploy di domain kustom resmi:

👉 **[https://rainsky.web.id](https://rainsky.web.id)**

*(Deployment Fallback: [bikinprd.onrender.com](https://bikinprd.onrender.com))*

---

## 🌟 Fitur Utama (Key Features)

- 🤖 **AI-Powered PRD Generation**: Mentransformasi ide produk biasa menjadi dokumen PRD standar industri dengan AI cerdas (User Stories, System Architecture, Database Schema, Tech Stack, & Milestones).
- 🔑 **Fleksibel Authentication (Dual Sign-In)**:
  - **Login via Username atau Email**: Pengguna bebas memilih login menggunakan username maupun alamat email yang terdaftar.
  - **Verifikasi 6-Digit OTP Resend**: Sistem pengiriman kode OTP verifikasi email instan berbasis Resend API dengan auto-fallback.
  - **Google One-Click Sign-In**: Akses masuk instan tanpa repot mengetik password.
  - **Peringatan Duplikat Real-time**: Peringatan statis instan di bawah kolom input jika Username atau Email sudah pernah terdaftar.
- 💳 **Sistem Kredit & Top-Up Terintegrasi**:
  - Pilihan paket kredit fleksibel (**Pemula**, **Pro**, dan **Sultan**).
  - Simulasi pembayaran instan dengan kalkulasi bonus kredit otomatis.
- 📁 **Manajemen Proyek & Riwayat PRD**: Simpan, edit, salin format Markdown, dan kelola semua dokumen PRD kamu langsung di Dashboard real-time.
- 🔒 **Keamanan & Sandboxing**: Autentikasi aman berbasis JWT PKCS#8 & Convex Auth yang siap untuk skala produksi.

---

## 🛠️ Tech Stack & Arsitektur

| Layer | Teknologi yang Digunakan |
| :--- | :--- |
| **Frontend Framework** | React 19 + Vite (Lightning-fast client build) |
| **Styling & UI** | Tailwind CSS v4 + shadcn/ui + Lucide Icons |
| **Real-time Backend** | Convex Cloud Database & Serverless Functions |
| **Autentikasi** | Convex Auth (`@convex-dev/auth`), Resend Email OTP, & Google OAuth |
| **AI Integration** | Custom AI Engine (OpenAI Compatible - OpenRouter / Groq / OpenAI) |
| **Deployment** | Render.com SPA + Domain Provider IDwebhost (`rainsky.web.id`) |

---

## 🚀 Panduan Menjalankan Secara Lokal (Local Development)

### 1. Clone & Install Dependensi
```bash
git clone https://github.com/Ra-inskyy/BikinPrd.git
cd bikin-prd-custom-api
npm install
```

### 2. Konfigurasi Environment Variables
Buat file `.env.local` di root proyek:
```env
VITE_CONVEX_URL=https://accomplished-guanaco-713.convex.cloud
```

### 3. Jalankan Dev Server
```bash
# Jalankan Convex Dev Server
npx convex dev

# Di terminal terpisah, jalankan Vite Frontend
npm run dev
```

Buka `http://localhost:5173` di browser kamu!

---

## 👨‍💻 Kontribusi & Lisensi

Proyek ini dibangun oleh **Anggara Gustiana** untuk mempermudah developer, startup founder, dan Product Manager dalam menyusun kebutuhan produk secara instan dan profesional.

© 2026 **BikinPRD** — Built with ❤️ for Builders.
