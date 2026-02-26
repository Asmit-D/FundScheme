import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginModal({ role, onClose }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')

  if (!role) return null

  const isGov = role === 'gov'
  const title = isGov ? 'Officer Login' : 'Student Login'
  const sub   = isGov ? 'Access the Government Control Panel' : 'Access your Scholarship Portal'

  const handleSubmit = (e) => {
    e.preventDefault()
    onClose()
    navigate(isGov ? '/gov-dashboard' : '/user-dashboard')
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-logo"><span>⚡</span> ExpressScheme</div>
        <div className="modal-title">{title}</div>
        <div className="modal-sub">{sub}</div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{isGov ? 'Officer ID / Email' : 'Student ID / Email'}</label>
            <input
              type="email"
              placeholder={isGov ? 'officer@gov.in' : 'student@edu.in'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {isGov ? '🏛️ Enter Gov Portal' : '🎓 Enter Citizen Portal'}
          </button>
        </form>
        <p className="modal-note">Demo: any email / password works</p>
      </div>
    </div>
  )
}
