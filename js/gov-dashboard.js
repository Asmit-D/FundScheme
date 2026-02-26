/* ─────────────────────────────────────────────
   ExcessScheme — Government Dashboard JS
───────────────────────────────────────────── */

/* ── TAB SYSTEM ── */
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.snav-item').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');
  document.querySelector(`.snav-item[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById('tabTitle').textContent = {
    'overview':'Overview', 'schemes':'Manage Schemes', 'tokenize':'Tokenize Funds',
    'applications':'Applications', 'ai-flags':'AI Flags', 'reports':'Audit Reports'
  }[tabId] || tabId;
}

document.querySelectorAll('.snav-item').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); switchTab(a.dataset.tab); });
});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
  document.getElementById('sidebar').classList.toggle('open');
}

/* ── COUNTER ANIMATION ── */
function animateCounters(root) {
  (root || document).querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const isShort = el.dataset.short === 'true';
    const start = performance.now();
    const dur = 1600;
    function fmt(v) {
      if (isShort) {
        if (v >= 1e7) return prefix + (v/1e7).toFixed(1) + 'Cr' + suffix;
        if (v >= 1e5) return prefix + (v/1e5).toFixed(1) + 'L' + suffix;
        return prefix + v.toLocaleString('en-IN') + suffix;
      }
      if (Number.isInteger(target)) return prefix + Math.round(v).toLocaleString('en-IN') + suffix;
      return prefix + v.toFixed(1) + suffix;
    }
    function step(ts) {
      const p = Math.min((ts - start) / dur, 1);
      el.textContent = fmt((1 - Math.pow(1-p, 3)) * target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ── STATUS BADGE ── */
function statusBadge(s) {
  const map = {
    'Completed':'badge-success','Approved':'badge-success','AI Verified':'badge-info',
    'Pending':'badge-warn','Pending Review':'badge-warn','Processing':'badge-warn',
    'Rejected':'badge-danger','draft':'badge-default','active':'badge-success','closed':'badge-danger'
  };
  const cls = map[s] || 'badge-default';
  return `<span class="badge ${cls}">${s}</span>`;
}

/* ── RENDER TRANSACTIONS ── */
function renderTxTable() {
  const body = document.getElementById('txTableBody');
  if (!body) return;
  body.innerHTML = TX_DATA.map(t => `
    <tr>
      <td><span class="tx-hash">${t.hash}</span></td>
      <td>${t.scheme}</td>
      <td style="font-weight:700;color:var(--accent)">${t.amount}</td>
      <td>${statusBadge(t.status)}</td>
    </tr>
  `).join('');
}

/* ── RENDER ALERTS FEED ── */
function renderAlerts() {
  const feed = document.getElementById('alertsFeed');
  if (!feed) return;
  feed.innerHTML = AI_FLAGS.slice(0, 4).map(f => `
    <div class="alert-item ${f.type}">
      <span class="alert-icon">${f.type === 'critical' ? '🚨' : '⚠️'}</span>
      <div class="alert-body">
        <div class="alert-title">${f.reason} — ${f.student}</div>
        <div class="alert-desc">${f.detail.substring(0, 80)}…</div>
      </div>
      <span class="alert-time">${f.time}</span>
    </div>
  `).join('');
}

/* ── RENDER SCHEMES GRID ── */
function renderSchemes(list) {
  const grid = document.getElementById('schemesGrid');
  if (!grid) return;
  grid.innerHTML = (list || SCHEMES).map(s => `
    <div class="scheme-card">
      <div class="sc-header">
        <div>
          <div class="sc-title">${s.name}</div>
          <div style="margin-top:.4rem">${statusBadge(s.status)} <span class="badge badge-default" style="margin-left:.3rem">${s.cat}</span></div>
        </div>
      </div>
      <div class="sc-body">${s.criteria}</div>
      <div class="sc-meta">
        <span>💰 ₹${s.budget}Cr budget</span>
        <span>🎓 ${s.benef.toLocaleString('en-IN')} students</span>
        <span>📅 ${s.deadline}</span>
      </div>
      <div class="sc-footer">
        <div class="sc-progress" style="flex:1">
          <div class="sc-progress-bar"><div class="sc-progress-fill" style="width:${s.filled}%"></div></div>
          <span class="sc-pct">${s.filled}% filled (${Math.round(s.benef*s.filled/100).toLocaleString('en-IN')} / ${s.benef.toLocaleString('en-IN')})</span>
        </div>
        <div style="display:flex;gap:.5rem;margin-left:1rem">
          <button class="btn-sm btn-view" onclick="alert('Viewing ${s.name}')">View</button>
          <button class="btn-sm btn-approve" onclick="tokenizeScheme('${s.id}')">Tokenize</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterSchemes() {
  const q   = (document.getElementById('schemeSearch')?.value || '').toLowerCase();
  const st  = document.getElementById('schemeStatus')?.value;
  const cat = document.getElementById('schemeCat')?.value;
  const filtered = SCHEMES.filter(s =>
    (!q || s.name.toLowerCase().includes(q)) &&
    (!st  || s.status === st) &&
    (!cat || s.cat === cat)
  );
  renderSchemes(filtered);
}

function tokenizeScheme(id) {
  const s = SCHEMES.find(x => x.id === id);
  if (!s) return;
  switchTab('tokenize');
  document.getElementById('tkScheme').value = s.name;
  document.getElementById('tkAmount').value = s.budget * 1e7;
  document.getElementById('tkCount').value  = s.benef;
  document.getElementById('tkPerStudent').value = Math.round((s.budget*1e7)/s.benef);
  updatePreview();
}

/* ── TOKENIZE PREVIEW ── */
function updatePreview() {
  const scheme = document.getElementById('tkScheme')?.value || '—';
  const amount = document.getElementById('tkAmount')?.value;
  const count  = document.getElementById('tkCount')?.value;
  const bridge = document.getElementById('tkBridge')?.value || '—';
  const lock   = document.getElementById('tkLock')?.value || '—';

  if (amount && count) {
    const per = Math.round(Number(amount) / Number(count));
    document.getElementById('tkPerStudent').value = per;
    document.getElementById('prev-per').textContent = '₹' + per.toLocaleString('en-IN');
  }
  document.getElementById('prev-scheme').textContent = scheme;
  document.getElementById('prev-amount').textContent = amount ? '₹' + Number(amount).toLocaleString('en-IN') : '—';
  document.getElementById('prev-count').textContent  = count ? Number(count).toLocaleString('en-IN') : '—';
  document.getElementById('prev-bridge').textContent = bridge;
  document.getElementById('prev-lock').textContent   = lock;

  const tId = 'SCH-TKN-' + Math.random().toString(36).substring(2,8).toUpperCase();
  document.querySelector('.tpc-id').textContent = tId;
}

['tkScheme','tkAmount','tkCount','tkBridge','tkLock'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updatePreview);
  document.getElementById(id)?.addEventListener('change', updatePreview);
});

