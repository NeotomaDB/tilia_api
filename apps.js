     var express = require('express');
        var path = require('path');
     var favicon = require('serve-favicon');
      var logger = require('morgan');
var cookieParser = require('cookie-parser');
  var bodyParser = require('body-parser');
var swaggerJSDoc = require('swagger-jsdoc');

const querystring = require('querystring');

// Locations of files:

//apps API routes
var apps = require('./routes/apps');

var app = express();

app.use('/', index);

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.all('*', function(req, res) {
  res.redirect("/api-docs");
});

module.exports = app;