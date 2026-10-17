import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { User, Stethoscope, AlertCircle, Eye, EyeOff } from 'lucide-react'
import i18n from '../i18n'

type Role = 'patient' | 'asha_worker'
type Mode = 'login' | 'signup'

export default function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<Role | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('arogya_lang', lang)
    document.documentElement.lang = lang
  }
  const currentLang = i18n.language

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) { setError(t('auth.error.fields')); return }
    if (mode === 'signup' && (!fullName || !role)) {
      setError(role ? t('auth.error.fields') : t('auth.error.selectRole'))
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone, role },
          },
        })
        if (signUpErr) throw signUpErr
        // After signup, session is set; navigate via onAuthStateChange
        navigate('/', { replace: true })
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
        if (loginErr) throw loginErr
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err.message || t('auth.error.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tricolor strip at top */}
      <div className="tricolor-strip" />

      {/* Header bar (minimal, no auth buttons) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 1.25rem',
        background: 'var(--color-white)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <svg width="32" height="32" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect width="34" height="34" rx="10" fill="#1F3A93"/>
            <path d="M9 22 Q17 8 25 22" stroke="#F28C28" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <path d="M9 22 Q17 28 25 22" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
            <circle cx="17" cy="22" r="2.5" fill="#F28C28"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary)' }}>
            Arogya | आरोग्य
          </span>
        </div>
        <div className="lang-pill" role="group" aria-label="Language selector">
          <button className={currentLang === 'en' ? 'active' : ''} onClick={() => switchLang('en')} id="auth-lang-en">EN</button>
          <button className={currentLang === 'hi' ? 'active' : ''} onClick={() => switchLang('hi')} id="auth-lang-hi">हिंदी</button>
        </div>
      </div>

      {/* Center card */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        <div className="card page-enter" style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2rem',
        }}>
          {/* Logo + tagline */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'var(--color-primary)',
              marginBottom: '0.75rem',
            }}>
              <svg width="40" height="40" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <path d="M9 22 Q17 8 25 22" stroke="#F28C28" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <path d="M9 22 Q17 28 25 22" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
                <circle cx="17" cy="22" r="2.5" fill="#F28C28"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', color: 'var(--color-primary)' }}>
              {mode === 'login' ? t('auth.login') : t('auth.signup')}
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
              {t('app.tagline')}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Role selector (signup only) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ marginBottom: '0.6rem' }}>{t('auth.role')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {/* Patient */}
                  <button
                    type="button"
                    className={`role-card${role === 'patient' ? ' selected' : ''}`}
                    onClick={() => setRole('patient')}
                    id="role-patient"
                    aria-pressed={role === 'patient'}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: role === 'patient' ? 'var(--color-primary)' : 'var(--color-primary-tint)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <User size={22} color={role === 'patient' ? '#fff' : 'var(--color-primary)'} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('auth.rolePatient')}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {t('auth.rolePatientDesc')}
                    </span>
                  </button>

                  {/* ASHA Worker */}
                  <button
                    type="button"
                    className={`role-card${role === 'asha_worker' ? ' selected' : ''}`}
                    onClick={() => setRole('asha_worker')}
                    id="role-asha"
                    aria-pressed={role === 'asha_worker'}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: role === 'asha_worker' ? 'var(--color-accent)' : 'var(--color-accent-tint)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Stethoscope size={22} color={role === 'asha_worker' ? '#fff' : 'var(--color-accent)'} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('auth.roleAsha')}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {t('auth.roleAshaDesc')}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Full name (signup) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="input-name">{t('auth.fullName')}</label>
                <input
                  id="input-name"
                  className="input"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ramesh Kumar"
                  required
                />
              </div>
            )}

            {/* Phone (signup) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="input-phone">{t('auth.phone')}</label>
                <input
                  id="input-phone"
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="input-email">{t('auth.email')}</label>
              <input
                id="input-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
              <label htmlFor="input-password">{t('auth.password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="input-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: '3rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', display: 'flex', padding: '4px',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  id="btn-toggle-password"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '1.05rem' }}
              disabled={loading}
              id="btn-auth-submit"
            >
              {loading ? <span className="spinner" /> : null}
              {mode === 'login' ? t('auth.loginBtn') : t('auth.signupBtn')}
            </button>
          </form>

          {/* Mode switch */}
          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
            {' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-primary)', fontWeight: 600,
                fontFamily: 'Mukta, sans-serif', fontSize: '0.95rem', padding: 0,
              }}
              id="btn-mode-switch"
            >
              {mode === 'login' ? t('auth.switchToSignup') : t('auth.switchToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
