# tilia_api

A repository for the implementation of the Tilia/uploader API.  This API is intended to replace the current [Tilia API](https://tilia.neotomadb.org) which uses the SQL Server database and a .NET front end.

This new API is required to perform three main functions:

  1. Query the active PostgreSQL database to return all function names and parameters required for the Tilia-related functions.
  2. Provide endpoints of the format `Response/?FunctionName&param1=xxxx&param2=yyyy` that allow each individual function to be passed, and each parameter to be matched.
  3. Provide an interactive wrapper for the API that wraps a JSON output and provides the opportunity to test and build the various API queries.

  ## Development

  * [Simon Goring](https://goring.org)
  * the [Neotoma Paleoecological Base](http://neotomadb.org)

