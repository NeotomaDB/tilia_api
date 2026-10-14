'use strict'
const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const {
  parseWriteMethod, getSignature, clearSignatureCache, coerceValue, coerceRecords, MAX_RECORDS
} = require('../../pgfunctions/tscoerce.js')
const { isAllowedWriteFunction, DESKTOP_EDITS } = require('../../pgfunctions/writeallowlist.js')

// The shape of ts.insertsite, taken from pg_proc.
const SITE = {
  names: ['_sitename', '_east', '_north', '_west', '_south', '_altitude', '_area', '_descript', '_notes'],
  types: ['character varying', 'numeric', 'numeric', 'numeric', 'numeric', 'integer', 'numeric', 'character varying', 'character varying']
}

describe('method allowlist', () => {
  it('allows inserts and the update/delete functions Tilia Desktop uses', () => {
    for (const m of ['ts.insertsite', 'ts.insertdata', 'ts.updatedata', 'ts.deletedata', 'ts.updatechronology']) {
      assert.ok(parseWriteMethod(m), m)
    }
  })

  it('accepts the lower-casing Desktop applies and tolerates stray spaces', () => {
    assert.equal(parseWriteMethod('TS.InsertSite').full, 'ts.insertsite')
    assert.equal(parseWriteMethod(' ts.insertsite ').full, 'ts.insertsite')
  })

  it('blocks ts.insertsteward, which would create a steward login', () => {
    assert.equal(parseWriteMethod('ts.insertsteward'), null)
    assert.equal(isAllowedWriteFunction('insertsteward'), false)
  })

  it('blocks destructive and administrative ts functions Desktop never calls', () => {
    for (const m of ['ts.deletesite', 'ts.deletetaxon', 'ts.deletedataset', 'ts.combinecontacts',
      'ts.linkhigher', 'ts.updatetaxonname', 'ts.updatesite', 'ts.update_recdatemodified']) {
      assert.equal(parseWriteMethod(m), null, m)
    }
  })

  it('blocks the read-only ts functions on the write route', () => {
    for (const m of ['ts.validatesteward', 'ts.validateusername', 'ts.checksteward']) {
      assert.equal(parseWriteMethod(m), null, m)
    }
  })

  it('blocks other schemas, and names that are not plain identifiers', () => {
    for (const m of ['ti.getsitebyid', 'ap.insertsomething', 'pg_catalog.pg_sleep', 'insertsite',
      'ts.', 'ts.insertsite;drop table ndb.sites', 'ts.insertsite()', 'ts.insert site', 'ts.insertsite--',
      'ts."insertsite"', 'ts.insert\nsite', "ts.insertsite'", 'ts.' + 'insert' + 'a'.repeat(100)]) {
      assert.equal(parseWriteMethod(m), null, JSON.stringify(m))
    }
  })

  it('refuses anything that is not a string', () => {
    for (const m of [undefined, null, 42, {}, ['ts.insertsite'], true]) {
      assert.equal(parseWriteMethod(m), null)
    }
  })

  it('keeps the explicit update/delete list to update* and delete* names only', () => {
    for (const name of DESKTOP_EDITS) assert.match(name, /^(update|delete)[a-z0-9_]+$/)
  })
})

