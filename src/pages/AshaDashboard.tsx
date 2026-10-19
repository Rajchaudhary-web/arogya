import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { HistoryEntry, VisitRequest, VisitRequestStatus } from '../lib/types'
import {
  calculateBatchedDashboardMetrics,
  type ScheduledCareItem,
} from '../lib/schedule'
import {
  Users,
  AlertTriangle,
  Clock,
  Inbox,
  UserPlus,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
  Eye,
  Phone,
  FileText,
  HeartPulse,
  AlertCircle,
} from 'lucide-react'

interface EnrichedUploadItem extends HistoryEntry {
  patientName?: string
}

interface EnrichedVisitRequest extends VisitRequest {
  patientName?: string
  patientPhone?: string | null
  patientVillage?: string | null
}

export default function AshaDashboard() {
  const { t } = useTranslation()
  const { profile, user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Aggregated card metrics & lists
  const [totalPatientsCount, setTotalPatientsCount] = useState<number>(0)
  const [openRequests, setOpenRequests] = useState<EnrichedVisitRequest[]>([])
  const [overdueList, setOverdueList] = useState<ScheduledCareItem[]>([])
  const [dueThisWeekList, setDueThisWeekList] = useState<ScheduledCareItem[]>([])
  const [highRiskList, setHighRiskList] = useState<Array<{ patient: any; latestVisit: any }>>([])
  const [recentUploads, setRecentUploads] = useState<EnrichedUploadItem[]>([])

  const ashaName = profile?.full_name || user?.user_metadata?.full_name || 'आशा कार्यकर्ता'

  const loadDashboard = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // ── BATCH QUERY 1: Fetch all patients assigned to this ASHA ──
      const { data: patientsData, error: pErr } = await supabase
        .from('patients')
        .select('id, name, category, dob, edd, delivery_date, phone, village, asha_id')
        .eq('asha_id', user.id)

      if (pErr) throw pErr
      const patients = patientsData ?? []
      setTotalPatientsCount(patients.length)
      const patientIds = patients.map((p) => p.id)

      const patientMap = new Map<string, (typeof patients)[0]>()
      patients.forEach((p) => patientMap.set(p.id, p))

      // ── BATCH QUERY 2: Vaccine Schedule (Reference data) ──
      const { data: vsData } = await supabase
        .from('vaccine_schedule')
        .select('id, code, name, age_label, due_after_days')
        .order('sort_order', { ascending: true })

      const vaccineSchedule = vsData ?? []

      let pVaccinations: any[] = []
      let mVisi: any[] = []
      let hVisi: any[] = []

      // If ASHA has patients, fetch their vaccinations, maternal visits, home visits, and visit requests in batches
      if (patientIds.length > 0) {
        // ── BATCH QUERY 3: Patient vaccinations ──
        const { data: pvData } = await supabase
          .from('patient_vaccinations')
          .select('patient_id, schedule_id, given_on')
          .in('patient_id', patientIds)

        pVaccinations = pvData ?? []

        // ── BATCH QUERY 4: Maternal visits ──
        const { data: mvData } = await supabase
          .from('maternal_visits')
          .select('patient_id, visit_code, done_on')
          .in('patient_id', patientIds)

        mVisi = mvData ?? []

        // ── BATCH QUERY 5: Home visits ──
        const { data: hvData } = await supabase
          .from('home_visits')
          .select('patient_id, next_visit_date, refer, created_at')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })

        hVisi = hvData ?? []

        // ── BATCH QUERY 6: Visit requests (Open items for dashboard) ──
        const { data: vrData } = await supabase
          .from('visit_requests')
          .select('*')
          .in('patient_id', patientIds)
          .neq('status', 'done')
          .order('created_at', { ascending: false })

        const enrichedRequests: EnrichedVisitRequest[] = (vrData ?? []).map((req) => {
          const p = patientMap.get(req.patient_id)
          return {
            ...req,
            patientName: p?.name || 'Patient',
            patientPhone: p?.phone,
            patientVillage: p?.village,
          }
        })
        setOpenRequests(enrichedRequests)
      } else {
        setOpenRequests([])
      }

      // ── Pure Schedule Computation ──
      const metrics = calculateBatchedDashboardMetrics({
        patients,
        vaccineSchedule,
        patientVaccinations: pVaccinations,
        maternalVisits: mVisi,
        homeVisits: hVisi,
      })

      setOverdueList(metrics.overdueItems)
      setDueThisWeekList(metrics.dueThisWeekItems)
      setHighRiskList(metrics.highRiskPatients)

      // ── BATCH QUERY 7: Recent patient uploads (last 7 days, added by patient) ──
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      let uploadsQuery = supabase
        .from('history_entries')
        .select('*')
        .gte('created_at', sevenDaysAgo)
        .not('added_by', 'is', null)
        .neq('added_by', user.id)
        .order('created_at', { ascending: false })

      if (patientIds.length > 0) {
        uploadsQuery = uploadsQuery.in('patient_id', patientIds)
      }

      const { data: uploadsData } = await uploadsQuery

      const rawUploads = uploadsData ?? []
      if (rawUploads.length > 0) {
        const enrichedUploads: EnrichedUploadItem[] = rawUploads.slice(0, 5).map((item) => ({
          ...item,
          patientName: patientMap.get(item.patient_id)?.name || 'Patient',
        }))
        setRecentUploads(enrichedUploads)
      } else {
        setRecentUploads([])
      }
    } catch (err: any) {
      console.error('Error loading ASHA dashboard data:', err)
      setErrorMsg(err.message || 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
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
      if (newStatus === 'done') {
        setOpenRequests((prev) => prev.filter((r) => r.id !== requestId))
      } else {
        setOpenRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
        )
      }
    } catch (err: any) {
      console.error('Error updating visit request:', err)
      setErrorMsg(err.message || 'Failed to update request.')
    } finally {
      setActionLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-lg" />
        <p>{t('app.actions.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

      {/* Greeting and Quick Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.65rem' }}>{t('dashboard.title')}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            नमस्ते, <strong>{ashaName}</strong> • {t('dashboard.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <Link to="/asha/patients/add" className="btn btn-primary" id="btn-dashboard-add-patient">
            <UserPlus size={18} />
            <span>{t('asha.addPatientBtn')}</span>
          </Link>
          <Link to="/asha/requests" className="btn btn-outline" id="btn-dashboard-requests">
            <Inbox size={18} />
            <span>{t('app.nav.requests')}</span>
          </Link>
        </div>
      </div>

      {/* ── SECTION 0: Urgent Emergency Requests (status 'open' & urgent = true) ── */}
      {(() => {
        const urgentOpenRequests = openRequests.filter(
          (req) => req.urgent === true && req.status === 'open'
        )
        if (urgentOpenRequests.length === 0) return null

        return (
          <section
            id="asha-urgent-requests-section"
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
                  {t('urgentSection.title')} ({urgentOpenRequests.length})
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#7F1D1D' }}>
                  {t('urgentSection.sub')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {urgentOpenRequests.map((req) => (
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

      {/* ── 4 Top Stat Cards ─────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
      }}>
        {/* Card 1: Total Patients */}
        <Link to="/asha/patients" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card className="stat-card" style={{ borderTop: '4px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} color="var(--color-primary)" />
              </div>
            </div>
            <span className="stat-value" style={{ color: 'var(--color-primary)' }}>
              {totalPatientsCount}
            </span>
            <span className="stat-label">{t('dashboard.cards.totalPatients')}</span>
          </Card>
        </Link>

        {/* Card 2: Overdue */}
        <Card className="stat-card" style={{ borderTop: '4px solid var(--color-red)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-red-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color="var(--color-red)" />
            </div>
          </div>
          <span className="stat-value" style={{ color: 'var(--color-red)' }}>
            {overdueList.length}
          </span>
          <span className="stat-label">{t('dashboard.cards.overdue')}</span>
        </Card>

        {/* Card 3: Due this week */}
        <Card className="stat-card" style={{ borderTop: '4px solid var(--color-yellow)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-yellow-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={22} color="#B45309" />
            </div>
          </div>
          <span className="stat-value" style={{ color: '#B45309' }}>
            {dueThisWeekList.length}
          </span>
          <span className="stat-label">{t('dashboard.cards.dueThisWeek')}</span>
        </Card>

        {/* Card 4: Open requests */}
        <Link to="/asha/requests" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card className="stat-card" style={{ borderTop: '4px solid var(--color-teal)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-teal-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Inbox size={22} color="var(--color-teal)" />
              </div>
            </div>
            <span className="stat-value" style={{ color: 'var(--color-teal)' }}>
              {openRequests.length}
            </span>
            <span className="stat-label">{t('dashboard.cards.openRequests')}</span>
          </Card>
        </Link>
      </div>

      {/* ── SECTION 1: Visit Requests (Open Items) ────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text)' }}>
              {t('dashboard.sections.requests')} ({openRequests.length})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {t('dashboard.sections.requestsSub')}
            </p>
          </div>
          {openRequests.length > 0 && (
            <Link to="/asha/requests" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-primary)' }}>
              <span>{t('app.actions.view')} All</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {openRequests.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.75rem' }}>
              <CheckCircle size={32} color="var(--color-green)" />
              <p style={{ fontWeight: 600 }}>{t('dashboard.noRequests')}</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {openRequests.slice(0, 5).map((req) => (
              <Card
                key={req.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.85rem',
                  borderLeft: `5px solid ${req.status === 'open' ? 'var(--color-coral)' : 'var(--color-yellow)'}`,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{req.patientName}</span>
                    <span className="badge badge-navy">
                      {t(`requestsPage.reasons.${req.reason}`, req.reason)}
                    </span>
                    <span className={`badge ${req.status === 'open' ? 'badge-coral' : 'badge-yellow'}`}>
                      {t(`requestsPage.status${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`, req.status)}
                    </span>
                  </div>

                  {req.message && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      "{req.message}"
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    <Clock size={12} />
                    <span>{req.created_at ? new Date(req.created_at).toLocaleString() : ''}</span>
                    {req.patientVillage && (
                      <>
                        <span>•</span>
                        <span>{req.patientVillage}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
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

                  {req.status === 'open' && (
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'seen')}
                      disabled={actionLoadingId === req.id}
                      className="btn btn-outline btn-sm"
                    >
                      <Eye size={14} />
                      <span>{t('dashboard.markSeen')}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleUpdateStatus(req.id, 'done')}
                    disabled={actionLoadingId === req.id}
                    className="btn btn-primary btn-sm"
                  >
                    <CheckCircle size={14} />
                    <span>{t('dashboard.markDone')}</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 2: Overdue Milestones ─────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-red)' }}>
            {t('dashboard.sections.overdue')} ({overdueList.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {t('dashboard.sections.overdueSub')}
          </p>
        </div>

        {overdueList.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.75rem' }}>
              <CheckCircle size={32} color="var(--color-green)" />
              <p style={{ fontWeight: 600 }}>{t('dashboard.noOverdue')}</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {overdueList.map((item, idx) => (
              <Card
                key={`${item.patientId}_${item.itemCode}_${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  borderLeft: '5px solid var(--color-red)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.patientName}</span>
                    <span className="badge badge-red">
                      <AlertCircle size={13} />
                      <span>{item.itemTitle}</span>
                    </span>
                    <span className="badge badge-coral">
                      {t('dashboard.daysLate', { count: item.daysLate })}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    <span>{t('tracker.dueDate')}: <strong>{new Date(item.dueDate).toLocaleDateString()}</strong></span>
                    {item.patientVillage && (
                      <>
                        <span> • </span>
                        <span>{item.patientVillage}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {item.patientPhone && (
                    <a
                      href={`tel:${item.patientPhone}`}
                      className="btn btn-outline btn-sm"
                      style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                    >
                      <Phone size={14} />
                      <span>{t('dashboard.callPatient')}</span>
                    </a>
                  )}

                  <Link
                    to={`/asha/patients/${item.patientId}`}
                    className="btn btn-primary btn-sm"
                    style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                  >
                    <Eye size={14} />
                    <span>{t('dashboard.viewPatient')}</span>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 3: Due This Week ─────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: '#B45309' }}>
            {t('dashboard.sections.dueThisWeek')} ({dueThisWeekList.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {t('dashboard.sections.dueThisWeekSub')}
          </p>
        </div>

        {dueThisWeekList.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.75rem' }}>
              <Clock size={32} color="var(--color-yellow)" />
              <p style={{ fontWeight: 600 }}>{t('dashboard.noDueThisWeek')}</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {dueThisWeekList.map((item, idx) => (
              <Card
                key={`${item.patientId}_${item.itemCode}_${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  borderLeft: '5px solid var(--color-yellow)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.patientName}</span>
                    <span className="badge badge-amber">
                      <Clock size={13} />
                      <span>{item.itemTitle}</span>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    <span>{t('tracker.dueDate')}: <strong>{new Date(item.dueDate).toLocaleDateString()}</strong></span>
                    {item.patientVillage && (
                      <>
                        <span> • </span>
                        <span>{item.patientVillage}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {item.patientPhone && (
                    <a
                      href={`tel:${item.patientPhone}`}
                      className="btn btn-outline btn-sm"
                      style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                    >
                      <Phone size={14} />
                      <span>{t('dashboard.callPatient')}</span>
                    </a>
                  )}

                  <Link
                    to={`/asha/patients/${item.patientId}`}
                    className="btn btn-primary btn-sm"
                    style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                  >
                    <Eye size={14} />
                    <span>{t('dashboard.viewPatient')}</span>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 4: Refer / High-Risk Patients ─────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-coral)' }}>
            {t('dashboard.sections.highRisk')} ({highRiskList.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {t('dashboard.sections.highRiskSub')}
          </p>
        </div>

        {highRiskList.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.75rem' }}>
              <HeartPulse size={32} color="var(--color-teal)" />
              <p style={{ fontWeight: 600 }}>{t('dashboard.noHighRisk')}</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {highRiskList.map(({ patient, latestVisit }) => (
              <Card
                key={patient.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  borderLeft: '5px solid var(--color-coral)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{patient.name}</span>
                    <span className="badge badge-red">
                      <HeartPulse size={13} />
                      <span>PHC Referral Flagged</span>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    <span>Flagged on: {latestVisit.created_at ? new Date(latestVisit.created_at).toLocaleDateString() : '—'}</span>
                    {patient.village && (
                      <>
                        <span> • </span>
                        <span>{patient.village}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {patient.phone && (
                    <a
                      href={`tel:${patient.phone}`}
                      className="btn btn-outline btn-sm"
                      style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                    >
                      <Phone size={14} />
                      <span>{t('dashboard.callPatient')}</span>
                    </a>
                  )}

                  <Link
                    to={`/asha/patients/${patient.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                  >
                    <Eye size={14} />
                    <span>{t('dashboard.viewPatient')}</span>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 5: Recent Patient Uploads (Kept) ──────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>
            {t('dashboard.sections.recentUploads')} ({recentUploads.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {t('dashboard.sections.recentUploadsSub')}
          </p>
        </div>

        {recentUploads.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.75rem' }}>
              <FileText size={32} color="var(--color-primary)" />
              <p style={{ fontWeight: 600 }}>{t('dashboard.noRecentUploads')}</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {recentUploads.map((item) => (
              <Card
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  borderLeft: '5px solid var(--color-primary)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.patientName}</span>
                    <span className="badge badge-navy" style={{ textTransform: 'capitalize' }}>
                      {item.entry_type}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginTop: '0.2rem' }}>
                    {item.title}
                  </p>

                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Uploaded: {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                  </span>
                </div>

                <Link
                  to={`/asha/patients/${item.patient_id}`}
                  className="btn btn-outline btn-sm"
                  style={{ minHeight: '38px', padding: '0.35rem 0.65rem' }}
                >
                  <Eye size={14} />
                  <span>{t('dashboard.viewPatient')}</span>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
