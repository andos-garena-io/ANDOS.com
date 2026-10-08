import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwRNxLSVneeu_oQv-ptff1Fu6rVYso8t4",
  authDomain: "andos-49b6a.firebaseapp.com",
  projectId: "andos-49b6a",
  storageBucket: "andos-49b6a.firebasestorage.app",
  messagingSenderId: "669879998185",
  appId: "1:669879998185:web:ae076166918c0be6384278"
};

const auth = getAuth(initializeApp(firebaseConfig));
let finished = false;
let noUserTimer;
let recoveryTimer;

function goToLogin() {
  if (finished) return;
  finished = true;
  location.replace("/");
}

async function establishServerSession(user) {
  if (finished || !user) return;
  clearTimeout(noUserTimer);
  clearTimeout(recoveryTimer);

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const idToken = await user.getIdToken(attempt > 0);
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        finished = true;
        location.replace("/dashboard");
        return;
      }
      lastError = new Error(data.error || "session_create_failed");
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }

  console.warn("[auth] session recovery failed", lastError);
  goToLogin();
}

/* A mobile browser can notify the observer with null before its local
   persistence finishes restoring the actual Firebase user. Do not send a
   returning user to the login page during that short handoff window. */
onAuthStateChanged(auth, user => {
  clearTimeout(noUserTimer);
  if (user) {
    establishServerSession(user);
    return;
  }
  noUserTimer = setTimeout(goToLogin, 5000);
});

/* Hard stop: this page never exposes dashboard HTML. If auth cannot be
   restored, the normal public login route is the only fallback. */
recoveryTimer = setTimeout(goToLogin, 12000);
