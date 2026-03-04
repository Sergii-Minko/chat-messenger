# 🛒 Месенджер для інтернет-магазину (з збереженням історії)

**Зберігає діалоги** — після перезавантаження клієнт повертається до тієї ж розмови.

---

## 📁 Структура проекту

chat-messenger/ ├── backend/ # Node.js сервер + Socket.IO + PostgreSQL ├── frontend/ # React-віджет (Single Page) └── README.md # Цей файл

---

## 🚀 Як запустити

### 1. Передумови

- Node.js ≥ v18
- PostgreSQL ≥ v14
- git

### 2. Налаштування БД

Створіть базу даних:

```bash
psql -U postgres -c "CREATE DATABASE chatdb;"
Запустіть схему:

cd backend
psql -U postgres -d chatdb -f schema.sql
3. Запуск бекенду
cd backend
npm install
cp .env.example .env  # або створіть .env вручну
npm start
→ Сервер буде на http://localhost:3000

4. Запуск фронтенду (React)
cd frontend
npm install
npm start
→ Відкриється http://localhost:3001

```
