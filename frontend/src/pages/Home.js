import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import {
  getFriendRequests,
  getFriends,
  updateFriendRequest,
  getCurrentUser,
  getGroups,
  leaveGroup,
  deleteGroup,
} from '../services/api';
import EditGroup from './EditGroup';
import Profile from './Profile';
import CreateGroup from './CreateGroup';
import Friends from './Friends';
import Settings from './Settings';
import '../css/Home.css';

const socket = io('http://localhost:5000');

const Home = ({ onLogout, setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [searchedGroups, setSearchedGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMessageOptions, setShowMessageOptions] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState({});
  const [showEmojiReactions, setShowEmojiReactions] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: userData } = await getCurrentUser();
        setUser(userData);

        const { data: requests } = await getFriendRequests();
        setFriendRequests(requests || []);

        const { data: friendsData } = await getFriends();
        setFriends(friendsData || []);

        const { data: groupsData } = await getGroups();
        setGroups(groupsData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        if (err.response && err.response.status === 401) {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          navigate('/login');
        } else if (err.response && err.response.status === 404) {
          console.log('API không tồn tại. Vui lòng kiểm tra backend.');
          setFriendRequests([]);
          setFriends([]);
          setGroups([]);
          setUser(null);
        } else {
          setFriendRequests([]);
          setFriends([]);
          setGroups([]);
          setUser(null);
        }
      }
    };
    fetchData();
  }, [navigate, setIsAuthenticated]);

  useEffect(() => {
    if (selectedChat && user) {
      // Tạo roomId nhất quán với backend
      const roomId = selectedChat.isGroup
        ? selectedChat._id
        : [user._id, selectedChat._id].sort().join('-');
      socket.emit('joinRoom', roomId);

      const fetchMessages = async () => {
        try {
          const response = await fetch(`http://localhost:5000/api/messages/${selectedChat._id}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
          const data = await response.json();
          setMessages(data || []);
        } catch (err) {
          console.error('Error fetching messages:', err);
        }
      };
      fetchMessages();

      socket.on('receiveMessage', (message) => {
        console.log('Received message via socket:', {
          id: message._id,
          content: message.content,
          senderId: message.senderId?._id,
          userId: user._id,
        });
        setMessages((prev) => {
          // Kiểm tra xem tin nhắn đã tồn tại chưa
          const exists = prev.some((msg) => msg._id === message._id);
          // Chỉ thêm nếu chưa tồn tại và không phải của người dùng hiện tại
          if (!exists && message.senderId?._id !== user._id) {
            return [...prev, message];
          }
          return prev;
        });
      });

      socket.on('messageRecalled', () => {
        // Không làm gì, buộc người dùng reload trang
      });

      socket.on('messageEdited', () => {
        // Không làm gì, buộc người dùng reload trang
      });

      return () => {
        socket.off('receiveMessage');
        socket.off('messageRecalled');
        socket.off('messageEdited');
      };
    }
  }, [selectedChat, user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const handleAddFriend = () => {
    setCurrentView('friends');
    setSelectedChat(null);
    setSelectedGroup(null);
    setSelectedProfile(null);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const handleProfileInfo = () => {
    setSelectedProfile(user);
    setSelectedChat(null);
    setSelectedGroup(null);
    setCurrentView('chat');
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
    setIsProfileDropdownOpen(false);
  };

  const handleCreateGroupPage = () => {
    setCurrentView('create-group');
    setSelectedChat(null);
    setSelectedGroup(null);
    setSelectedProfile(null);
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await updateFriendRequest(requestId, 'accepted');
      setFriendRequests(friendRequests.filter((req) => req._id !== requestId));
      const { data: friendsData } = await getFriends();
      setFriends(friendsData || []);
      alert('Đã chấp nhận lời mời!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Chấp nhận lời mời thất bại.');
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await updateFriendRequest(requestId, 'declined');
      setFriendRequests(friendRequests.filter((req) => req._id !== requestId));
      alert('Đã từ chối lời mời!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Từ chối lời mời thất bại.');
    }
  };

  const handleSearchGroups = () => {
    if (!searchGroupQuery.trim()) {
      setSearchedGroups([]);
      return;
    }

    const lowerQuery = searchGroupQuery.toLowerCase();
    const filteredFriends = friends
      .filter((friend) => friend.name.toLowerCase().includes(lowerQuery))
      .map((friend) => ({ ...friend, type: 'friend' }));
    const filteredGroups = groups
      .filter((group) => group.name.toLowerCase().includes(lowerQuery))
      .map((group) => ({ ...group, type: 'group' }));
    const combinedResults = [...filteredFriends, ...filteredGroups];
    setSearchedGroups(combinedResults);
  };

  // Removed unused handleJoinGroup function to resolve the error.

  const handleLeaveGroup = async (groupId) => {
    try {
      await leaveGroup(groupId);
      setGroups(groups.filter((group) => group._id !== groupId));
      setSelectedGroup(null);
      setSelectedChat(null);
      alert('Rời nhóm thành công!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Rời nhóm thất bại.');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      await deleteGroup(groupId);
      setGroups(groups.filter((group) => group._id !== groupId));
      setSelectedGroup(null);
      setSelectedChat(null);
      alert('Xóa nhóm thành công!');
    } catch (err) {
      console.error('Error deleting group:', err);
      alert(err.response?.data?.msg || 'Xóa nhóm thất bại. Vui lòng thử lại.');
    }
  };

  const handleShowGroupInfo = (group) => {
    setSelectedGroup(group);
    setSelectedChat(null);
    setSelectedProfile(null);
    setCurrentView('chat');
  };

  const handleSelectChat = (chat, isGroup = false) => {
    setSelectedChat({ ...chat, isGroup });
    setSelectedGroup(null);
    setSelectedProfile(null);
    setCurrentView('chat');
  };

  const handleShowProfile = (userId) => {
    const friend = friends.find((f) => f._id === userId);
    if (friend) {
      setSelectedProfile(friend);
      setSelectedChat(null);
      setSelectedGroup(null);
      setCurrentView('chat');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() && !file) return;

    // Tạo tin nhắn tạm thời với ID duy nhất
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      _id: tempId,
      senderId: user,
      content: message,
      type: file ? (file.type.startsWith('image') ? 'image' : 'video') : 'text',
      createdAt: new Date().toISOString(),
      isRecalled: false,
    };

    // Thêm tin nhắn tạm thời
    setMessages((prev) => [...prev, tempMessage]);

    const formData = new FormData();
    formData.append('receiverId', selectedChat._id);
    formData.append('content', message);
    formData.append('isGroup', selectedChat.isGroup);
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage = await response.json();
      console.log('New message from server:', newMessage);

      // Thay thế tin nhắn tạm thời bằng tin nhắn thực
      setMessages((prev) => {
        // Lọc bỏ tin nhắn tạm thời
        const filtered = prev.filter((msg) => msg._id !== tempId);
        // Kiểm tra xem tin nhắn thực đã tồn tại chưa
        const exists = filtered.some((msg) => msg._id === newMessage._id);
        if (!exists) {
          return [...filtered, { ...newMessage, senderId: user }]; // Gán senderId để đảm bảo hiển thị bên phải
        }
        return filtered;
      });

      setMessage('');
      setFile(null);
      setPreview(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Error sending message:', err);
      // Xóa tin nhắn tạm thời nếu thất bại
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
    }
  };

  const recallMessage = async (messageId) => {
    try {
      await fetch(`http://localhost:5000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, isRecalled: true } : msg
        )
      );
      setShowMessageOptions(null);
    } catch (err) {
      console.error('Error recalling message:', err);
    }
  };

  const editMessage = async (messageId, newContent) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, content: newContent } : msg
        )
      );
      setShowMessageOptions(null);
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    }
  };

  const removePreview = () => {
    setFile(null);
    setPreview(null);
    URL.revokeObjectURL(preview);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const handleEmojiSelect = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleMessageOptions = (messageId) => {
    setShowMessageOptions(messageId === showMessageOptions ? null : messageId);
  };

  const handleEmojiReaction = (messageId, emoji) => {
    setSelectedEmoji((prev) => ({
      ...prev,
      [messageId]: emoji,
    }));
    setShowEmojiReactions(null);
  };

  const toggleEmojiReactions = (messageId) => {
    setShowEmojiReactions(messageId === showEmojiReactions ? null : messageId);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="home-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>Zalor</h1>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Tìm kiếm bạn bè hoặc nhóm"
              value={searchGroupQuery}
              onChange={(e) => setSearchGroupQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchGroups()}
            />
            <button onClick={handleSearchGroups}>Tìm</button>
          </div>
          {searchedGroups.length > 0 && (
            <div className="search-results">
              <h4>Kết quả tìm kiếm:</h4>
              {searchedGroups.map((item) => (
                <div
                  key={item._id}
                  className={`friend-item ${
                    selectedChat && selectedChat._id === item._id ? 'active' : ''
                  }`}
                >
                  {item.type === 'friend' ? (
                    <div
                      className="friend-info"
                      onClick={() => handleSelectChat(item, false)}
                    >
                      <img
                        src={item.avatar || 'https://via.placeholder.com/30'}
                        alt="Avatar"
                        className="friend-avatar"
                      />
                      <span>{item.name || 'Không xác định'}</span>
                    </div>
                  ) : (
                    <div className="group-info">
                      <div
                        className="group-info-content"
                        onClick={() => handleSelectChat(item, true)}
                      >
                        <img
                          src={item.avatar || 'https://via.placeholder.com/30'}
                          alt="Group Avatar"
                          className="friend-avatar"
                        />
                        <span>{item.name || 'Tên nhóm không xác định'}</span>
                      </div>
                      <button
                        className="info-button"
                        onClick={() => handleShowGroupInfo(item)}
                      >
                        ...
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="tabs">
            <button className="friend-request-text" onClick={toggleDropdown}>
              Lời mời kết bạn {friendRequests.length > 0 && `(${friendRequests.length})`}
            </button>
            <button className="active">Tất cả</button>
          </div>
        </div>
        <div className="sidebar-content">
          <div className="friend-requests">
            <div className="dropdown">
              {isDropdownOpen && (
                <div className="dropdown-content">
                  {friendRequests.length > 0 ? (
                    friendRequests.map((request) => (
                      <div key={request._id} className="request-item">
                        <div className="request-info">
                          <img
                            src={request.from?.avatar || 'https://via.placeholder.com/30'}
                            alt="Avatar"
                            className="request-avatar"
                          />
                          <span>{request.from?.name || 'Không xác định'}</span>
                        </div>
                        <div className="request-actions">
                          <button onClick={() => handleAcceptRequest(request._id)}>
                            Đồng ý
                          </button>
                          <button onClick={() => handleDeclineRequest(request._id)}>
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>Chưa có lời mời kết bạn nào.</p>
                  )}
                </div>
              )}
            </div>
            <div className="section-header">
              <h3>BẠN BÈ</h3>
              <button className="add-button" onClick={handleAddFriend}>
                +
              </button>
            </div>
            <div className="friends-list">
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <div
                    key={friend._id}
                    className={`friend-item ${
                      selectedChat && selectedChat._id === friend._id ? 'active' : ''
                    }`}
                    onClick={() => handleSelectChat(friend, false)}
                  >
                    <img
                      src={friend.avatar || 'https://via.placeholder.com/30'}
                      alt="Avatar"
                      className="friend-avatar"
                    />
                    <span>{friend.name || 'Không xác định'}</span>
                  </div>
                ))
              ) : (
                <p>Chưa có bạn bè nào.</p>
              )}
            </div>
          </div>
          <div className="groups">
            <div className="section-header">
              <h3>NHÓM</h3>
              <button className="add-button" onClick={handleCreateGroupPage}>
                +
              </button>
            </div>
            <div className="groups-list">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div
                    key={group._id}
                    className={`friend-item ${
                      selectedChat && selectedChat._id === group._id ? 'active' : ''
                    }`}
                  >
                    <div
                      className="group-info"
                      onClick={() => handleSelectChat(group, true)}
                    >
                      <img
                        src={
                          group.avatar
                            ? group.avatar
                            : 'https://via.placeholder.com/30'
                        }
                        alt="Group Avatar"
                        className="friend-avatar"
                      />
                      <span>{group.name || 'Tên nhóm không xác định'}</span>
                    </div>
                    <button
                      className="info-button"
                      onClick={() => handleShowGroupInfo(group)}
                    >
                      ...
                    </button>
                  </div>
                ))
              ) : (
                <p>Bạn chưa tham gia nhóm nào.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="chat-header">
          <div className="chat-header-info">
            {selectedChat && !selectedProfile && currentView === 'chat' && (
              <>
                <img
                  src={selectedChat.avatar || 'https://via.placeholder.com/40'}
                  alt="Avatar"
                  className="chat-header-avatar"
                />
                <h2
                  onClick={() => {
                    if (!selectedChat.isGroup) {
                      handleShowProfile(selectedChat._id);
                    }
                  }}
                  style={{ cursor: selectedChat.isGroup ? 'default' : 'pointer' }}
                >
                  {selectedChat.name}
                </h2>
              </>
            )}
            {selectedProfile && currentView === 'chat' && (
              <>
                <img
                  src={selectedProfile.avatar || 'https://via.placeholder.com/40'}
                  alt="Avatar"
                  className="chat-header-avatar"
                />
                <h2>{selectedProfile.name}</h2>
              </>
            )}
            {currentView === 'create-group' && <h2>Tạo nhóm mới</h2>}
            {currentView === 'friends' && <h2>Tìm kiếm bạn bè</h2>}
          </div>
          <div className="profile-dropdown">
            <img
              src={user?.avatar || 'https://via.placeholder.com/40'}
              alt="Avatar"
              className="profile-avatar"
              onClick={toggleProfileDropdown}
            />
            {isProfileDropdownOpen && (
              <div className="profile-dropdown-content">
                <div className="profile-options">
                  <span className="icon profile-icon" onClick={handleProfileInfo}>
                    👤
                  </span>
                  <span className="icon settings-icon" onClick={handleSettings}>
                    ⚙️
                  </span>
                  <span className="icon logout-icon" onClick={handleLogout}>
                    🚪
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="chat-container">
          <div className="chat-area">
            {currentView === 'create-group' ? (
              <CreateGroup
                onBack={() => setCurrentView('chat')}
                onSuccess={() => {
                  getGroups().then(({ data }) => setGroups(data || []));
                  setCurrentView('chat');
                }}
              />
            ) : currentView === 'friends' ? (
              <Friends
                onBack={() => setCurrentView('chat')}
                onSuccess={() => {
                  getFriends().then(({ data }) => setFriends(data || []));
                  setCurrentView('chat');
                }}
              />
            ) : selectedProfile ? (
              <Profile userId={selectedProfile._id} currentUser={user} />
            ) : selectedGroup ? (
              <EditGroup
                group={selectedGroup}
                user={user}
                onLeaveGroup={handleLeaveGroup}
                onDeleteGroup={handleDeleteGroup}
                onUpdateGroup={(updatedGroup) => {
                  setGroups(groups.map((group) => (group._id === updatedGroup._id ? updatedGroup : group)));
                  setSelectedGroup(updatedGroup);
                }}
              />
            ) : selectedChat ? (
              <div className="chat-box">
                <div className="messages">
                  {messages.map((msg) => (
                    <div
                      key={msg._id}
                      className={`message ${
                        msg.senderId?._id === user?._id ? 'sent' : 'received'
                      }`}
                    >
                      {msg.senderId?._id !== user?._id && (
                        <img
                          src={msg.senderId.avatar || 'https://via.placeholder.com/30'}
                          alt="Avatar"
                          className="message-avatar"
                        />
                      )}
                      <div className="message-content">
                        {msg.senderId?._id !== user?._id && (
                          <span className="message-sender">{msg.senderId.name}</span>
                        )}
                        {msg.isRecalled ? (
                          <p className="recalled-message">Tin nhắn đã bị thu hồi</p>
                        ) : (
                          <>
                            {msg.type === 'text' && <p>{msg.content}</p>}
                            {msg.type === 'image' && (
                              <img src={msg.content} alt="Sent" className="message-media" />
                            )}
                            {msg.type === 'video' && (
                              <video controls src={msg.content} className="message-media" />
                            )}
                            {msg.type === 'emoji' && <p>{msg.content}</p>}
                            <div className="message-footer">
                              <span className="message-time">{formatTime(msg.createdAt)}</span>
                              {selectedEmoji[msg._id] && (
                                <span className="message-emoji-reaction">
                                  {selectedEmoji[msg._id]} 1
                                </span>
                              )}
                              <div className="message-reaction">
                                <button
                                  className="like-button"
                                  onClick={() => toggleEmojiReactions(msg._id)}
                                >
                                  👍
                                </button>
                                {showEmojiReactions === msg._id && (
                                  <div className="emoji-reaction-picker">
                                    <button onClick={() => handleEmojiReaction(msg._id, '👍')}>
                                      👍
                                    </button>
                                    <button onClick={() => handleEmojiReaction(msg._id, '❤️')}>
                                      ❤️
                                    </button>
                                    <button onClick={() => handleEmojiReaction(msg._id, '😂')}>
                                      😂
                                    </button>
                                    <button onClick={() => handleEmojiReaction(msg._id, '😮')}>
                                      😮
                                    </button>
                                    <button onClick={() => handleEmojiReaction(msg._id, '😢')}>
                                      😢
                                    </button>
                                    <button onClick={() => handleEmojiReaction(msg._id, '😡')}>
                                      😡
                                    </button>
                                  </div>
                                )}
                              </div>
                              {msg.senderId?._id === user?._id && (
                                <div className="message-options">
                                  <button onClick={() => handleMessageOptions(msg._id)}>...</button>
                                  {showMessageOptions === msg._id && (
                                    <div className="chat-message-options-dropdown">
                                      <button onClick={() => recallMessage(msg._id)}>Thu hồi</button>
                                      <button
                                        onClick={() =>
                                          editMessage(
                                            msg._id,
                                            prompt('Nhập nội dung mới:', msg.content)
                                          )
                                        }
                                      >
                                        Chỉnh sửa
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="message-input">
                  <button className="icon-button" onClick={toggleEmojiPicker}>
                    😊
                  </button>
                  {showEmojiPicker && (
                    <div className="emoji-picker">
                      <EmojiPicker onEmojiClick={handleEmojiSelect} />
                    </div>
                  )}
                  <button className="icon-button">📷</button>
                  <input
                    type="file"
                    id="file-upload"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                  />
                  <label htmlFor="file-upload" className="icon-button">
                    📎
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button className="send-button" onClick={sendMessage}>
                    ➤
                  </button>
                </div>
                {preview && (
                  <div className="preview-container">
                    {file.type.startsWith('image') ? (
                      <img src={preview} alt="Preview" className="preview-media" />
                    ) : (
                      <video src={preview} controls className="preview-media" />
                    )}
                    <button className="remove-preview" onClick={removePreview}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p>Chọn một cuộc trò chuyện để bắt đầu.</p>
            )}
          </div>
          {showSettingsModal && (
            <Settings
              setIsAuthenticated={setIsAuthenticated}
              onClose={() => setShowSettingsModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;