describe('coerceValue', () => {
  const good = (value, type, expected) => {
    const r = coerceValue(value, type)
    assert.equal(r.ok, true, `${JSON.stringify(value)} as ${type}`)
    assert.deepEqual(r.value, expected, `${JSON.stringify(value)} as ${type}`)
  }
  const refused = (value, type) => {
    assert.equal(coerceValue(value, type).ok, false, `${JSON.stringify(value)} as ${type}`)
  }

  it('null and undefined are NULL for every type', () => {
    for (const t of ['integer', 'boolean', 'date', 'numeric', 'character varying', 'text', 'made up type']) {
      good(null, t, null)
      good(undefined, t, null)
    }
  })

  it('integers: bare numbers and quoted digits, within range', () => {
    good(5, 'integer', 5)
    good('5', 'integer', 5)
    good(' -12 ', 'integer', -12)
    good('+7', 'integer', 7)
    good(2147483647, 'integer', 2147483647)
    refused(2147483648, 'integer')
    refused('2147483648', 'integer')
    refused(32768, 'smallint')
    refused(5.5, 'integer')
    refused('5.5', 'integer')
    refused('5e2', 'integer')
    refused('', 'integer')
    refused('abc', 'integer')
    refused('1; DROP TABLE x', 'integer')
    refused(NaN, 'integer')
    refused(Infinity, 'integer')
    refused(true, 'integer')
    refused([1], 'integer')
    refused({}, 'integer')
  })

  it('doubles: numbers and numeric strings, finite only', () => {
    good(-136.31295, 'double precision', -136.31295)
    good('-136.31295', 'double precision', -136.31295)
    good('1.5E-5', 'double precision', 0.000015)
    good('.5', 'double precision', 0.5)
    good('5.', 'double precision', 5)
    refused('1,5', 'double precision')
    refused('0x10', 'double precision')
    refused('NaN', 'double precision')
    refused('Infinity', 'double precision')
    refused(Infinity, 'double precision')
    refused('', 'double precision')
    refused('1e999', 'double precision')
  })

  it('numeric: a string keeps every digit it was sent, a number stays a number', () => {
    good('58.95467123456789012345', 'numeric', '58.95467123456789012345')
    good(58.95467, 'numeric', 58.95467)
    refused('58.9.5', 'numeric')
  })

  it('booleans: the "true"/"false" Desktop sends, and real booleans', () => {
    good('true', 'boolean', true)
    good('false', 'boolean', false)
    good('TRUE', 'boolean', true)
    good(' False ', 'boolean', false)
    good(true, 'boolean', true)
    good(1, 'boolean', true)
    good(0, 'boolean', false)
    refused('yes', 'boolean')
    refused('t', 'boolean')
    refused('', 'boolean')
    refused(2, 'boolean')
    refused('1', 'boolean')
    refused({}, 'boolean')
  })

  it('dates: real calendar dates only', () => {
    good('2021-08-23', 'date', '2021-08-23')
    good('1988-07-01', 'date', '1988-07-01')
    good('2020-02-29', 'date', '2020-02-29')
    good('2021-08-23T10:30:00Z', 'date', '2021-08-23T10:30:00Z')
    refused('2021-02-30', 'date')
    refused('2021-13-01', 'date')
    refused('2021-02-29', 'date')
    refused('23/08/2021', 'date')
    refused('2021-08-23; drop table x', 'date')
    refused('', 'date')
    refused(20210823, 'date')
  })

  it('text: strings pass through untouched, numbers and booleans become strings', () => {
    good("D'Andrea", 'character varying', "D'Andrea")
    good("O''Brien", 'text', "O''Brien")
    good('  keep spaces  ', 'character varying', '  keep spaces  ')
    good('line1\r\nline2', 'text', 'line1\r\nline2')
    good('Plateau 2', 'character', 'Plateau 2')
    good('', 'character varying', '')
    good(42, 'character varying', '42')
    good(true, 'text', 'true')
    refused('has\u0000nul', 'text')
    refused({ a: 1 }, 'text')
    refused(['a'], 'text')
  })

  it('SQL metacharacters in text stay inert data: nothing is stripped or interpreted', () => {
    const hostile = "'); DROP TABLE ndb.sites; --"
    good(hostile, 'character varying', hostile)
  })

  it('refuses a type it has not been taught rather than passing the value through', () => {
    refused('x', 'jsonb')
    refused(1, 'timestamp with time zone')
    refused('x', 'integer[]')
  })
})

