import React, { useState, useEffect, useRef } from 'react';
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

const API_URL = 'http://localhost:3000';

const ChatWidget = () => {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Старт чату (або відновлення)
    const startChat = async () => {
      const anonId = localStorage.getItem('chat_anon_id');
      if (!anonId) return;

      try {
        setIsLoading(true);
        const res = await fetch(`${API_URL}/api/conversation/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymous_id: anonId }),
        });
        const data = await res.json();
        setConversationId(data.conversation_id);
        if (data.new_conversation) {
          console.log('✨ Нова розмова створена');
        } else {
          console.log('🔄 Підключено до попередньої розмови');
        }

        // Завантажити історію
        await loadMessages(data.conversation_id);

        // Socket.IO підключення
        socketRef.current = io(API_URL);
        socketRef.current.on('connect', () => {
          console.log('Socket connected');
          socketRef.current.emit('join_conversation', data.conversation_id);
        });
        socketRef.current.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        // Слухати нові повідомлення
        socketRef.current.on('new_message', (msg) => {
          setMessages((prev) => [...prev, msg]);
        });

      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    startChat();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const loadMessages = async (convId) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId) return;

    try {
      // Відправляємо повідомлення на сервер
      await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: inputText,
          sender_type: 'customer',
          sender_id: null,
        }),
      });
      
      // Ми НЕ додаємо newMsg у setMessages тут, 
      // бо воно прийде до нас через socket.on('new_message')
      
      setInputText(''); // Просто очищуємо поле вводу
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  if (isLoading && messages.length === 0) {
    return (
      <div style={styles.loading}>
        📡 Завантаження чату...
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        💬 Підтримка — {conversationId ? 'активно' : 'не підключено'}
      </div>
      <div style={styles.messages}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.msg,
              textAlign: m.sender_type === 'customer' ? 'right' : 'left',
              backgroundColor: m.sender_type === 'customer' ? '#e3f2fd' : '#fff3e0',
            }}
          >
            <div style={styles.msgContent}>{m.content}</div>
            <div style={styles.timestamp}>
              {new Date(m.created_at).toLocaleTimeString('uk-UA')}
            </div>
          </div>
        ))}
      </div>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Напишіть ваше повідомлення..."
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          style={styles.btn}
          disabled={isLoading}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '360px',
    height: '500px',
    border: '1px solid #ccc',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    background: '#fff',
  },
  header: {
    background: '#1976d2',
    color: '#fff',
    padding: '12px 16px',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  messages: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#fafafa',
  },
  msg: {
    padding: '10px 12px',
    borderRadius: '12px',
    maxWidth: '80%',
    display: 'inline-block',
  },
  msgContent: {
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  timestamp: {
    fontSize: '10px',
    color: '#666',
    marginTop: '4px',
    textAlign: 'right',
  },
  inputRow: {
    padding: '10px',
    borderTop: '1px solid #eee',
    display: 'flex',
    gap: '8px',
    background: '#fff',
  },
  input: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '14px',
  },
  btn: {
    padding: '8px 12px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#666',
  },
};

export default ChatWidget;
