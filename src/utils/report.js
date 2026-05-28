function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
}

function fmtShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric'
  })
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function jsString(value) {
  return JSON.stringify(String(value ?? '')).replace(/</g, '\\u003c')
}

export function generateAndPrintReport(customer, vehicles) {
  const sorted = [...vehicles].sort((a, b) => new Date(a.date) - new Date(b.date))
  const today  = fmt(new Date().toISOString())
  const appUrl = window.location.href

  const rows = sorted.map((v, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${fmtShort(v.date)}</td>
      <td class="mono">${esc(v.vin)}</td>
      <td>${esc(v.year)} ${esc(v.make)} ${esc(v.model)}</td>
      <td>${esc(v.color)}</td>
      <td>${esc(v.logged_by || '—')}</td>
      <td>${esc(v.notes || '—')}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>PDR Report – ${esc(customer.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; padding: 36px; }

  .app-actions { position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end; gap: 8px;
                 margin: -20px -20px 24px; padding: 12px 20px; background: #0f1923; box-shadow: 0 2px 10px rgba(15,25,35,0.16); }
  .app-actions button { border: 0; border-radius: 6px; padding: 10px 14px; font: 800 12px 'Helvetica Neue', Arial, sans-serif;
                        letter-spacing: 0.4px; text-transform: uppercase; cursor: pointer; }
  .app-actions .secondary { background: #263747; color: #fff; }
  .app-actions .primary { background: #f7c948; color: #0f1923; }

  .header { display: flex; justify-content: space-between; align-items: flex-end;
            border-bottom: 3px solid #0f1923; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 24px; font-weight: 900; color: #0f1923; letter-spacing: -0.5px; }
  .header .sub { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
  .header .meta { text-align: right; font-size: 10px; color: #555; line-height: 1.8; }

  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .info-card { background: #f0f4f8; border-radius: 6px; padding: 12px 16px; }
  .info-card .lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; font-weight: 700; }
  .info-card .val { font-size: 15px; font-weight: 800; color: #0f1923; margin-top: 3px; }
  .info-card .sub2 { font-size: 10px; color: #555; margin-top: 2px; }

  .total-bar { background: #0f1923; color: #fff; padding: 10px 16px; border-radius: 6px;
               display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .total-bar .tl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; }
  .total-bar .tn { font-size: 20px; font-weight: 900; }

  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #e4eaf2; }
  thead th { padding: 8px 10px; text-align: left; font-size: 8px; text-transform: uppercase;
             letter-spacing: 1px; color: #444; font-weight: 700; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e8edf2; vertical-align: top; line-height: 1.4; }
  .num  { color: #999; width: 28px; }
  .mono { font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.3px; }

  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd;
            display: flex; justify-content: space-between; font-size: 9px; color: #aaa; }
  @media print {
    body { padding: 20px; }
    .app-actions { display: none; }
    @page { margin: 1cm; }
  }
</style>
</head>
<body>
  <div class="app-actions">
    <button class="secondary" id="print-report">Print / Save PDF</button>
    <button class="primary" id="back-to-app">Back to App</button>
  </div>

  <div class="header">
    <div>
      <h1>PDR Work Report</h1>
      <div class="sub">Paintless Dent Repair — Subcontractor Record</div>
    </div>
    <div class="meta">
      <div>Report Generated</div>
      <div style="font-weight:700;color:#0f1923">${today}</div>
    </div>
  </div>

  <div class="info">
    <div class="info-card">
      <div class="lbl">Customer / Lot</div>
      <div class="val">${esc(customer.name)}</div>
      ${customer.company ? `<div class="sub2">${esc(customer.company)}</div>` : ''}
    </div>
    <div class="info-card">
      <div class="lbl">Contact</div>
      <div class="val" style="font-size:13px">${esc(customer.phone || customer.email || '—')}</div>
      ${customer.phone && customer.email ? `<div class="sub2">${esc(customer.email)}</div>` : ''}
    </div>
  </div>

  <div class="total-bar">
    <div class="tl">Total Vehicles</div>
    <div class="tn">${sorted.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>VIN</th>
        <th>Vehicle</th>
        <th>Color</th>
        <th>Technician</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>PDR Tracker</span>
    <span>Generated ${today}</span>
  </div>
  <script>
    const appUrl = ${jsString(appUrl)};
    document.getElementById('print-report').addEventListener('click', () => window.print());
    document.getElementById('back-to-app').addEventListener('click', () => {
      if (window.opener && !window.opener.closed) {
        window.close();
        setTimeout(() => { window.location.href = appUrl; }, 250);
      } else {
        window.location.href = appUrl;
      }
    });
  </script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Unable to open the report window. Check popup settings and try again.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
