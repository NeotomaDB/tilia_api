// get global database object
const readLastLines = require('read-last-lines')
const pgFunk = require('../pgfunctions/pgfunction.js')

function handleDelete (req, res, next) {
  var data = {
    'message': 'no data'
  }
  res.status(200)
    .json({
      status: 'success',
      data: data,
      message: 'Called DELETE api/update'
    })
}

function returnLog (req, res, next) {
  if (req.params.lines === undefined) {
    var linefeed = 50
  } else {
    linefeed = req.params.lines
  }
  readLastLines.read('access.log', linefeed)
    .then((lines) =>
      res.status(200)
        .json({
          success: 1,
          data: lines,
          message: 'Log returned.'
        }))
}

function requestFactory (theMethod, paramCollection, req, callback) {
  var db = req.app.locals.db
  var taskBatch = []
  paramCollection.forEach(function (c) {
    var theFunction = db.func(theMethod, c)
    taskBatch.push(theFunction)
  })
  var date = new Date()

  console.log(date.toISOString() + ' {"taskBatch": ' + JSON.stringify(taskBatch) + '}')
  callback(taskBatch)
}

/**
 * Write data to the database using content from the POST body.
 * @param {Request} req - The Request object passed from the user.
 * @param {Respose} res - The Response object to be passed back to the user.
 * @param {function} next - The callback function.
 * @returns {any}
 */
function handlePostMultiUpdate (req, res, next) {
  var db = req.app.locals.db
  if (Object.keys(req.body).length === 0) {
    return res.status(500)
      .json({
        success: 0,
        status: 'failure',
        message: 'POST methods require a body element that includes valid method and data parameters.'
      })
  }

  try {
    var content = JSON.stringify(req.body)
    var header = JSON.stringify(req.headers)
  } catch (exception) {
    var date = new Date()
    console.log(date.toISOString + ' {"body": ' + content + ', "header":' + header + '}')
    return res.status(500)
      .json({
        success: 0,
        status: 'failure',
        data: null,
        message: 'The API cannot parse the body content, error: ' + exception.message
      })
  }

  date = new Date()
  console.log(date.toISOString() + ' {"body": ' + content + ', "header":' + header + '}')
  var functionInputs = req.body.data
  var methodSubmitted = req.body.method
  var methodSansSchema = methodSubmitted.split('.')[1]

  if (methodSubmitted.length === 0) {
    return res.status(500)
      .json({
        success: 0,
        status: 'failure',
        data: null,
        message: 'The API requires a valid method submitted in thh body content.'
      })
  }
  // 1. validate method name
  db.func('ti.getprocedureinputparams', [methodSubmitted])
    .then(function (data) {

      var arrOfPgParams = []

      // process key|value for parameter inputs
      if (data.length > 0) {
        // process array with one collection for each method call
        functionInputs.forEach(function (d, i) {
          var pgParamArray = []
          data.forEach(function (e, i) {
            pgParamArray.push(d[e.name])
          })
          arrOfPgParams.push(pgParamArray)
        })
      }

      var numOfCalls = arrOfPgParams.length

      requestFactory(methodSubmitted, arrOfPgParams, req, function (arrOfCalls) {
        var dbb = req.app.locals.db
        dbb.task(function (t) {
          return t.batch(arrOfCalls)
        })
          .then(function (theResult) {
            var batchData = []
            theResult.forEach(function (r) {
              if (r[0]) {
                batchData.push(r[0][methodSansSchema])
              }
            })
            // return response
            res.status(200)
              .json({
                status: 'success',
                data: batchData,
                message: 'Called batch ' + numOfCalls + ' times for method ' + methodSubmitted
              })
          })
          .catch(function (err) {
            // show message in tilia error handler
            err.tilia = true
            res.status(500)
              .json({
                success: 0,
                status: 'failure',
                data: null,
                message: 'Database error in function call as ' + err.message
              })
          })
      })
    })
    .finally(db.end)
}

// Defining the query functions:
module.exports = {
  allfunctions: function (req, res, next) {
    /* This is returning the block query that is used to list the available functions. */
    pgFunk.allFunctions(req, res, next)
  },
  // handlePostUpdate: handlePostUpdate,
  handleGetUpdate: function (req, res, next) {
    pgFunk.allFunctions(req, res, next)
  },
  handlePostMultiUpdate: handlePostMultiUpdate,
  handleDelete: handleDelete,
  handleLogs: returnLog
}
