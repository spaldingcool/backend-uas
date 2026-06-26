// ── PENGGUNA ──────────────────────────────────────────────────────────────────

async function loadPengguna() {
  const r     = await api('GET', '/api/list_pengguna');
  const tbody = document.getElementById('penggunaTable');
  if (r.sukses && r.data.length) {
    tbody.innerHTML = r.data.map(x => `
      <tr>
        <td style="font-family:var(--mono);color:var(--muted)">${x.id}</td>
        <td>${x.nama}</td>
        <td style="font-family:var(--mono)">${x.email}</td>
        <td>${badge(x.peran)}</td>
        <td style="font-family:var(--mono);color:var(--muted)">${new Date(x.dibuat_pada).toLocaleDateString('id-ID')}</td>
      </tr>`).join('');
  } else {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Belum ada pengguna</td></tr>';
  }
}
