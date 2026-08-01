const firebaseConfig = {
    apiKey: "AIzaSyCuL8AdGa339WBHBN6HtT5b38c1q9cyc_U",
    authDomain: "rubrics-system-tcgc.firebaseapp.com",
    projectId: "rubrics-system-tcgc",
    storageBucket: "rubrics-system-tcgc.firebasestorage.app",
    messagingSenderId: "78708348022",
    appId: "1:78708348022:web:0ff2dd9b8c7378e8bc7b57"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
