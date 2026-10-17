export interface Patient {
  id: string
  created_at?: string
  name: string
  dob?: string | null
  gender?: string | null
  village?: string | null
  phone?: string | null
  blood_group?: string | null
  allergies?: string | null
  birth_details?: string | null
  asha_id?: string | null
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
  asha_id?: string | null
  entry_type: HistoryEntryType
  title: string
  notes?: string | null
  entry_date: string
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
