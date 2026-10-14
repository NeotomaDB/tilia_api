'use strict'
// The typing layer in front of the ts.* write functions.
//
// Tilia Desktop sends quoted strings for text, booleans ("true"/"false") and
// anything it formats itself, and bare JSON numbers for numbers, with empty values
// left out altogether. Until now whatever arrived was handed to Postgres as it
// was and the database was the only type check, so a bad value was found late,
// after the earlier records in the POST had already been written, and the
// database's own error text went back to the caller.
//
// Here the server decides:
//   - which function may be called (writeallowlist.js, plus it must exist in pg_proc);
//   - the parameter order and the type of each parameter, read from pg_proc, never
//     from the client;
//   - whether each value really is that type, converting it where Desktop's
//     string form allows ("true" -> true, "-136.3" -> -136.3, "5" -> 5).
// Anything that does not fit is refused with a 400 before a single record is
// written. The refusal names the record and field the client itself sent and
// nothing about the function: no expected type, no parameter list, no signature.
const { sql } = require('../src/neotomaapi.js')
const { isAllowedWriteFunction } = require('./writeallowlist.js')

const signatureSql = sql('../pgfunctions/get_signature.sql')

// Tilia Desktop sends about 1,000 values per POST (ts.insertdata); this is the
// ceiling for one request.
const MAX_RECORDS = 10000

const METHOD_RE = /^ts\.([a-z][a-z0-9_]{0,62})$/

const INT_RE = /^[+-]?\d+$/
const FLOAT_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

const INT_RANGES = {
  smallint: [-32768, 32767],
  integer: [-2147483648, 2147483647],
  bigint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
}
const FLOAT_TYPES = new Set(['double precision', 'real', 'numeric'])
const TEXT_TYPES = new Set(['text', 'character varying', 'character'])

/**
 * Turn a method string from the request into a ts function we are willing to call.
 * @param {*} method The `method` value from the POST body.
 * @returns {{schema: string, name: string, full: string}|null} null if not callable.
 */
function parseWriteMethod (method) {
  if (typeof method !== 'string' || method.length > 80) return null
  const m = METHOD_RE.exec(method.trim().toLowerCase())
  if (!m || !isAllowedWriteFunction(m[1])) return null
  return { schema: 'ts', name: m[1], full: 'ts.' + m[1] }
}

// ---- signature cache -------------------------------------------------------
// A function's signature changes only when the database is migrated, so it is
// cached, but not forever: a migration is picked up without restarting the API.
const SIGNATURE_TTL_MS = 10 * 60 * 1000
const MISSING_TTL_MS = 60 * 1000
const signatureCache = new Map()

/**
 * Parameter names and types for a ts function, from pg_proc.
 * @param {object} db A pg-promise database object.
 * @param {string} name The function name without the schema.
 * @param {function} [now] Clock, replaceable in tests.
 * @returns {Promise<{names: string[], types: string[]}|null>} null when the
 *   function does not exist, is overloaded, or cannot be described.
 */
async function getSignature (db, name, now = Date.now) {
  const hit = signatureCache.get(name)
  if (hit && now() - hit.at < (hit.signature ? SIGNATURE_TTL_MS : MISSING_TTL_MS)) {
    return hit.signature
  }
  const rows = await db.any(signatureSql, [name])
  let signature = null
  if (rows.length === 1 && rows[0].names.length === rows[0].types.length) {
    signature = { names: rows[0].names, types: rows[0].types }
  }
  signatureCache.set(name, { at: now(), signature })
  return signature
}

function clearSignatureCache () {
  signatureCache.clear()
}

// ---- value coercion --------------------------------------------------------
const ok = (value) => ({ ok: true, value })
const bad = { ok: false }

function coerceInt (value, type) {
  const [lo, hi] = INT_RANGES[type]
  let n
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string' && INT_RE.test(value.trim())) {
    n = Number(value.trim())
  } else {
    return bad
  }
  return Number.isInteger(n) && n >= lo && n <= hi ? ok(n) : bad
}

function coerceFloat (value, type) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? ok(value) : bad
  }
  if (typeof value === 'string' && FLOAT_RE.test(value.trim())) {
    const text = value.trim()
    if (!Number.isFinite(Number(text))) return bad
    // numeric keeps the digits Desktop sent: a JS number would round them.
    return ok(type === 'numeric' ? text : Number(text))
  }
  return bad
}

function coerceBoolean (value) {
  if (typeof value === 'boolean') return ok(value)
  if (value === 1 || value === 0) return ok(value === 1)
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true') return ok(true)
    if (v === 'false') return ok(false)
  }
  return bad
}

function coerceDate (value) {
  if (typeof value !== 'string') return bad
  const text = value.trim()
  const m = DATE_RE.exec(text)
  if (!m) return bad
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(Date.UTC(y, mo - 1, d))
  // Round-trip, so 2021-02-30 is refused rather than rolled into March.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return bad
  }
  return ok(text)
}

function coerceText (value) {
  if (typeof value === 'number' || typeof value === 'boolean') return ok(String(value))
  // Postgres cannot store NUL in text and would reject it with a late 22021.
  if (typeof value === 'string' && !value.includes('\u0000')) return ok(value)
  return bad
}

/**
 * Check one value against a Postgres type and convert it.
 * @param {*} value The value as sent. null and undefined are always accepted as NULL.
 * @param {string} type A type as printed by format_type(), e.g. 'integer'.
 * @returns {{ok: boolean, value?: *}}
 */
function coerceValue (value, type) {
  if (value === null || value === undefined) return ok(null)
  if (INT_RANGES[type]) return coerceInt(value, type)
  if (FLOAT_TYPES.has(type)) return coerceFloat(value, type)
  if (type === 'boolean') return coerceBoolean(value)
  if (type === 'date') return coerceDate(value)
  if (TEXT_TYPES.has(type)) return coerceText(value)
  // A type this layer has not been taught. Refuse rather than pass it through
  // unchecked; the allowlist and the pg_proc survey mean this should not happen.
  return bad
}

/**
 * Validate and convert every record of a POST against a function's signature.
 * @param {{names: string[], types: string[]}} signature From getSignature().
 * @param {*} data The `data` element of the POST body.
 * @returns {{ok: true, args: Array[]}|{ok: false, reason: string, record?: number, field?: string}}
 */
function coerceRecords (signature, data) {
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_RECORDS) {
    return { ok: false, reason: 'shape' }
  }
  const args = []
  for (let r = 0; r < data.length; r++) {
    const record = data[r]
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      return { ok: false, reason: 'record', record: r + 1 }
    }
    const row = []
    for (let i = 0; i < signature.names.length; i++) {
      const name = signature.names[i]
      // hasOwnProperty, so a record cannot supply a value through the prototype.
      // A field left out is NULL, as it always was.
      const raw = Object.prototype.hasOwnProperty.call(record, name) ? record[name] : null
      const c = coerceValue(raw, signature.types[i])
      if (!c.ok) {
        // `name` is a field the client sent: it is the only way a value can fail.
        return { ok: false, reason: 'value', record: r + 1, field: name }
      }
      row.push(c.value)
    }
    args.push(row)
  }
  return { ok: true, args }
}

module.exports = {
  parseWriteMethod,
  getSignature,
  clearSignatureCache,
  coerceValue,
  coerceRecords,
  MAX_RECORDS
}
