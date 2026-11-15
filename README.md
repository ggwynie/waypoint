# Waypoint — Personalized Opportunity Assistant (studi kasus CRUD)

Node.js + Express + EJS + PostgreSQL. Ranking feed pakai skor transparan (tanpa AI).

## Pemenuhan ketentuan tugas
| Ketentuan | Implementasi |
|---|---|
| Basis data | PostgreSQL (`schema.sql`) |
| Login/Register/Dashboard | `/login`, `/register`, `/dashboard` (beda tampilan admin vs mahasiswa) |
| File Master | `categories` (admin CRUD), `opportunities` (admin CRUD) |
| File Transaksi | `saved_items` (simpan / tandai daftar / tidak relevan / ubah / hapus) |
| Report | `/report` + filter + unduh CSV |
| Hosting gratis | Neon (database) + Render (web) |

## Jalankan lokal
1. `npm install`
2. Salin `.env.example` → `.env`, isi `DATABASE_URL` dan `SESSION_SECRET`
3. `npm run initdb` (buat tabel + data contoh)
4. `npm start` → http://localhost:3000

Akun demo: `admin@waypoint.test / admin123` · `mahasiswa@waypoint.test / mahasiswa123`

## Deploy gratis

Lihat **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** untuk panduan lengkap deploy ke **Vercel + Neon**.

**Quick summary:**
- **Database:** Neon.tech (PostgreSQL serverless, free tier 512 MB)
- **Web:** Vercel (Node.js hosting, always-on, free tier)
- **Setup:** ~10 menit, tidak perlu credit card

**Alternatif lain:**
- **Render** (web + database) - free tier sleep saat idle
- **Railway** - $5 credit gratis per bulan
- **Supabase** - jika butuh auth & storage tambahan
