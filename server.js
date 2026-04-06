const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// ========== VAPID КЛЮЧИ (ЗАМЕНИ НА СВОИ!) ==========
const vapidKeys = {
  publicKey: 'BMywqffpmkeZHkDoFVoeceb8ryw9_cWj71oaYir-CjTXVeSgqMT_glOU3JWANun1hdGA0bR6Nrf9RE2fD9he7f0',
  privateKey: 'c-0Pi0JGCN2McVBlkYOgKiFAwwHHqSQAGas9JrNUPrc'
};

webpush.setVapidDetails(
  'mailto:jrserg0@gmail.com', // Замени на свой email
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ========== ХРАНИЛИЩЕ ПОДПИСОК ==========
let subscriptions = [];

// ========== EXPRESS НАСТРОЙКИ ==========
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

// ========== ЭНДПОИНТЫ ДЛЯ PUSH-ПОДПИСОК ==========
app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  console.log('✅ Новая подписка сохранена');
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  console.log('❌ Подписка удалена');
  res.status(200).json({ message: 'Подписка удалена' });
});

// ========== SOCKET.IO ==========
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Клиент подключён:', socket.id);

  // Обработка события 'newTask' от клиента
  socket.on('newTask', (task) => {
    console.log('📝 Новая задача:', task.text);

    // Рассылаем событие ВСЕМ подключённым клиентам
    io.emit('taskAdded', task);

    // Отправляем push-уведомления всем подписанным клиентам
    const payload = JSON.stringify({
      title: 'Новая задача',
      body: task.text
    });

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('❌ Ошибка push:', err);
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Клиент отключён:', socket.id);
  });
});

// ========== ЗАПУСК СЕРВЕРА ==========
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});