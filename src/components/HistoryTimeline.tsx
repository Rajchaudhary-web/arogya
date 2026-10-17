import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import Card from './Card'
import {
  type HistoryEntry,
  type HistoryEntryType,
} from '../lib/types'
import {
  Baby,
  Syringe,
  Activity,
  Stethoscope,
  FileCheck2,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Calendar,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  X,
  User,
  AlertCircle,
} from 'lucide-react'

interface HistoryTimelineProps {
  entries: HistoryEntry[]
  isReadOnly?: boolean
  currentUserId?: string | null
  patientProfileId?: string | null
  onEdit?: (entry: HistoryEntry) => void
  onDelete?: (entry: HistoryEntry) => void
  deletingId?: string | null
}

const TYPE_CONFIG: Record<
  HistoryEntryType,
  {
    icon: typeof Baby
    color: string
    tintClass: string
    badgeClass: string
  }
> = {
  birth: {
    icon: Baby,
    color: 'var(--color-accent)',
    tintClass: 'card-tint-saffron',
    badgeClass: 'badge-yellow',
  },
  vaccination: {
    icon: Syringe,
    color: 'var(--color-teal)',
    tintClass: 'card-tint-teal',
    badgeClass: 'badge-teal',
  },
  condition: {
    icon: Activity,
    color: 'var(--color-coral)',
    tintClass: 'card-tint-coral',
    badgeClass: 'badge-coral',
  },
  visit: {
    icon: Stethoscope,
    color: 'var(--color-primary)',
    tintClass: 'card-tint-navy',
    badgeClass: 'badge-navy',
  },
  report: {
    icon: FileCheck2,
    color: 'var(--color-green)',
    tintClass: 'card-tint-green',
    badgeClass: 'badge-green',
  },
  prescription: {
    icon: FileSpreadsheet,
    color: 'var(--color-purple)',
    tintClass: 'card-tint-purple',
    badgeClass: 'badge-yellow',
  },
}

