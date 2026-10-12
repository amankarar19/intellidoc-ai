import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Files,
  LayoutDashboard,
  Loader2,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  LogOut,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { createDocument, deleteDocument, listDocuments, updateDocument } from './lib/documents.js'
import { isSupabaseConfigured, supabaseProjectRef } from './lib/supabase.js'
import { getSession, onAuthChange, signOut } from './lib/auth.js'
import AuthScreen from './components/AuthScreen.jsx'
import {
  DOCUMENT_TYPES,
  STATUS,
  STATUSES,
  computeStats,
  filterDocuments,
  getExpiringSoon,
  getRecordWarning,
  validateDocument,
} from './utils/validation.js'
import { describeExpiry, formatDate, formatTimestamp, todayISO } from './utils/dates.js'
import { downloadCsv, toCsv } from './utils/csv.js'
import AiReview from './components/AiReview.jsx'

const PROJECT_NAME = 'IntelliDoc AI: AI-Powered Document Review and Management System'
const PAGE_SIZE = 10

const VIEWS = {
  overview: { label: 'Overview', description: 'A live summary of your document records and their verification status.' },
  documents: { label: 'Documents', description: 'Search, filter, edit and export every document record.' },
  ai: { label: 'AI Review', description: 'Analyse a document with AI, check the result yourself, then save it as Pending.' },
  review: { label: 'Needs Review', description: 'Records that are Pending or Rejected and may need attention.' },
}
const VIEW_ICONS = { overview: LayoutDashboard, documents: Files, ai: Sparkles, review: AlertTriangle }

const statusTone = (status) => (status === STATUS.VERIFIED ? 'verified' : status === STATUS.REJECTED ? 'rejected' : 'pending')

// ---------------------------------------------------------------------------
// Small presentational components
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${statusTone(status)}`}>
      <span className="dot" aria-hidden="true" />
      {status}
    </span>
  )
}

function StatCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`} aria-hidden="true">
        <Icon size={20} />
      </div>
      <div className="stat-text">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-hint">{hint}</div>
      </div>
    </div>
  )
}

