import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import HistoryTimeline from '../components/HistoryTimeline'
import {
  type Patient,
  type HistoryEntry,
  calculateAge,
} from '../lib/types'
import {
  ShieldAlert,
  MapPin,
  Phone,
  User,
} from 'lucide-react'

export default function PatientRecordsPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()

  const [patientRecord, setPatientRecord] = useState<Patient | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const fetchPatientAndHistory = async () => {
      if (!user) return
      setLoading(true)
      setErrorMsg(null)

      try {
        // Try to find patient record associated with this user
        // 1. By id = user.id
        let { data: pData } = await supabase
          .from('patients')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        // 2. If not found by id, try matching by phone or name
        if (!pData && profile?.phone) {
          const { data: phoneMatch } = await supabase
            .from('patients')
            .select('*')
            .eq('phone', profile.phone)
            .maybeSingle()
          if (phoneMatch) pData = phoneMatch
        }

        if (!pData && profile?.full_name) {
          const { data: nameMatch } = await supabase
            .from('patients')
            .select('*')
            .eq('name', profile.full_name)
            .maybeSingle()
          if (nameMatch) pData = nameMatch
        }

        setPatientRecord(pData)

        // If patient record is identified, fetch their clinical history
        if (pData?.id) {
          const { data: hData, error: hErr } = await supabase
            .from('history_entries')
            .select('*')
            .eq('patient_id', pData.id)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false })

          if (hErr) throw hErr
          setHistoryEntries(hData ?? [])
        } else {
          // If no linked patient row, check if any history_entries directly reference this user.id
          const { data: directEntries } = await supabase
            .from('history_entries')
            .select('*')
            .eq('patient_id', user.id)
            .order('entry_date', { ascending: false })

          setHistoryEntries(directEntries ?? [])
        }
      } catch (err: any) {
        console.error('Error fetching patient records:', err)
        setErrorMsg(err.message || 'Failed to load records from Supabase.')
      } finally {
        setLoading(false)
      }
    }

    fetchPatientAndHistory()
  }, [user, profile])

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-lg" />
        <p>{t('app.actions.loading')}</p>
      </div>
    )
  }

  const age = calculateAge(patientRecord?.dob)
  const displayName = patientRecord?.name || profile?.full_name || 'Patient'

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast Alert Banner */}
      {errorMsg && (
        <div className="toast-banner error" role="alert">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem 1.5rem',
      }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>
          {t('records.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
          {t('records.viewOnlyNote')}
        </p>
      </div>

      {/* Profile Details Card */}
      <Card style={{ borderTop: '4px solid var(--color-accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--color-accent-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <User size={28} color="var(--color-accent)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>{displayName}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                <MapPin size={15} color="var(--color-coral)" />
                <span>{patientRecord?.village || t('records.patientDetails.notSet')}</span>
                <span>•</span>
                <Phone size={15} />
                <span>{patientRecord?.phone || profile?.phone || t('records.patientDetails.notSet')}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-teal">
              {age !== null ? t('patientsPage.ageYears', { age }) : (patientRecord?.gender || t('patientsPage.unspecified'))}
            </span>
            {patientRecord?.blood_group && (
              <span className="badge badge-coral">
                {patientRecord.blood_group}
              </span>
            )}
          </div>
        </div>

        {/* Details Row: DOB, Allergies, Birth Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: '0.9rem',
        }}>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
              {t('records.patientDetails.dob')}
            </span>
            <span style={{ fontWeight: 600 }}>
              {patientRecord?.dob ? new Date(patientRecord.dob).toLocaleDateString() : t('records.patientDetails.notSet')}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
              {t('records.patientDetails.allergies')}
            </span>
            <span style={{ fontWeight: 600, color: patientRecord?.allergies ? 'var(--color-red)' : 'var(--color-text)' }}>
              {patientRecord?.allergies || t('records.patientDetails.none')}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
              {t('records.patientDetails.birthDetails')}
            </span>
            <span style={{ fontWeight: 600 }}>
              {patientRecord?.birth_details || t('records.patientDetails.none')}
            </span>
          </div>
        </div>
      </Card>

      {/* Read-Only Timeline Section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{t('records.timelineTitle')}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {t('records.viewOnlyNote')}
            </p>
          </div>
          <span className="badge badge-navy">
            {historyEntries.length} entries
          </span>
        </div>

        <HistoryTimeline
          entries={historyEntries}
          isReadOnly={true}
        />
      </section>
    </div>
  )
}
