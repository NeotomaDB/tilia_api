/*
*
* data.js
* By: Simon Goring
*
*/

var express = require('express')
var router = express.Router()


var handlers = require('../handlers/data_handlers');

router.get('/', (req, res) => {
    res.redirect('http://tilia-dev.neotomadb.org/api');
});


router.get('/api/update', handlers.handleGetUpdate);

router.get('/api', handlers.allfunctions);

//deprecated
//router.post('/api/update/write', handlers.handlePostUpdate);

//handles single and batch requests
router.post('/api/update/write', handlers.handlePostMultiUpdate);

router.delete('/api/update', handlers.handleDelete);

module.exports = router;



