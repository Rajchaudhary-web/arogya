import { useEffect, useState } from 'react'
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
  ShieldAlert,
  MapPin,
  Phone,
  User,
  PlusCircle,
  X,
  Save,
  CheckCircle,
} from 'lucide-react'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default function PatientRecordsPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()

  const [patientRecord, setPatientRecord] = useState<Patient | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form state for patient record upload / edit
  const [showForm, setShowForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<HistoryEntryType>('report')
  const [title, setTitle] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10))
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPatientAndHistory = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // Find patient record for current user: by profile_id = user.id, or id = user.id, or phone/name match
      let { data: pData } = await supabase
        .from('patients')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (!pData) {
        const { data: idMatch } = await supabase
          .from('patients')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (idMatch) pData = idMatch
      }

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

      // Fetch clinical history entries for this patient
      const targetPatientId = pData?.id || user.id
      const { data: hData, error: hErr } = await supabase
        .from('history_entries')
        .select('*')
        .eq('patient_id', targetPatientId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (hErr) throw hErr
      setHistoryEntries(hData ?? [])
    } catch (err: any) {
      console.error('Error fetching patient records:', err)
      setErrorMsg(err.message || 'Failed to load records from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatientAndHistory()
  }, [user, profile])

  const openAddForm = () => {
    setEditingEntryId(null)
    setEntryType('report')
    setTitle('')
    setEntryDate(new Date().toISOString().substring(0, 10))
    setNotes('')
    setSelectedFile(null)
    setShowForm(true)
  }

  const openEditForm = (entry: HistoryEntry) => {
    setEditingEntryId(entry.id)
    setEntryType(entry.entry_type)
    setTitle(entry.title)
    setEntryDate(entry.entry_date ? entry.entry_date.substring(0, 10) : new Date().toISOString().substring(0, 10))
    setNotes(entry.notes || '')
    setSelectedFile(null)
    setShowForm(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(t('records.fileSizeError'))
      e.target.value = ''
      setSelectedFile(null)
      return
    }

    const fileType = file.type
    const fileName = file.name.toLowerCase()
    const isValidType = ALLOWED_MIME_TYPES.includes(fileType) ||
      /\.(jpe?g|png|webp|pdf)$/i.test(fileName)

    if (!isValidType) {
      setErrorMsg(t('records.fileTypeError'))
      e.target.value = ''
      setSelectedFile(null)
      return
    }

    setErrorMsg(null)
    setSelectedFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg(t('records.titleRequired'))
      return
    }
    if (!user) return

    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const targetPatientId = patientRecord?.id || user.id

    try {
      let filePath: string | null = null
      let fileName: string | null = null
      let fileType: string | null = null

      // If a file is selected, upload to patient-files bucket
      if (selectedFile) {
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const path = `${targetPatientId}/${crypto.randomUUID()}-${cleanName}`

        const { error: uploadError } = await supabase.storage
          .from('patient-files')
          .upload(path, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          })

        if (uploadError) throw uploadError

        filePath = path
        fileName = selectedFile.name
        fileType = selectedFile.type
      }

      if (editingEntryId) {
        // Update entry
        const updatePayload: Record<string, any> = {
          entry_type: entryType,
          title: title.trim(),
          entry_date: entryDate || new Date().toISOString().substring(0, 10),
          notes: notes.trim() || null,
        }
        if (filePath) {
          updatePayload.file_path = filePath
          updatePayload.file_name = fileName
          updatePayload.file_type = fileType
        }

        const { error: updateErr } = await supabase
          .from('history_entries')
          .update(updatePayload)
          .eq('id', editingEntryId)

        if (updateErr) throw updateErr
        setSuccessMsg(t('app.feedback.saveSuccess'))
      } else {
        // Insert new entry (do NOT send added_by as it is set by the database)
        const insertPayload: Record<string, any> = {
          patient_id: targetPatientId,
          entry_type: entryType,
          title: title.trim(),
          entry_date: entryDate || new Date().toISOString().substring(0, 10),
          notes: notes.trim() || null,
          file_path: filePath,
          file_name: fileName,
          file_type: fileType,
        }

        const { error: insertErr } = await supabase
          .from('history_entries')
          .insert(insertPayload)

        if (insertErr) throw insertErr
        setSuccessMsg(t('app.feedback.saveSuccess'))
      }

      setShowForm(false)
      await fetchPatientAndHistory()
    } catch (err: any) {
      console.error('Error saving record entry:', err)
      setErrorMsg(err.message || 'Failed to save record.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEntry = async (entry: HistoryEntry) => {
    const confirmed = window.confirm(t('app.actions.confirmDelete'))
    if (!confirmed) return

    setDeletingId(entry.id)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // If entry has a file in storage, remove it as required
      if (entry.file_path) {
        await supabase.storage
          .from('patient-files')
          .remove([entry.file_path])
      }

      const { error: deleteErr } = await supabase
        .from('history_entries')
        .delete()
        .eq('id', entry.id)

      if (deleteErr) throw deleteErr
      setSuccessMsg(t('app.feedback.deleteSuccess'))
      setHistoryEntries((prev) => prev.filter((item) => item.id !== entry.id))
    } catch (err: any) {
      console.error('Error deleting record entry:', err)
      setErrorMsg(err.message || 'Failed to delete record.')
    } finally {
      setDeletingId(null)
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
      {successMsg && (
        <div className="toast-banner success" role="status">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Page Header with Prominent Add Record Button */}
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
            {t('records.title')}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {t('records.viewOnlyNote')}
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="btn btn-primary"
          id="btn-patient-add-record"
        >
          <PlusCircle size={18} />
          <span>{t('records.addRecordBtn')}</span>
        </button>
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

        {/* Details Row */}
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

      {/* Patient Add / Edit Record Form Modal Card */}
      {showForm && (
        <Card className="card-tint-navy" style={{ border: '2px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
              {editingEntryId ? t('records.editRecordBtn') : t('records.addRecordBtn')}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="btn btn-ghost btn-sm"
              style={{ minHeight: '34px', minWidth: '34px', padding: '0.2rem' }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label htmlFor="patient-entry-type">{t('patientDetail.entryForm.type')}</label>
                <select
                  id="patient-entry-type"
                  className="select"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as HistoryEntryType)}
                >
                  <option value="report">{t('patientDetail.entryTypes.report')}</option>
                  <option value="prescription">{t('patientDetail.entryTypes.prescription')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="patient-entry-date">{t('patientDetail.entryForm.date')}</label>
                <input
                  id="patient-entry-date"
                  type="date"
                  className="input"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="patient-entry-title">{t('patientDetail.entryForm.title')} *</label>
              <input
                id="patient-entry-title"
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Blood Test Report, Hospital Prescription"
                required
              />
            </div>

            <div>
              <label htmlFor="patient-entry-notes">{t('patientDetail.entryForm.notes')}</label>
              <textarea
                id="patient-entry-notes"
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Doctor recommendations, medicine list or personal remarks..."
              />
            </div>

            {/* File Upload Input */}
            <div>
              <label htmlFor="patient-file-input">{t('records.fileUploadLabel')}</label>
              <input
                id="patient-file-input"
                type="file"
                className="input"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                style={{ paddingTop: '0.6rem' }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                {t('records.fileHint')}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-ghost"
              >
                {t('app.actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                id="btn-patient-save-record"
              >
                {submitting ? (
                  <>
                    <span className="spinner" />
                    <span>{t('app.actions.uploading')}</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>{editingEntryId ? t('patientDetail.entryForm.update') : t('patientDetail.entryForm.submit')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* History Timeline Section */}
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
          currentUserId={user?.id}
          onEdit={openEditForm}
          onDelete={handleDeleteEntry}
          deletingId={deletingId}
        />
      </section>
    </div>
  )
}
