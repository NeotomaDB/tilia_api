# FetchTest.js

This short node.js script is intended to test the full set of Neotoma/Tilia API calls using lightly parameterized calls to the Tilia API.

To execute (currently) run the call at the command line in the `tests` folder.

```bash
node fetchtest.js
```

These tests are extremely naive. They use a single value for almost every integer is set to `123` for example. There is a better testing suite associated with the Neotoma API, but it is difficult to directly translate that to the Tilia API because the Tilia API directly relies on underlying Postgres Functions, while the Neotoma API uses custom queries for many of its operations.
