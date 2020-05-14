function errorHandler(err, req, res, next){
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 500;
  if(err.tilia){
      res.end(JSON.stringify({error: err.message}));
  } else {
      //res.end(JSON.stringify({error: 'Internal Server Error'}));
      res.end(JSON.stringify({error: err.message}));
  }
}

module.exports = {
    errorHandler: errorHandler
}