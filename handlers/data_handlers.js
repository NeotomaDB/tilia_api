//get global database object
var db = require('../database/pgp_db');
var pgp = db.$config.pgp;

// Defining the query functions:
module.exports = {
  allfunctions: function (req, res, next) { 
    var pg_funk = require('../pgfunctions/pgfunction.js');
    pg_funk.allfunctions(req, res, next); 
  }
};