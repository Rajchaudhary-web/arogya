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
