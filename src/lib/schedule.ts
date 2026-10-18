/**
 * Calculation rules for child vaccine schedules, maternal (ANC/PNC) schedules,
 * follow-up dates, referral suggestions, and batched overdue/due-this-week computations.
 * All pure functions with named constants at the top.
 */

// ── Thresholds & Constants ──────────────────────────────────
export const BP_SYSTOLIC_REFER_THRESHOLD = 140
export const BP_DIASTOLIC_REFER_THRESHOLD = 90
export const SUGAR_REFER_THRESHOLD = 200

export const DUE_THIS_WEEK_DAYS = 7
export const GESTATION_DAYS = 280

export const ANC_DEADLINE_DAYS = {
  anc1: 84,   // LMP + 84 days (~12 weeks)
  anc2: 182,  // LMP + 182 days (~26 weeks)
  anc3: 238,  // LMP + 238 days (~34 weeks)
  anc4: 280,  // LMP + 280 days (EDD)
}

export const PNC_DEADLINE_DAYS = {
  pnc3: 3,    // Delivery + 3 days
  pnc7: 7,    // Delivery + 7 days
  pnc42: 42,  // Delivery + 42 days (6 weeks)
}

export type ScheduleStatus = 'given' | 'overdue' | 'due_this_week' | 'upcoming'

// ── Pure helper to format/normalize dates ───────────────────
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().substring(0, 10)
}

export function getTodayDateString(): string {
  return new Date().toISOString().substring(0, 10)
}

/**
 * Calculates how many whole days a dueDate is late relative to today.
 * Returns > 0 if overdue, 0 if today, < 0 if in the future.
 */
