/**
 * Pure emergency detection helper for Arogya Saathi.
 * Uses lowercase matching across English, Hindi (Devanagari), and Hinglish keywords.
 */

export const EMERGENCY_KEYWORDS: readonly string[] = [
  // English
  'chest pain',
  "can't breathe",
  'cannot breathe',
  'difficulty breathing',
  'heavy bleeding',
  'bleeding',
  'unconscious',
  'fainted',
  'seizure',
  'fits',
  'snake bite',
  'poison',
  'suicide',
  'severe pain',
  'baby not breathing',
  'help me',

  // Hinglish
  'bachao',
  'seene mein dard',
  'saans nahi',
  'saans',
  'khoon',
  'behosh',
  'saanp',
  'zahar',

  // Hindi (Devanagari)
  'सीने में दर्द',
  'सांस',
  'खून',
  'बेहोश',
  'बचाओ',
  'दौरा',
  'ज़हर',
  'साँप',
]

/**
 * Pure function to check if text contains any emergency keyword.
 * Uses case-insensitive comparison.
 */
export function isEmergency(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const lower = text.toLowerCase()

  return EMERGENCY_KEYWORDS.some((kw) => {
    const kwLower = kw.toLowerCase()
    return lower.includes(kwLower)
  })
}
