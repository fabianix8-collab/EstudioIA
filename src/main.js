// ============================================================================
// src/main.js — Punto de entrada: inicialización y conexión de eventos
// ============================================================================
// Este archivo reemplaza el bloque <script type="module"> del index.html
// original. Orquesta los módulos sin contener lógica de negocio.
// ============================================================================
import { APP } from './config.js';
import { RAMOS } from './ramos.js';
import { initFirebase, loginWithGoogle, loginWithEmail, registerWithEmail, logout } from './auth.js';
import { showScreen, toast, toggleTheme, toggleSidebar, showLoginError, setUserUI, autoResize } from './ui.js';
import { openRamo, sendMessage, nuevaConversacion, clearChat, openSession, removeSession } from './chat.js';

// ---------------------------------------------------------------------------
// SELECTOR DE RAMOS
// ---------------------------------------------------------------------------
function loadSelector() {
  const grid = document.getElementById('ramos-grid');
  if (!grid) return;
  grid.innerHTML = RAMOS.map(r => `
    <div class="ramo-card" style="--card-accent-color: ${r.accent}" onclick="window._openRamo('${r.id}')">
      <div class="ramo-icon">${r.icon}</div>
      <div class="ramo-name">${r.name}</div>
      <div class="ramo-desc">${r.desc}</div>
      <div class="ramo-badge">Tutor IA</div>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------------
// AUTH HANDLERS
// ---------------------------------------------------------------------------
async function handleLoginGoogle() {
  if (!window._fbSignInGoogle) { toast('Firebase no configurado', 'error'); handleLoginDemo(); return; }
  try {
    const user = await loginWithGoogle();
    setUser(user);
    showScreen('screen-selector');
    loadSelector();
  } catch (e) {
    showLoginError('Error Google: ' + e.message);
  }
}

async function handleLoginEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showLoginError('Ingresa email y contraseña'); return; }
  if (!window._fbSignInEmail) { showLoginError('Firebase no configurado'); handleLoginDemo(); return; }
  try {
    const user = await loginWithEmail(email, pass);
    setUser(user);
    showScreen('screen-selector');
    loadSelector();
  } catch (e) {
    const code = e.code || '';
    showLoginError(
      code === 'auth/wrong-password'  ? 'Contraseña incorrecta' :
      code === 'auth/user-not-found'  ? 'Usuario no encontrado' :
      'Error: ' + e.message
    );
  }
}

async function handleRegisterEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showLoginError('Ingresa email y contraseña para crear cuenta'); return; }
  if (pass.length < 6) { showLoginError('La contraseña debe tener al menos 6 caracteres'); return; }
  if (!window._fbCreateUser) { showLoginError('Firebase no configurado'); return; }
  try {
    const user = await registerWithEmail(email, pass);
    setUser(user);
    const ok = document.getElementById('login-success');
    if (ok) { ok.textContent = '✅ Cuenta creada exitosamente'; ok.classList.add('visible'); }
    setTimeout(() => { showScreen('screen-selector'); loadSelector(); }, 800);
  } catch (e) {
    showLoginError('Error al crear cuenta: ' + (e.code === 'auth/email-already-in-use' ? 'Email ya registrado' : e.message));
  }
}

function handleLoginDemo() {
  APP.isDemoMode = true;
  setUser({ uid: 'demo_' + Date.now(), email: 'demo@estudioia.cl', name: 'Demo User' });
  showScreen('screen-selector');
  loadSelector();
}

async function handleLogout() {
  await logout();
  showScreen('screen-login');
}

function setUser(user) {
  APP.user = user;
  setUserUI(user);
}

// ---------------------------------------------------------------------------
// INIT — punto de entrada de la app
// ---------------------------------------------------------------------------
async function init() {
  showScreen('screen-login');

  // Inicializar Firebase
  try {
    const user = await initFirebase(
      'AIzaSyBmXhtOfVfqy0SjA94EYw_TV7T2fpo7ToM',
      'estudioia-duoc-e7a45.firebaseapp.com',
      'estudioia-duoc-e7a45'
    );
    if (user) {
      setUser({ uid: user.uid, email: user.email, name: user.displayName || user.email, photo: user.photoURL });
      showScreen('screen-selector');
      loadSelector();
    }
  } catch (e) {
    console.warn('Firebase init:', e);
  }

  // Ocultar loading
  setTimeout(() => {
    const overlay = document.getElementById('loading');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    }
  }, 600);
}

// ---------------------------------------------------------------------------
// Exponer funciones al HTML (onclick="...")
// ---------------------------------------------------------------------------
window.loginGoogle     = handleLoginGoogle;
window.loginEmail      = handleLoginEmail;
window.registerEmail   = handleRegisterEmail;
window.loginDemo       = handleLoginDemo;
window.logout          = handleLogout;
window.toggleTheme     = toggleTheme;
window.toggleSidebar   = toggleSidebar;
window.handleEnter     = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
window.autoResize      = autoResize;
window.sendMessage     = sendMessage;
window.nuevaConversacion = nuevaConversacion;
window.clearChat       = clearChat;
window.showScreen      = showScreen;

// Usados desde renderHistory en ui.js
window._openRamo      = openRamo;
window._sendChip      = sendMessage;
window._loadSession   = openSession;
window._deleteSession = removeSession;

init();
