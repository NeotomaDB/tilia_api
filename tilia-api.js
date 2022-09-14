var express = require('express')
var path = require('path')
var favicon = require('serve-favicon')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
// var rfs = require('rotating-file-stream')
var morgan = require('morgan')
var fs = require('fs')
var app = express()
const dotenv = require('dotenv')
dotenv.config()

var cors = require('cors')
//     var passport = require('passport')
// var LocalStrategy = require('passport-local').Strategy;
// var auth = require('./auth/auth.js')

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'),
  { flags: 'a',
    interval: '1d', // rotate daily
    path: path.join(__dirname, 'log') })

// setup the logger
app.enable('trust proxy')
app.use(morgan(':date[iso]\t:remote-addr\t:method\t:url\t:status\t:res[content-length]\t:response-time[0]\t:user-agent', { stream: accessLogStream }))

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

// check for authentication required conditions
// is schema ts and not in ['ValidateUserName', 'ValidateSteward', and 'GetConstituentDatabases']

// app.use(auth.authRequired)
// app.use(auth.parseCredentials);
// app.use(auth.validateusernamepassword);

var data = require('./routes/data.js')

app.use('/', data)

app.all('*', function (req, res) {
  res.redirect('/api')
})

// in production, port is 3001 and server started in script 'www'
// The variable is stored in the gitignored `.env` file.
// This is managed in the www folder.
// if (process.env.NODE_ENV === 'development') {
//   app.listen(3006)
// }

module.exports = app
