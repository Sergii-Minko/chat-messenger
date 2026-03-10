-- Створити БД (якщо потрібно)
-- CREATE DATABASE chatdb;

-- Таблиця клієнтів
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    anonymous_id VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця діалогів
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'open',
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекс для прискорення пошуку активних чатів
CREATE INDEX IF NOT EXISTS idx_conversations_customer_status ON conversations(customer_id, status);

-- Таблиця повідомлень
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('customer', 'admin')),
    sender_id INT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекс для сортування повідомлень
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- Таблиця адміністраторів
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекс для швидкого пошуку користувача
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
