mongobatch
==========

Process MongoDB collection contents in convenient batches.

### batchMongoCollection( collection, options, arrayFilterFunc, callback(err, numdocs) )

Read batches documents from the mongodb collection and pass them to arrayFilterFunc.
Supports document indexes that are numbers, strings and BSON ObjectIds.

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

Options

        batchSize: 100          - how many documents to return at a time (default 100)
        selectRows: {}          - which documents to return, find(selectRows) (default all)
        selectColumns: {}       - which fields to return, find({}, selectColumns) (default all)
