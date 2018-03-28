     var express = require('express');
        var path = require('path');
     var favicon = require('serve-favicon');
      var logger = require('morgan');
var cookieParser = require('cookie-parser');
  var bodyParser = require('body-parser');

const querystring = require('querystring');

var app = express();

//get global database object
var db = require('./database/pgp_db');
var pgp = db.$config.pgp;

// Helper for linking to external query files:
function sql(file) {
    const fullPath = path.join(__dirname, file);
    return new pgp.QueryFile(fullPath, {minify: true});
}

// Create a QueryFile globally, once per file:
const query_func = sql('./pgfunctions/fun_query.sql');

app.get('/Retrieve', function(request, response) {
  db.any(query_func)
    .then(function (data) {
      response.status(200)
        .json({
          status: 'success',
          data: data,
          message: 'Retrieved all tables'
        });
    })
});

module.exports = app;