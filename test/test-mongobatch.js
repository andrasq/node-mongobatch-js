/**
 * Copyright (C) 2014,2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var mongoClient = require('mongodb').MongoClient;
var batchMongoCollection = require('../index.js');

var collectionName = 'unittest';
var dataCount = 223;
var data = [];
var db = null;

var i;
for (i=1; i<=dataCount; i++) {
    // rotate ids among numbers, strings, and bson objects
    var id = ((i % 3 === 1) ? i : (i % 3 === 2) ? (""+i) : undefined);
    data.push({_id: id, i:i, f:i+.01, s:""+i});
}

module.exports = {
    setUp: function(done) {
        var self = this;
        mongoClient.connect("mongodb://localhost/test", function(err, ret) {
            if (err) throw err;
            db = ret;
            db.collection(collectionName, function(err, ret) {
                if (err) throw err;
                self.collection = ret;
                self.collection.remove({}, {w: 1}, function(err, ret) {
                    if (err) throw err;
                    var t1 = Date.now();
                    self.collection.insert(data, {w: 1}, function(err, ret) {
                        if (err) throw err;
                        //console.log("inserted batch of " + dataCount + " rows in " + (Date.now()-t1) + " ms");
                        done();
                    });
                });
            });
        });
    },

    tearDown: function(done) {
        var collection = this.collection;
        collection.remove({}, {w:1}, function(err, ret) {
            if (err) throw err;
            collection.drop(function(err) {
                if (err) throw err;
                db.close();
                done();
            });
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
            t.ok(this.collection);
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
            batchMongoCollection(this.collection, options, filterFunc, function(err, nrows) {
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
            batchMongoCollection(this.collection, {selectRows: {_id: {$lt: 999999999}}}, filterFunc, function(err, nrows) {
                t.done();
            });
        },

        'should return all columns by default': function(t) {
            function filter(array, offset, cb) {
                if (array.length > 0) t.deepEqual(Object.keys(array[0]), ['_id', 'i', 'f', 's']);
                cb();
            }
            batchMongoCollection(this.collection, {}, filter, function(err, nrows) {
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
            batchMongoCollection(this.collection, {selectColumns: {s:1}}, filterFunc, function(err, nrows) {
                t.deepEqual(fields, {_id: true, s:true});
                t.done();
            });
        },
    },

    'edge cases': {
        setUp: function(done) {
            this.batchItems = function batchItems(items, options, t) {
                var itemIndex = 0;
                var cursor = { batchSize: function() {}, nextObject: function(cb) { cb(null, items[itemIndex++]) } };
                var collection = { find: function() { arguments[arguments.length - 1](null, cursor) } };

                var batchSize = options.batchSize || 10;
                t.expect(3 + Math.ceil(items.length / batchSize) * 3);

                var expectOffset = 0;
                batchMongoCollection(collection, options,
                    function(batch, offset, cb) {
                        t.ok(batch);
                        t.equal(offset, expectOffset);
                        t.deepEqual(batch, items.slice(offset, offset + batch.length));
                        expectOffset += batch.length;
                        cb();
                    },
                    function(err, rowCount) {
                        t.ifError();
                        t.equal(rowCount, expectOffset);
                        t.equal(rowCount, items.length);
                        t.done();
                    }
                );
            };
            done();
        },

        'should return mongo find error': function(t) {
            var collection = { find: function() { arguments[arguments.length - 1](new Error("test mongo error")) } };
            batchMongoCollection(collection, {}, function() {}, function(err, rowCount) {
                t.ok(err);
                t.equal(err.message, 'test mongo error');
                t.done();
            })
        },

        'should return mongo nextObject error': function(t) {
            var cursor = { batchSize: function() {}, nextObject: function(cb) { cb(new Error("test error")) } };
            var collection = { find: function() { arguments[arguments.length - 1](null, cursor) } };
            batchMongoCollection(collection, {}, function() {}, function(err, rowCount) {
                t.ok(err);
                t.equal(err.message, 'test error');
                t.done();
            })
        },

        'should return arrayFunc error': function(t) {
            var items = [ {i:1} ];
            var itemIndex = 0;
            var cursor = { batchSize: function() {}, nextObject: function(cb) { cb(null, items[itemIndex++]) } };
            var collection = { find: function() { arguments[arguments.length - 1](null, cursor) } };
            batchMongoCollection(collection, { batchSize: 10 },
                function(batch, offset, cb) {
                    cb(new Error("test processing error"));
                },
                function(err, rowCount) {
                    t.ok(err);
                    t.equal(err.message, 'test processing error');
                    t.done();
                }
            );
        },

        'should process empty batch': function(t) {
            var items = [ ];
            this.batchItems(items, { batchSize: 10 }, t);
        },

        'should process fractional batch': function(t) {
            var items = [ {i:1}, {i:2}, {i:3} ];
            this.batchItems(items, { batchSize: 10 }, t);
        },

        'should process exact batch': function(t) {
            var items = [ {i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10} ];
            this.batchItems(items, { batchSize: 10 }, t);
        },

        'should process more than one batch': function(t) {
            var items = [ {i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10}, {i:11} ];
            this.batchItems(items, { batchSize: 10 }, t);
        },

        'should process in bigger batches': function(t) {
            var items = [
                {i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},
                {i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},
            ];
            this.batchItems(items, { batchSize: 12 }, t);
        },
    },
};
