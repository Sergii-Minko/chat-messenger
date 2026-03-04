import React, { useState, useEffect } from 'react';
import ChatWidget from './ChatWidget';

const API_URL = 'http://localhost:3000';

const App = () => {
  const [anonymousId, setAnonymousId] = useState(null);

  useEffect(() => {
    // Отримати або створити anonymous_id
    const init = async () => {
      try {
        const headers = {};
        const storedId = localStorage.getItem('chat_anon_id');
        if (storedId) headers['X-Anonymous-Id'] = storedId;

        const res = await fetch(`${API_URL}/api/init`, {
          method: 'GET',
          headers: storedId ? headers : undefined,
        });

        let anonId = res.headers.get('X-Anonymous-Id');
        if (!anonId) {
          anonId = storedId || crypto.randomUUID();
        }
        localStorage.setItem('chat_anon_id', anonId);
        setAnonymousId(anonId);

        console.log('✅ Anonymous ID:', anonId);
      } catch (err) {
        console.error('Init error:', err);
      }
    };
    init();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '40px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        🛒 Чат підтримки інтернет-магазину
      </h1>

      {anonymousId ? (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.9em', color: '#666' }}>
            Ваш ID: <code>{anonymousId}</code>
          </p>
          <ChatWidget />
        </div>
      ) : (
        <p style={{ textAlign: 'center', marginTop: '50px' }}>Завантаження...</p>
      )}
    </div>
  );
};

export default App;
