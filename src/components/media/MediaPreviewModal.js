// src/components/media/MediaPreviewModal.js
import React, { useState, useMemo } from 'react';
import { getMediaType, formatBytes } from '../../utils/compression';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useChat } from '../../contexts/ChatContext';
import './MediaPreviewModal.css';

export default function MediaPreviewModal({ file, onClose }) {
  const { sendMediaMessage } = useChat();
  const { upload, cancelUpload, uploading, progress, error: uploadError } = useMediaUpload();
  const [caption, setCaption] = useState('');
  const [sendError, setSendError] = useState(null);

  const mediaType = useMemo(() => getMediaType(file), [file]);
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const error = sendError || uploadError;

  const handleSend = async () => {
    setSendError(null);
    try {
      const result = await upload(file, 'chat_media');
      await sendMediaMessage({
        type: mediaType,
        mediaUrl: result.url,
        mediaMeta: {
          bytes: result.bytes,
          fileName: file.name,
          width: result.width,
          height: result.height,
          duration: result.duration,
        },
        text: caption.trim(),
      });
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MediaPreviewModal] Failed to send media message:', err);
      setSendError(err.message || 'Failed to send. Please try again.');
    }
  };

  const handleCancel = () => {
    if (uploading) cancelUpload();
    URL.revokeObjectURL(previewUrl);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={!uploading ? handleCancel : undefined}>
      <div className="media-preview-card" onClick={(e) => e.stopPropagation()}>
        <div className="media-preview-header">
          <span>Send {mediaType}</span>
          <button type="button" className="icon-btn" onClick={handleCancel} disabled={uploading}>
            ✕
          </button>
        </div>

        <div className="media-preview-body">
          {mediaType === 'image' && <img src={previewUrl} alt="" className="preview-media" />}
          {mediaType === 'video' && (
            <video src={previewUrl} controls className="preview-media" />
          )}
          {mediaType === 'audio' && <audio src={previewUrl} controls className="preview-audio" />}
          {mediaType === 'document' && (
            <div className="preview-document">
              <span className="preview-document-icon">📄</span>
              <span className="preview-document-name">{file.name}</span>
              <span className="preview-document-size">{formatBytes(file.size)}</span>
            </div>
          )}
        </div>

        {uploading && (
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {error && <p className="media-preview-error">{error}</p>}

        <div className="media-preview-footer">
          <input
            type="text"
            className="media-caption-input"
            placeholder="Add a caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={uploading}
          />
          <button
            type="button"
            className="send-btn"
            onClick={handleSend}
            disabled={uploading}
          >
            {uploading ? `${progress}%` : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}