/**
 * Copyright (C) 2014,2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

//var mongoClient = require('mongodb').MongoClient;
var batchMongoCollection = require('../');

module.exports = {

    'package.json should parse': function(t) {
        var conf = require('../package.json');
        t.done();
    },

    'should export function and name': function(t) {
        t.equal(typeof require('../'), 'function');
        t.ok(require('../').batchMongoCollection, batchMongoCollection);
        t.done();
    },

    setUp: function(done) {
        this.batchItems = function batchItems(items, options, t) {
            var itemIndex = 0;
            var cursor = { batchSize: function() {}, nextObject: function(cb) { cb(null, items[itemIndex++]) } };
            var collection = { find: function() { arguments[arguments.length - 1](null, cursor) } };

            var batchSize = options.batchSize || 100;
            t.expect(3 + Math.ceil(items.length / batchSize) * 5);

            var expectOffset = 0;
            batchMongoCollection(collection, options,
                function(batch, offset, cb) {
                    // always called with array
                    t.ok(Array.isArray(batch));

                    // no empty batches
                    t.ok(batch.length > 0);

                    // batchSize items unless not that many
                    if (offset + batchSize <= items.length) t.equal(batch.length, batchSize);
                    else t.equal(batch.length, items.length - offset);

                    // offset is starting index of current batch
                    t.equal(offset, expectOffset);

                    // the batch should be the correct subset of the query results
                    t.deepStrictEqual(batch, items.slice(offset, offset + batch.length));

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

    'should process in tiny batches': function(t) {
        var items = [
            {i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},
            {i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},
        ];
        this.batchItems(items, { batchSize: 3 }, t);
    },

    'options': {
        'should sort by _id': function(t) {
            var collection = {};
            var spy = t.spy(collection, 'find', function(){ arguments[arguments.length - 1](new Error("mongo error")) });
            batchMongoCollection(collection, {}, function() {}, function(err, rowCount) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[1], { sort: { _id: 1 } });
                t.done();
            })
        },

        'should use selectRows as query': function(t) {
            var collection = {};
            var spy = t.spy(collection, 'find', function(){ arguments[arguments.length - 1](new Error("mongo error")) });
            var query = { a: 1, b: 2 };
            batchMongoCollection(collection, { selectRows: query }, function() {}, function(err, rowCount) {
                t.equal(spy.callCount, 1);
                t.deepEqual(spy.callArguments[0], query);
                t.done();
            })
        },

        'should use selectColumns as fields': function(t) {
            var collection = {};
            var spy = t.spy(collection, 'find', function(){ arguments[arguments.length - 1](new Error("mongo error")) });
            var fields = { a: 1, b: 2 };
            batchMongoCollection(collection, { selectColumns: fields }, function() {}, function(err, rowCount) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[1], { fields: fields });
                t.done();
            })
        },
    },

    'edge cases': {
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
    },

};
