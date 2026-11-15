require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 3600 * 1000, secure: 'auto' },
  })
);

// ---------- helpers ----------
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const needLogin = (req, res, next) => (req.session.user ? next() : res.redirect('/login'));
const needAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  flash(req, 'error', 'Halaman itu hanya untuk admin.');
  res.redirect('/dashboard');
};

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currentPath = req.path;
  res.locals.fmt = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  next();
});

// ---------- AUTH ----------
app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.get('/register', (req, res) => res.render('register', { title: 'Daftar', form: {} }));
app.post('/register', wrap(async (req, res) => {
  const { name, email, password, semester, major, city, interests, skills } = req.body;
  if (!name || !email || !password || password.length < 6) {
    res.locals.flash = { type: 'error', msg: 'Nama, email, dan password (min. 6 karakter) wajib diisi.' };
    return res.render('register', { title: 'Daftar', form: req.body });
  }
  const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.rowCount) {
    res.locals.flash = { type: 'error', msg: 'Email sudah terdaftar.' };
    return res.render('register', { title: 'Daftar', form: req.body });
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name,email,password_hash,semester,major,city,interests,skills)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [name.trim(), email.toLowerCase().trim(), hash, parseInt(semester) || 5, major || '', city || '', interests || '', skills || '']
  );
  flash(req, 'success', 'Registrasi berhasil, silakan login.');
  res.redirect('/login');
}));

app.get('/login', (req, res) => res.render('login', { title: 'Login' }));
app.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase().trim()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) {
    res.locals.flash = { type: 'error', msg: 'Email atau password salah.' };
    return res.render('login', { title: 'Login' });
  }
  req.session.user = { id: u.id, name: u.name, role: u.role };
  res.redirect('/dashboard');
}));

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

// ---------- PROFIL ----------
app.get('/profile', needLogin, wrap(async (req, res) => {
  const r = await pool.query('SELECT * FROM users WHERE id=$1', [req.session.user.id]);
  res.render('profile', { title: 'Profil', p: r.rows[0] });
}));
app.post('/profile', needLogin, wrap(async (req, res) => {
  const { name, semester, major, city, interests, skills } = req.body;
  await pool.query(
    'UPDATE users SET name=$1,semester=$2,major=$3,city=$4,interests=$5,skills=$6 WHERE id=$7',
    [name, parseInt(semester) || 5, major || '', city || '', interests || '', skills || '', req.session.user.id]
  );
  req.session.user.name = name;
  flash(req, 'success', 'Profil diperbarui. Feed akan menyesuaikan.');
  res.redirect('/profile');
}));

