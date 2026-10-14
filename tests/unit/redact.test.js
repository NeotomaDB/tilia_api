'use strict'
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { redactQuery } = require('../../database/pgp_db.js')

describe('redactQuery: what the SQL logger may write', () => {
  it('drops the arguments of ts.* calls: the steward password, and uploaded data', () => {
    assert.equal(redactQuery("select * from ts.validatesteward('alice','s3cret!')"),
      'call ts.validatesteward(<arguments not logged>)')
    const out = redactQuery("select * from ts.insertsite('Plateau 2',-136.3,58.9,-136.4,58.8,67,1.03,'a note',null)")
    assert.equal(out, 'call ts.insertsite(<arguments not logged>)')
  })

  it('is not fooled by case or spacing', () => {
    assert.equal(redactQuery("  SELECT  *  FROM  TS.InsertData ( 1,2,3 )"),
      'call TS.InsertData(<arguments not logged>)')
  })

  it("hides the steward check's own query, which selects a column rather than *", () => {
    assert.equal(redactQuery("SELECT databaseid FROM ts.validatesteward('alice', 'pa:ss word')"),
      'call ts.validatesteward(<arguments not logged>)')
    assert.equal(redactQuery("select stewardid, authorized from ts.checksteward('a','b')"),
      'call ts.checksteward(<arguments not logged>)')
  })

  it('hides session lookups, because a sessionuuid is a credential', () => {
    const q = "SELECT orcidid FROM ap.orcidlogins WHERE sessionuuid = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'"
    assert.equal(redactQuery(q), 'session lookup')
  })

  it('leaves ordinary read queries alone', () => {
    const q = 'select * from ti.getsitebyid(5)'
    assert.equal(redactQuery(q), q)
  })

  it('passes non-strings through', () => {
    assert.equal(redactQuery(undefined), undefined)
  })
})
