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
              //present error details
              err.tilia = true;
              return err
            })
}

function parseCredentials(req, callback) {
    //read other headers
      var err
      //get header with username, pwd
      console.log("parsing headers pwd and username");
      //var headerText = req.get('OtherHeaders');
      var pwdText = req.get('pwd');
      var usernameText = req.get('username');

      console.log("username and password "+usernameText+":"+pwdText);
      if(!pwdText || !usernameText){
        console.log("throwing missing pwd and/or username error");
        err = new Error('Headers with username and password were not provided');
        err.tilia = true;
        callback(err);
      } else {
          var username = usernameText;
          var pwd = pwdText;
          var user = {};
          user.username = username;
          user.pwd = pwd;
          req.user = user;
          callback(null, req);        
      }

    }


module.exports = {
    authRequired: authrequired
}