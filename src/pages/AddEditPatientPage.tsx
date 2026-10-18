import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { PatientCategory, Patient } from '../lib/types'
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle,
  Save,
} from 'lucide-react'

export default function AddEditPatientPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('female')
  const [village, setVillage] = useState('')
  const [phone, setPhone] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [allergies, setAllergies] = useState('')
  const [birthDetails, setBirthDetails] = useState('')

  // Phase 3 Category & Special Fields
  const [category, setCategory] = useState<PatientCategory>('general')
  const [guardianPatientId, setGuardianPatientId] = useState<string>('')
  const [edd, setEdd] = useState<string>('')
  const [deliveryHospital, setDeliveryHospital] = useState<string>('')
  const [deliveryDate, setDeliveryDate] = useState<string>('')

  // Mother candidates for guardian dropdown
  const [motherList, setMotherList] = useState<Patient[]>([])

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Fetch list of patients for guardian (mother) selection
  useEffect(() => {
    if (!user) return
    const fetchMothers = async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, name, village, category, phone')
          .eq('asha_id', user.id)
          .order('name', { ascending: true })

        if (!error && data) {
          // Filter out the current patient being edited to avoid circular self-reference
          setMotherList(data.filter((p) => p.id !== id))
        }
      } catch (err) {
        console.error('Error fetching mother options:', err)
      }
    }
    fetchMothers()
  }, [user, id])

  useEffect(() => {
    if (isEditing && id) {
      const fetchPatient = async () => {
        try {
          const { data, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', id)
            .single()

          if (error) throw error
          if (data) {
            setFullName(data.name || '')
            setDob(data.dob ? data.dob.substring(0, 10) : '')
            setGender(data.gender || 'female')
            setVillage(data.village || '')
            setPhone(data.phone || '')
            setBloodGroup(data.blood_group || '')
            setAllergies(data.allergies || '')
            setBirthDetails(data.birth_details || '')
            setCategory((data.category as PatientCategory) || 'general')
            setGuardianPatientId(data.guardian_patient_id || '')
            setEdd(data.edd ? data.edd.substring(0, 10) : '')
            setDeliveryHospital(data.delivery_hospital || '')
            setDeliveryDate(data.delivery_date ? data.delivery_date.substring(0, 10) : '')
          }
        } catch (err: any) {
          console.error('Error fetching patient to edit:', err)
          setErrorMsg(err.message || 'Failed to load patient.')
        } finally {
          setInitialLoading(false)
        }
      }
      fetchPatient()
    }
  }, [id, isEditing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!fullName.trim()) {
      setErrorMsg(t('addPatient.validation.nameRequired'))
      return
    }

    if (!user) return
    setLoading(true)

    try {
      const payload: Record<string, any> = {
        name: fullName.trim(),
        dob: dob ? dob : null,
        gender: gender || null,
        village: village.trim() || null,
        phone: phone.trim() || null,
        blood_group: bloodGroup.trim() || null,
        allergies: allergies.trim() || null,
        birth_details: birthDetails.trim() || null,
        category: category || 'general',
        guardian_patient_id: category === 'child' && guardianPatientId ? guardianPatientId : null,
        edd: category === 'pregnant' && edd ? edd : null,
        delivery_hospital: category === 'pregnant' && deliveryHospital.trim() ? deliveryHospital.trim() : null,
        delivery_date: category === 'pregnant' && deliveryDate ? deliveryDate : null,
      }

      if (isEditing && id) {
        const { error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', id)

        if (error) throw error
        setSuccessMsg(t('app.feedback.saveSuccess'))
        setTimeout(() => navigate(`/asha/patients/${id}`), 500)
      } else {
        const { data, error } = await supabase
          .from('patients')
          .insert({
            ...payload,
            asha_id: user.id,
          })
          .select('id')
          .single()

        if (error) throw error
        setSuccessMsg(t('app.feedback.saveSuccess'))
        setTimeout(() => navigate(`/asha/patients/${data.id}`), 500)
      }
    } catch (err: any) {
      console.error('Error saving patient:', err)
      setErrorMsg(err.message || 'Failed to save patient record.')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-lg" />
        <p>{t('app.actions.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

      {/* Header with back link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost btn-sm"
          style={{ minHeight: '38px', minWidth: '38px', padding: '0.35rem' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>
            {isEditing ? t('addPatient.editTitle') : t('addPatient.title')}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {t('addPatient.subtitle')}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Full Name */}
          <div>
            <label htmlFor="field-fullname">{t('addPatient.form.fullName')} *</label>
            <input
              id="field-fullname"
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="e.g. सुनीता देवी / Sunita Devi"
            />
          </div>

          {/* Category Selector (4 Options) */}
          <div>
            <label htmlFor="field-category">{t('addPatient.form.category')} *</label>
            <select
              id="field-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as PatientCategory)}
              required
            >
              <option value="general">{t('categories.general')}</option>
              <option value="pregnant">{t('categories.pregnant')}</option>
              <option value="child">{t('categories.child')}</option>
              <option value="chronic">{t('categories.chronic')}</option>
            </select>
          </div>

          {/* Conditional Fields: Child -> Guardian (Mother) */}
          {category === 'child' && (
            <div style={{
              background: 'var(--color-teal-tint)',
              border: '1px solid var(--color-teal)',
              borderRadius: '10px',
              padding: '0.85rem',
            }}>
              <label htmlFor="field-guardian" style={{ color: 'var(--color-teal)' }}>
                {t('addPatient.form.guardian')}
              </label>
              <select
                id="field-guardian"
                className="select"
                value={guardianPatientId}
                onChange={(e) => setGuardianPatientId(e.target.value)}
              >
                <option value="">{t('addPatient.form.selectGuardian')}</option>
                {motherList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.village ? `(${m.village})` : ''} {m.category ? `[${m.category}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional Fields: Pregnant -> EDD, Delivery Hospital, Delivery Date */}
          {category === 'pregnant' && (
            <div style={{
              background: 'var(--color-accent-tint)',
              border: '1px solid var(--color-accent)',
              borderRadius: '10px',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}>
              <div>
                <label htmlFor="field-edd" style={{ color: 'var(--color-accent)' }}>
                  {t('addPatient.form.edd')} *
                </label>
                <input
                  id="field-edd"
                  type="date"
                  className="input"
                  value={edd}
                  onChange={(e) => setEdd(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="field-delivery-hospital" style={{ color: 'var(--color-accent)' }}>
                  {t('addPatient.form.deliveryHospital')}
                </label>
                <input
                  id="field-delivery-hospital"
                  type="text"
                  className="input"
                  value={deliveryHospital}
                  onChange={(e) => setDeliveryHospital(e.target.value)}
                  placeholder="e.g. Community Health Centre (CHC) / Civil Hospital"
                />
              </div>

              <div>
                <label htmlFor="field-delivery-date" style={{ color: 'var(--color-accent)' }}>
                  {t('addPatient.form.deliveryDate')}
                </label>
                <input
                  id="field-delivery-date"
                  type="date"
                  className="input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* DOB & Gender */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label htmlFor="field-dob">{t('addPatient.form.dob')}</label>
              <input
                id="field-dob"
                type="date"
                className="input"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="field-gender">{t('addPatient.form.gender')}</label>
              <select
                id="field-gender"
                className="select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="female">{t('addPatient.form.genderOptions.female')}</option>
                <option value="male">{t('addPatient.form.genderOptions.male')}</option>
                <option value="other">{t('addPatient.form.genderOptions.other')}</option>
              </select>
            </div>
          </div>

          {/* Village & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label htmlFor="field-village">{t('addPatient.form.village')}</label>
              <input
                id="field-village"
                type="text"
                className="input"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. रामपुर / Rampur"
              />
            </div>
            <div>
              <label htmlFor="field-phone">{t('addPatient.form.phone')}</label>
              <input
                id="field-phone"
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>

          {/* Blood Group */}
          <div>
            <label htmlFor="field-blood">{t('addPatient.form.bloodGroup')}</label>
            <select
              id="field-blood"
              className="select"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
            >
              <option value="">— Select / Not Known —</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>

          {/* Allergies */}
          <div>
            <label htmlFor="field-allergies">{t('addPatient.form.allergies')}</label>
            <input
              id="field-allergies"
              type="text"
              className="input"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
            />
          </div>

          {/* Birth Details */}
          <div>
            <label htmlFor="field-birthdetails">{t('addPatient.form.birthDetails')}</label>
            <textarea
              id="field-birthdetails"
              className="textarea"
              value={birthDetails}
              onChange={(e) => setBirthDetails(e.target.value)}
              placeholder="e.g. Normal delivery at PHC, birth weight 2.8kg, BCG given"
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              id="btn-save-patient"
              style={{ flex: 1 }}
            >
              <Save size={18} />
              <span>
                {loading
                  ? t('app.actions.submitting')
                  : isEditing
                  ? t('addPatient.form.updateBtn')
                  : t('addPatient.form.saveBtn')}
              </span>
            </button>
            <Link to="/asha/patients" className="btn btn-outline">
              {t('addPatient.form.cancelBtn')}
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
