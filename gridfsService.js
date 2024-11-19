// gridfsService.js
const { GridFSBucket } = require('mongodb');
const { MongoClient, ObjectId } = require('mongodb'); 
const uri = 'mongodb+srv://hungrx001:Os4GO3Iajie9lvGr@hungrx.8wv0t.mongodb.net/hungerX'; // Replace with your MongoDB connection string
const client = new MongoClient(uri);
const fs = require('fs');
const path = require('path');
const {  getDBInstance } = require('./config/db');
let bucket;

async function initializeGridFSBucket() {
    if (!bucket) {
        await client.connect();
        const db = client.db('hungerX'); // Replace with your database name
        bucket = new GridFSBucket(db, { bucketName: 'yourBucketName' }); // Replace with your bucket name
    }
    return bucket;
}
async function uploadFile(filePath) {
    const bucket = await initializeGridFSBucket();
    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath);
    const uploadStream = bucket.openUploadStream(fileName);

    fileStream.pipe(uploadStream)
        .on('error', (error) => console.error('Error uploading file:', error))
        .on('finish', () => console.log(`File uploaded successfully as ${fileName}`));
}

async function downloadFile(fileName, destinationPath) {
    const bucket = await initializeGridFSBucket();
    const downloadStream = bucket.openDownloadStreamByName(fileName);
    const fileStream = fs.createWriteStream(destinationPath);

    downloadStream.pipe(fileStream)
        .on('error', (error) => console.error('Error downloading file:', error))
        .on('finish', () => console.log(`File downloaded successfully to ${destinationPath}`));
}

async function listAllFiles() {
    const bucket = await initializeGridFSBucket();
    const filesCollection = bucket.s.db.collection(`${bucket.s.options.bucketName}.files`);
    
    // Retrieve only the necessary metadata fields
    const files = await filesCollection.find({}, { projection: { filename: 1, length: 1, uploadDate: 1 } }).toArray();
    
    console.log('Files in GridFS:', files); // This will log the readable file metadata
    return files; // Returns metadata as JSON
}
async function deleteFile(fileId) {
    const bucket = await initializeGridFSBucket();
    bucket.delete(fileId, (error) => {
        if (error) {
            console.error('Error deleting file:', error);
        } else {
            console.log('File deleted successfully');
        }
    });
}

async function listFileChunks(fileId, chunkId = null) {
    const bucket = await initializeGridFSBucket();
    const chunksCollection = bucket.s.db.collection(`${bucket.s.options.bucketName}.chunks`);

    try {
        const query = { files_id: new ObjectId(fileId) };
        if (chunkId) query._id = new ObjectId(chunkId); // If chunkId is provided, add to the query

        const chunks = await chunksCollection.find(query).toArray();
        console.log("Chunks found:", chunks); // Log the chunks found
        return chunks;
    } catch (error) {
        console.error('Error retrieving chunks:', error);
        throw new Error('Could not retrieve file chunks');
    }
}
module.exports = { uploadFile, downloadFile, listAllFiles, deleteFile,listFileChunks };