// ---------- DASHBOARD ----------
app.get('/dashboard', needLogin, wrap(async (req, res) => {
  const u = req.session.user;
  let data = {};
  if (u.role === 'admin') {
    const [a, b, c, d] = await Promise.all([
      pool.query('SELECT COUNT(*)::int n FROM users WHERE role=\'student\''),
      pool.query('SELECT COUNT(*)::int n FROM opportunities WHERE deadline >= CURRENT_DATE'),
      pool.query('SELECT COUNT(*)::int n FROM saved_items WHERE status<>\'dismissed\''),
      pool.query(
        `SELECT c.name, COUNT(o.id)::int n FROM categories c
         LEFT JOIN opportunities o ON o.category_id=c.id GROUP BY c.name ORDER BY c.name`
      ),
    ]);
    data = { students: a.rows[0].n, open: b.rows[0].n, saved: c.rows[0].n, byCat: d.rows };
  } else {
    const [s, rem, cnt] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int n FROM saved_items WHERE user_id=$1 AND status<>'dismissed' GROUP BY status`,
        [u.id]
      ),
      pool.query(
        `SELECT o.title, o.deadline, (o.deadline-CURRENT_DATE) days_left, c.name category
         FROM saved_items s JOIN opportunities o ON o.id=s.opportunity_id
         JOIN categories c ON c.id=o.category_id
         WHERE s.user_id=$1 AND s.status='saved'
           AND o.deadline >= CURRENT_DATE AND (o.deadline-CURRENT_DATE) <= s.remind_days_before
         ORDER BY o.deadline`,
        [u.id]
      ),
      pool.query('SELECT COUNT(*)::int n FROM opportunities WHERE deadline >= CURRENT_DATE'),
    ]);
    const m = Object.fromEntries(s.rows.map((r) => [r.status, r.n]));
    data = { saved: m.saved || 0, applied: m.applied || 0, reminders: rem.rows, open: cnt.rows[0].n };
  }
  res.render('dashboard', { title: 'Dashboard', d: data });
}));

// ---------- MASTER 1: KATEGORI (admin) ----------
app.get('/categories', needLogin, needAdmin, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT c.*, COUNT(o.id)::int total FROM categories c
     LEFT JOIN opportunities o ON o.category_id=c.id GROUP BY c.id ORDER BY c.name`
  );
  res.render('categories', { title: 'Master Kategori', rows: r.rows });
}));
app.post('/categories', needLogin, needAdmin, wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) flash(req, 'error', 'Nama kategori wajib diisi.');
  else {
    try { await pool.query('INSERT INTO categories(name) VALUES($1)', [name]); flash(req, 'success', 'Kategori ditambahkan.'); }
    catch { flash(req, 'error', 'Kategori sudah ada.'); }
  }
  res.redirect('/categories');
}));
app.post('/categories/:id/update', needLogin, needAdmin, wrap(async (req, res) => {
  try { await pool.query('UPDATE categories SET name=$1 WHERE id=$2', [req.body.name.trim(), req.params.id]); flash(req, 'success', 'Kategori diubah.'); }
  catch { flash(req, 'error', 'Gagal mengubah (nama mungkin sudah dipakai).'); }
  res.redirect('/categories');
}));
app.post('/categories/:id/delete', needLogin, needAdmin, wrap(async (req, res) => {
  try { await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]); flash(req, 'success', 'Kategori dihapus.'); }
  catch { flash(req, 'error', 'Kategori tidak bisa dihapus karena masih dipakai peluang.'); }
  res.redirect('/categories');
}));

// ---------- MASTER 2: PELUANG ----------
app.get('/opportunities', needLogin, wrap(async (req, res) => {
  const { q = '', cat = '' } = req.query;
  const r = await pool.query(
    `SELECT o.*, c.name category_name, (o.deadline-CURRENT_DATE) days_left
     FROM opportunities o JOIN categories c ON c.id=o.category_id
     WHERE ($1='' OR o.title ILIKE '%'||$1||'%' OR o.organizer ILIKE '%'||$1||'%')
       AND ($2='' OR o.category_id=$2::int)
     ORDER BY o.deadline`,
    [q, cat]
  );
  const cats = await pool.query('SELECT * FROM categories ORDER BY name');
  res.render('opportunities', { title: 'Master Peluang', rows: r.rows, cats: cats.rows, q, cat });
}));

const loadCats = () => pool.query('SELECT * FROM categories ORDER BY name').then((r) => r.rows);

