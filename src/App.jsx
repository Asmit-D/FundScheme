import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Landing from './pages/Landing'
import GovDashboard from './pages/GovDashboard'
import UserDashboard from './pages/UserDashboard'
import AIVerify from './pages/AIVerify'
import About from './pages/About'

// Lazy-load WalletDashboard so @perawallet/connect is only bundled when needed
// and any init errors are isolated to that route only
const WalletDashboard = lazy(() => import('./pages/WalletDashboard'))

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/gov-dashboard" element={<GovDashboard />} />
          <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/ai-verify" element={<AIVerify />} />
          <Route path="/about" element={<About />} />
          <Route
            path="/wallet"
            element={
              <Suspense fallback={<div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#04051A',color:'#818CF8',fontSize:'1.2rem' }}>Loading Wallet…</div>}>
                <WalletDashboard />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
