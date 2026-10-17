import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Construction, ArrowLeft } from 'lucide-react'

export default function PlaceholderPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const pageName = pathname.replace('/', '').replace('-', ' ')

  return (
    <main className="page-enter" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 80px)',
      padding: '2rem 1rem',
    }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: '360px', padding: '2.5rem 2rem' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'var(--color-accent-tint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <Construction size={36} color="var(--color-accent)" />
        </div>
        <h2 style={{ marginBottom: '0.5rem', textTransform: 'capitalize' }}>{pageName}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {t('placeholder.comingSoonDesc')}
        </p>
        <Link to="/" className="btn btn-outline" id="btn-back-home">
          <ArrowLeft size={16} />
          {t('placeholder.backHome')}
        </Link>
      </div>
    </main>
  )
}
