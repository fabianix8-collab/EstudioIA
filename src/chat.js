// ============================================================================
// src/chat.js — Lógica del chat: envío de mensajes, historial, sesiones
// ============================================================================
import { APP } from './config.js';
import { callLLM, saveMessage, loadHistory, loadSession, deleteSession } from './api.js';
import { RAMOS } from './ramos.js';
import {
  showScreen, toast, scrollToBottom, appendMessage,
  renderHistory, autoResize,
} from './ui.js';

// ---------------------------------------------------------------------------
// Abrir un ramo (tutor)
// ---------------------------------------------------------------------------
export function openRamo(id) {
  const ramo = RAMOS.find(r => r.id === id);
  if (!ramo) return;

  APP.currentRamo = ramo;
  APP.messages    = [];
  APP.sessionId   = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  showScreen('screen-chat');

  setTimeout(() => {
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
    set('sidebar-ramo-name', ramo.name);
    set('chat-ramo-pill', ramo.icon + ' ' + ramo.name);
    set('welcome-icon',   ramo.icon);
    set('welcome-title',  'Tutor de ' + ramo.name);
    set('welcome-sub',    'Soy tu tutor especializado. ¡Pregúntame lo que quieras sobre ' + ramo.name + '!');

    const chipHtml = ramo.chips.map(c =>
      `<button class="chip" onclick="window._sendChip('${c.replace(/'/g, "\\'")}')">${c}</button>`
    ).join('');
    const wc = document.getElementById('welcome-chips'); if (wc) wc.innerHTML = chipHtml;
    const ic = document.getElementById('input-chips');   if (ic) ic.innerHTML = chipHtml;

    const msgs        = document.getElementById('messages');
    const welcomeState = document.getElementById('welcome-state');
    const typingMsg   = document.getElementById('typing-msg');
    if (msgs && welcomeState) {
      msgs.innerHTML = '';
      welcomeState.style.display = '';
      msgs.appendChild(welcomeState);
      if (typingMsg) msgs.appendChild(typingMsg);
    }

    const st = document.getElementById('sidebar-toggle');
    if (st && window.innerWidth <= 768) st.style.display = 'flex';

    refreshHistory();
  }, 0);
}

// ---------------------------------------------------------------------------
// Enviar mensaje
// ---------------------------------------------------------------------------
export async function sendMessage(text) {
  const input = document.getElementById('chat-input');
  const msg   = text || input.value.trim();
  if (!msg || !APP.currentRamo) return;

  input.value = '';
  autoResize(input);

  document.getElementById('welcome-state').style.display = 'none';
  appendMessage('user', msg, APP.user, APP.currentRamo);
  APP.messages.push({ role: 'user', parts: [{ text: msg }] });
  saveMessage('user', msg, APP.currentRamo.id);

  const tm = document.getElementById('typing-msg');
  if (tm) tm.style.display = 'flex';
  document.getElementById('send-btn').disabled = true;
  scrollToBottom();

  try {
    const systemMsg = { role: 'user', parts: [{ text: APP.currentRamo.prompt }] };
    const systemAck = { role: 'model', parts: [{ text: 'Entendido. Estoy listo para ayudarte con ' + APP.currentRamo.name + '. ¿En qué puedo ayudarte?' }] };
    const recent    = APP.messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: m.parts,
    }));
    const allMessages = [systemMsg, systemAck, ...recent];

    const response = await callLLM(allMessages);

    if (tm) tm.style.display = 'none';
    document.getElementById('send-btn').disabled = false;

    APP.messages.push({ role: 'assistant', parts: [{ text: response }] });
    appendMessage('ai', response, APP.user, APP.currentRamo);
    saveMessage('assistant', response, APP.currentRamo.id);
    refreshHistory();
    scrollToBottom();
  } catch (e) {
    if (tm) tm.style.display = 'none';
    document.getElementById('send-btn').disabled = false;
    appendMessage('ai', '❌ Error al obtener respuesta: ' + e.message, APP.user, APP.currentRamo);
    scrollToBottom();
  }
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------
export async function refreshHistory() {
  if (!APP.currentRamo) return;
  const items = await loadHistory(APP.currentRamo.id);
  renderHistory(items, APP.sessionId);
}

export async function openSession(sessionId) {
  if (!APP.user || APP.isDemoMode) return;
  const data = await loadSession(sessionId);
  if (!data || data.length === 0) return;

  APP.sessionId = sessionId;
  APP.messages  = [];

  const msgs        = document.getElementById('messages');
  const welcomeState = document.getElementById('welcome-state');
  const typingMsg   = document.getElementById('typing-msg');
  msgs.innerHTML = '';
  if (welcomeState) { welcomeState.style.display = 'none'; msgs.appendChild(welcomeState); }
  if (typingMsg) msgs.appendChild(typingMsg);

  data.forEach(m => {
    appendMessage(m.rol === 'user' ? 'user' : 'ai', m.contenido, APP.user, APP.currentRamo);
    APP.messages.push({ role: m.rol, parts: [{ text: m.contenido }] });
  });

  scrollToBottom();
  refreshHistory();
}

export async function removeSession(event, sessionId) {
  event.stopPropagation();
  if (!APP.user || APP.isDemoMode) return;
  if (!confirm('¿Borrar esta conversación?')) return;

  const wasActive = sessionId === APP.sessionId;
  await deleteSession(sessionId);
  if (wasActive) nuevaConversacion();
  refreshHistory();
}

export function nuevaConversacion() {
  APP.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  APP.messages  = [];

  const msgs        = document.getElementById('messages');
  const welcomeState = document.getElementById('welcome-state');
  const typingMsg   = document.getElementById('typing-msg');
  msgs.innerHTML = '';
  if (welcomeState) { welcomeState.style.display = ''; msgs.appendChild(welcomeState); }
  if (typingMsg) msgs.appendChild(typingMsg);

  refreshHistory();
  document.getElementById('chat-input')?.focus();
}

export function clearChat() {
  APP.messages = [];
  const msgs = document.getElementById('messages');
  msgs.innerHTML = '';
  const ws = document.getElementById('welcome-state');
  if (ws) { ws.style.display = ''; msgs.appendChild(ws); }
  const tm = document.getElementById('typing-msg');
  if (tm) msgs.appendChild(tm);
  toast('Chat limpiado', 'success');
}
