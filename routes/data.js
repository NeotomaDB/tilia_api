/*
* 
* data.js
* By: Simon Goring
*
*/

var express = require('express');
var router = express.Router();

var handlers = require('../handlers/data_handlers');

router.get('/Retrieve', handlers.contactquery);

module.exports = router;
