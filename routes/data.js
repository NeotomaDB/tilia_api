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

router.get('/api', handlers.allfunctions);

module.exports = router;
