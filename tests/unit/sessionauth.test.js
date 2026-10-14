'use strict'
const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { writeAuth, parseAuthorization, legacyCredentials } = require('../../auth/sessionauth.js')
const { fakeReq, fakeRes, captureLog } = require('./helpers.js')

const UUID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const SECRET = 'correct-horse-battery'

/** db.any dispatches on the SQL text: session lookup vs steward check. */
function authDb ({ sessions = [], stewards = {} } = {}) {
  const calls = []
  return {
    calls,
    any: async (query, params) => {
      calls.push(query.split(' ').slice(0, 4).join(' '))
      if (query.startsWith('SELECT orcidid')) {
        return sessions.filter((s) => s.sessionuuid === params[0])
      }
      if (query.startsWith('SELECT databaseid')) {
        return stewards[params[0]] === params[1] ? [{ databaseid: 1 }] : []
      }
      throw new Error('unexpected query')
    }
  }
}

async function run (req) {
  const res = fakeRes()
  let nexted = false
  const lines = await captureLog(() => writeAuth(req, res, () => { nexted = true }))
  return { res, nexted, lines }
}

describe('writeAuth: Bearer sessionuuid', () => {
  const live = { orcidid: 'https://orcid.org/0000-0001-0000-0000', sessionuuid: UUID, expiresat: new Date() }

  it('lets a live session through and records who it is', async () => {
    const req = fakeReq({ db: authDb({ sessions: [live] }), headers: { Authorization: 'Bearer ' + UUID } })
    const { nexted } = await run(req)
    assert.equal(nexted, true)
    assert.equal(req.user.via, 'session')
    assert.equal(req.user.orcidid, live.orcidid)
    assert.equal(req.user.session, UUID.slice(0, 8), 'only a masked session id is kept on req.user')
  })

  it('refuses an unknown or expired session with a 401', async () => {
    const req = fakeReq({ db: authDb(), headers: { Authorization: 'Bearer ' + UUID } })
    const { res, nexted } = await run(req)
    assert.equal(nexted, false)
    assert.equal(res.code, 401)
    assert.equal(res.body.status, 'unauthorized')
  })

  it('never falls back to a password when a bad token is supplied', async () => {
    const db = authDb({ stewards: { alice: SECRET } })
    const req = fakeReq({
      db,
      headers: { Authorization: 'Bearer ' + UUID, username: 'alice', pwd: SECRET }
    })
    const { res, nexted } = await run(req)
    assert.equal(nexted, false)
    assert.equal(res.code, 401)
    assert.ok(!db.calls.some((c) => c.includes('validatesteward')), 'steward check was not consulted')
  })

  it('rejects a malformed token without touching the database', async () => {
    for (const bad of ['Bearer not-a-uuid', "Bearer ' OR 1=1 --", 'Bearer ' + UUID + 'zz']) {
      const db = authDb({ sessions: [live] })
      const { res, nexted } = await run(fakeReq({ db, headers: { Authorization: bad } }))
      assert.equal(nexted, false, bad)
      assert.equal(res.code, 401, bad)
      assert.equal(db.calls.length, 0, bad)
    }
  })
})

