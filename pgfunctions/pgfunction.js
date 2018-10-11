// Postgres functions for Tilia:

const path = require('path')

// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp

// Helper for linking to external query files:
function sql (file) {
  const fullPath = path.join(__dirname, file)
  return new pgp.QueryFile(fullPath, {minify: true})
}

// Create a QueryFile globally, once per file:
const queryFunc = sql('./fun_query.sql')
const schemFunc = sql('./get_schema.sql')

function allFunctions (req, res, next) {
  console.log(req.query)

  var noParam = Object.keys(req.query).length === 0 && req.query.constructor === Object
  var method = Object.keys(req.query).includes('method')

  // The call to the documentation JSON object occurs if the user either
  // enters no parameters, or the term 'method' fails to appear in the
  // documentation.

  if (noParam | !method) {
    var dbFuncs = db.any(queryFunc)
      .then(function (data) {
        res.status(200)
          .json({
            status: 'success',
            data: data,
            message: 'Retrieved all tables'
          })
      })
      .catch(function (err) {
        return next(err)
      })

    return dbFuncs
  } else {
    var allParams = req.query
    var sqlMethod = allParams.method

    var schema = db.any(schemFunc)
      .then(function (data) {
        return data
      })

    delete allParams.method

    // find the namespace for the function:

    // Call the db to get the schema for the method.

    var sqlCall = 'SELECT * FROM ' + schema + '.' + sqlMethod + '('

    for (var i = 0; i < Object.keys(allParams).length; i++) {
      sqlCall = sqlCall + Object.keys(allParams)[i] + ' := ' + allParams[Object.keys(allParams)[i]]

      if (i < Object.keys(allParams).length - 1) {
        sqlCall = sqlCall + ', '
      }
    }

    sqlCall = sqlCall + ')'

    console.log(sqlCall)

    var dbCall = db.any(sqlCall)
      .then(function (data) {
        console.log(data)
        res.status(200)
          .json({
            status: 'success',
            data: data,
            message: 'Retrieved all tables'
          })
      })
      .catch(function (err) {
        return next(err)
      })

    return (dbCall)
  }
}

module.exports.allFunctions = allFunctions
