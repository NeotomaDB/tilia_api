//get global database object
var db = require('../database/pgp_db');
var pgp = db.$config.pgp;

// Defining the query functions:
module.exports = {
  pgfunctions: function (req, res, next) { 
    var pg_funk = require('../helpers/pgfunctions/pgfunction.js');
    pg_funk.pgfunctions(req, res, next); 
}
