// ── TRANSAKSI ─────────────────────────────────────────────────────────────────

async function loadTransaksi() {
  const peran    = currentUser.peran;
  const isAdmin  = peran === 'admin';
  const isPelaku = peran === 'pelaku_usaha';
  let qs = '';

  if (peran === 'konsumen') {
    qs = `?pembeli_id=${currentUser.id}`;
  } else if (isPelaku) {
    const usahaRes = await api('GET', `/api/list_usaha?user_id=${currentUser.id}`);
    if (usahaRes.sukses && usahaRes.data.length)
      qs = `?usaha_id=${usahaRes.data[0].id}`;
  }

  const r     = await api('GET', '/api/list_transaksi' + qs);
  const tbody = document.getElementById('trxTable');

  if (r.sukses && r.data.length) {
    tbody.innerHTML = r.data.map(x => `
      <tr>
        <td style="font-family:var(--mono);color:var(--muted)">#${x.id}</td>
        <td>${x.nama_produk}</td>
        <td>${x.nama_pembeli}</td>
        <td style="font-family:var(--mono)">${rp(x.total_harga)}</td>
        <td style="font-family:var(--mono)">${x.metode_bayar}</td>
        <td>${badge(x.status)}</td>
        <td>
          ${isAdmin ? `
          <select onchange="updateTrx(${x.id}, this.value)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-family:var(--mono);font-size:0.75rem">
            <option value="pending"  ${x.status==='pending'  ?'selected':''}>pending</option>
            <option value="dibayar"  ${x.status==='dibayar'  ?'selected':''}>dibayar</option>
            <option value="dikirim"  ${x.status==='dikirim'  ?'selected':''}>dikirim</option>
            <option value="selesai"  ${x.status==='selesai'  ?'selected':''}>selesai</option>
            <option value="batal"    ${x.status==='batal'    ?'selected':''}>batal</option>
          </select>` : '-'}
        </td>
      </tr>`).join('');
  } else {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Belum ada transaksi</td></tr>';
  }
}

async function buatTransaksi() {
  if (!['admin','pelaku_usaha','konsumen'].includes(currentUser.peran))
    return showAlert('trxAlert', 'Akses ditolak.', false);
  const body = {
    produk_id:    document.getElementById('t-produkId').value,
    pembeli_id:   currentUser.peran === 'konsumen' ? currentUser.id : document.getElementById('t-pembeliId').value,
    jumlah:       document.getElementById('t-jumlah').value,
    metode_bayar: document.getElementById('t-metode').value,
  };
  const r = await api('POST', '/api/buat_transaksi', body);
  showAlert('trxAlert', r.pesan, r.sukses);
  if (r.sukses) { loadTransaksi(); loadDashboard(); }
}

async function updateTrx(id, status) {
  const r = await api('PUT', '/api/update_status_trx', { id, status });
  showAlert('trxAlert', r.pesan, r.sukses);
  if (r.sukses) { loadTransaksi(); loadDashboard(); }
}
