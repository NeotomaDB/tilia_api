const path = require('path')
var assert = require('assert')
const promise = require('bluebird')

// Initialization Options
const options = {
  promiseLib: promise,
  capSQL: true
}
const pgp = require('pg-promise')(options)

const { geojsonToWKT, wktToGeoJSON } = require('@terraformer/wkt')

/**
 * Remove empty elements from an object.
 * @param {Object} obj An object to be cleaned.
 * @returns {Object} The object with no empy or missing values.
 */
function removeEmpty (obj) {
  return Object.keys(obj).forEach(key => {
    if (obj[key] && typeof obj[key] === 'object') removeEmpty(obj[key])
    else if (obj[key] == null) delete obj[key]
  })
}

// We're going to cache the query files we we don't keep reloading them.
const queryFileCache = {}

/**
 * Helper for linking to external query files.
 * @param {string} file A string representing a valid path to a SQL file.
 * @returns {pgp.QueryFile} A valid SQL query file object.
 */
function sql (file) {
  const fullPath = path.join(__dirname, file)

    // Return cached QueryFile if it already exists
  if (queryFileCache[fullPath]) {
    return queryFileCache[fullPath]
  }

  // Create new QueryFile and store in cache
  queryFileCache[fullPath] = new pgp.QueryFile(fullPath, {
    minify: true
  })
  
  return queryFileCache[fullPath]

}

/**
   * Parser for comma separated strings.
   * @param {str} x A comma separated string.
   * @return An array of integers.
   */
function commaSep (x) {
  var sep = String(x).split(',').map(x => x.trim())

  if (sep.map(x => /^\d+$/.test(x)).every(x => x === false)) {
    return sep
  } else {
    return sep.map(x => parseInt(x, 10))
  }
}

/**
 * Pass in integer identifiers for database queries to return values.
 * When numeric integers are passed in by the user, but we need to process these
 * for the "proper" query, we need to work with promises prior to the actual
 * route query. This function is used to get the result.
 * @param {any} res The Express.js response object.
 * @param {any} req The Express.js request object.
 * @param {any} query The SQL query, passed from the `sql` command.
 * @param {any} value An integer value, the numeric identifier.
 * @param {any} outobj The set of parameters passed by the user.
 * @returns {any} The result from the query.
 */
function checkObject (res, req, query, value, outobj) {
  let db = req.app.locals.db
  if (value) {
    if (!value.every(Number.isInteger)) {
      value = db.any(query, outobj)
        .then(function (data) {
          return data.map(x => x.output)
        })
        .catch(function (err) {
          return res.status(500)
            .json({
              status: 'failure',
              message: err.message,
              query: outobj
            })
        })
    }
  }
  return Promise.resolve(value)
}

/**
   * Quickly return value or null.
   * @param x Any value passed in from an object.
   * @return either the value of `x` or a `null` value.
   */
function ifUndef (x, opr) {
  if (typeof x === 'undefined') {
    return null
  } else {
    switch (opr) {
      case 'string':
        return String(x)
      case 'sep':
        return commaSep(x)
      case 'int':
        return parseInt(x, 10)
    }
  }
}

//  To validate objects that are going to be passed from a param/query to a DB call.
function validateOut (outobj) {
  var keyLength = Object.keys(outobj).length - 1

  for (var i = keyLength; i > -1; i--) {
    // Check for undefined values
    if (typeof outobj[Object.keys(outobj)[i]] === 'undefined' |
        outobj[Object.keys(outobj)[i]] === 'undefined') {
      outobj[Object.keys(outobj)[i]] = null
    }
    // Check for stand-alone null values.
    if (typeof outobj[Object.keys(outobj)[i]] === 'number' & isNaN(outobj[Object.keys(outobj)[i]])) {
      outobj[Object.keys(outobj)[i]] = null
    }

    // Check to see if the array is just an array of NaN:
    if (Array.isArray(outobj[Object.keys(outobj)[i]])) {
      if (outobj[Object.keys(outobj)[i]][0] !== outobj[Object.keys(outobj)[i]][0]) {
        outobj[Object.keys(outobj)[i]] = null
      }
    }
  }

  return outobj
}

function failure (query, msg) {
  let failobj = { 'status': 0,
    'data': null,
    'query': query,
    'message': msg }
  return failobj
}

function success (query, data, msg) {
  let success = { 'status': 1,
    'data': data,
    'query': query,
    'message': msg }
  return success
}

function getparam (req, name) {
  let result = { success: false, message: null, data: null }

  function clean (obj) {
    let output = []
    if (obj) {
      output = Object.keys(obj).filter(key => obj[key] !== undefined)
    }
    return output
  }

  const testquery = {
    body: clean(req.body),
    params: clean(req.params),
    query: clean(req.query) }

  // First ensure that there are no duplicate keys:
  let unstring = Object.values(testquery).flat()

  if (unstring.length !== [...new Set(unstring)].length) {
    result = {
      success: false,
      message: 'Duplicate keys present across params, query and body',
      data: null }

    return result
  }
  
  let output = {
    body: JSON.parse(JSON.stringify(req.body ?? {})),
    params: JSON.parse(JSON.stringify(req.params ?? {})),
    query: JSON.parse(JSON.stringify(req.query ?? {}))
  }

  result = {
    success: true,
    message: null,
    data: Object.assign(output.body, output.params, output.query)
  }

  return result
}

function customFilter (object, result) {
  if (object.hasOwnProperty('coordinates')) {
    result.push(object.coordinates)
  }

  for (var i = 0; i < Object.keys(object).length; i++) {
    if (typeof object[Object.keys(object)[i]] === 'object') {
      customFilter(object[Object.keys(object)[i]], result)
    }
  }
}

function parseLocations (location) {
  // Take in a location string that may be either WKT or geojson and parse it to valid WKT.
  // Best case scenario is that it's a valid WKT string and we can just keep going:
  try {
    assert.strictEqual(typeof location, 'string')
    var test = wktToGeoJSON(location)
    var outloc = location
  } catch (err) {
    if (err.name === 'Error') {
      // Terraformer doesn't give us a super great error name :)
      // Here we know it's not valid WKT, so we can try geoJSON:
      var parsedloc = JSON.parse(location.replace(/'/g, '"'))
      var geoms = []
      customFilter(parsedloc, geoms)
      try {
        outloc = geojsonToWKT({ 'type': 'MultiPolygon', 'coordinates': geoms })
      } catch (err) {
        console.log(err)
      }
      // The WKT parser only pulls geometries, so we need to unnest them:
    } else if (err.name === 'AssertionError') {
      throw new Error('Location must be passed as a string.')
    }
  }
  return outloc
}

module.exports.failure = failure
module.exports.success = success
module.exports.validateOut = validateOut
module.exports.sql = sql
module.exports.ifUndef = ifUndef
module.exports.commaSep = commaSep
module.exports.removeEmpty = removeEmpty
module.exports.checkObject = checkObject
module.exports.getparam = getparam
module.exports.parseLocations = parseLocations
