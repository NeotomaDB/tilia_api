'use strict'
const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { handlePostMultiUpdate } = require('../../handlers/data_handlers.js')
const { clearSignatureCache } = require('../../pgfunctions/tscoerce.js')
const { fakeReq, fakeRes, captureLog, pgError, fakeWriteDb } = require('./helpers.js')

const SIGNATURES = {
  insertsite: {
    names: ['_sitename', '_east', '_north', '_west', '_south', '_altitude', '_area', '_descript', '_notes'],
    types: ['character varying', 'numeric', 'numeric', 'numeric', 'numeric', 'integer', 'numeric', 'character varying', 'character varying']
  },
  insertdata: { names: ['_sampleid', '_variableid', '_value'], types: ['integer', 'integer', 'double precision'] },
  deletedata: { names: ['_dataid'], types: ['integer'] },
  insertsteward: { names: ['_contactid', '_username', '_password', '_taxonomyexpert', '_databaseid'], types: ['integer', 'character varying', 'character varying', 'boolean', 'integer'] },
  deletesite: { names: ['_siteid'], types: ['integer'] }
}

async function post (body, dbOptions = {}, user = { via: 'legacy' }) {
  const db = fakeWriteDb({ signatures: SIGNATURES, ...dbOptions })
  const req = fakeReq({ db, body, user })
  const res = fakeRes()
  const lines = await captureLog(() => handlePostMultiUpdate(req, res, () => {}))
  return { db, res, lines, state: db.state }
}

