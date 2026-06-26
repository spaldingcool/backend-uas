// ── PRODUK ────────────────────────────────────────────────────────────────────

async function loadProduk() {
  const isAdmin  = currentUser.peran === 'admin';
  const isPelaku = currentUser.peran === 'pelaku_usaha';
  let fid = document.getElementById('filterUsahaId').value;

  if (isPelaku && !fid) {
    const usahaRes = await api('GET', `/api/list_usaha?user_id=${currentUser.id}`);
    if (usahaRes.sukses && usahaRes.data.length) {
      fid = usahaRes.data[0].id;
      document.getElementById('p-usahaId').value = fid;
    }
  }

  const qs    = fid ? `?usaha_id=${fid}` : '';
  const r     = await api('GET', '/api/list_produk' + qs);
  const tbody = document.getElementById('produkTable');

  if (r.sukses && r.data.length) {
    tbody.innerHTML = r.data.map(x => `
      <tr>
        <td style="font-family:var(--mono);color:var(--muted)">${x.id}</td>
        <td>${x.nama_produk}</td>
        <td>${x.nama_usaha}</td>
        <td style="font-family:var(--mono)">
          ${isPelaku
            ? `<input type="number" value="${x.harga}" onchange="updateProduk(${x.id},'harga',this.value)" style="width:90px;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:3px 6px;border-radius:6px;font-family:var(--mono);font-size:0.78rem">`
            : rp(x.harga)}
        </td>
        <td style="font-family:var(--mono)">
          ${isPelaku
            ? `<input type="number" value="${x.stok}" onchange="updateProduk(${x.id},'stok',this.value)" style="width:70px;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:3px 6px;border-radius:6px;font-family:var(--mono);font-size:0.78rem"> ${x.satuan}`
            : `${x.stok} ${x.satuan}`}
        </td>
        <td>${isAdmin ? `<button class="btn btn-danger" onclick="hapusProduk(${x.id})">Hapus</button>` : '-'}</td>
      </tr>`).join('');
  } else {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Belum ada produk</td></tr>';
  }
}

async function tambahProduk() {
  if (!['admin','pelaku_usaha'].includes(currentUser.peran))
    return showAlert('produkAlert', 'Akses ditolak.', false);
  const body = {
    usaha_id:    document.getElementById('p-usahaId').value,
    nama_produk: document.getElementById('p-nama').value,
    harga:       document.getElementById('p-harga').value,
    stok:        document.getElementById('p-stok').value,
    satuan:      document.getElementById('p-satuan').value,
  };
  const r = await api('POST', '/api/tambah_produk', body);
  showAlert('produkAlert', r.pesan, r.sukses);
  if (r.sukses) loadProduk();
}

async function updateProduk(id, field, value) {
  const r = await api('PUT', '/api/update_produk', { id, [field]: value });
  showAlert('produkAlert', r.pesan, r.sukses);
}

async function hapusProduk(id) {
  if (!confirm('Hapus produk ini?')) return;
  const r = await api('DELETE', `/api/hapus_produk?id=${id}`);
  showAlert('produkAlert', r.pesan, r.sukses);
  if (r.sukses) loadProduk();
}
