// ── GLOBAL STATE ─────────────────────────────────────────────────────────────
const API = '';
let currentUser = null;

// ── HTTP HELPER ───────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const token = currentUser?.token ?? '';
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  return r.json();
}

// ── FORMAT RUPIAH ─────────────────────────────────────────────────────────────
function rp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
function badge(status) {
  const map = {
    aktif: 'green', nonaktif: 'red', menunggu: 'yellow', pending: 'yellow',
    dibayar: 'green', dikirim: 'yellow', selesai: 'green', batal: 'red',
    admin: 'yellow', konsumen: 'gray', pelaku_usaha: 'green',
  };
  const cls = map[status] || 'gray';
  return `<span class="badge badge-${cls}">${status ?? '—'}</span>`;
}

// ── ALERT ─────────────────────────────────────────────────────────────────────
function showAlert(elId, msg, ok) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<div class="alert ${ok ? 'alert-ok' : 'alert-err'}">${msg}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}