function ModalShell({ title, subtitle, onClose, children, labelId }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="modal-header">
          <div>
            <h2 id={labelId}>{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shown instead of the app when .env has not been filled in
// ---------------------------------------------------------------------------

function SetupRequired() {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="brand-mark large"><ShieldCheck size={26} /></div>
        <h1>Connect IntelliDoc AI to Supabase</h1>
        <p className="muted">
          The app stores its records in a Supabase PostgreSQL database. The connection settings were not found, so there is nothing to show yet.
        </p>
        <ol className="setup-steps">
          <li>Run <code>supabase.sql</code>, then <code>supabase-auth-migration.sql</code>, in the Supabase SQL Editor.</li>
          <li>Copy <code>.env.example</code> to a file named exactly <code>.env</code> in the project folder (next to <code>package.json</code>). Names such as <code>.env.txt</code> or <code>intellidoc-lite.env</code> are ignored.</li>
          <li>
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (Supabase: Project Settings, then API).
          </li>
          <li>Stop the dev server and run <code>npm run dev</code> again.</li>
        </ol>
        <p className="muted small">Never use the service_role (secret) key here. Variables starting with VITE_ are visible in the browser.</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit form
// ---------------------------------------------------------------------------

const AUTO = 'Auto'

function DocumentForm({ doc, onSave, onClose }) {
  const isEdit = Boolean(doc)
  const [values, setValues] = useState({
    title: doc?.title ?? '',
    document_type: doc?.document_type ?? '',
    document_number: doc?.document_number ?? '',
    expiry_date: doc?.expiry_date ?? '',
    notes: doc?.notes ?? '',
    status: isEdit ? doc.status : AUTO,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const preview = useMemo(() => validateDocument(values), [values])

  const setField = (name) => (e) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    const result = validateDocument(values)
    if (!result.isValid) {
      setErrors(result.errors)
      return
    }
    const payload = {
      title: values.title.trim(),
      document_type: values.document_type,
      document_number: values.document_number.trim(),
      expiry_date: values.expiry_date || null,
      notes: values.notes.trim() || null,
      status: values.status === AUTO ? result.status : values.status,
    }
    setSaving(true)
    try {
      await onSave(payload, doc?.id, result)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong while saving.')
      setSaving(false)
    }
  }

  const showRuleHint = preview.isValid && values.status === AUTO
  const manualOverride = values.status !== AUTO && preview.isValid && preview.status !== values.status

  return (
    <ModalShell
      title={isEdit ? 'Edit document' : 'Add document'}
      subtitle={isEdit ? 'Update the details of this record.' : 'Register a new document record. Fields marked * are required.'}
      onClose={saving ? () => {} : onClose}
      labelId="form-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {submitError && (
            <div className="alert alert-error" role="alert">
              <AlertTriangle size={16} /> <span>{submitError}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="f-title">Document title <span className="req" aria-hidden="true">*</span></label>
            <input id="f-title" value={values.title} onChange={setField('title')} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'e-title' : undefined} placeholder="e.g. Sample Training Certificate" maxLength={150} autoFocus />
            {errors.title && <p className="field-error" id="e-title">{errors.title}</p>}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="f-type">Document type <span className="req" aria-hidden="true">*</span></label>
              <select id="f-type" value={values.document_type} onChange={setField('document_type')} aria-invalid={Boolean(errors.document_type)} aria-describedby={errors.document_type ? 'e-type' : undefined}>
                <option value="">Select a type…</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {errors.document_type && <p className="field-error" id="e-type">{errors.document_type}</p>}
            </div>

            <div className="field">
              <label htmlFor="f-number">Document number <span className="req" aria-hidden="true">*</span></label>
              <input id="f-number" value={values.document_number} onChange={setField('document_number')} aria-invalid={Boolean(errors.document_number)} aria-describedby={errors.document_number ? 'e-number' : undefined} placeholder="e.g. CERT-1001" maxLength={60} />
              {errors.document_number && <p className="field-error" id="e-number">{errors.document_number}</p>}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="f-expiry">Expiry date <span className="optional">(optional)</span></label>
              <input id="f-expiry" type="date" value={values.expiry_date} onChange={setField('expiry_date')} aria-invalid={Boolean(errors.expiry_date)} aria-describedby={errors.expiry_date ? 'e-expiry' : undefined} />
              {errors.expiry_date && <p className="field-error" id="e-expiry">{errors.expiry_date}</p>}
            </div>

            <div className="field">
              <label htmlFor="f-status">Verification status</label>
              <select id="f-status" value={values.status} onChange={setField('status')}>
                <option value={AUTO}>Automatic (apply rules)</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-notes">Notes <span className="optional">(optional)</span></label>
            <textarea id="f-notes" rows={3} value={values.notes} onChange={setField('notes')} maxLength={1000} placeholder="Any remarks about this document" />
            {errors.notes && <p className="field-error">{errors.notes}</p>}
          </div>

          {showRuleHint && (
            <div className={`alert ${preview.status === STATUS.REJECTED ? 'alert-warn' : 'alert-info'}`}>
              <ShieldCheck size={16} />
              <span>Rule check: <strong>{preview.status}</strong>. {preview.note}</span>
            </div>
          )}
          {manualOverride && (
            <div className="alert alert-warn">
              <AlertTriangle size={16} />
              <span>You are overriding the rule-based result ({preview.status}) with “{values.status}”.</span>
            </div>
          )}
          <p className="disclaimer">
            Rule-based checks only confirm that required details are present and the expiry date has not passed. They do not prove that a document is authentic.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (<><Loader2 size={16} className="spin" /> Saving…</>) : isEdit ? 'Save changes' : 'Save document'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function ConfirmDelete({ doc, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm(doc)
    } catch (err) {
      setError(err.message || 'Could not delete the document.')
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Delete document?" onClose={busy ? () => {} : onClose} labelId="delete-title">
      <div className="modal-body">
        {error && (
          <div className="alert alert-error" role="alert">
            <AlertTriangle size={16} /> <span>{error}</span>
          </div>
        )}
        <p>
          You are about to permanently delete <strong>{doc.title}</strong> ({doc.document_number}). This cannot be undone.
        </p>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
          {busy ? (<><Loader2 size={16} className="spin" /> Deleting…</>) : 'Delete document'}
        </button>
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Overview extras
// ---------------------------------------------------------------------------

function StatusBar({ stats }) {
  const parts = [
    { key: 'verified', label: 'Verified', value: stats.verified },
    { key: 'pending', label: 'Pending', value: stats.pending },
    { key: 'rejected', label: 'Rejected', value: stats.rejected },
  ]
  return (
    <div className="card">
      <div className="card-head">
        <h2>Status distribution</h2>
        <span className="muted small">{stats.total} total</span>
      </div>
      <div className="card-body">
        {stats.total === 0 ? (
          <p className="muted">No records yet.</p>
        ) : (
          <>
            <div className="bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
              {parts.map((p) => p.value > 0 && <span key={p.key} className={`bar-seg seg-${p.key}`} style={{ width: `${(p.value / stats.total) * 100}%` }} />)}
            </div>
            <ul className="legend">
              {parts.map((p) => (
                <li key={p.key}>
                  <span className={`legend-dot seg-${p.key}`} aria-hidden="true" />
                  <span>{p.label}</span>
                  <strong>{p.value}</strong>
                  <span className="muted small">{Math.round((p.value / stats.total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function ExpiringSoon({ docs, today }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Expiring within 30 days</h2>
        <CalendarClock size={18} className="muted" aria-hidden="true" />
      </div>
      {docs.length === 0 ? (
        <div className="card-body"><p className="muted">No documents are close to expiring.</p></div>
      ) : (
        <ul className="list">
          {docs.slice(0, 4).map((d) => {
            const info = describeExpiry(d.expiry_date, today)
            return (
              <li key={d.id}>
                <div className="min0">
                  <div className="cell-title truncate">{d.title}</div>
                  <div className="muted small">{formatDate(d.expiry_date)}</div>
                </div>
                {info && <span className={`pill pill-${info.tone}`}>{info.text}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RecentRecords({ docs }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Recent records</h2>
      </div>
      {docs.length === 0 ? (
        <div className="card-body"><p className="muted">Nothing here yet. Add your first document.</p></div>
      ) : (
        <ul className="list">
          {docs.map((d) => (
            <li key={d.id}>
              <div className="min0">
                <div className="cell-title truncate">{d.title}</div>
                <div className="muted small truncate">{d.document_type} · {d.document_number} · added {formatTimestamp(d.created_at)}</div>
              </div>
              <StatusBadge status={d.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.key === field
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`th-btn ${active ? 'active' : ''}`} onClick={() => onSort(field)}>
        {label} <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  )
}

function Dashboard({ user, onSignOut, signingOut }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState('overview')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [formState, setFormState] = useState({ open: false, doc: null })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)
  const [navOpen, setNavOpen] = useState(false)

  const showToast = useCallback((type, message) => setToast({ type, message, id: Date.now() }), [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setDocs(await listDocuments())
    } catch (err) {
      setLoadError(err.message || 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Everything below is calculated from the real data in `docs`.
  const today = todayISO()
  const stats = useMemo(() => computeStats(docs), [docs])
  const recent = useMemo(() => docs.slice(0, 5), [docs])
  const expiringSoon = useMemo(() => getExpiringSoon(docs, today), [docs, today])
  const baseList = useMemo(() => (view === 'review' ? docs.filter((d) => d.status !== STATUS.VERIFIED) : docs), [docs, view])
  const tabCounts = useMemo(() => computeStats(filterDocuments(baseList, search, 'All')), [baseList, search])
  const visible = useMemo(() => filterDocuments(baseList, search, statusFilter), [baseList, search, statusFilter])

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...visible].sort((a, b) => {
      if (sort.key === 'expiry_date') {
        if (!a.expiry_date && !b.expiry_date) return 0
        if (!a.expiry_date) return 1 // records without an expiry date always go last
        if (!b.expiry_date) return -1
      }
      return String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), undefined, { sensitivity: 'base', numeric: true }) * dir
    })
  }, [visible, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const hasFilters = search.trim() !== '' || statusFilter !== 'All'

  function changeView(next) {
    setView(next)
    setNavOpen(false)
    setSearch('')
    setStatusFilter('All')
    setPage(1)
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'created_at' ? 'desc' : 'asc' }))
    setPage(1)
  }

  async function handleSave(payload, id, ruleResult) {
    // Errors thrown here are caught by the form and shown inside it.
    if (id) {
      const updated = await updateDocument(id, payload)
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)))
      showToast('success', 'Document updated.')
    } else {
      const created = await createDocument(payload)
      setDocs((prev) => [created, ...prev])
      showToast('success', `Document saved as ${created.status}. ${ruleResult.note}`)
    }
    setFormState({ open: false, doc: null })
  }

  async function handleDelete(doc) {
    await deleteDocument(doc.id)
    setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    setDeleteTarget(null)
    showToast('success', 'Document deleted.')
  }

  async function handleStatusChange(doc, status) {
    if (status === doc.status) return
    setBusyId(doc.id)
    try {
      const updated = await updateDocument(doc.id, { status })
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? updated : d)))
      showToast('success', `Status changed to ${status}.`)
    } catch (err) {
      showToast('error', err.message || 'Could not change the status.')
    } finally {
      setBusyId(null)
    }
  }

  function handleExport() {
    if (sorted.length === 0) {
      showToast('error', 'There are no records to export.')
      return
    }
    downloadCsv(`intellidoc-report-${todayISO()}.csv`, toCsv(sorted))
    showToast('success', `Exported ${sorted.length} record${sorted.length === 1 ? '' : 's'} to CSV.`)
  }

  const meta = VIEWS[view]
  const ready = !loading && !loadError
  const reviewCount = stats.pending + stats.rejected

  const tabs = [
    { value: 'All', label: 'All', count: tabCounts.total },
    { value: STATUS.VERIFIED, label: 'Verified', count: tabCounts.verified },
    { value: STATUS.PENDING, label: 'Pending', count: tabCounts.pending },
    { value: STATUS.REJECTED, label: 'Rejected', count: tabCounts.rejected },
  ]

  return (
    <div className="app">
      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={20} /></div>
          <div>
            <div className="brand-name">IntelliDoc AI</div>
            <div className="brand-sub">Document management</div>
          </div>
        </div>

        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {Object.entries(VIEWS).map(([key, v]) => {
            const Icon = VIEW_ICONS[key]
            return (
              <button key={key} type="button" className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => changeView(key)} aria-current={view === key ? 'page' : undefined}>
                <Icon size={18} /> {v.label}
                {key === 'review' && reviewCount > 0 && <span className="nav-count">{reviewCount}</span>}
              </button>
            )
          })}
        </nav>

        <div className="user-box">
          <div className="user-email truncate" title={user?.email}>{user?.email}</div>
          <button type="button" className="btn btn-ghost btn-sm user-signout" onClick={onSignOut} disabled={signingOut}>
            <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

        <div className="connection">
          <div className="connection-row">
            <span className="status-dot" aria-hidden="true" />
            <span className="connection-title">Supabase connected</span>
          </div>
          <div className="connection-sub mono truncate" title={supabaseProjectRef}>{supabaseProjectRef}</div>
          <div className="connection-sub">PostgreSQL · documents</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open navigation menu">
            <Menu size={20} />
          </button>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <span>IntelliDoc AI</span>
            <span className="sep">/</span>
            <strong>{meta.label}</strong>
          </nav>
          <button type="button" className="btn btn-ghost btn-sm refresh" onClick={loadDocuments} disabled={loading} title="Reload from database">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> <span className="hide-sm">Refresh</span>
          </button>
          <div className="conn-pill"><span className="status-dot" aria-hidden="true" /> Live · Supabase</div>
        </header>

        <main className="content">
          {view === 'ai' && (
            <>
              <div className="page-head">
                <div>
                  <h1>{meta.label}</h1>
                  <p className="muted">{meta.description}</p>
                </div>
              </div>
              <AiReview
                onSaved={(created) => {
                  setDocs((prev) => [created, ...prev])
                  showToast('success', 'Saved as Pending. You can find it under Documents.')
                }}
                onOpenDocuments={() => changeView('documents')}
              />
            </>
          )}
          {view !== 'ai' && (
          <>
          <div className="page-head">
            <div>
              <h1>{meta.label}</h1>
              <p className="muted">{meta.description}</p>
            </div>
            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={!ready}>
                <Download size={16} /> Export Report
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFormState({ open: true, doc: null })} disabled={Boolean(loadError)}>
                <Plus size={16} /> Add Document
              </button>
            </div>
          </div>

          {view === 'overview' && (
            <>
              <section className="stats" aria-label="Summary statistics">
                <StatCard label="Total documents" value={stats.total} hint="All records" icon={FileText} tone="navy" />
                <StatCard label="Verified" value={stats.verified} hint={stats.total ? `${Math.round((stats.verified / stats.total) * 100)}% of records` : 'No records yet'} icon={CheckCircle2} tone="green" />
                <StatCard label="Pending" value={stats.pending} hint="Awaiting review" icon={Clock} tone="amber" />
                <StatCard label="Rejected" value={stats.rejected} hint="Incomplete or expired" icon={XCircle} tone="red" />
              </section>

              {ready && (
                <section className="grid-3">
                  <StatusBar stats={stats} />
                  <ExpiringSoon docs={expiringSoon} today={today} />
                  <RecentRecords docs={recent} />
                </section>
              )}
            </>
          )}

          <section className="card" aria-label="Document records">
            <div className="card-head">
              <h2>{view === 'overview' ? 'All documents' : view === 'review' ? 'Records to review' : 'Document records'}</h2>
              {ready && <span className="muted small">{sorted.length} of {baseList.length} record{baseList.length === 1 ? '' : 's'}</span>}
            </div>

            <div className="toolbar">
              <div className="search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search title, type, number or status" aria-label="Search documents" />
              </div>
              <div className="tabs" role="group" aria-label="Filter by status">
                {tabs.map((t) => (
                  <button key={t.value} type="button" className={`tab ${statusFilter === t.value ? 'active' : ''}`} aria-pressed={statusFilter === t.value} onClick={() => { setStatusFilter(t.value); setPage(1) }}>
                    {t.label} <span className="tab-count">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className="state" role="status">
                <Loader2 size={26} className="spin" />
                <p>Loading documents…</p>
              </div>
            )}

            {loadError && (
              <div className="state state-error" role="alert">
                <div className="state-icon bad"><AlertTriangle size={22} /></div>
                <p><strong>Could not load documents</strong></p>
                <p className="muted state-msg">{loadError}</p>
                <button type="button" className="btn btn-secondary" onClick={loadDocuments}>Try again</button>
              </div>
            )}

            {ready && sorted.length === 0 && (
              <div className="state">
                <div className="state-icon"><FileText size={22} /></div>
                {baseList.length === 0 ? (
                  <>
                    <p><strong>{view === 'review' ? 'Nothing needs review' : 'No documents yet'}</strong></p>
                    <p className="muted">{view === 'review' ? 'Every record is Verified.' : 'Add your first document to get started.'}</p>
                    {view !== 'review' && (
                      <button type="button" className="btn btn-primary" onClick={() => setFormState({ open: true, doc: null })}>
                        <Plus size={16} /> Add Document
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p><strong>No matching documents</strong></p>
                    <p className="muted">Try a different search term or status.</p>
                    {hasFilters && (
                      <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setStatusFilter('All'); setPage(1) }}>Clear filters</button>
                    )}
                  </>
                )}
              </div>
            )}

            {ready && rows.length > 0 && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortHeader label="Document" field="title" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Type" field="document_type" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Expiry" field="expiry_date" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Status" field="status" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Created" field="created_at" sort={sort} onSort={toggleSort} />
                        <th scope="col" className="col-actions"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => {
                        const warning = getRecordWarning(d, today)
                        const expiry = describeExpiry(d.expiry_date, today)
                        return (
                          <tr key={d.id}>
                            <td>
                              <div className="doc-cell">
                                <div className="doc-icon" aria-hidden="true"><FileText size={16} /></div>
                                <div className="min0">
                                  <div className="cell-title">{d.title}{d.ai_summary && <span className="ai-tag" title={`AI-assisted record. ${d.ai_summary}`}>AI</span>}</div>
                                  <div className="muted small mono">{d.document_number}</div>
                                  {d.notes && <div className="muted small clamp" title={d.notes}>{d.notes}</div>}
                                </div>
                              </div>
                            </td>
                            <td><span className="type-chip">{d.document_type}</span></td>
                            <td>
                              <div>{formatDate(d.expiry_date)}</div>
                              {expiry && <div className={`small tone-text-${expiry.tone}`}>{expiry.text}</div>}
                            </td>
                            <td>
                              <select className={`status-select badge-${statusTone(d.status)}`} value={d.status} onChange={(e) => handleStatusChange(d, e.target.value)} disabled={busyId === d.id} aria-label={`Status of ${d.title}`}>
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              {warning && <div className="small tone-text-bad">{warning}</div>}
                            </td>
                            <td className="nowrap muted">{formatTimestamp(d.created_at)}</td>
                            <td className="col-actions">
                              <button type="button" className="icon-btn" onClick={() => setFormState({ open: true, doc: d })} aria-label={`Edit ${d.title}`} title="Edit">
                                <Pencil size={16} />
                              </button>
                              <button type="button" className="icon-btn danger" onClick={() => setDeleteTarget(d)} aria-label={`Delete ${d.title}`} title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pager">
                  <span className="muted small">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div className="pager-controls">
                    <button type="button" className="icon-btn bordered" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="small">Page {currentPage} of {pageCount}</span>
                    <button type="button" className="icon-btn bordered" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="Next page">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          </>
          )}
        </main>

        <footer className="footer">
          <span>{PROJECT_NAME}</span>
          <span>Rule-based prototype · does not prove document authenticity</span>
        </footer>
      </div>

      {formState.open && (
        <DocumentForm doc={formState.doc} onSave={handleSave} onClose={() => setFormState({ open: false, doc: null })} />
      )}
      {deleteTarget && <ConfirmDelete doc={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}

      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} key={toast.id}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
          <button type="button" className="icon-btn" onClick={() => setToast(null)} aria-label="Dismiss message"><X size={14} /></button>
        </div>
      )}
    </div>
  )
}

function AuthGate() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    getSession().then((s) => active && setSession((prev) => (prev === undefined ? s : prev)))
    const stop = onAuthChange((s) => active && setSession(s))
    return () => {
      active = false
      stop()
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      // Even if the server call fails, drop the local session so the user is really signed out.
      setSession(null)
    } finally {
      setSigningOut(false)
    }
  }

  if (session === undefined) {
    return (
      <div className="setup-page" role="status" aria-live="polite">
        <div className="muted">Loading…</div>
      </div>
    )
  }
  if (!session) return <AuthScreen />
  // key = user id, so no data from a previous user can linger after switching accounts
  return <Dashboard key={session.user.id} user={session.user} onSignOut={handleSignOut} signingOut={signingOut} />
}

export default function App() {
  return isSupabaseConfigured ? <AuthGate /> : <SetupRequired />
}
