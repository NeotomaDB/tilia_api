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

function requestFactory(theMethod, paramCollection, callback){
  var taskBatch = [];
  paramCollection.forEach(function(c){
      var theFunction = db.func(theMethod, c);
      taskBatch.push(theFunction);
  })
  console.log("taskBatch is "+JSON.stringify(taskBatch));
  callback(taskBatch);
}


function handlePostMultiUpdate(req, res, next){
    console.log('calling data_handlers handlePostUpdate with '+ JSON.stringify(req.body));
    console.log('handlePostUpdate obtaining all headers as ' + JSON.stringify(req.headers));
    if(!req.body){
      var err = new Error("No POST body found");       
       err.tilia = true;
       return next(err);
    }
    var functionInputs = req.body.data;
    var methodSubmitted = req.body.method;
    var methodSansSchema = methodSubmitted.split(".")[1];
    console.log('calling handlePostMultiUpdate with method '+methodSubmitted);
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

            console.log("handlePostMultiRequest data: "+JSON.stringify(data));

            
            var arrOfPgParams = [];

            
            //process key|value for parameter inputs
            if (data.length > 0){
              //process array with one collection for each method call
              functionInputs.forEach(function(d, i){
                  console.log("parameter collection "+i+" is: "+JSON.stringify(d));
                  var pgParamArray = [];
                  data.forEach(function(e, i){
                        console.log("Input "+e.name+" has value " + d[e.name]);
                        pgParamArray.push(d[e.name])
                  
                  });
                  //add array of input values to batch collection
                  arrOfPgParams.push(pgParamArray);

              })
              
            }

            console.log("Collection input parameters is: "+JSON.stringify(arrOfPgParams));
            var numOfCalls = arrOfPgParams.length;
            var arrOfCalls = [];
            console.log("Number of function calls to make: "+numOfCalls);
            
            requestFactory(methodSubmitted, arrOfPgParams, function(arrOfCalls){
                db.task(function(t){
                  return t.batch(arrOfCalls)
                    
                })
                .then(function(theResult){
                  console.log("batch result "+ JSON.stringify(theResult))
                  //have array of arrays containing object key|newid
                  var batchData = [];
                  theResult.forEach(function(r){
                    if(r[0]){
                      batchData.push(r[0][methodSansSchema])
                    }
                  })
                  //return response
                  res.status(200)
                  .json({
                    status: 'success',
                    data: batchData,
                    message: 'Called batch ' + numOfCalls +' times for method '+methodSubmitted
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
            /*
            .catch(function (err) {
                  //show message in tilia error handler
                  err.tilia = true;
                  res.status(500)
                  .json({
                    status: 'failure',
                    data: null,
                    message: 'Error in handlePostMultiUpdate.'+err
                  });
            })
            */

      })
      

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

            var firstElem;

            if (data.length > 0){
                data.forEach(function(p,i){
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
  handlePostMultiUpdate: handlePostMultiUpdate,
  handleGetUpdate: handleGetUpdate,
  handleDelete: handleDelete
}