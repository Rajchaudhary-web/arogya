import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { VisitRequest, VisitRequestReason, Patient } from '../lib/types'
import {
  Send,
  ShieldAlert,
  CheckCircle,
  Inbox,
  Clock,
  Thermometer,
  Baby,
  Package,
  HelpCircle,
  HeartPulse,
  Phone,
  Check,
  Eye,
  Calendar,
} from 'lucide-react'

interface AshaProfile {
  id: string
  full_name: string | null
  phone: string | null
}

interface ReasonOption {
  key: VisitRequestReason
  icon: any
  mainColor: string
  tintColor: string
  borderColor: string
}

const REASON_OPTIONS: ReasonOption[] = [
  {
    key: 'fever',
    icon: Thermometer,
    mainColor: '#F0625D',
    tintColor: '#FDECEB',
    borderColor: '#FCA5A5',
  },
  {
    key: 'pregnancy_problem',
    icon: HeartPulse,
    mainColor: '#F28C28',
    tintColor: '#FEF0E0',
    borderColor: '#FDBA74',
  },
  {
    key: 'child_unwell',
    icon: Baby,
    mainColor: '#0E9F9A',
    tintColor: '#E3F5F4',
    borderColor: '#99F6E4',
  },
  {
    key: 'need_supplies',
    icon: Package,
    mainColor: '#1F3A93',
    tintColor: '#E8ECF8',
    borderColor: '#BFDBFE',
  },
  {
    key: 'other',
    icon: HelpCircle,
    mainColor: '#7A5BC7',
    tintColor: '#EFEAFA',
    borderColor: '#DDD6FE',
  },
]

