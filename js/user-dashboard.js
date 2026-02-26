/* ─────────────────────────────────────────────
   ExcessScheme — Student Dashboard JS
───────────────────────────────────────────── */

/* ── TAB SYSTEM ── */
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.snav-item').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');
  document.querySelector(`.snav-item[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById('tabTitle').textContent = {
    'my-overview':'My Overview','browse-schemes':'Browse Schemes',
    'my-applications':'My Applications','my-tokens':'My Tokens',
    'ai-verify':'AI Verify Me','bridge-mode':'Bridge Mode'
  }[tabId] || tabId;
}

document.querySelectorAll('.snav-item').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); switchTab(a.dataset.tab); });
});

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  s.classList.toggle('hidden'); s.classList.toggle('open');
}

/* ── COUNTERS ── */
function animateCounters(root) {
  (root || document).querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const start = performance.now(), dur = 1500;
    function fmt(v) {
      if (prefix === '₹' && target >= 10000) return prefix + Math.round(v).toLocaleString('en-IN') + suffix;
      if (Number.isInteger(target)) return prefix + Math.round(v).toLocaleString('en-IN') + suffix;
      return prefix + v.toFixed(1) + suffix;
    }
    function step(ts) {
      const p = Math.min((ts-start)/dur,1);
      el.textContent = fmt((1-Math.pow(1-p,3))*target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ── STATUS BADGE ── */
function statusBadge(s) {
  const map = { 'Approved':'badge-success','AI Verified':'badge-info','Pending Review':'badge-warn',
    'Rejected':'badge-danger','redeemable':'badge-success','pending':'badge-warn','redeemed':'badge-default' };
  return `<span class="badge ${map[s]||'badge-default'}">${s}</span>`;
}

/* ── TIMELINE ── */
function renderTimeline() {
  const el = document.getElementById('userTimeline');
  if (!el) return;
  const events = [
    { icon:'📝', title:'Application Submitted', desc:'PM National Scholarship 2026', time:'Feb 16, 2026', state:'done' },
    { icon:'🤖', title:'AI Verification Passed', desc:'Trust Score: 87/100 — Identity confirmed', time:'Feb 16, 2026', state:'done' },
    { icon:'✅', title:'Gov Officer Approved', desc:'Scheme application approved', time:'Feb 17, 2026', state:'done' },
    { icon:'🪙', title:'Token Issued', desc:'TOK-0042-001 · ₹50,000', time:'Feb 18, 2026', state:'done' },
    { icon:'💰', title:'Redemption Pending', desc:'Process redemption to receive funds', time:'—', state:'pending' },
    { icon:'🏦', title:'Bank Transfer', desc:'Funds to be credited after redemption', time:'—', state:'waiting' },
  ];
  el.innerHTML = events.map(e => `
    <div class="tl-item">
      <div class="tl-dot ${e.state}">${e.icon}</div>
      <div>
        <div class="tl-title">${e.title}</div>
        <div class="tl-desc">${e.desc}</div>
        <div class="tl-time">${e.time}</div>
      </div>
    </div>
  `).join('');
}

/* ── TRUST GAUGE ── */
function drawGauge() {
  const canvas = document.getElementById('gaugeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 110, r = 80, score = 87;
  ctx.clearRect(0, 0, 200, 120);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2*Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 14; ctx.stroke();
  const angle = (score/100) * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI + angle);
  const grad = ctx.createLinearGradient(0, 0, 200, 0);
  grad.addColorStop(0, '#00E8C6'); grad.addColorStop(1, '#00A8FF');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();

  const checks = [
    { label:'Document Auth', val:'✓ Pass', ok:true },
    { label:'Duplicate Check', val:'✓ Unique', ok:true },
    { label:'Address', val:'⚠ Minor', ok:false },
    { label:'Bank Verify', val:'✓ OK', ok:true },
  ];
  const container = document.getElementById('gaugeChecks');
  if (container) container.innerHTML = checks.map(c => `
    <div class="gc-item">
      <span class="gc-label">${c.label}</span>
      <span class="gc-val ${c.ok?'ok':'warn'}">${c.val}</span>
    </div>
  `).join('');
}

/* ── MY SCHOLARSHIPS ── */
function renderMyScholarships() {
  const el = document.getElementById('myScholarshipsList');
  if (!el) return;
  const active = MY_APPLICATIONS.filter(a => a.status === 'Approved' || a.status === 'AI Verified');
  el.innerHTML = active.map(a => `
    <div class="ms-item">
      <span class="ms-scheme">${a.scheme}</span>
      <span>${statusBadge(a.status)}</span>
      <span class="ms-amount">₹${a.amount.toLocaleString('en-IN')}</span>
    </div>
  `).join('');
}

/* ── BROWSE SCHEMES ── */
function renderBrowseSchemes(list) {
  const grid = document.getElementById('browseGrid');
  if (!grid) return;
  grid.innerHTML = (list || SCHEMES).map(s => `
    <div class="scheme-card">
      <div class="sc-header">
        <div>
          <div class="sc-title">${s.name}</div>
          <div style="margin-top:.4rem">
            <span class="badge badge-default">${s.cat}</span>
          </div>
        </div>
        <span style="font-size:1.5rem">🎓</span>
      </div>
      <div class="sc-body">${s.criteria}</div>
      <div class="sc-meta">
        <span>💰 ₹${s.amount.toLocaleString('en-IN')}/student</span>
        <span>🎓 ${s.benef.toLocaleString('en-IN')} seats</span>
        <span>📅 ${s.deadline}</span>
      </div>
      <div class="sc-footer">
        <div class="sc-progress">
          <div class="sc-progress-bar"><div class="sc-progress-fill" style="width:${s.filled}%"></div></div>
          <span class="sc-pct">${100-s.filled}% seats remaining</span>
        </div>
        <button class="btn-sm btn-approve" style="margin-left:1rem" onclick="openApply('${s.id}','${s.name}')">Apply</button>
      </div>
    </div>
  `).join('');
}

function filterBrowseSchemes() {
  const q = (document.getElementById('browseSearch')?.value||'').toLowerCase();
  const cat = document.getElementById('browseCat')?.value;
  const amt = document.getElementById('browseAmt')?.value;
  const filtered = SCHEMES.filter(s => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (cat && s.cat !== cat) return false;
    if (amt === 'low' && s.amount >= 20000) return false;
    if (amt === 'mid' && (s.amount < 20000 || s.amount > 60000)) return false;
    if (amt === 'high' && s.amount <= 60000) return false;
    return true;
  });
  renderBrowseSchemes(filtered);
}

/* ── MY APPLICATIONS ── */
function renderMyApplications() {
  const el = document.getElementById('myAppsList');
  if (!el) return;
  el.innerHTML = MY_APPLICATIONS.map(a => `
    <div class="my-app-card">
      <div><div class="mac-scheme">${a.scheme}</div><div class="mac-date">Applied: ${a.date}</div></div>
      <div class="mac-amount">₹${a.amount.toLocaleString('en-IN')}</div>
      <div>${statusBadge(a.status)}</div>
      <div>
        <button class="btn-sm btn-view" onclick="viewAppDetail('${a.id}')">View Details</button>
      </div>
    </div>
  `).join('');
}

function viewAppDetail(id) {
  const a = MY_APPLICATIONS.find(x => x.id === id);
  alert(`Application ${id}\nScheme: ${a?.scheme}\nStatus: ${a?.status}\n\nIn production, this shows AI report, document status and timeline.`);
}

/* ── MY TOKENS WALLET ── */
function renderTokensWallet() {
  const el = document.getElementById('tokensWallet');
  if (!el) return;
  el.innerHTML = MY_TOKENS.map(t => `
    <div class="token-card ${t.status}">
      <div class="tc-scheme">${t.scheme}</div>
      <div class="tc-amount">₹${t.amount.toLocaleString('en-IN')}</div>
      <div class="tc-id">${t.id}</div>
      <div class="tc-meta">
        <div>Issued: ${t.issued}</div>
        <div>Expires: ${t.expires}</div>
      </div>
      <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
        ${statusBadge(t.status)}
        ${t.status === 'redeemable' ? `<button class="btn-sm btn-approve" onclick="redeemToken('${t.id}',this)">💰 Redeem Now</button>` : ''}
      </div>
    </div>
  `).join('');
}

function redeemToken(id, btn) {
  btn.textContent = 'Processing…'; btn.disabled = true;
  setTimeout(() => {
    btn.textContent = '✅ Redeemed!';
    btn.style.background = 'rgba(16,185,129,.2)';
    btn.closest('.token-card').classList.remove('redeemable');
    btn.closest('.token-card').classList.add('redeemed');
    alert(`Token ${id} redeemed!\n\nFunds of ₹${MY_TOKENS.find(t=>t.id===id)?.amount?.toLocaleString('en-IN')} will be credited to your bank account within 24 hours.`);
  }, 1800);
}

/* ── AI VERIFY STEPS ── */
function renderVerifySteps() {
  const el = document.getElementById('vSteps');
  if (!el) return;
  const steps = [
    { icon:'🪪', title:'Identity Document', desc:'Aadhaar or Govt ID', state:'done' },
    { icon:'📄', title:'Academic Records', desc:'Marksheet verification', state:'done' },
    { icon:'💸', title:'Income Proof', desc:'Family income certificate', state:'active' },
    { icon:'🏦', title:'Bank Verification', desc:'Account ownership check', state:'wait' },
    { icon:'🔗', title:'On-Chain Proof', desc:'Anchor result on Algorand', state:'wait' },
  ];
  el.innerHTML = steps.map(s => `
    <div class="vstep ${s.state === 'done' ? 'done' : s.state === 'active' ? 'active' : ''}">
      <span class="vstep-icon">${s.icon}</span>
      <div>
        <div class="vstep-title">${s.title} ${s.state === 'done' ? '✓' : s.state === 'active' ? '⏳' : ''}</div>
        <div class="vstep-desc">${s.desc}</div>
      </div>
    </div>
  `).join('');
}

const VERIFY_ENGINE_STEPS = [
  { icon:'🔍', label:'Document OCR Extraction',    state:'wait' },
  { icon:'🧬', label:'Identity Cross-Reference',    state:'wait' },
  { icon:'🕵️', label:'Forgery Detection Model',     state:'wait' },
  { icon:'👥', label:'Duplicate Beneficiary Check', state:'wait' },
  { icon:'📊', label:'Income Validation',           state:'wait' },
  { icon:'🔗', label:'On-Chain Anchoring',          state:'wait' },
];

function renderVerifyEngine() {
  const el = document.getElementById('verifyEngine');
  if (!el) return;
  el.innerHTML = VERIFY_ENGINE_STEPS.map((s,i) => `
    <div class="scan-item" id="ve-${i}">
      <span class="scan-label">${s.icon} ${s.label}</span>
      <span class="scan-result" id="ve-res-${i}">Waiting…</span>
    </div>
  `).join('');
}

function startVerification() {
  renderVerifyEngine();
  document.getElementById('verifyResult').innerHTML = '';
  document.getElementById('verifyResult').className = 'verify-result';
  let score = 0;
  const results = ['✓ Authentic','✓ Matched','✓ Unique','✓ Unique','✓ Valid','✓ Anchored'];
  const weights = [20, 18, 20, 18, 12, 12];
  let i = 0;
  function runStep() {
    if (i >= VERIFY_ENGINE_STEPS.length) { showVerifyResult(score); return; }
    document.getElementById(`ve-${i}`)?.classList.add('verified');
    document.getElementById(`ve-res-${i}`).textContent = '⏳ Running…';
    document.getElementById(`ve-res-${i}`).style.color = 'var(--accent)';
    setTimeout(() => {
      const ok = Math.random() > 0.12;
      document.getElementById(`ve-res-${i}`).textContent = ok ? results[i] : '⚠ Anomaly';
      document.getElementById(`ve-res-${i}`).style.color = ok ? 'var(--success)' : 'var(--warn)';
      if (ok) score += weights[i];
      i++; setTimeout(runStep, 600);
    }, 700);
  }
  runStep();
}

function showVerifyResult(score) {
  const el = document.getElementById('studentScoreFill');
  el.style.width = score + '%';
  document.getElementById('studentScoreVal').textContent = score + ' / 100';
  const res = document.getElementById('verifyResult');
  if (score >= 70) {
    res.className = 'verify-result success';
    res.innerHTML = `✅ Verification Passed — Trust Score: ${score}/100<br><small>Your identity has been verified and anchored on Algorand MainNet.</small>`;
  } else {
    res.className = 'verify-result fail';
    res.innerHTML = `⚠ Verification Flagged — Score: ${score}/100<br><small>Some checks failed. Please re-upload correct documents.</small>`;
  }
}

/* ── BRIDGE MODE ── */
function renderBridgeMode() {
  const batchInfo = document.getElementById('batchInfo');
  if (!batchInfo) return;

  const isAssigned = BRIDGE_BATCH.bridgeId === 'STU-2026-0042';
  const badge = document.getElementById('bridgeStatus');
  if (badge) {
    badge.innerHTML  = isAssigned
      ? `<span class="ai-dot green" style="background:var(--accent);box-shadow:0 0 8px var(--accent)"></span> Active Bridge`
      : `<span class="ai-dot" style="background:var(--text-3)"></span> Not Assigned`;
    badge.style.cssText = isAssigned
      ? 'background:rgba(0,232,198,.08);border:1px solid var(--border);color:var(--accent);padding:.5rem 1rem;border-radius:8px;font-size:.8rem;font-weight:700'
      : 'background:rgba(255,255,255,.04);border:1px solid var(--border-2);color:var(--text-2);padding:.5rem 1rem;border-radius:8px;font-size:.8rem;font-weight:600';
  }

  batchInfo.innerHTML = `
    <div class="batch-info-grid">
      <div class="big-item"><span class="big-l">Batch ID</span><span class="big-v">${BRIDGE_BATCH.batchId}</span></div>
      <div class="big-item"><span class="big-l">Scheme</span><span class="big-v">${BRIDGE_BATCH.scheme}</span></div>
      <div class="big-item"><span class="big-l">Total Tokens</span><span class="big-v" style="color:var(--accent)">${BRIDGE_BATCH.total.toLocaleString('en-IN')}</span></div>
      <div class="big-item"><span class="big-l">Total Amount</span><span class="big-v">${BRIDGE_BATCH.amount}</span></div>
      <div class="big-item"><span class="big-l">Bridge ID</span><span class="big-v">${BRIDGE_BATCH.bridgeId}</span></div>
      <div class="big-item"><span class="big-l">Lock Until</span><span class="big-v">${BRIDGE_BATCH.lock_until}</span></div>
    </div>`;

  const distEl = document.getElementById('distributeList');
  if (distEl) {
    distEl.innerHTML = BRIDGE_RECIPIENTS.map(r => `
      <div class="dist-item" id="dist-${r.id}">
        <span>${r.name} <small style="color:var(--text-3)">(${r.id})</small></span>
        <span>₹${r.amount.toLocaleString('en-IN')}</span>
        <span class="di-status ${r.status}">${r.status === 'verified' ? '✓ Verified' : '⏳ Pending'}</span>
      </div>
    `).join('');
  }
}

function distributeAll() {
  const btn = event.target;
  btn.textContent = '⚡ Distributing…'; btn.disabled = true;
  let i = 0;
  function next() {
    const verified = BRIDGE_RECIPIENTS.filter(r => r.status === 'verified');
    if (i >= verified.length) {
      btn.textContent = '✅ All Distributed!';
      btn.style.background = 'var(--success)';
      return;
    }
    const row = document.getElementById(`dist-${verified[i].id}`);
    if (row) {
      row.style.background = 'rgba(16,185,129,.07)';
      row.querySelector('.di-status').textContent = '✅ Sent';
      row.querySelector('.di-status').style.color = 'var(--success)';
    }
    i++; setTimeout(next, 400);
  }
  setTimeout(next, 800);
}

/* ── APPLY MODAL ── */
function openApply(id, name) {
  document.getElementById('applyModalSub').textContent = name;
  document.getElementById('applyModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('applyModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal('applyModal');
});
function submitApplication(e) {
  e.preventDefault();
  const btn = e.submitter;
  btn.textContent = 'Submitting…'; btn.disabled = true;
  setTimeout(() => {
    closeModal('applyModal');
    alert('Application submitted!\n\nAI Verification will begin automatically. Check "My Applications" for status.');
    btn.textContent = 'Submit Application'; btn.disabled = false;
  }, 1500);
}

/* ── INIT ── */
window.addEventListener('DOMContentLoaded', () => {
  animateCounters();
  renderTimeline();
  drawGauge();
  renderMyScholarships();
  renderBrowseSchemes();
  renderMyApplications();
  renderTokensWallet();
  renderVerifySteps();
  renderVerifyEngine();
  renderBridgeMode();
});
