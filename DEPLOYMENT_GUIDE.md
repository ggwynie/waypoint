# 🚀 Panduan Deploy Waypoint ke Vercel + Neon

## Prerequisites
- Akun GitHub
- Akun Vercel ([vercel.com](https://vercel.com))
- Akun Neon ([neon.tech](https://neon.tech))

---

## 📦 Step 1: Setup Database PostgreSQL di Neon

### 1.1 Buat Project di Neon
1. Login ke [neon.tech](https://neon.tech)
2. Klik **"Create Project"**
3. Pilih region terdekat (misalnya: Singapore)
4. Beri nama project: `waypoint-db`

### 1.2 Dapatkan Connection String
1. Di dashboard Neon, klik **"Connection String"**
2. Copy connection string dengan format:
   ```
   postgres://username:password@ep-xxx-xxx.neon.tech/neondb?sslmode=require
   ```
3. **Simpan** connection string ini (akan dipakai nanti)

---

## 🔧 Step 2: Setup Repository GitHub

### 2.1 Push ke GitHub
```bash
cd c:\Users\gwyne\Downloads\waypoint\waypoint
git init
git add .
git commit -m "Initial commit - Waypoint app"
git branch -M main
git remote add origin https://github.com/username/waypoint.git
git push -u origin main
```

**Catatan:** Ganti `username/waypoint` dengan username GitHub Anda

---

## 🌐 Step 3: Deploy ke Vercel

### 3.1 Import Project
1. Login ke [vercel.com](https://vercel.com)
2. Klik **"Add New..."** → **"Project"**
3. Import repository GitHub `waypoint`
4. Klik **"Import"**

### 3.2 Configure Build Settings
Vercel akan otomatis mendeteksi Node.js. Pastikan:
- **Framework Preset**: Other
- **Build Command**: `npm install`
- **Output Directory**: (kosongkan)
- **Install Command**: `npm install`

### 3.3 Set Environment Variables
Klik **"Environment Variables"**, tambahkan:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | Generate random string (minimal 32 karakter) |
| `NODE_ENV` | `production` |

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.4 Deploy
1. Klik **"Deploy"**
2. Tunggu proses build (~2-3 menit)
3. Setelah selesai, klik **"Visit"** untuk melihat aplikasi live

---

## 🗄️ Step 4: Initialize Database

Setelah deploy berhasil, Anda perlu setup schema database:

### 4.1 Setup Database dari Local
1. Update `.env` lokal dengan `DATABASE_URL` dari Neon:
   ```env
   DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
   SESSION_SECRET=your-session-secret
   ```

2. Jalankan init script:
   ```bash
   npm run initdb
   ```

**⚠️ PERINGATAN:** Script `initdb` akan **menghapus** semua tabel dan data yang ada, lalu membuat ulang dengan data contoh. Hanya jalankan sekali saat pertama deploy!

### 4.2 Verifikasi Database
1. Buka aplikasi Vercel Anda
2. Coba login dengan akun demo:
   - **Admin:** `admin@waypoint.test` / `admin123`
   - **Mahasiswa:** `mahasiswa@waypoint.test` / `mahasiswa123`

---

## ✅ Step 5: Custom Domain (Opsional)

### 5.1 Tambah Domain
1. Di Vercel dashboard, klik **"Settings"** → **"Domains"**
2. Tambahkan domain Anda (contoh: `waypoint.yourdomain.com`)
3. Ikuti instruksi untuk update DNS records

---

## 🔄 Update & Redeploy

Setiap kali ada perubahan code:

```bash
git add .
git commit -m "Update: deskripsi perubahan"
git push origin main
```

Vercel akan otomatis **re-deploy** setiap kali ada push ke branch `main`.

---

## 📊 Monitoring

### Vercel Dashboard
- **Deployment logs:** Lihat proses build & error
- **Function logs:** Lihat server logs real-time
- **Analytics:** Traffic & performance metrics

### Neon Dashboard
- **Monitoring:** Database size, connections
- **Query stats:** Performance database
- **Backups:** Automatic backups (free tier: 7 hari)

---

## ⚠️ Troubleshooting

### Error: "Cannot connect to database"
- Pastikan `DATABASE_URL` sudah benar di environment variables Vercel
- Cek apakah `?sslmode=require` ada di akhir connection string
- Verifikasi database Neon masih aktif (free tier auto-suspend setelah 7 hari inaktif)

### Error: "Session not working"
- Pastikan `SESSION_SECRET` sudah diset di environment variables
- Minimal 32 karakter untuk keamanan

### Error: "CORS issues"
Tambahkan di `server.js`:
```javascript
app.set('trust proxy', 1);
```
(Sudah ada di code)

---

## 💰 Biaya

### Free Tier Limits
- **Vercel:** 
  - 100 GB bandwidth/bulan
  - 100 serverless function invocations
  - Unlimited projects
  
- **Neon:**
  - 512 MB storage
  - 0.5 GB data transfer
  - Auto-suspend setelah 5 menit inaktif

Untuk project student/demo, **free tier cukup**!

---

## 📝 Catatan Penting

1. **Free tier Vercel:** Aplikasi tidak sleep (always on)
2. **Free tier Neon:** Database auto-pause setelah inaktif, first request setelah pause ~1-2 detik untuk wake up
3. **Environment variables:** Perubahan environment variables memerlukan **redeploy manual** (klik "Redeploy" di Vercel)
4. **Database migration:** Jika ada perubahan schema, jalankan SQL script manual di Neon SQL Editor

---

## 🎉 Done!

Website Anda sekarang live di:
- `https://waypoint.vercel.app` (default domain)
- `https://your-custom-domain.com` (jika sudah setup)

Selamat! 🚀
