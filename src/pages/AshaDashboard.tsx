import { useTranslation } from 'react-i18next'
import { Construction, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const SummaryCard = ({ label, value }: { label: string; value: number }) => (
  <div className="stat-card" style={{ textAlign: 'center' }}>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
)

export default function AshaDashboard() {
  const { t } = useTranslation()
  const firstName = 'अशा' // placeholder – in real app fetch from profile

  return (
    <main className="page-enter" style={{ padding: '1.5rem', maxWidth: '720px', margin: '0 auto' }}>
      {/* Greeting */}
      <h1 style={{ marginBottom: '0.4rem' }}>{t('asha.greeting', { name: firstName })}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{t('app.tagline')}</p>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.75rem' }}>
        <SummaryCard label={t('asha.summary.totalPatients')} value={123} />
        <SummaryCard label={t('asha.summary.needsAttention')} value={7} />
        <SummaryCard label={t('asha.summary.todaysDoses')} value={34} />
      </div>

      {/* Sections */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>{t('asha.section.flagged')}</h2>
        <div className="card empty-state">
          <Construction size={36} color="var(--color-primary)" />
          <p>{t('placeholder.comingSoonDesc')}</p>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: '0.5rem' }}>{t('asha.section.myPatients')}</h2>
        <div className="card empty-state">
          <Construction size={36} color="var(--color-primary)" />
          <p>{t('placeholder.comingSoonDesc')}</p>
        </div>
      </section>

      <div style={{ marginTop: '2rem' }}>
        <Link to="/" className="btn btn-outline" id="btn-asha-back-home">
          <ArrowLeft size={16} />
          {t('placeholder.backHome')}
        </Link>
      </div>
    </main>
  )
}