export function calculateDaysLate(dueDateStr: string, todayStr: string = getTodayDateString()): number {
  const due = new Date(dueDateStr)
  const today = new Date(todayStr)
  const diffTime = today.getTime() - due.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Computes status of a scheduled milestone based on due date and whether it was completed.
 * Status per milestone:
 * - Given (a record exists)
 * - Overdue (due date before today)
 * - Due this week (due within 7 days: today <= due_date <= today + 7 days)
 * - Upcoming (due date > today + 7 days)
 */
export function computeScheduleStatus(dueDateStr: string | null | undefined, isGiven: boolean): ScheduleStatus {
  if (isGiven) return 'given'
  if (!dueDateStr) return 'upcoming'

  const todayStr = getTodayDateString()
  if (dueDateStr < todayStr) {
    return 'overdue'
  }

  const weekLaterStr = addDaysToDateString(todayStr, DUE_THIS_WEEK_DAYS)
  if (dueDateStr <= weekLaterStr) {
    return 'due_this_week'
  }

  return 'upcoming'
}

/**
 * Child vaccine due date = dob + due_after_days
 */
export function calculateChildVaccineDueDate(dob: string | null | undefined, dueAfterDays: number): string | null {
  if (!dob) return null
  return addDaysToDateString(dob.substring(0, 10), dueAfterDays)
}

/**
 * Maternal LMP = EDD - 280 days
 */
export function calculateLmpFromEdd(edd: string | null | undefined): string | null {
  if (!edd) return null
  return addDaysToDateString(edd.substring(0, 10), -GESTATION_DAYS)
}

/**
 * Maternal ANC / PNC deadlines:
 * - anc1 = lmp + 84 days
 * - anc2 = lmp + 182 days
 * - anc3 = lmp + 238 days
 * - anc4 = edd
 * - if delivery_date is set:
 *   - pnc3 = delivery_date + 3
 *   - pnc7 = delivery_date + 7
 *   - pnc42 = delivery_date + 42
 */
export function calculateMaternalDueDates(
  edd: string | null | undefined,
  deliveryDate: string | null | undefined
): Record<string, string | null> {
  const lmp = calculateLmpFromEdd(edd)
  const result: Record<string, string | null> = {
    anc1: lmp ? addDaysToDateString(lmp, ANC_DEADLINE_DAYS.anc1) : null,
    anc2: lmp ? addDaysToDateString(lmp, ANC_DEADLINE_DAYS.anc2) : null,
    anc3: lmp ? addDaysToDateString(lmp, ANC_DEADLINE_DAYS.anc3) : null,
    anc4: edd ? edd.substring(0, 10) : null,
    pnc3: deliveryDate ? addDaysToDateString(deliveryDate.substring(0, 10), PNC_DEADLINE_DAYS.pnc3) : null,
    pnc7: deliveryDate ? addDaysToDateString(deliveryDate.substring(0, 10), PNC_DEADLINE_DAYS.pnc7) : null,
    pnc42: deliveryDate ? addDaysToDateString(deliveryDate.substring(0, 10), PNC_DEADLINE_DAYS.pnc42) : null,
  }
  return result
}

/**
 * Follow-up status for home visit next_visit_date:
 * - Overdue if before today
 * - Due this week if within 7 days
 * - Upcoming otherwise
 */
export function computeFollowUpStatus(nextVisitDateStr: string | null | undefined): ScheduleStatus | null {
  if (!nextVisitDateStr) return null
  return computeScheduleStatus(nextVisitDateStr.substring(0, 10), false)
}

/**
 * Refer suggestion rule:
 * bp_systolic >= 140 OR bp_diastolic >= 90 OR sugar_mgdl >= 200 pre-ticks the "Refer to PHC" checkbox
 */
export function shouldSuggestReferral(
  bpSystolic: number | null | undefined,
  bpDiastolic: number | null | undefined,
  sugarMgdl: number | null | undefined
): boolean {
  if (bpSystolic != null && bpSystolic >= BP_SYSTOLIC_REFER_THRESHOLD) return true
  if (bpDiastolic != null && bpDiastolic >= BP_DIASTOLIC_REFER_THRESHOLD) return true
  if (sugarMgdl != null && sugarMgdl >= SUGAR_REFER_THRESHOLD) return true
  return false
}

// ── Batched Care Items for Dashboard & Patient "What's Next" ──

export interface ScheduledCareItem {
  patientId: string
  patientName: string
  patientPhone?: string | null
  patientVillage?: string | null
  patientCategory?: string | null
  itemType: 'vaccine' | 'anc' | 'pnc' | 'followup'
  itemCode: string
  itemTitle: string
  dueDate: string
  daysLate: number
  status: ScheduleStatus
}

export interface BatchCalculationParams {
  patients: Array<{
    id: string
    name: string
    category?: string | null
    dob?: string | null
    edd?: string | null
    delivery_date?: string | null
    phone?: string | null
    village?: string | null
  }>
  vaccineSchedule: Array<{
    id: number
    code: string
    name: string
    due_after_days: number
  }>
  patientVaccinations: Array<{
    patient_id: string
    schedule_id: number
    given_on: string
  }>
  maternalVisits: Array<{
    patient_id: string
    visit_code: string
    done_on: string
  }>
  homeVisits: Array<{
    patient_id: string
    next_visit_date?: string | null
    refer?: boolean | null
    created_at?: string
  }>
}

/**
 * Pure function that evaluates all milestones across all given patients and returns:
 * - overdueItems (sorted with most days late first)
 * - dueThisWeekItems (sorted with soonest due date first)
 * - allPendingItems (all upcoming, due-this-week, and overdue items sorted soonest due date first)
 * - highRiskPatients (patients whose latest home visit has refer === true)
 */
export function calculateBatchedDashboardMetrics(params: BatchCalculationParams) {
  const todayStr = getTodayDateString()
  const weekLaterStr = addDaysToDateString(todayStr, DUE_THIS_WEEK_DAYS)

  // Fast lookup sets
  const givenVaccinesSet = new Set<string>()
  params.patientVaccinations.forEach((pv) => {
    givenVaccinesSet.add(`${pv.patient_id}_${pv.schedule_id}`)
  })

  const doneMaternalSet = new Set<string>()
  params.maternalVisits.forEach((mv) => {
    doneMaternalSet.add(`${mv.patient_id}_${mv.visit_code}`)
  })

  // Patient map
  const patientMap = new Map<string, (typeof params.patients)[0]>()
  params.patients.forEach((p) => patientMap.set(p.id, p))

  const overdueItems: ScheduledCareItem[] = []
  const dueThisWeekItems: ScheduledCareItem[] = []
  const allPendingItems: ScheduledCareItem[] = []

  // 1. Process Child Vaccines
  params.patients.forEach((patient) => {
    if (patient.category === 'child' && patient.dob) {
      params.vaccineSchedule.forEach((v) => {
        const isGiven = givenVaccinesSet.has(`${patient.id}_${v.id}`)
        if (!isGiven) {
          const dueDate = calculateChildVaccineDueDate(patient.dob, v.due_after_days)
          if (dueDate) {
            const status = computeScheduleStatus(dueDate, false)
            const daysLate = calculateDaysLate(dueDate, todayStr)
            const item: ScheduledCareItem = {
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: patient.phone,
              patientVillage: patient.village,
              patientCategory: patient.category,
              itemType: 'vaccine',
              itemCode: v.code,
              itemTitle: v.name,
              dueDate,
              daysLate,
              status,
            }
            allPendingItems.push(item)
            if (status === 'overdue') overdueItems.push(item)
            else if (status === 'due_this_week') dueThisWeekItems.push(item)
          }
        }
      })
    }

    // 2. Process Maternal ANC & PNC Visits
    if (patient.category === 'pregnant' && patient.edd) {
      const deadlines = calculateMaternalDueDates(patient.edd, patient.delivery_date)
      const ancCodes = ['anc1', 'anc2', 'anc3', 'anc4']
      ancCodes.forEach((code) => {
        const isDone = doneMaternalSet.has(`${patient.id}_${code}`)
        if (!isDone) {
          const dueDate = deadlines[code]
          if (dueDate) {
            const status = computeScheduleStatus(dueDate, false)
            const daysLate = calculateDaysLate(dueDate, todayStr)
            const item: ScheduledCareItem = {
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: patient.phone,
              patientVillage: patient.village,
              patientCategory: patient.category,
              itemType: 'anc',
              itemCode: code,
              itemTitle: `ANC Checkup (${code.toUpperCase()})`,
              dueDate,
              daysLate,
              status,
            }
            allPendingItems.push(item)
            if (status === 'overdue') overdueItems.push(item)
            else if (status === 'due_this_week') dueThisWeekItems.push(item)
          }
        }
      })

      if (patient.delivery_date) {
        const pncCodes = ['pnc3', 'pnc7', 'pnc42']
        pncCodes.forEach((code) => {
          const isDone = doneMaternalSet.has(`${patient.id}_${code}`)
          if (!isDone) {
            const dueDate = deadlines[code]
            if (dueDate) {
              const status = computeScheduleStatus(dueDate, false)
              const daysLate = calculateDaysLate(dueDate, todayStr)
              const item: ScheduledCareItem = {
                patientId: patient.id,
                patientName: patient.name,
                patientPhone: patient.phone,
                patientVillage: patient.village,
                patientCategory: patient.category,
                itemType: 'pnc',
                itemCode: code,
                itemTitle: `PNC Checkup (${code.toUpperCase()})`,
                dueDate,
                daysLate,
                status,
              }
              allPendingItems.push(item)
              if (status === 'overdue') overdueItems.push(item)
              else if (status === 'due_this_week') dueThisWeekItems.push(item)
            }
          }
        })
      }
    }
  })

  // 3. Process Home Visit Next Follow-up Dates
  const latestHomeVisitPerPatient = new Map<string, (typeof params.homeVisits)[0]>()
  params.homeVisits.forEach((hv) => {
    const existing = latestHomeVisitPerPatient.get(hv.patient_id)
    if (!existing || (hv.created_at && (!existing.created_at || hv.created_at > existing.created_at))) {
      latestHomeVisitPerPatient.set(hv.patient_id, hv)
    }
  })

  latestHomeVisitPerPatient.forEach((hv, patientId) => {
    const patient = patientMap.get(patientId)
    if (patient && hv.next_visit_date) {
      const nextDate = hv.next_visit_date.substring(0, 10)
      const status = computeScheduleStatus(nextDate, false)
      const daysLate = calculateDaysLate(nextDate, todayStr)
      const item: ScheduledCareItem = {
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientVillage: patient.village,
        patientCategory: patient.category,
        itemType: 'followup',
        itemCode: 'followup',
        itemTitle: 'Scheduled Follow-up Home Visit',
        dueDate: nextDate,
        daysLate,
        status,
      }
      allPendingItems.push(item)
      if (nextDate < todayStr) {
        overdueItems.push(item)
      } else if (nextDate <= weekLaterStr) {
        dueThisWeekItems.push(item)
      }
    }
  })

  // 4. Refer / High-Risk patients (where latest home visit has refer === true)
  const highRiskPatients: Array<{
    patient: (typeof params.patients)[0]
    latestVisit: (typeof params.homeVisits)[0]
  }> = []

  latestHomeVisitPerPatient.forEach((hv, patientId) => {
    if (hv.refer) {
      const patient = patientMap.get(patientId)
      if (patient) {
        highRiskPatients.push({ patient, latestVisit: hv })
      }
    }
  })

  // Sort Overdue (longest days late first)
  overdueItems.sort((a, b) => b.daysLate - a.daysLate)

  // Sort Due This Week (soonest due date first)
  dueThisWeekItems.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))

  // Sort all pending items soonest due date first
  allPendingItems.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))

  return {
    overdueItems,
    dueThisWeekItems,
    allPendingItems,
    highRiskPatients,
  }
}
