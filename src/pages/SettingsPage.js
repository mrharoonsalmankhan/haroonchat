// src/pages/SettingsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediaUpload } from '../hooks/useMediaUpload';
import {
  updateProfile,
  updatePrivacySettings,
  updateNotificationSettings,
  unblockUser,
  getAllUsersExcept,
} from '../services/userService';
import './SettingsPage.css';

const VISIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My Contacts' },
  { value: 'nobody', label: 'Nobody' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile, signOut } = useAuth();
  const { upload, uploading } = useMediaUpload();

  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [saved, setSaved] = useState(false);
  const [blockedUsersList, setBlockedUsersList] = useState([]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setAbout(userProfile.about || '');
    }
  }, [userProfile]);

  useEffect(() => {
    const blockedIds = Object.keys(userProfile?.blockedUsers || {});
    if (blockedIds.length === 0) {
      setBlockedUsersList([]);
      return;
    }
    getAllUsersExcept(currentUser.uid).then((all) => {
      setBlockedUsersList(all.filter((u) => blockedIds.includes(u.uid)));
    });
  }, [userProfile?.blockedUsers, currentUser.uid]);

  const privacy = userProfile?.settings?.privacy || {};
  const notifications = userProfile?.settings?.notifications || {};

  const handleSaveProfile = async () => {
    await updateProfile(currentUser.uid, { displayName: displayName.trim(), about: about.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload(file, 'avatars');
      await updateProfile(currentUser.uid, { photoURL: result.url });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Avatar upload failed:', err);
    }
    e.target.value = '';
  };

  const handlePrivacyChange = (field, value) => {
    updatePrivacySettings(currentUser.uid, { [field]: value });
  };

  const handleNotificationToggle = (field) => {
    updateNotificationSettings(currentUser.uid, { [field]: !notifications[field] });
  };

  const handleUnblock = (uid) => {
    unblockUser(currentUser.uid, uid);
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" className="icon-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings-body">
        {/* Profile */}
        <section className="settings-section">
          <h2>Profile</h2>
          <div className="settings-avatar-row">
            <div className="settings-avatar-wrap">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="" className="settings-avatar" />
              ) : (
                <div className="settings-avatar-fallback">{displayName[0]?.toUpperCase() || '?'}</div>
              )}
              <label className="settings-avatar-edit">
                {uploading ? '…' : '📷'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </label>
            </div>
            <div className="settings-fields">
              <label className="settings-label">
                Name
                <input
                  type="text"
                  className="settings-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                />
              </label>
              <label className="settings-label">
                About
                <input
                  type="text"
                  className="settings-input"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={140}
                />
              </label>
            </div>
          </div>
          <button type="button" className="primary-btn" onClick={handleSaveProfile}>
            {saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </section>

        {/* Privacy */}
        <section className="settings-section">
          <h2>Privacy</h2>
          {[
            { field: 'lastSeenVisibleTo', label: 'Last Seen' },
            { field: 'photoVisibleTo', label: 'Profile Photo' },
            { field: 'aboutVisibleTo', label: 'About' },
          ].map(({ field, label }) => (
            <div className="settings-row" key={field}>
              <span>{label}</span>
              <select
                className="settings-select"
                value={privacy[field] || 'everyone'}
                onChange={(e) => handlePrivacyChange(field, e.target.value)}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="settings-row">
            <span>Read Receipts</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={privacy.readReceipts !== false}
                onChange={() => handlePrivacyChange('readReceipts', !(privacy.readReceipts !== false))}
              />
              <span className="settings-toggle-slider" />
            </label>
          </div>
        </section>

        {/* Notifications */}
        <section className="settings-section">
          <h2>Notifications</h2>
          <div className="settings-row">
            <span>Message Preview</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={notifications.messagePreview !== false}
                onChange={() => handleNotificationToggle('messagePreview')}
              />
              <span className="settings-toggle-slider" />
            </label>
          </div>
          <div className="settings-row">
            <span>Sound</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={notifications.sound !== false}
                onChange={() => handleNotificationToggle('sound')}
              />
              <span className="settings-toggle-slider" />
            </label>
          </div>
        </section>

        {/* Blocked users */}
        <section className="settings-section">
          <h2>Blocked Users</h2>
          {blockedUsersList.length === 0 && <p className="settings-empty">No blocked users.</p>}
          {blockedUsersList.map((u) => (
            <div className="settings-row" key={u.uid}>
              <div className="settings-blocked-user">
                {u.photoURL ? (
                  <img src={u.photoURL} alt="" className="settings-blocked-avatar" />
                ) : (
                  <div className="settings-blocked-avatar-fallback">{u.displayName?.[0]?.toUpperCase()}</div>
                )}
                <span>{u.displayName}</span>
              </div>
              <button type="button" className="text-btn" onClick={() => handleUnblock(u.uid)}>
                Unblock
              </button>
            </div>
          ))}
        </section>

        <section className="settings-section">
          <button type="button" className="danger-btn" onClick={signOut}>
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
}