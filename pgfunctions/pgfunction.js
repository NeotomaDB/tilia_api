// Postgres functions for Tilia:
const path = require('path')

const { sql, getparam } = require('../src/neotomaapi.js')

var dbtest = require('../database/pgp_db').dbheader

/**
 * Return the set of available database functions made visible through the API.
 * @param {Request} req - A Request object passed from the user through the http protocal
 * @param {Response} res - A Response object to be passed back to the user.
 * @param {any} next
 * @returns {any}
 */
function allFunctions (req, res, next) {
  let paramgrab = getparam(req)

  if (!paramgrab.success) {
    res.status(500)
      .json({
        status: 'failure',
        data: null,
        message: paramgrab.message
      })
  } else {
    var resultset = paramgrab.data
    console.log(resultset)
    // Get the input parameters:
    var outobj = resultset
  }
  console.log(outobj)
  var noParam = Object.keys(outobj).length === 0

  var db = dbtest(req)

  var pgp = db.$config.pgp

  pgp.pg.types.setTypeParser(20, function (val) {
    return parseInt(val)
  })

  pgp.pg.types.setTypeParser(1700, function (val) {
    return parseInt(val)
  })

  let queryFunc = sql('../pgfunctions/fun_query.sql', pgp)
  let schemFunc = sql('../pgfunctions/get_schema.sql', pgp)

  // The call to the documentation JSON object occurs if the user either
  // enters no parameters, or the term 'method' fails to appear in the
  // user query string.
  if (noParam | !outobj.method) {
    // We're passing in the raw "/api/" endoint, which requests the set of all functions.
    db.any(queryFunc)
      .then(data => {
        return res.status(200)
          .json({
            success: 1,
            status: 'success',
            data: data,
            message: 'Retrieved all tables'
          })
      })
      .catch(err => {
        var date = new Date()
        console.log(date.toISOString() + ': ' + err.message)
        return res.status(500)
          .json({
            success: 0,
            status: 'failure',
            message: err.message,
            query: queryFunc
          })
      })
  } else {
    var arrFuncNameParts = outobj.method.split('.')
    var funcSchema = arrFuncNameParts[0]
    var funcName = arrFuncNameParts[1]

    // Here we wind up with the different schema.
    // First validate that the method is in the accepted set for GET calls:
    if (funcSchema !== 'ts' || ['validateusername', 'validatesteward', 'checksteward'].includes(funcName)) {
      var schema = db.any(queryFunc)
        .then(function (data) {
          // Check that outobj.method is in the set of data[name]:
          var methods = data.map(x => x.name)
          return (methods)
        })
        .then(function (data) {
          if (data.includes(outobj.method)) {
            // If the function called by the user is in the set of existing Postgres functions:

            db.any(schemFunc, [funcName])
              .then(function (data) {
                let dbFunction = funcSchema + '.' + funcName
                const QueryArgs = data[0]['pg_get_function_arguments'].split(',').map(x => x.trim().split(' ')[0])
                var QueryParams = {}
                if (QueryArgs[0] === '') {
                  QueryParams = {}
                } else {
                  for (let a in QueryArgs) {
                    console.log(typeof outobj[QueryArgs[a]])
                    if (typeof outobj[QueryArgs[a]] === 'string' || outobj[QueryArgs[a]] instanceof String) {
                      var replaced = outobj[QueryArgs[a]]
                      replaced = replaced.replace(/^"(.*)"$/g, '$1')
                      QueryParams[QueryArgs[a]] = replaced.replace(/^'(.*)'$/g, '$1')
                    } else {
                      QueryParams[QueryArgs[a]] = outobj[QueryArgs[a]]
                    }
                  }
                }

                console.log(QueryParams)
                console.log(pgp.helpers.sets(QueryParams))

                db.func(dbFunction, QueryParams)
                  .then(queryres => {
                    res.status(200)
                      .json({
                        status: 'success',
                        data: queryres,
                        message: 'Retrieved all tables'
                      })
                  })
                  .catch(function (err) {
                    res.status(500)
                      .json({
                        status: 'failure',
                        data: err.message,
                        message: 'Error attempting to execute Neotoma Tilia function.'
                      })
                  })
              })
          } else {
            res.status(500)
              .json({
                status: 'failure',
                data: null,
                message: 'Function is not in the set of supported Neotoma Tilia functions.'
              })
          }
        })
    } else {
      res.status(500)
        .json({
          status: 'failure',
          data: null,
          message: 'You cannot call a ts method through a GET call.'
        })
    }
  }
  return (schema)
}

module.exports.allFunctions = allFunctions
