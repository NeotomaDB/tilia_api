var promise = require('bluebird');

const fs = require('fs')

var options = {
    // Initialization Options
    promiseLib: promise
};

const pgp = require('pg-promise')(options);

if (process.env.NODE_ENV === "development")
{
    var connectpath = '../db_connect.json'
}
else
{
    var connectpath = './db_connect.json';
    console.log(process.env.NODE_ENV)
}

const ctStr = require(connectpath);

const db = pgp(ctStr);

db.proc('version')
    .then(data =>
    {
        console.log(data.version);
    })
    .catch(error =>
    {
        console.log("error connecting");
    });

module.exports = db;