const mongoose = require('mongoose');

const uri = 'mongodb+srv://hungrx001:Os4GO3Iajie9lvGr@hungrx.8wv0t.mongodb.net/hungerX';

mongoose.connect(uri,)
    .then(async () => {
        const files = await mongoose.connection.db.collection('yourBucketName.chunks').find({}).toArray();
        console.log('Files in GridFS:', files);
        mongoose.connection.close();
    })
    .catch(err => console.error('Connection error:', err));
