// ── DASHBOARD ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const r = await api('GET', '/api/ringkasan');
  if (r.sukses) {
    document.getElementById('s-pengguna').textContent = r.data.total_pengguna;
    document.getElementById('s-usaha').textContent    = r.data.usaha_aktif;
    document.getElementById('s-trx').textContent      = r.data.total_transaksi;
    document.getElementById('s-nilai').textContent    = rp(r.data.total_nilai);
  }
  const t = await api('GET', '/api/list_transaksi');
  const tbody = document.getElementById('recentTrx');
  if (t.sukses && t.data.length) {
    tbody.innerHTML = t.data.slice(0, 8).map(x => `
      <tr>
        <td style="font-family:var(--mono);color:var(--muted)">#${x.id}</td>
        <td>${x.nama_produk}</td>
        <td>${x.nama_pembeli}</td>
        <td style="font-family:var(--mono)">${rp(x.total_harga)}</td>
        <td>${badge(x.status)}</td>
      </tr>`).join('');
  } else {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Belum ada transaksi</td></tr>';
  }
}
