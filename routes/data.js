/*
 *
 * data.js
 * By: Simon Goring
 *
 */

var express = require('express')
var router = express.Router()

var handlers = require('../handlers/data_handlers')

router.get('/', (req, res) => {
  res.redirect('/api')
})

router.get('/healthwatch', function(req, res, next) {
  res.status(200).json({'response': 'Okay'});
});

// Runs, but pulls only from URL query parameters. (Check if this is being used)
router.get('/api/update', handlers.handleGetUpdate)

router.get('/api/logs/:lines', handlers.handleLogs)
router.get('/api/logs', handlers.handleLogs)

// Populates the dojo API.  Returns all API endpoints/Postgres functions.
router.get('/api', handlers.allfunctions)
router.post('/api', handlers.allfunctions)

// Handles single and batch requests where parameters are passed in the body.
router.post('/api/update/write', handlers.handlePostMultiUpdate)

// Placeholder, not actually really used.
router.delete('/api/delete', handlers.handleDelete)

module.exports = router
