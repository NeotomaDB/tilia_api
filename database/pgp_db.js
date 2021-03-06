const promise = require('bluebird')

// const fs = require('fs')

const options = {
  // Initialization Options
  promiseLib: promise
}

const pgp = require('pg-promise')(options)
const monitor = require('pg-monitor')
monitor.attach(options)

// var connectpath = '../../node_config/db_connect.json'

if (process.env.NODE_ENV === 'development') {
  var connectpath = '../db_connect.json'
} else {
  connectpath = './db_connect.json'
  console.log(process.env.NODE_ENV)
}

const ctStr = require(connectpath)

const db = pgp(ctStr)

module.exports = db