describe('POST /update/write handler', () => {
  beforeEach(() => clearSignatureCache())

  describe('a good write', () => {
    it('converts Desktop-style values, writes in one transaction, returns the new ids', async () => {
      const { res, state } = await post({
        method: 'ts.insertsite',
        data: [
          { _sitename: 'Plateau 2', _east: '-136.31295', _north: 58.95467, _west: -136.31759, _south: 58.95284, _altitude: '67' },
          { _sitename: "O'Brien Lake", _east: -1, _north: 2, _west: -3, _south: 4 }
        ]
      })
      assert.equal(res.code, 200)
      assert.equal(res.body.status, 'success')
      assert.deepEqual(res.body.data, [1000, 1001])
      assert.equal(res.body.message, 'Called batch 2 times for method ts.insertsite')
      assert.equal(state.txCalls, 1)
      assert.deepEqual(state.calls[0], { name: 'ts.insertsite', args: ['Plateau 2', '-136.31295', 58.95467, -136.31759, 58.95284, 67, null, null, null] })
      assert.equal(state.calls[1].args[0], "O'Brien Lake")
      assert.equal(state.committed.length, 2)
    })

    it('accepts the method in the case Desktop-era clients use', async () => {
      const { res } = await post({ method: 'TS.DeleteData', data: [{ _dataid: '55' }] })
      assert.equal(res.code, 200)
    })
  })

  describe('methods that must not be reachable', () => {
    for (const method of ['ts.insertsteward', 'ts.deletesite', 'ts.validatesteward', 'ti.getsitebyid', 'pg_sleep', 'ts.insertsite; select 1']) {
      it('refuses ' + method + ' and touches nothing', async () => {
        const { res, state } = await post({ method, data: [{ _contactid: 1, _username: 'evil', _password: 'x', _taxonomyexpert: true, _databaseid: 1, _siteid: 1 }] })
        assert.equal(res.code, 400)
        assert.equal(res.body.message, 'This function is not in the valid set of functions.')
        assert.equal(state.txCalls, 0)
        assert.equal(state.anyCalls.length, 0, 'not even a signature lookup')
      })
    }

    it('answers a missing function exactly as it answers a blocked one', async () => {
      const missing = await post({ method: 'ts.insertdoesnotexist', data: [{}] })
      const blocked = await post({ method: 'ts.insertsteward', data: [{}] })
      assert.equal(missing.res.code, blocked.res.code)
      assert.deepEqual(missing.res.body, blocked.res.body)
    })
  })

  describe('values that do not fit', () => {
    it('refuses with a 400 naming the record and field, and writes nothing at all', async () => {
      const { res, state } = await post({
        method: 'ts.insertdata',
        data: [
          { _sampleid: 1, _variableid: 2, _value: 3.5 },
          { _sampleid: 1, _variableid: 2, _value: 'seven' }
        ]
      })
      assert.equal(res.code, 400)
      assert.equal(res.body.message, 'Invalid value in record 2 (field _value).')
      assert.equal(state.txCalls, 0)
      assert.equal(state.calls.length, 0, 'the valid first record was not written either')
    })

    it('never reveals a type, a parameter list or a signature', async () => {
      const bad = await post({ method: 'ts.insertdata', data: [{ _sampleid: 'x' }] })
      const text = JSON.stringify(bad.res.body).toLowerCase()
      for (const leak of ['integer', 'double precision', 'character varying', '_variableid', '_value', 'signature', 'ts.insertdata']) {
        assert.ok(!text.includes(leak), leak + ' leaked: ' + text)
      }
    })

    it('refuses a data element that is not an array of records', async () => {
      for (const data of [undefined, [], 'x', { _a: 1 }]) {
        const { res } = await post({ method: 'ts.insertdata', data })
        assert.equal(res.code, 400)
        assert.match(res.body.message, /array of 1 to 10000 records/)
      }
    })

    it('SQL in a value is data: it reaches the function as a plain string argument', async () => {
      const hostile = "x'); DROP TABLE ndb.sites; --"
      const { res, state } = await post({ method: 'ts.insertsite', data: [{ _sitename: hostile, _east: 1, _north: 2, _west: 3, _south: 4 }] })
      assert.equal(res.code, 200)
      assert.equal(state.calls[0].args[0], hostile)
    })

    it('SQL in a number field is refused, not passed along', async () => {
      const { res, state } = await post({ method: 'ts.deletedata', data: [{ _dataid: '1; DROP TABLE ndb.data' }] })
      assert.equal(res.code, 400)
      assert.equal(state.txCalls, 0)
    })
  })

  describe('the old failure responses are unchanged', () => {
    it('no body: 500 with the same message', async () => {
      const { res } = await post(undefined)
      assert.equal(res.code, 500)
      assert.match(res.body.message, /POST methods require a body element/)
    })

    it('empty body: 500', async () => {
      assert.equal((await post({})).res.code, 500)
    })

    it('no method: 500 with the same message', async () => {
      const { res } = await post({ data: [{}] })
      assert.equal(res.code, 500)
      assert.match(res.body.message, /valid method/)
    })
  })

  describe('a failure inside the database', () => {
    const body = { method: 'ts.insertdata', data: [{ _sampleid: 1, _variableid: 1, _value: 1 }, { _sampleid: 2, _variableid: 1, _value: 2 }, { _sampleid: 3, _variableid: 1, _value: 3 }] }

    it('rolls the whole POST back: the records before the failure are not kept', async () => {
      const { res, state } = await post(body, { failOn: 1, failWith: pgError('23505', 'duplicate key value violates unique constraint "uq_data"') })
      assert.equal(res.code, 500)
      assert.equal(state.committed.length, 0, 'nothing committed')
    })

    it('explains the kind of failure and nothing else: no constraint, table or SQL', async () => {
      const err = pgError('23505', 'duplicate key value violates unique constraint "uq_data_sampleid_variableid"', {
        detail: 'Key (sampleid, variableid)=(1, 1) already exists.', table: 'data', constraint: 'uq_data_sampleid_variableid'
      })
      const { res } = await post(body, { failOn: 1, failWith: err })
      assert.equal(res.body.status, 'failure')
      assert.match(res.body.message, /^Database error in function call: A record with these values already exists\. \(reference [0-9a-f]{8}\)$/)
      const text = JSON.stringify(res.body)
      for (const leak of ['uq_data', 'sampleid', 'duplicate key', 'Key (', 'ndb.']) {
        assert.ok(!text.includes(leak), leak + ' leaked: ' + text)
      }
    })

    it('reduces each common database error to its kind', async () => {
      const cases = {
        '23503': /related record/,
        '23502': /required value is missing/,
        '22001': /too long/,
        '22003': /outside the allowed range/,
        '22P02': /invalid format/,
        '57014': /took too long/
      }
      for (const [code, pattern] of Object.entries(cases)) {
        const { res } = await post(body, { failOn: 0, failWith: pgError(code, 'raw pg text for ' + code + ' in ndb.data') })
        assert.match(res.body.message, pattern, code)
        assert.ok(!res.body.message.includes('raw pg text'), code)
      }
    })

    it('anything unrecognised becomes a generic message with a reference', async () => {
      const { res } = await post(body, { failOn: 0, failWith: pgError('XX000', 'internal error in function ts.insertdata(integer, integer, double precision)') })
      assert.match(res.body.message, /^Database error in function call: The database could not complete the request\. \(reference [0-9a-f]{8}\)$/)
      assert.ok(!res.body.message.includes('ts.insertdata'))
    })

    it('passes through a RAISE EXCEPTION from the function: that text is written for the steward', async () => {
      const { res } = await post(body, { failOn: 0, failWith: pgError('P0001', 'Dataset 51805 already has a submission record.') })
      assert.equal(res.body.message, 'Database error in function call: Dataset 51805 already has a submission record.')
    })

    it('reports the real failure, not the aborted-transaction errors that follow it', async () => {
      const { res } = await post(body, { failOn: 0, failWith: pgError('23503', 'fk violated') })
      assert.match(res.body.message, /related record/)
      assert.ok(!res.body.message.includes('aborted'))
    })

    it('puts the full detail in the server log under the same reference', async () => {
      const err = pgError('23505', 'duplicate key value violates unique constraint "uq_x"', { constraint: 'uq_x', table: 'data' })
      const { res, lines } = await post(body, { failOn: 0, failWith: err })
      const ref = /reference ([0-9a-f]{8})/.exec(res.body.message)[1]
      const entry = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).find((e) => e && e.event === 'write-error')
      assert.equal(entry.ref, ref)
      assert.equal(entry.code, '23505')
      assert.equal(entry.constraint, 'uq_x')
    })
  })

  describe('logging', () => {
    it('records who wrote what, never the data', async () => {
      const marker = 'SECRET-SITE-NAME-' + Math.random()
      const { lines } = await post(
        { method: 'ts.insertsite', data: [{ _sitename: marker, _east: 1, _north: 2, _west: 3, _south: 4 }] },
        {},
        { via: 'session', orcidid: 'https://orcid.org/0000-0001-0000-0000', session: '3f2b8c1e' }
      )
      const text = lines.join('\n')
      assert.ok(!text.includes(marker), 'uploaded data was logged')
      const audit = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).find((e) => e && e.event === 'write')
      assert.equal(audit.method, 'ts.insertsite')
      assert.equal(audit.records, 1)
      assert.equal(audit.via, 'session')
      assert.equal(audit.session, '3f2b8c1e')
    })

    it('does not log a refused method as data', async () => {
      const { lines } = await post({ method: 'ts.insertsteward', data: [{ _password: 'hunter2' }] })
      assert.ok(!lines.join('\n').includes('hunter2'))
    })
  })
})
