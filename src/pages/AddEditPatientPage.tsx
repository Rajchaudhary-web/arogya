import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
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

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

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
      const payload = {
        name: fullName.trim(),
        dob: dob ? dob : null,
        gender: gender || null,
        village: village.trim() || null,
        phone: phone.trim() || null,
        blood_group: bloodGroup.trim() || null,
        allergies: allergies.trim() || null,
        birth_details: birthDetails.trim() || null,
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
