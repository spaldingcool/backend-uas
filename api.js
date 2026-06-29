import express from 'express';
import mysql   from 'mysql2/promise';
import crypto  from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const sha256 = str => crypto.createHash('sha256').update(str).digest('hex');

// Simple JWT-like token: base64(payload).base64(signature)
const SECRET = process.env.JWT_SECRET || 'smart_economy_secret_2025';

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); }
  catch { return null; }
}

const send  = (res, ok, data = null, msg = '', code = 200) =>
  res.status(code).json({ sukses: ok, pesan: msg, data });

const input = req => ({ ...req.query, ...req.body });

const wrap  = fn => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// DATABASE (Model layer — connection pool)
// ══════════════════════════════════════════════════════════════════════════════

const pool = mysql.createPool({
  host    : process.env.DB_HOST || 'localhost',
  port    : Number(process.env.DB_PORT) || 3307,
  database: process.env.DB_NAME || 'smart_economy',
  user    : process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  charset : 'utf8mb4',
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. Request logger middleware
function loggerMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
}

// ── 2. CORS middleware
function corsMiddleware(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

// ── 3. Authentication middleware (JWT)
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user   = verifyToken(token);
  if (!user) return send(res, false, null, 'Token tidak valid atau tidak ada. Silakan login.', 401);
  req.user = user;
  next();
}

// ── 4. Role-based authorization middleware factory
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.peran))
      return send(res, false, null, `Akses ditolak. Hanya untuk: ${roles.join(', ')}.`, 403);
    next();
  };
}

// ── 5. Input validation middleware factory
function validate(fields) {
  return (req, res, next) => {
    const p = input(req);
    const missing = fields.filter(f => !p[f]);
    if (missing.length)
      return send(res, false, null, `Field wajib: ${missing.join(', ')}.`, 422);
    next();
  };
}

