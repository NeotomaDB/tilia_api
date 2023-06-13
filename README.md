[![NSF-1550707](https://img.shields.io/badge/NSF-1550707-blue.svg)](https://nsf.gov/awardsearch/showAward?AWD_ID=1550707) [![NSF-1541002](https://img.shields.io/badge/NSF-1541002-blue.svg)](https://nsf.gov/awardsearch/showAward?AWD_ID=1541002)

# Tilia API For Neotoma

A repository for the implementation of the Tilia/uploader API. This API has replaced the earlier Tilia API which used SQL Server database and a .NET front end.

The API performs three main functions:

  1. Query the active PostgreSQL database to return all function names and parameters required for the Tilia-related functions.
  2. Provide endpoints of the format `Response/?FunctionName&param1=xxxx&param2=yyyy` that allow each individual function to be passed, and each parameter to be matched.
  3. Provide an interactive wrapper for the API that wraps a JSON output and provides the opportunity to test and build the various API queries.

## Development

* [Simon Goring](http://goring.org): University of Wisconsin - Madison [![orcid](https://img.shields.io/badge/orcid-0000--0002--2700--4605-brightgreen.svg)](https://orcid.org/0000-0002-2700-4605)
* Mike Stryker: Pennsylvania State University
* The [Neotoma Paleoecological Base](http://neotomadb.org)

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md).  By participating in this project you agree to abide by its terms.

## Components

The project uses a `node`/`express` backbone to support a single endpoint. 

### Installation

To start the project, clone the repository and install the required packages using:

```bash
npm install
```

This will install all required packages. The API can be started using one of three commands:

```bash
npm run start # Run the API in production mode from the current directory
npm run dev_start # Run the API in development mode and serve from a ./bin/www directory
npm run dev_www # Run the API in development model
```

In development mode the application listens on `PORT=3006`, and so the user can interact with the application using `localhost:3006`. The listening port can be changed in the file `tilia-api.js`.

### Anatomy of an API call

All calls to `localhost:3006` (or its proxy) are processed within `tilia-api.js` and then pased to the routing methods within [`routes/data.js`](./routes/data.js).

The `routes/data.js` file first redirects to `/api/` to provide better identifiability of the URL calls (explicitly identifying them as API calls). The file recognizes multiple `GET`, `POST` and `DELETE` methods, and processes them in order. The format of the `router` calls is simply:

```javascript
router.VERB('PATH', function)
```

The router object is providing the Router object that manages the user request. We define methods for each combination of [http method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) and path (`'PATH'`). For each method/path combination we define the function that will be used to manage that request.

All handling functions are found within the [`handlers`](/handlers) folder. Each function in the handler takes `req`, `res`, and `next` as parameters and should terminate in a Response that includes both a `200` success response and appropriate error responses.

### Responses

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
