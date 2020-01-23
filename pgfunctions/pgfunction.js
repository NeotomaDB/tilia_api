// Postgres functions for Tilia:

const path = require('path')

// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp
pgp.pg.types.setTypeParser(20, parseInt);

// Helper for linking to external query files:
function sql (file) {
  const fullPath = path.join(__dirname, file)
  return new pgp.QueryFile(fullPath, {minify: true})
}

// Create a QueryFile globally, once per file:
const queryFunc = sql('./fun_query.sql')
const schemFunc = sql('./get_schema.sql')

function allFunctions (req, res, next) {

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

    return dbFuncs;

  } else {

    var allParams = req.query
    var sqlMethod = allParams.method
    if (allParams.method){
      var functionSchema = allParams.method.substring(0, 2)
    } else {
      next("Method passed must be schema qualified");
    }  

    console.log('allParams passed are: '+JSON.stringify(allParams));
    // First validate that the method is in the accepted set:
    var schema = db.any(queryFunc)
      .then(function (data) {
          // Check that sqlMethod is in the set of data[name]:
        var methods = data.map(x => x.name)
        return(methods)
      })
      .then(function(data) {
        if (data.includes(sqlMethod)) {
          // If the function called by the user is in the set of existing
          // Postgres functions:
          var schema = db.any(schemFunc, sqlMethod)
            .then(function (data) {
              var sqlCall = 'SELECT * FROM '  + sqlMethod + '('

              for (var i = 1; i < Object.keys(allParams).length; i++) {
                sqlCall = sqlCall + Object.keys(allParams)[i] + ' := ' + allParams[Object.keys(allParams)[i]]

                if (i < Object.keys(allParams).length - 1) {
                  sqlCall = sqlCall + ', '
                }
              }

              sqlCall = sqlCall + ')'

              return(sqlCall)
            })
            .then(function(schema) {
              var dbCall = db.any(schema)
                .then(function (data) {
                  res.status(200)
                    .json({
                      status: 'success',
                      data: data,
                      message: 'Retrieved all tables'
                    })
                })
                .catch(function (err) {
                  res.status(500)
                  .json({
                    status: 'failure',
                    data: null,
                    message: 'Function is not in the set of supported Neotoma Tilia functions.'
                  });
                })
              return (dbCall);
            })
        } else {
          res.status(500)
          .json({
            status: 'failure',
            data: null,
            message: 'Function is not in the set of supported Neotoma Tilia functions.'
          });
        }
      })

  }
  return(schema);
}

module.exports.allFunctions = allFunctions