app.get('/opportunities/new', needLogin, needAdmin, wrap(async (req, res) => {
  res.render('opportunity_form', { title: 'Tambah Peluang', o: { min_semester: 5, location: 'Online' }, cats: await loadCats(), action: '/opportunities' });
}));
app.post('/opportunities', needLogin, needAdmin, wrap(async (req, res) => {
  const b = req.body;
  await pool.query(
    `INSERT INTO opportunities (category_id,title,organizer,location,description,deadline,source_url,target_major,min_semester,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [b.category_id, b.title, b.organizer, b.location || 'Online', b.description || '', b.deadline, b.source_url, b.target_major || '', parseInt(b.min_semester) || 5, req.session.user.id]
  );
  flash(req, 'success', 'Peluang ditambahkan.');
  res.redirect('/opportunities');
}));
app.get('/opportunities/:id/edit', needLogin, needAdmin, wrap(async (req, res) => {
  const r = await pool.query(`SELECT *, to_char(deadline,'YYYY-MM-DD') deadline_str FROM opportunities WHERE id=$1`, [req.params.id]);
  if (!r.rowCount) return res.redirect('/opportunities');
  res.render('opportunity_form', { title: 'Ubah Peluang', o: r.rows[0], cats: await loadCats(), action: `/opportunities/${req.params.id}` });
}));
app.post('/opportunities/:id', needLogin, needAdmin, wrap(async (req, res) => {
  const b = req.body;
  await pool.query(
    `UPDATE opportunities SET category_id=$1,title=$2,organizer=$3,location=$4,description=$5,
       deadline=$6,source_url=$7,target_major=$8,min_semester=$9 WHERE id=$10`,
    [b.category_id, b.title, b.organizer, b.location || 'Online', b.description || '', b.deadline, b.source_url, b.target_major || '', parseInt(b.min_semester) || 5, req.params.id]
  );
  flash(req, 'success', 'Peluang diperbarui.');
  res.redirect('/opportunities');
}));
app.post('/opportunities/:id/delete', needLogin, needAdmin, wrap(async (req, res) => {
  await pool.query('DELETE FROM opportunities WHERE id=$1', [req.params.id]);
  flash(req, 'success', 'Peluang dihapus.');
  res.redirect('/opportunities');
}));

// ---------- FEED (ranking transparan, tanpa AI) ----------
function scoreOpportunity(o, u, dismissedByCat) {
  let s = 0;
  const why = [];
  const norm = (x) => (x || '').toLowerCase();
  const majors = norm(o.target_major).split(',').map((m) => m.trim()).filter(Boolean);

  if (!majors.length) { s += 1; why.push('Terbuka untuk semua jurusan (+1)'); }
  else if (majors.some((m) => norm(u.major).includes(m) || m.includes(norm(u.major)) && norm(u.major))) { s += 3; why.push('Sesuai jurusan (+3)'); }

  if (u.semester >= o.min_semester) { s += 2; why.push('Semester memenuhi (+2)'); }
  else { s -= 2; why.push('Semester belum memenuhi (-2)'); }

  const hay = norm(`${o.title} ${o.description} ${o.category_name}`);
  const tokens = norm(`${u.interests},${u.skills}`).split(',').map((t) => t.trim()).filter(Boolean);
  const hits = tokens.filter((t) => hay.includes(t)).slice(0, 3);
  if (hits.length) { s += hits.length; why.push(`Cocok minat/skill: ${hits.join(', ')} (+${hits.length})`); }

  if (norm(o.location) === 'online') { s += 1; why.push('Online (+1)'); }
  else if (u.city && norm(o.location) === norm(u.city)) { s += 2; why.push('Satu kota (+2)'); }

  if (o.days_left <= 7) { s += 1; why.push('Deadline dekat (+1)'); }

  const pen = Math.min(dismissedByCat[o.category_id] || 0, 3);
  if (pen) { s -= pen; why.push(`Kategori sering ditandai tidak relevan (-${pen})`); }

  return { score: s, why };
}

app.get('/feed', needLogin, wrap(async (req, res) => {
  const uid = req.session.user.id;
  const [ur, rows, dis] = await Promise.all([
    pool.query('SELECT * FROM users WHERE id=$1', [uid]),
    pool.query(
      `SELECT o.*, c.name category_name, (o.deadline-CURRENT_DATE) days_left, s.status saved_status
       FROM opportunities o JOIN categories c ON c.id=o.category_id
       LEFT JOIN saved_items s ON s.opportunity_id=o.id AND s.user_id=$1
       WHERE o.deadline >= CURRENT_DATE AND (s.status IS NULL OR s.status <> 'dismissed')`,
      [uid]
    ),
    pool.query(
      `SELECT o.category_id, COUNT(*)::int n FROM saved_items s JOIN opportunities o ON o.id=s.opportunity_id
       WHERE s.user_id=$1 AND s.status='dismissed' GROUP BY o.category_id`,
      [uid]
    ),
  ]);
  const dismissedByCat = Object.fromEntries(dis.rows.map((r) => [r.category_id, r.n]));
  const items = rows.rows
    .map((o) => ({ ...o, ...scoreOpportunity(o, ur.rows[0], dismissedByCat) }))
    .sort((a, b) => b.score - a.score || a.days_left - b.days_left);
  res.render('feed', { title: 'Feed Untukmu', items });
}));

// ---------- TRANSAKSI: SAVED ITEMS ----------
app.post('/saved', needLogin, wrap(async (req, res) => {
  const { opportunity_id, status } = req.body;
  const st = ['saved', 'dismissed'].includes(status) ? status : 'saved';
  await pool.query(
    `INSERT INTO saved_items (user_id, opportunity_id, status) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, opportunity_id) DO UPDATE SET status=EXCLUDED.status`,
    [req.session.user.id, opportunity_id, st]
  );
  flash(req, 'success', st === 'saved' ? 'Disimpan. Pengingat deadline aktif.' : 'Ditandai tidak relevan, ranking akan menyesuaikan.');
  res.redirect('/feed');
}));

app.get('/saved', needLogin, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT s.*, o.title, o.organizer, o.deadline, o.source_url, c.name category_name,
            (o.deadline-CURRENT_DATE) days_left
     FROM saved_items s JOIN opportunities o ON o.id=s.opportunity_id
     JOIN categories c ON c.id=o.category_id
     WHERE s.user_id=$1 AND s.status<>'dismissed' ORDER BY o.deadline`,
    [req.session.user.id]
  );
  res.render('saved', { title: 'Peluang Tersimpan', rows: r.rows });
}));
app.post('/saved/:id/update', needLogin, wrap(async (req, res) => {
  const { status, remind_days_before, note } = req.body;
  await pool.query(
    `UPDATE saved_items SET status=$1, remind_days_before=$2, note=$3 WHERE id=$4 AND user_id=$5`,
    [['saved', 'applied'].includes(status) ? status : 'saved', Math.max(0, parseInt(remind_days_before) || 3), note || '', req.params.id, req.session.user.id]
  );
  flash(req, 'success', 'Data diperbarui.');
  res.redirect('/saved');
}));
app.post('/saved/:id/delete', needLogin, wrap(async (req, res) => {
  await pool.query('DELETE FROM saved_items WHERE id=$1 AND user_id=$2', [req.params.id, req.session.user.id]);
  flash(req, 'success', 'Dihapus dari daftar tersimpan.');
  res.redirect('/saved');
}));

