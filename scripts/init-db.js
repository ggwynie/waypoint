// Jalankan: npm run initdb  (membuat tabel + data contoh)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await pool.query(sql);

    const adminHash = await bcrypt.hash('admin123', 10);
    const studentHash = await bcrypt.hash('mahasiswa123', 10);

    await pool.query(
      `INSERT INTO users (name,email,password_hash,role,semester,major,city,interests,skills) VALUES
       ('Admin Waypoint','admin@waypoint.test',$1,'admin',7,'Informatika','Bandung','',''),
       ('Mahasiswa Demo','mahasiswa@waypoint.test',$2,'student',5,'Informatika','Bandung','web,data,startup','javascript,python,sql')`,
      [adminHash, studentHash]
    );

    await pool.query(`INSERT INTO categories (name) VALUES ('Magang'),('Seminar & Call for Paper'),('Kompetisi')`);

    await pool.query(`
      INSERT INTO opportunities (category_id,title,organizer,location,description,deadline,source_url,target_major,min_semester,created_by) VALUES
      (1,'Magang Software Engineer','Startup Teknologi Bandung','Bandung','Magang 6 bulan, stack web (JavaScript, SQL).', CURRENT_DATE + 5,'https://example.com/magang-se','Informatika,Sistem Informasi',5,1),
      (1,'Magang Data Analyst','Perusahaan Retail Nasional','Jakarta','Analisis data penjualan, Python dan SQL.', CURRENT_DATE + 14,'https://example.com/magang-da','Informatika,Statistika',5,1),
      (2,'Seminar Nasional Teknologi Informasi','Universitas Contoh','Online','Seminar dan call for paper bidang data dan web.', CURRENT_DATE + 3,'https://example.com/seminar-ti','',5,1),
      (2,'Call for Paper Konferensi Rekayasa Perangkat Lunak','Asosiasi Perguruan Tinggi','Bandung','Paper tentang software engineering dan web.', CURRENT_DATE + 20,'https://example.com/cfp-rpl','Informatika',6,1),
      (3,'Hackathon Smart Campus','Komunitas Developer','Bandung','Lomba hackathon 24 jam, tim 3 orang, tema startup kampus.', CURRENT_DATE + 7,'https://example.com/hackathon','Informatika,Sistem Informasi',3,1),
      (3,'Lomba Business Plan Nasional','Kementerian Contoh','Surabaya','Kompetisi rencana bisnis tingkat nasional.', CURRENT_DATE + 30,'https://example.com/bizplan','',5,1)
    `);

    console.log('Selesai. Akun demo:');
    console.log('  admin     : admin@waypoint.test / admin123');
    console.log('  mahasiswa : mahasiswa@waypoint.test / mahasiswa123');
  } catch (e) {
    console.error('Gagal init database:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
