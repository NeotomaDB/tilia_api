const path = require('path')

// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp
pgp.pg.types.setTypeParser(20, parseInt);

function doNothing(req, res, next){
  next();
}

function authrequired(req, res, next){
     console.log("request received at "+ new Date().toGMTString());
     var typeHeaderText = req.get('Content-Type');
     console.log("typeHeaderText "+typeHeaderText);
      
    var methodPassed = req.query.method || req.body.method;

    if (!methodPassed ){
      next();
    } else {

      console.log("methodPassed ", methodPassed)
      var theSchema = methodPassed.split(".")[0];
      //see if method requires username, pw
      console.log("schema for methodPassed "+theSchema);
      var unrestrictedMethods = ["ts.getsteward", "ts.checksteward", "ts.validateusername", "ts.validatesteward"];
      console.log("method is restricted " +(unrestrictedMethods.indexOf(methodPassed) == -1 && theSchema == "ts" ));
      if (unrestrictedMethods.indexOf(methodPassed) == -1 && theSchema == "ts" ){
        console.log("calling parseCredentials");
        parseCredentials(req, function(err, req){
          if(err){return next(err);}
          validateusernamepassword(req, function(err){
            if(err){return next(err);}
            next();
          })
        });
      } else {
        console.log("calling next middleware function with no validation");
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
      console.log("parsing OtherHeaders");
      var headerText = req.get('OtherHeaders');
      console.log("headerText "+headerText);

      if (!headerText){
        console.log("throwing headerText error");
        err = new Error('Header with username and password were not provided');
        err.tilia = true;
        callback(err);
      } else {

        var regexSeparator =  /\\r\\n{1}/ ;
        var arrUser = headerText.split(regexSeparator);
        console.log("arrUser is" + arrUser);
        if(arrUser.length < 2){
          err = new Error('OtherHeaders does not contain both components');
          err.tilia = true;
          callback(err);
        } else {
          var username = arrUser[0].split(':')[1];
          var pwd = arrUser[1].split(':')[1];
          //var constituentdatabase = arrUser[2].split(':')[1];
        }
        
      }

      if( username != null && pwd != null ){
        //&& constituentdatabase != null){
          var user = {};
          user.username = username;
          user.pwd = pwd;
          req.user = user;
          //req.constituentdatabase = constituentdatabase;
          callback(null, req);
      } else {
        err = new Error('OtherHeaders does not contain values for username, pwd, and constituentDatabase');
        err.tilia = true;
        callback(err);
      }

    }


module.exports = {
    authRequired: authrequired
}