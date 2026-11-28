'use strict';

// Migration and demo seed SQL use one statement terminator per line.
// Keep semicolons out of quoted text and comments in these files.
function splitSqlStatements(sql) {
  return sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean);
}

module.exports = { splitSqlStatements };
