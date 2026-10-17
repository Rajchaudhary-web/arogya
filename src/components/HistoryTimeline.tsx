import { useTranslation } from 'react-i18next'
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
} from 'lucide-react'

interface HistoryTimelineProps {
  entries: HistoryEntry[]
  isReadOnly?: boolean
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
  onEdit,
  onDelete,
  deletingId,
}: HistoryTimelineProps) {
  const { t } = useTranslation()

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
    <div className="timeline">
      {entries.map((entry) => {
        const config = TYPE_CONFIG[entry.entry_type] || TYPE_CONFIG.visit
        const Icon = config.icon

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

              {/* Action buttons (ASHA only: edit, delete) */}
              {!isReadOnly && onEdit && onDelete && (
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
  )
}
