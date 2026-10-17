import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../components/Card'
import {
  Pill,
  ClipboardCheck,
  MessageCircle,
  HelpCircle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'

export default function PlaceholderPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  // Match icon, title, description based on route
  const getRouteDetails = () => {
    if (pathname.includes('/medicines')) {
      return {
        icon: Pill,
        color: 'var(--color-primary)',
        bgTint: 'var(--color-primary-tint)',
        title: t('app.nav.medicines'),
        desc: t('placeholder.medicinesDesc'),
      }
    }
    if (pathname.includes('/checkin')) {
      return {
        icon: ClipboardCheck,
        color: 'var(--color-teal)',
        bgTint: 'var(--color-teal-tint)',
        title: t('app.nav.checkin'),
        desc: t('placeholder.checkinDesc'),
      }
    }
    if (pathname.includes('/ask')) {
      return {
        icon: MessageCircle,
        color: 'var(--color-coral)',
        bgTint: 'var(--color-coral-tint)',
        title: t('app.nav.ask'),
        desc: t('placeholder.askDesc'),
      }
    }
    return {
      icon: HelpCircle,
      color: 'var(--color-accent)',
      bgTint: 'var(--color-accent-tint)',
      title: pathname.replace('/', '').replace('-', ' '),
      desc: t('placeholder.comingSoonDesc'),
    }
  }

  const { icon: Icon, color, bgTint, title, desc } = getRouteDetails()

  return (
    <div className="page-enter" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '1rem',
    }}>
      <Card style={{ textAlign: 'center', maxWidth: '420px', width: '100%', padding: '2.5rem 1.75rem' }}>
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          background: bgTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <Icon size={38} color={color} strokeWidth={2} />
        </div>

        <h2 style={{ marginBottom: '0.5rem', textTransform: 'capitalize' }}>
          {title}
        </h2>

        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
          {desc}
        </p>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.75rem',
          background: 'var(--color-bg)',
          borderRadius: '999px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--color-accent)',
          marginBottom: '1.75rem',
        }}>
          <Sparkles size={14} />
          <span>{t('placeholder.comingSoonDesc')}</span>
        </div>

        <div>
          <Link to="/" className="btn btn-outline" id="btn-back-home" style={{ width: '100%' }}>
            <ArrowLeft size={16} />
            <span>{t('placeholder.backHome')}</span>
          </Link>
        </div>
      </Card>
    </div>
  )
}
