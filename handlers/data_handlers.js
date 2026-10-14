// get global database object
const crypto = require('crypto')
const readLastLines = require('read-last-lines')
const pgFunk = require('../pgfunctions/pgfunction.js')
const tsCoerce = require('../pgfunctions/tscoerce.js')

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

// What Tilia is told when a database call fails. The database's own error text
// names tables, constraints and function signatures, so only the *kind* of failure
// is sent back; the detail stays in the server log under the same reference.
const DB_ERROR_MESSAGES = {
  '22001': 'A text value is too long for its field.',
  '22003': 'A number is outside the allowed range.',
  '22P02': 'A value has an invalid format.',
  '22007': 'A value has an invalid format.',
  '22008': 'A value has an invalid format.',
  '22021': 'A value has an invalid format.',
  '23502': 'A required value is missing.',
  '23503': 'The record conflicts with a related record: one it refers to is missing, or it is still in use.',
  '23505': 'A record with these values already exists.',
  '23514': 'A value is not allowed.',
  '57014': 'The database took too long to respond.'
}
const GENERIC_DB_MESSAGE = 'The database could not complete the request.'

/**
 * Find the database error behind whatever pg-promise threw. A failed batch is a
 * BatchError wrapping one result per query; the first real failure is the cause,
 * the rest are "transaction aborted" noise.
 */
function underlyingError (err) {
  if (err && typeof err.getErrors === 'function') {
    const errors = err.getErrors().filter(Boolean)
    return errors.find((e) => e.code !== '25P02') || errors[0] || err
  }
  return err
}

/**
 * The message Tilia shows for a failed call.
 * P0001 is RAISE EXCEPTION inside a ts function: those are written for the steward
 * to read ("this dataset already has ...") and Tilia's error dialog relies on them,
 * so they pass through. Everything else is reduced to its kind.
 */
function clientMessage (cause, ref) {
  if (cause && cause.code === 'P0001' && typeof cause.message === 'string') {
    return 'Database error in function call: ' + cause.message
  }
  const kind = (cause && DB_ERROR_MESSAGES[cause.code]) || GENERIC_DB_MESSAGE
  return 'Database error in function call: ' + kind + ' (reference ' + ref + ')'
}

function failure (res, status, message) {
  return res.status(status)
    .json({
      success: 0,
      status: 'failure',
      data: null,
      message: message
    })
}

/**
 * Write data to the database using content from the POST body.
 *
 * By the time this runs writeAuth (auth/sessionauth.js) has accepted the caller.
 * The method must be one Tilia may write with, and every value is checked against
 * the function's real parameter types (pgfunctions/tscoerce.js) before anything is
 * written. All the records of one POST then go in as one transaction: all or none.
 * @param {Request} req - The Request object passed from the user.
 * @param {Respose} res - The Response object to be passed back to the user.
 * @param {function} next - The callback function.
 * @returns {any}
 */
async function handlePostMultiUpdate (req, res, next) {
  var db = req.app.locals.db
  var ref = crypto.randomBytes(4).toString('hex')

  // The JSON5 middleware in tilia-api.js has already parsed the body into an object.
  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    return failure(res, 500, 'POST methods require a body element that includes valid method and data parameters.')
  }

  var methodSubmitted = req.body.method
  if (typeof methodSubmitted !== 'string' || methodSubmitted.length === 0) {
    return failure(res, 500, 'The API requires a valid method submitted in thh body content.')
  }

  // 1. The method must be one Tilia is allowed to write with. This does not say
  // whether the name was refused or does not exist.
  var target = tsCoerce.parseWriteMethod(methodSubmitted)
  var notAvailable = 'This function is not in the valid set of functions.'
  if (!target) {
    console.log(JSON.stringify({ event: 'write-refused', reason: 'method', via: req.user && req.user.via }))
    return failure(res, 400, notAvailable)
  }

  try {
    // 2. Real parameter order and types, from the database.
    var signature = await tsCoerce.getSignature(db, target.name)
    if (!signature) {
      return failure(res, 400, notAvailable)
    }

    // 3. Check and convert every value before anything is written.
    var coerced = tsCoerce.coerceRecords(signature, req.body.data)
    if (!coerced.ok) {
      console.log(JSON.stringify({
        event: 'write-refused',
        reason: coerced.reason,
        method: target.full,
        record: coerced.record,
        field: coerced.field
      }))
      if (coerced.reason === 'value') {
        return failure(res, 400, 'Invalid value in record ' + coerced.record + ' (field ' + coerced.field + ').')
      }
      if (coerced.reason === 'record') {
        return failure(res, 400, 'Record ' + coerced.record + ' is not an object of named values.')
      }
      return failure(res, 400, 'The data element must be an array of 1 to ' + tsCoerce.MAX_RECORDS + ' records.')
    }

    // The audit line: who wrote what, never the data itself.
    console.log(JSON.stringify({
      time: new Date().toISOString(),
      event: 'write',
      method: target.full,
      records: coerced.args.length,
      via: req.user && req.user.via,
      orcidid: req.user && req.user.orcidid,
      session: req.user && req.user.session
    }))

    // 4. One transaction for the whole POST.
    var results = await db.tx(function (t) {
      return t.batch(coerced.args.map(function (args) {
        return t.func(target.full, args)
      }))
    })

    var batchData = []
    results.forEach(function (r) {
      if (r[0]) {
        batchData.push(r[0][target.name])
      }
    })
    return res.status(200)
      .json({
        status: 'success',
        data: batchData,
        message: 'Called batch ' + coerced.args.length + ' times for method ' + target.full
      })
  } catch (err) {
    var cause = underlyingError(err)
    console.log(JSON.stringify({
      event: 'write-error',
      ref: ref,
      method: target.full,
      code: cause && cause.code,
      message: cause && cause.message,
      constraint: cause && cause.constraint,
      table: cause && cause.table,
      column: cause && cause.column
    }))
    // show message in tilia error handler
    return failure(res, 500, clientMessage(cause, ref))
  }
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
