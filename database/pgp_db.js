const promise = require('bluebird')

const options = {
  // Initialization Options
  promiseLib: promise,
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
      messageout.query = e.query
      messageout.db = { client: e.client.user, database: e.client.database, host: e.client.host }
    }
    console.log(date.toISOString() + ' ' + JSON.stringify(messageout))
  },
  error (err, e) {
    var date = new Date()
    // Exclude the big chunky query:
    var messageout = { 'error': JSON.stringify(err), 'query': e.query }
    messageout.db = { 'client': e.client.user, 'database': e.client.database, 'host': e.client.host }
    console.log(date.toISOString() + ' ' + JSON.stringify(messageout))
  }
}

const pgp = require('pg-promise')(options)

/**
 * Create connection object to open database connection to the required database.
 * @param {req} An http Request object passed from the calling function.
 * @returns {Database} A database connection.
 */

function dbheader (req) {
  if (process.env.NODE_ENV === 'development') {
    var connectpath = '../db_connect.json'
  } else {
    connectpath = './db_connect.json'
  }

  let ctStr = require(connectpath)
  let dest = null

  switch (req.header('dest')) {
    case 'home':
      dest = 'home'
      break
    case 'holding':
      dest = 'holding'
      break
    case 'dev':
      dest = 'dev'
      break
    default:
      dest = 'home'
  }
  return pgp(ctStr[dest])
}

module.exports = {
  dbheader: dbheader
}
