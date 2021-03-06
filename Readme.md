mongobatch-js
=============

[![Build Status](https://api.travis-ci.org/andrasq/node-mongobatch-js.svg?branch=master)](https://travis-ci.org/andrasq/node-mongobatch-js?branch=master)
[![Coverage Status](https://codecov.io/github/andrasq/node-mongobatch-js/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-mongobatch-js?branch=master)


Process large MongoDB collections in convenient smaller batches.

Calls the filter function on batches of documents read from the collection.


## Installation

        npm install mongobatch-js
        npm test mongobatch-js


## Calls

### batchMongoCollection( collection, options, filter, whenDone )

Read batches documents from the mongodb collection and pass them to `filter`.
Supports document indexes that are numbers, strings and BSON ObjectIds, even
within the same collection.  Documents are traversed in ascending _id order
starting with numeric _ids, then strings, and finally objects.

- `collection` - mongodb collection object to iterate over
- `options` - adjustments to run-time behavior
- `filter` - function to process the documents, `filer(documents, offset, cb)`.
  Documents is a non-empty array of objects read from the collection.
  Offset is the number of documents already passed to filter (ie, the skip
  distance of `documents[0]` from the beginning of the collection, counted
  in ascending _id order).  Cb is the callback to signal that processing is
  finished for this batch; errors passed to cb will interrupt the iteration
  and will be returned with whenDone.
- `whenDone` - called on error or when all documents have been filtered.
  Called with the count of documents found, `whenDone(err, documentCount)`.

Options:

- `batchSize` : how many documents to return at a time (default 100)
- `selectRows` : which documents to return, specified as a mongodb `find`
  criterion object (default `{}`, all).  This search criterion is applied in
  combination with an _id range test.  For acceptable performance, check that
  the collection indexes support an `$and` query on both _id and `selectRows`.
- `selectColumns` : which fields to return from the documents (default `{}` all).
  This is passed as the second argument to `collection.find({}, selectColumns)`
  _id is always returned.


## Example

        var assert = require('assert');
        var mongoClient = require('mongodb').MongoClient;
        var batchMongoCollection = require('mongobatch-js').batchMongoCollection;

        db = mongoClient.connect("mongodb://localhost/test", function(err, db) {
            db.collection('collectiontest', function(err, collection) {
                var options = {};
                var documentCount = 0;
                batchMongoCollection(
                    collection,
                    options,
                    function filter(documents, offset, cb) {
                        console.log(documents);

                        // always called with an array
                        assert(Array.isArray(documents))

                        // offset is the number of documents returned prior to this batch
                        assert(documentCount === offset);

                        // does not return empty batches
                        assert(documents.length > 0);

                        documentCount += documents.length;
                        cb();
                    },
                    function whenDone(err, rowcount) {
                        // reports the number of documents found
                        assert(rowcount === documentCount);
                        console.log("Done.");
                        db.close();
                    }
                );
            });
        });


## Todo

- accept a sortOrder option to use instead of _id
- support raw BSON results
- accept the standard mongo options `query`, `fields`, `sort`
- allow a delay between batches