// ---------- REPORT ----------
async function reportRows(req) {
  const u = req.session.user;
  const { cat = '', status = '' } = req.query;
  const r = await pool.query(
    `SELECT s.id, u.name student, o.title, c.name category, o.organizer, o.deadline,
            (o.deadline-CURRENT_DATE) days_left, s.status, s.remind_days_before
     FROM saved_items s JOIN users u ON u.id=s.user_id
     JOIN opportunities o ON o.id=s.opportunity_id JOIN categories c ON c.id=o.category_id
     WHERE s.status<>'dismissed'
       AND ($1::int IS NULL OR s.user_id=$1)
       AND ($2='' OR o.category_id=$2::int)
       AND ($3='' OR s.status=$3)
     ORDER BY o.deadline`,
    [u.role === 'admin' ? null : u.id, cat, status]
  );
  return r.rows;
}

app.get('/report', needLogin, wrap(async (req, res) => {
  const rows = await reportRows(req);
  const cats = await loadCats();
  const summary = {};
  rows.forEach((r) => { summary[r.category] = (summary[r.category] || 0) + 1; });
  const missed = rows.filter((r) => r.days_left < 0 && r.status === 'saved').length;
  res.render('report', { title: 'Laporan', rows, cats, summary, missed, cat: req.query.cat || '', status: req.query.status || '' });
}));

app.get('/report/csv', needLogin, wrap(async (req, res) => {
  const rows = await reportRows(req);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Mahasiswa', 'Peluang', 'Kategori', 'Penyelenggara', 'Deadline', 'Sisa Hari', 'Status'].join(',')];
  rows.forEach((r) =>
    lines.push([r.student, r.title, r.category, r.organizer, new Date(r.deadline).toISOString().slice(0, 10), r.days_left, r.status].map(esc).join(','))
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="laporan-waypoint.csv"');
  res.send(lines.join('\n'));
}));

// ---------- error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Terjadi kesalahan server. Cek log.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Waypoint berjalan di http://localhost:${port}`));