function mintTokens(e) {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('button[type="submit"]');
  btn.textContent = '⚡ Minting…';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = '✅ Tokens Minted!';
    btn.style.background = 'var(--success)';
    const mintedItems = document.getElementById('mintedItems');
    const scheme = document.getElementById('tkScheme')?.value;
    const count  = document.getElementById('tkCount')?.value;
    const per    = document.getElementById('tkPerStudent')?.value;
    MINTED_HISTORY.unshift({ scheme, tokens: Number(count), amount: '₹' + (Number(count)*Number(per)).toLocaleString('en-IN'), time:'Just Now' });
    renderMintedHistory();
    setTimeout(() => { btn.textContent = '⚡ Mint Tokens'; btn.disabled = false; btn.style.background = ''; }, 2500);
  }, 2000);
}

function renderMintedHistory() {
  const el = document.getElementById('mintedItems');
  if (!el) return;
  el.innerHTML = MINTED_HISTORY.map(m => `
    <div class="minted-item">
      <span class="mi-scheme">${m.scheme}</span>
      <span class="mi-val">${m.amount}</span>
      <span style="font-size:.72rem;color:var(--text-3)">${m.time}</span>
    </div>
  `).join('');
}

/* ── APPLICATIONS TABLE ── */
function renderApplications() {
  const container = document.getElementById('applicationsTable');
  if (!container) return;
  container.innerHTML = `
    <div class="table-card" style="overflow:visible">
      ${APPLICATIONS.map(a => `
        <div class="app-row">
          <div><div class="app-name">${a.name}</div><div class="app-id">${a.studentId}</div></div>
          <div class="app-scheme">${a.scheme}</div>
          <div class="app-amount">₹${a.amount.toLocaleString('en-IN')}</div>
          <div>${statusBadge(a.status)}</div>
          <div style="font-size:.75rem;color:var(--text-3)">${a.date}</div>
          <div class="app-actions">
            <button class="btn-sm btn-approve" onclick="approveApp('${a.id}',this)">✓</button>
            <button class="btn-sm btn-reject"  onclick="rejectApp('${a.id}',this)">✕</button>
            <button class="btn-sm btn-view"    onclick="viewApp('${a.id}')">👁</button>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function approveApp(id, btn) { btn.closest('.app-row').querySelector('.badge').outerHTML = statusBadge('Approved'); }
function rejectApp(id, btn)  { btn.closest('.app-row').querySelector('.badge').outerHTML = statusBadge('Rejected'); }
function viewApp(id) { alert('Viewing application ' + id + '\n\nIn production, this opens a detailed view with AI report.'); }

/* ── AI FLAGS ── */
function renderAIFlags() {
  const container = document.getElementById('flagsContainer');
  if (!container) return;
  container.innerHTML = AI_FLAGS.map(f => `
    <div class="flag-card ${f.type}">
      <div class="flag-header">
        <div>
          <div class="flag-title">${f.reason} — ${f.student}</div>
          <div class="flag-id">${f.id} · ${f.studentId}</div>
        </div>
        <div>${statusBadge(f.type === 'critical' ? 'Rejected' : 'Pending Review')}</div>
      </div>
      <div class="flag-meta">
        <span>📋 ${f.scheme}</span>
        <span>🕐 ${f.time}</span>
      </div>
      <div class="flag-details">${f.detail}</div>
      <div class="flag-actions">
        <button class="btn-sm btn-approve" onclick="resolveFlag('${f.id}',this,'clear')">✓ Clear Flag</button>
        <button class="btn-sm btn-reject"  onclick="resolveFlag('${f.id}',this,'reject')">✕ Reject App</button>
        <button class="btn-sm btn-view"    onclick="viewAIReport('${f.id}')">🤖 Full AI Report</button>
      </div>
    </div>
  `).join('');
}

function resolveFlag(id, btn, action) {
  const card = btn.closest('.flag-card');
  card.style.opacity = '.5';
  card.style.pointerEvents = 'none';
  const msg = action === 'clear' ? '✅ Flag Cleared' : '❌ Application Rejected';
  card.querySelector('.flag-title').textContent += ' — ' + msg;
  document.querySelector('.notif-count').textContent = Math.max(0, parseInt(document.querySelector('.notif-count').textContent) - 1);
}

function viewAIReport(id) {
  alert(`🤖 Full AI Report — ${id}\n\nIn production, this would open the detailed AI verification report with document analysis, similarity scores, fraud patterns matched, and blockchain audit trail.`);
}

/* ── REPORTS ── */
function renderReports() {
  const grid = document.getElementById('reportsGrid');
  if (!grid) return;
  grid.innerHTML = REPORTS_DATA.map(r => `
    <div class="report-card">
      <div class="rc-icon">${r.icon}</div>
      <div class="rc-title">${r.title}</div>
      <div class="rc-desc">${r.desc}</div>
      <div class="rc-meta">${r.meta}</div>
      <button class="btn-sm btn-view" onclick="downloadReport('${r.title}')">⬇ Download</button>
    </div>
  `).join('');
}

function downloadReport(name) { alert(`Downloading: ${name}\n\n(In production, this generates a signed PDF with blockchain hash verification.)`); }
function generateReport() { alert('Generating comprehensive audit report…\n\nThis would compile all scheme, token, and AI data into a signed, immutable report anchored on-chain.'); }

/* ── CHARTS (built-in canvas) ── */
function drawBarChart() {
  const canvas = document.getElementById('tokenChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const months = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
  const data   = [8200, 9100, 11400, 12800, 14200, 13600, 15800, 17200, 16400, 18900, 21200, 24800];
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 200;
  const pad = { t:20, r:20, b:30, l:50 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const max = Math.max(...data) * 1.1;
  ctx.clearRect(0, 0, W, H);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (cH * (1 - i/4));
    ctx.beginPath();
    ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,.5)'; ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText((max * i/4 / 1000).toFixed(0) + 'K', pad.l - 6, y + 3);
  }

  const barW = (cW / months.length) * .6;
  const gap  = cW / months.length;

  data.forEach((val, i) => {
    const x = pad.l + i * gap + gap/2 - barW/2;
    const h = (val / max) * cH;
    const y = pad.t + cH - h;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(0,232,198,.9)');
    grad.addColorStop(1, 'rgba(0,168,255,.4)');
    ctx.fillStyle = grad;
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(148,163,184,.6)';
    ctx.font = '9px Inter'; ctx.textAlign = 'center';
    ctx.fillText(months[i], x + barW/2, H - 8);
  });
}

function drawDonutChart() {
  const canvas = document.getElementById('schemeDonut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 200;
  const cx = W/2, cy = 90, r = 70, ri = 44;
  const data = [
    { label:'Merit', val:35, color:'#00E8C6' },
    { label:'Need-Based', val:40, color:'#3B82F6' },
    { label:'Disability', val:10, color:'#F59E0B' },
    { label:'Minority', val:15, color:'#8B5CF6' },
  ];
  let start = -Math.PI/2;
  ctx.clearRect(0, 0, W, H);
  data.forEach(d => {
    const angle = (d.val/100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.arc(cx, cy, ri, start + angle, start, true);
    ctx.fillStyle = d.color;
    ctx.fill();
    start += angle;
  });
  // Legend
  let lx = 10, ly = H - 40;
  data.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = 'rgba(148,163,184,.8)';
    ctx.font = '9px Inter'; ctx.textAlign = 'left';
    ctx.fillText(`${d.label} ${d.val}%`, lx + 13, ly + 8);
    lx += (W/4);
  });
}

/* ── SCHEME MODAL ── */
function openCreateScheme() {
  document.getElementById('schemeModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('schemeModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal('schemeModal');
});

function saveScheme(e) {
  e.preventDefault();
  const name     = document.getElementById('sName').value;
  const cat      = document.getElementById('sCat').value;
  const budget   = document.getElementById('sBudget').value;
  const benef    = document.getElementById('sBenef').value;
  const deadline = document.getElementById('sDeadline').value;
  const criteria = document.getElementById('sCriteria').value;
  SCHEMES.unshift({ id:'SCH-'+ (900 + SCHEMES.length), name, cat, budget: Number(budget), benef: Number(benef), amount: Math.round(Number(budget)*1e7/Number(benef)), filled:0, status:'draft', deadline, criteria });
  closeModal('schemeModal');
  renderSchemes();
  switchTab('schemes');
}

/* ── INIT ── */
window.addEventListener('DOMContentLoaded', () => {
  animateCounters();
  renderTxTable();
  renderAlerts();
  renderSchemes();
  renderApplications();
  renderAIFlags();
  renderReports();
  renderMintedHistory();
  updatePreview();
  setTimeout(() => { drawBarChart(); drawDonutChart(); }, 100);
  window.addEventListener('resize', () => { drawBarChart(); drawDonutChart(); });
});
