      var express = require('express');
         var path = require('path');
      var favicon = require('serve-favicon');
       var logger = require('morgan');
 var cookieParser = require('cookie-parser');
   var bodyParser = require('body-parser');

const querystring = require('querystring');

var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// get global database object
  var db = require('./database/pgp_db');
 var pgp = db.$config.pgp;

var data = require('./routes/data.js')

const port = 3000;

app.listen(port, () => {
  console.log('We are live on ' + port);
});

app.use('/', data);

module.exports = app;