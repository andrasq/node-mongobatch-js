mongobatch
==========

Process MongoDB collection contents in convenient batches.


## Installation

        npm install mongobatch-js
        npm test mongobatch-js


## Calls

### batchMongoCollection( collection, options, filter, whenDone )

Read batches documents from the mongodb collection and pass them to `filter`.
Supports document indexes that are numbers, strings and BSON ObjectIds, even
within the same collection.  Documents are traversed in ascending _id order
starting with numeric _ids, then strings, and finally objects.

`collection` - mongodb collection object to iterate over
<br>
`options` -
  `batchSize` : how many documents to return at a time (default 100)
  `selectRows` : which documents to return, specified as a mongodb `find`
  criterion object (default all).  This search criterion is applied in
  combination with an _id range test; check that the collection has the right
  indexes for it.
  `selectColumns` : which fields to return from the documents (default all).
  This is passed as the second argument to `collection.find({}, selectColumns)`
  _id is always returned.
<br>
`filter` - function to process the documents, `filer(documents, offset, cb)`.
    Documents is a non-empty array of objects read from the collection.
    Offset is the number of documents already passed to filter (ie, the skip
    distance of `documents[0]` from the beginning of the collection, counted
    in ascending _id order).  Cb is the callback when processing is finished.
<br>
`whenDone` - callback when all documents have been processed with filter,
    called with `whenDone(err, documentCount)`.


## Example

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
