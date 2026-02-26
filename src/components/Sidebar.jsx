import { useNavigate } from 'react-router-dom'

export default function Sidebar({ role, tabs, activeTab, onTabChange, open, onClose }) {
  const navigate = useNavigate()
  const isGov = role === 'gov'

  return (
    <>
      {/* Backdrop overlay — tap to close on mobile */}
      <div
        className={`sidebar-overlay${open ? ' visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar${open ? ' open' : ' hidden'}`}>
      <div className="sidebar-brand">
        <span style={{ color:'var(--accent)' }}>⚡</span>
        <span>ExpressScheme</span>
      </div>
      <div className="sidebar-role-badge">
        <span className={`role-dot ${isGov ? 'gov-dot' : 'user-dot'}`}></span>
        {isGov ? 'Gov Officer' : 'Citizen Portal'}
      </div>

      <nav className="sidebar-nav">
        {tabs.map(t => (
          <div
            key={t.id}
            className={`snav-item${activeTab === t.id ? ' active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            <span className="snav-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.badge ? <span className="nav-badge">{t.badge}</span> : null}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className={`su-avatar ${isGov ? 'gov-avatar' : 'user-avatar'}`}>
            {isGov ? 'GO' : 'PK'}
          </div>
          <div className="su-info">
            <span className="su-name">{isGov ? 'Govt. Officer' : 'Priya Kumari'}</span>
            <span className="su-id">{isGov ? 'OFF-2026-001' : 'STU-2026-0042'}</span>
          </div>
        </div>
        <span className="logout-btn" onClick={() => navigate('/')} style={{ cursor:'pointer' }}>
          Logout
        </span>
      </div>
    </aside>
    </>
  )
}
