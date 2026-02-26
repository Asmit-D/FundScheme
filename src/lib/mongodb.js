/**
 * ExpressScheme — MongoDB Browser Client
 * Calls the Express API server (/api/mongo/*) which holds real MongoDB credentials.
 * Mirror of supabase.js — provides the same call pattern but for MongoDB.
 */

const BASE = '/api/mongo'

async function call(route, body) {
  const res = await fetch(`${BASE}/${route}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) return { data: null, error: json.error || 'Server error' }
  return json   // { data, error }
}

// ── Low-level API ─────────────────────────────────────────────────────

/** Find multiple documents */
export const mongoFind = (collection, filter = {}, options = {}) =>
  call('find', { collection, filter, options })

/** Find a single document */
export const mongoFindOne = (collection, filter = {}, options = {}) =>
  call('find', { collection, filter, options, one: true })

/** Insert one document */
export const mongoInsertOne = (collection, document) =>
  call('insertOne', { collection, document })

/** Insert many documents */
export const mongoInsertMany = (collection, documents) =>
  call('insertMany', { collection, documents })

/** Update one document (returns updated doc) */
export const mongoUpdateOne = (collection, filter, update, upsert = false) =>
  call('updateOne', { collection, filter, update, upsert })

/** Delete one document */
export const mongoDeleteOne = (collection, filter) =>
  call('deleteOne', { collection, filter })

/** Aggregation pipeline */
export const mongoAggregate = (collection, pipeline) =>
  call('aggregate', { collection, pipeline })

/** Count documents */
export const mongoCount = (collection, filter = {}) =>
  call('count', { collection, filter })

/** Upsert (insert or update) by filter */
export const mongoUpsert = (collection, filter, document) =>
  call('upsertOne', { collection, filter, document })

/** Health check */
export const mongoHealth = async () => {
  const res = await fetch('/api/health')
  return res.json()
}
