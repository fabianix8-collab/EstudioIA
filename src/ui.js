// ============================================================================
// src/ui.js — Funciones de UI: toast, theme, sidebar, formateo de mensajes
// ============================================================================

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

let currentTheme = 'dark';
export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  const icon = currentTheme === 'dark' ? '☀️' : '🌙';
  document.getElementById('theme-icon').textContent = icon;
  const icon2 = document.getElementById('theme-icon2');
  if (icon2) icon2.textContent = icon;
}

export function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('mobile-open');
}

export function toast(msg, type = 'success') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

export function setUserUI(user) {
  const initials = (user.name || user.email || '?').charAt(0).toUpperCase();
  document.getElementById('selector-avatar').textContent  = initials;
  document.getElementById('selector-username').textContent = (user.name || user.email || 'Usuario').split(' ')[0];
  document.getElementById('chat-avatar').textContent       = initials;
  document.getElementById('chat-username').textContent     = user.name || user.email || 'Usuario';
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

export function scrollToBottom() {
  const msgs = document.getElementById('messages');
  requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
}

export function formatMessage(text) {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang || 'text'}">${code.trimEnd()}</code></pre>`
  );
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const lines = escaped.split('\n');
  let result = '';
  let inPre = false;
  for (const line of lines) {
    if (line.includes('<pre>')) inPre = true;
    if (line.includes('</pre>')) inPre = false;
    result += (!inPre && line.trim() === '') ? '<br>' : line + (inPre ? '\n' : ' ');
  }
  return result;
}

export function appendMessage(role, content, user, currentRamo) {
  const msgs = document.getElementById('messages');
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.className = 'message' + (isUser ? ' user' : '');
  const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const avatarText = isUser
    ? (user?.name?.charAt(0)?.toUpperCase() || 'T')
    : (currentRamo?.icon || 'IA');
  const avatarClass = isUser ? '' : 'ai';
  div.innerHTML = `
    <div class="msg-avatar ${avatarClass}">${avatarText}</div>
    <div class="msg-body">
      <div class="msg-bubble">${formatMessage(content)}</div>
      <div class="msg-time">${time}</div>
    </div>
  `;
  const typingMsg = document.getElementById('typing-msg');
  msgs.insertBefore(div, typingMsg);
}

export function renderHistory(items, currentSessionId) {
  const list = document.getElementById('history-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="history-empty">Aún no hay conversaciones.<br>¡Empieza preguntando algo!</div>';
    return;
  }

  const sessions = {};
  items.forEach(m => {
    const sid = m.session_id || 'default';
    if (!sessions[sid]) sessions[sid] = { messages: [], first_at: m.created_at };
    sessions[sid].messages.push(m);
    if (new Date(m.created_at) < new Date(sessions[sid].first_at)) {
      sessions[sid].first_at = m.created_at;
    }
  });

  const sortedSessions = Object.entries(sessions)
    .sort((a, b) => new Date(b[1].first_at) - new Date(a[1].first_at));

  list.innerHTML = sortedSessions.map(([sid, sess]) => {
    const firstUserMsg = sess.messages.find(m => m.rol === 'user');
    if (!firstUserMsg) return '';
    const title = firstUserMsg.contenido.length > 50
      ? firstUserMsg.contenido.substring(0, 50) + '…'
      : firstUserMsg.contenido;
    const date = new Date(sess.first_at);
    const now  = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const timeStr = diffDays === 0
      ? 'Hoy · ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : diffDays === 1 ? 'Ayer'
      : date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    const msgCount = Math.floor(sess.messages.length / 2);
    const isActive = sid === currentSessionId;
    return `
      <div class="history-item${isActive ? ' history-item-active' : ''}" onclick="window._loadSession('${sid}')">
        <div class="history-item-title">${title}</div>
        <div class="history-item-meta">${timeStr} · ${msgCount} intercambio${msgCount !== 1 ? 's' : ''}</div>
        <button class="history-item-delete" onclick="window._deleteSession(event,'${sid}')" title="Borrar conversación">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;
  }).join('');
}
