// src/hooks/useMediaUpload.js
import { useState, useRef, useCallback } from 'react';
import { uploadToCloudinaryCancellable } from '../config/cloudinary';
import { compressImage, getMediaType, validateFileSize } from '../utils/compression';

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const cancelRef = useRef(null);

  const upload = useCallback(async (file, folder = 'chat_media') => {
    setError(null);
    const mediaType = getMediaType(file);

    const sizeError = validateFileSize(file, mediaType);
    if (sizeError) {
      setError(sizeError);
      throw new Error(sizeError);
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileToUpload = mediaType === 'image' ? await compressImage(file) : file;

      const { promise, cancel } = uploadToCloudinaryCancellable(fileToUpload, {
        folder,
        onProgress: setProgress,
      });
      cancelRef.current = cancel;

      const result = await promise;
      return {
        ...result,
        mediaType,
        fileName: file.name,
      };
    } catch (err) {
      setError(err.message || 'Upload failed');
      throw err;
    } finally {
      setUploading(false);
      cancelRef.current = null;
    }
  }, []);

  const cancelUpload = useCallback(() => {
    cancelRef.current?.();
  }, []);

  return { upload, cancelUpload, uploading, progress, error };
}