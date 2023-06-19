// Postgres functions for Tilia:
const path = require('path')

var dbtest = require('../database/pgp_db').dbheader

// Helper for linking to external query files:

/**
 * Return the set of available database functions made visible through the API.
 * @param {Request} req - A Request object passed from the user through the http protocal
 * @param {Response} res - A Response object to be passed back to the user.
 * @param {any} next
 * @returns {any}
 */
function allFunctions (req, res, next) {
  var noParam = Object.keys(req.query).length === 0 && req.query.constructor === Object
  var method = Object.keys(req.query).includes('method')

  var db = dbtest(req)

  var pgp = db.$config.pgp

  pgp.pg.types.setTypeParser(20, function (val) {
    return parseInt(val)
  })

  pgp.pg.types.setTypeParser(1700, function (val) {
    return parseInt(val)
  })

  function sql (file, pgp) {
    const fullPath = path.join(__dirname, file)
    return new pgp.QueryFile(fullPath, {
      minify: true
    })
  }

  let queryFunc = sql('./fun_query.sql', pgp)
  let schemFunc = sql('./get_schema.sql', pgp)

  // The call to the documentation JSON object occurs if the user either
  // enters no parameters, or the term 'method' fails to appear in the
  // user query string.
  if (noParam | !method) {
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
    var allParams = req.query
    var sqlMethod = allParams.method

    if (sqlMethod) {
      var arrFuncNameParts = sqlMethod.split('.')
      var funcSchema = arrFuncNameParts[0]
      var funcName = arrFuncNameParts[1]
    } else {
      next('Error: function must be schema qualified')
    }

    // Here we wind up with the different schema.
    // First validate that the method is in the accepted set for GET calls:
    if (funcSchema !== 'ts' || ['validateusername', 'validatesteward', 'checksteward'].includes(funcName)) {
      var schema = db.any(queryFunc)
        .then(function (data) {
          // Check that sqlMethod is in the set of data[name]:
          var methods = data.map(x => x.name)
          return (methods)
        })
        .then(function (data) {
          if (data.includes(sqlMethod)) {
            // If the function called by the user is in the set of existing Postgres functions:

            db.any(schemFunc, [funcName])
              .then(function (data) {
                var sqlCall = 'SELECT * FROM ' + funcSchema + '.' + funcName + '('

                for (var i = 1; i < Object.keys(allParams).length; i++) {
                  sqlCall = sqlCall + Object.keys(allParams)[i] + ' := ' + allParams[Object.keys(allParams)[i]]

                  if (i < Object.keys(allParams).length - 1) {
                    sqlCall = sqlCall + ', '
                  }
                }

                sqlCall = sqlCall + ')'
                return (sqlCall)
              })
              .then(function (sqlStatement) {
                db.any(sqlStatement)
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
