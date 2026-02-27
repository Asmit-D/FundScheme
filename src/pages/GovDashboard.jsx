import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import ThemeToggle from '../components/ThemeToggle'
import { SCHEMES, APPLICATIONS, AI_FLAGS, TX_DATA, MINTED_HISTORY, REPORTS_DATA } from '../data/dashboardData'
import {
  makePeraSigner,
  markMilestoneComplete,
  releasePayout as contractReleasePayout,
  getGlobalState,
  getStudentState,
  APP_ID,
} from '../lib/scholarship-contract'
import { loadAddress } from '../lib/perawallet'
import {
  createFullScheme,
  activateScheme,
  pauseActiveScheme,
  addFundsToScheme,
  approveSchemeApplicant,
  disburseFunds,
  getSchemeStatistics,
  getCachedSchemes,
  SCHEME_STATUS,
  getSchemeStatusLabel,
  getSchemeStatusColor,
} from '../lib/scheme-service'

const TABS = [
  { id:'overview',     icon:'📊', label:'Overview' },
  { id:'schemes',      icon:'🏛️', label:'Manage Schemes' },
  { id:'blockchain',   icon:'⛓️', label:'Blockchain Ops' },
  { id:'applications', icon:'📝', label:'Applications', badge: 3 },
  { id:'flags',        icon:'🚨', label:'AI Flags', badge: 7 },
  { id:'reports',      icon:'📄', label:'Audit Reports' },
]

function BarChart() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    const data = [17, 36, 49, 64, 39, 77, 83]
    const labels = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb']
    const th = document.documentElement.getAttribute('data-theme')
    const barColor = th === 'light' ? '#4F46E5' : '#818CF8'
    const textColor = th === 'light' ? '#475569' : '#94A3B8'
    c.width = c.offsetWidth; c.height = c.offsetHeight || 180
    ctx.clearRect(0, 0, c.width, c.height)
    const pad = 30, bw = Math.floor((c.width - pad * 2) / data.length) - 8
    data.forEach((v, i) => {
      const x = pad + i * ((c.width - pad * 2) / data.length) + 4
      const h = (v / 100) * (c.height - 40)
      const y = c.height - 20 - h
      ctx.fillStyle = barColor + '22'
      ctx.beginPath()
      ctx.roundRect(x, y, bw, h, 4)
      ctx.fill()
      ctx.fillStyle = barColor
      ctx.beginPath()
      ctx.roundRect(x, c.height - 20 - 4, bw, 4, 2)
      ctx.fill()
      ctx.fillStyle = textColor
      ctx.font = '10px Inter'
      ctx.textAlign = 'center'
      ctx.fillText(labels[i], x + bw/2, c.height - 4)
    })
  }, [])
  return <canvas ref={canvasRef} style={{ width:'100%', height:'180px', display:'block' }} />
}

function DonutChart({ value = 73 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    const th = document.documentElement.getAttribute('data-theme')
    c.width = c.offsetWidth || 160; c.height = c.offsetHeight || 160
    const cx = c.width/2, cy = c.height/2, r = (Math.min(c.width,c.height)/2) - 16
    ctx.clearRect(0,0,c.width,c.height)
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=14; ctx.stroke()
    const start = -Math.PI/2, end = start + (value/100)*Math.PI*2
    const grad = ctx.createLinearGradient(0,0,c.width,c.height)
    grad.addColorStop(0, th==='light'?'#4F46E5':'#818CF8')
    grad.addColorStop(1, '#38BDF8')
    ctx.beginPath(); ctx.arc(cx,cy,r,start,end); ctx.strokeStyle=grad; ctx.lineWidth=14; ctx.lineCap='round'; ctx.stroke()
    ctx.fillStyle = th==='light'?'#0F172A':'#fff'
    ctx.font = 'bold 22px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(value+'%', cx, cy-6)
    ctx.fillStyle = th==='light'?'#475569':'#94A3B8'
    ctx.font = '11px Inter'; ctx.fillText('Utilized',cx,cy+14)
  }, [value])
  return <canvas ref={canvasRef} style={{ width:'160px', height:'160px', display:'block', margin:'0 auto' }} />
}

