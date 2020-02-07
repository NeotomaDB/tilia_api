const path = require('path')

// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp
pgp.pg.types.setTypeParser(20, parseInt);



function validateusernamepassword(req, res, next){
    console.log('call validateusernamepassword');
    //call validateusernamepassword
        db.query('select * from ts.validatesteward($1, $2)',[req.user.username, req.user.pwd])
            .then(function (data) {
                console.log('data returned');
                console.log('date are: '+JSON.stringify(data));
                 //return data;
                 if ( data.length > 0){
                     next();
                 } else {
                     next("Error validating steward")
                 }

            })
            .catch(function (err) {
              return err
            })
}

function parseCredentials(req, res, next) {
    //read other headers
      
      //get header with username, pwd
      var headerText = req.get('OtherHeaders');
      if (headerText){

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
          next();
      

      } else {
        next('Error: username and password are not valid');
      }

    }


module.exports = {
    

    parseCredentials: parseCredentials,
    //todo server-side authorization
    authorize: function(req, res, next){

    },
    validateusernamepassword: validateusernamepassword


}

//exports.authenticate