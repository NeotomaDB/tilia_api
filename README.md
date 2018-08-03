# tilia_api

A repository for the implementation of the Tilia/uploader API. This API is intended to replace the current [Tilia API](https://tilia.neotomadb.org) which uses the SQL Server database and a .NET front end.

The API is required to perform three main functions:

  1. Query the active PostgreSQL database to return all function names and parameters required for the Tilia-related functions.
  2. Provide endpoints of the format `Response/?FunctionName&param1=xxxx&param2=yyyy` that allow each individual function to be passed, and each parameter to be matched.
  3. Provide an interactive wrapper for the API that wraps a JSON output and provides the opportunity to test and build the various API queries.

## Development

  * [Simon Goring](https://goring.org)
  * The [Neotoma Paleoecological Base](http://neotomadb.org)


Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md).  By participating in this project you agree to abide by its terms.

## Components

The project uses a `node`/`express` backbone to support a single endpoint. To start the project, clone the repository and run the following from the command line.

```bash
node app.js
```

A client, sending a `GET` call to `/retrieve` (or `/retrieve/`) will obtain the following response (truncated):

```json
{"status":"success",
 "data":[{"description":"**",
          "name":"getagetypestable",
          "detailsurl":"<a href=\"?method=getagetypestable&action=doc\" target=\"_BLANK\">Details</a>",
          "params":[{"name":null,"type":""}]}, ... ]}
```

This JSON response can be chained to a single-page app that may support an interface similar to the current [Tilia SQL app](https://tilia.neotomadb.org/Retrieve/doc2/).

### Obtaining data from the Tilia name-space

The call to the new development API is structured as `method` & `parameter`:

```
GET retrieve/?method=tiliamethod&param_a=value_a&param_b=value_b
```

This call invokes the `method` as a function in the Neotoma postgres database with the parameters as named parameters using the function call:

```sql
SELECT * FROM method(param_a:=value_a, ... )
```

And then returns the object as a JSON object. For example:

```bash
GET retrieve/?method=getchildtaxacount&hitaxid=19
```
returns

```json
{"status":"success",
 "data":[{"getchildtaxacount":"0"}],
 "message":"Retrieved all tables"}
```

## Development

Still need to manage explicit mapping of the schemas within the database, and check whether we need to vet the function names and parameters before invoking the call.
