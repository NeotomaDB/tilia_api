// Sites query:

const path = require('path');

//get global database object
 var db = require('../database/pgp_db');
var pgp = db.$config.pgp;

// Helper for linking to external query files:
function sql(file) {
    const fullPath = path.join(__dirname, file);
    return new pgp.QueryFile(fullPath, {minify: true});
}

// Create a QueryFile globally, once per file:
const query_func = sql('./fun_query.sql');
 
function allfunctions(req, res, next) {

  db.any(query_func)
    .then(function (data) {
      res.status(200)
        .json({
          status: 'success',
          data: data,
          message: 'Retrieved all tables'
        });
    })
    .catch(function (err) {
        return next(err);
    }) 
}

module.exports.allfunctions = allfunctions;