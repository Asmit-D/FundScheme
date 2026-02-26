/* ─────────────────────────────────────────────
   ExcessScheme — AI Verify Page JS
───────────────────────────────────────────── */

/* ── FILE UPLOAD ── */
function triggerUpload(zone) {
  document.getElementById('file-' + zone).click();
}
function fileSelected(input, zone) {
  const file = input.files[0];
  if (!file) return;
  const zoneEl = document.getElementById('zone-' + zone);
  const statusEl = document.getElementById('status-' + zone);
  zoneEl.classList.add('uploaded');
  statusEl.textContent = `✓ ${file.name}`;
  zoneEl.querySelector('.uz-icon').textContent = '✅';
}

/* ── AI PIPELINE STEPS ── */
const PIPELINE_STEPS = [
  { icon:'📤', label:'Document Upload & Hash',       id:'step-upload'    },
  { icon:'🔍', label:'OCR Text Extraction',          id:'step-ocr'       },
  { icon:'🧬', label:'Identity Cross-Reference',     id:'step-identity'  },
  { icon:'🕵️', label:'Forgery Detection Model',      id:'step-forgery'   },
  { icon:'👥', label:'Duplicate Beneficiary Check',  id:'step-duplicate' },
  { icon:'📊', label:'Income & Bank Validation',     id:'step-income'    },
  { icon:'🔗', label:'On-Chain Proof Anchoring',     id:'step-chain'     },
];

const FRAUD_PATTERNS = [
  { icon:'📋', title:'Document Font Inconsistency', desc:'OCR detects inconsistent font weights/sizes on scanned text that indicate digital editing.', level:'high' },
  { icon:'👥', title:'Clustered Address Fraud', desc:'Multiple applicants sharing identical addresses beyond statistical norms — family fraud or ghost applicants.', level:'med' },
  { icon:'🏦', title:'Third-Party Bank Account', desc:'Bank account holder name/PAN does not match student records — diversion of scholarship funds.', level:'high' },
  { icon:'🪪', title:'Identity Cloning', desc:'Same biometric hash or Aadhaar linked to multiple student IDs across different schemes.', level:'high' },
  { icon:'💸', title:'Income Certificate Inflation', desc:'Stated income is statistically inconsistent with location, property data, or spending patterns.', level:'med' },
  { icon:'🎓', title:'Enrollment Mismatch', desc:'Student listed as enrolled in institution not recognized or with inconsistent year/course data.', level:'low' },
];

/* ── RENDER PIPELINE ── */
function renderPipeline() {
  const el = document.getElementById('aePipeline');
  if (!el) return;
  el.innerHTML = PIPELINE_STEPS.map(s => `
    <div class="pipe-step" id="${s.id}">
      <span class="ps-icon">${s.icon}</span>
      <span class="ps-label">${s.label}</span>
      <span class="ps-state">—</span>
    </div>
  `).join('');
}

/* ── RENDER FRAUD PATTERNS ── */
function renderFraudPatterns() {
  const el = document.getElementById('fpList');
  if (!el) return;
  el.innerHTML = FRAUD_PATTERNS.map(f => `
    <div class="fp-item">
      <span class="fp-icon">${f.icon}</span>
      <div>
        <div class="fp-title">${f.title} <span class="fp-chip ${f.level}">${f.level} risk</span></div>
        <div class="fp-desc">${f.desc}</div>
      </div>
    </div>
  `).join('');
}

/* ── MAIN VERIFICATION FLOW ── */
function runAIVerification() {
  const name   = document.getElementById('aiName')?.value;
  const dob    = document.getElementById('aiDob')?.value;
  const aadhaar= document.getElementById('aiAadhaar')?.value;
  const studId = document.getElementById('aiStudentId')?.value;

  if (!name || !dob || !aadhaar || !studId) {
    alert('Please fill in all required student details before running verification.');
    return;
  }

  renderPipeline();
  const resultEl   = document.getElementById('aeResult');
  const progressEl = document.getElementById('aeProgressWrap');
  const statusEl   = document.getElementById('aeStatus');
  const fillEl     = document.getElementById('aeProgressFill');
  const labelEl    = document.getElementById('aeProgressLabel');

  resultEl.style.display   = 'none';
  progressEl.style.display = 'block';
  statusEl.textContent  = 'Running';
  statusEl.className    = 'ae-status running';

  let stepIdx = 0;
  let totalScore = 0;
  const stepResults = [];

  const stepData = [
    { ok: true,            label: 'Docs uploaded & hashed',   state: '✓ Done'         },
    { ok: true,            label: 'Text extracted via OCR',    state: '✓ Extracted'    },
    { ok: true,            label: 'Identity verified',         state: '✓ Matched'      },
    { ok: Math.random()>.15, label: 'Forgery check complete', state: null             },
    { ok: true,            label: 'No duplicates found',       state: '✓ Unique'       },
    { ok: Math.random()>.2, label: 'Income validated',         state: null             },
    { ok: true,            label: 'Anchored on Algorand',      state: '✓ On-Chain'     },
  ];
  stepData[3].state = stepData[3].ok ? '✓ Authentic' : '⚠ Flagged';
  stepData[5].state = stepData[5].ok ? '✓ Valid'     : '⚠ Anomaly';

  const weights = [10, 15, 20, 20, 15, 10, 10];

  function runNextStep() {
    if (stepIdx >= PIPELINE_STEPS.length) {
      finishVerification(totalScore, stepData);
      return;
    }
    const step = PIPELINE_STEPS[stepIdx];
    const data = stepData[stepIdx];
    const pct  = Math.round((stepIdx / PIPELINE_STEPS.length) * 100);

    // Set previous as done
    if (stepIdx > 0) {
      const prev = document.getElementById(PIPELINE_STEPS[stepIdx-1].id);
      prev?.classList.remove('active');
      prev?.classList.add(stepData[stepIdx-1].ok ? 'done' : 'error');
      prev.querySelector('.ps-state').textContent = stepData[stepIdx-1].state;
    }

    const cur = document.getElementById(step.id);
    cur?.classList.add('active');
    cur.querySelector('.ps-state').textContent = '⏳ Running…';
    fillEl.style.width = pct + '%';
    labelEl.textContent = data.label;

    if (data.ok) totalScore += weights[stepIdx];
    stepResults.push(data);

    stepIdx++;
    setTimeout(runNextStep, 700 + Math.random() * 400);
  }

  setTimeout(runNextStep, 300);
}

