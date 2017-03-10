"use strict";

const config = require("config");
const moment = require("moment");
const _ = require("underscore");

const log = require("./helpers/logger");

const format = process.env.FORMAT ||
  (config.has("app.format") ? config.get("app.format") : "json");

let logKey;

/**
 * escapeString - escape specific characters for CSV
 *
 * @param "s" - string
 * @returns string
 */
function escapeString(s) {
  if (s.indexOf('"') != -1) {
    s = s.replace(/"/g, '""');
  }

  if (s.indexOf("\n") != -1) {
    s = s.replace(/\n/g, "");
  }

  if (s.match(/"|,/)) {
    s = '"' + s + '"';
  }
  return s;
}

/**
 * getBaselineKey - for a given task, return the nesting
 * level of the baseline flag if set.
 *
 * @param task
 * @returns {*}
 */
function getBaselineKey(task) {
  let count = 0;
  let hasBaseline = false;

  let countTraverse = function countTraverse(task) {
    if (task.baseline) {
      hasBaseline = true;

      // log the target used for baseline
      // for analysis tags use the analysis tag
      if (task.analysis_tag) {
        logKey = "Analysis Tag (Level " + count + ")";
      } else if (task.target) {
        logKey = task.target;
      }

      return count;
    }

    for (var i in task) {
      if (
        task[i] !== null && typeof task[i] == "object" && i !== "analysis_tag"
      ) {
        count++;
        if (task[i].baseline) {
          hasBaseline = true;

          if (task[i].analysis_tag) {
            logKey = "Analysis Tag (Level " + count + ")";
          } else if (task[i].target) {
            logKey = task[i].target;
          }

          return count;
        }
        countTraverse(task[i]);
      }
    }
  };

  countTraverse(task);

  if (hasBaseline === false) {
    return false;
  } else {
    return count;
  }
}

/**
 * jsonToCsv - convert json to csv.
 * See /test/unitformat.test.js for supported formats
 *
 * @param obj
 * @returns {Promise}
 */
function jsonToCsv(obj, task) {
  log.info("Converting to CSV...");

  return new Promise(resolve => {
    if (format !== "csv") {
      resolve(obj);
    }

    let csv = "interactions,unique_authors";
    let splitKeys = 0;
    let splitCount = 0;
    let k4 = "";
    let k3 = "";
    let k2 = "";
    let k1 = "";

    // baseline
    let stats = {};
    let baseline = false; // calculate baseline?

    let baseLineKey = getBaselineKey(task); // the key to baseline against
    if (baseLineKey !== false) {
      log.info("Calculating self baseline.", logKey);
      baseline = true;
      csv += ",baselinekey_percent,percent_of_total,total_authors";
    }

    csv += "\n";

    /**
         *
         * @param n
         * @returns {boolean}
         */
    function isInt(n) {
      return n % 1 === 0;
    }

    /**
         *
         * @param i
         * @returns {boolean}
         */
    function isValidKey(i) {
      const fields = [
        "total_unique_authors",
        "interactions_percentage",
        "unique_authors_percentage",
        "target",
        "results",
        "redacted",
        "analysis_type",
        "key",
        "interactions",
        "unique_authors",
        "child",
        "threshold",
        "parameters"
      ];
      if (fields.indexOf(i) > -1) {
        return true;
      }
      return false;
    }

    let traverse = function traverse(o) {
      for (var i in o) {
        //Merged task?
        if (isValidKey(i) === false && isInt(i) === false) {
          //custom merged will merge result keys with "__"
          k1 = "";
          if (i.includes("__")) {
            let resToSplit = i.split("__");

            //count the number of columns as this can vary
            splitCount = resToSplit.length;

            resToSplit.forEach(function(v) {
              k1 += escapeString(v) + ",";
            });
          } else {
            k1 = escapeString(i) + ",";

            splitCount = 1;
          }
        }

        // k2 node
        if (
          o[i].key &&
          o[i].child &&
          o[i].child.results[0] &&
          o[i].child.results[0].child &&
          o[i].child.results[0].child.results[0]
        ) {
          k2 = escapeString(o[i].key) + ",";
        }

        // k3 node
        if (o[i].key && o[i].child) {
          k3 = escapeString(o[i].key) + ",";
        }

        // k4 node
        if (o[i].key && !o[i].child) {
          splitKeys = 1;

          k4 = escapeString(o[i].key);

          if (k2 !== "") {
            splitKeys++;
          }

          if (k3 !== "") {
            splitKeys++;
          }

          if (k4 !== "") {
            splitKeys += splitCount;
          }

          // a string of the combined keys
          let y = k1 + k2 + k3 + k4;

          // Now that we have the correct key order as defined by y,
          // we can easily marry up the selected baseline key from config.

          // Split on comma, but not comma space.
          // This could clearlly be improved.
          let splits = y.split(/,[^, ]/g);
          let x = splits[baseLineKey];

          stats = stats || {};
          stats.totalAuthors = stats.totalAuthors || 0;
          stats.totalAuthors += o[i].unique_authors;

          stats.data = stats.data || {};
          stats.data[y] = stats.data[y] || {};

          stats.data[y].unique_authors = stats.data[y].unique_authors || 0;
          stats.data[y].unique_authors += o[i].unique_authors;

          stats.data[y].interactions = stats.data[y].interactions || 0;
          stats.data[y].interactions += o[i].interactions;

          // store the baseline key so that we can update the class
          // author counts later.
          stats.data[y].baselineKey = x;

          // keep a count of the total unique authors for the specific class
          stats.class_count = stats.class_count || {};
          stats.class_count[x] = stats.class_count[x] || 0;
          stats.class_count[x] += o[i].unique_authors;
        }

        if (o[i] !== null && typeof o[i] == "object") {
          traverse(o[i]);
        }
      }
    };

    traverse(obj);

    if (baseline === true) {
      // go through each of the class count totals and update each data item
      for (let idx in stats.class_count) {
        for (let d in stats.data) {
          if (stats.data[d].baselineKey == idx) {
            stats.data[d].class_total_unique_authors = stats.class_count[idx];
          }
        }
      }

      // calculate baseline
      for (let eachObj in stats.data) {
        // baseline: class total authors / total_unique_authors
        stats.data[eachObj].baseline = stats.data[
          eachObj
        ].class_total_unique_authors / stats.totalAuthors;

        // percent_of_total: unique_authors / total_unique_authors
        stats.data[eachObj].percent_of_total = stats.data[
          eachObj
        ].unique_authors / stats.totalAuthors;
      }
    }

    // build csv
    for (let k = splitKeys; k > 0; k--) {
      csv = "key" + k + "," + csv;
    }

    for (let key in stats.data) {
      csv += key +
        "," +
        stats.data[key].interactions +
        "," +
        stats.data[key].unique_authors;

      if (baseline === true) {
        csv += "," +
          stats.data[key].baseline +
          "," +
          stats.data[key].percent_of_total +
          "," +
          stats.totalAuthors;
      }

      csv += "\n";
    }

    //console.log("Baseline stats:",JSON.stringify(stats, undefined, 4));

    resolve(csv);
  }).catch(e => {
    log.error("Error parsing csv: " + e);
  });
}

exports.jsonToCsv = jsonToCsv;
