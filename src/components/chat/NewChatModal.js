// src/components/chat/NewChatModal.js
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { getAllUsersExcept } from '../../services/userService';
import './NewChatModal.css';

export default function NewChatModal({ onClose }) {
  const { currentUser } = useAuth();
  const { startChatWithUser } = useChat();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAllUsersExcept(currentUser.uid)
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.uid]);

  const filtered = users.filter((u) =>
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (user) => {
    setStartingId(user.uid);
    try {
      await startChatWithUser(user);
      onClose();
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Chat</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <input
          type="text"
          className="modal-search"
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="modal-user-list">
          {loading && <div className="modal-empty">Loading people…</div>}

          {!loading && filtered.length === 0 && (
            <div className="modal-empty">
              {users.length === 0
                ? 'No other users yet. Invite someone to join!'
                : 'No matches found.'}
            </div>
          )}

          {filtered.map((user) => (
            <button
              key={user.uid}
              type="button"
              className="modal-user-item"
              onClick={() => handleSelect(user)}
              disabled={startingId === user.uid}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="modal-user-avatar" />
              ) : (
                <div className="modal-user-avatar-fallback">
                  {user.displayName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="modal-user-text">
                <span className="modal-user-name">{user.displayName}</span>
                <span className="modal-user-about">{user.about}</span>
              </div>
              {startingId === user.uid && <span className="modal-user-spinner" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}