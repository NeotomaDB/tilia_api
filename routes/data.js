/*
* 
* data.js
* By: Simon Goring
*
*/

var express = require('express');
var router = express.Router();

var handlers = require('../handlers/data_handlers');

router.get('/', (req, res) => {
	res.send('Hey banana.');
});

router.get('/api', handlers.allfunctions);

module.exports = router;
