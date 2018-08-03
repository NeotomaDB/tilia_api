      var express = require('express')
         var path = require('path')
      var favicon = require('serve-favicon')
       var logger = require('morgan')
 var cookieParser = require('cookie-parser')
   var bodyParser = require('body-parser')

var app = express()

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//allow cors resource sharing
app.use(function(req, res, next){
	res.header("Access-Control-Allow-Origin","*");
	res.header("Access-Control-Allow-Headers", "Origin, x-requested-with, content-type, Accept");
	next();
});

var data = require('./routes/data.js');

app.use('/', data);

app.all('*', function (req, res) {
  res.redirect('/retrieve');
});

app.listen(3000);

module.exports = app;
