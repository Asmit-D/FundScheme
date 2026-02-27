import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import ThemeToggle from '../components/ThemeToggle'
import { SCHEMES, MY_APPLICATIONS } from '../data/dashboardData'
import {
  makePeraSigner,
  optInToApp,
  registerStudent,
  getStudentState,
  isOptedIn,
  APP_ID,
} from '../lib/scholarship-contract'
import { loadAddress } from '../lib/perawallet'
import {
  registerSchemeApplicant,
  optInToSchemeToken,
  getBeneficiarySchemeStatus,
  getCachedSchemes,
  BENEFICIARY_STATUS,
  getBeneficiaryStatusLabel,
} from '../lib/scheme-service'
import {
  isOptedInToToken,
} from '../lib/fund-token'

const TABS = [
  { id:'overview',     icon:'📊', label:'My Overview' },
  { id:'browse',       icon:'🔍', label:'Browse Schemes' },
  { id:'applications', icon:'📝', label:'My Applications' },
  { id:'onchain',      icon:'⛓️', label:'On-Chain Status' },
  { id:'verify',       icon:'🤖', label:'AI Verify Me' },
]

const TIMELINE = [
  { icon:'✅', title:'Application Submitted', desc:'AICTE Pragati Scholarship — APP-2026-000478', time:'Feb 03, 2026', state:'done' },
  { icon:'✅', title:'AI Verification Passed', desc:'Score: 88/100 — Identity, documents, income all cleared', time:'Feb 03, 2026', state:'done' },
  { icon:'✅', title:'Gov Officer Approved', desc:'Approved by Sr. Officer Rajiv Sharma (OFF-001)', time:'Feb 06, 2026', state:'done' },
  { icon:'✅', title:'Token Minted On-Chain', desc:'Asset ID 78812341 · Block 31198432 · Algorand TestNet', time:'Feb 08, 2026', state:'done' },
  { icon:'⏳', title:'Token Distributed to Wallet', desc:'Awaiting final distribution batch — BATCH-2026-0021', time:'Pending', state:'pending' },
]

const AI_STEPS = [
  { icon:'📤', label:'Document Upload', desc:'Upload Aadhaar, Marksheet, Income Certificate, Bank Statement' },
  { icon:'🔍', label:'OCR Extraction', desc:'AI extracts and parses all text from uploaded documents' },
  { icon:'🪪', label:'Identity Cross-Reference', desc:'Aadhaar data cross-referenced with UIDAI database' },
  { icon:'🖼️', label:'Forgery Detection', desc:'ML model scans for pixel manipulation, metadata anomalies' },
  { icon:'📋', label:'Duplicate Check', desc:'Vector DB search for duplicate identities across all applications' },
  { icon:'💰', label:'Income Validation', desc:'Stated income verified against PAN/ITR records' },
  { icon:'⛓️', label:'On-Chain Anchoring', desc:'Verification hash anchored immutably to blockchain' },
]

function TrustGauge({ score = 87 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    c.width = 200; c.height = 120
    const cx=100, cy=108, r=80
    ctx.clearRect(0,0,200,120)
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,2*Math.PI); ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=12; ctx.stroke()
    const end = Math.PI + (score/100)*Math.PI
    const g = ctx.createLinearGradient(0,0,200,0)
    g.addColorStop(0,'#EF4444'); g.addColorStop(.5,'#FBBF24'); g.addColorStop(1,'#818CF8')
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,end); ctx.strokeStyle=g; ctx.lineWidth=12; ctx.lineCap='round'; ctx.stroke()
  }, [score])
  return (
    <div className="trust-gauge">
      <div className="gauge-wrap">
        <canvas ref={canvasRef} style={{ display:'block' }} />
        <div className="gauge-val" style={{ bottom:'8px' }}>{score}<span>/100</span></div>
      </div>
    </div>
  )
}

