/*
 *
 * data.js
 * By: Simon Goring
 *
 */

var express = require('express')
var router = express.Router()

var handlers = require('../handlers/data_handlers')
var writeAuth = require('../auth/sessionauth').writeAuth

router.get('/healthwatch', function (req, res, next) {
  res.status(200).json(
    { 'response': 'Okay' }
  )
})

// Runs, but pulls only from URL query parameters. (Check if this is being used)
router.get('/update', handlers.handleGetUpdate)

router.get('/logs/:lines', handlers.handleLogs)
router.get('/logs', handlers.handleLogs)

// Populates the dojo API.  Returns all API endpoints/Postgres functions.
router.get('/', handlers.allfunctions)
router.post('/', handlers.allfunctions)

// Handles single and batch requests where parameters are passed in the body.
// writeAuth comes first: a sessionuuid, or (until TILIA_REQUIRE_SESSION=true)
// steward credentials. See auth/sessionauth.js.
router.post('/update/write', writeAuth, handlers.handlePostMultiUpdate)
router.post('/apiupdate/write', writeAuth, handlers.handlePostMultiUpdate)

// Placeholder, not actually really used.
router.delete('/delete', handlers.handleDelete)

module.exports = router
