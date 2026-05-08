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

// ==========================================
// MONITOR STATUS LOGIN
// ==========================================
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
        listenToBalance(user.uid);

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
// SALDO & WITHDRAW LOGIC
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
    if (currentBalance <= 0) return alert("Saldo Anda kosong.");

    if (confirm(`Tarik semua saldo sebesar $${currentBalance}?`)) {
        try {
            await db.collection('withdrawals').add({
                uid: user.uid,
                email: user.email,
                paypal: paypal,
                amount: currentBalance,
                status: 'Pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('users').doc(user.uid).set({ balance: 0 }, { merge: true });
            alert("Permintaan terkirim!");
        } catch (e) { alert("Gagal."); }
    }
}

// ==========================================
// AUTH & NAV
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

function showUploadForm() { 
    document.getElementById('upload-teaser').classList.add('hidden'); 
    document.getElementById('real-upload-form').classList.remove('hidden'); 
}
function hideUploadForm() { 
    document.getElementById('upload-teaser').classList.remove('hidden'); 
    document.getElementById('real-upload-form').classList.add('hidden'); 
}

// ==========================================
// RILIS & TABEL (DENGAN DETAIL LENGKAP)
// ==========================================
function toggleAllStores() {
    const cbs = document.querySelectorAll('.store-cb');
    const all = Array.from(cbs).every(c => c.checked);
    cbs.forEach(c => c.checked = !all);
}

async function distribute() {
    const drive = document.getElementById('drive-link').value;
    const title = document.getElementById('song-title').value;
    const artist = document.getElementById('artist-name').value;
    const genre = document.getElementById('genre').value;
    const releaseDate = document.getElementById('release-date').value;
    const stores = Array.from(document.querySelectorAll('.store-cb:checked')).map(cb => cb.value);

    if(!drive || !title || !artist || stores.length === 0) return alert("Lengkapi data!");

    await db.collection('releases').add({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        title, artist, driveLink: drive, stores, genre, releaseDate,
        status: 'Review',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Berhasil diajukan!");
    location.reload();
}

function loadMyReleases(uid) {
    db.collection('releases').where('uid', '==', uid).onSnapshot(snap => {
        const body = document.getElementById('my-release-body');
        body.innerHTML = "";
        document.getElementById('total-release-count').innerText = snap.size;

        snap.forEach(doc => {
            const d = doc.data();
            let dotClass = "dot-review";
            if(d.status === 'Live' || d.status === 'Approve') dotClass = "dot-live";
            if(d.status === 'Decline') dotClass = "dot-decline";

            body.innerHTML += `
                <tr>
                    <td>
                        <div style="font-weight:700;">${d.title}</div>
                        <div style="font-size:11px; color:#888;">${d.artist}</div>
                    </td>
                    <td>${d.releaseDate || "-"}</td>
                    <td><span class="status-dot ${dotClass}"></span>${d.status}</td>
                    <td>-</td>
                </tr>`;
        });
    });
}

// ==========================================
// ADMIN LOGIC (VERSI LENGKAP SEMUA TOMBOL)
// ==========================================
function loadAdminPanel() {
    const adminList = document.getElementById('admin-release-list');
    if(!adminList) return;

    db.collection('releases').orderBy('timestamp', 'desc').onSnapshot(snap => {
        adminList.innerHTML = "<h3 style='margin: 20px 0 15px;'>Daftar Rilis Masuk</h3>";
        
        if(snap.empty) {
            adminList.innerHTML += "<p style='color:#999;'>Tidak ada rilis masuk.</p>";
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            adminList.innerHTML += `
                <div class="card-light" style="border-bottom:1px solid #eee; padding:20px; background: #fff; margin-bottom: 15px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <p style="margin:0"><strong>${d.title}</strong> - ${d.artist}</p>
                    <p style="font-size:12px; color:#666; margin: 5px 0;">User: ${d.email}</p>
                    
                    <div style="background:#f5f5f5; padding:8px; border-radius:6px; margin: 10px 0;">
                        <span style="font-size:11px; color:#555;">UID Artis: <strong>${d.uid}</strong></span>
                        <button onclick="navigator.clipboard.writeText('${d.uid}'); alert('UID dicopy!')" style="font-size:9px; margin-left:5px; cursor:pointer;">Copy</button>
                    </div>

                    <a href="${d.driveLink}" target="_blank" style="font-size:12px; color:var(--primary); display:block; margin-bottom: 15px; text-decoration:none; font-weight:600;">Buka Link Drive ↗</a>
                    
                    <div class="admin-controls" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <button style="background:#4CAF50; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;" onclick="updateStatus('${doc.id}', 'Approve')">APPROVE</button>
                        <button style="background:#2196F3; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;" onclick="updateStatus('${doc.id}', 'Live')">SET LIVE</button>
                        <button style="background:#f44336; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;" onclick="updateStatus('${doc.id}', 'Decline')">DECLINE</button>
                        <button style="background:#333; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;" onclick="updateStatus('${doc.id}', 'Take Down')">TAKE DOWN</button>
                    </div>
                </div>`;
        });
    });
}

async function updateBalance() {
    const uid = document.getElementById('admin-user-id').value.trim();
    const amountStr = document.getElementById('admin-amount').value;
    const amount = parseFloat(amountStr);

    if (!uid) {
        alert("Mohon masukkan UID Artis!");
        return;
    }
    if (isNaN(amount)) {
        alert("Mohon masukkan nominal angka yang valid!");
        return;
    }

    try {
        // Menggunakan doc(uid).set dengan {merge: true} agar tidak menghapus data user lainnya
        await db.collection('users').doc(uid).set({ 
            balance: amount,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        alert(`Berhasil! Saldo untuk UID ${uid} sekarang: $${amount}`);
        
        // Reset form
        document.getElementById('admin-user-id').value = "";
        document.getElementById('admin-amount').value = "";
    } catch (error) {
        console.error("Error updating balance: ", error);
        alert("Gagal update saldo. Pastikan UID benar dan koneksi stabil.");
    }
}

async function updateStatus(id, newStatus) {
    if(confirm(`Ubah status rilis menjadi ${newStatus}?`)) {
        try {
            await db.collection('releases').doc(id).update({ status: newStatus });
            alert("Status berhasil diperbarui!");
        } catch (e) {
            alert("Gagal memperbarui status.");
        }
    }
}

// Accordion FAQ
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => btn.parentElement.classList.toggle('active'));
});
