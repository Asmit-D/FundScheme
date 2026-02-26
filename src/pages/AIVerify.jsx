import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

const PIPELINE = [
  { icon:'📤', label:'Upload Hash & Metadata',     desc:'Generating unique document fingerprints' },
  { icon:'🔍', label:'OCR Text Extraction',         desc:'Parsing fields from uploaded documents' },
  { icon:'🪪', label:'Identity Cross-Reference',    desc:'Matching against UIDAI & state databases' },
  { icon:'🖼️', label:'Forgery Detection',           desc:'ML pixel-level image integrity scan' },
  { icon:'📋', label:'Duplicate Check',             desc:'Vector DB similarity search across all applications' },
  { icon:'💰', label:'Income Validation',           desc:'Cross-referencing PAN / ITR data' },
  { icon:'⛓️', label:'On-Chain Anchoring',          desc:'Writing verification proof to blockchain' },
]

const FRAUD_PATTERNS = [
  { icon:'👥', title:'Identity Cloning', desc:'Same Aadhaar linked to multiple student profiles — caught by vector fingerprint comparison.', risk:'high' },
  { icon:'📄', title:'Document Forgery', desc:'Pixel metadata inconsistencies in income certificates — detected by GAN-based forensics model.', risk:'high' },
  { icon:'♻️', title:'Duplicate Application', desc:'Same student applies to multiple overlapping schemes — caught by semantic similarity search.', risk:'med' },
  { icon:'💳', title:'Third-Party Bank', desc:'Bank account PAN mismatch with student identity — caught by cross-reference validator.', risk:'high' },
  { icon:'📊', title:'Income Manipulation', desc:'Stated income inconsistent with property/ITR data — flagged by income anomaly detector.', risk:'med' },
  { icon:'♀️', title:'Category Fraud', desc:'Gender or caste mismatch between application and institutional records.', risk:'low' },
]

const HOW_IT_WORKS = [
  { icon:'📄', title:'Document Upload', desc:'Submit Aadhaar, marksheet, income certificate, and bank statement through encrypted upload zones.' },
  { icon:'🔍', title:'OCR Extraction', desc:'Computer vision extracts text, numbers, and metadata from each document with 99.2% accuracy.' },
  { icon:'🪪', title:'Identity Fusion', desc:'Name, DOB, address, and biometric data fused and cross-referenced against 3 government databases.' },
  { icon:'🤖', title:'ML Forgery Scan', desc:'Generative adversarial network detects pixel-level manipulations invisible to the human eye.' },
  { icon:'📋', title:'Duplicate Detection', desc:'FAISS vector similarity search across 2.4M student records to catch re-submissions.' },
  { icon:'⛓️', title:'Blockchain Anchoring', desc:'SHA-256 hash of the verification result written permanently to the public ledger.' },
]

