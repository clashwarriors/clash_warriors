// generateImageList.js
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, 'public', 'new')
const output = []

function scanDir(dir, prefix = '') {
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const relPath = path.join(prefix, item).replace(/\\/g, '/')

    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath, relPath)
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(item)) {
      output.push(`/new/${relPath}`)
    }
  }
}

scanDir(ROOT)

fs.writeFileSync('./src/assets/imageList.json', JSON.stringify(output, null, 2))
console.log(`✅ imageList.json generated with ${output.length} images`)
