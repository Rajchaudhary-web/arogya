export type PatientCategory = 'general' | 'pregnant' | 'child' | 'chronic'

export interface Patient {
  id: string
  created_at?: string
  profile_id?: string | null
  asha_id?: string | null
  name: string
  dob?: string | null
  gender?: string | null
  village?: string | null
  phone?: string | null
  blood_group?: string | null
  allergies?: string | null
  birth_details?: string | null
  category?: PatientCategory | null
  guardian_patient_id?: string | null
  edd?: string | null
  delivery_date?: string | null
  delivery_hospital?: string | null
}

export interface VaccineScheduleItem {
  id: number
  code: string
  name: string
  age_label: string
  due_after_days: number
  sort_order: number
}

export interface PatientVaccination {
  id: string
  patient_id: string
  schedule_id: number
  given_on: string
  notes?: string | null
  given_by?: string | null
  created_at?: string
}

export type MaternalVisitCode = 'anc1' | 'anc2' | 'anc3' | 'anc4' | 'pnc3' | 'pnc7' | 'pnc42'

export interface MaternalVisit {
  id: string
  patient_id: string
  visit_code: MaternalVisitCode
  done_on: string
  notes?: string | null
  created_at?: string
}

export type HomeVisitPurpose =
  | 'routine'
  | 'anc'
  | 'pnc'
  | 'immunization'
  | 'chronic_followup'
  | 'fever_illness'
  | 'other'

export interface HomeVisit {
  id: string
  patient_id: string
  visit_date: string
  purpose: HomeVisitPurpose
  notes?: string | null
  bp_systolic?: number | null
  bp_diastolic?: number | null
  weight_kg?: number | null
  sugar_mgdl?: number | null
  next_visit_date?: string | null
  refer: boolean
  created_by?: string | null
  created_at?: string
}

export interface Medicine {
  id: string
  prescription_id?: string | null
  patient_id: string
  name: string
  dose: string
  frequency?: string | null
  timings?: string[] | null
  start_date?: string | null
  end_date?: string | null
  instructions?: string | null
  active: boolean
  created_at?: string
}

export type VisitRequestReason =
  | 'fever'
  | 'pregnancy_problem'
  | 'child_unwell'
  | 'need_supplies'
  | 'other'

export type VisitRequestStatus = 'open' | 'seen' | 'done'

export interface VisitRequest {
  id: string
  patient_id: string
  reason: VisitRequestReason
  message?: string | null
  status: VisitRequestStatus
  created_by?: string
  created_at?: string
  resolved_at?: string | null
}

export type HistoryEntryType =
  | 'birth'
  | 'vaccination'
  | 'condition'
  | 'visit'
  | 'report'
  | 'prescription'

export interface HistoryEntry {
  id: string
  created_at?: string
  patient_id: string
  entry_type: HistoryEntryType
  title: string
  notes?: string | null
  entry_date: string
  file_path?: string | null
  file_name?: string | null
  file_type?: string | null
  added_by?: string | null
}

/**
 * Calculates human-readable age from a date of birth string (YYYY-MM-DD).
 */
export function calculateAge(dob?: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}
