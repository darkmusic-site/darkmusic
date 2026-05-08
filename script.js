// CONFIGURASI FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAgAoT8Wcdm5_eyp6o9uc0lHiDVQ91HDHI",
    authDomain: "darkmusic-9eafa.firebaseapp.com",
    projectId: "darkmusic-9eafa",
    storageBucket: "darkmusic-9eafa.firebasestorage.app",
    messagingSenderId: "194538383395",
    appId: "1:194538383395:web:6703ecea6225967df66996"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const ADMIN_EMAIL = "samsungsultra665@gmail.com";

auth.onAuthStateChanged(user => {
    const landing = document.getElementById('landing-page');
    const navGuest = document.getElementById('nav-guest');
    const navUser = document.getElementById('nav-user');
    const dashboard = document.getElementById('dashboard-content');

    if (user) {
        if(landing) landing.classList.add('hidden');
        if(navGuest) navGuest.classList.add('hidden');
        if(navUser) navUser.classList.remove('hidden');
        if(dashboard) dashboard.classList.remove('hidden');
        
        document.getElementById('user-photo').src = user.photoURL;
        document.getElementById('user-name-display').innerText = user.displayName;
        document.getElementById('user-name-welcome').innerText = user.displayName;

        loadMyReleases(user.uid);
        listenToBalance(user.uid); // Load saldo realtime

        if(user.email === ADMIN_EMAIL) {
            document.getElementById('admin-link').classList.remove('hidden');
            loadAdminPanel();
        }
    } else {
        if(landing) landing.classList.remove('hidden');
        if(navGuest) navGuest.classList.remove('hidden');
        if(navUser) navUser.classList.add('hidden');
        if(dashboard) dashboard.classList.add('hidden');
    }
});

// ==========================================
// LOGIKA SALDO & WITHDRAW (PILIHAN A)
// ==========================================
function listenToBalance(uid) {
    db.collection("users").doc(uid).onSnapshot(doc => {
        const bal = doc.exists ? (doc.data().balance || 0) : 0;
        document.getElementById('user-balance').innerText = bal.toFixed(2);
        document.getElementById('user-balance-wd').innerText = bal.toFixed(2);
    });
}

async function requestWithdraw() {
    const user = auth.currentUser;
    const paypal = document.getElementById('wd-paypal').value;
    const currentBalance = parseFloat(document.getElementById('user-balance').innerText);

    if (!paypal.includes('@')) return alert("Masukkan email PayPal valid!");
    if (currentBalance <= 0) return alert("Saldo Anda masih kosong.");

    if (confirm(`Tarik seluruh saldo sebesar $${currentBalance} ke PayPal ${paypal}?`)) {
        try {
            // 1. Catat transaksi
            await db.collection('withdrawals').add({
                uid: user.uid,
                email: user.email,
                paypal: paypal,
                amount: currentBalance,
                status: 'Pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Nol-kan saldo di database (PILIHAN A)
            await db.collection('users').doc(user.uid).set({ balance: 0 }, { merge: true });

            alert("Permintaan tarik saldo berhasil! Mohon tunggu proses transfer admin.");
            showSection('library');
        } catch (e) {
            alert("Terjadi kesalahan.");
        }
    }
}

// ==========================================
// ADMIN: UPDATE SALDO
// ==========================================
async function updateBalance() {
    const uid = document.getElementById('admin-user-id').value;
    const amount = parseFloat(document.getElementById('admin-amount').value);

    if(!uid || isNaN(amount)) return alert("Isi UID dan Nominal!");

    try {
        await db.collection('users').doc(uid).set({ balance: amount }, { merge: true });
        alert(`Berhasil! Saldo artis dengan UID ${uid} sekarang $${amount}`);
        document.getElementById('admin-amount').value = "";
    } catch (e) {
        alert("Gagal update saldo.");
    }
}

// ==========================================
// FUNGSI AUTH & NAV
// ==========================================
function login() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleProfile(e) { e.stopPropagation(); document.getElementById('profile-dropdown').classList.toggle('active'); }
function showSection(id) {
    document.querySelectorAll('.dashboard').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('profile-dropdown').classList.remove('active');
    window.scrollTo(0,0);
}
function showUploadForm() { document.getElementById('upload-teaser').classList.add('hidden'); document.getElementById('real-upload-form').classList.remove('hidden'); }
function hideUploadForm() { document.getElementById('upload-teaser').classList.remove('hidden'); document.getElementById('real-upload-form').classList.add('hidden'); }

// ==========================================
// RILIS & TABEL
// ==========================================
function toggleAllStores() {
    const cbs = document.querySelectorAll('.store-cb');
    const all = Array.from(cbs).every(c => c.checked);
    cbs.forEach(c => c.checked = !all);
}

async function distribute() {
    const title = document.getElementById('song-title').value;
    const drive = document.getElementById('drive-link').value;
    if(!title || !drive) return alert("Lengkapi data!");

    await db.collection('releases').add({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        title: title,
        driveLink: drive,
        status: 'Review',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Berhasil dikirim!");
    location.reload();
}

function loadMyReleases(uid) {
    db.collection('releases').where('uid', '==', uid).onSnapshot(snap => {
        const body = document.getElementById('my-release-body');
        body.innerHTML = "";
        document.getElementById('total-release-count').innerText = snap.size;
        snap.forEach(doc => {
            const d = doc.data();
            body.innerHTML += `<tr><td>${d.title}</td><td>-</td><td>${d.status}</td><td>-</td></tr>`;
        });
    });
}

function loadAdminPanel() {
    db.collection('releases').orderBy('timestamp', 'desc').onSnapshot(snap => {
        const list = document.getElementById('admin-release-list');
        list.innerHTML = "<h3>Daftar Rilis Masuk</h3>";
        snap.forEach(doc => {
            const d = doc.data();
            list.innerHTML += `<div class="card-light" style="margin-bottom:10px;">
                <p><strong>${d.title}</strong> (${d.email})</p>
                <p style="font-size:10px; color:blue;">UID: ${d.uid}</p>
                <button onclick="updateStatus('${doc.id}', 'Live')">Set Live</button>
            </div>`;
        });
    });
}

async function updateStatus(id, s) { await db.collection('releases').doc(id).update({ status: s }); }

// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => btn.parentElement.classList.toggle('active'));
});
