const promise = require('bluebird')
const { json } = require('body-parser')

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
// const monitor = require('pg-monitor')

if (process.env.NODE_ENV === 'development') {
  var connectpath = '../db_connect.json'
} else {
  connectpath = './db_connect.json'
  console.log(process.env.NODE_ENV)
}

const ctStr = require(connectpath)

const db = pgp(ctStr)

module.exports = db
