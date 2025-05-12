require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');

const endpoint = new AWS.Endpoint(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
console.log('[DEBUG] Using endpoint:', endpoint.href);

const s3 = new AWS.S3({
  endpoint,
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  region: '', 
  signatureVersion: 'v4',
});

async function uploadToR2(localFilePath, fileName) {
  const fileContent = fs.readFileSync(localFilePath);

  const params = {
    Bucket: process.env.R2_BUCKET,
    Key: fileName,
    Body: fileContent,
    ACL: 'public-read',
  };

  await s3.upload(params).promise();

  return `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileName}`;
}

module.exports = { uploadToR2 };
