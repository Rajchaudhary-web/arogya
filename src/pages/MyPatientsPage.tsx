import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import { type Patient, type PatientCategory, calculateAge } from '../lib/types'
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  UserPlus,
  Users,
  ShieldAlert,
  CheckCircle,
  Phone,
  MapPin,
  Calendar,
  UserCheck,
} from 'lucide-react'

export default function MyPatientsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVillage, setSelectedVillage] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Unassigned self-registered patients state
  const [unassignedPatients, setUnassignedPatients] = useState<Patient[]>([])
  const [unassignedLoading, setUnassignedLoading] = useState(true)
  const [unassignedPhoneSearch, setUnassignedPhoneSearch] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const fetchAssignedPatients = async () => {
    if (!user) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('asha_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      setPatients(data ?? [])
    } catch (err: any) {
      console.error('Error fetching assigned patients:', err)
      setErrorMsg(err.message || 'Failed to fetch patients list.')
    } finally {
      setLoading(false)
    }
  }

  const fetchUnassignedPatients = async () => {
    if (!user) return
    setUnassignedLoading(true)

    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .is('asha_id', null)
        .not('profile_id', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUnassignedPatients(data ?? [])
    } catch (err: any) {
      console.error('Error fetching unassigned patients:', err)
    } finally {
      setUnassignedLoading(false)
    }
  }

  const refreshAll = async () => {
    setErrorMsg(null)
    await Promise.all([fetchAssignedPatients(), fetchUnassignedPatients()])
  }

  useEffect(() => {
    refreshAll()
  }, [user])

  const handleClaimPatient = async (patient: Patient) => {
    if (!user) return
    setClaimingId(patient.id)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase
        .from('patients')
        .update({ asha_id: user.id })
        .eq('id', patient.id)
        .is('asha_id', null)

      if (error) throw error

      setSuccessMsg(t('asha.newSignups.claimSuccess'))
      await refreshAll()
    } catch (err: any) {
      console.error('Error claiming patient:', err)
      setErrorMsg(err.message || t('asha.newSignups.claimError'))
    } finally {
      setClaimingId(null)
    }
  }

  // Filter unassigned patients by phone number
  const filteredUnassignedPatients = useMemo(() => {
    if (!unassignedPhoneSearch.trim()) return unassignedPatients
    const query = unassignedPhoneSearch.trim().toLowerCase()
    return unassignedPatients.filter((p) => p.phone && p.phone.toLowerCase().includes(query))
  }, [unassignedPatients, unassignedPhoneSearch])

  // Extract distinct village list for dropdown filter
  const villageList = useMemo(() => {
    const villages = new Set<string>()
    patients.forEach((p) => {
      if (p.village && p.village.trim()) {
        villages.add(p.village.trim())
      }
    })
    return Array.from(villages).sort()
  }, [patients])

  // Filtered patients based on search, village, and category
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (p.phone && p.phone.includes(searchQuery.trim()))

      const matchesVillage =
        selectedVillage === 'all' ||
        (p.village && p.village.trim().toLowerCase() === selectedVillage.toLowerCase())

      const patientCat = p.category || 'general'
      const matchesCategory =
        selectedCategory === 'all' || patientCat === selectedCategory

      return matchesSearch && matchesVillage && matchesCategory
    })
  }, [patients, searchQuery, selectedVillage, selectedCategory])

  const handleDeletePatient = async (patient: Patient) => {
    const confirmed = window.confirm(
      t('app.actions.confirmDeletePatient', { name: patient.name })
    )
    if (!confirmed) return

    setDeletingId(patient.id)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patient.id)

      if (error) throw error
      setSuccessMsg(t('app.feedback.deleteSuccess'))
      setPatients((prev) => prev.filter((p) => p.id !== patient.id))
    } catch (err: any) {
      console.error('Error deleting patient:', err)
      setErrorMsg(err.message || 'Failed to delete patient.')
    } finally {
      setDeletingId(null)
    }
  }

  // Category badge helper
  const renderCategoryBadge = (cat?: PatientCategory | null) => {
    const categoryKey = cat || 'general'
    let badgeClass = 'badge-navy'
    if (categoryKey === 'pregnant') badgeClass = 'badge-saffron'
    else if (categoryKey === 'child') badgeClass = 'badge-teal'
    else if (categoryKey === 'chronic') badgeClass = 'badge-coral'

    return (
      <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
        {t(`categoryBadges.${categoryKey}`, categoryKey)}
      </span>
    )
  }

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

      {/* Page Heading & Add Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>{t('patientsPage.title')}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {t('patientsPage.subtitle')}
          </p>
        </div>

        <Link
          to="/asha/patients/add"
          className="btn btn-primary"
          id="btn-mypatients-add"
        >
          <UserPlus size={18} />
          <span>{t('asha.addPatientBtn')}</span>
        </Link>
      </div>

      {/* ── Top Section: New sign-ups waiting ── */}
      <section
        id="section-unassigned-signups"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: 'var(--color-bg)',
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} color="var(--color-teal)" />
              <span>{t('asha.newSignups.title')}</span>
              {unassignedPatients.length > 0 && (
                <span className="badge badge-teal" style={{ fontSize: '0.8rem' }}>
                  {unassignedPatients.length}
                </span>
              )}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              {t('asha.newSignups.subtitle')}
            </p>
          </div>

          {/* Phone Search Box */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
            <Phone
              size={16}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="input"
              value={unassignedPhoneSearch}
              onChange={(e) => setUnassignedPhoneSearch(e.target.value)}
              placeholder={t('asha.newSignups.searchPlaceholder')}
              style={{ paddingLeft: '2.3rem', minHeight: '48px', fontSize: '0.9rem' }}
              id="input-search-unassigned-phone"
            />
          </div>
        </div>

        {unassignedLoading ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <span className="spinner spinner-md" />
              <p>{t('app.actions.loading')}</p>
            </div>
          </Card>
        ) : filteredUnassignedPatients.length === 0 ? (
          <Card>
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <Users size={28} color="var(--color-text-muted)" style={{ opacity: 0.6 }} />
              <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {t('asha.newSignups.empty')}
              </p>
            </div>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {filteredUnassignedPatients.map((patient) => {
              const formattedDate = patient.created_at
                ? new Date(patient.created_at).toLocaleDateString()
                : '—'
              const isClaiming = claimingId === patient.id

              return (
                <Card
                  key={patient.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    borderLeft: '4px solid var(--color-teal)',
                    background: 'var(--color-white)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {patient.name}
                      </h3>
                      {patient.village && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          <MapPin size={13} color="var(--color-coral)" />
                          <span>{patient.village}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                      <Phone size={14} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        {patient.phone || '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      <Calendar size={13} />
                      <span>{t('asha.newSignups.signedUp', { date: formattedDate })}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClaimPatient(patient)}
                    disabled={isClaiming}
                    className="btn btn-teal"
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                    id={`btn-claim-patient-${patient.id}`}
                  >
                    {isClaiming ? (
                      <>
                        <span className="spinner spinner-sm" />
                        <span>{t('asha.newSignups.claiming')}</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={18} />
                        <span>{t('asha.newSignups.claim')}</span>
                      </>
                    )}
                  </button>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Search and Filters Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'center',
      }}>
        {/* Search Input */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search
            size={18}
            color="var(--color-text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('app.actions.searchPlaceholder')}
            style={{ paddingLeft: '2.5rem' }}
            id="input-search-patient"
          />
        </div>

        {/* Category Filter */}
        <div style={{ flex: '0 1 180px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={18} color="var(--color-text-muted)" />
          <select
            className="select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            id="select-filter-category"
            aria-label={t('patientsPage.filterCategory')}
          >
            <option value="all">{t('patientsPage.allCategories')}</option>
            <option value="general">{t('categories.general')}</option>
            <option value="pregnant">{t('categories.pregnant')}</option>
            <option value="child">{t('categories.child')}</option>
            <option value="chronic">{t('categories.chronic')}</option>
          </select>
        </div>

        {/* Village Filter */}
        <div style={{ flex: '0 1 180px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <select
            className="select"
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            id="select-filter-village"
            aria-label={t('patientsPage.filterVillage')}
          >
            <option value="all">{t('app.actions.allVillages')}</option>
            {villageList.map((village) => (
              <option key={village} value={village}>
                {village}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Patients List Grid */}
      {loading ? (
        <Card>
          <div className="empty-state">
            <span className="spinner spinner-lg" />
            <p>{t('app.actions.loading')}</p>
          </div>
        </Card>
      ) : filteredPatients.length === 0 ? (
        <Card>
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'var(--color-primary-tint)' }}>
              <Users size={32} color="var(--color-primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>
              {patients.length === 0 ? t('asha.emptyAssigned') : t('patientsPage.noFiltered')}
            </h3>
            {patients.length === 0 && (
              <Link to="/asha/patients/add" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                <UserPlus size={16} />
                <span>{t('asha.addPatientBtn')}</span>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '1rem',
        }}>
          {filteredPatients.map((patient) => {
            const age = calculateAge(patient.dob)
            return (
              <Card
                key={patient.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  borderTop: '3px solid var(--color-primary)',
                }}
              >
                {/* Header: Name, Location and Category Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text)' }}>
                      {patient.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      <MapPin size={14} color="var(--color-coral)" />
                      <span>{patient.village || t('records.patientDetails.notSet')}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    {renderCategoryBadge(patient.category)}
                    <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                      {age !== null ? t('patientsPage.ageYears', { age }) : (patient.gender || t('patientsPage.unspecified'))}
                    </span>
                  </div>
                </div>

                {/* Details info lines */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  background: 'var(--color-bg)',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-muted)' }}>
                    <Phone size={14} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {patient.phone || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-muted)' }}>
                    <Calendar size={14} />
                    <span>
                      {patient.dob ? new Date(patient.dob).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons (View, Edit, Delete) with icon + label */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                  marginTop: 'auto',
                }}>
                  <button
                    onClick={() => navigate(`/asha/patients/${patient.id}`)}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    title={t('app.actions.view')}
                  >
                    <Eye size={15} />
                    <span>{t('app.actions.view')}</span>
                  </button>

                  <button
                    onClick={() => navigate(`/asha/patients/${patient.id}/edit`)}
                    className="btn btn-outline btn-sm"
                    style={{ padding: '0.4rem 0.65rem' }}
                    title={t('app.actions.edit')}
                  >
                    <Edit2 size={15} />
                    <span>{t('app.actions.edit')}</span>
                  </button>

                  <button
                    onClick={() => handleDeletePatient(patient)}
                    disabled={deletingId === patient.id}
                    className="btn btn-danger-outline btn-sm"
                    style={{ padding: '0.4rem 0.65rem' }}
                    title={t('app.actions.delete')}
                  >
                    {deletingId === patient.id ? (
                      <span className="spinner spinner-sm" />
                    ) : (
                      <>
                        <Trash2 size={15} />
                        <span>{t('app.actions.delete')}</span>
                      </>
                    )}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
