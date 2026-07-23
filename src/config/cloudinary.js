// src/config/cloudinary.js
// Cloudinary is used for ALL binary media (images, videos, documents, voice notes).
// We never touch Firebase Storage. Uploads use an UNSIGNED preset so no backend/API
// secret is needed — the preset itself enforces folder/type/size restrictions on
// Cloudinary's side (configure that when you create the preset in step below).

const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

if (process.env.NODE_ENV === 'development') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    // eslint-disable-next-line no-console
    console.error(
      '[cloudinary.js] Missing REACT_APP_CLOUDINARY_CLOUD_NAME or REACT_APP_CLOUDINARY_UPLOAD_PRESET in .env.local'
    );
  }
}

// Cloudinary's generic "auto" upload endpoint accepts images, video, audio, and raw
// files (pdf, docx, etc.) and routes them internally — one endpoint for everything.
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

/**
 * Uploads a File/Blob to Cloudinary with progress reporting.
 * Uses XMLHttpRequest instead of fetch specifically because fetch has no
 * native upload-progress event — and a progress bar is a hard requirement here.
 *
 * @param {File|Blob} file - the file to upload (already compressed by the caller)
 * @param {Object} options
 * @param {string} [options.folder] - Cloudinary folder, e.g. `chats/${chatId}`
 * @param {(percent: number) => void} [options.onProgress] - 0-100
 * @returns {Promise<{url: string, publicId: string, resourceType: string, format: string, bytes: number, duration?: number, width?: number, height?: number}>}
 */
export function uploadToCloudinary(file, options = {}) {
  const { folder, onProgress } = options;

  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('uploadToCloudinary: no file provided'));
      return;
    }
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error('Cloudinary is not configured. Check .env.local'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    if (folder) formData.append('folder', folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            publicId: data.public_id,
            resourceType: data.resource_type, // 'image' | 'video' | 'raw'
            format: data.format,
            bytes: data.bytes,
            duration: data.duration, // present for video/audio
            width: data.width,
            height: data.height,
          });
        } catch (err) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData?.error?.message || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(formData);
  });
}

/**
 * Returns an AbortController-friendly cancel handle by wrapping uploadToCloudinary
 * with an xhr reference the caller can abort. Used by the media preview UI's
 * "cancel upload" button.
 */
export function uploadToCloudinaryCancellable(file, options = {}) {
  const { folder, onProgress } = options;
  const xhr = new XMLHttpRequest();

  const promise = new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error('Cloudinary is not configured. Check .env.local'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    if (folder) formData.append('folder', folder);

    xhr.open('POST', UPLOAD_URL, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          resourceType: data.resource_type,
          format: data.format,
          bytes: data.bytes,
          duration: data.duration,
          width: data.width,
          height: data.height,
        });
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(formData);
  });

  return { promise, cancel: () => xhr.abort() };
}

export const CLOUDINARY_CLOUD_NAME = CLOUD_NAME;