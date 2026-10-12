import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Info, Loader2, RotateCcw, Save, Sparkles, Upload, X } from 'lucide-react'
import { analyzeDocument, readPdfAsBase64 } from '../lib/ai.js'
import { createDocument } from '../lib/documents.js'
import { DOCUMENT_TYPES } from '../utils/validation.js'
import { formatDate } from '../utils/dates.js'
import {
  BASIS_LABELS,
  MAX_PDF_MB,
  MAX_TEXT_CHARS,
  REVIEW_SECTIONS,
  buildSavePayload,
  formatBytes,
  initialFormValues,
  validatePdfFile,
  validateReviewForm,
  validateTextInput,
} from '../utils/aiInput.js'

// Everything the AI returns is rendered as ordinary text by React (never as HTML).

function FindingList({ title, items }) {
  return (
    <div className="finding-group">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted small">Nothing reported.</p>
      ) : (
        <ul className="findings">
          {items.map((item, i) => (
            <li key={i}>
              <span className={`basis basis-${item.basis}`}>{BASIS_LABELS[item.basis] ?? 'AI suggestion'}</span>
              <span className="finding-text">{item.text}</span>
              {item.evidence && <span className="evidence">“{item.evidence}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AiReview({ onSaved, onOpenDocuments }) {
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [inputError, setInputError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null) // { analysis, model, source }
  const [values, setValues] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(null)

  const busy = useRef(false) // blocks double clicks even before React re-renders
  const runId = useRef(0) // lets us ignore an old response after "start over"
  const fileInput = useRef(null)

  const locked = analyzing

  function chooseMode(next) {
    if (locked) return
    setMode(next)
    setInputError('')
  }

  function onFileChosen(e) {
    const picked = e.target.files?.[0] ?? null
    e.target.value = '' // lets the same file be chosen again after removing it
    if (!picked) return
    const problem = validatePdfFile(picked)
    if (problem) {
      setFile(null)
      setInputError(problem)
      return
    }
    setFile(picked)
    setInputError('')
  }

  function clearFile() {
    setFile(null)
    setInputError('')
  }

  async function analyze() {
    if (busy.current) return
    setInputError('')

    const problem = mode === 'text' ? validateTextInput(text) : validatePdfFile(file)
    if (problem) {
      setInputError(problem)
      return
    }

    busy.current = true
    setAnalyzing(true)
    const id = ++runId.current
    try {
      const input =
        mode === 'text'
          ? { kind: 'text', text: text.trim() }
          : { kind: 'pdf', filename: file.name, data: await readPdfAsBase64(file) }
      const data = await analyzeDocument(input)
      if (id !== runId.current) return
      setResult({ analysis: data.analysis, model: data.model, source: data.source ?? { type: input.kind, filename: input.filename } })
      setValues(initialFormValues(data.analysis))
      setFieldErrors({})
      setSaveError('')
      setSaved(null)
    } catch (err) {
      if (id === runId.current) setInputError(err.message || 'The analysis failed. Please try again.')
    } finally {
      if (id === runId.current) {
        busy.current = false
        setAnalyzing(false)
      }
    }
  }

  function startOver() {
    runId.current += 1 // ignore any analysis still in flight
    busy.current = false
    setAnalyzing(false)
    setResult(null)
    setValues(null)
    setFieldErrors({})
    setSaveError('')
    setSaved(null)
    setSaving(false)
    setInputError('')
    setText('')
    setFile(null)
  }

  const setField = (name) => (e) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [name]: value }))
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  async function save() {
    if (saving || saved || !result || !values) return
    const check = validateReviewForm(values)
    if (!check.isValid) {
      setFieldErrors(check.errors)
      setSaveError('Please fix the highlighted fields before saving.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const created = await createDocument(buildSavePayload({ values, analysis: result.analysis, source: result.source, model: result.model }))
      setSaved(created)
      onSaved(created)
    } catch (err) {
      // The analysis stays on screen, so the user can retry the save without calling the AI again.
      setSaveError(err.message || 'Could not save the document.')
    } finally {
      setSaving(false)
    }
  }

  const analysis = result?.analysis
  const uncertain = new Set(analysis?.uncertain_fields ?? [])
  const formLocked = saving || Boolean(saved)

  const note = (name) => (uncertain.has(name) && !saved ? <p className="uncertain small">The AI was unsure about this. Please check it.</p> : null)

  return (
    <div className="ai-page">
      {/* ---------- Input ---------- */}
      <section className="card" aria-label="Document input">
        <div className="card-head">
          <h2>1. Provide the document</h2>
          {result && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={startOver} disabled={saving}>
              <RotateCcw size={14} /> Start over
            </button>
          )}
        </div>
        <div className="card-body ai-input">
          <div className="alert alert-info">
            <Info size={16} />
            <span>
              The text or PDF is sent to Google's Gemini API for analysis. Use <strong>fictional or non-sensitive documents only</strong>.
            </span>
          </div>

          <div className="tabs ai-tabs" role="group" aria-label="Input method">
            <button type="button" className={`tab ${mode === 'text' ? 'active' : ''}`} aria-pressed={mode === 'text'} onClick={() => chooseMode('text')} disabled={locked}>
              Paste text
            </button>
            <button type="button" className={`tab ${mode === 'pdf' ? 'active' : ''}`} aria-pressed={mode === 'pdf'} onClick={() => chooseMode('pdf')} disabled={locked}>
              Upload PDF
            </button>
          </div>

          {mode === 'text' ? (
            <div className="field">
              <label htmlFor="ai-text">Document text</label>
              <textarea
                id="ai-text"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={locked}
                placeholder="Paste the full text of a document here, for example a certificate, invoice or permit (fictional data only)."
                aria-invalid={Boolean(inputError)}
                aria-describedby="ai-text-count"
                maxLength={MAX_TEXT_CHARS + 2000}
              />
              <div id="ai-text-count" className={`small ${text.trim().length > MAX_TEXT_CHARS ? 'tone-text-bad' : 'muted'}`}>
                {text.trim().length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()} characters
              </div>
            </div>
          ) : (
            <div className="field">
              <span className="label-like" id="ai-file-label">PDF file</span>
              {file ? (
                <div className="file-chip">
                  <FileText size={18} aria-hidden="true" />
                  <div className="min0">
                    <div className="cell-title truncate">{file.name}</div>
                    <div className="muted small">{formatBytes(file.size)}</div>
                  </div>
                  <button type="button" className="icon-btn" onClick={clearFile} disabled={locked} aria-label="Remove selected file">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className={`dropzone ${locked ? 'disabled' : ''}`}>
                  <Upload size={22} aria-hidden="true" />
                  <span><strong>Choose a PDF</strong> to analyse</span>
                  <span className="muted small">PDF only, up to {MAX_PDF_MB} MB. Text-based PDFs work best.</span>
                  <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={onFileChosen} disabled={locked} aria-labelledby="ai-file-label" />
                </label>
              )}
            </div>
          )}

          {inputError && (
            <div className="alert alert-error" role="alert">
              <AlertTriangle size={16} /> <span>{inputError}</span>
            </div>
          )}

          <div className="ai-actions">
            <button type="button" className="btn btn-primary" onClick={analyze} disabled={analyzing}>
              {analyzing ? (<><Loader2 size={16} className="spin" /> Analysing…</>) : (<><Sparkles size={16} /> {result ? 'Analyse again' : 'Analyse with AI'}</>)}
            </button>
            {analyzing && <span className="muted small" role="status">This can take up to a minute.</span>}
          </div>
        </div>
      </section>

      {/* ---------- Results ---------- */}
      {analysis && values && (
        <>
          <div className="alert alert-warn review-notice" role="note">
            <AlertTriangle size={16} />
            <span>
              <strong>Human review required.</strong> Everything below is an AI-generated suggestion. It can be wrong or incomplete and it cannot prove that a document is genuine or detect fraud. Check it against the original before saving. Records are saved as <strong>Pending</strong>.
            </span>
          </div>

          <section className="card" aria-label="AI summary">
            <div className="card-head">
              <h2>2. Summary</h2>
              <span className="muted small">{result.model ? `Model: ${result.model}` : ''}</span>
            </div>
            <div className="card-body">
              <p className="summary-text">{analysis.summary || 'No summary was returned.'}</p>
              {result.source?.type === 'pdf' && result.source.filename && <p className="muted small">Source file: {result.source.filename}</p>}
            </div>
          </section>

          <div className="ai-columns">
            <section className="card" aria-label="Extracted fields">
              <div className="card-head">
                <h2>3. Extracted fields</h2>
                <span className="muted small">Edit before saving</span>
              </div>
              <div className="card-body ai-fields">
                <div className="field">
                  <label htmlFor="r-title">Document title <span className="req" aria-hidden="true">*</span></label>
                  <input id="r-title" value={values.title} onChange={setField('title')} disabled={formLocked} maxLength={150} aria-invalid={Boolean(fieldErrors.title)} />
                  {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}
                  {note('title')}
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="r-type">Document type <span className="req" aria-hidden="true">*</span></label>
                    <select id="r-type" value={values.document_type} onChange={setField('document_type')} disabled={formLocked} aria-invalid={Boolean(fieldErrors.document_type)}>
                      <option value="">Select a type…</option>
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {fieldErrors.document_type && <p className="field-error">{fieldErrors.document_type}</p>}
                    {note('document_type')}
                  </div>
                  <div className="field">
                    <label htmlFor="r-number">Document number <span className="req" aria-hidden="true">*</span></label>
                    <input id="r-number" value={values.document_number} onChange={setField('document_number')} disabled={formLocked} maxLength={60} aria-invalid={Boolean(fieldErrors.document_number)} />
                    {fieldErrors.document_number && <p className="field-error">{fieldErrors.document_number}</p>}
                    {note('document_number')}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="r-holder">Holder or organisation</label>
                  <input id="r-holder" value={values.holder_name} onChange={setField('holder_name')} disabled={formLocked} maxLength={120} aria-invalid={Boolean(fieldErrors.holder_name)} />
                  {fieldErrors.holder_name && <p className="field-error">{fieldErrors.holder_name}</p>}
                  {note('holder_name')}
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="r-issue">Issue date</label>
                    <input id="r-issue" type="date" value={values.issue_date} onChange={setField('issue_date')} disabled={formLocked} aria-invalid={Boolean(fieldErrors.issue_date)} />
                    {fieldErrors.issue_date && <p className="field-error">{fieldErrors.issue_date}</p>}
                    {note('issue_date')}
                  </div>
                  <div className="field">
                    <label htmlFor="r-expiry">Expiry date</label>
                    <input id="r-expiry" type="date" value={values.expiry_date} onChange={setField('expiry_date')} disabled={formLocked} aria-invalid={Boolean(fieldErrors.expiry_date)} />
                    {fieldErrors.expiry_date && <p className="field-error">{fieldErrors.expiry_date}</p>}
                    {note('expiry_date')}
                  </div>
                </div>

                {analysis.fields.important_dates.length > 0 && (
                  <div className="field">
                    <span className="label-like">Other important dates (from the AI)</span>
                    <ul className="date-list">
                      {analysis.fields.important_dates.map((d, i) => (
                        <li key={i}>
                          <strong>{d.label}</strong>
                          <span>{d.date ? formatDate(d.date) : 'date unclear'}</span>
                          {d.note && <span className="muted small">{d.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="r-notes">Your notes <span className="optional">(optional)</span></label>
                  <textarea id="r-notes" rows={2} value={values.notes} onChange={setField('notes')} disabled={formLocked} maxLength={1000} placeholder="Anything the next reviewer should know" />
                </div>
              </div>
            </section>

            <section className="card" aria-label="AI-assisted review">
              <div className="card-head">
                <h2>4. AI-assisted review</h2>
              </div>
              <div className="card-body">
                <p className="muted small legend-basis">
                  <span className="basis basis-observation">From the document</span> stated in the text ·{' '}
                  <span className="basis basis-suggestion">AI suggestion</span> the AI's inference ·{' '}
                  <span className="basis basis-check">Automatic check</span> a simple rule in this app
                </p>
                {REVIEW_SECTIONS.map((s) => (
                  <FindingList key={s.key} title={s.title} items={analysis.review[s.key] ?? []} />
                ))}
              </div>
            </section>
          </div>

          {/* ---------- Save ---------- */}
          <section className="card save-bar" aria-label="Save">
            {saved ? (
              <div className="saved-state" role="status">
                <CheckCircle2 size={20} aria-hidden="true" />
                <div>
                  <strong>Saved as Pending.</strong>
                  <div className="muted small">The record is now in your Documents list for human review.</div>
                </div>
                <div className="saved-actions">
                  <button type="button" className="btn btn-secondary" onClick={onOpenDocuments}>View in Documents</button>
                  <button type="button" className="btn btn-primary" onClick={startOver}>Analyse another document</button>
                </div>
              </div>
            ) : (
              <div className="save-row">
                {saveError && (
                  <div className="alert alert-error" role="alert">
                    <AlertTriangle size={16} /> <span>{saveError}</span>
                  </div>
                )}
                <div className="save-actions">
                  <span className="muted small">Status will be set to <strong>Pending</strong>. It is never marked Verified automatically.</span>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving || analyzing}>
                    {saving ? (<><Loader2 size={16} className="spin" /> Saving…</>) : (<><Save size={16} /> {saveError ? 'Retry save' : 'Save as Pending'}</>)}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
