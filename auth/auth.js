const path = require('path')

// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp
pgp.pg.types.setTypeParser(20, parseInt);

function doNothing(req, res, next){
  next();
}

function authrequired(req, res, next){
    var methodPassed = req.query.method || req.body.method;

    if (!methodPassed ){
      next();
    } else {

      console.log("methodPassed ", methodPassed)
      var theSchema = methodPassed.split(".")[0];
      //see if method requires username, pw
      var unrestrictedMethods = ["ts.getsteward", "ts.checksteward", "ts.validateusername"];
      if (unrestrictedMethods.indexOf(methodPassed) == -1 && theSchema == "ts" ){
        parseCredentials(req, function(err, req){
          if(err){return next(err);}
          validateusernamepassword(req, function(err){
            if(err){return next(err);}
            next();
          })
        });
      } else {
        //no validation needed
        next();
      }
  }
}

function validateusernamepassword(req, callback){
    var err;
    //call validateusernamepassword
        db.query('select * from ts.validatesteward($1, $2)',[req.user.username, req.user.pwd])
            .then(function (data) {
                 //return data;
                 if ( data.length > 0){
                     callback();
                 } else {
                     err = new Error("Error validating steward");
                     err.tilia = true;
                     callback(err);
                 }

            })
            .catch(function (err) {
              return err
            })
}

function parseCredentials(req, callback) {
    //read other headers
      var err
      //get header with username, pwd
      var headerText = req.get('OtherHeaders');
      
      if (!headerText){
        err = new Error('Username and password were not provided');
        err.tilia = true;
        return next(err);
      } else {

        var regexSeparator =  /\\r\\n{1}/ ;
        var arrUser = headerText.split(regexSeparator);
        var username = arrUser[0].split(':')[1];
        var pwd = arrUser[1].split(':')[1];
        
      }

      if( username != null && pwd != null){
          var user = {};
          user.username = username;
          user.pwd = pwd;
          req.user = user;
          callback(null, req);
      } else {
        err = new Error('Username and password were not provided');
        err.tilia = true;
        callback(err);
      }

    }


module.exports = {
    authRequired: authrequired
}