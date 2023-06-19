/**
 * Handle query errors and pass output through http protocal.
 * @param {any} err - Error object
 * @param {Request} req - Request object passed from the user.
 * @param {Response} res - Response object passed back to the user.
 * @param {any} next
 * @returns {null}
 */
function errorHandler (err, req, res, next) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 500
  if (err.tilia) {
    res.end(JSON.stringify({ error: err.message }))
  } else {
    // res.end(JSON.stringify({error: 'Internal Server Error'}));
    res.end(JSON.stringify({ error: err.message }))
  }
  return (null)
}

module.exports = {
  errorHandler: errorHandler
}
