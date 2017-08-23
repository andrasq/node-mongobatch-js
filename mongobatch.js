/**
 * Read documents from the mongodb collection in batches.
 *
 * Copyright (C) 2014,2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

module.exports = function(coll, opts, func, cb) { return batchMongoCollection(coll, opts, func, cb); }
module.exports.batchMongoCollection = batchMongoCollection;

/**
 * process the collection in batches, return the number of rows found
 */
function batchMongoCollection( collection, options, arrayFunc, callback ) {
    'use strict';

    var selectRows = options.selectRows || {};
    var selectColumns = options.selectColumns || {};
    var batchSize = options.batchSize || 100;
    var sortOrder = {_id: 1};

    var offset = 0;
    var batch = new Array();

    collection.find(selectRows, { fields: selectColumns, sort: sortOrder }, function(err, cursor) {
        if (err) return callback(err);
        cursor.batchSize(batchSize * 3);

        processBatch(batch, cursor);
    })

    function processBatch( batch, cursor ) {
        cursor.nextObject(function(err, obj) {
            if (err) return callback(err);

            if (obj) batch.push(obj);
            else if (!batch.length) return callback(null, offset);

            if (batch.length < batchSize && obj) {
                if (batch.length % 10) processBatch(batch, cursor);
                else setImmediate(processBatch, batch, cursor);
            }
            else {
                arrayFunc(batch, offset, function(err) {
                    if (err) return callback(err, offset);
                    offset += batch.length;
                    batch = new Array();
                    if (!obj) return callback(null, offset);
                    else setImmediate(processBatch, batch, cursor);
                })
            }
        })
    }
}
