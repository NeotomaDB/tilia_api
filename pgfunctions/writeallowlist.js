'use strict'
// Which ts.* functions may be called through POST /update/write.
//
// Until now the route would call any ts.* function the database had, about 200 of
// them, including ts.deletesite, ts.deletetaxon, ts.combinecontacts and
// ts.insertsteward (which creates a steward account). Tilia Desktop uses none of
// those, so they are closed off. See docs/SESSIONUUID_TILIA_CHANGES.md, section 3.
//
// Inserts are allowed by pattern: Desktop builds many of them dynamically, so a
// fixed list would go stale the first time a function is added.
const INSERT_PATTERN = /^insert[a-z0-9_]+$/

// Inserts that must never be reachable from the upload route.
const INSERT_DENY = new Set([
  'insertsteward' // creates a steward login (username + plaintext password) and rights
])

// Updates and deletes are an explicit list: every update*/delete* name found in the
// Tilia Desktop source (TINeotoma.cpp builds the method as "ts." + name). Names
// that are not in a given database simply fail the pg_proc check later. To let a
// new client call another function, add it here on purpose.
const DESKTOP_EDITS = new Set([
  'deleteanalysisunit',
  'deletechroncontrol',
  'deletechronology',
  'deletedata',
  'deletedatasetpi',
  'deletedatasettaxonnotes',
  'deletedatasetvariable',
  'deletegeochron',
  'deletegeochronpublication',
  'deletepublicationauthor',
  'deletepublicationeditor',
  'deletepublicationtranslator',
  'deletesampleanalysts',
  'deletesamplekeyword',
  'updateaggregatechronagebounds',
  'updateanalysisunitdepth',
  'updateanalysisunitname',
  'updateanalysisunitthickness',
  'updatechroncontrolage',
  'updatechroncontrolagebasis',
  'updatechroncontrolageolder',
  'updatechroncontrolagetype',
  'updatechroncontrolageyounger',
  'updatechroncontrolanalysisunit',
  'updatechroncontroldepththickness',
  'updatechroncontrolevent',
  'updatechroncontrolnotes',
  'updatechronology',
  'updatedata',
  'updatedatasetname',
  'updatedatasetnotes',
  'updatedatasettaxonnotes',
  'updatedatasettype',
  'updatedatasetvariable',
  'updatedatavariable',
  'updateepddataset',
  'updategeochron',
  'updategeochronanalysisunit',
  'updategeochrondatasetpubs',
  'updatepublication',
  'updatepublicationauthor',
  'updatepublicationeditor',
  'updatepublicationtranslator',
  'updateradiocarbon',
  'updatesampleage',
  'updatesampleanalysisunit',
  'updatesamplename',
  'updatesitelatlon',
  'updatespecimendate'
])

/**
 * Is this ts function (name without the schema) callable from the write route?
 * @param {string} name A lower-case function name, e.g. 'insertsite'.
 * @returns {boolean}
 */
function isAllowedWriteFunction (name) {
  if (typeof name !== 'string') return false
  if (INSERT_DENY.has(name)) return false
  return INSERT_PATTERN.test(name) || DESKTOP_EDITS.has(name)
}

module.exports = { isAllowedWriteFunction, DESKTOP_EDITS, INSERT_DENY }
