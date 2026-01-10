// firebase-config.js
// Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyB_uoLwQrYDDvkSKEGZHJXB2aPa3HyAPOA",
  authDomain: "quizmaster-87a18.firebaseapp.com",
  projectId: "quizmaster-87a18",
  storageBucket: "quizmaster-87a18.firebasestorage.app",
  messagingSenderId: "452265040552",
  appId: "1:452265040552:web:dcabc0038e1a6af846009d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Auth and Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// Auth state observer
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    console.log('User logged in:', user.uid);
    app.handleUserLogin(user);
  } else {
    // User is signed out
    console.log('User logged out');
    app.handleUserLogout();
  }
});