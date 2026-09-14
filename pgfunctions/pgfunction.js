'use-strict'
// Postgres functions for Tilia:
const { sql, getparam } = require('../src/neotomaapi.js')

/**
 * Unwrap a string parameter that the client has quoted as a SQL literal.
 * The Tilia desktop client wraps every string search parameter in single quotes
 * and encodes an apostrophe as `%27%27`, a doubled SQL quote (TIJSON.cpp:67,145).
 * That dates from when the value was concatenated straight into SQL; pg-promise
 * escapes for us now, so a doubled quote left in place searches for a name that
 * literally contains two apostrophes and `D'Andrea` never matches. Undo the
 * doubling only when a single-quoted literal was actually unwrapped, so callers
 * passing an unquoted `D'Andrea` are left alone.
 * @param {string} value A string parameter as supplied by the caller.
 * @returns {string} The value with any client-applied SQL quoting removed.
 */
function unwrapClientLiteral (value) {
  if (/^".*"$/s.test(value)) {
    return value.slice(1, -1)
  }
  if (/^'.*'$/s.test(value)) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

/**
 * Return the set of available database functions made visible through the API.
 * @param {Request} req - A Request object passed from the user through the http protocal
 * @param {Response} res - A Response object to be passed back to the user.
 * @param {any} next
 * @returns {any}
 */
function allFunctions (req, res, next) {
  let db = req.app.locals.db
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
    // Get the input parameters:
    var outobj = resultset
  }

  var noParam = Object.keys(outobj).length === 0

  var pgp = db.$config.pgp

  pgp.pg.types.setTypeParser(20, function (val) {
    return parseInt(val)
  })

  pgp.pg.types.setTypeParser(1700, function (val) {
    return parseInt(val)
  })
  const schemFunc = sql('../pgfunctions/get_schema.sql', pgp)
  const queryFunc = sql('../pgfunctions/fun_query.sql', pgp)

  // The call to the documentation JSON object occurs if the user either
  // enters no parameters, or the term 'method' fails to appear in the
  // user query string.
  if (noParam | !outobj.method) {
    // Obscured: the bare endpoint no longer advertises the set of available
    // Postgres functions. Callers must supply an explicit `method`.
    return res.status(200)
      .json({
        success: 1,
        status: 'success',
        data: null,
        message: 'Welcome to the Tilia API'
      })

    /* ---- Previous behaviour, retained for reference ----
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
    ---- end previous behaviour ---- */
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
                    if (typeof outobj[QueryArgs[a]] === 'string' || outobj[QueryArgs[a]] instanceof String) {
                      QueryParams[QueryArgs[a]] = unwrapClientLiteral(String(outobj[QueryArgs[a]]))
                    } else {
                      QueryParams[QueryArgs[a]] = outobj[QueryArgs[a]]
                    }
                  }
                }
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
      if (req.action === 'GET') {
        res.status(500)
          .json({
            status: 'failure',
            data: null,
            message: 'You cannot call a ts method through a GET call.'
          })
      } else {
        res.status(500)
          .json({
            status: 'failure',
            data: null,
            message: 'This function is not in the valid set of functions.'
          })
      }
    }
  }
  return (schema)
}

module.exports.allFunctions = allFunctions
