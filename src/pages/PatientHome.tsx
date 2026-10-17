import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'
import { Pill, FileText, ClipboardCheck, MessageCircle } from 'lucide-react'

const TILES = [
  { key: 'medicines', icon: Pill,          color: 'tile-navy',    to: '/medicines' },
  { key: 'records',   icon: FileText,       color: 'tile-saffron', to: '/records'   },
  { key: 'checkin',   icon: ClipboardCheck, color: 'tile-green',   to: '/checkin'   },
  { key: 'ask',       icon: MessageCircle,  color: 'tile-purple',  to: '/ask'       },
]

const ICON_COLORS = {
  'tile-navy':    'var(--color-primary)',
  'tile-saffron': 'var(--color-accent)',
  'tile-green':   'var(--color-green)',
  'tile-purple':  '#7C5CBF',
}

export default function PatientHome() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const firstName = profile?.full_name?.split(' ')[0] ?? '…'

  return (
    <main className="page-enter" style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '1.5rem 1rem 3rem',
    }}>
      {/* Greeting */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.2rem' }}>
          {t('patient.greeting', { name: firstName })}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
          {t('patient.subtitle')}
        </p>
      </div>

      {/* 2×2 tile grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
      }}>
        {TILES.map(({ key, icon: Icon, color, to }) => {
          const iconColor = ICON_COLORS[color as keyof typeof ICON_COLORS]
          return (
            <button
              key={key}
              className={`home-tile ${color}`}
              onClick={() => navigate(to)}
              id={`tile-${key}`}
              aria-label={t(`patient.tiles.${key}`)}
            >
              <div className="tile-icon-circle">
                <Icon size={28} color={iconColor} strokeWidth={1.75} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.3 }}>
                {t(`patient.tiles.${key}`)}
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
