/**
 * Header component – appears on all protected routes.
 * Includes logo + "Arogya | आरोग्य", language pill toggle,
 * and user menu (avatar with initial, name, role badge, and working Logout button).
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { LogOut, User } from 'lucide-react'
import i18n from '../i18n'

export default function Header() {
  const { t, i18n: i18nInstance } = useTranslation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('arogya_lang', lang)
    document.documentElement.lang = lang
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } finally {
      navigate('/auth', { replace: true })
    }
  }

  const current = i18nInstance.language
  const initial = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'
  const isAsha = profile?.role === 'asha'
  const roleLabel = isAsha ? t('auth.roleAsha') : t('auth.rolePatient')

  return (
    <header className="app-header">
      <div className="tricolor-strip" />
      <div className="app-header-inner">
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect width="34" height="34" rx="10" fill="#1F3A93"/>
            <path d="M9 22 Q17 8 25 22" stroke="#F28C28" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <path d="M9 22 Q17 28 25 22" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
            <circle cx="17" cy="22" r="2.5" fill="#F28C28"/>
          </svg>
          <div>
            <h2 style={{
              margin: 0,
              fontWeight: 700,
              fontSize: '1.15rem',
              color: 'var(--color-primary)',
              lineHeight: 1.2,
            }}>
              Arogya | आरोग्य
            </h2>
            <p style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1,
            }}>
              {t('app.tagline')}
            </p>
          </div>
        </div>

        {/* Right Controls: Language pill & User profile / logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="lang-pill" role="group" aria-label="Language selector">
            <button
              className={current === 'en' ? 'active' : ''}
              onClick={() => switchLang('en')}
              id="header-lang-en"
            >
              EN
            </button>
            <button
              className={current === 'hi' ? 'active' : ''}
              onClick={() => switchLang('hi')}
              id="header-lang-hi"
            >
              हिन्दी
            </button>
          </div>

          {/* User info & Logout */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            paddingLeft: '0.5rem',
            borderLeft: '1px solid var(--color-border)',
          }}>
            {/* User Avatar Initial */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: isAsha ? 'var(--color-teal)' : 'var(--color-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
              }}
              title={profile?.full_name || 'User'}
            >
              {initial || <User size={18} />}
            </div>

            {/* Name + Badge (desktop / tablet) */}
            <div style={{ display: 'none', flexDirection: 'column' }} className="hidden sm:flex">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                {profile?.full_name || '...'}
              </span>
              <span className={`badge ${isAsha ? 'badge-teal' : 'badge-navy'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                {roleLabel}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm"
              id="btn-header-logout"
              title={t('app.logout')}
              style={{ minHeight: '38px', padding: '0.35rem 0.65rem', color: 'var(--color-red)' }}
            >
              <LogOut size={17} />
              <span style={{ fontSize: '0.85rem' }}>{t('app.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
