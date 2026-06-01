'use client'
import { useEffect, useState, useCallback } from 'react'

interface GeneratedFile {
  id:               string
  project_id:       string | null
  filename:         string
  mime_type:        string
  content_type:     string
  title:            string | null
  description:      string | null
  generated_by_role: string | null
  size_bytes:       number
  created_at:       string
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  markdown: 'MD',
  csv:      'CSV',
  json:     'JSON',
  text:     'TXT',
}

const CONTENT_TYPE_COLOR: Record<string, string> = {
  markdown: '#6366f1',
  csv:      '#059669',
  json:     '#d97706',
  text:     '#64748b',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilesPage() {
  const [files, setFiles]   = useState<GeneratedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/files')
      const data = await res.json()
      setFiles(data.files ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function del(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDeleting(id)
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' })
      setFiles(prev => prev.filter(f => f.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ padding: '40px 40px', maxWidth: 900 }} className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AÏKO
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Generated Files
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          Files created by AÏKO agents — reports, exports, campaign assets.
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Loading files…
        </div>
      ) : files.length === 0 ? (
        <div style={{
          padding: '48px 32px', textAlign: 'center',
          background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No files yet</div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            Ask the CEO to generate a report or export, or use the Files tab in a project workspace.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map(file => (
            <FileRow
              key={file.id}
              file={file}
              onDelete={() => del(file.id, file.filename)}
              deleting={deleting === file.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FileRow({
  file,
  onDelete,
  deleting,
}: {
  file: GeneratedFile
  onDelete: () => void
  deleting: boolean
}) {
  const typeLabel = CONTENT_TYPE_LABEL[file.content_type] ?? file.content_type.toUpperCase()
  const typeColor = CONTENT_TYPE_COLOR[file.content_type] ?? '#94a3b8'
  const date = new Date(file.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '36px 1fr auto',
      alignItems: 'center',
      gap: 14,
      padding: '14px 16px',
      background: '#ffffff',
      border: '1px solid #f1f5f9',
      borderRadius: 10,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Type badge */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${typeColor}15`,
        border: `1px solid ${typeColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: typeColor,
        fontFamily: 'DM Mono, monospace', flexShrink: 0,
      }}>
        {typeLabel}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#0f172a',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {file.title ?? file.filename}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
            {file.filename}
          </span>
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>·</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatBytes(file.size_bytes)}</span>
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>·</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{date}</span>
          {file.generated_by_role && (
            <>
              <span style={{ fontSize: 11, color: '#cbd5e1' }}>·</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>by {file.generated_by_role}</span>
            </>
          )}
        </div>
        {file.description && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
            {file.description.slice(0, 120)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <a
          href={`/api/files/${file.id}/download`}
          download={file.filename}
          style={{
            padding: '6px 12px', borderRadius: 7,
            background: '#f8fafc', color: '#374151',
            border: '1px solid #e2e8f0',
            fontSize: 12, fontWeight: 500,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          ↓ Download
        </a>
        <button
          onClick={onDelete}
          disabled={deleting}
          style={{
            padding: '6px 10px', borderRadius: 7,
            background: 'none', color: '#dc2626',
            border: '1px solid #fecaca',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          {deleting ? '…' : '✕'}
        </button>
      </div>
    </div>
  )
}
