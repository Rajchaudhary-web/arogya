import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import {
  type Patient,
  type VaccineScheduleItem,
  type PatientVaccination,
  type MaternalVisit,
  type HomeVisit,
  calculateAge,
} from '../lib/types'
import {
  calculateBatchedDashboardMetrics,
  calculateChildVaccineDueDate,
  computeScheduleStatus,
  type ScheduledCareItem,
} from '../lib/schedule'
import {
  Phone,
  Calendar,
  Sparkles,
  Send,
  Baby,
  Clock,
  CheckCircle,
  FileText,
  Pill,
  MessageCircle,
} from 'lucide-react'

interface AshaProfile {
  id: string
  full_name: string | null
  phone: string | null
}

interface ChildWithNextVaccine {
  patient: Patient
  age: number | null
  nextVaccine: {
    name: string
    dueDate: string
    status: string
  } | null
}

export default function PatientHome() {
  const { t, i18n } = useTranslation()
  const { profile, user } = useAuth()
  const navigate = useNavigate()

  const [selfPatient, setSelfPatient] = useState<Patient | null>(null)
  const [ashaWorker, setAshaWorker] = useState<AshaProfile | null>(null)
  const [children, setChildren] = useState<ChildWithNextVaccine[]>([])
  const [soonestItems, setSoonestItems] = useState<ScheduledCareItem[]>([])
  const [loading, setLoading] = useState(true)

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

  const loadPatientData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // 1. Fetch patient row for this logged-in patient
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

      // 2. Fetch ASHA profile if linked (patients.asha_id points to profiles.id)
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

      const childPatients = cData ?? []
      const allFamily = [pData, ...childPatients]
      const allFamilyIds = allFamily.map((p) => p.id)

      // 4. Batch query reference vaccine schedule
      const { data: vsData } = await supabase
        .from('vaccine_schedule')
        .select('id, code, name, age_label, due_after_days')
        .order('sort_order', { ascending: true })

      const vaccineSchedule = (vsData ?? []) as VaccineScheduleItem[]

      // 5. Batch query vaccinations, maternal visits, home visits for family
      let pVaccinations: PatientVaccination[] = []
      let mVisi: MaternalVisit[] = []
      let hVisi: HomeVisit[] = []

      if (allFamilyIds.length > 0) {
        const { data: pvData } = await supabase
          .from('patient_vaccinations')
          .select('id, patient_id, schedule_id, given_on')
          .in('patient_id', allFamilyIds)

        pVaccinations = (pvData ?? []) as PatientVaccination[]

        const { data: mvData } = await supabase
          .from('maternal_visits')
          .select('id, patient_id, visit_code, done_on')
          .in('patient_id', allFamilyIds)

        mVisi = (mvData ?? []) as MaternalVisit[]

        const { data: hvData } = await supabase
          .from('home_visits')
          .select('id, patient_id, next_visit_date, refer, created_at')
          .in('patient_id', allFamilyIds)

        hVisi = (hvData ?? []) as HomeVisit[]
      }

      // 6. Calculate all care items across patient and children
      const metrics = calculateBatchedDashboardMetrics({
        patients: allFamily,
        vaccineSchedule,
        patientVaccinations: pVaccinations,
        maternalVisits: mVisi,
        homeVisits: hVisi,
      })

      // Soonest 3 items
      setSoonestItems(metrics.allPendingItems.slice(0, 3))

      // 7. Calculate "My Children" list with age and next vaccine due
      const pvSet = new Set<string>()
      pVaccinations.forEach((pv) => pvSet.add(`${pv.patient_id}_${pv.schedule_id}`))

      const enrichedChildren: ChildWithNextVaccine[] = childPatients.map((child) => {
        const age = calculateAge(child.dob)
        let nextVaccine: ChildWithNextVaccine['nextVaccine'] = null

        if (child.dob && vaccineSchedule.length > 0) {
          for (const v of vaccineSchedule) {
            if (!pvSet.has(`${child.id}_${v.id}`)) {
              const dueDate = calculateChildVaccineDueDate(child.dob, v.due_after_days)
              if (dueDate) {
                const status = computeScheduleStatus(dueDate, false)
                nextVaccine = {
                  name: v.name,
                  dueDate,
                  status,
                }
                break // soonest pending vaccine found (vaccineSchedule sorted by sort_order)
              }
            }
          }
        }

        return {
          patient: child,
          age,
          nextVaccine,
        }
      })

      setChildren(enrichedChildren)
    } catch (err: any) {
      console.error('Error loading patient home:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatientData()
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0] ?? '…'
  const categoryKey = selfPatient?.category || 'general'
  const rawTips = (t(`patientHome.categoryTips.${categoryKey}`, { returnObjects: true }) as string[]) || []
  const categoryTips = Array.isArray(rawTips) ? rawTips : []

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
      {/* ── Greeting Header ─────────────────────────────────────── */}
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

      {/* ── ASHA Didi Call & Request Visit Action Banner ─────────── */}
      <Card style={{
        background: ashaWorker?.phone ? 'var(--color-teal-tint)' : 'var(--color-yellow-tint)',
        border: `1.5px solid ${ashaWorker?.phone ? 'var(--color-teal)' : '#FCE8B8'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          {ashaWorker?.phone ? (
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-teal)', textTransform: 'uppercase' }}>
                Your Assigned Community Worker
              </span>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text)', marginTop: '0.15rem' }}>
                ASHA Didi: <strong>{ashaWorker.full_name || 'ASHA Worker'}</strong>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Available for maternal care, immunization, and community health guidance.
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#936300' }}>
                {t('patientHome.ashaNotLinked')}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Your healthcare provider will link your local ASHA worker soon.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          {ashaWorker?.phone && (
            <a
              href={`tel:${ashaWorker.phone}`}
              className="btn btn-teal"
              id="btn-call-asha"
              style={{ minHeight: '48px', padding: '0.6rem 1.25rem', fontSize: '1rem' }}
            >
              <Phone size={18} />
              <span>{t('patientHome.callAshaBtn')} ({ashaWorker.phone})</span>
            </a>
          )}

          <button
            onClick={() => navigate('/ask-visit')}
            className="btn btn-primary"
            id="btn-request-visit"
            style={{ minHeight: '48px', padding: '0.6rem 1.25rem', fontSize: '1rem' }}
          >
            <Send size={18} />
            <span>{t('patientHome.requestVisitBtn')}</span>
          </button>
        </div>
      </Card>

      {/* ── SECTION 1: "What's Next" Card ────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>{t('patientHome.whatsNext')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {t('patientHome.whatsNextSub')}
          </p>
        </div>

        {soonestItems.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.75rem' }}>
              <CheckCircle size={32} color="var(--color-green)" />
              <p style={{ fontWeight: 600, fontSize: '1.05rem' }}>{t('patientHome.nothingDue')}</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {soonestItems.map((item, idx) => (
              <Card
                key={`${item.patientId}_${item.itemCode}_${idx}`}
                style={{
                  borderLeft: `5px solid ${item.status === 'overdue' ? 'var(--color-red)' : 'var(--color-primary)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Person's name in large text */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {item.patientName}
                  </span>
                  <span className={`badge ${
                    item.status === 'overdue' ? 'badge-red' : item.status === 'due_this_week' ? 'badge-amber' : 'badge-navy'
                  }`}>
                    {item.status === 'overdue' ? t('tracker.status.overdue') : item.status === 'due_this_week' ? t('tracker.status.due_this_week') : t('tracker.status.upcoming')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                  <Clock size={16} color="var(--color-text-muted)" />
                  <span>{item.itemTitle}</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {t('tracker.dueDate')}: <strong>{new Date(item.dueDate).toLocaleDateString()}</strong>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 2: "My Children" (Only if guardian_patient_id rows exist) ── */}
      {children.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-teal)' }}>
              {t('patientHome.myChildren')} ({children.length})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {t('patientHome.myChildrenSub')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {children.map(({ patient: child, age, nextVaccine }) => (
              <Card
                key={child.id}
                style={{
                  borderTop: '4px solid var(--color-teal)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-teal-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Baby size={18} color="var(--color-teal)" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{child.name}</span>
                  </div>

                  <span className="badge badge-teal">
                    {age !== null ? t('patientsPage.ageYears', { age }) : (child.gender || 'Child')}
                  </span>
                </div>

                {/* Next vaccine due */}
                <div style={{
                  background: 'var(--color-bg)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  fontSize: '0.875rem',
                }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    {t('patientHome.nextVaccineDue')}:
                  </span>
                  {nextVaccine ? (
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{nextVaccine.name}</span>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                        Due: {new Date(nextVaccine.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>
                      ✓ {t('patientHome.allVaccinesDone')}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION 3: Category Health Tips Card ─────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>{t('patientHome.healthTips')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Personalized advice for: <strong style={{ textTransform: 'capitalize' }}>{t(`categories.${categoryKey}`, categoryKey)}</strong>
          </p>
        </div>

        <Card className="card-tint-yellow" style={{ border: '1.5px solid #FCE8B8' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {categoryTips.map((tip, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Sparkles size={18} color="#B48200" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                  {tip}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ── Quick Nav Cards (Records, Medicines, Ask) ────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
      }}>
        <Link
          to="/records"
          className="home-tile card-tint-saffron"
          style={{ textDecoration: 'none' }}
        >
          <div className="tile-icon-circle">
            <FileText size={28} color="var(--color-accent)" />
          </div>
          <span style={{ fontWeight: 700 }}>{t('app.nav.records')}</span>
        </Link>

        <Link
          to="/medicines"
          className="home-tile card-tint-navy"
          style={{ textDecoration: 'none' }}
        >
          <div className="tile-icon-circle">
            <Pill size={28} color="var(--color-primary)" />
          </div>
          <span style={{ fontWeight: 700 }}>{t('app.nav.medicines')}</span>
        </Link>

        <Link
          to="/ask"
          className="home-tile card-tint-coral"
          style={{ textDecoration: 'none' }}
        >
          <div className="tile-icon-circle">
            <MessageCircle size={28} color="var(--color-coral)" />
          </div>
          <span style={{ fontWeight: 700 }}>{t('app.nav.ask')}</span>
        </Link>
      </div>
    </div>
  )
}