describe('coerceRecords', () => {
  it('converts a Desktop-style record: quoted strings in, typed values out', () => {
    const r = coerceRecords(SITE, [{
      _sitename: 'Plateau 2', _east: -136.31295, _north: '58.95467', _west: -136.31759, _south: 58.95284, _altitude: '67'
    }])
    assert.equal(r.ok, true)
    assert.deepEqual(r.args, [['Plateau 2', -136.31295, '58.95467', -136.31759, 58.95284, 67, null, null, null]])
  })

  it('fields Desktop leaves out (empty values are not sent) become NULL', () => {
    const r = coerceRecords({ names: ['_a', '_b'], types: ['integer', 'text'] }, [{}, { _a: 1 }])
    assert.deepEqual(r.args, [[null, null], [1, null]])
  })

  it('ignores fields that are not parameters', () => {
    const r = coerceRecords({ names: ['_a'], types: ['integer'] }, [{ _a: 1, _bogus: 'x', __proto__x: 1 }])
    assert.deepEqual(r.args, [[1]])
  })

  it('names the record and field of the first bad value, nothing more', () => {
    const r = coerceRecords(SITE, [
      { _sitename: 'ok', _east: '1' },
      { _sitename: 'ok', _east: 'not a number' }
    ])
    assert.deepEqual(r, { ok: false, reason: 'value', record: 2, field: '_east' })
  })

  it('checks every record before returning, so one bad row means nothing is written', () => {
    const r = coerceRecords({ names: ['_n'], types: ['integer'] }, [{ _n: 1 }, { _n: 2 }, { _n: 'x' }])
    assert.equal(r.ok, false)
    assert.equal(r.record, 3)
  })

  it('does not take values from the prototype chain', () => {
    const inherited = Object.create({ _a: 99 })
    const r = coerceRecords({ names: ['_a'], types: ['integer'] }, [inherited])
    assert.deepEqual(r.args, [[null]])
  })

  it('refuses a data element that is not a non-empty array within the cap', () => {
    for (const data of [undefined, null, {}, 'x', 5, []]) {
      assert.equal(coerceRecords(SITE, data).reason, 'shape')
    }
    assert.equal(coerceRecords({ names: [], types: [] }, new Array(MAX_RECORDS + 1).fill({})).reason, 'shape')
    assert.equal(coerceRecords({ names: [], types: [] }, new Array(MAX_RECORDS).fill({})).ok, true)
  })

  it('refuses records that are not plain objects', () => {
    for (const rec of [null, 5, 'x', [1, 2]]) {
      assert.equal(coerceRecords(SITE, [{}, rec]).reason, 'record')
    }
  })

  it('a function with no parameters takes empty records', () => {
    assert.deepEqual(coerceRecords({ names: [], types: [] }, [{}, {}]).args, [[], []])
  })
})

describe('getSignature', () => {
  beforeEach(() => clearSignatureCache())

  const dbReturning = (rows) => {
    const db = { n: 0, any: async (q, p) => { db.n++; db.last = { file: path.basename(q.file), p }; return rows } }
    return db
  }

  it('asks the database by function name, as a bound parameter', async () => {
    const db = dbReturning([{ name: 'insertsite', ...SITE }])
    const sig = await getSignature(db, 'insertsite')
    assert.deepEqual(sig, SITE)
    assert.equal(db.last.file, 'get_signature.sql')
    assert.deepEqual(db.last.p, ['insertsite'])
  })

  it('caches a found signature', async () => {
    const db = dbReturning([{ name: 'insertsite', ...SITE }])
    await getSignature(db, 'insertsite')
    await getSignature(db, 'insertsite')
    assert.equal(db.n, 1)
  })

  it('re-reads after the TTL so a migration is picked up without a restart', async () => {
    const db = dbReturning([{ name: 'insertsite', ...SITE }])
    let t = 0
    await getSignature(db, 'insertsite', () => t)
    t = 11 * 60 * 1000
    await getSignature(db, 'insertsite', () => t)
    assert.equal(db.n, 2)
  })

  it('returns null for a missing function, and remembers that briefly', async () => {
    const db = dbReturning([])
    let t = 0
    assert.equal(await getSignature(db, 'insertnothing', () => t), null)
    assert.equal(await getSignature(db, 'insertnothing', () => t), null)
    assert.equal(db.n, 1)
    t = 61 * 1000
    await getSignature(db, 'insertnothing', () => t)
    assert.equal(db.n, 2)
  })

  it('treats an overloaded name as unusable rather than guessing which one', async () => {
    const row = { name: 'insertx', names: ['_a'], types: ['integer'] }
    assert.equal(await getSignature(dbReturning([row, row]), 'insertx'), null)
  })

  it('treats names and types that do not line up as unusable', async () => {
    assert.equal(await getSignature(dbReturning([{ name: 'insertx', names: ['_a', '_b'], types: ['integer'] }]), 'insertx'), null)
  })
})
