import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { Patient } from '../lib/types'
import {
  Users,
  AlertTriangle,
  Pill,
  UserPlus,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
  Eye,
  UserCheck,
} from 'lucide-react'

export default function AshaDashboard() {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const navigate = useNavigate()

  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [unassignedPatients, setUnassignedPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const ashaName = profile?.full_name || user?.user_metadata?.full_name || 'आशा कार्यकर्ता'

  const loadDashboardData = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Fetch count of assigned patients
      const { count, error: countErr } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('asha_id', user.id)

      if (countErr) throw countErr
      setTotalCount(count ?? 0)

      // 2. Fetch unassigned patients (asha_id is null)
      const { data: unassignedData, error: unassignedErr } = await supabase
        .from('patients')
        .select('*')
        .is('asha_id', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (unassignedErr) throw unassignedErr
      setUnassignedPatients(unassignedData ?? [])
    } catch (err: any) {
      console.error('Error loading ASHA dashboard data:', err)
      setErrorMsg(err.message || 'Failed to load dashboard data from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const handleClaimPatient = async (patientId: string) => {
    if (!user) return
    setClaimingId(patientId)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error: claimErr } = await supabase
        .from('patients')
        .update({ asha_id: user.id })
        .eq('id', patientId)

      if (claimErr) throw claimErr

      setSuccessMsg(t('app.feedback.claimSuccess'))
      // Refresh data
      await loadDashboardData()
    } catch (err: any) {
      console.error('Error claiming patient:', err)
      setErrorMsg(err.message || 'Failed to claim patient.')
    } finally {
      setClaimingId(null)
    }
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
        gap: '1rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>
            {t('asha.greeting', { name: ashaName })}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {t('app.tagline')}
          </p>
        </div>

        <Link
          to="/asha/patients/add"
          className="btn btn-primary"
          id="btn-dash-add-patient"
        >
          <UserPlus size={18} />
          <span>{t('asha.addPatientBtn')}</span>
        </Link>
      </div>

      {/* Summary 3 Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
      }}>
        {/* Total Patients */}
        <div className="stat-card" style={{ borderTop: '4px solid var(--color-teal)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--color-teal-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Users size={22} color="var(--color-teal)" />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--color-teal)' }}>
            {loading ? <span className="spinner" /> : totalCount ?? 0}
          </div>
          <div className="stat-label">{t('asha.summary.totalPatients')}</div>
        </div>

        {/* Needs Attention (0 for now) */}
        <div className="stat-card" style={{ borderTop: '4px solid var(--color-coral)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--color-coral-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={22} color="var(--color-coral)" />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--color-coral)' }}>
            0
          </div>
          <div className="stat-label">{t('asha.summary.needsAttention')}</div>
        </div>

        {/* Today's Doses (0 for now) */}
        <div className="stat-card" style={{ borderTop: '4px solid var(--color-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--color-accent-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Pill size={22} color="var(--color-accent)" />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--color-accent)' }}>
            0
          </div>
          <div className="stat-label">{t('asha.summary.todaysDoses')}</div>
        </div>
      </div>

      {/* Quick Action Navigation Strip */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--color-white)',
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <Users size={18} color="var(--color-primary)" />
          <span>{t('asha.section.myPatients')} ({totalCount ?? 0})</span>
        </div>
        <Link
          to="/asha/patients"
          className="btn btn-outline btn-sm"
          id="btn-goto-mypatients"
        >
          <span>{t('app.actions.view')} {t('asha.section.myPatients')}</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Section: Unassigned Patients */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{t('asha.section.unassigned')}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Self-registered community patients not yet linked to an ASHA worker
            </p>
          </div>
          <span className="badge badge-yellow">
            {unassignedPatients.length}
          </span>
        </div>

        {loading ? (
          <Card>
            <div className="empty-state">
              <span className="spinner spinner-lg" />
              <p>{t('app.actions.loading')}</p>
            </div>
          </Card>
        ) : unassignedPatients.length === 0 ? (
          <Card className="card-tint-green">
            <div className="empty-state">
              <div className="empty-state-icon" style={{ background: 'var(--color-green-tint)' }}>
                <CheckCircle size={32} color="var(--color-green)" />
              </div>
              <p style={{ fontWeight: 600, color: 'var(--color-green)' }}>
                {t('asha.emptyUnassigned')}
              </p>
            </div>
          </Card>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1rem',
          }}>
            {unassignedPatients.map((patient) => (
              <Card key={patient.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem' }}>{patient.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      📍 {patient.village || t('records.patientDetails.notSet')}
                    </p>
                  </div>
                  <span className="badge badge-coral">
                    Self-Reg
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  📞 {patient.phone || t('records.patientDetails.notSet')}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleClaimPatient(patient.id)}
                    disabled={claimingId === patient.id}
                    className="btn btn-teal btn-sm"
                    style={{ flex: 1 }}
                    id={`btn-claim-${patient.id}`}
                  >
                    <UserCheck size={16} />
                    <span>
                      {claimingId === patient.id ? t('app.actions.claiming') : t('app.actions.claim')}
                    </span>
                  </button>
                  <button
                    onClick={() => navigate(`/asha/patients/${patient.id}`)}
                    className="btn btn-ghost btn-sm"
                    title={t('app.actions.view')}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
