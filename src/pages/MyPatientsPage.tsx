import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import { type Patient, calculateAge } from '../lib/types'
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
} from 'lucide-react'

export default function MyPatientsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVillage, setSelectedVillage] = useState<string>('all')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAssignedPatients = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

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

  useEffect(() => {
    fetchAssignedPatients()
  }, [user])

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

  // Filtered patients based on search and village
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch = searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (p.phone && p.phone.includes(searchQuery.trim()))

      const matchesVillage = selectedVillage === 'all' ||
        (p.village && p.village.trim().toLowerCase() === selectedVillage.toLowerCase())

      return matchesSearch && matchesVillage
    })
  }, [patients, searchQuery, selectedVillage])

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

      {/* Header bar */}
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
            {t('patientsPage.title')}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {t('patientsPage.subtitle')} ({patients.length})
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

      {/* Search and Village Filter Toolbar */}
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

        {/* Village Filter */}
        <div style={{ flex: '0 1 200px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={18} color="var(--color-text-muted)" />
          <select
            className="select"
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            id="select-filter-village"
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
                {/* Header: Name and Age badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text)' }}>
                      {patient.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      <MapPin size={14} color="var(--color-coral)" />
                      <span>{patient.village || t('records.patientDetails.notSet')}</span>
                    </div>
                  </div>

                  <span className="badge badge-teal">
                    {age !== null ? t('patientsPage.ageYears', { age }) : (patient.gender || t('patientsPage.unspecified'))}
                  </span>
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
                  marginTop: 'auto',
                  borderTop: '1px solid var(--color-border-subtle)',
                  paddingTop: '0.65rem',
                }}>
                  {/* View Button */}
                  <button
                    onClick={() => navigate(`/asha/patients/${patient.id}`)}
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                    id={`btn-view-${patient.id}`}
                  >
                    <Eye size={15} />
                    <span>{t('app.actions.view')}</span>
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => navigate(`/asha/patients/${patient.id}/edit`)}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, border: '1px solid var(--color-border)' }}
                    id={`btn-edit-${patient.id}`}
                  >
                    <Edit2 size={15} />
                    <span>{t('app.actions.edit')}</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeletePatient(patient)}
                    disabled={deletingId === patient.id}
                    className="btn btn-danger-outline btn-sm"
                    style={{ padding: '0.4rem 0.75rem' }}
                    id={`btn-delete-${patient.id}`}
                    title={t('app.actions.delete')}
                  >
                    <Trash2 size={15} />
                    <span>{t('app.actions.delete')}</span>
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
