      var express = require('express')
         var path = require('path')
      var favicon = require('serve-favicon')
       var logger = require('morgan')
 var cookieParser = require('cookie-parser')
   var bodyParser = require('body-parser')
         var path = require('path')
          var rfs = require('rotating-file-stream')

          var app = express()

// create a rotating write stream
if (process.env.NODE_ENV === "development") {
 var accessLogStream = rfs.createStream('access.log', {
   interval: '1d', // rotate daily
   path: path.join(__dirname, 'log')
  })
}

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// app.use(logger('dev', { stream: accessLogStream }));
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
  res.redirect('/api');
});

//in production, port is 3001 and server started in script 'www'
if (process.env.NODE_ENV === "development") {
  app.listen(3000);
}

module.exports = app;
