// scripts/uploadToR2.js
import AWS from 'aws-sdk'
import fs from 'fs'
import path from 'path'
import mime from 'mime'
import 'dotenv/config'

// Load credentials from .env
const { R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_ACCOUNT_ID } = process.env

if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET || !R2_ACCOUNT_ID) {
  console.error('❌ Missing R2 credentials in .env')
  process.exit(1)
}

// Configure S3 client for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: R2_ACCESS_KEY,
  secretAccessKey: R2_SECRET_KEY,
  signatureVersion: 'v4',
})

// Folder to upload
const uploadDir = path.resolve('./dist')

// Upload a single file
async function uploadFile(filePath, keyName) {
  const fileContent = fs.readFileSync(filePath)
  const contentType = mime.getType(filePath) || 'application/octet-stream'

  const params = {
    Bucket: R2_BUCKET,
    Key: keyName,
    Body: fileContent,
    ContentType: contentType,
    ACL: 'public-read', // optional
  }

  try {
    await s3.putObject(params).promise()
    console.log(`✅ Uploaded: ${keyName}`)
  } catch (err) {
    console.error(`❌ Failed to upload ${keyName}: ${err.message}`)
  }
}

// Recursively get all files in a directory
function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files)
    } else {
      files.push(fullPath)
    }
  })
  return files
}

// Main upload function
;(async () => {
  console.log(`🚀 Starting upload from: ${uploadDir}`)

  const allFiles = getAllFiles(uploadDir)

  for (const filePath of allFiles) {
    const relativePath = path.relative(uploadDir, filePath).replace(/\\/g, '/')
    await uploadFile(filePath, relativePath)
  }

  console.log('🎉 Upload complete!')
})()
