// Data layer: the four CRUD operations against the Supabase "documents" table.
// Every failure is turned into a readable Error so the UI can show it.

import { supabase } from './supabase.js'

function toFriendlyError(error, action) {
  const raw = error?.message || String(error)
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return new Error(`Could not reach Supabase while trying to ${action}. Check your internet connection and the VITE_SUPABASE_URL value.`)
  }
  if (/row-level security|permission denied|violates row/i.test(raw) || error?.code === '42501') {
    return new Error(`Supabase refused to ${action} (permission denied). Run supabase.sql so the access policies exist.`)
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(raw)) {
    return new Error('The "documents" table was not found. Run supabase.sql in the Supabase SQL Editor first.')
  }
  if (/invalid api key|jwt/i.test(raw)) {
    return new Error('Supabase rejected the API key. Check VITE_SUPABASE_ANON_KEY in your .env file.')
  }
  if (error?.code === '23514') {
    return new Error(`The database rejected the values while trying to ${action}. Check the required fields and the status.`)
  }
  return new Error(`Could not ${action}: ${raw}`)
}

export async function listDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw toFriendlyError(error, 'load documents')
  return data
}

export async function createDocument(fields) {
  const { data, error } = await supabase.from('documents').insert(fields).select().single()
  if (error) throw toFriendlyError(error, 'save the document')
  return data
}

export async function updateDocument(id, fields) {
  const { data, error } = await supabase.from('documents').update(fields).eq('id', id).select()
  if (error) throw toFriendlyError(error, 'update the document')
  if (!data || data.length === 0) {
    throw new Error('The document was not updated. It may have been deleted, or the database policies block updates.')
  }
  return data[0]
}

export async function deleteDocument(id) {
  const { data, error } = await supabase.from('documents').delete().eq('id', id).select()
  if (error) throw toFriendlyError(error, 'delete the document')
  if (!data || data.length === 0) {
    throw new Error('The document was not deleted. It may already be gone, or the database policies block deletes.')
  }
}
