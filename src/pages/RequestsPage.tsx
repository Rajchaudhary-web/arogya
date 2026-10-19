import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { VisitRequest, VisitRequestStatus } from '../lib/types'
import {
  Inbox,
  Filter,
  CheckCircle,
  Eye,
  ShieldAlert,
  Phone,
  Clock,
} from 'lucide-react'

interface EnrichedVisitRequest extends VisitRequest {
  patientName?: string
  patientPhone?: string | null
  patientVillage?: string | null
}

export default function RequestsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [requests, setRequests] = useState<EnrichedVisitRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const fetchRequests = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Fetch assigned patients
      const { data: pData, error: pErr } = await supabase
        .from('patients')
        .select('id, name, phone, village')
        .eq('asha_id', user.id)

      if (pErr) throw pErr
      const patientList = pData ?? []
      const patientIds = patientList.map((p) => p.id)

      if (patientIds.length === 0) {
        setRequests([])
        setLoading(false)
        return
      }

      // 2. Fetch visit requests for these patients
      const { data: rData, error: rErr } = await supabase
        .from('visit_requests')
        .select('*')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false })

      if (rErr) throw rErr

      const pMap = new Map<string, (typeof patientList)[0]>()
      patientList.forEach((p) => pMap.set(p.id, p))

      const enriched: EnrichedVisitRequest[] = (rData ?? []).map((req) => {
        const p = pMap.get(req.patient_id)
        return {
          ...req,
          patientName: p?.name || 'Patient',
          patientPhone: p?.phone,
          patientVillage: p?.village,
        }
      })

      setRequests(enriched)
    } catch (err: any) {
      console.error('Error fetching visit requests:', err)
      setErrorMsg(err.message || 'Failed to fetch visit requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [user])

  const handleUpdateStatus = async (requestId: string, newStatus: VisitRequestStatus) => {
    setActionLoadingId(requestId)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const updatePayload: Record<string, any> = {
        status: newStatus,
      }
      if (newStatus === 'done') {
        updatePayload.resolved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('visit_requests')
        .update(updatePayload)
        .eq('id', requestId)

      if (error) throw error

      setSuccessMsg(t('app.feedback.saveSuccess'))
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: newStatus, resolved_at: updatePayload.resolved_at || r.resolved_at }
            : r
        )
      )
    } catch (err: any) {
      console.error('Error updating visit request status:', err)
      setErrorMsg(err.message || 'Failed to update request.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests
    return requests.filter((r) => r.status === statusFilter)
  }, [requests, statusFilter])

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast Alert Banner */}
      {errorMsg && (
        <div className="toast-banner error" role="alert">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="toast-banner success" role="status">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>{t('requestsPage.title')}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {t('requestsPage.subtitle')}
          </p>
        </div>

        {/* Filter by Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={18} color="var(--color-text-muted)" />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="all">{t('requestsPage.allStatuses')}</option>
            <option value="open">{t('requestsPage.statusOpen')}</option>
            <option value="seen">{t('requestsPage.statusSeen')}</option>
            <option value="done">{t('requestsPage.statusDone')}</option>
          </select>
        </div>
      </div>

      {/* ── Urgent Requests Section (status 'open' & urgent = true) ── */}
      {(() => {
        const urgentOpen = requests.filter((r) => r.urgent === true && r.status === 'open')
        if (urgentOpen.length === 0) return null

        return (
          <section
            id="requests-urgent-section"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: '#FEF2F2',
              border: '2px solid #EF4444',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#991B1B', fontWeight: 800 }}>
                  {t('urgentSection.title')} ({urgentOpen.length})
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#7F1D1D' }}>
                  {t('urgentSection.sub')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {urgentOpen.map((req) => (
                <Card
                  key={req.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.85rem',
                    borderLeft: '6px solid #DC2626',
                    background: '#FFFFFF',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#991B1B' }}>
                        {req.patientName}
                      </span>
                      <span
                        className="badge badge-coral"
                        style={{
                          background: '#FEE2E2',
                          color: '#DC2626',
                          fontWeight: 700,
                          border: '1px solid #FCA5A5',
                        }}
                      >
                        {t('urgentSection.badge')}
                      </span>
                    </div>

                    {req.message && (
                      <p
                        style={{
                          fontSize: '0.95rem',
                          color: 'var(--color-text)',
                          marginTop: '0.35rem',
                          fontWeight: 600,
                        }}
                      >
                        {req.message}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        marginTop: '0.35rem',
                      }}
                    >
                      <Clock size={13} />
                      <span>{req.created_at ? new Date(req.created_at).toLocaleString() : ''}</span>
                      {req.patientVillage && (
                        <>
                          <span>•</span>
                          <span>{req.patientVillage}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {req.patientPhone && (
                      <a
                        href={`tel:${req.patientPhone}`}
                        className="btn btn-primary"
                        style={{
                          background: '#DC2626',
                          borderColor: '#DC2626',
                          color: '#FFFFFF',
                          minHeight: '44px',
                          padding: '0.4rem 0.85rem',
                          fontWeight: 700,
                        }}
                      >
                        <Phone size={16} />
                        <span>{t('dashboard.callPatient')}</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(req.id, 'seen')}
                      disabled={actionLoadingId === req.id}
                      className="btn btn-outline btn-sm"
                      style={{ minHeight: '44px', padding: '0.4rem 0.75rem' }}
                    >
                      <Eye size={15} />
                      <span>{t('dashboard.markSeen')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(req.id, 'done')}
                      disabled={actionLoadingId === req.id}
                      className="btn btn-outline btn-sm"
                      style={{
                        minHeight: '44px',
                        padding: '0.4rem 0.75rem',
                        color: 'var(--color-green)',
                        borderColor: 'var(--color-green)',
                      }}
                    >
                      <CheckCircle size={15} />
                      <span>{t('dashboard.markDone')}</span>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Requests List */}
      {loading ? (
        <Card>
          <div className="empty-state">
            <span className="spinner spinner-lg" />
            <p>{t('app.actions.loading')}</p>
          </div>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'var(--color-primary-tint)' }}>
              <Inbox size={32} color="var(--color-primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>{t('requestsPage.empty')}</h3>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredRequests.map((req) => {
            const isOpen = req.status === 'open'
            const isSeen = req.status === 'seen'
            const isDone = req.status === 'done'

            return (
              <Card
                key={req.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderLeft: `5px solid ${isOpen ? 'var(--color-coral)' : isSeen ? 'var(--color-yellow)' : 'var(--color-green)'
                    }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)' }}>
                        {req.patientName}
                      </span>
                      {req.urgent && (
                        <span
                          className="badge badge-coral"
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            fontWeight: 700,
                            border: '1px solid #FCA5A5',
                          }}
                        >
                          {t('urgentSection.badge')}
                        </span>
                      )}
                      <span className={`badge ${isOpen ? 'badge-coral' : isSeen ? 'badge-yellow' : 'badge-green'
                        }`} style={{ textTransform: 'capitalize' }}>
                        {t(`requestsPage.status${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`, req.status)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      <Clock size={14} />
                      <span>{req.created_at ? new Date(req.created_at).toLocaleString() : ''}</span>
                      {req.patientVillage && (
                        <>
                          <span>•</span>
                          <span>{req.patientVillage}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Call & View Profile Buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {req.patientPhone && (
                      <a
                        href={`tel:${req.patientPhone}`}
                        className="btn btn-outline btn-sm"
                        style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                      >
                        <Phone size={14} />
                        <span>{t('dashboard.callPatient')}</span>
                      </a>
                    )}
                    <Link
                      to={`/asha/patients/${req.patient_id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                    >
                      <Eye size={14} />
                      <span>{t('dashboard.viewPatient')}</span>
                    </Link>
                  </div>
                </div>

                {/* Reason & Message */}
                <div style={{
                  background: 'var(--color-bg)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('requestsPage.reasonLabel')}:
                    </span>
                    <span className="badge badge-navy">
                      {t(`requestsPage.reasons.${req.reason}`, req.reason)}
                    </span>
                  </div>
                  {req.message && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                      "{req.message}"
                    </p>
                  )}
                </div>

                {/* Actions: Mark seen & Mark done */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.35rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {isDone && req.resolved_at && (
                      <span>{t('requestsPage.resolvedAt', { date: new Date(req.resolved_at).toLocaleString() })}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {isOpen && (
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'seen')}
                        disabled={actionLoadingId === req.id}
                        className="btn btn-outline btn-sm"
                      >
                        <Eye size={14} />
                        <span>{t('dashboard.markSeen')}</span>
                      </button>
                    )}
                    {!isDone && (
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'done')}
                        disabled={actionLoadingId === req.id}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle size={14} />
                        <span>{t('dashboard.markDone')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
