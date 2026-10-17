import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import HistoryTimeline from '../components/HistoryTimeline'
import {
  type Patient,
  type HistoryEntry,
  type HistoryEntryType,
  calculateAge,
} from '../lib/types'
import {
  ArrowLeft,
  Edit2,
  PlusCircle,
  ShieldAlert,
  CheckCircle,
  Phone,
  MapPin,
  Save,
  X,
} from 'lucide-react'

export default function AshaPatientDetailPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Entry Form modal/inline state
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<HistoryEntryType>('visit')
  const [entryTitle, setEntryTitle] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10))
  const [entryNotes, setEntryNotes] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)

  const loadPatientAndHistory = async () => {
    if (!id) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Fetch patient profile
      const { data: pData, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()

      if (pErr) throw pErr
      setPatient(pData)

      // 2. Fetch history entries (newest first)
      const { data: hData, error: hErr } = await supabase
        .from('history_entries')
        .select('*')
        .eq('patient_id', id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (hErr) throw hErr
      setHistoryEntries(hData ?? [])
    } catch (err: any) {
      console.error('Error loading patient detail:', err)
      setErrorMsg(err.message || 'Failed to load patient record.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatientAndHistory()
  }, [id])

  const openAddForm = () => {
    setEditingEntryId(null)
    setEntryType('visit')
    setEntryTitle('')
    setEntryDate(new Date().toISOString().substring(0, 10))
    setEntryNotes('')
    setShowEntryForm(true)
  }

  const openEditForm = (entry: HistoryEntry) => {
    setEditingEntryId(entry.id)
    setEntryType(entry.entry_type)
    setEntryTitle(entry.title)
    setEntryDate(entry.entry_date ? entry.entry_date.substring(0, 10) : new Date().toISOString().substring(0, 10))
    setEntryNotes(entry.notes || '')
    setShowEntryForm(true)
  }

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !user) return

    if (!entryTitle.trim()) {
      setErrorMsg('Entry title is required.')
      return
    }

    setSavingEntry(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const payload = {
        patient_id: id,
        asha_id: user.id,
        entry_type: entryType,
        title: entryTitle.trim(),
        entry_date: entryDate || new Date().toISOString().substring(0, 10),
        notes: entryNotes.trim() || null,
      }

      if (editingEntryId) {
        const { error } = await supabase
          .from('history_entries')
          .update(payload)
          .eq('id', editingEntryId)

        if (error) throw error
        setSuccessMsg(t('app.feedback.saveSuccess'))
      } else {
        const { error } = await supabase
          .from('history_entries')
          .insert(payload)

        if (error) throw error
        setSuccessMsg(t('app.feedback.saveSuccess'))
      }

      setShowEntryForm(false)
      await loadPatientAndHistory()
    } catch (err: any) {
      console.error('Error saving history entry:', err)
      setErrorMsg(err.message || 'Failed to save history entry.')
    } finally {
      setSavingEntry(false)
    }
  }

  const handleDeleteEntry = async (entry: HistoryEntry) => {
    const confirmed = window.confirm(t('app.actions.confirmDelete'))
    if (!confirmed) return

    setDeletingEntryId(entry.id)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase
        .from('history_entries')
        .delete()
        .eq('id', entry.id)

      if (error) throw error
      setSuccessMsg(t('app.feedback.deleteSuccess'))
      setHistoryEntries((prev) => prev.filter((item) => item.id !== entry.id))
    } catch (err: any) {
      console.error('Error deleting entry:', err)
      setErrorMsg(err.message || 'Failed to delete entry.')
    } finally {
      setDeletingEntryId(null)
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

  if (!patient) {
    return (
      <Card>
        <div className="empty-state">
          <ShieldAlert size={36} color="var(--color-red)" />
          <h3>{t('patientDetail.notFound')}</h3>
          <Link to="/asha/patients" className="btn btn-outline" style={{ marginTop: '1rem' }}>
            <ArrowLeft size={16} />
            <span>{t('patientDetail.backToList')}</span>
          </Link>
        </div>
      </Card>
    )
  }

  const age = calculateAge(patient.dob)

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

      {/* Top Bar with Back button and Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          onClick={() => navigate('/asha/patients')}
          className="btn btn-ghost btn-sm"
          id="btn-back-to-patients"
          style={{ padding: '0.4rem 0.75rem' }}
        >
          <ArrowLeft size={18} />
          <span>{t('patientDetail.backToList')}</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => navigate(`/asha/patients/${patient.id}/edit`)}
            className="btn btn-outline btn-sm"
            id="btn-edit-patient-top"
          >
            <Edit2 size={16} />
            <span>{t('app.actions.edit')}</span>
          </button>
          <button
            onClick={openAddForm}
            className="btn btn-primary btn-sm"
            id="btn-add-entry-top"
          >
            <PlusCircle size={16} />
            <span>{t('patientDetail.addEntry')}</span>
          </button>
        </div>
      </div>

      {/* Patient Profile Summary Card */}
      <Card style={{ borderTop: '4px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{patient.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)' }}>
              <MapPin size={16} color="var(--color-coral)" />
              <span style={{ fontWeight: 600 }}>{patient.village || t('records.patientDetails.notSet')}</span>
              <span>•</span>
              <Phone size={16} />
              <span>{patient.phone || t('records.patientDetails.notSet')}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-teal">
              {age !== null ? t('patientsPage.ageYears', { age }) : (patient.gender || t('patientsPage.unspecified'))}
            </span>
            {patient.gender && (
              <span className="badge badge-navy" style={{ textTransform: 'capitalize' }}>
                {patient.gender}
              </span>
            )}
            {patient.blood_group && (
              <span className="badge badge-coral">
                {patient.blood_group}
              </span>
            )}
          </div>
        </div>

        {/* Detailed Grid: DOB, Allergies, Birth details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
              {patient.dob ? new Date(patient.dob).toLocaleDateString() : t('records.patientDetails.notSet')}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
              {t('records.patientDetails.allergies')}
            </span>
            <span style={{ fontWeight: 600, color: patient.allergies ? 'var(--color-red)' : 'var(--color-text)' }}>
              {patient.allergies || t('records.patientDetails.none')}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
              {t('records.patientDetails.birthDetails')}
            </span>
            <span style={{ fontWeight: 600 }}>
              {patient.birth_details || t('records.patientDetails.none')}
            </span>
          </div>
        </div>
      </Card>

      {/* Add / Edit History Entry Form Modal/Card */}
      {showEntryForm && (
        <Card className="card-tint-navy" style={{ border: '2px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
              {editingEntryId ? t('patientDetail.editEntry') : t('patientDetail.addEntry')}
            </h3>
            <button
              onClick={() => setShowEntryForm(false)}
              className="btn btn-ghost btn-sm"
              style={{ minHeight: '34px', minWidth: '34px', padding: '0.2rem' }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label htmlFor="entry-type">{t('patientDetail.entryForm.type')}</label>
                <select
                  id="entry-type"
                  className="select"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as HistoryEntryType)}
                >
                  <option value="visit">{t('patientDetail.entryTypes.visit')}</option>
                  <option value="vaccination">{t('patientDetail.entryTypes.vaccination')}</option>
                  <option value="condition">{t('patientDetail.entryTypes.condition')}</option>
                  <option value="prescription">{t('patientDetail.entryTypes.prescription')}</option>
                  <option value="report">{t('patientDetail.entryTypes.report')}</option>
                  <option value="birth">{t('patientDetail.entryTypes.birth')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="entry-date">{t('patientDetail.entryForm.date')} (Backdating allowed)</label>
                <input
                  id="entry-date"
                  type="date"
                  className="input"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="entry-title">{t('patientDetail.entryForm.title')} *</label>
              <input
                id="entry-title"
                type="text"
                className="input"
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="e.g. Polio Booster Dose, Antenatal Checkup #2, Fever & Cold"
                required
              />
            </div>

            <div>
              <label htmlFor="entry-notes">{t('patientDetail.entryForm.notes')}</label>
              <textarea
                id="entry-notes"
                className="textarea"
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                placeholder="Clinical observations, dosage instructions, vitals recorded..."
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowEntryForm(false)}
                className="btn btn-ghost"
              >
                {t('app.actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={savingEntry}
                className="btn btn-primary"
                id="btn-save-entry-submit"
              >
                <Save size={16} />
                <span>
                  {savingEntry
                    ? t('app.actions.submitting')
                    : editingEntryId
                    ? t('patientDetail.entryForm.update')
                    : t('patientDetail.entryForm.submit')}
                </span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* History Timeline Section */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{t('patientDetail.timeline')}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Total recorded entries: {historyEntries.length}
            </p>
          </div>
          {!showEntryForm && (
            <button
              onClick={openAddForm}
              className="btn btn-teal btn-sm"
              id="btn-add-entry-timeline"
            >
              <PlusCircle size={16} />
              <span>{t('patientDetail.addEntry')}</span>
            </button>
          )}
        </div>

        <HistoryTimeline
          entries={historyEntries}
          isReadOnly={false}
          onEdit={openEditForm}
          onDelete={handleDeleteEntry}
          deletingId={deletingEntryId}
        />
      </section>
    </div>
  )
}
