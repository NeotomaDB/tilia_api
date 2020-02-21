// get global database object
var db = require('../database/pgp_db')
var pgp = db.$config.pgp



//1. validate method name
//2. validate parameter input type and values
//3. compose sql request
//4. call sqlstatement

function handleGetUpdate(req, res, next){
  console.log("calling handleGetUpdate");
    var pgFunk = require('../pgfunctions/pgfunction.js')
    pgFunk.allFunctions(req, res, next)

}

function handleDelete(req, res, next){
     var data = {"message":"no data"};
      res.status(200)
                    .json({
                      status: 'success',
                      data: data,
                      message: 'Called DELETE api/update'
              });

}


function handlePostUpdate(req, res, next){
    console.log('calling data_handlers handlePostUpdate with '+ JSON.stringify(req.body));
    console.log('handlePostUpdate obtaining all headers as ' + JSON.stringify(req.headers));
    if(!req.body){
      var err = new Error("No POST body found");       
       err.tilia = true;
       return next(err);
    }
    var functionInputs = req.body.data;
    var methodSubmitted = req.body.method;
    console.log('calling handlePostUpdate with method '+methodSubmitted);
    if (!methodSubmitted){
      var err = new Error("No method provided in the POST body");       
       err.tilia = true;
       return next(err);
    }
//1. validate method name
    db.func('ti.getprocedureinputparams',[methodSubmitted])  
        .then(function(data){
            //returns array of object
            //  {
            //     "name": "_units",
            //     "type": "character varying",
            //     "isdefault": false,
            //     "paramorder": 1
            // }

            console.log("handlePostRequest data: "+JSON.stringify(data));
            
            var pgParamArray = [];

            if (data.length > 0){
                data.forEach(function(p){
                    console.log("Input "+p.name+" has value " + functionInputs[0][p.name]);
                    pgParamArray.push(functionInputs[0][p.name])
                })
            }

            console.log("params passed are: ", JSON.stringify(pgParamArray));
            db.func(methodSubmitted, pgParamArray)
                .then(function(qryResutls){
                     res.status(200)
                    .json({
                      status: 'success',
                      data: qryResutls,
                      message: 'Called Method '+methodSubmitted
              });
            })
            .catch(function(err){
              //show message in tilia error handler
              err.tilia = true;
              res.status(500)
              .json({
                success: 0,
                status: 'failure',
                data: null,
                message: 'Database error in function call as '+err
              })
            })
    
             
        })
        .catch(function (err) {
              //show message in tilia error handler
              err.tilia = true;
              res.status(500)
              .json({
                status: 'failure',
                data: null,
                message: 'Error in handlePostUpdate.'+err
              });
        })

} 


// Defining the query functions:
module.exports = {
  allfunctions: function (req, res, next) {
    console.log("calling allfunctions in data_handlers");
    var pgFunk = require('../pgfunctions/pgfunction.js')
    pgFunk.allFunctions(req, res, next)
  },
  handlePostUpdate: handlePostUpdate,
  handleGetUpdate: handleGetUpdate,
  handleDelete: handleDelete
}