export default function UserDashboard() {
  const [tab, setTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024)
  const [browseFilter, setBrowseFilter] = useState('')
  const [applyModal, setApplyModal] = useState(null)
  const [verifyRunning, setVerifyRunning] = useState(false)
  const [verifyStep, setVerifyStep] = useState(-1)
  const [verifyDone, setVerifyDone] = useState(false)

  // ── Contract state ──────────────────────────────────────
  const [chainStatus,   setChainStatus]   = useState(null)   // { isRegistered, milestoneCompleted, hasBeenPaid }
  const [chainOptedIn,  setChainOptedIn]  = useState(false)
  const [chainLoading,  setChainLoading]  = useState(false)
  const [chainError,    setChainError]    = useState(null)
  const [chainTx,       setChainTx]       = useState(null)
  const [chainAction,   setChainAction]   = useState(null)

  // ── Scheme Registration State ───────────────────────────
  const [applyingScheme, setApplyingScheme] = useState(false)
  const [applyError, setApplyError] = useState(null)
  const [applySuccess, setApplySuccess] = useState(null)
  const [onChainSchemes, setOnChainSchemes] = useState([])
  const [schemeStatuses, setSchemeStatuses] = useState({})
  const [tokenRegistering, setTokenRegistering] = useState(false)

  const refreshChainStatus = useCallback(async (addr) => {
    setChainLoading(true)
    setChainError(null)
    try {
      const opted = await isOptedIn(addr)
      setChainOptedIn(opted)
      if (opted) {
        const s = await getStudentState(addr)
        setChainStatus(s)
      } else {
        setChainStatus(null)
      }
    } catch (e) {
      setChainError(e.message ?? 'Failed to load on-chain status')
    } finally {
      setChainLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'onchain') {
      const addr = loadAddress()
      if (addr) refreshChainStatus(addr)
      else setChainError('Connect your wallet (◎ Wallet) first.')
    }
  }, [tab, refreshChainStatus])

  const runChainAction = async (label, fn) => {
    const addr = loadAddress()
    if (!addr) { setChainError('Connect your wallet (◎ Wallet) first.'); return }
    setChainAction(label)
    setChainError(null)
    setChainTx(null)
    try {
      const signer = makePeraSigner(addr)
      const { txID } = await fn(addr, signer)
      setChainTx(txID)
      await refreshChainStatus(addr)
    } catch (e) {
      setChainError(
        e?.message?.includes('rejected') ? 'Transaction rejected in Pera Wallet.'
        : e?.message?.includes('Already opted in') ? 'Already opted in to this app.'
        : (e?.message ?? 'Transaction failed')
      )
    } finally {
      setChainAction(null)
    }
  }

  // ── Scheme Application Handler ──────────────────────────
  const handleApplyScheme = async (scheme, formData) => {
    const addr = loadAddress()
    if (!addr) {
      setApplyError('Please connect your wallet first via ◎ Wallet')
      return
    }

    setApplyingScheme(true)
    setApplyError(null)
    setApplySuccess(null)

    try {
      // If scheme has an on-chain ID, register on the blockchain
      if (scheme.onChainId) {
        const result = await registerSchemeApplicant(BigInt(scheme.onChainId), addr)
        if (!result.success) {
          setApplyError(result.error)
          return
        }
        setApplySuccess({
          message: 'Application submitted on-chain!',
          txID: result.txID,
          schemeName: scheme.name,
        })
      } else {
        // Traditional off-chain application
        setApplySuccess({
          message: 'Application submitted! AI verification will begin automatically.',
          schemeName: scheme.name,
        })
      }

      // Close modal after 2 seconds
      setTimeout(() => {
        setApplyModal(null)
        setApplySuccess(null)
      }, 2500)

    } catch (err) {
      setApplyError(err.message || 'Failed to submit application')
    } finally {
      setApplyingScheme(false)
    }
  }

  // ── Token Opt-in Handler ────────────────────────────────
  const handleTokenOptIn = async (assetId) => {
    const addr = loadAddress()
    if (!addr) {
      setChainError('Please connect your wallet first')
      return
    }

    setTokenRegistering(true)
    try {
      const alreadyOptedIn = await isOptedInToToken(addr, assetId)
      if (alreadyOptedIn) {
        setChainError('Already opted into this token')
        return
      }

      const result = await optInToSchemeToken(assetId)
      if (result.success) {
        setChainTx(result.txID)
      } else {
        setChainError(result.error)
      }
    } catch (err) {
      setChainError(err.message || 'Failed to opt-in to token')
    } finally {
      setTokenRegistering(false)
    }
  }
  const navigate = useNavigate()

  const filteredSchemes = SCHEMES.filter(s =>
    s.status === 'active' && (!browseFilter || s.name.toLowerCase().includes(browseFilter.toLowerCase()))
  )

  const runVerify = () => {
    setVerifyRunning(true); setVerifyDone(false); setVerifyStep(0)
    let i = 0
    const iv = setInterval(() => {
      i++
      setVerifyStep(i)
      if (i >= AI_STEPS.length) { clearInterval(iv); setVerifyDone(true); setVerifyRunning(false) }
    }, 900)
  }

  return (
    <div className="dash-body">
      <Sidebar
        role="user"
        tabs={TABS}
        activeTab={tab}
        onTabChange={id => { setTab(id); if (window.innerWidth <= 1024) setSidebarOpen(false) }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="dash-main">
        {/* TOPBAR */}
        <div className="dash-topbar">
          <div className="topbar-left">
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(o=>!o)}>☰</button>
            <span className="topbar-title">Citizen Portal</span>
          </div>
          <div className="topbar-right">
            <div className="verify-status"><span className="chain-dot"></span>AI Verified</div>
            <button
              onClick={() => navigate('/wallet')}
              style={{ background:'rgba(129,140,248,.12)', color:'var(--accent)', border:'1px solid rgba(129,140,248,.3)', borderRadius:'7px', padding:'.38rem .85rem', fontSize:'.82rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'.35rem', whiteSpace:'nowrap' }}
            >
              ◎ Wallet
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="tab-content active">
            <div className="dash-welcome">
              <div>
                <h1>Welcome back, Priya 👋</h1>
                <p>Your AICTE Pragati token is minted — distribution pending batch 0021.</p>
              </div>
              <span className="welcome-date">STU-2026-0554</span>
            </div>
            <div className="kpi-grid">
              {[
                { label:'Active Applications', val:'3',         icon:'📝', cls:'kpi-accent' },
                { label:'Tokens Received',     val:'2',         icon:'💎', cls:'' },
                { label:'Total Scholarship',   val:'₹62,000',   icon:'💰', cls:'' },
                { label:'AI Trust Score',      val:'88/100',    icon:'🛡️', cls:'kpi-accent' },
                { label:'Pending Distribution',val:'1 token',   icon:'⏳', cls:'kpi-warn' },
                { label:'Amount Redeemable',   val:'₹62,000',   icon:'✅', cls:'' },
              ].map(k => (
                <div key={k.label} className={`kpi-card${k.cls?' '+k.cls:''}`}>
                  <div className="kpi-top">
                    <span className="kpi-label">{k.label}</span>
                    <span className="kpi-icon">{k.icon}</span>
                  </div>
                  <span className="kpi-val">{k.val}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:'1.4rem' }}>
              <div className="table-card" style={{ padding:'1.6rem' }}>
                <span className="chart-title">Application Timeline</span>
                <div className="timeline">
                  {TIMELINE.map(t => (
                    <div key={t.title} className="tl-item">
                      <div className={`tl-dot ${t.state}`}>{t.icon}</div>
                      <div>
                        <div className="tl-title">{t.title}</div>
                        <div className="tl-desc">{t.desc}</div>
                        <div className="tl-time">{t.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="table-card" style={{ padding:'1.6rem', textAlign:'center' }}>
                <span className="chart-title">Trust Score</span>
                <TrustGauge score={88} />
                <div className="gauge-checks" style={{ marginTop:'1rem' }}>
                  {[
                    { label:'Identity',    val:'Aadhaar Verified', ok:true },
                    { label:'Documents',  val:'Authentic (OCR 96%)', ok:true },
                    { label:'Income',     val:'₹4.2L — Confirmed', ok:true },
                    { label:'Duplicates', val:'None Found', ok:true },
                    { label:'Bank A/C',   val:'HDFC XXXX-4821', ok:true },
                    { label:'Eligibility',val:'AICTE Accredited ✓', ok:true },
                  ].map(g => (
                    <div key={g.label} className="gc-item">
                      <span className="gc-label">{g.label}</span>
                      <span className={`gc-val ${g.ok?'ok':'warn'}`}>{g.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BROWSE */}
        {tab === 'browse' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div><h2>Browse Schemes</h2><p>Find and apply for government scholarships.</p></div>
            </div>
            <div className="filter-bar">
              <input
                className="filter-input"
                placeholder="Search schemes…"
                value={browseFilter}
                onChange={e => setBrowseFilter(e.target.value)}
              />
              <select className="filter-select">
                <option>All Categories</option>
                <option>Merit</option>
                <option>Need-Based</option>
              </select>
            </div>
            <div className="schemes-grid">
              {filteredSchemes.map(s => (
                <div key={s.id} className="scheme-card">
                  <div className="sc-header">
                    <span className="sc-title">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="sc-body">{s.criteria}</p>
                  <div className="sc-meta">
                    <span>🏛️ {s.ministry || s.cat}</span>
                    <span>💰 ₹{s.amount.toLocaleString()}/student</span>
                    <span>👥 {s.benef.toLocaleString()} beneficiaries</span>
                    <span>📅 {s.deadline}</span>
                  </div>
                  <div className="sc-footer">
                    <div className="sc-progress">
                      <div className="sc-progress-bar">
                        <div className="sc-progress-fill" style={{ width:`${s.filled}%` }}></div>
                      </div>
                      <span className="sc-pct">{s.filled}% filled</span>
                    </div>
                    <button className="btn-sm btn-approve" onClick={() => setApplyModal(s)}>
                      Apply →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MY APPLICATIONS */}
        {tab === 'applications' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div><h2>My Applications</h2><p>Track your scholarship applications.</p></div>
            </div>
            <div className="apps-list">
              {MY_APPLICATIONS.map(a => (
                <div key={a.id} className="my-app-card">
                  <div>
                    <div className="mac-scheme">{a.scheme}</div>
                    <div className="mac-date">{a.date}</div>
                  </div>
                  <StatusBadge status={a.status} />
                  <div className="mac-amount">₹{a.amount.toLocaleString()}</div>
                  <button className="btn-sm btn-view">View Details</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MY TOKENS */}
        {tab === 'onchain' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div>
                <h2>⛓️ On-Chain Status</h2>
                <p>Your status on the ScholarshipTreasury smart contract · App ID: <strong>{APP_ID}</strong></p>
              </div>
              <button
                className="btn-sm btn-view"
                onClick={() => { const a = loadAddress(); if (a) refreshChainStatus(a) }}
                disabled={chainLoading}
              >
                {chainLoading ? '↻ Loading…' : '↻ Refresh'}
              </button>
            </div>

            {chainTx && (
              <div style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', borderRadius:'10px', padding:'.75rem 1rem', marginBottom:'1rem', color:'#10b981', fontSize:'.88rem' }}>
                ✅ Transaction confirmed!&nbsp;&nbsp;
                <a href={`https://testnet.algoexplorer.io/tx/${chainTx}`} target="_blank" rel="noreferrer" style={{color:'#10b981',fontWeight:600}}>View on AlgoExplorer ↗</a>
              </div>
            )}
            {chainError && (
              <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'10px', padding:'.75rem 1rem', marginBottom:'1rem', color:'#ef4444', fontSize:'.88rem' }}>
                ❌ {chainError}
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
              {/* Status panel */}
              <div className="table-card" style={{ padding:'1.5rem' }}>
                <h3 style={{ marginBottom:'1.2rem', fontSize:'1rem' }}>Your Contract Status</h3>
                {!chainOptedIn ? (
                  <div style={{ color:'var(--text-2)', fontSize:'.9rem', marginBottom:'1rem' }}>
                    You have not opted in to this app yet.<br/>Step 1 below to get started.
                  </div>
                ) : chainStatus ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:'.6rem', marginBottom:'1.2rem' }}>
                    {[
                      { label:'Opted In',        ok: true },
                      { label:'Registered',       ok: chainStatus.isRegistered },
                      { label:'Milestone Done',   ok: chainStatus.milestoneCompleted },
                      { label:'Payout Released',  ok: chainStatus.hasBeenPaid },
                    ].map(s => (
                      <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'.5rem .85rem', background:'var(--bg)', borderRadius:'9px', border:'1px solid var(--border-2)' }}>
                        <span style={{ color:'var(--text-2)', fontSize:'.88rem' }}>{s.label}</span>
                        <span style={{ color: s.ok ? '#10b981' : '#94a3b8', fontWeight:700, fontSize:'.88rem' }}>{s.ok ? '✔ Yes' : '✗ No'}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* How-it-works flow */}
                {chainStatus?.hasBeenPaid && (
                  <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.25)', borderRadius:'10px', padding:'1rem', textAlign:'center', color:'#10b981', fontWeight:700, fontSize:'.9rem' }}>
                    🎉 Scholarship payout has been sent to your wallet!
                  </div>
                )}
              </div>

              {/* Action panel */}
              <div className="table-card" style={{ padding:'1.5rem' }}>
                <h3 style={{ marginBottom:'1.2rem', fontSize:'1rem' }}>Student Actions</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:'.85rem' }}>

                  {/* Step 1: Opt in */}
                  <div>
                    <div style={{ fontSize:'.78rem', color:'var(--text-2)', marginBottom:'.4rem', letterSpacing:'.04em', textTransform:'uppercase' }}>Step 1 — Opt In to App</div>
                    <button
                      className="btn-primary w-full"
                      disabled={!!chainAction || chainOptedIn}
                      onClick={() => runChainAction('Opting in…', (addr, signer) => optInToApp(addr, signer))}
                    >
                      {chainAction === 'Opting in…' ? chainAction : chainOptedIn ? '✔ Already Opted In' : '🔐 Opt In to ScholarshipTreasury'}
                    </button>
                  </div>

                  {/* Step 2: Register */}
                  <div>
                    <div style={{ fontSize:'.78rem', color:'var(--text-2)', marginBottom:'.4rem', letterSpacing:'.04em', textTransform:'uppercase' }}>Step 2 — Register as Student</div>
                    <button
                      className="btn-primary w-full"
                      disabled={!!chainAction || !chainOptedIn || chainStatus?.isRegistered}
                      onClick={() => runChainAction('Registering…', (addr, signer) => registerStudent(addr, signer))}
                    >
                      {chainAction === 'Registering…' ? chainAction : chainStatus?.isRegistered ? '✔ Already Registered' : '📝 Register Student'}
                    </button>
                  </div>

                  {/* Step 3+: waiting for authority */}
                  {chainOptedIn && chainStatus?.isRegistered && !chainStatus?.milestoneCompleted && (
                    <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'10px', padding:'.85rem 1rem', color:'#f59e0b', fontSize:'.85rem', lineHeight:1.6 }}>
                      ⏳ <strong>Awaiting milestone validation</strong><br/>
                      The authority wallet must call <code>mark_milestone_complete</code> for your address before payout can be released.
                    </div>
                  )}
                  {chainStatus?.milestoneCompleted && !chainStatus?.hasBeenPaid && (
                    <div style={{ background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.25)', borderRadius:'10px', padding:'.85rem 1rem', color:'#60a5fa', fontSize:'.85rem', lineHeight:1.6 }}>
                      ✅ Milestone verified! <strong>Awaiting officer payout call</strong> — <code>release_payout</code> will send ALGO to your wallet via inner transaction.
                    </div>
                  )}

                  <p style={{ fontSize:'.78rem', color:'var(--text-3)', lineHeight:1.6, margin:0 }}>
                    Connect your Algorand wallet via <strong>◎ Wallet</strong> before performing any on-chain action.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI VERIFY */}
        {tab === 'verify' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div><h2>AI Verify Me</h2><p>Run your identity through the 7-step AI pipeline.</p></div>
            </div>
            <div className="ai-verify-layout">
              <div className="verify-steps-card">
                <h3>Verification Pipeline</h3>
                <div className="vsteps">
                  {AI_STEPS.map((s, i) => (
                    <div
                      key={s.label}
                      className={`vstep${verifyStep > i ? ' done' : verifyStep === i ? ' active' : ''}`}
                    >
                      <span className="vstep-icon">{verifyStep > i ? '✅' : s.icon}</span>
                      <div>
                        <div className="vstep-title">{s.label}</div>
                        <div className="vstep-desc">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {!verifyRunning && !verifyDone && (
                  <button className="btn-primary w-full" style={{ marginTop:'1.2rem' }} onClick={runVerify}>
                    🤖 Start AI Verification
                  </button>
                )}
                {verifyRunning && (
                  <div style={{ textAlign:'center', marginTop:'1rem', color:'var(--accent)' }}>
                    Processing step {verifyStep + 1} of {AI_STEPS.length}…
                  </div>
                )}
              </div>
              <div className="verify-progress-card">
                <h3>Verification Status</h3>
                {verifyDone ? (
                  <>
                    <TrustGauge score={87} />
                    <div className="verify-result success" style={{ marginTop:'1rem' }}>
                      ✅ Verification Passed — Score: 87/100
                    </div>
                    <div style={{ fontSize:'.78rem', color:'var(--text-2)', marginTop:'.8rem', lineHeight:1.6 }}>
                      Your identity has been verified on-chain.<br/>
                      <span style={{ color:'var(--accent)', fontFamily:'monospace' }}>
                        TX: 0x{Math.random().toString(16).slice(2,18).toUpperCase()}
                      </span>
                    </div>
                    <button
                      className="btn-primary w-full"
                      style={{ marginTop:'1rem' }}
                      onClick={() => navigate('/ai-verify')}
                    >
                      View Full AI Report →
                    </button>
                  </>
                ) : (
                  <div style={{ color:'var(--text-2)', fontSize:'.9rem', paddingTop:'1rem' }}>
                    Click "Start AI Verification" to run the full pipeline on your documents.
                    <br/><br/>
                    You'll need: Aadhaar, Marksheet, Income Certificate, Bank Statement.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* APPLY MODAL */}
      {applyModal && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget && !applyingScheme && setApplyModal(null)}>
          <div className="modal-box" style={{ maxWidth:'540px' }}>
            <button className="modal-close" onClick={() => !applyingScheme && setApplyModal(null)} disabled={applyingScheme}>✕</button>
            <div className="modal-title">Apply — {applyModal.name}</div>
            <div className="modal-sub">Amount: ₹{applyModal.amount?.toLocaleString()} · Deadline: {applyModal.deadline}</div>

            {/* Success Message */}
            {applySuccess && (
              <div style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.3)', borderRadius:'10px', padding:'1rem', marginBottom:'1rem', color:'#10b981' }}>
                <div style={{ fontWeight:600, marginBottom:'.3rem' }}>✅ {applySuccess.message}</div>
                {applySuccess.txID && (
                  <a href={`https://testnet.algoexplorer.io/tx/${applySuccess.txID}`} target="_blank" rel="noreferrer" style={{ color:'#10b981', fontSize:'.85rem' }}>
                    View transaction on AlgoExplorer ↗
                  </a>
                )}
              </div>
            )}

            {/* Error Message */}
            {applyError && (
              <div style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', borderRadius:'10px', padding:'1rem', marginBottom:'1rem', color:'#ef4444', fontSize:'.9rem' }}>
                ❌ {applyError}
              </div>
            )}

            <div className="modal-form">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" id="applyName" defaultValue="Priya Kumari" disabled={applyingScheme} />
              </div>
              <div className="form-group">
                <label>Student ID</label>
                <input type="text" id="applyStudentId" defaultValue="STU-2026-0042" disabled={applyingScheme} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Institution</label>
                  <input type="text" id="applyInst" placeholder="Your college/school" disabled={applyingScheme} />
                </div>
                <div className="form-group">
                  <label>Course</label>
                  <input type="text" id="applyCourse" placeholder="e.g. B.Tech CSE" disabled={applyingScheme} />
                </div>
              </div>
              <div className="form-group">
                <label>Family Annual Income (₹)</label>
                <input type="number" id="applyIncome" placeholder="Enter annual family income" disabled={applyingScheme} />
              </div>

              {/* On-chain registration info */}
              <div style={{ background:'rgba(99,102,241,.08)', borderRadius:'10px', padding:'.85rem 1rem', marginBottom:'1rem', fontSize:'.85rem', lineHeight:1.6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.4rem' }}>
                  <span>⛓️</span>
                  <strong>On-Chain Registration</strong>
                </div>
                <div style={{ color:'var(--text-2)' }}>
                  Your application will be registered on the Algorand blockchain for transparency. 
                  You'll need to sign the transaction with Pera Wallet.
                </div>
              </div>

              <div style={{ display:'flex', gap:'.75rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex:1 }}
                  onClick={() => handleApplyScheme(applyModal, {
                    name: document.getElementById('applyName')?.value,
                    studentId: document.getElementById('applyStudentId')?.value,
                    institution: document.getElementById('applyInst')?.value,
                    course: document.getElementById('applyCourse')?.value,
                    income: document.getElementById('applyIncome')?.value,
                  })}
                  disabled={applyingScheme}
                >
                  {applyingScheme ? (
                    <>⏳ Submitting...</>
                  ) : (
                    <>📝 Submit & Register On-Chain</>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-sm btn-view"
                  style={{ padding:'.6rem 1rem' }}
                  onClick={() => setApplyModal(null)}
                  disabled={applyingScheme}
                >
                  Cancel
                </button>
              </div>

              <div style={{ marginTop:'.85rem', fontSize:'.75rem', color:'var(--text-3)', lineHeight:1.5 }}>
                By submitting, you consent to AI verification of your documents. 
                Your application will be visible on the blockchain for transparency.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