// ── 6. Rate limiter middleware (simple in-memory)
const rateLimitStore = new Map();
function rateLimiter(maxReq = 100, windowMs = 60_000) {
  return (req, res, next) => {
    const key  = req.ip;
    const now  = Date.now();
    const data = rateLimitStore.get(key) ?? { count: 0, start: now };
    if (now - data.start > windowMs) { data.count = 0; data.start = now; }
    data.count++;
    rateLimitStore.set(key, data);
    if (data.count > maxReq)
      return send(res, false, null, 'Terlalu banyak permintaan. Coba lagi nanti.', 429);
    next();
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MODELS (database query layer)
// ══════════════════════════════════════════════════════════════════════════════

const UserModel = {
  findByEmail: (email) =>
    pool.execute('SELECT * FROM users WHERE email = ?', [email]),
  findById: (id) =>
    pool.execute('SELECT id, nama, email, peran, dibuat_pada FROM users WHERE id = ?', [id]),
  create: (nama, email, password, peran) =>
    pool.execute('INSERT INTO users (nama, email, password, peran) VALUES (?, ?, ?, ?)',
      [nama, email, password, peran]),
  list: () =>
    pool.execute('SELECT id, nama, email, peran, dibuat_pada FROM users ORDER BY id DESC'),
};

const UsahaModel = {
  list: (where, params) =>
    pool.execute(
      `SELECT u.id, u.nama_usaha, u.kota, u.omzet_bulan, u.status, u.user_id, k.nama AS kategori
       FROM usaha u JOIN kategori_usaha k ON k.id = u.kategori_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY u.dibuat_pada DESC LIMIT 100`, params),
  findById: (id) =>
    pool.execute(
      `SELECT u.*, k.nama AS kategori FROM usaha u
       JOIN kategori_usaha k ON k.id = u.kategori_id WHERE u.id = ?`, [id]),
  create: (user_id, kategori_id, nama_usaha, deskripsi, kota, omzet_bulan) =>
    pool.execute(
      'INSERT INTO usaha (user_id, kategori_id, nama_usaha, deskripsi, kota, omzet_bulan) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, kategori_id, nama_usaha, deskripsi, kota, omzet_bulan]),
  updateStatus: (id, status) =>
    pool.execute('UPDATE usaha SET status = ? WHERE id = ?', [status, id]),
};

const ProdukModel = {
  list: (where, params) =>
    pool.execute(
      `SELECT p.*, u.nama_usaha FROM produk p JOIN usaha u ON u.id = p.usaha_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY p.dibuat_pada DESC LIMIT 200`, params),
  create: (usaha_id, nama_produk, harga, stok, satuan) =>
    pool.execute(
      'INSERT INTO produk (usaha_id, nama_produk, harga, stok, satuan) VALUES (?, ?, ?, ?, ?)',
      [usaha_id, nama_produk, harga, stok, satuan]),
  update: (fields, params) =>
    pool.execute(`UPDATE produk SET ${fields.join(', ')} WHERE id = ?`, params),
  delete: (id) =>
    pool.execute('DELETE FROM produk WHERE id = ?', [id]),
  findById: (id) =>
    pool.execute('SELECT harga, stok, usaha_id FROM produk WHERE id = ?', [id]),
};

const TransaksiModel = {
  list: (where, params) =>
    pool.execute(
      `SELECT t.id, t.jumlah, t.total_harga, t.metode_bayar, t.status,
              t.dibuat_pada, p.nama_produk, u.nama AS nama_pembeli, u2.nama_usaha
       FROM transaksi t
       JOIN produk p  ON p.id  = t.produk_id
       JOIN users  u  ON u.id  = t.pembeli_id
       JOIN usaha  u2 ON u2.id = p.usaha_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY t.dibuat_pada DESC LIMIT 200`, params),
  create: (conn, produk_id, pembeli_id, jumlah, total, metode) =>
    conn.execute(
      'INSERT INTO transaksi (produk_id, pembeli_id, jumlah, total_harga, metode_bayar) VALUES (?, ?, ?, ?, ?)',
      [produk_id, pembeli_id, jumlah, total, metode]),
  updateStatus: (id, status) =>
    pool.execute('UPDATE transaksi SET status = ? WHERE id = ?', [status, id]),
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLERS (business logic layer)
// ══════════════════════════════════════════════════════════════════════════════

const PenggunaController = {
  daftar: wrap(async (req, res) => {
    const p = input(req);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
      return send(res, false, null, 'Format email tidak valid.', 422);
    const email = p.email.toLowerCase().trim();
    const [cek] = await UserModel.findByEmail(email);
    if (cek.length) return send(res, false, null, 'Email sudah terdaftar.', 409);
    const [r] = await UserModel.create(p.nama.trim(), email, sha256(p.password), p.peran ?? 'konsumen');
    send(res, true, { id: r.insertId }, 'Pengguna berhasil didaftarkan.', 201);
  }),

  login: wrap(async (req, res) => {
    const p = input(req);
    const email = p.email.toLowerCase().trim();
    const [rows] = await UserModel.findByEmail(email);
    if (!rows.length || rows[0].password !== sha256(p.password))
      return send(res, false, null, 'Email atau password salah.', 401);
    const user  = rows[0];
    const token = signToken({ id: user.id, nama: user.nama, peran: user.peran });
    send(res, true, { id: user.id, nama: user.nama, peran: user.peran, token }, 'Login berhasil.');
  }),

  list: wrap(async (req, res) => {
    const [rows] = await UserModel.list();
    send(res, true, rows);
  }),

  profile: wrap(async (req, res) => {
    const [rows] = await UserModel.findById(req.user.id);
    if (!rows.length) return send(res, false, null, 'Pengguna tidak ditemukan.', 404);
    send(res, true, rows[0]);
  }),
};

const UsahaController = {
  list: wrap(async (req, res) => {
    const p = input(req);
    const where = [], params = [];
    if (req.user.peran === 'pelaku_usaha') {
      where.push('u.user_id = ?'); params.push(req.user.id);
    } else {
      if (p.status)      { where.push('u.status = ?');      params.push(p.status); }
      if (p.kategori_id) { where.push('u.kategori_id = ?'); params.push(Number(p.kategori_id)); }
      if (p.user_id)     { where.push('u.user_id = ?');     params.push(Number(p.user_id)); }
    }
    const [rows] = await UsahaModel.list(where, params);
    send(res, true, rows);
  }),

  detail: wrap(async (req, res) => {
    const p = input(req);
    const [rows] = await UsahaModel.findById(Number(p.id));
    if (!rows.length) return send(res, false, null, 'Usaha tidak ditemukan.', 404);
    send(res, true, rows[0]);
  }),

  tambah: wrap(async (req, res) => {
    const p = input(req);
    const userId = req.user.peran === 'pelaku_usaha' ? req.user.id : Number(p.user_id);
    const [r] = await UsahaModel.create(
      userId, Number(p.kategori_id), p.nama_usaha.trim(),
      p.deskripsi ?? null, p.kota ?? null, parseFloat(p.omzet_bulan ?? 0)
    );
    send(res, true, { id: r.insertId }, 'Usaha berhasil didaftarkan.', 201);
  }),

  updateStatus: wrap(async (req, res) => {
    const p = input(req);
    if (!['aktif', 'nonaktif', 'menunggu'].includes(p.status))
      return send(res, false, null, 'Status tidak valid.', 422);
    await UsahaModel.updateStatus(Number(p.id), p.status);
    send(res, true, null, 'Status usaha diperbarui.');
  }),
};

const ProdukController = {
  list: wrap(async (req, res) => {
    const p = input(req);
    const where = [], params = [];
    if (p.usaha_id) { where.push('p.usaha_id = ?'); params.push(Number(p.usaha_id)); }
    const [rows] = await ProdukModel.list(where, params);
    send(res, true, rows);
  }),

  tambah: wrap(async (req, res) => {
    const p = input(req);
    const [r] = await ProdukModel.create(
      Number(p.usaha_id), p.nama_produk.trim(),
      parseFloat(p.harga), Number(p.stok ?? 0), p.satuan ?? 'pcs'
    );
    send(res, true, { id: r.insertId }, 'Produk berhasil ditambahkan.', 201);
  }),

  update: wrap(async (req, res) => {
    const p = input(req);
    const fields = [], params = [];
    if (p.harga !== undefined) { fields.push('harga = ?'); params.push(parseFloat(p.harga)); }
    if (p.stok  !== undefined) { fields.push('stok = ?');  params.push(Number(p.stok)); }
    if (!fields.length) return send(res, false, null, 'Tidak ada data yang diubah.', 422);
    params.push(Number(p.id));
    await ProdukModel.update(fields, params);
    send(res, true, null, 'Produk berhasil diperbarui.');
  }),

  hapus: wrap(async (req, res) => {
    const p = input(req);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM produk WHERE id = ?', [Number(p.id)]);
      await conn.commit();
      send(res, true, null, 'Produk dihapus.');
    } catch (err) {
      await conn.rollback(); throw err;
    } finally { conn.release(); }
  }),
};

const TransaksiController = {
  list: wrap(async (req, res) => {
    const p = input(req);
    const where = [], params = [];
    if (req.user.peran === 'konsumen') {
      where.push('t.pembeli_id = ?'); params.push(req.user.id);
    } else if (req.user.peran === 'pelaku_usaha') {
      where.push('u2.user_id = ?'); params.push(req.user.id);
    } else {
      if (p.pembeli_id) { where.push('t.pembeli_id = ?'); params.push(Number(p.pembeli_id)); }
      if (p.usaha_id)   { where.push('u2.id = ?');        params.push(Number(p.usaha_id)); }
      if (p.status)     { where.push('t.status = ?');     params.push(p.status); }
    }
    const [rows] = await TransaksiModel.list(where, params);
    send(res, true, rows);
  }),

  buat: wrap(async (req, res) => {
    const p = input(req);
    const jumlah = Number(p.jumlah);
    if (!Number.isInteger(jumlah) || jumlah < 1)
      return send(res, false, null, 'Jumlah harus berupa bilangan bulat positif.', 422);
    const pembeliId = req.user.peran === 'konsumen' ? req.user.id : Number(p.pembeli_id);
    const [produkRows] = await ProdukModel.findById(Number(p.produk_id));
    if (!produkRows.length) return send(res, false, null, 'Produk tidak ditemukan.', 404);
    const { harga, stok } = produkRows[0];
    if (stok < jumlah) return send(res, false, null, 'Stok tidak mencukupi.', 409);
    const total = parseFloat(harga) * jumlah;
    const conn  = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE produk SET stok = stok - ? WHERE id = ?',
        [jumlah, Number(p.produk_id)]);
      const [r] = await TransaksiModel.create(
        conn, Number(p.produk_id), pembeliId, jumlah, total,
        p.metode_bayar ?? 'dompet_digital'
      );
      await conn.commit();
      send(res, true, { id: r.insertId, total_harga: total }, 'Transaksi berhasil dibuat.', 201);
    } catch (err) {
      await conn.rollback(); throw err;
    } finally { conn.release(); }
  }),

  updateStatus: wrap(async (req, res) => {
    const p = input(req);
    if (!['pending', 'dibayar', 'dikirim', 'selesai', 'batal'].includes(p.status))
      return send(res, false, null, 'Status tidak valid.', 422);
    await TransaksiModel.updateStatus(Number(p.id), p.status);
    send(res, true, null, 'Status transaksi diperbarui.');
  }),
};

const AnalitikController = {
  ringkasan: wrap(async (req, res) => {
    const [rows] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM users)                                      AS total_pengguna,
        (SELECT COUNT(*) FROM usaha WHERE status = 'aktif')               AS usaha_aktif,
        (SELECT COUNT(*) FROM transaksi)                                  AS total_transaksi,
        (SELECT COALESCE(SUM(total_harga), 0) FROM transaksi
         WHERE status IN ('dibayar','dikirim','selesai'))                 AS total_nilai
    `);
    send(res, true, rows[0]);
  }),

  harian: wrap(async (req, res) => {
    const p   = input(req);
    const now = new Date();
    const dari   = p.dari   ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const sampai = p.sampai ?? now.toISOString().split('T')[0];
    const [rows] = await pool.execute(
      `SELECT tanggal, total_transaksi, total_nilai, usaha_aktif, pengguna_baru
       FROM analitik_harian WHERE tanggal BETWEEN ? AND ? ORDER BY tanggal ASC`,
      [dari, sampai]
    );
    send(res, true, rows);
  }),

  omzetUsaha: wrap(async (req, res) => {
    const [rows] = await pool.execute(`
      SELECT u.id, u.nama_usaha, u.kota, k.nama AS kategori,
             COALESCE(SUM(t.total_harga), 0) AS omzet_total
       FROM usaha u
       JOIN kategori_usaha k ON k.id = u.kategori_id
       LEFT JOIN produk p ON p.usaha_id = u.id
       LEFT JOIN transaksi t ON t.produk_id = p.id
         AND t.status IN ('dibayar', 'dikirim', 'selesai')
       WHERE u.status = 'aktif'
       GROUP BY u.id, u.nama_usaha, u.kota, k.nama
       ORDER BY omzet_total DESC
    `);
    send(res, true, rows);
  }),
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

const router = express.Router();

// Public routes
router.post('/auth/daftar',  validate(['nama','email','password']), PenggunaController.daftar);
router.post('/auth/login',   validate(['email','password']),        PenggunaController.login);
router.post('/daftar_pengguna', validate(['nama','email','password']), PenggunaController.daftar);
router.post('/login',        validate(['email','password']),        PenggunaController.login);

// Protected routes
router.use(authMiddleware);

router.get('/pengguna',           authorize('admin'),                           PenggunaController.list);
router.get('/pengguna/profile',                                                 PenggunaController.profile);
router.get('/list_pengguna',      authorize('admin'),                           PenggunaController.list);

router.get('/usaha',                                                            UsahaController.list);
router.get('/usaha/detail',                                                     UsahaController.detail);
router.post('/usaha',             validate(['kategori_id','nama_usaha']),
                                  authorize('admin','pelaku_usaha'),            UsahaController.tambah);
router.put('/usaha/status',       validate(['id','status']),
                                  authorize('admin'),                           UsahaController.updateStatus);
router.get('/list_usaha',                                                       UsahaController.list);
router.get('/detail_usaha',                                                     UsahaController.detail);
router.post('/tambah_usaha',      validate(['kategori_id','nama_usaha']),
                                  authorize('admin','pelaku_usaha'),            UsahaController.tambah);
router.all('/update_status_usaha', validate(['id','status']),
                                  authorize('admin'),                           UsahaController.updateStatus);

router.get('/produk',                                                           ProdukController.list);
router.post('/produk',            validate(['usaha_id','nama_produk','harga']),
                                  authorize('admin','pelaku_usaha'),            ProdukController.tambah);
router.put('/produk',             validate(['id']),
                                  authorize('admin','pelaku_usaha'),            ProdukController.update);
router.delete('/produk',          validate(['id']),
                                  authorize('admin'),                           ProdukController.hapus);
router.get('/list_produk',                                                      ProdukController.list);
router.post('/tambah_produk',     validate(['usaha_id','nama_produk','harga']),
                                  authorize('admin','pelaku_usaha'),            ProdukController.tambah);
router.all('/update_produk',      validate(['id']),
                                  authorize('admin','pelaku_usaha'),            ProdukController.update);
router.all('/hapus_produk',       validate(['id']),
                                  authorize('admin'),                           ProdukController.hapus);

router.get('/transaksi',                                                        TransaksiController.list);
router.post('/transaksi',         validate(['produk_id','jumlah']),
                                  authorize('admin','pelaku_usaha','konsumen'), TransaksiController.buat);
router.put('/transaksi/status',   validate(['id','status']),
                                  authorize('admin'),                           TransaksiController.updateStatus);
router.get('/list_transaksi',                                                   TransaksiController.list);
router.post('/buat_transaksi',    validate(['produk_id','jumlah']),
                                  authorize('admin','pelaku_usaha','konsumen'), TransaksiController.buat);
router.all('/update_status_trx',  validate(['id','status']),
                                  authorize('admin'),                           TransaksiController.updateStatus);

router.get('/analitik/ringkasan', authorize('admin'),                           AnalitikController.ringkasan);
router.get('/analitik/harian',    authorize('admin'),                           AnalitikController.harian);
router.get('/analitik/omzet',     authorize('admin','pelaku_usaha'),            AnalitikController.omzetUsaha);
router.get('/ringkasan',          authorize('admin'),                           AnalitikController.ringkasan);
router.get('/analitik_harian',    authorize('admin'),                           AnalitikController.harian);
router.get('/omzet_usaha',        authorize('admin','pelaku_usaha'),            AnalitikController.omzetUsaha);

// ══════════════════════════════════════════════════════════════════════════════
// APP BOOTSTRAP
// ══════════════════════════════════════════════════════════════════════════════

const app = express();

app.use(loggerMiddleware);
app.use(corsMiddleware);
app.use(rateLimiter(200, 60_000));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — absolute path agar jalan di Vercel
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', router);

// Serve index.html untuk semua route non-API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${err.message}`);
  send(res, false, null, 'Server error: ' + err.message, 500);
});

// Jalankan server hanya di lokal
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Smart Economy API → http://localhost:${PORT}`));
}

export default app;
