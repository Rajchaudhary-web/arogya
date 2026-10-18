import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Header from './Header'
import {
  Home,
  Pill,
  FileText,
  MessageCircle,
  LayoutDashboard,
  Users,
  UserPlus,
  Inbox,
  Send,
} from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const isAsha = profile?.role === 'asha'

  // Patient nav: Home, Records, Medicines, Request Visit, Ask Arogya
  const patientNav = [
    { to: '/patient', label: t('app.nav.home'), icon: Home },
    { to: '/records', label: t('app.nav.records'), icon: FileText },
    { to: '/medicines', label: t('app.nav.medicines'), icon: Pill },
    { to: '/ask-visit', label: t('app.nav.requestVisit'), icon: Send },
    { to: '/ask', label: t('app.nav.ask'), icon: MessageCircle },
  ]

  // ASHA nav: Dashboard, My Patients, Add Patient, Requests
  const ashaNav = [
    { to: '/asha', label: t('app.nav.dashboard'), icon: LayoutDashboard },
    { to: '/asha/patients', label: t('app.nav.myPatients'), icon: Users },
    { to: '/asha/patients/add', label: t('app.nav.addPatient'), icon: UserPlus },
    { to: '/asha/requests', label: t('app.nav.requests'), icon: Inbox },
  ]

  const navItems = isAsha ? ashaNav : patientNav

  return (
    <div className="app-shell-root">
      <Header />

      <div className="app-shell-body">
        {/* Desktop Left Sidebar */}
        <aside className="app-sidebar" aria-label="Desktop Navigation">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => {
                    const isCurrent =
                      item.to === '/asha/patients'
                        ? isActive && !window.location.pathname.startsWith('/asha/patients/add')
                        : isActive
                    return `sidebar-nav-item ${isCurrent ? 'active' : ''}`
                  }}
                  end={
                    item.to === '/patient' ||
                    item.to === '/asha' ||
                    item.to === '/asha/patients/add' ||
                    item.to === '/asha/requests' ||
                    item.to === '/ask-visit'
                  }
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>

        {/* Main Page Content */}
        <main className="app-main-content">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav className="mobile-tabbar" aria-label="Mobile Navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                const isCurrent =
                  item.to === '/asha/patients'
                    ? isActive && !window.location.pathname.startsWith('/asha/patients/add')
                    : isActive
                return `mobile-tab-item ${isCurrent ? 'active' : ''}`
              }}
              end={
                item.to === '/patient' ||
                item.to === '/asha' ||
                item.to === '/asha/patients/add' ||
                item.to === '/asha/requests' ||
                item.to === '/ask-visit'
              }
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Slim Footer */}
      <footer className="app-footer">
        <p className="tagline">Arogya: {t('app.tagline')}</p>
        <p>{t('app.madeForAsha')}</p>
      </footer>
    </div>
  )
}
