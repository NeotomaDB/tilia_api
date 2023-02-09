// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp

/*
 1. validate method name
 2. validate parameter input type and values
 3. compose sql request
 4. call sqlstatement
*/

function handleGetUpdate (req, res, next) {
  console.log('calling handleGetUpdate')
  var pgFunk = require('../pgfunctions/pgfunction.js')
  pgFunk.allFunctions(req, res, next)
}

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

function requestFactory (theMethod, paramCollection, callback) {
  var taskBatch = []
  paramCollection.forEach(function (c) {
    var theFunction = db.func(theMethod, c)
    taskBatch.push(theFunction)
  })
  console.log('taskBatch is ' + JSON.stringify(taskBatch))
  callback(taskBatch)
}

function handlePostMultiUpdate (req, res, next) {
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

  var functionInputs = req.body.data
  var methodSubmitted = req.body.method
  var methodSansSchema = methodSubmitted.split('.')[1]

  if (methodSubmitted.length === 0) {
    return res.status(500)
      .json({
        success: 0,
        status: 'failure',
        data: null,
        message: 'The API requires a valid method submitted in teh body content.'
      })
  }
  // 1. validate method name
  db.func('ti.getprocedureinputparams', [methodSubmitted])
    .then(function (data) {
      // returns array of object
      //  { 'name': '_units', 'type': 'character varying', 'isdefault': false, 'paramorder': 1 }

      console.log('handlePostMultiRequest data: ' + JSON.stringify(data))

      var arrOfPgParams = []

      // process key|value for parameter inputs
      if (data.length > 0) {
        // process array with one collection for each method call
        functionInputs.forEach(function (d, i) {
          console.log('parameter collection ' + i + ' is: ' + JSON.stringify(d))
          var pgParamArray = []
          data.forEach(function (e, i) {
            console.log('Input ' + e.name + ' has value ' + d[e.name])
            pgParamArray.push(d[e.name])
          })
          // add array of input values to batch collection
          arrOfPgParams.push(pgParamArray)
        })
      }

      console.log('Collection input parameters is: ' + JSON.stringify(arrOfPgParams))
      var numOfCalls = arrOfPgParams.length

      console.log('Number of function calls to make: ' + numOfCalls)

      requestFactory(methodSubmitted, arrOfPgParams, function (arrOfCalls) {
        db.task(function (t) {
          return t.batch(arrOfCalls)
        })
          .then(function (theResult) {
            console.log('batch result ' + JSON.stringify(theResult))
            // have array of arrays containing object key|newid
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
}

/*
function handlePostUpdate (req, res, next) {
  var errorTypes = [Object.keys(req.body).length === 0, Object.keys(req.body.method).length === 0]
  if (errorTypes.some(x => true)) {
    return res.status(500)
      .json({
        success: 0,
        status: 'failure',
        message: 'POST methods require a body element that includes a valid method.'
      })
  }

  var functionInputs = req.body.data
  var methodSubmitted = req.body.method

  console.log('calling handlePostUpdate with method ' + methodSubmitted)

  // 1. validate method name
  db.func('ti.getprocedureinputparams', [methodSubmitted])
    .then(function (data) {
      // returns array of object
      //  { 'name': '_units', 'type': 'character varying', 'isdefault': false, 'paramorder': 1 }
      var pgParamArray = []

      if (data.length > 0) {
        data.forEach(function (p, i) {
          // console.log('Input ' + p.name + ' has value ' + functionInputs[0][p.name])
          pgParamArray.push(functionInputs[0][p.name])
        })
      }

      // console.log('params passed are: ', JSON.stringify(pgParamArray))
      db.func(methodSubmitted, pgParamArray)
        .then(function (qryResutls) {
          res.status(200)
            .json({
              status: 'success',
              data: qryResutls,
              message: 'Called Method ' + methodSubmitted
            })
        })
        .catch(function (err) {
          // show message in tilia error handler
          err.tilia = true
          return res.status(500)
            .json({
              success: 0,
              status: 'failure',
              data: null,
              message: 'Database error in function call as ' + err.message
            })
        })
    })
    .catch(function (err) {
      // show message in tilia error handler
      err.tilia = true
      res.status(500)
        .json({
          status: 'failure',
          data: null,
          message: 'Error in handlePostUpdate.' + err.message
        })
    })
}
*/

// Defining the query functions:
module.exports = {
  allfunctions: function (req, res, next) {
    /* This is returning the block query that is used to list the available functions. */
    var pgFunk = require('../pgfunctions/pgfunction.js')
    pgFunk.allFunctions(req, res, next)
  },
  // handlePostUpdate: handlePostUpdate,
  handlePostMultiUpdate: handlePostMultiUpdate,
  handleGetUpdate: handleGetUpdate,
  handleDelete: handleDelete
}