export default function RequestVisitPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()

  const [selfPatient, setSelfPatient] = useState<Patient | null>(null)
  const [ashaWorker, setAshaWorker] = useState<AshaProfile | null>(null)
  const [children, setChildren] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [reason, setReason] = useState<VisitRequestReason | null>('fever')
  const [message, setMessage] = useState('')

  const [pastRequests, setPastRequests] = useState<VisitRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Fetch own patient record
      const { data: pData, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (pErr) throw pErr

      if (!pData) {
        setLoading(false)
        return
      }

      setSelfPatient(pData)
      setSelectedPatientId(pData.id)

      // 2. Fetch ASHA profile if linked (patients.asha_id -> profiles.id)
      if (pData.asha_id) {
        const { data: aData } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', pData.asha_id)
          .maybeSingle()

        if (aData) setAshaWorker(aData)
      }

      // 3. Fetch children (guardian_patient_id = pData.id)
      const { data: cData } = await supabase
        .from('patients')
        .select('*')
        .eq('guardian_patient_id', pData.id)
        .order('name', { ascending: true })

      const childList = cData ?? []
      setChildren(childList)

      // 4. Fetch past visit requests for patient + children
      const allPatientIds = [pData.id, ...childList.map((c) => c.id)]
      const { data: rData, error: rErr } = await supabase
        .from('visit_requests')
        .select('*')
        .in('patient_id', allPatientIds)
        .order('created_at', { ascending: false })

      if (rErr) throw rErr
      setPastRequests(rData ?? [])
    } catch (err: any) {
      console.error('Error loading request visit page:', err)
      setErrorMsg(err.message || 'Failed to load request form.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId || !reason) return

    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // IMPORTANT: Do NOT send created_by (the database sets it automatically via trigger/default)
      const payload = {
        patient_id: selectedPatientId,
        reason,
        message: message.trim() || null,
        status: 'open',
      }

      const { data, error } = await supabase
        .from('visit_requests')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error

      setSuccessMsg(t('requestVisitPage.successBanner'))
      setMessage('')
      if (data) {
        setPastRequests((prev) => [data, ...prev])
      }
    } catch (err: any) {
      console.error('Error submitting visit request:', err)
      setErrorMsg(err.message || 'Failed to submit visit request.')
    } finally {
      setSubmitting(false)
    }
  }

  // Patient name map for past requests
  const patientNameMap = new Map<string, string>()
  if (selfPatient) patientNameMap.set(selfPatient.id, selfPatient.name)
  children.forEach((c) => patientNameMap.set(c.id, c.name))

  // Helper for status badge rendering
  const renderStatusBadge = (status: string) => {
    if (status === 'open') {
      return (
        <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={13} />
          <span>{t('requestsPage.statusOpen')}</span>
        </span>
      )
    }
    if (status === 'seen') {
      return (
        <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Eye size={13} />
          <span>{t('requestsPage.statusSeen')}</span>
        </span>
      )
    }
    return (
      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <Check size={13} />
        <span>{t('requestsPage.statusDone')}</span>
      </span>
    )
  }

  // Helper for reason item details
  const getReasonMeta = (key: string) => {
    return REASON_OPTIONS.find((r) => r.key === key) || REASON_OPTIONS[4]
  }

  if (loading) {
    return (
      <div className="request-visit-container">
        <Card>
          <div className="empty-state">
            <span className="spinner spinner-lg" />
            <p>{t('app.actions.loading')}</p>
          </div>
        </Card>
      </div>
    )
  }

  if (!selfPatient) {
    return (
      <div className="request-visit-container">
        <Card>
          <div className="empty-state">
            <ShieldAlert size={36} color="var(--color-yellow)" />
            <p>{t('patientHome.ashaNotLinked')}</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-enter request-visit-container">
      {/* Toast Alert Banner */}
      {errorMsg && (
        <div className="toast-banner error" role="alert">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="toast-banner success" role="status" style={{ background: '#EAF6EE', borderColor: '#86EFAC', color: '#1B6A3B' }}>
          <CheckCircle size={20} color="#2E9E5B" />
          <span style={{ fontWeight: 600 }}>{t('requestVisitPage.successBanner')}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{t('requestVisitPage.title')}</h1>
            <span className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <HeartPulse size={14} />
              <span>{t('requestVisitPage.badge')}</span>
            </span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: '0.3rem' }}>
            {t('requestVisitPage.subtitle')}
          </p>
        </div>
      </div>

      {/* 2-Column Responsive Layout (65% Form / 35% ASHA Card & Past Requests) */}
      <div className="request-visit-grid">
        {/* Mobile: ASHA Card first if on mobile (handled by layout order / desktop grid) */}

        {/* ── LEFT COLUMN: Request Form Card (65%) ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Card style={{
            padding: '2rem 1.75rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-white)',
          }}>
            <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* 1. "Who is it for" Selector (only if children exist) */}
              {children.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label htmlFor="select-request-target" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                    {t('requestVisitPage.whoIsItFor')} *
                  </label>
                  <select
                    id="select-request-target"
                    className="select"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                    style={{ minHeight: '48px', fontSize: '0.95rem', borderRadius: '12px' }}
                  >
                    <option value={selfPatient.id}>
                      {t('requestVisitPage.forMyself', { name: selfPatient.name })}
                    </option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        Child: {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Vibrant Reason Cards (Min height 120px, 3 per row on desktop, 2 on mobile) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                    {t('requestVisitPage.selectReason')} *
                  </label>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Select one issue
                  </span>
                </div>

                <div className="reason-cards-grid">
                  {REASON_OPTIONS.map((opt) => {
                    const isSelected = reason === opt.key
                    const Icon = opt.icon
                    const styleVars = {
                      '--rc-main': opt.mainColor,
                      '--rc-tint': opt.tintColor,
                      '--rc-border': opt.borderColor,
                    } as React.CSSProperties

                    return (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setReason(opt.key)}
                        className={`reason-card-btn ${isSelected ? 'selected' : ''}`}
                        style={styleVars}
                        aria-pressed={isSelected}
                      >
                        {/* Check indicator in corner if selected */}
                        {isSelected && (
                          <div className="reason-check-indicator" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}

                        {/* Large icon in circle */}
                        <div className="reason-icon-circle">
                          <Icon size={24} color={isSelected ? '#FFFFFF' : opt.mainColor} strokeWidth={2.2} />
                        </div>

                        {/* Title label */}
                        <span className="reason-title" style={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: opt.mainColor,
                          lineHeight: 1.25,
                          marginBottom: '0.25rem',
                        }}>
                          {t(`requestsPage.reasons.${opt.key}`, opt.key)}
                        </span>

                        {/* One-line helper text */}
                        <span className="reason-desc" style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          lineHeight: 1.3,
                        }}>
                          {t(`requestVisitPage.reasonHelpers.${opt.key}`)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3. Larger Message Box (Min 120px) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label htmlFor="request-message" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                  {t('requestVisitPage.optionalMessage')}
                </label>
                <textarea
                  id="request-message"
                  className="textarea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('requestVisitPage.messagePlaceholder')}
                  style={{ minHeight: '120px', borderRadius: '12px', padding: '0.85rem' }}
                />
              </div>

              {/* 4. Send Button (Saffron #F28C28, full width, disabled until reason chosen) */}
              <button
                type="submit"
                disabled={submitting || !reason}
                className="btn"
                id="btn-submit-visit-request"
                style={{
                  width: '100%',
                  minHeight: '52px',
                  borderRadius: '12px',
                  background: '#F28C28',
                  color: '#FFFFFF',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  opacity: (!reason || submitting) ? 0.6 : 1,
                  cursor: (!reason || submitting) ? 'not-allowed' : 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                }}
              >
                {submitting ? (
                  <>
                    <span className="spinner" style={{ borderTopColor: '#FFFFFF' }} />
                    <span>{t('requestVisitPage.sending')}</span>
                  </>
                ) : (
                  <>
                    <Send size={19} />
                    <span>{t('requestVisitPage.sendBtn')}</span>
                  </>
                )}
              </button>
            </form>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: ASHA Didi Card & Past Requests (35%) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* "Your ASHA Didi" Card */}
          {ashaWorker?.full_name && (
            <Card style={{
              background: 'var(--color-teal-tint)',
              border: '1.5px solid var(--color-teal)',
              borderRadius: '16px',
              padding: '1.25rem 1.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--color-teal)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  flexShrink: 0,
                }}>
                  {ashaWorker.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-teal)', textTransform: 'uppercase' }}>
                    {t('requestVisitPage.yourAsha')}
                  </span>
                  <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--color-text)' }}>
                    {ashaWorker.full_name}
                  </h3>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Your local healthcare guide for immunization, pregnancy support, and home checkups.
              </p>

              {ashaWorker.phone && (
                <a
                  href={`tel:${ashaWorker.phone}`}
                  className="btn btn-teal"
                  id="btn-call-asha-sidebar"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    textDecoration: 'none',
                  }}
                >
                  <Phone size={16} />
                  <span>{t('requestVisitPage.callAsha')} ({ashaWorker.phone})</span>
                </a>
              )}
            </Card>
          )}

          {/* "My Past Requests" Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text)', margin: 0 }}>
                {t('requestVisitPage.pastRequests')} ({pastRequests.length})
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                {t('requestVisitPage.pastRequestsSub')}
              </p>
            </div>

            {pastRequests.length === 0 ? (
              <Card style={{ borderRadius: '16px' }}>
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <Inbox size={32} color="var(--color-text-muted)" />
                  <p style={{ fontSize: '0.9rem' }}>{t('requestVisitPage.emptyPast')}</p>
                </div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto', paddingRight: '2px' }}>
                {pastRequests.map((req) => {
                  const targetName = patientNameMap.get(req.patient_id) || profile?.full_name || 'Patient'
                  const meta = getReasonMeta(req.reason)
                  const Icon = meta.icon

                  return (
                    <Card
                      key={req.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '14px',
                        borderLeft: `4px solid ${meta.mainColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {/* Top Header: Reason & Status badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: meta.tintColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: meta.mainColor,
                          }}>
                            <Icon size={14} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {t(`requestsPage.reasons.${req.reason}`, req.reason)}
                          </span>
                        </div>

                        {renderStatusBadge(req.status)}
                      </div>

                      {/* Target Name (if child or self) */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        For: <strong style={{ color: 'var(--color-text)' }}>{targetName}</strong>
                      </div>

                      {/* Message preview */}
                      {req.message && (
                        <p style={{
                          fontSize: '0.85rem',
                          color: 'var(--color-text)',
                          fontStyle: 'italic',
                          background: 'var(--color-bg)',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          margin: 0,
                        }}>
                          "{req.message}"
                        </p>
                      )}

                      {/* Date & resolved time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        <Calendar size={12} />
                        <span>{req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}</span>
                        {req.status === 'done' && req.resolved_at && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>
                              Resolved {new Date(req.resolved_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
