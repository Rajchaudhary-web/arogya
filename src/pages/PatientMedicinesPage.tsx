import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { Medicine } from '../lib/types'
import {
  Pill,
  ShieldAlert,
  CheckCircle,
} from 'lucide-react'

export default function PatientMedicinesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchPatientMedicines = async () => {
      setLoading(true)
      setErrorMsg(null)

      try {
        // 1. Find the patient row linked to this profile
        const { data: pData, error: pErr } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()

        if (pErr) throw pErr

        if (!pData) {
          setMedicines([])
          setLoading(false)
          return
        }

        // 2. Fetch all medicines for this patient
        const { data: mData, error: mErr } = await supabase
          .from('medicines')
          .select('*')
          .eq('patient_id', pData.id)
          .order('active', { ascending: false })
          .order('created_at', { ascending: false })

        if (mErr) throw mErr
        setMedicines(mData ?? [])
      } catch (err: any) {
        console.error('Error fetching patient medicines:', err)
        setErrorMsg(err.message || 'Failed to load medicines.')
      } finally {
        setLoading(false)
      }
    }

    fetchPatientMedicines()
  }, [user])

  const activeMeds = medicines.filter((m) => m.active)
  const inactiveMeds = medicines.filter((m) => !m.active)

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast Alert Banner */}
      {errorMsg && (
        <div className="toast-banner error" role="alert">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.6rem' }}>{t('patientMedicines.title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          {t('patientMedicines.subtitle')}
        </p>
      </div>

      {loading ? (
        <Card>
          <div className="empty-state">
            <span className="spinner spinner-lg" />
            <p>{t('app.actions.loading')}</p>
          </div>
        </Card>
      ) : medicines.length === 0 ? (
        <Card>
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'var(--color-primary-tint)' }}>
              <Pill size={32} color="var(--color-primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>{t('patientMedicines.empty')}</h3>
            <p>{t('patientMedicines.emptySub')}</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Medicines */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--color-green)' }}>
              {t('patientMedicines.activeList')} ({activeMeds.length})
            </h2>

            {activeMeds.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                No active medications currently prescribed.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {activeMeds.map((med) => (
                  <Card
                    key={med.id}
                    style={{
                      borderLeft: '5px solid var(--color-green)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)' }}>
                        {med.name}
                      </span>
                      <span className="badge badge-green">
                        <CheckCircle size={13} />
                        <span>{t('medicines.active')}</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{t('patientMedicines.dose')}:</span>
                      <span style={{ fontWeight: 600 }}>{med.dose}</span>
                    </div>

                    {med.instructions && (
                      <div style={{
                        background: 'var(--color-bg)',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text)',
                        marginTop: '0.2rem',
                      }}>
                        <strong>{t('patientMedicines.instructions')}:</strong> {med.instructions}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Inactive / Past Medicines */}
          {inactiveMeds.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--color-text-muted)' }}>
                {t('patientMedicines.inactiveList')} ({inactiveMeds.length})
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {inactiveMeds.map((med) => (
                  <Card
                    key={med.id}
                    style={{
                      borderLeft: '5px solid var(--color-border)',
                      opacity: 0.85,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                        {med.name}
                      </span>
                      <span className="badge badge-coral">
                        {t('medicines.inactive')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{t('patientMedicines.dose')}:</span>
                      <span>{med.dose}</span>
                    </div>

                    {med.instructions && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                        {med.instructions}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
