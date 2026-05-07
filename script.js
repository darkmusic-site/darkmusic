// CONFIGURASI FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAgAoT8Wcdm5_eyp6o9uc0lHiDVQ91HDHI",
    authDomain: "darkmusic-9eafa.firebaseapp.com",
    projectId: "darkmusic-9eafa",
    storageBucket: "darkmusic-9eafa.firebasestorage.app",
    messagingSenderId: "194538383395",
    appId: "1:194538383395:web:6703ecea6225967df66996"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// Email Admin
const ADMIN_EMAIL = "samsungsultra665@gmail.com";

// ==========================================
// MONITOR STATUS LOGIN (LOGIKA TAMPILAN)
// ==========================================
auth.onAuthStateChanged(user => {
    const landing = document.getElementById('landing-page');
    const navGuest = document.getElementById('nav-guest');
    const navUser = document.getElementById('nav-user');
    const dashboard = document.getElementById('dashboard-content');

    if (user) {
        // Jika User Login: Sembunyikan Landing Page, Tampilkan Dashboard
        if(landing) landing.classList.add('hidden');
        if(navGuest) navGuest.classList.add('hidden');
        if(navUser) navUser.classList.remove('hidden');
        if(dashboard) dashboard.classList.remove('hidden');
        
        // Update Info Profile
        const userPhoto = document.getElementById('user-photo');
        const userName = document.getElementById('user-name-display');
        const userEmail = document.getElementById('user-email-display');

        if(userPhoto) userPhoto.src = user.photoURL;
        if(userName) userName.innerText = user.displayName;
        if(userEmail) userEmail.innerText = user.email;

        // Load Data Rilis User
        loadMyReleases(user.uid);

        // Cek jika User adalah Admin
        if(user.email === ADMIN_EMAIL) {
            const adminLink = document.getElementById('admin-link');
            if(adminLink) {
                adminLink.classList.remove('hidden');
                loadAdminPanel();
            }
        }
    } else {
        // Jika Belum Login: Tampilkan Landing Page (SoundOn Style)
        if(landing) landing.classList.remove('hidden');
        if(navGuest) navGuest.classList.remove('hidden');
        if(navUser) navUser.classList.add('hidden');
        if(dashboard) dashboard.classList.add('hidden');
        
        // Sembunyikan semua section dashboard
        document.querySelectorAll('.dashboard').forEach(s => s.classList.add('hidden'));
    }
});

// ==========================================
// FUNGSI AUTHENTICATION
// ==========================================
function login() { 
    auth.signInWithPopup(provider).catch(err => alert("Gagal Login: " + err.message)); 
}

function logout() { 
    if(confirm("Yakin ingin keluar?")) {
        auth.signOut().then(() => {
            window.location.reload();
        });
    }
}

function toggleProfile(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('profile-dropdown');
    if(dropdown) dropdown.classList.toggle('active');
}

// Tutup dropdown jika klik di luar
window.onclick = function(event) {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
        if (!event.target.closest('.profile-trigger')) {
            dropdown.classList.remove('active');
        }
    }
};

// Navigasi antar section Dashboard
function showSection(sectionId) {
    document.querySelectorAll('.dashboard').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.remove('hidden');
    
    const dropdown = document.getElementById('profile-dropdown');
    if(dropdown) dropdown.classList.remove('active');

    // Scroll ke atas otomatis
    window.scrollTo(0,0);
}

