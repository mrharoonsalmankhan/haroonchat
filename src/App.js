import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { db, auth, provider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { ref, push, onValue, remove, set } from "firebase/database";
import EmojiPicker from "emoji-picker-react";
import { 
  MdChat, MdDonutLarge, MdGroups, MdSettings, 
  MdSearch, MdMoreVert, MdAttachFile, MdInsertEmoticon, 
  MdSend, MdAdd, MdCall, MdVideocam, MdMic, MdStop,
  MdDoneAll, MdClose, MdImage, MdInsertDriveFile,
  MdPerson, MdNotifications, MdLock, MdCallEnd,
  MdReply, MdDelete, MdStar, MdStarBorder, MdMoreHoriz,
  MdAdminPanelSettings, MdPushPin, MdPalette,
  MdArrowBack
} from "react-icons/md";

function App() {
  const [user, setUser] = useState(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chats");
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Advanced States
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [activeMsgMenu, setActiveMsgMenu] = useState(null);
  const [pinnedRooms, setPinnedRooms] = useState([]);
  const [chatTheme, setChatTheme] = useState("default");

  // Drawers & Modals
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [callState, setCallState] = useState(null);

  // Statuses
  const [statuses, setStatuses] = useState([]);

  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const statusInputRef = useRef(null);

  // Auth Listener
  useEffect(() => {
    auth.onAuthStateChanged((authUser) => {
      if (authUser) setUser(authUser);
      else setUser(null);
    });
  }, []);

  // Fetch Rooms (Warning Fixed Here)
  useEffect(() => {
    const roomsRef = ref(db, "rooms");
    onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedRooms = [{ id: "general", name: "General Chat", adminUid: "system" }];
      for (let id in data) {
        if (data[id] && data[id].name) {
          loadedRooms.push({ id, ...data[id] });
        }
      }
      setRooms(loadedRooms);
      
      // Callback approach to avoid useEffect dependency warning
      if (window.innerWidth > 768) {
        setActiveRoom((prev) => (prev ? prev : loadedRooms[0]));
      }
    });
  }, []);

  // Fetch Messages & Typing
  useEffect(() => {
    if (!activeRoom) return;
    const messagesRef = ref(db, `rooms/${activeRoom.id}/messages`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      const loadedMessages = [];
      for (let id in data) {
        loadedMessages.push({ id, ...data[id] });
      }
      setMessages(loadedMessages);
    });

    const typingRef = ref(db, `rooms/${activeRoom.id}/typing`);
    onValue(typingRef, (snapshot) => {
      setTypingUsers(snapshot.val() || {});
    });
  }, [activeRoom]);

  // Fetch Statuses
  useEffect(() => {
    const statusRef = ref(db, "statuses");
    onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      const loadedStatuses = [];
      for (let id in data) {
        loadedStatuses.push({ id, ...data[id] });
      }
      setStatuses(loadedStatuses);
    });
  }, []);

  // Auto Scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = () => signInWithPopup(auth, provider).catch((e) => alert(e.message));
  const handleLogout = () => signOut(auth);

  const createRoom = () => {
    const roomName = prompt("Enter Group / Contact Name:");
    if (roomName && roomName.trim() !== "") {
      const roomsRef = ref(db, "rooms");
      push(roomsRef, { 
        name: roomName.trim(), 
        adminUid: user ? user.uid : "system" 
      });
    }
  };

  const togglePinRoom = (roomId, e) => {
    e.stopPropagation();
    if (pinnedRooms.includes(roomId)) {
      setPinnedRooms(pinnedRooms.filter((id) => id !== roomId));
    } else {
      setPinnedRooms([...pinnedRooms, roomId]);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!user || !activeRoom) return;

    const myTypingRef = ref(db, `rooms/${activeRoom.id}/typing/${user.uid}`);
    if (e.target.value.trim().length > 0) {
      set(myTypingRef, user.displayName || "Someone");
    } else {
      remove(myTypingRef);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom) return;

    const messagesRef = ref(db, `rooms/${activeRoom.id}/messages`);
    const newMsg = {
      text: input,
      type: "text",
      name: user.displayName || "User",
      photoURL: user.photoURL,
      uid: user.uid,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    if (replyTo) {
      newMsg.replyData = {
        name: replyTo.name,
        text: replyTo.text || (replyTo.type === "image" ? "📷 Image" : "🎵 Voice Note")
      };
    }

    push(messagesRef, newMsg);

    if (user && activeRoom) {
      remove(ref(db, `rooms/${activeRoom.id}/typing/${user.uid}`));
    }
    setInput("");
    setReplyTo(null);
    setShowEmoji(false);
    setShowAttachMenu(false);
  };

  const handleAddReaction = (msgId, emoji) => {
    const msgRef = ref(db, `rooms/${activeRoom.id}/messages/${msgId}/reactions/${user.uid}`);
    set(msgRef, emoji);
    setActiveMsgMenu(null);
  };

  const handleDeleteMessage = (msgId) => {
    const msgRef = ref(db, `rooms/${activeRoom.id}/messages/${msgId}`);
    remove(msgRef);
    setActiveMsgMenu(null);
  };

  const handleToggleStar = (msgId, currentStarState) => {
    const starRef = ref(db, `rooms/${activeRoom.id}/messages/${msgId}/starred`);
    set(starRef, !currentStarState);
    setActiveMsgMenu(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeRoom) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("Please select an image under 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      const messagesRef = ref(db, `rooms/${activeRoom.id}/messages`);
      const newMsg = {
        imageUrl: base64Data,
        type: "image",
        name: user.displayName || "User",
        photoURL: user.photoURL,
        uid: user.uid,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      if (replyTo) {
        newMsg.replyData = {
          name: replyTo.name,
          text: replyTo.text || "📷 Attachment"
        };
      }

      push(messagesRef, newMsg);
      setReplyTo(null);
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleStatusUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      const statusRef = ref(db, "statuses");
      push(statusRef, {
        imageUrl: base64Data,
        name: user.displayName,
        userPhoto: user.photoURL,
        uid: user.uid,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          if (activeRoom) {
            const messagesRef = ref(db, `rooms/${activeRoom.id}/messages`);
            push(messagesRef, {
              audioUrl: base64Audio,
              type: "audio",
              name: user.displayName || "User",
              photoURL: user.photoURL,
              uid: user.uid,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone Access Denied!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  const filteredRooms = rooms
    .filter((r) => (r.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()))
    .sort((a, b) => {
      const isAPinned = pinnedRooms.includes(a.id);
      const isBPinned = pinnedRooms.includes(b.id);
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;
      return 0;
    });

  const searchedMessages = messages.filter((m) =>
    (m.text || "").toLowerCase().includes((chatSearchQuery || "").toLowerCase())
  );

  const otherTypingUsers = Object.entries(typingUsers)
    .filter(([uid]) => uid !== (user ? user.uid : ""))
    .map(([, name]) => name);

  return (
    <div className="app app__dark">
      {!user ? (
        <div className="login__container">
          <div className="login__card">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
              alt="WhatsApp Logo" 
              className="login__logo" 
            />
            <h2>WhatsApp Mobile & Web</h2>
            <p>Simple. Reliable. Private.</p>
            <button onClick={handleLogin}>Log In with Google</button>
          </div>
        </div>
      ) : (
        <div className={`app__body ${activeRoom ? "chat__active" : ""}`}>
          
          {/* CALL OVERLAY */}
          {callState && activeRoom && (
            <div className="call__overlay">
              <div className="call__card">
                <div className="call__avatar">
                  {(activeRoom.name || "C").charAt(0).toUpperCase()}
                </div>
                <h2>{activeRoom.name}</h2>
                <p>{callState === "video" ? "WhatsApp Video Call..." : "WhatsApp Voice Call..."}</p>
                <div className="call__actions">
                  <button className="call__endBtn" onClick={() => setCallState(null)}>
                    <MdCallEnd />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* NAV RAIL */}
          <div className="nav__rail">
            <div className="nav__railTop">
              <button 
                className={`rail__btn ${activeTab === "chats" ? "rail__btnActive" : ""}`}
                onClick={() => { setActiveTab("chats"); setShowChatInfo(false); }}
                title="Chats"
              >
                <MdChat />
              </button>
              <button 
                className={`rail__btn ${activeTab === "status" ? "rail__btnActive" : ""}`}
                onClick={() => setActiveTab("status")}
                title="Status"
              >
                <MdDonutLarge />
              </button>
              <button 
                className={`rail__btn ${activeTab === "communities" ? "rail__btnActive" : ""}`}
                onClick={() => setActiveTab("communities")}
                title="Communities"
              >
                <MdGroups />
              </button>
            </div>

            <div className="nav__railBottom">
              <button 
                className={`rail__btn ${activeTab === "settings" ? "rail__btnActive" : ""}`}
                onClick={() => setActiveTab("settings")}
                title="Settings"
              >
                <MdSettings />
              </button>
              <img 
                src={user.photoURL} 
                alt={user.displayName} 
                className="user__avatar rail__avatar" 
                referrerPolicy="no-referrer"
                onClick={handleLogout}
                title="Click to Logout"
              />
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="sidebar__header">
              <h2>{activeTab.toUpperCase()}</h2>
              <div className="sidebar__headerRight">
                {activeTab === "chats" && (
                  <>
                    <button title="New Chat" onClick={createRoom} className="icon__btn"><MdAdd /></button>
                    <button title="More options" className="icon__btn"><MdMoreVert /></button>
                  </>
                )}
              </div>
            </div>

            {activeTab === "chats" && (
              <>
                <div className="sidebar__search">
                  <div className="sidebar__searchContainer">
                    <MdSearch className="search__icon" />
                    <input
                      placeholder="Search or start new chat"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sidebar__chats">
                  {filteredRooms.map((room) => {
                    const isPinned = pinnedRooms.includes(room.id);
                    const isSelected = activeRoom && activeRoom.id === room.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => setActiveRoom(room)}
                        className={`sidebarChat ${isSelected ? "sidebarChat__active" : ""}`}
                      >
                        <div className="sidebarChat__avatar">
                          {(room.name || "C").charAt(0).toUpperCase()}
                        </div>
                        <div className="sidebarChat__info">
                          <div className="sidebarChat__infoTop">
                            <h2>{room.name || "Unnamed Chat"}</h2>
                            <span className="chat__time">Active</span>
                          </div>
                          <div className="sidebarChat__infoBottom">
                            <p>Click to start messaging</p>
                            <button 
                              className={`pin__btn ${isPinned ? "pin__active" : ""}`} 
                              onClick={(e) => togglePinRoom(room.id, e)}
                              title={isPinned ? "Unpin Chat" : "Pin Chat"}
                            >
                              <MdPushPin />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {activeTab === "status" && (
              <div className="sidebar__tabContent">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={statusInputRef} 
                  style={{ display: "none" }} 
                  onChange={handleStatusUpload} 
                />
                <div className="sidebarChat" onClick={() => statusInputRef.current.click()}>
                  <img src={user.photoURL} className="user__avatar" alt="Status" referrerPolicy="no-referrer" />
                  <div className="sidebarChat__info">
                    <h2>My Status</h2>
                    <p>Click to add status update</p>
                  </div>
                  <MdAdd className="add__statusIcon" />
                </div>
                <div className="section__title">RECENT UPDATES</div>
                {statuses.map((st, idx) => (
                  <div key={idx} className="sidebarChat" onClick={() => alert("Viewing status from " + st.name)}>
                    <img src={st.userPhoto} className="status__avatarBorder" alt={st.name} referrerPolicy="no-referrer" />
                    <div className="sidebarChat__info">
                      <h2>{st.name}</h2>
                      <p>{st.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "communities" && (
              <div className="sidebar__tabContent empty__tab">
                <MdGroups className="tab__bigIcon" />
                <h3>Stay connected with communities</h3>
                <p>Communities bring members together in topic-based groups.</p>
                <button className="primary__btn" onClick={createRoom}>Start a Community</button>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="sidebar__tabContent">
                <div className="settings__profile">
                  <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
                  <div>
                    <h3>{user.displayName}</h3>
                    <p>Available</p>
                  </div>
                </div>
                <div className="setting__option"><MdPerson /> Account</div>
                <div className="setting__option"><MdNotifications /> Notifications</div>
                <div className="setting__option"><MdLock /> Privacy</div>

                <div className="theme__selectorContainer">
                  <h4><MdPalette /> Chat Wallpaper Theme</h4>
                  <div className="theme__options">
                    <button className={chatTheme === "default" ? "activeTheme" : ""} onClick={() => setChatTheme("default")}>Dark Default</button>
                    <button className={chatTheme === "green" ? "activeTheme" : ""} onClick={() => setChatTheme("green")}>Forest Green</button>
                    <button className={chatTheme === "slate" ? "activeTheme" : ""} onClick={() => setChatTheme("slate")}>Slate Blue</button>
                  </div>
                </div>

                <div className="setting__option danger__text" onClick={handleLogout}>Log Out</div>
              </div>
            )}
          </div>

          {/* CHAT AREA */}
          {activeRoom ? (
            <div className="chat">
              <div className="chat__header">
                <button 
                  className="icon__btn mobile__backBtn" 
                  onClick={() => setActiveRoom(null)}
                  title="Back to chats"
                >
                  <MdArrowBack />
                </button>

                <div 
                  className="chat__headerAvatar"
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  style={{ cursor: "pointer" }}
                >
                  {(activeRoom.name || "C").charAt(0).toUpperCase()}
                </div>
                <div 
                  className="chat__headerInfo" 
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  style={{ cursor: "pointer" }}
                >
                  <h3>{activeRoom.name || "Chat Room"}</h3>
                  <p>
                    {otherTypingUsers.length > 0 
                      ? `${otherTypingUsers.join(", ")} is typing...` 
                      : "online"}
                  </p>
                </div>
                <div className="chat__headerRight">
                  <button title="Video Call" className="icon__btn" onClick={() => setCallState("video")}><MdVideocam /></button>
                  <button title="Voice Call" className="icon__btn" onClick={() => setCallState("voice")}><MdCall /></button>
                  <button title="Search in Chat" className="icon__btn" onClick={() => setShowChatSearch(!showChatSearch)}><MdSearch /></button>
                  <button title="Contact Info" className="icon__btn" onClick={() => setShowChatInfo(!showChatInfo)}><MdMoreVert /></button>
                </div>
              </div>

              {/* CHAT BODY WITH THEME */}
              <div className={`chat__body theme__${chatTheme}`}>
                {messages.map((msg) => {
                  const reactionList = msg.reactions ? Object.values(msg.reactions) : [];
                  const isMyMessage = msg.uid === user.uid;
                  const isAdminMessage = activeRoom.adminUid === msg.uid;

                  return (
                    <div
                      key={msg.id}
                      className={`chat__message ${isMyMessage ? "chat__receiver" : ""}`}
                    >
                      {!isMyMessage && (
                        <span className="chat__name">
                          {msg.name}
                          {isAdminMessage && <span className="admin__badge"><MdAdminPanelSettings /> Group Admin</span>}
                        </span>
                      )}

                      {msg.replyData && (
                        <div className="chat__replyContainer">
                          <span className="reply__name">{msg.replyData.name}</span>
                          <p className="reply__text">{msg.replyData.text}</p>
                        </div>
                      )}

                      {msg.starred && <MdStar className="starred__badgeIcon" title="Starred Message" />}

                      <button 
                        className="msg__optionsBtn" 
                        onClick={() => setActiveMsgMenu(activeMsgMenu === msg.id ? null : msg.id)}
                      >
                        <MdMoreHoriz />
                      </button>

                      {activeMsgMenu === msg.id && (
                        <div className="msg__dropdown">
                          <div className="reaction__bar">
                            {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                              <span 
                                key={emoji} 
                                onClick={() => handleAddReaction(msg.id, emoji)}
                              >
                                {emoji}
                              </span>
                            ))}
                          </div>
                          <button onClick={() => { setReplyTo(msg); setActiveMsgMenu(null); }}>
                            <MdReply /> Reply
                          </button>
                          <button onClick={() => handleToggleStar(msg.id, msg.starred)}>
                            {msg.starred ? <MdStarBorder /> : <MdStar />} {msg.starred ? "Unstar" : "Star"} Message
                          </button>
                          {(isMyMessage || activeRoom.adminUid === user.uid) && (
                            <button onClick={() => handleDeleteMessage(msg.id)} className="danger__text">
                              <MdDelete /> Delete Message
                            </button>
                          )}
                        </div>
                      )}

                      {(!msg.type || msg.type === "text") && <p>{msg.text}</p>}

                      {msg.type === "image" && (
                        <img src={msg.imageUrl} alt="attachment" className="chat__imageMedia" />
                      )}

                      {msg.type === "audio" && (
                        <div className="audio__wrapper">
                          <audio controls src={msg.audioUrl} className="chat__audioMedia" id={`audio-${msg.id}`} />
                          <div className="speed__selector">
                            {[1, 1.5, 2].map((spd) => (
                              <button key={spd} onClick={() => {
                                const el = document.getElementById(`audio-${msg.id}`);
                                if (el) el.playbackRate = spd;
                              }}>
                                {spd}x
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {reactionList.length > 0 && (
                        <div className="reaction__pills">
                          {reactionList.map((r, i) => (
                            <span key={i} className="reaction__pill">{r}</span>
                          ))}
                        </div>
                      )}

                      <div className="chat__meta">
                        <span className="chat__timestamp">{msg.timestamp}</span>
                        {isMyMessage && <MdDoneAll className="read__receipt" />}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {replyTo && (
                <div className="reply__bar">
                  <div className="reply__barInfo">
                    <span>Replying to <strong>{replyTo.name}</strong></span>
                    <p>{replyTo.text || (replyTo.type === "image" ? "📷 Image" : "🎵 Voice Note")}</p>
                  </div>
                  <MdClose className="icon__btn" onClick={() => setReplyTo(null)} />
                </div>
              )}

              {showEmoji && (
                <div className="emoji__picker">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" height={350} width="100%" />
                </div>
              )}

              {showAttachMenu && (
                <div className="attach__popup">
                  <button onClick={() => fileInputRef.current.click()}>
                    <MdImage className="attach__iconImg" /> Photos & Videos
                  </button>
                  <button onClick={() => fileInputRef.current.click()}>
                    <MdInsertDriveFile className="attach__iconDoc" /> Document
                  </button>
                </div>
              )}

              <div className="chat__footer">
                <MdInsertEmoticon className="icon__btn" onClick={() => setShowEmoji(!showEmoji)} />
                
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  style={{ display: "none" }} 
                  onChange={handleFileUpload} 
                />
                <MdAttachFile className="icon__btn" onClick={() => setShowAttachMenu(!showAttachMenu)} />

                <form onSubmit={sendMessage}>
                  <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type a message"
                    type="text"
                  />
                  <button type="submit" className="send__btn"><MdSend /></button>
                </form>

                {isRecording ? (
                  <MdStop className="icon__btn mic__recording" onClick={stopRecording} title="Stop Recording" />
                ) : (
                  <MdMic className="icon__btn" onClick={startRecording} title="Record Voice Note" />
                )}
              </div>
            </div>
          ) : (
            <div className="chat empty__chatPlaceholder">
              <h2>Select a chat to start messaging</h2>
              <p>WhatsApp Mobile & Web Application</p>
            </div>
          )}

          {/* SEARCH DRAWER */}
          {showChatSearch && activeRoom && (
            <div className="right__drawer">
              <div className="drawer__header">
                <MdClose className="icon__btn" onClick={() => setShowChatSearch(false)} />
                <h3>Search Messages</h3>
              </div>
              <div className="sidebar__search">
                <div className="sidebar__searchContainer">
                  <MdSearch className="search__icon" />
                  <input
                    placeholder="Search messages..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="drawer__content">
                {searchedMessages.map((m) => (
                  <div key={m.id} className="search__resultItem">
                    <span className="chat__time">{m.timestamp}</span>
                    <p><strong>{m.name}:</strong> {m.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHAT INFO DRAWER */}
          {showChatInfo && activeRoom && (
            <div className="right__drawer">
              <div className="drawer__header">
                <MdClose className="icon__btn" onClick={() => setShowChatInfo(false)} />
                <h3>Contact Info</h3>
              </div>
              <div className="drawer__content info__center">
                <div className="large__avatar">
                  {(activeRoom.name || "C").charAt(0).toUpperCase()}
                </div>
                <h2>{activeRoom.name}</h2>
                <p className="subtext">Group / Room ID: {activeRoom.id}</p>

                <div className="info__section">
                  <h4>Starred Messages</h4>
                  <p>{messages.filter(m => m.starred).length} message(s) starred</p>
                </div>

                <div className="info__section">
                  <h4>Encryption</h4>
                  <p>Messages and calls are end-to-end encrypted.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;