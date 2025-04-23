import { openDB } from 'idb'
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// ✅ Initialize IndexedDB (runs only once for new users)
export const initDB = async () => {
  return openDB('AnimationDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('frames')) {
        db.createObjectStore('frames') // Create store for animation frames
        console.log('✅ IndexedDB initialized with "frames" store.')
      }
    },
  })
}

// ✅ Get total stored frames count
export const countStoredFrames = async (folder) => {
  const db = await initDB()
  let storedCount = 0

  // ✅ Use the correct frame count for each folder
  const totalFrames = folder === 'dropSeq' ? 60 : 165

  for (let i = 1; i <= totalFrames; i++) {
    const frameID =
      folder === 'dropSeq'
        ? `72000${String(i).padStart(2, '0')}`
        : `${folder}_${i}`

    const frame = await db.get('frames', frameID)
    if (frame) storedCount++
  }

  return storedCount
}

// ✅ Check if frames are already stored
export const checkIfFramesExist = async () => {
  const db = await initDB()
  const firstFrame = await db.get('frames', 'ltr_1') // Check if LTR frame 1 exists
  return firstFrame !== undefined // Return true if images are stored
}

export const saveAllFramesToIndexedDB = async (setProgress) => {
  const db = await initDB();
  const folders = ["ltr", "rtl", "dropSeq"];
  const frameCounts = { ltr: 165, rtl: 165, dropSeq: 60 };
  let savedFrames = 0;
  const batchSize = 40; // Increase batch size for better performance

  for (const folder of folders) {
    const totalFramesInFolder = frameCounts[folder];
    const storedFramesCount = await countStoredFrames(folder);

    if (storedFramesCount >= totalFramesInFolder) {
      console.log(`✅ All ${storedFramesCount} ${folder.toUpperCase()} frames are already stored.`);
      savedFrames += storedFramesCount;
      if (setProgress) setProgress(savedFrames);
      continue;
    }

    console.log(`⏳ Downloading ${totalFramesInFolder - storedFramesCount} missing ${folder.toUpperCase()} frames.`);

    const fetchAndCacheFrame = async (i) => {
      const frameID = folder === "dropSeq" ? `72000${String(i).padStart(2, "0")}` : `${folder}_${i}`;
      const existingFrame = await db.get("frames", frameID);
      if (existingFrame) return null;

      const fileName = folder === "dropSeq" ? `${frameID}.png` : `${i}.png`;
      const storagePath = `assets/${folder}/${fileName}`;
      const storage = getStorage();
      const fileRef = ref(storage, storagePath);

      try {
        const url = await getDownloadURL(fileRef);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const blob = await response.blob();
        const base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        return { frameID, base64Image };
      } catch (error) {
        console.error(`❌ Failed to load from storage: ${storagePath}`, error);
        return null;
      }
    };

    // Using Promise.all to fetch and cache frames in parallel
    let framesToSave = [];
    for (let i = 1; i <= totalFramesInFolder; i += batchSize) {
      const batchPromises = [...Array(batchSize).keys()]
        .map(offset => i + offset)
        .filter(index => index <= totalFramesInFolder)
        .map(fetchAndCacheFrame);

      const results = await Promise.all(batchPromises);

      framesToSave = framesToSave.concat(results.filter(frame => frame !== null));

      // Save frames in bulk
      if (framesToSave.length > 0) {
        for (const { frameID, base64Image } of framesToSave) {
          await db.put("frames", base64Image, frameID);
          savedFrames++;
          if (setProgress) setProgress(savedFrames);
          console.log(`✅ Stored ${folder}/${frameID}.png`);
        }
        framesToSave = [];
      }
    }
  }

  console.log(`✅ All frames stored.`);
};



// ✅ Function to retrieve images from IndexedDB
export const loadFramesFromIndexedDB = async (folder, totalFrames = 165) => {
  const db = await initDB() // Open IndexedDB
  const frames = []

  for (let i = 1; i <= totalFrames; i++) {
    const frame = await db.get('frames', `${folder}_${i}`)
    if (frame) {
      frames.push(frame) // Store base64 image
    } else {
      console.warn(`⚠️ Missing frame: ${folder}/${i}.png`)
    }
  }

  return frames // Returns an array of base64 PNGs
}

const frameCache = { ltr: [], rtl: [] } // Global cache

export const loadFramesIntoMemory = async (folder) => {
  if (frameCache[folder]?.length > 0) {
    console.log(`✅ Frames already in memory for ${folder}`)
    return frameCache[folder]
  }

  const db = await initDB()
  const frames = []
  const frameCount = folder === 'dropSeq' ? 60 : 165 // ✅ Set correct count

  for (let i = 1; i <= frameCount; i++) {
    const frameID =
      folder === 'dropSeq'
        ? `72000${String(i).padStart(2, '0')}`
        : `${folder}_${i}` // ✅ Ensure correct frame naming

    const frame = await db.get('frames', frameID)
    if (frame) {
      frames.push(frame)
    } else {
      console.warn(`⚠️ Missing frame: ${folder}/${frameID}.png`)
    }
  }

  frameCache[folder] = frames
  console.log(`✅ Loaded ${frames.length} frames into memory for ${folder}`)
  return frames
}

export const getFrames = (folder) => {
  return frameCache[folder] || []
}
