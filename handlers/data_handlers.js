// get global database object
// var db = require('../database/pgp_db')
// var pgp = db.$config.pgp

// Defining the query functions:
module.exports = {
  allfunctions: function (req, res, next) {
    var pgFunk = require('../pgfunctions/pgfunction.js')
    pgFunk.allFunctions(req, res, next)
  }
}
