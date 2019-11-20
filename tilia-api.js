      var express = require('express')
         var path = require('path')
      var favicon = require('serve-favicon')
       var logger = require('morgan')
 var cookieParser = require('cookie-parser')
   var bodyParser = require('body-parser')
 //  var passport = require('passport')
  //var LocalStrategy = require('passport-local').Strategy;

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

/*
//enable authentication
app.use(passport.initialize());

app.use(function())

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));
*/

var data = require('./routes/data.js');

app.use('/', data);

app.all('*', function (req, res) {
  res.redirect('/retrieve');
});

app.listen(3000);

module.exports = app;
