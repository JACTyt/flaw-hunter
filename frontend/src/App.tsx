import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Crosshair, Shield } from 'lucide-react'
import { Dashboard } from './pages/Dashboard'
import { Campaigns } from './pages/Campaigns'
import { CampaignDetail } from './pages/CampaignDetail'
import { Reports } from './pages/Reports'

function Nav() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
      isActive ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-700'
    }`

  return (
    <nav className="bg-blue-800 px-6 py-3 flex items-center gap-4">
      <span className="text-white font-bold text-lg mr-4 flex items-center gap-2">
        <Shield size={20} />
        Flaw Hunter
      </span>
      <NavLink to="/" end className={cls}>
        <LayoutDashboard size={15} />
        Dashboard
      </NavLink>
      <NavLink to="/campaigns" className={cls}>
        <Crosshair size={15} />
        Campaigns
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/reports/:id" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
