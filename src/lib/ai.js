// Calls the Supabase Edge Function "analyze-document". The Gemini API key is NOT here:
// it exists only as a server-side secret inside Supabase.

import { supabase } from './supabase.js'
import { hasPdfHeader, messageForInvokeFailure } from '../utils/aiInput.js'

const FUNCTION_NAME = 'analyze-document'
const CLIENT_TIMEOUT_MS = 75000

/** Reads a PDF File as base64 (no "data:" prefix). Checks the %PDF- header first. */
export async function readPdfAsBase64(file) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (!hasPdfHeader(head)) throw new Error('This file does not look like a valid PDF.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : '')
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

async function explainInvokeError(error) {
  const isHttp = error?.name === 'FunctionsHttpError'
  const status = error?.context?.status
  let body = null
  if (isHttp && typeof error.context?.json === 'function') {
    try {
      body = await error.context.json()
    } catch {
      body = null
    }
  }
  return messageForInvokeFailure({ kind: isHttp ? 'http' : 'network', status, body })
}

const friendly = (message) => Object.assign(new Error(message), { friendly: true })

/**
 * input: { kind: 'text', text } or { kind: 'pdf', filename, data }
 * Resolves to { analysis, model, source }. Rejects with a readable Error.
 */
export async function analyzeDocument(input) {
  const body = input.kind === 'pdf' ? { pdf: { filename: input.filename, data: input.data } } : { text: input.text }
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(friendly('The analysis took too long. Please try again.')), CLIENT_TIMEOUT_MS)
  })
  try {
    const { data, error } = await Promise.race([supabase.functions.invoke(FUNCTION_NAME, { body }), timeout])
    if (error) throw friendly(await explainInvokeError(error))
    if (!data || data.error || !data.analysis) {
      throw friendly(data?.error?.message || 'The AI service returned an unexpected response. Please try again.')
    }
    return data
  } catch (err) {
    if (err?.friendly) throw err
    throw friendly(messageForInvokeFailure({ kind: 'network' }))
  } finally {
    clearTimeout(timer)
  }
}
