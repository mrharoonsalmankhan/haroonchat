// src/utils/compression.js
import imageCompression from 'browser-image-compression';

/**
 * Compresses an image client-side before upload. Videos/audio/docs pass
 * through untouched — Cloudinary's free tier already applies its own
 * optimization on delivery, so we only need to shrink upload size/time
 * for the one file type where it's cheap and safe to do in-browser: images.
 */
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file;

  // GIFs lose animation when run through canvas-based compression — skip them.
  if (file.type === 'image/gif') return file;

  const options = {
    maxSizeMB: 1.2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.8,
  };

  try {
    const compressed = await imageCompression(file, options);
    // Preserve the original filename — the library sometimes renames.
    return new File([compressed], file.name, { type: compressed.type });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[compression.js] Image compression failed, using original file:', error);
    return file;
  }
}

export function getMediaType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

// Hard limits enforced client-side before we even attempt an upload —
// Cloudinary's free plan caps individual file size, and large files
// would also blow the RTDB write budget for message metadata.
export const MAX_FILE_SIZE_BYTES = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 20 * 1024 * 1024, // 20MB
  document: 20 * 1024 * 1024, // 20MB
};

export function validateFileSize(file, mediaType) {
  const limit = MAX_FILE_SIZE_BYTES[mediaType] || MAX_FILE_SIZE_BYTES.document;
  if (file.size > limit) {
    return `File too large. Max size for ${mediaType} is ${formatBytes(limit)}.`;
  }
  return null;
}