export default function AIVerify() {
  const navigate = useNavigate()
  const [uploads, setUploads] = useState({ aadhaar:false, marksheet:false, income:false, bank:false })
  const [formData, setFormData] = useState({ name:'', id:'', dob:'', income:'' })
  const [pipelineStep, setPipelineStep] = useState(-1)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState(0)
  const [txHash] = useState(() => '0x' + Array.from({length:40}, () => '0123456789ABCDEF'[Math.floor(Math.random()*16)]).join(''))
  const ringRef = useRef(null)

  // ── Aadhaar Verification State ──
  const [aadhaarNum, setAadhaarNum] = useState('')
  const [otpVal, setOtpVal] = useState('')
  const [aadhaarStep, setAadhaarStep] = useState('idle')   // idle | sending | otp | verifying | success | fail
  const [aadhaarMsg, setAadhaarMsg]   = useState('')
  const [otpTimer, setOtpTimer]       = useState(0)

  const formatAadhaar = (v) => v.replace(/\D/g,'').slice(0,12).replace(/(\d{4})(\d{4})?(\d{4})?/, (_,a,b,c) => [a,b,c].filter(Boolean).join(' '))

  const sendOTP = () => {
    const digits = aadhaarNum.replace(/\s/g,'')
    if (digits.length !== 12) { setAadhaarMsg('Please enter a valid 12-digit Aadhaar number.'); return }
    setAadhaarStep('sending'); setAadhaarMsg('')
    setTimeout(() => {
      setAadhaarStep('otp')
      setAadhaarMsg(`OTP sent to mobile linked with Aadhaar …${digits.slice(-4)}`)
      let t = 30
      setOtpTimer(t)
      const iv = setInterval(() => { t--; setOtpTimer(t); if (t <= 0) clearInterval(iv) }, 1000)
    }, 1400)
  }

  const verifyOTP = () => {
    setAadhaarStep('verifying'); setAadhaarMsg('')
    setTimeout(() => {
      if (otpVal === '123456' || otpVal.length === 6) {
        setAadhaarStep('success')
        setAadhaarMsg('Aadhaar identity verified successfully. Linked to this session.')
        setUploads(u => ({ ...u, aadhaar: true }))
      } else {
        setAadhaarStep('fail')
        setAadhaarMsg('OTP mismatch. Please try again.')
      }
    }, 1600)
  }

  const handleUpload = (doc) => setUploads(u => ({ ...u, [doc]: true }))

  const startVerification = () => {
    if (!formData.name) { alert('Please fill in your details.'); return }
    setRunning(true); setDone(false); setPipelineStep(0); setScore(0)
    let i = 0
    const iv = setInterval(() => {
      i++
      setPipelineStep(i)
      if (i >= PIPELINE.length) {
        clearInterval(iv)
        setRunning(false)
        setDone(true)
        animateScore(87)
      }
    }, 900)
  }

  const animateScore = (target) => {
    let cur = 0
    const iv = setInterval(() => {
      cur = Math.min(cur + 2, target)
      setScore(cur)
      if (cur >= target) clearInterval(iv)
    }, 30)
  }

  const circumference = 2 * Math.PI * 48
  const dashArray = done ? `${(score / 100) * circumference} ${circumference}` : `0 ${circumference}`

  return (
    <div className="ai-page">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="nav-brand" style={{ cursor:'pointer' }} onClick={() => navigate('/')}>
            <span className="brand-icon">⚡</span>ExpressScheme
          </div>
          <div className="nav-links">
            <span style={{ cursor:'pointer', color:'var(--text-2)' }} onClick={() => navigate('/user-dashboard')}>← Back to Dashboard</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* HERO */}
      <div className="ai-hero">
        <div className="ai-hero-inner">
          <div className="hero-badge"><span className="badge-dot"></span>AI Verification Engine v3.2</div>
          <h1 className="hero-title" style={{ fontSize:'2.4rem' }}>
            7-Layer <span className="gradient-text">AI Identity Verification</span>
          </h1>
          <p style={{ color:'var(--text-2)', maxWidth:'560px', margin:'0 auto' }}>
            Upload your documents, run the AI pipeline, and receive an on-chain verified proof
            of eligibility — all in under 60 seconds.
          </p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="ai-container">
        {/* LEFT — Upload + Form */}
        <div className="ai-upload-panel">
          <h2 className="ai-section-title">Upload Documents</h2>
          <div className="upload-grid">
            {[
              { key:'aadhaar',   icon:'🪪', label:'Aadhaar Card',        sub:'Front & back' },
              { key:'marksheet', icon:'📋', label:'Marksheet / Certificate', sub:'Latest academic' },
              { key:'income',    icon:'💰', label:'Income Certificate',  sub:'Family annual income' },
              { key:'bank',      icon:'🏦', label:'Bank Statement',      sub:'Last 3 months' },
            ].map(d => (
              <div
                key={d.key}
                className={`upload-zone${uploads[d.key] ? ' uploaded' : ''}`}
                onClick={() => handleUpload(d.key)}
              >
                <div className="uz-icon">{uploads[d.key] ? '✅' : d.icon}</div>
                <div className="uz-title">{d.label}</div>
                <div className="uz-sub">{d.sub}</div>
                <span className="uz-status">{uploads[d.key] ? '✓ Uploaded' : 'Click to upload'}</span>
              </div>
            ))}
          </div>

          {/* ── AADHAAR VERIFICATION ── */}
          <div className="aadhaar-verify-card">
            <div className="avc-header">
              <span className="avc-icon">🇮🇳</span>
              <div>
                <div className="avc-title">UIDAI Aadhaar Verification</div>
                <div className="avc-sub">Powered by UIDAI API &mdash; OTP on registered mobile</div>
              </div>
              {aadhaarStep === 'success' && <span className="avc-badge success">✓ Verified</span>}
              {aadhaarStep === 'fail'    && <span className="avc-badge fail">✗ Failed</span>}
            </div>

            {aadhaarStep !== 'success' && (
              <>
                <div className="form-group" style={{ marginTop:'1rem' }}>
                  <label>Aadhaar Number</label>
                  <input
                    className="filter-input aadhaar-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="XXXX XXXX XXXX"
                    maxLength={14}
                    value={aadhaarNum}
                    onChange={e => setAadhaarNum(formatAadhaar(e.target.value))}
                    disabled={aadhaarStep==='otp'||aadhaarStep==='verifying'||aadhaarStep==='sending'}
                  />
                </div>

                {(aadhaarStep==='idle'||aadhaarStep==='sending') && (
                  <button
                    className="btn-primary w-full"
                    style={{ marginTop:'.75rem' }}
                    onClick={sendOTP}
                    disabled={aadhaarStep==='sending'}
                  >
                    {aadhaarStep==='sending' ? '⏳ Sending OTP…' : '📱 Send OTP to Registered Mobile'}
                  </button>
                )}

                {(aadhaarStep==='otp'||aadhaarStep==='verifying') && (
                  <>
                    <div className="form-group" style={{ marginTop:'.75rem' }}>
                      <label>Enter OTP <span style={{ color:'var(--text-3)', fontWeight:400 }}>({otpTimer > 0 ? `Resend in ${otpTimer}s` : <button className="avc-resend" onClick={() => { setAadhaarStep('idle'); setOtpVal('') }}>Resend</button>})</span></label>
                      <input
                        className="filter-input"
                        type="tel"
                        placeholder="6-digit OTP"
                        maxLength={6}
                        value={otpVal}
                        onChange={e => setOtpVal(e.target.value.replace(/\D/g,'').slice(0,6))}
                        disabled={aadhaarStep==='verifying'}
                      />
                    </div>
                    <button
                      className="btn-primary w-full"
                      style={{ marginTop:'.75rem', background:'#16A34A' }}
                      onClick={verifyOTP}
                      disabled={aadhaarStep==='verifying'||otpVal.length<6}
                    >
                      {aadhaarStep==='verifying' ? '⏳ Verifying…' : '✔️ Verify Aadhaar'}
                    </button>
                    <p className="avc-demo-hint">Demo: Enter any 6-digit OTP to verify</p>
                  </>
                )}
              </>
            )}

            {aadhaarStep === 'success' && (
              <div className="avc-success-row">
                <div className="avc-verified-info">
                  <div>👤 <strong>Name:</strong> {formData.name || 'As per Aadhaar'}</div>
                  <div>📅 <strong>Aadhaar:</strong> XXXX XXXX {aadhaarNum.replace(/\s/g,'').slice(-4)}</div>
                  <div>📍 <strong>eKYC Status:</strong> <span style={{ color:'#16A34A' }}>Completed</span></div>
                </div>
              </div>
            )}

            {aadhaarMsg && (
              <p className={`avc-msg ${aadhaarStep==='success'?'ok':aadhaarStep==='fail'?'err':'info'}`}>
                {aadhaarMsg}
              </p>
            )}

            <p className="avc-disclaimer">
              🔒 This interface simulates UIDAI eKYC API integration. In production, OTP is sent to the Aadhaar-registered mobile number via official UIDAI sandbox.
            </p>
          </div>

          <h2 className="ai-section-title" style={{ marginTop:'2rem' }}>Student Details</h2>
          <div className="stu-form">
            <div className="form-group">
              <label>Full Name (as in Aadhaar)</label>
              <input
                className="filter-input"
                type="text"
                placeholder="e.g. Priya Kumari"
                value={formData.name}
                onChange={e => setFormData(f => ({...f, name:e.target.value}))}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Student ID</label>
                <input
                  className="filter-input"
                  type="text"
                  placeholder="STU-2026-XXXX"
                  value={formData.id}
                  onChange={e => setFormData(f => ({...f, id:e.target.value}))}
                />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  className="filter-input"
                  type="date"
                  value={formData.dob}
                  onChange={e => setFormData(f => ({...f, dob:e.target.value}))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Family Annual Income (₹)</label>
              <input
                className="filter-input"
                type="number"
                placeholder="e.g. 250000"
                value={formData.income}
                onChange={e => setFormData(f => ({...f, income:e.target.value}))}
              />
            </div>
            <button className="btn-primary w-full" onClick={startVerification} disabled={running}>
              {running ? '⏳ Verifying…' : '🤖 Run AI Verification'}
            </button>
          </div>
        </div>

        {/* RIGHT — AI Engine */}
        <div className="ai-output-panel">
          <div className="ai-engine-card">
            <div className="ae-header">
              <span className="ae-title">AI Verification Engine</span>
              <span className={`ae-status${running?' running':done?' complete':''}`}>
                {running ? 'Running…' : done ? 'Complete' : 'Idle'}
              </span>
            </div>

            <div className="ae-pipeline">
              {PIPELINE.map((p, i) => (
                <div
                  key={p.label}
                  className={`pipe-step${pipelineStep > i ? ' done' : pipelineStep === i ? ' active' : ''}`}
                >
                  <span className="ps-icon">{pipelineStep > i ? '✅' : p.icon}</span>
                  <span className="ps-label">{p.label}</span>
                  <span className="ps-state">
                    {pipelineStep > i ? 'Done' : pipelineStep === i ? 'Running' : '—'}
                  </span>
                </div>
              ))}
            </div>

            {(running || done) && (
              <div className="ae-progress-wrap">
                <div className="ae-progress-bar">
                  <div
                    className="ae-progress-fill"
                    style={{ width: `${Math.round(((pipelineStep) / PIPELINE.length) * 100)}%` }}
                  ></div>
                </div>
                <span className="ae-progress-label">
                  Step {Math.min(pipelineStep + 1, PIPELINE.length)} of {PIPELINE.length}
                </span>
              </div>
            )}

            {done && (
              <div className="ae-result">
                <div className="aer-score-section">
                  <div className="aer-score-ring">
                    <svg className="ring-svg" viewBox="0 0 120 120">
                      <circle className="ring-bg"   cx="60" cy="60" r="48" />
                      <circle
                        className="ring-fill"
                        cx="60" cy="60" r="48"
                        strokeDasharray={dashArray}
                        strokeDashoffset="0"
                        style={{ transition:'stroke-dasharray 1.5s ease' }}
                      />
                    </svg>
                    <div className="ring-inner">
                      <span className="ring-score">{score}</span>
                      <span className="ring-label">/ 100</span>
                    </div>
                  </div>
                  <div className="aer-details">
                    {[
                      { label:'Identity Match', val:'Verified', cls:'ok' },
                      { label:'Documents', val:'Authentic', cls:'ok' },
                      { label:'Forgery Check', val:'Clean', cls:'ok' },
                      { label:'Duplicates', val:'None', cls:'ok' },
                      { label:'Income', val:'Confirmed', cls:'ok' },
                    ].map(d => (
                      <div key={d.label} className="aerd-item">
                        <span className="aerd-label">{d.label}</span>
                        <span className={`aerd-val ${d.cls}`}>{d.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="aer-hash">
                  <span>On-Chain Tx Hash</span>
                  {txHash}
                </div>
                <div className="aer-actions">
                  <button className="btn-primary" onClick={() => alert('Proof downloaded!')}>⬇ Download Proof</button>
                  <button className="btn-outline-accent" onClick={() => navigate('/user-dashboard')}>← Dashboard</button>
                </div>
              </div>
            )}
          </div>

          <div className="fraud-patterns-card">
            <h3>Fraud Pattern Library</h3>
            <div className="fp-list">
              {FRAUD_PATTERNS.map(p => (
                <div key={p.title} className="fp-item">
                  <span className="fp-icon">{p.icon}</span>
                  <div>
                    <div className="fp-title">{p.title}</div>
                    <div className="fp-desc">{p.desc}</div>
                    <span className={`fp-chip ${p.risk}`}>{p.risk.toUpperCase()} RISK</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HOW AI WORKS */}
      <section className="section section-dark">
        <div className="container">
          <p className="section-label" style={{ textAlign:'center' }}>Under the Hood</p>
          <h2 className="section-title">How the AI Works</h2>
          <div className="ai-how-grid">
            {HOW_IT_WORKS.map(h => (
              <div key={h.title} className="ahg-card">
                <div className="ahg-icon">{h.icon}</div>
                <h4>{h.title}</h4>
                <p>{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
