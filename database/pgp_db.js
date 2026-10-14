const pgPromise = require('pg-promise')

/**
 * The statement as it may be written to the log. pg-promise logs the fully
 * formatted SQL, so a call like `select * from ts.validatesteward('name','secret')`
 * would put the steward's password in the log, and every ts.* write would put the
 * uploaded data there. Calls to ts.* keep their name but lose their arguments, and
 * a session lookup loses the sessionuuid, which is a credential.
 * @param {string} query The formatted SQL text.
 * @returns {string} The same statement with sensitive parts removed.
 */
function redactQuery (query) {
  if (typeof query !== 'string') return query
  if (/ap\.orcidlogins/i.test(query)) return 'session lookup'
  // Any statement that calls a ts function, whatever it selects: pg-promise's
  // db.func() writes `select * from ts.x(...)`, but our own steward check is
  // `SELECT databaseid FROM ts.validatesteward(...)`.
  const m = /\b(ts\.[a-z0-9_]+)\s*\(/i.exec(query)
  if (m) return 'call ' + m[1] + '(<arguments not logged>)'
  return query
}

const options = {
  // Initialization Options
  // `promiseLib` was removed in pg-promise v12 (it uses native promises), and
  // passing it now throws 'Option "promiseLib" is not recognized.' at startup.
  // It was already a no-op here, since `pgPromise.promise` is undefined.
  capSQL: true,
  query (e) {
    var date = new Date()
    var messageout = { 'hasExecuted': e.client.hasExecuted }
    // Exclude the big chunky query:
    if (e.query.match(/CONCAT.*pronamespace = n.oid/)) {
      messageout.query = 'List all functions'
    } else if (e.query.match(/WHERE proname LIKE/)) {
      messageout.query = 'Match function schema'
    } else {
      messageout.query = redactQuery(e.query)
      // messageout.db = { client: e.client.user, database: e.client.database, host: e.client.host }
    }
    console.log(date.toISOString() + '\t' + JSON.stringify(messageout) + '\n')
  },
  error (err, e) {
    var date = new Date()
    // Exclude the big chunky query:
    // console.log(JSON.stringify(err))
    // Named fields, not JSON.stringify(err): a pg-promise QueryResultError carries
    // the whole formatted statement as err.query and would bypass redactQuery.
    var errout = {
      message: err && err.message,
      code: err && err.code,
      detail: err && err.detail,
      hint: err && err.hint,
      routine: err && err.routine,
      constraint: err && err.constraint,
      table: err && err.table,
      column: err && err.column
    }
    var messageout = { 'error': JSON.stringify(errout), 'query': redactQuery(e.query) }
    // messageout.db = { 'client': e.client.user, 'database': e.client.database, 'host': e.client.host }
    console.log(date.toISOString() + ' ' + JSON.stringify(messageout))
  }
}

const pgp = require('pg-promise')(options)

/**
 * Create connection object to open database connection to the required database.
 * @param {req} An http Request object passed from the calling function.
 * @returns {Database} A database connection.
 */

function dbheader () {
  var out = {
    'host': process.env.RDS_HOSTNAME,
    'user': process.env.RDS_USERNAME,
    'database': process.env.RDS_DATABASE,
    'password': process.env.RDS_PASSWORD,
    'port': process.env.RDS_PORT,
    'ssl': {
      'rejectUnauthorized': false
    },
    // Keep below Tilia Desktop's 60 s client timeout so Tilia receives the JSON error.
    'query_timeout': 45000
  }
  return pgp(out)
}

module.exports = {
  dbheader: dbheader,
  dboptions: options,
  redactQuery: redactQuery
}
