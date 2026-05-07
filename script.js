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

// MONITOR STATUS LOGIN
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('auth-guest').classList.add('hidden');
        document.getElementById('hero').classList.add('hidden');
        document.getElementById('auth-user').classList.remove('hidden');
        document.getElementById('library').classList.remove('hidden');
        
        document.getElementById('user-photo').src = user.photoURL;
        document.getElementById('user-name-display').innerText = user.displayName;
        document.getElementById('user-email-display').innerText = user.email;

        loadMyReleases(user.uid);

        if(user.email === ADMIN_EMAIL) {
            document.getElementById('admin-link').classList.remove('hidden');
            loadAdminPanel();
        }
    } else {
        document.querySelectorAll('.dashboard').forEach(s => s.classList.add('hidden'));
        document.getElementById('auth-guest').classList.remove('hidden');
        document.getElementById('hero').classList.remove('hidden');
        document.getElementById('auth-user').classList.add('hidden');
    }
});

// AUTH FUNCTIONS
function login() { auth.signInWithPopup(provider); }
function logout() { if(confirm("Yakin ingin keluar?")) auth.signOut().then(()=> location.reload()); }
function toggleProfile(event) {
    event.stopPropagation();
    document.getElementById('profile-dropdown').classList.toggle('active');
}

window.onclick = function(event) {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
        if (!event.target.closest('.profile-trigger')) dropdown.classList.remove('active');
    }
};

function showSection(sectionId) {
    document.querySelectorAll('.dashboard').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.getElementById('profile-dropdown').classList.remove('active');
}

// FORM LOGIC
function toggleAllStores() {
    const checkboxes = document.querySelectorAll('.store-cb');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

async function distribute() {
    const driveLink = document.getElementById('drive-link').value;
    const title = document.getElementById('song-title').value;
    const artist = document.getElementById('artist-name').value;
    const stores = Array.from(document.querySelectorAll('.store-cb:checked')).map(cb => cb.value);

    if(!driveLink || !title || !artist || stores.length === 0) return alert("Lengkapi data!");

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.innerText = "Mengirim...";

    try {
        await db.collection('releases').add({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            title, artist, driveLink, stores,
            genre: document.getElementById('genre').value,
            releaseDate: document.getElementById('release-date').value,
            status: 'Review',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Berhasil dikirim! Silakan cek di menu 'My Releases'.");
        location.reload();
    } catch(e) {
        alert("Gagal mengirim data.");
        btn.disabled = false;
    }
}

// LOAD DATA ARTIS (ALA SOUNDON)
function loadMyReleases(uid) {
    const tableBody = document.getElementById('my-release-body');
    if (!tableBody) return;

    db.collection('releases').where('uid', '==', uid).onSnapshot(snap => {
        tableBody.innerHTML = "";
        if (snap.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; color:#999;">No releases found.</td></tr>`;
            return;
        }

        const docs = [];
        snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        docs.forEach(d => {
            let dotClass = "dot-review";
            let statusName = d.status || "Review";
            const s = statusName.toLowerCase();

            if (s.includes('approve') || s.includes('live')) dotClass = "dot-live";
            else if (s.includes('decline')) dotClass = "dot-decline";
            else if (s.includes('take down')) dotClass = "dot-takedown";

            let actionContent = "";
            if (s.includes('decline') || s.includes('take down')) {
                actionContent = `<button onclick="deleteRelease('${d.id}')" class="btn-delete-icon"></button>`;
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

// DELETE FUNCTION
async function deleteRelease(docId) {
    if (confirm("Hapus data rilis ini secara permanen?")) {
        await db.collection('releases').doc(docId).delete();
        alert("Data dihapus.");
    }
}

// ADMIN PANEL
function loadAdminPanel() {
    const adminList = document.getElementById('admin-release-list');
    db.collection('releases').orderBy('timestamp', 'desc').onSnapshot(snap => {
        adminList.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            adminList.innerHTML += `
                <div style="border-bottom:1px solid #eee; padding:15px 0;">
                    <p><strong>${d.title}</strong> by ${d.artist}</p>
                    <a href="${d.driveLink}" target="_blank" style="font-size:11px; color:blue;">Link Drive </a>
                    <div class="admin-controls">
                        <button class="btn-admin" onclick="updateStatus('${doc.id}', 'Approve')">Approve</button>
                        <button class="btn-admin" onclick="updateStatus('${doc.id}', 'Live')">Live</button>
                        <button class="btn-admin" onclick="updateStatus('${doc.id}', 'Decline')">Decline</button>
                    </div>
                </div>`;
        });
    });
}

async function updateStatus(id, s) {
    await db.collection('releases').doc(id).update({ status: s });
    alert("Status Updated!");
}
