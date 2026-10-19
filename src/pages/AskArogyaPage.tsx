import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type {
  Patient,
  VaccineScheduleItem,
  PatientVaccination,
  MaternalVisit,
  HomeVisit,
} from '../lib/types'
import {
  calculateBatchedDashboardMetrics,
} from '../lib/schedule'
import { isEmergency } from '../lib/emergency'
import {
  Send,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Bot,
  User,
  ShieldAlert,
  Phone,
  Clock,
  Eye,
  CheckCheck,
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface PatientChatContext {
  patient: {
    name: string
    category: string
  }
  asha: {
    name: string | null
    phone: string | null
  }
  nextDueItems: Array<{
    patientName: string
    title: string
    dueDate: string
    status: string
  }>
  activeMedicines: Array<{
    name: string
    dose: string
    instructions: string | null
  }>
}

export default function AskArogyaPage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingContext, setLoadingContext] = useState(true)
  const [patientContext, setPatientContext] = useState<PatientChatContext | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)

  // Emergency safety rail state
  const [emergencyActive, setEmergencyActive] = useState(false)
  const [emergencyRequestId, setEmergencyRequestId] = useState<string | null>(null)
  const [emergencyStatus, setEmergencyStatus] = useState<string | null>(null)
  const [emergencyAlertSuccess, setEmergencyAlertSuccess] = useState(false)
  const [emergencyAlertError, setEmergencyAlertError] = useState<string | null>(null)
  const lastEmergencyAlertTimeRef = useRef<number>(0)

  // ── Emergency Status Polling (every 15s + on window focus, stop when done or unmounted) ──
  useEffect(() => {
    if (!emergencyActive || !emergencyRequestId || emergencyStatus === 'done') {
      return
    }

    let isMounted = true

    const fetchLatestStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('visit_requests')
          .select('id, status')
          .eq('id', emergencyRequestId)
          .maybeSingle()

        if (error) {
          // Handle fetch errors quietly (keep last known status)
          return
        }

        if (data && isMounted) {
          setEmergencyStatus(data.status)
        }
      } catch {
        // Handle quietly
      }
    }

    // Set interval for every 15s
    const intervalId = setInterval(fetchLatestStatus, 15000)

    // Also re-fetch when browser tab regains focus
    const handleFocus = () => {
      fetchLatestStatus()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [emergencyActive, emergencyRequestId, emergencyStatus])

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending, emergencyActive])

  // ── Build Context on client from patient data ────────────────
  useEffect(() => {
    if (!user) return

    const buildContext = async () => {
      setLoadingContext(true)
      try {
        // 1. Fetch own patient record
        const { data: pData, error: pErr } = await supabase
          .from('patients')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle()

        if (pErr) throw pErr

        if (!pData) {
          setLoadingContext(false)
          return
        }

        const selfPatient: Patient = pData
        setPatientId(selfPatient.id)

        // 2. Fetch ASHA profile via patients.asha_id -> profiles(id, full_name, phone)
        let ashaInfo: { name: string | null; phone: string | null } = { name: null, phone: null }
        if (selfPatient.asha_id) {
          const { data: aData } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', selfPatient.asha_id)
            .maybeSingle()

          if (aData) {
            ashaInfo = {
              name: aData.full_name,
              phone: aData.phone,
            }
          }
        }

        // 3. Fetch children (guardian_patient_id = selfPatient.id)
        const { data: cData } = await supabase
          .from('patients')
          .select('*')
          .eq('guardian_patient_id', selfPatient.id)
          .order('name', { ascending: true })

        const childPatients = cData ?? []
        const allFamily = [selfPatient, ...childPatients]
        const allFamilyIds = allFamily.map((p) => p.id)

        // 4. Batch query vaccine schedule, vaccinations, maternal visits, home visits
        const { data: vsData } = await supabase
          .from('vaccine_schedule')
          .select('id, code, name, age_label, due_after_days')
          .order('sort_order', { ascending: true })

        const vaccineSchedule = (vsData ?? []) as VaccineScheduleItem[]

        let pVaccinations: PatientVaccination[] = []
        let mVisi: MaternalVisit[] = []
        let hVisi: HomeVisit[] = []

        if (allFamilyIds.length > 0) {
          const { data: pvData } = await supabase
            .from('patient_vaccinations')
            .select('id, patient_id, schedule_id, given_on')
            .in('patient_id', allFamilyIds)
          pVaccinations = (pvData ?? []) as PatientVaccination[]

          const { data: mvData } = await supabase
            .from('maternal_visits')
            .select('id, patient_id, visit_code, done_on')
            .in('patient_id', allFamilyIds)
          mVisi = (mvData ?? []) as MaternalVisit[]

          const { data: hvData } = await supabase
            .from('home_visits')
            .select('id, patient_id, next_visit_date, refer, created_at')
            .in('patient_id', allFamilyIds)
          hVisi = (hvData ?? []) as HomeVisit[]
        }

        // Compute 3 next due items from schedule.ts
        const metrics = calculateBatchedDashboardMetrics({
          patients: allFamily,
          vaccineSchedule,
          patientVaccinations: pVaccinations,
          maternalVisits: mVisi,
          homeVisits: hVisi,
        })

        const next3Items = metrics.allPendingItems.slice(0, 3).map((item) => ({
          patientName: item.patientName,
          title: item.itemTitle,
          dueDate: item.dueDate,
          status: item.status,
        }))

        // 5. Fetch active medicines (active = true)
        const { data: mData } = await supabase
          .from('medicines')
          .select('name, dose, instructions')
          .eq('patient_id', selfPatient.id)
          .eq('active', true)

        const activeMeds = (mData ?? []).map((m) => ({
          name: m.name,
          dose: m.dose,
          instructions: m.instructions,
        }))

        // Complete Context Object
        const contextObj: PatientChatContext = {
          patient: {
            name: selfPatient.name,
            category: selfPatient.category || 'general',
          },
          asha: ashaInfo,
          nextDueItems: next3Items,
          activeMedicines: activeMeds,
        }

        setPatientContext(contextObj)

        // Set initial welcoming greeting from Arogya Saathi
        const greetingText = t('chat.initialGreeting', {
          name: selfPatient.name.split(' ')[0] || profile?.full_name || 'Patient',
        })
        setMessages([
          {
            role: 'assistant',
            text: greetingText,
          },
        ])
      } catch (err: any) {
        console.error('Error building patient chat context:', err)
      } finally {
        setLoadingContext(false)
      }
    }

    buildContext()
  }, [user])

  // ── Send Message with Emergency Safety Rail ───────────────────
  const sendMessage = async (textToSend: string) => {
    const cleanText = textToSend.trim()
    if (!cleanText || isSending) return

    setErrorState(null)
    setLastUserMessage(cleanText)

    // Add user message to UI bubbles immediately
    const userMsg: ChatMessage = { role: 'user', text: cleanText }
    const updatedMessages: ChatMessage[] = [...messages, userMsg].slice(-8)
    setMessages(updatedMessages)
    setInputText('')

    // ── Emergency Check: pure function isEmergency BEFORE any assistant call ──
    if (isEmergency(cleanText)) {
      setEmergencyActive(true)
      setIsSending(false)

      const now = Date.now()
      const TWO_MINUTES_MS = 2 * 60 * 1000

      // Only insert visit_requests if not duplicate within 2 minutes
      if (now - lastEmergencyAlertTimeRef.current >= TWO_MINUTES_MS) {
        lastEmergencyAlertTimeRef.current = now
        try {
          if (patientId) {
            const { data: insertedData, error: insertErr } = await supabase
              .from('visit_requests')
              .insert({
                patient_id: patientId,
                reason: 'other',
                message: `URGENT (assistant): ${cleanText}`,
                status: 'open',
                urgent: true,
              })
              .select('id, status')
              .maybeSingle()

            if (insertErr) {
              console.error('Failed to insert urgent visit request:', insertErr)
              setEmergencyAlertError(t('chat.emergencyAlertFailed'))
              setEmergencyAlertSuccess(false)
            } else {
              if (insertedData) {
                setEmergencyRequestId(insertedData.id)
                setEmergencyStatus(insertedData.status || 'open')
              }
              setEmergencyAlertSuccess(true)
              setEmergencyAlertError(null)
            }
          }
        } catch (err: any) {
          console.error('Emergency request insert error:', err)
          setEmergencyAlertError(t('chat.emergencyAlertFailed'))
          setEmergencyAlertSuccess(false)
        }
      }

      // Do NOT call the assistant function
      return
    }

    // Normal non-emergency assistant flow
    setIsSending(true)

    try {
      const currentLang = i18n.language === 'hi' ? 'hi' : 'en'

      const { data, error } = await supabase.functions.invoke('arogya-assistant', {
        body: {
          messages: updatedMessages,
          context: patientContext,
          language: currentLang,
        },
      })

      if (error) throw error

      if (data && data.reply) {
        const assistantMsg: ChatMessage = { role: 'assistant', text: data.reply }
        setMessages((prev) => [...prev, assistantMsg].slice(-8))
      } else if (data && data.error) {
        throw new Error(data.error)
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err: any) {
      console.error('Error invoking arogya-assistant edge function:', err)
      setErrorState(err.message || t('chat.errorMsg'))
    } finally {
      setIsSending(false)
    }
  }

  const handleRetry = () => {
    if (lastUserMessage) {
      sendMessage(lastUserMessage)
    }
  }

  const handleSuggestionClick = (queryText: string) => {
    sendMessage(queryText)
  }

  return (
    <div className="page-enter chat-container">
      {/* Chat Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--color-primary)' }}>
              {t('chat.title')}
            </h1>
            <span className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={13} />
              <span>{t('chat.badge')}</span>
            </span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            {t('chat.subtitle')}
          </p>
        </div>
      </div>

      {/* Main Chat Interface Card */}
      <Card className="chat-card">
        {/* Messages Stream Area */}
        <div className="chat-messages-area">
          {loadingContext && messages.length === 0 && (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <span className="spinner spinner-lg" />
              <p>{t('app.actions.loading')}</p>
            </div>
          )}

          {messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={index}
                className={`chat-bubble-wrapper ${isUser ? 'user' : 'assistant'}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', maxWidth: '85%' }}>
                  {!isUser && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--color-primary-tint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary)',
                      flexShrink: 0,
                      marginTop: '4px',
                    }}>
                      <Bot size={18} />
                    </div>
                  )}

                  <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                    {msg.text}
                  </div>

                  {isUser && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--color-accent-tint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-accent)',
                      flexShrink: 0,
                      marginTop: '4px',
                    }}>
                      <User size={18} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Assistant Typing Indicator */}
          {isSending && (
            <div className="chat-bubble-wrapper assistant">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--color-primary-tint)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                  flexShrink: 0,
                }}>
                  <Bot size={18} />
                </div>
                <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.85rem 1.15rem' }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          {/* Visible Error State with Retry Button */}
          {errorState && (
            <div style={{
              background: 'var(--color-red-tint)',
              border: '1px solid #FCA5A5',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-red)', fontSize: '0.9rem' }}>
                <AlertCircle size={18} />
                <span>{errorState}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="btn btn-danger-outline btn-sm"
                style={{ minHeight: '38px', padding: '0.35rem 0.75rem' }}
              >
                <RotateCcw size={15} />
                <span>{t('chat.retry')}</span>
              </button>
            </div>
          )}

          {/* Red Emergency Safety Rail Card */}
          {emergencyActive && (
            <div className="emergency-card" id="chat-emergency-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}>
                  <ShieldAlert size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    margin: '0 0 0.25rem 0',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: '#991B1B',
                  }}>
                    {t('chat.emergencyAlertTitle')}
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#7F1D1D',
                  }}>
                    {t('chat.emergencyText')}
                  </p>
                </div>
              </div>

              {/* Call Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                {/* Call ASHA didi (hidden if no ASHA linked) */}
                {patientContext?.asha.phone && (
                  <a
                    href={`tel:${patientContext.asha.phone}`}
                    className="emergency-btn-asha"
                    id="btn-emergency-call-asha"
                  >
                    <Phone size={20} />
                    <span>
                      {t('chat.emergencyCallAsha', {
                        name: patientContext.asha.name || 'ASHA',
                      })}
                    </span>
                  </a>
                )}

                {/* Call 108 */}
                <a
                  href="tel:108"
                  className="emergency-btn-108"
                  id="btn-emergency-call-108"
                >
                  <Phone size={20} />
                  <span>{t('chat.emergencyCall108')}</span>
                </a>
              </div>

              {/* Live Status line with icon + text (open, seen, done) */}
              {emergencyAlertSuccess && (
                <div
                  id="emergency-card-live-status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    background:
                      emergencyStatus === 'done'
                        ? 'var(--color-green-tint)'
                        : emergencyStatus === 'seen'
                        ? 'var(--color-yellow-tint)'
                        : 'var(--color-primary-tint)',
                    color:
                      emergencyStatus === 'done'
                        ? 'var(--color-green)'
                        : emergencyStatus === 'seen'
                        ? '#B48200'
                        : 'var(--color-primary)',
                    border: `1px solid ${
                      emergencyStatus === 'done'
                        ? '#86EFAC'
                        : emergencyStatus === 'seen'
                        ? '#FDE047'
                        : '#BFDBFE'
                    }`,
                  }}
                >
                  {emergencyStatus === 'done' ? (
                    <CheckCheck size={18} />
                  ) : emergencyStatus === 'seen' ? (
                    <Eye size={18} />
                  ) : (
                    <Clock size={18} />
                  )}
                  <span>
                    {emergencyStatus === 'done'
                      ? t('chat.emergencyStatusDone')
                      : emergencyStatus === 'seen'
                      ? t('chat.emergencyStatusSeen')
                      : t('chat.emergencyStatusOpen')}
                  </span>
                </div>
              )}

              {emergencyAlertError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#B91C1C',
                  background: '#FEE2E2',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                }}>
                  <AlertCircle size={16} />
                  <span>{emergencyAlertError}</span>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3 Quick Suggestion Chips */}
        <div style={{
          padding: '0.65rem 1.25rem 0.25rem',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {t('chat.suggestionsTitle')}
          </span>

          <button
            type="button"
            className="suggestion-chip"
            onClick={() => handleSuggestionClick(t('chat.suggestions.whatsNext'))}
            disabled={isSending}
          >
            <span>{t('chat.suggestions.whatsNext')}</span>
          </button>

          <button
            type="button"
            className="suggestion-chip"
            onClick={() => handleSuggestionClick(t('chat.suggestions.medicines'))}
            disabled={isSending}
          >
            <span>{t('chat.suggestions.medicines')}</span>
          </button>

          <button
            type="button"
            className="suggestion-chip"
            onClick={() => handleSuggestionClick(t('chat.suggestions.whoIsAsha'))}
            disabled={isSending}
          >
            <span>{t('chat.suggestions.whoIsAsha')}</span>
          </button>
        </div>

        {/* Input Bar & Send Button */}
        <div style={{
          padding: '0.85rem 1.25rem 0.75rem',
          background: 'var(--color-white)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(inputText)
            }}
            style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}
          >
            <input
              type="text"
              className="input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
              disabled={isSending}
              style={{
                flex: 1,
                minHeight: '48px',
                borderRadius: '12px',
                fontSize: '0.95rem',
              }}
            />

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="btn btn-primary"
              id="btn-chat-send"
              style={{
                minHeight: '48px',
                padding: '0.65rem 1.25rem',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexShrink: 0,
              }}
            >
              <Send size={18} />
              <span>{isSending ? t('chat.sending') : t('chat.send')}</span>
            </button>
          </form>

          {/* Mandatory Safety Note */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}>
            <ShieldAlert size={14} color="var(--color-text-muted)" />
            <span>{t('chat.disclaimer')}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