function finishVerification(score, steps) {
  const fillEl     = document.getElementById('aeProgressFill');
  const labelEl    = document.getElementById('aeProgressLabel');
  const statusEl   = document.getElementById('aeStatus');
  const resultEl   = document.getElementById('aeResult');

  // Mark last step done
  const lastStep = document.getElementById(PIPELINE_STEPS[PIPELINE_STEPS.length-1].id);
  lastStep?.classList.remove('active');
  lastStep?.classList.add(steps[steps.length-1].ok ? 'done' : 'error');
  lastStep.querySelector('.ps-state').textContent = steps[steps.length-1].state;

  fillEl.style.width = '100%';
  labelEl.textContent = score >= 70 ? '✅ Verification Complete' : '⚠ Verification Flagged';
  statusEl.textContent = score >= 70 ? 'Complete' : 'Flagged';
  statusEl.className   = 'ae-status ' + (score >= 70 ? 'complete' : 'failed');

  resultEl.style.display = 'block';

  // Animate score ring
  const ringFill = document.getElementById('ringFill');
  const ringScore = document.getElementById('ringScore');
  const circumference = 2 * Math.PI * 50;
  const targetDash = (score / 100) * circumference;
  ringScore.textContent = score;

  const colorMap = score >= 80 ? '#00E8C6' : score >= 60 ? '#F59E0B' : '#EF4444';
  ringFill.style.stroke = colorMap;

  let current = 0;
  const interval = setInterval(() => {
    current += 4;
    if (current >= targetDash) { current = targetDash; clearInterval(interval); }
    ringFill.setAttribute('stroke-dasharray', `${current} ${circumference}`);
  }, 20);

  // Details
  const details = [
    { label:'Document Authenticity', val: steps[3].ok ? 'Authentic' : 'Forgery Detected', ok: steps[3].ok },
    { label:'Identity Match',        val: 'Confirmed',     ok: true },
    { label:'Duplicate Check',       val: 'No Duplicates', ok: true },
    { label:'Income Validation',     val: steps[5].ok ? 'Valid' : 'Anomaly Found', ok: steps[5].ok },
    { label:'Blockchain Proof',      val: 'Anchored',      ok: true },
  ];
  document.getElementById('aerDetails').innerHTML = details.map(d => `
    <div class="aerd-item">
      <span class="aerd-label">${d.label}</span>
      <span class="aerd-val ${d.ok ? 'ok' : 'warn'}">${d.val}</span>
    </div>
  `).join('');

  // Hash
  const fakeHash = '0x' + Array.from({length:40}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();
  document.getElementById('aerHash').innerHTML = `
    <span>Verification Hash (Algorand Tx)</span>
    ${fakeHash}
  `;

  // Actions
  document.getElementById('aerActions').innerHTML = score >= 70 ? `
    <button class="btn-primary" onclick="downloadProof('${fakeHash}')">⬇ Download Proof</button>
    <button class="btn-outline-accent" onclick="alert('Result anchored on Algorand.\\nTx: ${fakeHash}')">🔗 View On-Chain</button>
  ` : `
    <button class="btn-primary" style="background:var(--warn);color:#000" onclick="alert('Re-upload corrected documents and try again.')">🔄 Re-Verify</button>
  `;
}

function downloadProof(hash) {
  alert(`Proof Certificate Downloaded\n\nTrust Score: ${document.getElementById('ringScore').textContent}/100\nTransaction: ${hash}\nNetwork: Algorand MainNet\n\nIn production, this generates a signed PDF.`);
}

/* ── INIT ── */
window.addEventListener('DOMContentLoaded', () => {
  renderPipeline();
  renderFraudPatterns();
});
