'use strict'
// Authentication for the Tilia write route (POST /update/write).
//
// Port of the Neotoma API's sessionauth.js (a sessionuuid in ap.orcidlogins,
// sent as `Authorization: Bearer <sessionuuid>`), plus a bridge for Tilia Desktop
// as it is today, which can only send steward credentials:
//
//   1. Bearer <sessionuuid>   -> must be a live session. If it is not, 401. A bad
//                                token never falls back to a password.
//   2. username + pwd headers -> (or HTTP Basic) checked against ts.validatesteward.
//   3. neither / wrong        -> 401, one generic message, so the response does not
//                                say which part was wrong.
//
// Set TILIA_REQUIRE_SESSION=true to switch step 2 off. That is the cutover for the
// day Desktop sends sessions: docs/TILIA_DESKTOP_SESSION_MIGRATION.md.
//
// Nothing here ever logs a password or a whole sessionuuid.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AUTH_HEADER_RE = /^(Bearer|Basic)\s+(\S+)$/i
const MAX_CREDENTIAL_LENGTH = 256

// LIMIT 1 so that duplicate rows (an old restore bug) cannot turn into a 500.
const SESSION_SQL = 'SELECT orcidid, sessionuuid, expiresat FROM ap.orcidlogins ' +
  'WHERE sessionuuid = $1 AND expiresat > now() ' +
  'ORDER BY expiresat DESC LIMIT 1'
const STEWARD_SQL = 'SELECT databaseid FROM ts.validatesteward($1, $2)'

const BAD_SESSION_MSG = 'Authentication failed. The session is invalid or has expired.'
const BAD_LOGIN_MSG = 'Authentication failed. Check your Neotoma steward username and password.'

/** First 8 characters only: enough to match a log line to a row, useless as a key. */
function maskSession (uuid) {
  return typeof uuid === 'string' ? uuid.slice(0, 8) : '?'
}

/**
 * Read the Authorization header.
 * @param {object} req An Express request.
 * @returns {{scheme: string, value: string}|null}
 */
function parseAuthorization (req) {
  const header = req.get('Authorization')
  const m = header ? AUTH_HEADER_RE.exec(header.trim()) : null
  return m ? { scheme: m[1].toLowerCase(), value: m[2] } : null
}

/**
 * Steward credentials from the headers Tilia Desktop sends (`username`, `pwd`), or
 * from HTTP Basic.
 * @returns {{username: string, pwd: string}|null}
 */
function legacyCredentials (req, authorization) {
  let username = req.get('username')
  let pwd = req.get('pwd')
  if ((!username || !pwd) && authorization && authorization.scheme === 'basic') {
    const decoded = Buffer.from(authorization.value, 'base64').toString('utf8')
    const at = decoded.indexOf(':')
    if (at > 0) {
      username = decoded.slice(0, at)
      pwd = decoded.slice(at + 1)
    }
  }
  if (typeof username !== 'string' || typeof pwd !== 'string') return null
  if (!username || !pwd) return null
  if (username.length > MAX_CREDENTIAL_LENGTH || pwd.length > MAX_CREDENTIAL_LENGTH) return null
  return { username, pwd }
}

/**
 * Look a sessionuuid up in ap.orcidlogins.
 * @returns {Promise<object|null>} The session row, or null if absent or expired.
 */
async function lookupSession (db, sessionuuid) {
  // Shape check first: keeps garbage out of the query.
  if (typeof sessionuuid !== 'string' || !UUID_RE.test(sessionuuid)) return null
  const rows = await db.any(SESSION_SQL, [sessionuuid])
  return rows[0] || null
}

/** Is this username/password a steward? Same check Tilia Desktop's own login uses. */
async function checkLegacyLogin (db, creds) {
  const rows = await db.any(STEWARD_SQL, [creds.username, creds.pwd])
  return rows.length > 0
}

function unauthorized (res, message) {
  return res.status(401).json({
    success: 0,
    status: 'unauthorized',
    data: null,
    message: message
  })
}

/**
 * Express middleware: only a valid session, or (unless TILIA_REQUIRE_SESSION=true)
 * valid steward credentials, gets through. Sets req.user = {via, orcidid?}.
 */
async function writeAuth (req, res, next) {
  const db = req.app.locals.db
  const authorization = parseAuthorization(req)
  try {
    if (authorization && authorization.scheme === 'bearer') {
      const session = await lookupSession(db, authorization.value)
      if (!session) {
        console.log(JSON.stringify({ event: 'write-auth-failed', via: 'session' }))
        return unauthorized(res, BAD_SESSION_MSG)
      }
      req.user = { via: 'session', orcidid: session.orcidid, session: maskSession(session.sessionuuid) }
      return next()
    }

    if (process.env.TILIA_REQUIRE_SESSION === 'true') {
      console.log(JSON.stringify({ event: 'write-auth-failed', via: 'none', reason: 'session-required' }))
      return unauthorized(res, BAD_SESSION_MSG)
    }

    const creds = legacyCredentials(req, authorization)
    if (!creds || !(await checkLegacyLogin(db, creds))) {
      console.log(JSON.stringify({ event: 'write-auth-failed', via: 'legacy' }))
      return unauthorized(res, BAD_LOGIN_MSG)
    }
    req.user = { via: 'legacy' }
    return next()
  } catch (err) {
    // Detail goes to the log; the caller learns only that the check failed.
    console.log(JSON.stringify({
      event: 'write-auth-error', code: err.code, message: err.message
    }))
    return res.status(500).json({
      success: 0,
      status: 'failure',
      data: null,
      message: 'The authentication check could not be completed. Please try again.'
    })
  }
}

module.exports = {
  writeAuth,
  lookupSession,
  checkLegacyLogin,
  parseAuthorization,
  legacyCredentials,
  maskSession
}
