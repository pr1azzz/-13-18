// ========== ПОДКЛЮЧЕНИЕ К СЕРВЕРУ (SOCKET.IO) ==========
const socket = io('http://localhost:3001');

// ========== DOM ЭЛЕМЕНТЫ ==========
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАМЕТКАМИ ==========
function loadNotes() {
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  const notesList = document.getElementById('notes-list');
  if (notesList) {
    notesList.innerHTML = notes.map(note => `<li>📌 ${note.text || note}</li>`).join('');
  }
}

function addNote(text) {
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  const newNote = { id: Date.now(), text: text, datetime: new Date().toLocaleString() };
  notes.push(newNote);
  localStorage.setItem('notes', JSON.stringify(notes));
  loadNotes();

  // 🚀 ОТПРАВЛЯЕМ СОБЫТИЕ ЧЕРЕЗ WEBSOCKET
  socket.emit('newTask', { text: text });
}

function initNotes() {
  const form = document.getElementById('note-form');
  const input = document.getElementById('note-input');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        addNote(text);
        input.value = '';
      }
    });
  }
  loadNotes();
}

// ========== ПОЛУЧЕНИЕ СОБЫТИЙ ОТ ДРУГИХ КЛИЕНТОВ ==========
socket.on('taskAdded', (task) => {
  console.log('📢 Задача от другого клиента:', task);
  
  // Показываем всплывающее уведомление в приложении
  const notification = document.createElement('div');
  notification.textContent = `✨ Новая задача: ${task.text}`;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #4285f4;
    color: white;
    padding: 1rem;
    border-radius: 8px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
});

// ========== PUSH-УВЕДОМЛЕНИЯ ==========
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ВАШ ПУБЛИЧНЫЙ VAPID КЛЮЧ (из терминала)
const VAPID_PUBLIC_KEY = 'BMywqffpmkeZHkDoFVoeceb8ryw9_cWj71oaYir-CjTXVeSgqMT_glOU3JWANun1hdGA0bR6Nrf9RE2fD9he7f0';

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push не поддерживается');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    console.log('✅ Подписка на push отправлена');
  } catch (err) {
    console.error('❌ Ошибка подписки:', err);
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await fetch('http://localhost:3001/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
    await subscription.unsubscribe();
    console.log('❌ Отписка выполнена');
  }
}

// ========== НАВИГАЦИЯ (APP SHELL) ==========
function setActiveButton(activeId) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
  try {
    const response = await fetch(`content/${page}.html`);
    const html = await response.text();
    contentDiv.innerHTML = html;
    
    if (page === 'home') {
      initNotes();
    }
  } catch (err) {
    contentDiv.innerHTML = '<p class="is-center text-error">❌ Ошибка загрузки страницы</p>';
    console.error(err);
  }
}

// ========== РЕГИСТРАЦИЯ SERVICE WORKER И КНОПКИ PUSH ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker зарегистрирован:', registration.scope);
      
      const enableBtn = document.getElementById('enable-push');
      const disableBtn = document.getElementById('disable-push');
      
      if (enableBtn && disableBtn) {
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          enableBtn.style.display = 'none';
          disableBtn.style.display = 'inline-block';
        }
        
        enableBtn.addEventListener('click', async () => {
          if (Notification.permission === 'denied') {
            alert('⚠️ Уведомления запрещены. Разрешите их в настройках браузера.');
            return;
          }
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              alert('⚠️ Необходимо разрешить уведомления.');
              return;
            }
          }
          await subscribeToPush();
          enableBtn.style.display = 'none';
          disableBtn.style.display = 'inline-block';
        });
        
        disableBtn.addEventListener('click', async () => {
          await unsubscribeFromPush();
          disableBtn.style.display = 'none';
          enableBtn.style.display = 'inline-block';
        });
      }
    } catch (err) {
      console.error('❌ Ошибка регистрации SW:', err);
    }
  });
}

// ========== ЗАГРУЗКА СТАРТОВОЙ СТРАНИЦЫ ==========
homeBtn.addEventListener('click', () => {
  setActiveButton('home-btn');
  loadContent('home');
});

aboutBtn.addEventListener('click', () => {
  setActiveButton('about-btn');
  loadContent('about');
});

loadContent('home');