describe('writeAuth: legacy steward credentials (what Tilia Desktop sends today)', () => {
  let saved
  beforeEach(() => { saved = process.env.TILIA_REQUIRE_SESSION; delete process.env.TILIA_REQUIRE_SESSION })
  afterEach(() => {
    if (saved === undefined) delete process.env.TILIA_REQUIRE_SESSION
    else process.env.TILIA_REQUIRE_SESSION = saved
  })

  it('accepts valid username and pwd headers', async () => {
    const req = fakeReq({ db: authDb({ stewards: { alice: SECRET } }), headers: { username: 'alice', pwd: SECRET } })
    const { nexted } = await run(req)
    assert.equal(nexted, true)
    assert.deepEqual(req.user, { via: 'legacy' })
  })

  it('accepts HTTP Basic, which Desktop also sets', async () => {
    const basic = 'Basic ' + Buffer.from('alice:' + SECRET).toString('base64')
    const req = fakeReq({ db: authDb({ stewards: { alice: SECRET } }), headers: { Authorization: basic } })
    const { nexted } = await run(req)
    assert.equal(nexted, true)
  })

  it('keeps a colon inside the Basic password', async () => {
    const basic = 'Basic ' + Buffer.from('alice:pa:ss').toString('base64')
    const req = fakeReq({ db: authDb({ stewards: { alice: 'pa:ss' } }), headers: { Authorization: basic } })
    const { nexted } = await run(req)
    assert.equal(nexted, true)
  })

  it('401s a wrong password, and says the same thing as for an unknown user', async () => {
    const db = authDb({ stewards: { alice: SECRET } })
    const wrongPwd = await run(fakeReq({ db, headers: { username: 'alice', pwd: 'nope' } }))
    const noUser = await run(fakeReq({ db, headers: { username: 'mallory', pwd: 'nope' } }))
    assert.equal(wrongPwd.res.code, 401)
    assert.deepEqual(wrongPwd.res.body, noUser.res.body)
  })

  it('401s a request with no credentials, without a database call', async () => {
    const db = authDb()
    const { res, nexted } = await run(fakeReq({ db }))
    assert.equal(nexted, false)
    assert.equal(res.code, 401)
    assert.equal(db.calls.length, 0)
  })

  it('ignores overlong credentials', async () => {
    const db = authDb()
    const { res } = await run(fakeReq({ db, headers: { username: 'a'.repeat(300), pwd: 'x' } }))
    assert.equal(res.code, 401)
    assert.equal(db.calls.length, 0)
  })

  it('TILIA_REQUIRE_SESSION=true switches the legacy path off', async () => {
    process.env.TILIA_REQUIRE_SESSION = 'true'
    const db = authDb({ stewards: { alice: SECRET }, sessions: [{ orcidid: 'o', sessionuuid: UUID }] })
    const legacy = await run(fakeReq({ db, headers: { username: 'alice', pwd: SECRET } }))
    assert.equal(legacy.nexted, false)
    assert.equal(legacy.res.code, 401)
    const session = await run(fakeReq({ db, headers: { Authorization: 'Bearer ' + UUID } }))
    assert.equal(session.nexted, true)
  })
})

describe('writeAuth: failure and logging', () => {
  it('turns a database failure into a generic 500 that leaks nothing', async () => {
    const db = { any: async () => { throw Object.assign(new Error('relation "ap.orcidlogins" does not exist'), { code: '42P01' }) } }
    const { res, nexted } = await run(fakeReq({ db, headers: { Authorization: 'Bearer ' + UUID } }))
    assert.equal(nexted, false)
    assert.equal(res.code, 500)
    assert.ok(!JSON.stringify(res.body).includes('orcidlogins'))
  })

  it('never logs a password or a whole sessionuuid, on any path', async () => {
    const db = authDb({ stewards: { alice: SECRET }, sessions: [{ orcidid: 'o', sessionuuid: UUID }] })
    const all = []
    for (const headers of [
      { username: 'alice', pwd: SECRET },
      { username: 'alice', pwd: SECRET + 'x' },
      { Authorization: 'Bearer ' + UUID },
      { Authorization: 'Bearer ' + UUID.replace('3f2b', '3f2c') },
      { Authorization: 'Basic ' + Buffer.from('alice:' + SECRET).toString('base64') }
    ]) {
      const { lines, res } = await run(fakeReq({ db, headers }))
      all.push(...lines, JSON.stringify(res.body))
    }
    const text = all.join('\n')
    assert.ok(!text.includes(SECRET), 'password found in output')
    assert.ok(!text.includes(UUID), 'full sessionuuid found in output')
  })
})

describe('header parsing', () => {
  it('parseAuthorization reads scheme and value, case-insensitively', () => {
    assert.deepEqual(parseAuthorization(fakeReq({ headers: { Authorization: 'bearer abc' } })), { scheme: 'bearer', value: 'abc' })
    assert.equal(parseAuthorization(fakeReq({ headers: { Authorization: 'Token abc' } })), null)
    assert.equal(parseAuthorization(fakeReq({ headers: { Authorization: 'Bearer a b' } })), null)
    assert.equal(parseAuthorization(fakeReq()), null)
  })

  it('legacyCredentials prefers the headers Desktop sets over Basic', () => {
    const req = fakeReq({ headers: { username: 'h', pwd: 'p', Authorization: 'Basic ' + Buffer.from('b:q').toString('base64') } })
    assert.deepEqual(legacyCredentials(req, parseAuthorization(req)), { username: 'h', pwd: 'p' })
  })
})
