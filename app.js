      var express = require('express')
         var path = require('path')
      var favicon = require('serve-favicon')
       var logger = require('morgan')
 var cookieParser = require('cookie-parser')
   var bodyParser = require('body-parser')

var app = express()

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

var data = require('./routes/data.js')

app.use('/', data)

module.exports = app