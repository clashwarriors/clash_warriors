// scripts/uploadToR2.js
import AWS from 'aws-sdk'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
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

// Folders to skip
const SKIP_FOLDERS = ['animations', 'new']

// Compute MD5 hash of a file
function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(fileBuffer).digest('hex')
}

// Check if object exists and return its ETag
async function getRemoteETag(key) {
  try {
    const head = await s3.headObject({ Bucket: R2_BUCKET, Key: key }).promise()
    return head.ETag.replace(/"/g, '')
  } catch (err) {
    if (err.code === 'NotFound') return null
    console.error(`❌ Failed to get ETag for ${key}: ${err.message}`)
    return null
  }
}

// Upload a single file
async function uploadFile(filePath, keyName) {
  const localHash = getFileHash(filePath)
  const remoteHash = await getRemoteETag(keyName)

  if (localHash === remoteHash) {
    console.log(`⏭ Skipped (unchanged): ${keyName}`)
    return
  }

  const fileContent = fs.readFileSync(filePath)
  const contentType = mime.getType(filePath) || 'application/octet-stream'

  try {
    await s3
      .putObject({
        Bucket: R2_BUCKET,
        Key: keyName,
        Body: fileContent,
        ContentType: contentType,
        ACL: 'public-read', // optional
      })
      .promise()
    console.log(`✅ Uploaded/Updated: ${keyName}`)
  } catch (err) {
    console.error(`❌ Failed to upload ${keyName}: ${err.message}`)
  }
}

// Recursively get all files in a directory
function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file)

    // Skip folders in SKIP_FOLDERS
    if (fs.statSync(fullPath).isDirectory()) {
      if (!SKIP_FOLDERS.includes(file)) {
        getAllFiles(fullPath, files)
      } else {
        console.log(`⏭ Skipping folder: ${file}`)
      }
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
