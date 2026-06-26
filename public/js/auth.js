// ── AUTH ──────────────────────────────────────────────────────────────────────

function setLoginTab(tab) {
  document.getElementById('loginForm').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('daftarForm').style.display = tab === 'daftar' ? '' : 'none';
  document.querySelectorAll('.login-tab button').forEach((b, i) => {
    b.classList.toggle('active', (tab === 'login') === (i === 0));
  });
}

async function doLogin() {
  const email    = document.getElementById('lEmail').value;
  const password = document.getElementById('lPass').value;
  const r = await api('POST', '/api/login', { email, password });
  if (r.sukses) {
    currentUser = r.data; // includes token
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashPage').style.display  = 'flex';
    document.getElementById('greetUser').textContent   = `Halo, ${currentUser.nama} (${currentUser.peran})`;
    aturTampilan();
    loadDashboard();
  } else {
    showAlert('loginAlert', r.pesan, false);
  }
}

async function doDaftar() {
  const nama     = document.getElementById('rNama').value;
  const email    = document.getElementById('rEmail').value;
  const password = document.getElementById('rPass').value;
  const r = await api('POST', '/api/daftar_pengguna', { nama, email, password });
  showAlert('loginAlert', r.pesan, r.sukses);
  if (r.sukses) setLoginTab('login');
}

function doLogout() {
  currentUser = null;
  document.getElementById('dashPage').style.display  = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}
