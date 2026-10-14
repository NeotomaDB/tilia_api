'use strict'
// Shared fakes for the unit tests. No database and no network is ever opened.
const path = require('path')

/** An Express-ish request. Header names are matched case-insensitively. */
function fakeReq ({ db, headers = {}, body, user } = {}) {
  const lower = {}
  Object.keys(headers).forEach((k) => { lower[k.toLowerCase()] = headers[k] })
  return {
    app: { locals: { db } },
    headers: lower,
    body: body,
    user: user,
    get (name) { return lower[String(name).toLowerCase()] }
  }
}

/** An Express-ish response that records what was sent. */
function fakeRes () {
  const res = { code: 200, body: undefined }
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

/** Run `fn` while capturing console.log lines; returns them. */
async function captureLog (fn) {
  const lines = []
  const real = console.log
  console.log = (...a) => { lines.push(a.join(' ')) }
  try {
    await fn()
  } finally {
    console.log = real
  }
  return lines
}

/** A database error like the ones pg puts on `err`. */
function pgError (code, message, extra = {}) {
  return Object.assign(new Error(message), { code }, extra)
}

/**
 * What pg-promise rejects with when a t.batch() has failures: it exposes the
 * individual errors through getErrors(). After the first failure Postgres answers
 * the rest of the transaction with 25P02, "current transaction is aborted".
 */
function batchError (errors) {
  return Object.assign(new Error('batch failed'), {
    getErrors: () => errors
  })
}

/**
 * A fake pg-promise `db` for the write handler.
 *   signatures  - { insertsite: {names, types}, ... } what get_signature.sql returns
 *   failOn      - index of the record (0-based) whose call should fail, or -1
 *   failWith    - the pg error for that call
 *   results     - what each ts function call resolves to (default: row with the id)
 * `calls` collects every function call made inside a transaction, `committed` is
 * only populated when the whole transaction succeeded: a faithful rollback.
 */
function fakeWriteDb ({ signatures = {}, failOn = -1, failWith, steward = true } = {}) {
  const state = { calls: [], committed: [], anyCalls: [], txCalls: 0 }
  let nextId = 1000
  const db = {
    state,
    any: async (query, params) => {
      state.anyCalls.push({ query, params })
      const file = query && query.file ? path.basename(query.file) : String(query)
      if (file === 'get_signature.sql') {
        const sig = signatures[params[0]]
        return sig ? [{ name: params[0], names: sig.names, types: sig.types }] : []
      }
      if (/ts\.validatesteward/.test(file)) return steward ? [{ databaseid: 1 }] : []
      throw new Error('fake db: unexpected query ' + file)
    },
    tx: async (cb) => {
      state.txCalls++
      const pending = []
      const t = {
        func: (name, args) => {
          const index = pending.length
          pending.push({ name, args })
          state.calls.push({ name, args })
          if (index === failOn) return Promise.reject(failWith)
          return Promise.resolve([{ [name.split('.')[1]]: nextId++ }])
        },
        batch: async (promises) => {
          const settled = await Promise.allSettled(promises)
          const errors = settled.map((s) => (s.status === 'rejected' ? s.reason : null))
          if (errors.some(Boolean)) {
            // Everything after the first failure sees an aborted transaction.
            const first = errors.findIndex(Boolean)
            throw batchError(errors.map((e, i) => (i > first
              ? pgError('25P02', 'current transaction is aborted')
              : e)))
          }
          return settled.map((s) => s.value)
        }
      }
      const out = await cb(t)
      state.committed.push(...pending)
      return out
    }
  }
  return db
}

module.exports = { fakeReq, fakeRes, captureLog, pgError, batchError, fakeWriteDb }