export default function GovDashboard() {
  const [tab, setTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024)
  const [schemeFilter, setSchemeFilter] = useState('')
  const [appFilter, setAppFilter] = useState('all')
  const [mintAmount, setMintAmount] = useState(50)
  const [mintScheme, setMintScheme] = useState('PM National Scholarship 2026')
  const [apps, setApps] = useState(APPLICATIONS)
  const [flags, setFlags] = useState(AI_FLAGS)
  const [showCreateScheme, setShowCreateScheme] = useState(false)

  // ── Contract state ──────────────────────────────────
  const [contractGlobal,  setContractGlobal]  = useState(null)
  const [contractLoading, setContractLoading] = useState(false)
  const [contractError,   setContractError]   = useState(null)
  const [contractTx,      setContractTx]      = useState(null)
  const [contractAction,  setContractAction]  = useState(null)
  const [studentTarget,   setStudentTarget]   = useState('')
  const [studentState,    setStudentState]    = useState(null)

  // ── Create Scheme Form State ────────────────────────
  const [schemeForm, setSchemeForm] = useState({
    name: '',
    category: 'Merit',
    amountPerStudent: '',
    totalBudgetCr: '',
    deadline: '',
    criteria: '',
    ministry: 'Ministry of Education',
    maxBeneficiaries: '',
    createToken: true,
  })
  const [schemeCreating, setSchemeCreating] = useState(false)
  const [schemeProgress, setSchemeProgress] = useState(null)
  const [schemeError, setSchemeError] = useState(null)
  const [schemeSuccess, setSchemeSuccess] = useState(null)

  const loadGlobal = useCallback(async () => {
    setContractLoading(true)
    setContractError(null)
    try {
      const g = await getGlobalState()
      setContractGlobal(g)
    } catch (e) {
      setContractError(e.message ?? 'Failed to load chain state')
    } finally {
      setContractLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'blockchain') loadGlobal()
  }, [tab, loadGlobal])

  const lookupStudent = async () => {
    if (!studentTarget.trim()) return
    try {
      const s = await getStudentState(studentTarget.trim())
      setStudentState(s)
    } catch { setStudentState(null) }
  }

  // ── Scheme Creation Handler ─────────────────────────
  const handleCreateScheme = async () => {
    setSchemeCreating(true)
    setSchemeError(null)
    setSchemeSuccess(null)
    setSchemeProgress(null)

    try {
      const result = await createFullScheme(
        {
          name: schemeForm.name,
          category: schemeForm.category,
          amountPerStudent: parseInt(schemeForm.amountPerStudent) || 0,
          totalBudgetCr: parseFloat(schemeForm.totalBudgetCr) || 0,
          deadline: schemeForm.deadline,
          criteria: schemeForm.criteria,
          ministry: schemeForm.ministry,
          maxBeneficiaries: parseInt(schemeForm.maxBeneficiaries) || 0,
          createToken: schemeForm.createToken,
        },
        (progress) => setSchemeProgress(progress)
      )

      if (result.success) {
        setSchemeSuccess({
          schemeId: result.schemeId?.toString(),
          tokenAssetId: result.tokenAssetId,
          txID: result.txID,
        })
        // Reset form after 3 seconds
        setTimeout(() => {
          setShowCreateScheme(false)
          setSchemeSuccess(null)
          setSchemeForm({
            name: '',
            category: 'Merit',
            amountPerStudent: '',
            totalBudgetCr: '',
            deadline: '',
            criteria: '',
            ministry: 'Ministry of Education',
            maxBeneficiaries: '',
            createToken: true,
          })
        }, 3000)
      } else {
        setSchemeError(result.error)
      }
    } catch (err) {
      setSchemeError(err.message || 'Failed to create scheme')
    } finally {
      setSchemeCreating(false)
      setSchemeProgress(null)
    }
  }

  const updateSchemeForm = (field, value) => {
    setSchemeForm(prev => ({ ...prev, [field]: value }))
  }

  const runContractOp = async (label, fn) => {
    const authAddr = loadAddress()
    if (!authAddr) { setContractError('Connect your wallet (◎ Wallet) first.'); return }
    setContractAction(label)
    setContractError(null)
    setContractTx(null)
    try {
      const signer = makePeraSigner(authAddr)
      const { txID } = await fn(authAddr, signer)
      setContractTx(txID)
      await loadGlobal()
      if (studentTarget) {
        const s = await getStudentState(studentTarget.trim())
        setStudentState(s)
      }
    } catch (e) {
      setContractError(
        e?.message?.includes('rejected')
          ? 'Transaction rejected in Pera Wallet.'
          : (e?.message ?? 'Transaction failed')
      )
    } finally {
      setContractAction(null)
    }
  }
  const navigate = useNavigate()

  const filteredSchemes = SCHEMES.filter(s =>
    !schemeFilter || s.name.toLowerCase().includes(schemeFilter.toLowerCase())
  )
  const filteredApps = apps.filter(a =>
    appFilter === 'all' || a.status === appFilter
  )

  return (
    <div className="dash-body">
      <Sidebar
        role="gov"
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
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="topbar-title">ExpressScheme — Gov Panel</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <input type="text" placeholder="Search schemes, students…" />
            </div>
            <div className="topbar-chain"><span className="chain-dot"></span>Chain: Active</div>
            <button
              onClick={() => navigate('/wallet')}
              style={{ background:'rgba(0,232,198,.12)', color:'var(--accent)', border:'1px solid rgba(0,232,198,.3)', borderRadius:'7px', padding:'.38rem .85rem', fontSize:'.82rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'.35rem', whiteSpace:'nowrap' }}
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
                <h1>Good Morning, Officer Rajiv 👋</h1>
                <p>Live status across all 7 active NSP / central scholarship schemes — FY 2025-26.</p>
              </div>
              <span className="welcome-date">Feb 20, 2026</span>
            </div>
            <div className="kpi-grid">
              {[
                { label:'Active Schemes',  val:'7',          trend:'↑ 3 added this quarter', cls:'kpi-accent', icon:'🏛️' },
                { label:'Total Budget',    val:'₹601 Cr',    trend:'Union Budget 2026 allocation', cls:'', icon:'💰' },
                { label:'Tokens Minted',  val:'26,700',      trend:'₹17.5 Cr tokenised on-chain', cls:'', icon:'🔗' },
                { label:'Applications',   val:'3,841',       trend:'↑ 312 in last 7 days', cls:'', icon:'📝' },
                { label:'AI Flags',       val:'6',           trend:'3 critical · 3 warning', cls:'kpi-warn', icon:'🚨' },
                { label:'Distributed',    val:'₹17.5 Cr',    trend:'68.1% AI pass rate', cls:'', icon:'💸' },
              ].map(k => (
                <div key={k.label} className={`kpi-card${k.cls?' '+k.cls:''}`}>
                  <div className="kpi-top">
                    <span className="kpi-label">{k.label}</span>
                    <span className="kpi-icon">{k.icon}</span>
                  </div>
                  <span className="kpi-val">{k.val}</span>
                  <span className={`kpi-trend ${k.cls==='kpi-warn'?'down':'up'}`}>{k.trend}</span>
                </div>
              ))}
            </div>
            <div className="charts-row">
              <div className="chart-card">
                <span className="chart-title">Monthly Token Distribution (₹ Cr) · Aug 2025 – Feb 2026</span>
                <BarChart />
              </div>
              <div className="chart-card" style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <span className="chart-title">Fund Utilisation</span>
                <DonutChart value={73} />
              </div>
            </div>
            <div className="tables-row">
              <div className="table-card">
                <div className="table-card-header">
                  <span className="chart-title" style={{ margin:0 }}>Recent Transactions</span>
                </div>
                <table className="dash-table">
                  <thead><tr><th>TX Hash</th><th>Scheme</th><th>Amount</th><th>Tokens</th><th>Status</th><th>Block</th></tr></thead>
                  <tbody>
                    {TX_DATA.map(tx => (
                      <tr key={tx.hash}>
                        <td className="tx-hash" title={tx.fullHash}>{tx.hash}</td>
                        <td>{tx.scheme}</td>
                        <td>{tx.amount}</td>
                        <td style={{fontVariantNumeric:'tabular-nums'}}>{tx.tokens ? tx.tokens.toLocaleString() : '—'}</td>
                        <td><StatusBadge status={tx.status} /></td>
                        <td style={{fontSize:'.72rem',color:'var(--text-3)'}}>{tx.block ? tx.block.toLocaleString() : 'Pending'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-card">
                <div className="table-card-header">
                  <span className="chart-title" style={{ margin:0 }}>AI Alerts</span>
                </div>
                <div className="alerts-feed">
                  {AI_FLAGS.slice(0,4).map(f => (
                    <div key={f.id} className={`alert-item ${f.type}`}>
                      <span className="alert-icon">{f.type==='critical'?'🔴':'🟡'}</span>
                      <div className="alert-body">
                        <div className="alert-title">{f.reason}</div>
                        <div className="alert-desc">{f.student} — {f.scheme}</div>
                        <div className="alert-time">{f.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCHEMES */}
        {tab === 'schemes' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div>
                <h2>Manage Schemes</h2>
                <p>Create, edit, and tokenize scholarship schemes.</p>
              </div>
              <button className="btn-primary" onClick={() => setShowCreateScheme(true)}>+ Create Scheme</button>
            </div>
            <div className="filter-bar">
              <input
                className="filter-input"
                placeholder="Search schemes…"
                value={schemeFilter}
                onChange={e => setSchemeFilter(e.target.value)}
              />
              <select className="filter-select">
                <option>All Categories</option>
                <option>Merit</option>
                <option>Need-Based</option>
                <option>Disability</option>
                <option>Minority</option>
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
                    <button
                      className="btn-sm btn-approve"
                      onClick={() => setTab('blockchain')}
                    >Manage On-Chain →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOKENIZE */}
        {tab === 'blockchain' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div>
                <h2>⛓️ Blockchain Operations</h2>
                <p>Live contract state · mark milestones · trigger payouts. App ID: <strong>{APP_ID}</strong></p>
              </div>
              <button className="btn-sm btn-view" onClick={loadGlobal} disabled={contractLoading}>
                {contractLoading ? '↻ Loading…' : '↻ Refresh State'}
              </button>
            </div>

            {contractTx && (
              <div style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', borderRadius:'10px', padding:'.75rem 1rem', marginBottom:'1rem', color:'#10b981', fontSize:'.88rem' }}>
                ✅ Transaction confirmed!&nbsp;&nbsp;
                <a href={`https://testnet.algoexplorer.io/tx/${contractTx}`} target="_blank" rel="noreferrer" style={{ color:'#10b981', fontWeight:600 }}>View on AlgoExplorer ↗</a>
              </div>
            )}
            {contractError && (
              <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'10px', padding:'.75rem 1rem', marginBottom:'1rem', color:'#ef4444', fontSize:'.88rem' }}>
                ❌ {contractError}
              </div>
            )}

            {/* Global State */}
            <div className="table-card" style={{ padding:'1.5rem', marginBottom:'1.25rem' }}>
              <h3 style={{ marginBottom:'1rem', fontSize:'1rem' }}>📊 Contract Global State</h3>
              {contractGlobal ? (
                <>
                  <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'.75rem', marginBottom:'1rem' }}>
                    {[
                      { label:'Status',         val: contractGlobal.schemeActive ? '🟢 Active' : '🔴 Inactive' },
                      { label:'Payout/Student', val: contractGlobal.payoutAmount ? (Number(contractGlobal.payoutAmount)/1e6).toFixed(4)+' ALGO' : '—' },
                      { label:'Spent Budget',   val: contractGlobal.spentBudget  ? (Number(contractGlobal.spentBudget)/1e6).toFixed(4)+' ALGO' : '0 ALGO' },
                      { label:'Total Budget',   val: contractGlobal.totalBudget  ? (Number(contractGlobal.totalBudget)/1e6).toFixed(4)+' ALGO' : '—' },
                    ].map(k => (
                      <div key={k.label} className="kpi-card" style={{ padding:'.9rem 1rem' }}>
                        <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
                        <span className="kpi-val" style={{ fontSize:'1rem' }}>{k.val}</span>
                      </div>
                    ))}
                  </div>
                  {contractGlobal.authority && (
                    <div style={{ fontSize:'.8rem', color:'var(--text-2)' }}>
                      🛡️ Authority: <code style={{ color:'var(--accent)', wordBreak:'break-all' }}>{contractGlobal.authority}</code>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color:'var(--text-2)', fontSize:'.9rem' }}>Click Refresh to load state from TestNet.</div>
              )}
            </div>

            {/* Student Lookup + Actions */}
            <div className="tokenize-layout">
              <div className="tokenize-form-card">
                <h3>Student Lookup</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <div className="form-group">
                    <label>Student Wallet Address (Algorand)</label>
                    <input
                      className="filter-input"
                      style={{ fontFamily:'monospace', fontSize:'.83rem' }}
                      placeholder="ALGO TestNet address…"
                      value={studentTarget}
                      onChange={e => setStudentTarget(e.target.value)}
                    />
                  </div>
                  <button className="btn-sm btn-view" onClick={lookupStudent}>🔍 Look Up Student</button>
                  {studentState === null && studentTarget && (
                    <div style={{ color:'var(--text-2)', fontSize:'.84rem' }}>Not opted in or not found.</div>
                  )}
                  {studentState && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                      {[
                        { label:'Registered',    ok: studentState.isRegistered },
                        { label:'Milestone Done', ok: studentState.milestoneCompleted },
                        { label:'Paid',          ok: studentState.hasBeenPaid },
                      ].map(s => (
                        <div key={s.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'.85rem', padding:'.35rem .75rem', background:'var(--bg)', borderRadius:'8px', border:'1px solid var(--border-2)' }}>
                          <span style={{ color:'var(--text-2)' }}>{s.label}</span>
                          <span style={{ color: s.ok ? '#10b981' : '#94a3b8', fontWeight:600 }}>{s.ok ? '✔ Yes' : '✗ No'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="tokenize-preview">
                <h3>Authority Actions</h3>
                <p style={{ color:'var(--text-2)', fontSize:'.85rem', marginBottom:'1.2rem', lineHeight:1.6 }}>
                  Your connected wallet must be the <strong>authority</strong> address stored in the contract.
                  Connect via <strong>◎ Wallet</strong> before running any action.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'.8rem' }}>
                  <button
                    className="btn-primary w-full"
                    disabled={!studentTarget.trim() || !!contractAction}
                    onClick={() => runContractOp('Marking milestone…', (addr, signer) =>
                      markMilestoneComplete(addr, studentTarget.trim(), signer)
                    )}
                  >
                    {contractAction === 'Marking milestone…' ? contractAction : '✅ Mark Milestone Complete'}
                  </button>
                  <button
                    className="btn-primary w-full"
                    disabled={!studentTarget.trim() || !!contractAction}
                    style={{ background:'rgba(59,130,246,.15)', borderColor:'rgba(59,130,246,.4)', color:'#60a5fa' }}
                    onClick={() => runContractOp('Releasing payout…', (addr, signer) =>
                      contractReleasePayout(addr, studentTarget.trim(), signer)
                    )}
                  >
                    {contractAction === 'Releasing payout…' ? contractAction : '💸 Release Payout (Inner Txn)'}
                  </button>
                </div>
                <p style={{ marginTop:'1rem', fontSize:'.78rem', color:'var(--text-3)', lineHeight:1.6 }}>
                  Payout is sent by the <strong>contract's inner transaction</strong>.
                  Your wallet sends <strong>0 ALGO directly</strong> — only an App Call.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* APPLICATIONS */}
        {tab === 'applications' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div><h2>Applications</h2><p>Review and approve student applications.</p></div>
            </div>
            <div className="apps-filters">
              {['all','Pending Review','AI Verified','Approved','Rejected'].map(f => (
                <button
                  key={f}
                  className={`btn-sm${appFilter===f?' btn-approve':' btn-view'}`}
                  onClick={() => setAppFilter(f)}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            {filteredApps.map(a => (
              <div key={a.id} className="app-row">
                <div>
                  <div className="app-name">{a.name}</div>
                  <div className="app-id">{a.studentId} · {a.inst}</div>
                </div>
                <div className="app-scheme">{a.scheme}</div>
                <div className="app-amount">₹{a.amount.toLocaleString()}</div>
                <StatusBadge status={a.status} />
                <div style={{ fontSize:'.78rem', color:'var(--text-3)' }}>{a.date}</div>
                <div style={{ fontSize:'.75rem', color:'var(--text-3)', display:'flex', alignItems:'center', gap:'.25rem' }}>
                  🛡️ {a.aiScore}/100
                </div>
                <div className="app-actions">
                  {a.status === 'Pending Review' || a.status === 'AI Verified' ? (
                    <>
                      <button
                        className="btn-sm btn-approve"
                        onClick={() => setApps(prev => prev.map(x => x.id===a.id ? {...x,status:'Approved'} : x))}
                      >✓ Approve</button>
                      <button
                        className="btn-sm btn-reject"
                        onClick={() => setApps(prev => prev.map(x => x.id===a.id ? {...x,status:'Rejected'} : x))}
                      >✕ Reject</button>
                    </>
                  ) : a.status === 'Approved' ? (
                    <>
                      <button
                        className="btn-sm btn-approve"
                        style={{ background:'rgba(59,130,246,.12)', color:'#60a5fa', borderColor:'rgba(59,130,246,.3)' }}
                        onClick={() => {
                          setStudentTarget(a.walletAddress || a.studentId)
                          setTab('blockchain')
                        }}
                      >⛓ Mark Milestone</button>
                      <button
                        className="btn-sm btn-approve"
                        style={{ background:'rgba(16,185,129,.1)', color:'#10b981', borderColor:'rgba(16,185,129,.25)' }}
                        onClick={() => {
                          setStudentTarget(a.walletAddress || a.studentId)
                          setTab('blockchain')
                        }}
                      >💸 Payout</button>
                    </>
                  ) : (
                    <button className="btn-sm btn-view">View</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI FLAGS */}
        {tab === 'flags' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div><h2>AI Fraud Flags</h2><p>Review and resolve AI-detected anomalies.</p></div>
              <div className="flag-summary">
                <span className="fs-chip critical">🔴 {flags.filter(f=>f.type==='critical').length} Critical</span>
                <span className="fs-chip warning">🟡 {flags.filter(f=>f.type==='warning').length} Warning</span>
              </div>
            </div>
            {flags.map(f => (
              <div key={f.id} className={`flag-card ${f.type}`}>
                <div className="flag-header">
                  <div>
                    <div className="flag-title">{f.reason}</div>
                    <div className="flag-id">{f.id} · {f.studentId}</div>
                  </div>
                  <StatusBadge status={f.type === 'critical' ? 'Rejected' : 'Pending'} />
                </div>
                <div className="flag-meta">
                  <span>👤 {f.student}</span>
                  <span>📋 {f.scheme}</span>
                  <span>🕐 {f.time}</span>
                </div>
                <div className="flag-details">{f.detail}</div>
                <div className="flag-actions">
                  <button className="btn-sm btn-reject" onClick={() => setFlags(prev => prev.filter(x=>x.id!==f.id))}>
                    Block Student
                  </button>
                  <button className="btn-sm btn-approve" onClick={() => setFlags(prev => prev.filter(x=>x.id!==f.id))}>
                    Mark Resolved
                  </button>
                  <button className="btn-sm btn-view">Request Documents</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <div className="tab-content active">
            <div className="tab-header-row">
              <div><h2>Audit Reports</h2><p>Download immutable on-chain audit logs.</p></div>
            </div>
            <div className="reports-grid">
              {REPORTS_DATA.map(r => (
                <div key={r.title} className="report-card">
                  <div className="rc-icon">{r.icon}</div>
                  <div className="rc-title">{r.title}</div>
                  <div className="rc-desc">{r.desc}</div>
                  <div className="rc-meta">{r.meta}</div>
                  <button className="btn-sm btn-view" onClick={() => alert('Downloading ' + r.title)}>
                    ⬇ Download PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CREATE SCHEME MODAL */}
      {showCreateScheme && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget && !schemeCreating && setShowCreateScheme(false)}>
          <div className="modal-box" style={{ maxWidth:'620px' }}>
            <button className="modal-close" onClick={() => !schemeCreating && setShowCreateScheme(false)} disabled={schemeCreating}>✕</button>
            <div className="modal-title">Create New Scheme</div>
            <div className="modal-sub">Define the scheme parameters. This will create an on-chain smart contract.</div>

            {/* Success Message */}
            {schemeSuccess && (
              <div style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.3)', borderRadius:'10px', padding:'1rem', marginBottom:'1rem', color:'#10b981' }}>
                <div style={{ fontWeight:600, marginBottom:'.5rem' }}>✅ Scheme Created Successfully!</div>
                <div style={{ fontSize:'.85rem', lineHeight:1.6 }}>
                  <div>Scheme ID: <code style={{ color:'var(--accent)' }}>{schemeSuccess.schemeId}</code></div>
                  {schemeSuccess.tokenAssetId && (
                    <div>Token Asset ID: <code style={{ color:'var(--accent)' }}>{schemeSuccess.tokenAssetId}</code></div>
                  )}
                  <a href={`https://testnet.algoexplorer.io/tx/${schemeSuccess.txID}`} target="_blank" rel="noreferrer" style={{ color:'#10b981', fontWeight:500 }}>
                    View on AlgoExplorer ↗
                  </a>
                </div>
              </div>
            )}

            {/* Error Message */}
            {schemeError && (
              <div style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', borderRadius:'10px', padding:'1rem', marginBottom:'1rem', color:'#ef4444', fontSize:'.9rem' }}>
                ❌ {schemeError}
              </div>
            )}

            {/* Progress Indicator */}
            {schemeProgress && (
              <div style={{ background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.25)', borderRadius:'10px', padding:'1rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.5rem', fontSize:'.85rem', color:'var(--text-2)' }}>
                  <span>{schemeProgress.message}</span>
                  <span>Step {schemeProgress.step}/{schemeProgress.total}</span>
                </div>
                <div style={{ height:'4px', background:'rgba(255,255,255,.1)', borderRadius:'2px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(schemeProgress.step / schemeProgress.total) * 100}%`, background:'linear-gradient(90deg, #6366f1, #818cf8)', transition:'width .3s ease' }}></div>
                </div>
              </div>
            )}

            <div className="modal-form">
              <div className="form-group">
                <label>Scheme Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. National Merit Award 2026" 
                  value={schemeForm.name}
                  onChange={e => updateSchemeForm('name', e.target.value)}
                  disabled={schemeCreating}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select 
                    className="filter-select" 
                    style={{width:'100%'}} 
                    value={schemeForm.category}
                    onChange={e => updateSchemeForm('category', e.target.value)}
                    disabled={schemeCreating}
                  >
                    <option>Merit</option>
                    <option>Need-Based</option>
                    <option>Disability</option>
                    <option>Minority</option>
                    <option>Research</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ministry / Department</label>
                  <select 
                    className="filter-select" 
                    style={{width:'100%'}}
                    value={schemeForm.ministry}
                    onChange={e => updateSchemeForm('ministry', e.target.value)}
                    disabled={schemeCreating}
                  >
                    <option>Ministry of Education</option>
                    <option>Ministry of Social Justice</option>
                    <option>Ministry of Minority Affairs</option>
                    <option>Ministry of Home Affairs</option>
                    <option>AICTE</option>
                    <option>UGC</option>
                    <option>DST</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount per Student (₹) *</label>
                  <input 
                    type="number" 
                    placeholder="50000" 
                    value={schemeForm.amountPerStudent}
                    onChange={e => updateSchemeForm('amountPerStudent', e.target.value)}
                    disabled={schemeCreating}
                  />
                </div>
                <div className="form-group">
                  <label>Total Budget (₹ Cr) *</label>
                  <input 
                    type="number" 
                    placeholder="50" 
                    step="0.01"
                    value={schemeForm.totalBudgetCr}
                    onChange={e => updateSchemeForm('totalBudgetCr', e.target.value)}
                    disabled={schemeCreating}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Application Deadline *</label>
                  <input 
                    type="date" 
                    value={schemeForm.deadline}
                    onChange={e => updateSchemeForm('deadline', e.target.value)}
                    disabled={schemeCreating}
                  />
                </div>
                <div className="form-group">
                  <label>Max Beneficiaries</label>
                  <input 
                    type="number" 
                    placeholder="10000 (0 = unlimited)" 
                    value={schemeForm.maxBeneficiaries}
                    onChange={e => updateSchemeForm('maxBeneficiaries', e.target.value)}
                    disabled={schemeCreating}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Eligibility Criteria</label>
                <textarea 
                  placeholder="Describe eligibility criteria (income limits, category requirements, academic qualifications)…"
                  style={{ minHeight:'80px', resize:'vertical', padding:'.6rem .8rem', borderRadius:'8px', border:'1px solid var(--border-2)', background:'var(--bg)', color:'var(--text)', width:'100%', fontFamily:'inherit' }}
                  value={schemeForm.criteria}
                  onChange={e => updateSchemeForm('criteria', e.target.value)}
                  disabled={schemeCreating}
                ></textarea>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.75rem 1rem', background:'rgba(99,102,241,.08)', borderRadius:'10px', marginBottom:'1rem' }}>
                <input 
                  type="checkbox" 
                  id="createToken" 
                  checked={schemeForm.createToken}
                  onChange={e => updateSchemeForm('createToken', e.target.checked)}
                  disabled={schemeCreating}
                  style={{ width:'18px', height:'18px', accentColor:'#6366f1' }}
                />
                <label htmlFor="createToken" style={{ cursor:'pointer', flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:'.9rem' }}>Create Scheme Token (ASA)</div>
                  <div style={{ fontSize:'.78rem', color:'var(--text-2)', marginTop:'.15rem' }}>
                    Mint trackable tokens on Algorand for each disbursement
                  </div>
                </label>
              </div>

              <div style={{ display:'flex', gap:'.75rem' }}>
                <button 
                  className="btn-primary" 
                  style={{ flex:1 }}
                  onClick={handleCreateScheme}
                  disabled={schemeCreating || !schemeForm.name || !schemeForm.amountPerStudent || !schemeForm.totalBudgetCr || !schemeForm.deadline}
                >
                  {schemeCreating ? (
                    <>⏳ Creating Scheme...</>
                  ) : (
                    <>⛓️ Create On-Chain</>
                  )}
                </button>
                <button 
                  className="btn-sm btn-view" 
                  style={{ padding:'.6rem 1.2rem' }}
                  onClick={() => setShowCreateScheme(false)}
                  disabled={schemeCreating}
                >
                  Cancel
                </button>
              </div>

              <div style={{ marginTop:'1rem', padding:'.75rem', background:'rgba(255,255,255,.03)', borderRadius:'8px', fontSize:'.78rem', color:'var(--text-3)', lineHeight:1.6 }}>
                <strong>Note:</strong> Creating a scheme will deploy a smart contract on Algorand TestNet. 
                You'll need to sign the transaction with Pera Wallet. 
                Connect your wallet first via the ◎ Wallet button.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
