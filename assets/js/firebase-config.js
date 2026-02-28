/* =====================================================
   FIREBASE CONFIG — Inicialización global
   SDK compat (funciona sin bundler)
   Proyecto: physicsnoteslab-a23d9
===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyCr3u2ZNrhBSSxnSx1-9VzPouRktipGRbk",
    authDomain: "physicsnoteslab-a23d9.firebaseapp.com",
    projectId: "physicsnoteslab-a23d9",
    // Bucket correcto (formato estándar): <project>.appspot.com
    storageBucket: "physicsnoteslab-a23d9.appspot.com",
    messagingSenderId: "858001271509",
    appId: "1:858001271509:web:856f5bceb082bbd69f905c"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exponer servicios globalmente
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

console.log("🔥 Firebase inicializado correctamente");
