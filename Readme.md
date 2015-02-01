mongobatch
==========

Process MongoDB collection contents in convenient batches.

## Installation

        npm install mongobatch-js

## Calls

### batchMongoCollection( collection, options, filter, whenDone )

Read batches documents from the mongodb collection and pass them to `filter`.
Supports document indexes that are numbers, strings and BSON ObjectIds, even
within the same collection.

`collection` - mongodb collection object to iterate over

`options` -

- `batchSize1` : 100 - how many documents to return at a time (default 100)
- `selectRows` : {} - which documents to return, find(selectRows) (default all)
- `selectColumns` : {} - which fields to return, find({}, selectColumns) (default all)

`filter` - function to process the documents, `filer(documents, offset, cb)`.
    Documents is a non-empty array of objects read from the collection.
    Offset is the number of documents already passed to filter (ie, it is the
    `skip` distance of the `documents[0]` from the beginning of the
    collection, counted in ascending _id order).  Cb is the callback when
    processing is finished.

`whenDone` - callback when all documents have been processed with filter,
    called with `whenDone(err, documentCount)`.

### Example

        var assert = require('assert');
        var mongoClient = require('mongodb').MongoClient;
        var batchMongoCollection = require('mongobatch').batchMongoCollection;

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
                        assert(rowcount === documentCount);
                        console.log("Done.");
                        db.close();
                    }
                );
            });
        });
