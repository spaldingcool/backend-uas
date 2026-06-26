// ── NAVIGATION ────────────────────────────────────────────────────────────────

function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
  const loaders = { usaha: loadUsaha, produk: loadProduk, transaksi: loadTransaksi, pengguna: loadPengguna };
  if (loaders[name]) loaders[name]();
}

function goPageDirect(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const loaders = { usaha: loadUsaha, produk: loadProduk, transaksi: loadTransaksi };
  if (loaders[name]) loaders[name]();
}

function aturTampilan() {
  const peran    = currentUser.peran;
  const isAdmin  = peran === 'admin';
  const isPelaku = peran === 'pelaku_usaha';

  // Form tambah: hanya admin & pelaku_usaha
  document.getElementById('formTambahProduk').style.display = (isAdmin || isPelaku) ? '' : 'none';
  document.getElementById('formTambahUsaha').style.display  = (isAdmin || isPelaku) ? '' : 'none';

  // Menu pengguna & dashboard: hanya admin
  document.getElementById('navPengguna').style.display  = isAdmin ? '' : 'none';
  document.getElementById('navDashboard').style.display = isAdmin ? '' : 'none';

  // Redirect ke halaman sesuai peran
  if (isPelaku)          goPageDirect('produk');
  if (peran === 'konsumen') goPageDirect('transaksi');
}

function applyRoleUI() {
  if (!currentUser) return;
  const peran = currentUser.peran;
  const btnTambahUsaha   = document.getElementById('btn-tambah-usaha');
  const btnTambahProduk  = document.getElementById('btn-tambah-produk');
  const btnBuatTransaksi = document.getElementById('btn-buat-transaksi');
  if (btnTambahUsaha)
    btnTambahUsaha.style.display = peran === 'admin' ? 'block' : 'none';
  if (btnTambahProduk)
    btnTambahProduk.style.display = ['admin','pelaku_usaha'].includes(peran) ? 'block' : 'none';
  if (btnBuatTransaksi)
    btnBuatTransaksi.style.display = ['admin','pelaku_usaha','konsumen'].includes(peran) ? 'block' : 'none';
}
