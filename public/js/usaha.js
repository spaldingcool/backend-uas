// ── USAHA ─────────────────────────────────────────────────────────────────────

async function loadUsaha() {
  const isAdmin  = currentUser.peran === 'admin';
  const isPelaku = currentUser.peran === 'pelaku_usaha';
  const qs = isPelaku ? `?user_id=${currentUser.id}` : '';
  const r  = await api('GET', '/api/list_usaha' + qs);

  const omzetMap = {};
  if (isAdmin || isPelaku) {
    const o = await api('GET', '/api/omzet_usaha');
    if (o.sukses) o.data.forEach(x => { omzetMap[x.id] = x.omzet_total; });
  }

  const tbody = document.getElementById('usahaTable');
  if (r.sukses && r.data.length) {
    tbody.innerHTML = r.data.map(x => `
      <tr>
        <td style="font-family:var(--mono);color:var(--muted)">${x.id}</td>
        <td>${x.nama_usaha}</td>
        <td>${x.kategori ?? '-'}</td>
        <td>${x.kota ?? '-'}</td>
        ${(isAdmin || isPelaku) ? `
        <td style="font-family:var(--mono)">${rp(x.omzet_bulan)}</td>
        <td style="font-family:var(--mono);color:var(--accent)">${rp(omzetMap[x.id] ?? 0)}</td>` : ''}
        <td>${badge(x.status)}</td>
        <td>
          ${isAdmin ? `
          <select onchange="updateUsaha(${x.id}, this.value)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-family:var(--mono);font-size:0.75rem">
            <option value="aktif"    ${x.status==='aktif'    ?'selected':''}>aktif</option>
            <option value="nonaktif" ${x.status==='nonaktif' ?'selected':''}>nonaktif</option>
            <option value="menunggu" ${x.status==='menunggu' ?'selected':''}>menunggu</option>
          </select>` : '-'}
        </td>
      </tr>`).join('');
  } else {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Belum ada usaha</td></tr>';
  }
}

async function tambahUsaha() {
  if (!['admin','pelaku_usaha'].includes(currentUser.peran))
    return showAlert('usahaAlert', 'Akses ditolak.', false);
  const body = {
    user_id:     document.getElementById('u-userId').value,
    kategori_id: document.getElementById('u-katId').value,
    nama_usaha:  document.getElementById('u-nama').value,
    kota:        document.getElementById('u-kota').value,
    omzet_bulan: document.getElementById('u-omzet').value,
    deskripsi:   document.getElementById('u-desk').value,
  };
  const r = await api('POST', '/api/tambah_usaha', body);
  showAlert('usahaAlert', r.pesan, r.sukses);
  if (r.sukses) loadUsaha();
}

async function updateUsaha(id, status) {
  const r = await api('PUT', '/api/update_status_usaha', { id, status });
  showAlert('usahaAlert', r.pesan, r.sukses);
  if (r.sukses) { loadUsaha(); loadDashboard(); }
}
