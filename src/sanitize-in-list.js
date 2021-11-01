'use strict';

module.exports = function sanitizeInclusionInList(value, dflt, list, label) {
  if (!value) return dflt;
  if (list.indexOf(value) === -1) {
    throw new Error(
      `Invalid ${label} type. Options are ${JSON.stringify(list).join(', ')}.`
    );
  }
  return value;
}
