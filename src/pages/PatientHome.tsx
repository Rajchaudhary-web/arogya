import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Card from '../components/Card'
import {
  Pill,
  FileText,
  ClipboardCheck,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Calendar,
} from 'lucide-react'

const TILES = [
  { key: 'medicines', icon: Pill,           tintClass: 'card-tint-navy',   color: 'var(--color-primary)', to: '/medicines' },
  { key: 'records',   icon: FileText,       tintClass: 'card-tint-saffron',color: 'var(--color-accent)',  to: '/records'   },
  { key: 'checkin',   icon: ClipboardCheck, tintClass: 'card-tint-teal',   color: 'var(--color-teal)',    to: '/checkin'   },
  { key: 'ask',       icon: MessageCircle,  tintClass: 'card-tint-coral',  color: 'var(--color-coral)',   to: '/ask'       },
]

export default function PatientHome() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Format today's date
  const todayFormatted = useMemo(() => {
    const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN'
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [i18n.language])

  // Deterministic daily health tip based on day of year
  const tipIndex = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
    return dayOfYear % 5
  }, [])

  const tips = t('patient.tips', { returnObjects: true }) as string[]
  const currentTip = Array.isArray(tips) ? tips[tipIndex] || tips[0] : ''

  const firstName = profile?.full_name?.split(' ')[0] ?? '…'

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Greeting Header */}
      <div style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>
            {t('patient.greeting', { name: firstName })}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {t('patient.subtitle')}
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'var(--color-bg)',
          padding: '0.45rem 0.85rem',
          borderRadius: '999px',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-text)',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <Calendar size={16} color="var(--color-accent)" />
          <span>{todayFormatted}</span>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Left Column: 4 Main Action Tiles */}
        <div>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '0.85rem' }}>
            {t('records.title')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
          }}>
            {TILES.map(({ key, icon: Icon, tintClass, color, to }) => (
              <button
                key={key}
                className={`home-tile ${tintClass}`}
                onClick={() => navigate(to)}
                id={`tile-${key}`}
                aria-label={t(`patient.tiles.${key}`)}
                style={{ textAlign: 'center', padding: '1.25rem 0.75rem' }}
              >
                <div className="tile-icon-circle">
                  <Icon size={30} color={color} strokeWidth={2} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>
                  {t(`patient.tiles.${key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Next Medicine, Today's Check-in & Health Tip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Next Medicine Card */}
          <Card className="card-tint-navy">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  {t('patient.nextMedicine.title')}
                </span>
              </div>
              <span className="badge badge-navy">
                {t('patient.nextMedicine.badge')}
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '0.2rem' }}>
              {t('patient.nextMedicine.name')}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0.5rem' }}>
              {t('patient.nextMedicine.instruction')}
            </p>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              ⏰ {t('patient.nextMedicine.time')}
            </div>
          </Card>

          {/* Today's Check-in Card */}
          <Card className="card-tint-teal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={18} color="var(--color-teal)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-teal)' }}>
                  {t('patient.checkin.title')}
                </span>
              </div>
              <span className="badge badge-yellow">
                {t('patient.checkin.status')}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.85rem' }}>
              {t('patient.checkin.desc')}
            </p>
            <button
              className="btn btn-teal btn-sm"
              onClick={() => navigate('/checkin')}
              id="btn-patient-checkin"
              style={{ width: '100%' }}
            >
              <span>{t('patient.checkin.action')}</span>
              <ArrowRight size={16} />
            </button>
          </Card>

          {/* Health Tip of the Day Card */}
          <Card className="card-tint-yellow">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Sparkles size={18} color="#B48200" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#936300' }}>
                {t('patient.healthTip.title')}
              </span>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
              “{currentTip}”
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
