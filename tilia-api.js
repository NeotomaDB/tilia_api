'use strict'

const compression = require('compression')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const express = require('express')
const path = require('path')
const favicon = require('serve-favicon')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const fs = require('fs')
const dotenv = require('dotenv')
const util = require('node:util')
const cors = require('cors')

const app = express()
dotenv.config()

// create a write stream (in append mode) for the log files.
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'),
  { flags: 'a',
    interval: '1d', // rotate daily
    path: path.join(__dirname, 'log') })

var logFile = fs.createWriteStream('log.txt', { flags: 'a' })
// Or 'w' to truncate the file every time the process starts.
var logStdout = process.stdout

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n')
  logStdout.write(util.format.apply(null, arguments) + '\n')
}

const limiter = rateLimit({
  windowMs: process.env.RATE_WINDOW || 2 * 60 * 1000, // 2 minutes
  max: process.env.MAX_RATE || 1000, // Limit each IP to 100 requests per `window` (here, per 2 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
})

// setup the logger -- Commenting this, so that I can try figuring out why the app isn't working.
// app.enable('trust proxy')
// app.disable('x-powered-by')
// app.use(helmet())

// Apply the rate limiting middleware to all requests
app.use(limiter)
app.use(compression())
app.use(morgan(':date[iso]\t:remote-addr\t:method\t:url\t:status\t:res[content-length]\t:response-time[0]\t:user-agent', { stream: accessLogStream }))

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

app.use(cors())

// We get unintentional errors from Tilia when poorly formatted JSON is passed.
// This helps us figure out what's going on:
app.use((req, res, next) => {
  bodyParser.json()(req, res, err => {
    if (err) {
      var date = new Date()
      console.log(date.toISOString() + ' {"error": "JSON body will not parse", "body": "' + err.body.replace(/(\r\n|\n|\r)/gm, ' ') + '"}')
      return res.status(400)
        .json({
          success: 0,
          status: 'failure',
          data: err.body.replace(/(\r\n|\n|\r)/gm, ' '),
          message: 'The JSON body will not properly parse.'
        })
    }
    next()
  })
})

app.use(bodyParser.urlencoded({
  extended: false
}))

app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

var data = require('./routes/data.js')

app.use('/', data)

app.all('*', function (req, res) {
  res.redirect('/api')
})

// custom 404
app.use((req, res, next) => {
  res.status(404).send("Sorry can't find that!")
})

// custom error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

// in production, port is 3001 and server started in script 'www'
// The variable is stored in the gitignored `.env` file.
// This is managed in the www folder.
if (process.env.NODE_ENV === 'development') {
  app.listen(3006)
}

module.exports = app
