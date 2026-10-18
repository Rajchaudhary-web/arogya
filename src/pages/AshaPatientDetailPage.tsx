import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import HistoryTimeline from '../components/HistoryTimeline'
import type {
  Patient,
  HistoryEntry,
  HistoryEntryType,
  Medicine,
  VaccineScheduleItem,
  PatientVaccination,
  MaternalVisit,
  MaternalVisitCode,
  HomeVisit,
  HomeVisitPurpose,
} from '../lib/types'
import {
  calculateAge,
} from '../lib/types'
import {
  calculateChildVaccineDueDate,
  calculateMaternalDueDates,
  computeScheduleStatus,
  computeFollowUpStatus,
  shouldSuggestReferral,
  getTodayDateString,
  type ScheduleStatus,
} from '../lib/schedule'
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
  FileText,
  Pill,
  Home,
  Clock,
  AlertCircle,
  Check,
  RotateCcw,
  Trash2,
  Activity,
  HeartPulse,
} from 'lucide-react'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

type ActiveTab = 'overview' | 'medicines' | 'tracker' | 'visits'

export default function AshaPatientDetailPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Tab 1: Overview / Timeline State ──
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<HistoryEntryType>('visit')
  const [entryTitle, setEntryTitle] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10))
  const [entryNotes, setEntryNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [savingEntry, setSavingEntry] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)

  // ── Tab 2: Medicines State (Plain CRUD) ──
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loadingMedicines, setLoadingMedicines] = useState(false)
  const [showMedForm, setShowMedForm] = useState(false)
  const [editingMedId, setEditingMedId] = useState<string | null>(null)
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medInstructions, setMedInstructions] = useState('')
  const [medActive, setMedActive] = useState(true)
  const [savingMed, setSavingMed] = useState(false)
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null)

  // ── Tab 3: Tracker State ──
  const [vaccineSchedule, setVaccineSchedule] = useState<VaccineScheduleItem[]>([])
  const [patientVaccinations, setPatientVaccinations] = useState<PatientVaccination[]>([])
  const [maternalVisits, setMaternalVisits] = useState<MaternalVisit[]>([])
  const [loadingTracker, setLoadingTracker] = useState(false)
  const [markingVaccineId, setMarkingVaccineId] = useState<number | null>(null)
  const [vaccineGivenDate, setVaccineGivenDate] = useState(getTodayDateString())
  const [vaccineNotes, setVaccineNotes] = useState('')
  const [markingMaternalCode, setMarkingMaternalCode] = useState<MaternalVisitCode | null>(null)
  const [maternalDoneDate, setMaternalDoneDate] = useState(getTodayDateString())
  const [maternalNotes, setMaternalNotes] = useState('')
  const [trackerActionLoading, setTrackerActionLoading] = useState(false)

  // ── Tab 4: Home Visits State ──
  const [homeVisits, setHomeVisits] = useState<HomeVisit[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [visitDate, setVisitDate] = useState(getTodayDateString())
  const [visitPurpose, setVisitPurpose] = useState<HomeVisitPurpose>('routine')
  const [visitNotes, setVisitNotes] = useState('')
  const [visitBpSys, setVisitBpSys] = useState<string>('')
  const [visitBpDia, setVisitBpDia] = useState<string>('')
  const [visitWeight, setVisitWeight] = useState<string>('')
  const [visitSugar, setVisitSugar] = useState<string>('')
  const [visitNextDate, setVisitNextDate] = useState<string>('')
  const [visitRefer, setVisitRefer] = useState(false)
  const [savingVisit, setSavingVisit] = useState(false)

  // Compute refer suggestion dynamically as user types vitals
  const sysNum = visitBpSys ? parseFloat(visitBpSys) : null
  const diaNum = visitBpDia ? parseFloat(visitBpDia) : null
  const sugNum = visitSugar ? parseFloat(visitSugar) : null
  const referralSuggested = shouldSuggestReferral(sysNum, diaNum, sugNum)

  // ── Initial Fetch: Patient Profile & History Entries ──
  const loadPatientAndHistory = async () => {
    if (!id) return
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data: pData, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()

      if (pErr) throw pErr
      setPatient(pData)

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

  // ── Fetch Medicines ──
  const loadMedicines = async () => {
    if (!id) return
    setLoadingMedicines(true)
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMedicines(data ?? [])
    } catch (err: any) {
      console.error('Error loading medicines:', err)
    } finally {
      setLoadingMedicines(false)
    }
  }

  // ── Fetch Tracker Data (Vaccines or Maternal Visits) ──
  const loadTrackerData = async () => {
    if (!id) return
    setLoadingTracker(true)
    try {
      // 1. Vaccine reference schedule & patient vaccinations
      const { data: vsData } = await supabase
        .from('vaccine_schedule')
        .select('*')
        .order('sort_order', { ascending: true })

      setVaccineSchedule(vsData ?? [])

      const { data: pvData } = await supabase
        .from('patient_vaccinations')
        .select('*')
        .eq('patient_id', id)

      setPatientVaccinations(pvData ?? [])

      // 2. Maternal visits
      const { data: mvData } = await supabase
        .from('maternal_visits')
        .select('*')
        .eq('patient_id', id)

      setMaternalVisits(mvData ?? [])

      // 3. Home visits (for next_visit_date follow-up)
      const { data: hvData } = await supabase
        .from('home_visits')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false })

      setHomeVisits(hvData ?? [])
    } catch (err: any) {
      console.error('Error loading tracker data:', err)
    } finally {
      setLoadingTracker(false)
    }
  }

  // ── Fetch Home Visits ──
  const loadHomeVisits = async () => {
    if (!id) return
    setLoadingVisits(true)
    try {
      const { data, error } = await supabase
        .from('home_visits')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false })

      if (error) throw error
      setHomeVisits(data ?? [])
    } catch (err: any) {
      console.error('Error loading home visits:', err)
    } finally {
      setLoadingVisits(false)
    }
  }

  // Reload when switching tabs
  useEffect(() => {
    if (activeTab === 'medicines') loadMedicines()
    else if (activeTab === 'tracker') loadTrackerData()
    else if (activeTab === 'visits') loadHomeVisits()
  }, [activeTab, id])

  // ── TAB 1 ACTIONS: History Entry Form ──
  const openAddForm = () => {
    setEditingEntryId(null)
    setEntryType('visit')
    setEntryTitle('')
    setEntryDate(new Date().toISOString().substring(0, 10))
    setEntryNotes('')
    setSelectedFile(null)
    setShowEntryForm(true)
  }

  const openEditForm = (entry: HistoryEntry) => {
    setEditingEntryId(entry.id)
    setEntryType(entry.entry_type)
    setEntryTitle(entry.title)
    setEntryDate(entry.entry_date ? entry.entry_date.substring(0, 10) : new Date().toISOString().substring(0, 10))
    setEntryNotes(entry.notes || '')
    setSelectedFile(null)
    setShowEntryForm(true)
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

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !user) return

    if (!entryTitle.trim()) {
      setErrorMsg(t('records.titleRequired'))
      return
    }

    setSavingEntry(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      let filePath: string | null = null
      let fileName: string | null = null
      let fileType: string | null = null

      if (selectedFile) {
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const path = `${id}/${crypto.randomUUID()}-${cleanName}`

        const { error: uploadErr } = await supabase.storage
          .from('patient-files')
          .upload(path, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          })

        if (uploadErr) throw uploadErr

        filePath = path
        fileName = selectedFile.name
        fileType = selectedFile.type
      }

      if (editingEntryId) {
        const updatePayload: Record<string, any> = {
          entry_type: entryType,
          title: entryTitle.trim(),
          entry_date: entryDate || new Date().toISOString().substring(0, 10),
          notes: entryNotes.trim() || null,
        }
        if (filePath) {
          updatePayload.file_path = filePath
          updatePayload.file_name = fileName
          updatePayload.file_type = fileType
        }

        const { error } = await supabase
          .from('history_entries')
          .update(updatePayload)
          .eq('id', editingEntryId)

        if (error) throw error
        setSuccessMsg(t('app.feedback.saveSuccess'))
      } else {
        const insertPayload: Record<string, any> = {
          patient_id: id,
          entry_type: entryType,
          title: entryTitle.trim(),
          entry_date: entryDate || new Date().toISOString().substring(0, 10),
          notes: entryNotes.trim() || null,
          file_path: filePath,
          file_name: fileName,
          file_type: fileType,
        }

        const { error } = await supabase
          .from('history_entries')
          .insert(insertPayload)

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
      if (entry.file_path) {
        await supabase.storage
          .from('patient-files')
          .remove([entry.file_path])
      }

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

  // ── TAB 2 ACTIONS: Medicines CRUD ──
  const openAddMed = () => {
    setEditingMedId(null)
    setMedName('')
    setMedDose('')
    setMedInstructions('')
    setMedActive(true)
    setShowMedForm(true)
  }

  const openEditMed = (m: Medicine) => {
    setEditingMedId(m.id)
    setMedName(m.name)
    setMedDose(m.dose)
    setMedInstructions(m.instructions || '')
    setMedActive(m.active)
    setShowMedForm(true)
  }

  const handleSaveMed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !medName.trim()) return

    setSavingMed(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const payload = {
        patient_id: id,
        name: medName.trim(),
        dose: medDose.trim(),
        instructions: medInstructions.trim() || null,
        active: medActive,
      }

      if (editingMedId) {
        const { error } = await supabase
          .from('medicines')
          .update(payload)
          .eq('id', editingMedId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('medicines')
          .insert(payload)
        if (error) throw error
      }

      setSuccessMsg(t('app.feedback.saveSuccess'))
      setShowMedForm(false)
      loadMedicines()
    } catch (err: any) {
      console.error('Error saving medicine:', err)
      setErrorMsg(err.message || 'Failed to save medicine.')
    } finally {
      setSavingMed(false)
    }
  }

  const handleDeleteMed = async (medId: string) => {
    if (!window.confirm(t('app.actions.confirmDelete'))) return
    setDeletingMedId(medId)
    try {
      const { error } = await supabase
        .from('medicines')
        .delete()
        .eq('id', medId)
      if (error) throw error
      setSuccessMsg(t('app.feedback.deleteSuccess'))
      setMedicines((prev) => prev.filter((m) => m.id !== medId))
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete medicine.')
    } finally {
      setDeletingMedId(null)
    }
  }

  // ── TAB 3 ACTIONS: Tracker (Vaccinations & Maternal Visits) ──
  const handleMarkVaccineGiven = async (scheduleId: number) => {
    if (!id || !user) return
    setTrackerActionLoading(true)
    setErrorMsg(null)
    try {
      const { error } = await supabase
        .from('patient_vaccinations')
        .insert({
          patient_id: id,
          schedule_id: scheduleId,
          given_on: vaccineGivenDate || getTodayDateString(),
          notes: vaccineNotes.trim() || null,
          given_by: user.id,
        })
      if (error) throw error
      setSuccessMsg(t('app.feedback.saveSuccess'))
      setMarkingVaccineId(null)
      setVaccineNotes('')
      loadTrackerData()
    } catch (err: any) {
      console.error('Error recording vaccination:', err)
      setErrorMsg(err.message || 'Failed to record vaccination.')
    } finally {
      setTrackerActionLoading(false)
    }
  }

  const handleUndoVaccine = async (vaccinationRowId: string) => {
    if (!window.confirm(t('app.actions.confirmDelete'))) return
    setTrackerActionLoading(true)
    try {
      const { error } = await supabase
        .from('patient_vaccinations')
        .delete()
        .eq('id', vaccinationRowId)
      if (error) throw error
      setSuccessMsg(t('app.feedback.deleteSuccess'))
      loadTrackerData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to undo vaccination.')
    } finally {
      setTrackerActionLoading(false)
    }
  }

  const handleMarkMaternalDone = async (visitCode: MaternalVisitCode) => {
    if (!id) return
    setTrackerActionLoading(true)
    setErrorMsg(null)
    try {
      const { error } = await supabase
        .from('maternal_visits')
        .insert({
          patient_id: id,
          visit_code: visitCode,
          done_on: maternalDoneDate || getTodayDateString(),
          notes: maternalNotes.trim() || null,
        })
      if (error) throw error
      setSuccessMsg(t('app.feedback.saveSuccess'))
      setMarkingMaternalCode(null)
      setMaternalNotes('')
      loadTrackerData()
    } catch (err: any) {
      console.error('Error recording maternal visit:', err)
      setErrorMsg(err.message || 'Failed to record maternal visit.')
    } finally {
      setTrackerActionLoading(false)
    }
  }

  const handleUndoMaternal = async (visitId: string) => {
    if (!window.confirm(t('app.actions.confirmDelete'))) return
    setTrackerActionLoading(true)
    try {
      const { error } = await supabase
        .from('maternal_visits')
        .delete()
        .eq('id', visitId)
      if (error) throw error
      setSuccessMsg(t('app.feedback.deleteSuccess'))
      loadTrackerData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to undo maternal visit.')
    } finally {
      setTrackerActionLoading(false)
    }
  }

  // ── TAB 4 ACTIONS: Home Visits ──
  const openAddHomeVisit = () => {
    setVisitDate(getTodayDateString())
    setVisitPurpose('routine')
    setVisitNotes('')
    setVisitBpSys('')
    setVisitBpDia('')
    setVisitWeight('')
    setVisitSugar('')
    setVisitNextDate('')
    setVisitRefer(false)
    setShowVisitForm(true)
  }

  const handleSaveHomeVisit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !user) return

    setSavingVisit(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const payload = {
        patient_id: id,
        visit_date: visitDate || getTodayDateString(),
        purpose: visitPurpose,
        notes: visitNotes.trim() || null,
        bp_systolic: visitBpSys ? parseInt(visitBpSys, 10) : null,
        bp_diastolic: visitBpDia ? parseInt(visitBpDia, 10) : null,
        weight_kg: visitWeight ? parseFloat(visitWeight) : null,
        sugar_mgdl: visitSugar ? parseFloat(visitSugar) : null,
        next_visit_date: visitNextDate || null,
        refer: visitRefer,
        created_by: user.id,
      }

      const { error } = await supabase
        .from('home_visits')
        .insert(payload)

      if (error) throw error
      setSuccessMsg(t('app.feedback.saveSuccess'))
      setShowVisitForm(false)
      loadHomeVisits()
    } catch (err: any) {
      console.error('Error recording home visit:', err)
      setErrorMsg(err.message || 'Failed to record home visit.')
    } finally {
      setSavingVisit(false)
    }
  }

  // Render Status Badge helper for Tracker
  const renderStatusBadge = (status: ScheduleStatus) => {
    let icon = <Clock size={14} />
    let badgeClass = 'badge-navy'
    let label = t('tracker.status.upcoming')

    if (status === 'given') {
      icon = <Check size={14} />
      badgeClass = 'badge-green'
      label = t('tracker.status.given')
    } else if (status === 'overdue') {
      icon = <AlertCircle size={14} />
      badgeClass = 'badge-red'
      label = t('tracker.status.overdue')
    } else if (status === 'due_this_week') {
      icon = <AlertCircle size={14} />
      badgeClass = 'badge-amber'
      label = t('tracker.status.due_this_week')
    }

    return (
      <span className={`badge ${badgeClass}`}>
        {icon}
        <span>{label}</span>
      </span>
    )
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
  const categoryKey = patient.category || 'general'

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
        </div>
      </div>

      {/* Patient Profile Summary Card */}
      <Card style={{ borderTop: '4px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{patient.name}</h1>
              <span className={`badge ${
                categoryKey === 'pregnant' ? 'badge-saffron' :
                categoryKey === 'child' ? 'badge-teal' :
                categoryKey === 'chronic' ? 'badge-coral' : 'badge-navy'
              }`}>
                {t(`categoryBadges.${categoryKey}`, categoryKey)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
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

        {/* Detailed Grid: Category specials, DOB, Allergies, Birth details */}
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
              {patient.dob ? new Date(patient.dob).toLocaleDateString() : t('records.patientDetails.notSet')}
            </span>
          </div>

          {patient.category === 'pregnant' && (
            <>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
                  {t('addPatient.form.edd')}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                  {patient.edd ? new Date(patient.edd).toLocaleDateString() : t('records.patientDetails.notSet')}
                </span>
              </div>
              {patient.delivery_hospital && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
                    {t('addPatient.form.deliveryHospital')}
                  </span>
                  <span style={{ fontWeight: 600 }}>{patient.delivery_hospital}</span>
                </div>
              )}
              {patient.delivery_date && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>
                    {t('addPatient.form.deliveryDate')}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-green)' }}>
                    {new Date(patient.delivery_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}

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

      {/* 4 Tabs Navigation Bar */}
      <div className="tab-nav-bar" role="tablist" aria-label="Patient Detail Tabs">
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FileText size={18} />
          <span>{t('patientDetail.tabs.timeline')}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'medicines'}
          className={`tab-btn ${activeTab === 'medicines' ? 'active' : ''}`}
          onClick={() => setActiveTab('medicines')}
        >
          <Pill size={18} />
          <span>{t('patientDetail.tabs.medicines')}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'tracker'}
          className={`tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          <Activity size={18} />
          <span>{t('patientDetail.tabs.tracker')}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'visits'}
          className={`tab-btn ${activeTab === 'visits' ? 'active' : ''}`}
          onClick={() => setActiveTab('visits')}
        >
          <Home size={18} />
          <span>{t('patientDetail.tabs.visits')}</span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW / TIMELINE (Existing)
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                    <label htmlFor="entry-date">{t('patientDetail.entryForm.date')}</label>
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

                <div>
                  <label htmlFor="entry-file-input">{t('patientDetail.entryForm.file')}</label>
                  <input
                    id="entry-file-input"
                    type="file"
                    className="input"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    style={{ paddingTop: '0.6rem' }}
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                    {t('patientDetail.entryForm.fileHint')}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
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
                    {savingEntry ? (
                      <>
                        <span className="spinner" />
                        <span>{t('app.actions.uploading')}</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>
                          {editingEntryId
                            ? t('patientDetail.entryForm.update')
                            : t('patientDetail.entryForm.submit')}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </Card>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            patientProfileId={patient.profile_id}
            onEdit={openEditForm}
            onDelete={handleDeleteEntry}
            deletingId={deletingEntryId}
          />
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 2: MEDICINES (Plain CRUD)
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'medicines' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>{t('medicines.title')}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {t('medicines.subtitle')}
              </p>
            </div>
            {!showMedForm && (
              <button onClick={openAddMed} className="btn btn-primary btn-sm" id="btn-add-medicine">
                <PlusCircle size={16} />
                <span>{t('medicines.addBtn')}</span>
              </button>
            )}
          </div>

          {/* Inline Add / Edit Medicine Form */}
          {showMedForm && (
            <Card className="card-tint-navy" style={{ border: '2px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--color-primary)' }}>
                  {editingMedId ? t('medicines.editBtn') : t('medicines.addBtn')}
                </h3>
                <button
                  onClick={() => setShowMedForm(false)}
                  className="btn btn-ghost btn-sm"
                  style={{ minHeight: '34px', minWidth: '34px', padding: '0.2rem' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveMed} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label htmlFor="med-name">{t('medicines.name')} *</label>
                    <input
                      id="med-name"
                      type="text"
                      className="input"
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      placeholder="e.g. Paracetamol / IFA Tablets / Amlodipine"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="med-dose">{t('medicines.dose')} *</label>
                    <input
                      id="med-dose"
                      type="text"
                      className="input"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                      placeholder="e.g. 500mg, 1 tab, 5ml"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="med-instructions">{t('medicines.instructions')}</label>
                  <input
                    id="med-instructions"
                    type="text"
                    className="input"
                    value={medInstructions}
                    onChange={(e) => setMedInstructions(e.target.value)}
                    placeholder="e.g. Once daily after dinner / Take with water"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <input
                    id="med-active"
                    type="checkbox"
                    checked={medActive}
                    onChange={(e) => setMedActive(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="med-active" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                    {t('medicines.active')}
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowMedForm(false)} className="btn btn-ghost">
                    {t('app.actions.cancel')}
                  </button>
                  <button type="submit" disabled={savingMed} className="btn btn-primary" id="btn-save-medicine-submit">
                    <Save size={16} />
                    <span>{t('medicines.saveBtn')}</span>
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Medicines List */}
          {loadingMedicines ? (
            <Card>
              <div className="empty-state">
                <span className="spinner spinner-lg" />
                <p>{t('app.actions.loading')}</p>
              </div>
            </Card>
          ) : medicines.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Pill size={36} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.1rem' }}>{t('medicines.empty')}</h3>
                <p>{t('medicines.emptySub')}</p>
                <button onClick={openAddMed} className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                  <PlusCircle size={16} />
                  <span>{t('medicines.addBtn')}</span>
                </button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {medicines.map((m) => (
                <Card
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    borderLeft: `5px solid ${m.active ? 'var(--color-green)' : 'var(--color-border)'}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{m.name}</h3>
                      <span className="badge badge-navy" style={{ fontSize: '0.8rem' }}>{m.dose}</span>
                      <span className={`badge ${m.active ? 'badge-green' : 'badge-coral'}`}>
                        {m.active ? t('medicines.active') : t('medicines.inactive')}
                      </span>
                    </div>
                    {m.instructions && (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                        {m.instructions}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => openEditMed(m)}
                      className="btn btn-outline btn-sm"
                      title={t('app.actions.edit')}
                    >
                      <Edit2 size={15} />
                      <span>{t('app.actions.edit')}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteMed(m.id)}
                      disabled={deletingMedId === m.id}
                      className="btn btn-danger-outline btn-sm"
                      title={t('app.actions.delete')}
                    >
                      <Trash2 size={15} />
                      <span>{t('app.actions.delete')}</span>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 3: SCHEDULE TRACKER (Child / Pregnant / Other)
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'tracker' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loadingTracker ? (
            <Card>
              <div className="empty-state">
                <span className="spinner spinner-lg" />
                <p>{t('app.actions.loading')}</p>
              </div>
            </Card>
          ) : categoryKey === 'child' ? (
            /* ── CHILD VACCINATION TRACKER ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem' }}>{t('tracker.childTitle')}</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString() : t('tracker.noDobSet')}
                  </p>
                </div>
              </div>

              {!patient.dob && (
                <div className="toast-banner error">
                  <AlertCircle size={18} />
                  <span>{t('tracker.noDobSet')}</span>
                </div>
              )}

              {/* Group vaccine items by age_label */}
              {vaccineSchedule.length === 0 ? (
                <Card>
                  <div className="empty-state">
                    <p>No vaccine schedule data loaded.</p>
                  </div>
                </Card>
              ) : (
                (() => {
                  // Grouping
                  const groups: Record<string, VaccineScheduleItem[]> = {}
                  vaccineSchedule.forEach((v) => {
                    if (!groups[v.age_label]) groups[v.age_label] = []
                    groups[v.age_label].push(v)
                  })

                  // Vaccination map
                  const pvMap = new Map<number, PatientVaccination>()
                  patientVaccinations.forEach((pv) => pvMap.set(pv.schedule_id, pv))

                  return Object.entries(groups).map(([ageGroup, items]) => (
                    <Card key={ageGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{
                        background: 'var(--color-teal-tint)',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        color: 'var(--color-teal)',
                        fontSize: '0.95rem',
                      }}>
                        {ageGroup}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map((item) => {
                          const record = pvMap.get(item.id)
                          const isGiven = Boolean(record)
                          const dueDate = calculateChildVaccineDueDate(patient.dob, item.due_after_days)
                          const status = computeScheduleStatus(dueDate, isGiven)
                          const vaccineName = t(`vaccines.${item.code}`, item.name)

                          return (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                padding: '0.65rem 0.75rem',
                                background: isGiven ? 'var(--color-green-tint)' : 'var(--color-bg)',
                                borderRadius: '10px',
                                border: '1px solid var(--color-border-subtle)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                    {vaccineName}
                                  </span>
                                  {renderStatusBadge(status)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                                  {isGiven ? (
                                    <span>
                                      {t('tracker.givenOn')}: <strong>{new Date(record!.given_on).toLocaleDateString()}</strong>
                                      {record?.notes ? ` • ${record.notes}` : ''}
                                    </span>
                                  ) : (
                                    <span>
                                      {t('tracker.dueDate')}: <strong>{dueDate ? new Date(dueDate).toLocaleDateString() : '—'}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isGiven ? (
                                  <button
                                    onClick={() => handleUndoVaccine(record!.id)}
                                    disabled={trackerActionLoading}
                                    className="btn btn-ghost btn-sm"
                                    title={t('tracker.undo')}
                                    style={{ color: 'var(--color-red)' }}
                                  >
                                    <RotateCcw size={15} />
                                    <span>{t('tracker.undo')}</span>
                                  </button>
                                ) : markingVaccineId === item.id ? (
                                  /* Inline Mark Form */
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <input
                                      type="date"
                                      className="input"
                                      style={{ minHeight: '38px', padding: '0.3rem 0.6rem', width: '140px' }}
                                      value={vaccineGivenDate}
                                      onChange={(e) => setVaccineGivenDate(e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      className="input"
                                      style={{ minHeight: '38px', padding: '0.3rem 0.6rem', width: '140px' }}
                                      placeholder={t('tracker.notes')}
                                      value={vaccineNotes}
                                      onChange={(e) => setVaccineNotes(e.target.value)}
                                    />
                                    <button
                                      onClick={() => handleMarkVaccineGiven(item.id)}
                                      disabled={trackerActionLoading}
                                      className="btn btn-primary btn-sm"
                                    >
                                      <Check size={15} />
                                      <span>{t('tracker.markGiven')}</span>
                                    </button>
                                    <button
                                      onClick={() => setMarkingVaccineId(null)}
                                      className="btn btn-ghost btn-sm"
                                    >
                                      {t('app.actions.cancel')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setMarkingVaccineId(item.id)
                                      setVaccineGivenDate(getTodayDateString())
                                      setVaccineNotes('')
                                    }}
                                    className="btn btn-teal btn-sm"
                                  >
                                    <Check size={15} />
                                    <span>{t('tracker.markGiven')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  ))
                })()
              )}
            </div>
          ) : categoryKey === 'pregnant' ? (
            /* ── PREGNANT MATERNAL CHECKLIST (ANC & PNC) ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>{t('tracker.pregnantTitle')}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  EDD: {patient.edd ? new Date(patient.edd).toLocaleDateString() : t('tracker.noEddSet')}
                </p>
              </div>

              {!patient.edd && (
                <div className="toast-banner error">
                  <AlertCircle size={18} />
                  <span>{t('tracker.noEddSet')}</span>
                </div>
              )}

              {(() => {
                const deadlines = calculateMaternalDueDates(patient.edd, patient.delivery_date)
                const mvMap = new Map<string, MaternalVisit>()
                maternalVisits.forEach((mv) => mvMap.set(mv.visit_code, mv))

                const ancCodes: MaternalVisitCode[] = ['anc1', 'anc2', 'anc3', 'anc4']
                const pncCodes: MaternalVisitCode[] = ['pnc3', 'pnc7', 'pnc42']

                return (
                  <>
                    {/* Antenatal Care Card */}
                    <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{
                        background: 'var(--color-accent-tint)',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                      }}>
                        Antenatal Care (ANC Checkups)
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {ancCodes.map((code) => {
                          const record = mvMap.get(code)
                          const isDone = Boolean(record)
                          const dueDate = deadlines[code]
                          const status = computeScheduleStatus(dueDate, isDone)

                          return (
                            <div
                              key={code}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                padding: '0.65rem 0.75rem',
                                background: isDone ? 'var(--color-green-tint)' : 'var(--color-bg)',
                                borderRadius: '10px',
                                border: '1px solid var(--color-border-subtle)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: 600 }}>{t(`tracker.anc.${code}`)}</span>
                                  {renderStatusBadge(status)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                                  {isDone ? (
                                    <span>
                                      {t('tracker.doneOn')}: <strong>{new Date(record!.done_on).toLocaleDateString()}</strong>
                                      {record?.notes ? ` • ${record.notes}` : ''}
                                    </span>
                                  ) : (
                                    <span>
                                      {t('tracker.deadline')}: <strong>{dueDate ? new Date(dueDate).toLocaleDateString() : '—'}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isDone ? (
                                  <button
                                    onClick={() => handleUndoMaternal(record!.id)}
                                    disabled={trackerActionLoading}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--color-red)' }}
                                  >
                                    <RotateCcw size={15} />
                                    <span>{t('tracker.undo')}</span>
                                  </button>
                                ) : markingMaternalCode === code ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <input
                                      type="date"
                                      className="input"
                                      style={{ minHeight: '38px', padding: '0.3rem 0.6rem', width: '140px' }}
                                      value={maternalDoneDate}
                                      onChange={(e) => setMaternalDoneDate(e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      className="input"
                                      style={{ minHeight: '38px', padding: '0.3rem 0.6rem', width: '140px' }}
                                      placeholder={t('tracker.notes')}
                                      value={maternalNotes}
                                      onChange={(e) => setMaternalNotes(e.target.value)}
                                    />
                                    <button
                                      onClick={() => handleMarkMaternalDone(code)}
                                      disabled={trackerActionLoading}
                                      className="btn btn-primary btn-sm"
                                    >
                                      <Check size={15} />
                                      <span>{t('tracker.markDone')}</span>
                                    </button>
                                    <button
                                      onClick={() => setMarkingMaternalCode(null)}
                                      className="btn btn-ghost btn-sm"
                                    >
                                      {t('app.actions.cancel')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setMarkingMaternalCode(code)
                                      setMaternalDoneDate(getTodayDateString())
                                      setMaternalNotes('')
                                    }}
                                    className="btn btn-accent btn-sm"
                                  >
                                    <Check size={15} />
                                    <span>{t('tracker.markDone')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>

                    {/* Postnatal Care Card */}
                    <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{
                        background: 'var(--color-teal-tint)',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        color: 'var(--color-teal)',
                      }}>
                        Postnatal Care (PNC Checkups)
                      </div>

                      {!patient.delivery_date && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          PNC visit deadlines will calculate automatically once actual delivery date is recorded.
                        </p>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {pncCodes.map((code) => {
                          const record = mvMap.get(code)
                          const isDone = Boolean(record)
                          const dueDate = deadlines[code]
                          const status = computeScheduleStatus(dueDate, isDone)

                          return (
                            <div
                              key={code}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                padding: '0.65rem 0.75rem',
                                background: isDone ? 'var(--color-green-tint)' : 'var(--color-bg)',
                                borderRadius: '10px',
                                border: '1px solid var(--color-border-subtle)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: 600 }}>{t(`tracker.pnc.${code}`)}</span>
                                  {renderStatusBadge(status)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                                  {isDone ? (
                                    <span>
                                      {t('tracker.doneOn')}: <strong>{new Date(record!.done_on).toLocaleDateString()}</strong>
                                      {record?.notes ? ` • ${record.notes}` : ''}
                                    </span>
                                  ) : (
                                    <span>
                                      {t('tracker.deadline')}: <strong>{dueDate ? new Date(dueDate).toLocaleDateString() : '—'}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isDone ? (
                                  <button
                                    onClick={() => handleUndoMaternal(record!.id)}
                                    disabled={trackerActionLoading}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--color-red)' }}
                                  >
                                    <RotateCcw size={15} />
                                    <span>{t('tracker.undo')}</span>
                                  </button>
                                ) : markingMaternalCode === code ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <input
                                      type="date"
                                      className="input"
                                      style={{ minHeight: '38px', padding: '0.3rem 0.6rem', width: '140px' }}
                                      value={maternalDoneDate}
                                      onChange={(e) => setMaternalDoneDate(e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      className="input"
                                      style={{ minHeight: '38px', padding: '0.3rem 0.6rem', width: '140px' }}
                                      placeholder={t('tracker.notes')}
                                      value={maternalNotes}
                                      onChange={(e) => setMaternalNotes(e.target.value)}
                                    />
                                    <button
                                      onClick={() => handleMarkMaternalDone(code)}
                                      disabled={trackerActionLoading}
                                      className="btn btn-primary btn-sm"
                                    >
                                      <Check size={15} />
                                      <span>{t('tracker.markDone')}</span>
                                    </button>
                                    <button
                                      onClick={() => setMarkingMaternalCode(null)}
                                      className="btn btn-ghost btn-sm"
                                    >
                                      {t('app.actions.cancel')}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setMarkingMaternalCode(code)
                                      setMaternalDoneDate(getTodayDateString())
                                      setMaternalNotes('')
                                    }}
                                    className="btn btn-teal btn-sm"
                                  >
                                    <Check size={15} />
                                    <span>{t('tracker.markDone')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  </>
                )
              })()}
            </div>
          ) : (
            /* ── GENERAL & CHRONIC CARE TRACKER ── */
            <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>{t('tracker.otherTitle')}</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginTop: '0.35rem' }}>
                  {categoryKey === 'chronic' ? t('tracker.chronicNote') : t('tracker.generalNote')}
                </p>
              </div>

              {/* Latest Next Visit Follow-up Date */}
              {(() => {
                const latestFollowUp = homeVisits.find((hv) => hv.next_visit_date)
                const nextDate = latestFollowUp?.next_visit_date
                const followUpStatus = computeFollowUpStatus(nextDate)

                return (
                  <div style={{
                    background: 'var(--color-primary-tint)',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600, display: 'block' }}>
                        {t('tracker.nextFollowUp')}
                      </span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '0.2rem' }}>
                        {nextDate ? new Date(nextDate).toLocaleDateString() : t('tracker.noFollowUpScheduled')}
                      </p>
                    </div>

                    {followUpStatus && renderStatusBadge(followUpStatus)}
                  </div>
                )
              })()}
            </Card>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 4: HOME VISITS (Visits, Vitals, Referral Suggestion)
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'visits' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>{t('visits.title')}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Total recorded visits: {homeVisits.length}
              </p>
            </div>
            {!showVisitForm && (
              <button onClick={openAddHomeVisit} className="btn btn-primary btn-sm" id="btn-add-visit">
                <PlusCircle size={16} />
                <span>{t('visits.addVisit')}</span>
              </button>
            )}
          </div>

          {/* Record Home Visit Form */}
          {showVisitForm && (
            <Card className="card-tint-teal" style={{ border: '2px solid var(--color-teal)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--color-teal)' }}>
                  {t('visits.addVisit')}
                </h3>
                <button
                  onClick={() => setShowVisitForm(false)}
                  className="btn btn-ghost btn-sm"
                  style={{ minHeight: '34px', minWidth: '34px', padding: '0.2rem' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveHomeVisit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label htmlFor="visit-date">{t('visits.visitDate')} *</label>
                    <input
                      id="visit-date"
                      type="date"
                      className="input"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="visit-purpose">{t('visits.purpose')} *</label>
                    <select
                      id="visit-purpose"
                      className="select"
                      value={visitPurpose}
                      onChange={(e) => setVisitPurpose(e.target.value as HomeVisitPurpose)}
                      required
                    >
                      <option value="routine">{t('visits.purposes.routine')}</option>
                      <option value="anc">{t('visits.purposes.anc')}</option>
                      <option value="pnc">{t('visits.purposes.pnc')}</option>
                      <option value="immunization">{t('visits.purposes.immunization')}</option>
                      <option value="chronic_followup">{t('visits.purposes.chronic_followup')}</option>
                      <option value="fever_illness">{t('visits.purposes.fever_illness')}</option>
                      <option value="other">{t('visits.purposes.other')}</option>
                    </select>
                  </div>
                </div>

                {/* Vitals Grid (BP, Weight, Sugar) */}
                <div style={{
                  background: 'var(--color-white)',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                    Vital Signs & Observations (Optional)
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label htmlFor="visit-bpsys" style={{ fontSize: '0.8rem' }}>{t('visits.bpSystolic')}</label>
                      <input
                        id="visit-bpsys"
                        type="number"
                        className="input"
                        placeholder="e.g. 120"
                        value={visitBpSys}
                        onChange={(e) => {
                          const val = e.target.value
                          setVisitBpSys(val)
                          const sys = val ? parseFloat(val) : null
                          if (shouldSuggestReferral(sys, diaNum, sugNum)) {
                            setVisitRefer(true)
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label htmlFor="visit-bpdia" style={{ fontSize: '0.8rem' }}>{t('visits.bpDiastolic')}</label>
                      <input
                        id="visit-bpdia"
                        type="number"
                        className="input"
                        placeholder="e.g. 80"
                        value={visitBpDia}
                        onChange={(e) => {
                          const val = e.target.value
                          setVisitBpDia(val)
                          const dia = val ? parseFloat(val) : null
                          if (shouldSuggestReferral(sysNum, dia, sugNum)) {
                            setVisitRefer(true)
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label htmlFor="visit-sugar" style={{ fontSize: '0.8rem' }}>{t('visits.sugarMgdl')}</label>
                      <input
                        id="visit-sugar"
                        type="number"
                        className="input"
                        placeholder="e.g. 110"
                        value={visitSugar}
                        onChange={(e) => {
                          const val = e.target.value
                          setVisitSugar(val)
                          const sug = val ? parseFloat(val) : null
                          if (shouldSuggestReferral(sysNum, diaNum, sug)) {
                            setVisitRefer(true)
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label htmlFor="visit-weight" style={{ fontSize: '0.8rem' }}>{t('visits.weightKg')}</label>
                      <input
                        id="visit-weight"
                        type="number"
                        step="0.1"
                        className="input"
                        placeholder="e.g. 52.5"
                        value={visitWeight}
                        onChange={(e) => setVisitWeight(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Suggestion notice if rule matches */}
                  {referralSuggested && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'var(--color-red-tint)',
                      color: 'var(--color-red)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                    }}>
                      <AlertCircle size={16} />
                      <span>{t('visits.referSuggestedNotice')}</span>
                    </div>
                  )}

                  {/* Refer Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.35rem' }}>
                    <input
                      id="visit-refer"
                      type="checkbox"
                      checked={visitRefer}
                      onChange={(e) => setVisitRefer(e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label htmlFor="visit-refer" style={{ margin: 0, cursor: 'pointer', fontWeight: 700, color: visitRefer ? 'var(--color-red)' : 'var(--color-text)' }}>
                      {t('visits.referPhc')}
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="visit-notes">{t('visits.notes')}</label>
                  <textarea
                    id="visit-notes"
                    className="textarea"
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="Patient status, health education advice given, symptoms noted..."
                  />
                </div>

                <div>
                  <label htmlFor="visit-next-date">{t('visits.nextVisitDate')}</label>
                  <input
                    id="visit-next-date"
                    type="date"
                    className="input"
                    value={visitNextDate}
                    onChange={(e) => setVisitNextDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowVisitForm(false)} className="btn btn-ghost">
                    {t('app.actions.cancel')}
                  </button>
                  <button type="submit" disabled={savingVisit} className="btn btn-primary" id="btn-save-visit-submit">
                    <Save size={16} />
                    <span>{t('app.actions.save')}</span>
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Visits History List (Newest first) */}
          {loadingVisits ? (
            <Card>
              <div className="empty-state">
                <span className="spinner spinner-lg" />
                <p>{t('app.actions.loading')}</p>
              </div>
            </Card>
          ) : homeVisits.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Home size={36} color="var(--color-teal)" />
                <h3 style={{ fontSize: '1.1rem' }}>{t('visits.empty')}</h3>
                <p>{t('visits.emptySub')}</p>
                <button onClick={openAddHomeVisit} className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                  <PlusCircle size={16} />
                  <span>{t('visits.addVisit')}</span>
                </button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {homeVisits.map((v) => (
                <Card
                  key={v.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    borderLeft: `5px solid ${v.refer ? 'var(--color-red)' : 'var(--color-teal)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                          {t(`visits.purposes.${v.purpose}`, v.purpose)}
                        </span>
                        {v.refer && (
                          <span className="badge badge-red">
                            <HeartPulse size={14} />
                            <span>Referral to PHC</span>
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {new Date(v.visit_date).toLocaleDateString()}
                      </span>
                    </div>

                    {v.next_visit_date && (
                      <span className="badge badge-teal" style={{ fontSize: '0.8rem' }}>
                        Next Follow-up: {new Date(v.next_visit_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Vitals pill badges */}
                  {(v.bp_systolic != null || v.sugar_mgdl != null || v.weight_kg != null) && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      {v.bp_systolic != null && v.bp_diastolic != null && (
                        <span className="badge badge-navy">
                          BP: {v.bp_systolic}/{v.bp_diastolic} mmHg
                        </span>
                      )}
                      {v.sugar_mgdl != null && (
                        <span className="badge badge-yellow">
                          Sugar: {v.sugar_mgdl} mg/dL
                        </span>
                      )}
                      {v.weight_kg != null && (
                        <span className="badge badge-teal">
                          Weight: {v.weight_kg} kg
                        </span>
                      )}
                    </div>
                  )}

                  {v.notes && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', background: 'var(--color-bg)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                      {v.notes}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
