/**
 * Read documents from the mongodb collection in batches.
 *
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

module.exports = function(coll, opts, func, cb) { return batchMongoCollection(coll, opts, func, cb); }
module.exports.batchMongoCollection = batchMongoCollection;

var BSONPure = require('mongodb').BSONPure;

var lowestNumericId = -Infinity;
var lowestStringId = '';
var lowestObjectId = BSONPure.ObjectID("000000000000000000000000");

/**
 * process the collection in batches, return the number of rows found
 */
function batchMongoCollection( collection, options, arrayFunc, callback ) {
    'use strict';

    options = options || {};
    var selectRows = options.selectRows || {};
    var selectColumns = options.selectColumns || {};
    var batchSize = options.batchSize || 100;

    function readLoop(lastId, offset, cb) {
        if (lastId === null) lastId = lowestNumericId;
        var select = {_id: {$gt: lastId}};
        if (Object.keys(selectRows).length > 0) select = {$and: [select, selectRows]};
        collection
            .find(select, selectColumns)
            .sort({_id: 1})
            .limit(batchSize)
            .toArray(function(err, array)
        {
            if (err) return cb(err, offset);

            if (array.length > 0) arrayFunc(array, offset, nextBatch);
            else nextBatch();

            function nextBatch(err) {
                if (err) return cb(err, offset);
                offset += array.length;
                if (array.length >= batchSize) {
                    lastId = array[array.length - 1]._id;
                }
                else {
                    // mongod _id sort puts numbers first, then strings, then objects
                    if (typeof lastId === 'number') lastId = lowestStringId;
                    else if (typeof lastId === 'string') lastId = lowestObjectId;
                    else return cb(null, offset);
                }
                setImmediate(function(){ readLoop(lastId, offset, cb); });
            }
        });
    }

    readLoop(null, 0, function(err, rowcount) {
        return callback(err, rowcount);
    });
}
