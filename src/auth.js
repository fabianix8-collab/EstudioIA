// ============================================================================
// src/auth.js — Autenticación con Firebase
// ============================================================================
import { APP } from './config.js';

let fbAuth = null;
let fbGoogleProvider = null;

export async function initFirebase(fbApiKey, fbAuthDomain, fbProjectId) {
  if (!fbApiKey) return false;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const {
      getAuth, GoogleAuthProvider, signInWithPopup,
      createUserWithEmailAndPassword, signInWithEmailAndPassword: fbSignIn,
      onAuthStateChanged,
    } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');

    const firebaseApp = initializeApp({ apiKey: fbApiKey, authDomain: fbAuthDomain, projectId: fbProjectId });
    fbAuth = getAuth(firebaseApp);
    fbGoogleProvider = new GoogleAuthProvider();

    window._fbSignInGoogle = () => signInWithPopup(fbAuth, fbGoogleProvider);
    window._fbSignInEmail  = (e, p) => fbSignIn(fbAuth, e, p);
    window._fbCreateUser   = (e, p) => createUserWithEmailAndPassword(fbAuth, e, p);

    return new Promise(resolve => {
      onAuthStateChanged(fbAuth, user => resolve(user));
    });
  } catch (e) {
    console.warn('Firebase init error:', e);
    return false;
  }
}

export async function loginWithGoogle() {
  if (!window._fbSignInGoogle) throw new Error('Firebase no configurado');
  const result = await window._fbSignInGoogle();
  const u = result.user;
  return { uid: u.uid, email: u.email, name: u.displayName || u.email, photo: u.photoURL };
}

export async function loginWithEmail(email, password) {
  if (!window._fbSignInEmail) throw new Error('Firebase no configurado');
  const result = await window._fbSignInEmail(email, password);
  const u = result.user;
  return { uid: u.uid, email: u.email, name: u.displayName || u.email };
}

export async function registerWithEmail(email, password) {
  if (!window._fbCreateUser) throw new Error('Firebase no configurado');
  const result = await window._fbCreateUser(email, password);
  const u = result.user;
  return { uid: u.uid, email: u.email, name: email };
}

/**
 * Obtiene un Firebase ID Token fresco del usuario actualmente autenticado.
 *
 * IMPORTANTE: APP.user es un objeto plano (uid, email, name) creado por
 * loginWithGoogle/loginWithEmail para uso en la UI — NO es la instancia
 * real de Firebase Auth y no tiene getIdToken(). Esta función va directo
 * a fbAuth.currentUser, que SÍ es la instancia real del SDK y mantiene el
 * token actualizado automáticamente (Firebase lo refresca solo cuando
 * está por expirar).
 *
 * Usado por api.js para autenticar las llamadas a mensajes-proxy.
 */
export async function getCurrentIdToken() {
  if (!fbAuth?.currentUser) {
    throw new Error('No hay un usuario de Firebase autenticado actualmente.');
  }
  return await fbAuth.currentUser.getIdToken();
}

export async function logout() {
  APP.user = null;
  APP.isDemoMode = false;
  APP.currentRamo = null;
  APP.messages = [];
  if (fbAuth) {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await signOut(fbAuth).catch(() => {});
  }
}
