/**
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var mongoClient = require('mongodb').MongoClient;
var BSONPure = require('mongodb').BSONPure;
var batchMongoCollection = require('../index.js');

var collectionName = 'unittest';
var dataCount = 223;
var data = [];
var db = null;
var collection = null;

var i;
for (i=1; i<=dataCount; i++) {
    var id = ((i % 3 === 1) ? i : (i % 3 === 2) ? (""+i) : undefined);
    data.push({_id: id, i:i, f:i+.01, s:""+i});
}

module.exports = {
    setUp: function(done) {
        mongoClient.connect("mongodb://localhost/test", {db: {w: 1}, poolSize: 20}, function(err, ret) {
            if (err) throw err;
            db = ret;
            db.collection(collectionName, function(err, ret) {
                if (err) throw err;
                // this is not set!
                collection = ret;
                collection.remove({}, {w: 1}, function(err, ret) {
                    if (err) throw err;
                    var t1 = Date.now();
                    collection.insert(data, {w: 1}, function(err, ret) {
                        if (err) throw err;
                        //console.log("inserted batch of " + dataCount + " rows in " + (Date.now()-t1) + " ms");
                        done();
                    });
                });
            });
        });
    },

    tearDown: function(done) {
        collection.remove({}, function(err, ret) {
            if (err) throw err;
            db.close();
            done();
        });
    },

    'package.json should parse': function(t) {
        var conf = require('../package.json');
        t.done();
    },

    'should export function and name': function(t) {
        t.equal(typeof batchMongoCollection, 'function');
        t.ok(batchMongoCollection.batchMongoCollection);
        t.done();
    },

    'batchMongoCollection': {
        'should have collection': function(t) {
            t.ok(collection);
            // AR: FIXME: this.collection is not set ??
            //t.ok(this.collection);
            t.done();
        },

        'should read all entries in batches': function(t) {
            var options = {
                batchSize: 100,
                selectRows: {},
                selectColumns: {},
            };
            var batchCount = 0;
            var rowCount = 0;
            function filterFunc( array, offset, cb ) {
                t.equal(offset, rowCount);
                t.ok(array.length <= options.batchSize);
                if (array.length > 0) batchCount += 1;
                rowCount += array.length;
                cb();
            }
            var t1 = Date.now();
            batchMongoCollection(collection, options, filterFunc, function(err, nrows) {
                if (err) throw err;
                //console.log("batched " + dataCount + " rows in " + (Date.now()-t1) + " ms");
                // 10k in 1.0s (b:3, 10ks), in 0.134s (b:100, 75k/s), in 0.061s (b:1000, 164k/s)
                t.equal(rowCount, dataCount);
                t.equal(nrows, rowCount);
                t.done();
            });
        },

        'should filter rows': function(t) {
            var fields = {};
            function filterFunc(array, offset, cb) {
                for (var i=0; i<array.length; i++) t.equal(typeof array[i]._id, 'number');
                cb();
            }
            batchMongoCollection(collection, {selectRows: {_id: {$lt: 999999999}}}, filterFunc, function(err, nrows) {
                t.done();
            });
        },

        'should return all columns by default': function(t) {
            function filter(array, offset, cb) {
                if (array.length > 0) t.deepEqual(Object.keys(array[0]), ['_id', 'i', 'f', 's']);
                cb();
            }
            batchMongoCollection(collection, {}, filter, function(err, nrows) {
                t.done();
            });
        },

        'should filter columns': function(t) {
            var fields = {};
            function filterFunc(array, offset, cb) {
                var i, j;
                for (i=0; i<array.length; i++) {
                    var keys = Object.keys(array[i]);
                    for (j=0; j<keys.length; j++) fields[keys[j]] = true;
                }
                cb();
            }
            batchMongoCollection(collection, {selectColumns: {s:1}}, filterFunc, function(err, nrows) {
                t.deepEqual(fields, {_id: true, s:true});
                t.done();
            });
        },
    },
};