export default function HistoryTimeline({
  entries,
  isReadOnly = false,
  currentUserId,
  patientProfileId,
  onEdit,
  onDelete,
  deletingId,
}: HistoryTimelineProps) {
  const { t } = useTranslation()
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [previewFileName, setPreviewFileName] = useState<string>('')
  const [openingFileId, setOpeningFileId] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const handleOpenFile = async (entry: HistoryEntry) => {
    if (!entry.file_path) return
    setOpeningFileId(entry.id)
    setFileError(null)

    try {
      const { data, error } = await supabase.storage
        .from('patient-files')
        .createSignedUrl(entry.file_path, 60)

      if (error) throw error
      if (!data?.signedUrl) throw new Error('Could not create secure URL.')

      const isImage = entry.file_type?.startsWith('image/') ||
        /\.(jpe?g|png|webp)$/i.test(entry.file_name || '')

      if (isImage) {
        setPreviewImageUrl(data.signedUrl)
        setPreviewFileName(entry.file_name || 'Document Preview')
      } else {
        // Open PDF or other document in a new tab securely
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err: any) {
      console.error('Error opening file:', err)
      setFileError(err.message || 'Failed to open file.')
    } finally {
      setOpeningFileId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--color-teal-tint)' }}>
            <Activity size={32} color="var(--color-teal)" />
          </div>
          <h3 style={{ fontSize: '1.1rem' }}>{t('patientDetail.emptyTimeline')}</h3>
          <p style={{ fontSize: '0.875rem' }}>
            {isReadOnly ? t('records.noRecordsSub') : t('patientDetail.emptyTimelineSub')}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <>
      {fileError && (
        <div className="toast-banner error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span>{fileError}</span>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            style={{
              background: 'var(--color-white)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                {previewFileName}
              </span>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="btn btn-ghost btn-sm"
                style={{ minHeight: '34px', minWidth: '34px', padding: 0 }}
                aria-label={t('app.actions.close')}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '0.75rem', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
              <img
                src={previewImageUrl}
                alt={previewFileName}
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="timeline">
        {entries.map((entry) => {
          const config = TYPE_CONFIG[entry.entry_type] || TYPE_CONFIG.visit
          const Icon = config.icon

          // Determine permissions
          // If in readOnly mode (Patient My Records):
          // Patients can edit/delete only entries they added (entry.added_by === currentUserId)
          const isAddedByCurrentPatient = Boolean(
            currentUserId && entry.added_by && entry.added_by === currentUserId
          )
          const canModify = !isReadOnly
            ? Boolean(onEdit && onDelete)
            : Boolean(isAddedByCurrentPatient && onEdit && onDelete)

          // Check if added by patient for ASHA badge display
          const isAddedByPatient = Boolean(
            patientProfileId && entry.added_by && entry.added_by === patientProfileId
          )

          const isPdf = entry.file_type === 'application/pdf' ||
            entry.file_name?.toLowerCase().endsWith('.pdf')

          return (
            <div key={entry.id} className="timeline-item">
              {/* Marker Dot / Icon */}
              <div className="timeline-marker" style={{ borderColor: config.color }}>
                <Icon size={18} color={config.color} strokeWidth={2.2} />
              </div>

              {/* Content Card */}
              <Card style={{ borderLeft: `4px solid ${config.color}` }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.4rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${config.badgeClass}`}>
                      {t(`patientDetail.entryTypes.${entry.entry_type}`)}
                    </span>

                    {/* Badge: Added by patient (shown on ASHA view) */}
                    {!isReadOnly && isAddedByPatient && (
                      <span className="badge badge-teal" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <User size={12} />
                        <span>{t('patientDetail.addedByPatient')}</span>
                      </span>
                    )}

                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {entry.title}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    <Calendar size={14} />
                    <span>
                      {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>

                {entry.notes && (
                  <p style={{
                    fontSize: '0.9rem',
                    color: 'var(--color-text)',
                    lineHeight: 1.5,
                    background: 'var(--color-bg)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    marginTop: '0.5rem',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {entry.notes}
                  </p>
                )}

                {/* File chip & View Button if file is attached */}
                {entry.file_path && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--color-primary-tint)',
                    borderRadius: '8px',
                    border: '1px solid #CCD8F2',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      {isPdf ? (
                        <FileText size={18} color="var(--color-red)" />
                      ) : (
                        <ImageIcon size={18} color="var(--color-primary)" />
                      )}
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '240px',
                      }}>
                        {entry.file_name || t('records.fileAttached')}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenFile(entry)}
                      disabled={openingFileId === entry.id}
                      className="btn btn-outline btn-sm"
                      style={{
                        padding: '0.35rem 0.75rem',
                        minHeight: '36px',
                        background: 'var(--color-white)',
                      }}
                      id={`btn-view-file-${entry.id}`}
                    >
                      {isPdf ? <ExternalLink size={14} /> : <Eye size={14} />}
                      <span>{t('app.actions.viewFile')}</span>
                    </button>
                  </div>
                )}

                {/* Action buttons (ASHA or Patient owned entries) */}
                {canModify && onEdit && onDelete && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    marginTop: '0.65rem',
                    borderTop: '1px solid var(--color-border-subtle)',
                    paddingTop: '0.5rem',
                  }}>
                    <button
                      onClick={() => onEdit(entry)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0.35rem 0.75rem' }}
                      title={t('app.actions.edit')}
                    >
                      <Edit2 size={14} />
                      <span>{t('app.actions.edit')}</span>
                    </button>
                    <button
                      onClick={() => onDelete(entry)}
                      disabled={deletingId === entry.id}
                      className="btn btn-danger-outline btn-sm"
                      style={{ padding: '0.35rem 0.75rem' }}
                      title={t('app.actions.delete')}
                    >
                      <Trash2 size={14} />
                      <span>{t('app.actions.delete')}</span>
                    </button>
                  </div>
                )}
              </Card>
            </div>
          )
        })}
      </div>
    </>
  )
}