// ==========================================
// FORM RILIS MUSIK
// ==========================================
function toggleAllStores() {
    const checkboxes = document.querySelectorAll('.store-cb');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

async function distribute() {
    const driveLink = document.getElementById('drive-link').value;
    const title = document.getElementById('song-title').value;
    const artist = document.getElementById('artist-name').value;
    const genre = document.getElementById('genre').value;
    const releaseDate = document.getElementById('release-date').value;
    const stores = Array.from(document.querySelectorAll('.store-cb:checked')).map(cb => cb.value);

    if(!driveLink || !title || !artist || stores.length === 0) {
        return alert("Mohon lengkapi semua data dan pilih minimal satu toko musik!");
    }

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.innerText = "Sedang Mengirim...";

    try {
        await db.collection('releases').add({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            title: title,
            artist: artist,
            driveLink: driveLink,
            stores: stores,
            genre: genre,
            releaseDate: releaseDate,
            status: 'Review',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Rilis berhasil diajukan! Tim kami akan segera meninjau musik Anda.");
        showSection('my-releases'); // Pindah ke halaman list
        location.reload();
    } catch(e) {
        console.error(e);
        alert("Gagal mengirim data. Pastikan koneksi internet stabil.");
        btn.disabled = false;
        btn.innerText = "AJUKAN DISTRIBUSI";
    }
}

// ==========================================
// LOAD DATA KE TABEL (USER)
// ==========================================
function loadMyReleases(uid) {
    const tableBody = document.getElementById('my-release-body');
    if (!tableBody) return;

    db.collection('releases').where('uid', '==', uid).onSnapshot(snap => {
        tableBody.innerHTML = "";
        if (snap.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; color:#999;">Belum ada rilisan musik.</td></tr>`;
            return;
        }

        let docs = [];
        snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        
        // Urutkan berdasarkan yang terbaru
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        docs.forEach(d => {
            let dotClass = "dot-review";
            let statusName = d.status || "Review";
            const s = statusName.toLowerCase();

            if (s.includes('approve') || s.includes('live')) dotClass = "dot-live";
            else if (s.includes('decline')) dotClass = "dot-decline";
            else if (s.includes('take down')) dotClass = "dot-takedown";

            let actionContent = "-";
            if (s.includes('decline') || s.includes('take down')) {
                actionContent = `<button onclick="deleteRelease('${d.id}')" class="btn-delete-icon" title="Hapus">🗑️</button>`;
            }

            tableBody.innerHTML += `
                <tr>
                    <td>
                        <div style="font-weight: 700; color: #333;">${d.title}</div>
                        <div style="font-size: 11px; color: #888;">${d.artist}</div>
                    </td>
                    <td style="color: #666;">${d.releaseDate || "-"}</td>
                    <td>
                        <span class="status-dot ${dotClass}"></span>
                        <span class="status-text">${statusName}</span>
                    </td>
                    <td style="text-align: center;">${actionContent}</td>
                </tr>
            `;
        });
    });
}

async function deleteRelease(docId) {
    if (confirm("Hapus rilis ini secara permanen?")) {
        try {
            await db.collection('releases').doc(docId).delete();
            alert("Data rilis berhasil dihapus.");
        } catch (e) {
            alert("Gagal menghapus data.");
        }
    }
}

// ==========================================
// ADMIN PANEL LOGIC
// ==========================================
function loadAdminPanel() {
    const adminList = document.getElementById('admin-release-list');
    if(!adminList) return;

    db.collection('releases').orderBy('timestamp', 'desc').onSnapshot(snap => {
        adminList.innerHTML = "";
        if(snap.empty) {
            adminList.innerHTML = "<p>Tidak ada rilis masuk.</p>";
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            adminList.innerHTML += `
                <div style="border-bottom:1px solid #eee; padding:15px 0; background: #fff; margin-bottom: 10px; border-radius: 8px; padding: 15px;">
                    <p style="margin:0"><strong>${d.title}</strong> - ${d.artist}</p>
                    <p style="font-size:12px; color:#666;">User: ${d.email}</p>
                    <a href="${d.driveLink}" target="_blank" style="font-size:11px; color:blue; display:block; margin: 10px 0;">Buka Link Drive ↗</a>
                    <div class="admin-controls" style="display:flex; gap:5px;">
                        <button style="font-size:10px; background:#4CAF50; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="updateStatus('${doc.id}', 'Approve')">Approve</button>
                        <button style="font-size:10px; background:#2196F3; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="updateStatus('${doc.id}', 'Live')">Live</button>
                        <button style="font-size:10px; background:#f44336; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="updateStatus('${doc.id}', 'Decline')">Decline</button>
                    </div>
                </div>`;
        });
    });
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
