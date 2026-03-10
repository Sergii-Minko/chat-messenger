import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import AdminChat from './AdminChat';

const API_URL = 'http://localhost:3000';

const AdminDashboard = ({ admin, token, onLogout }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Завантажити список розмов
    loadConversations();

    // Socket.IO підключення для real-time оновлень
    const socketIo = io(API_URL);
    socketIo.on('connect', () => {
      console.log('Admin socket connected');
    });
    socketIo.on('new_message', (msg) => {
      // Оновити список розмов при новому повідомленні
      loadConversations();
      // Якщо це повідомлення у обраній розмові - оновити чат
      if (selectedConv && msg.conversation_id === selectedConv.id) {
        setConversations(prev => prev.map(c =>
          c.id === selectedConv.id ? { ...c, last_message_at: new Date().toISOString() } : c
        ));
      }
    });
    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, [selectedConv]);

  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConv(conv);
  };

  const handleBackToList = () => {
    setSelectedConv(null);
  };

  if (isLoading && conversations.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading conversations...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Admin Panel</h1>
        <div style={styles.adminInfo}>
          <span style={styles.adminName}>{admin.username}</span>
          <button style={styles.logoutBtn} onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={styles.main}>
        {selectedConv ? (
          <AdminChat
            conversation={selectedConv}
            token={token}
            onBack={handleBackToList}
          />
        ) : (
          <div style={styles.convList}>
            <h2 style={styles.listTitle}>
              Active Conversations ({conversations.length})
            </h2>
            {conversations.length === 0 ? (
              <div style={styles.empty}>No active conversations</div>
            ) : (
              <div style={styles.convGrid}>
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    style={styles.convItem}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div style={styles.convHeader}>
                      <span style={styles.convId}>
                        #{conv.id}
                      </span>
                      <span style={styles.msgCount}>
                        {conv.message_count || 0} messages
                      </span>
                    </div>
                    <div style={styles.convCustomer}>
                      Customer: {conv.customer_anon_id?.substring(0, 8)}...
                    </div>
                    <div style={styles.convTime}>
                      {conv.last_message_at
                        ? `Last: ${new Date(conv.last_message_at).toLocaleTimeString('uk-UA')}`
                        : 'No messages yet'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
    fontFamily: 'sans-serif',
  },
  header: {
    background: '#1976d2',
    color: '#fff',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '20px',
  },
  adminInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  adminName: {
    fontWeight: '500',
  },
  logoutBtn: {
    padding: '8px 16px',
    background: '#fff',
    color: '#1976d2',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  main: {
    padding: '24px',
    display: 'flex',
    minHeight: 'calc(100vh - 64px)',
  },
  convList: {
    flex: 1,
    maxWidth: '400px',
    marginRight: '24px',
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  listTitle: {
    margin: '0 0 16px 0',
    color: '#333',
    fontSize: '18px',
  },
  convGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  convItem: {
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  convHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  convId: {
    fontWeight: '600',
    color: '#1976d2',
  },
  msgCount: {
    fontSize: '12px',
    color: '#666',
    background: '#f0f0f0',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  convCustomer: {
    fontSize: '14px',
    color: '#333',
    marginBottom: '4px',
  },
  convTime: {
    fontSize: '12px',
    color: '#888',
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    padding: '40px',
  },
};

export default AdminDashboard;
