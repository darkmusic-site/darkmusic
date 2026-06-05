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

        // --- TAMBAHKAN FUNGSI INI ---
        checkAndLockArtist(user.uid); 

        loadMyReleases(user.uid);
        listenToBalance(user.uid);
        loadEarningsHistory(user.uid);
        loadUserAnalytics(user.uid); // Memuat analitik dan grafik

        if(user.email === ADMIN_EMAIL) {
            const adminLink = document.getElementById('admin-link');
            if(adminLink) {
                adminLink.classList.remove('hidden');
                loadAdminPanel();
            }
        }
    } else {
        if(landing) landing.classList.remove('hidden');
        if(navGuest) navGuest.classList.remove('hidden');
        if(navUser) navUser.classList.add('hidden');
        if(dashboard) dashboard.classList.add('hidden');
    }
});

// ==========================================
// LOGIKA LOCK NAMA ARTIS
// ==========================================
function checkAndLockArtist(uid) {
    const inputArtis = document.getElementById('artist-name');
    const txtInfoKunci = document.getElementById('info-artist-locked');

    if (!inputArtis) return;

    // Cari di koleksi 'releases' yang milik UID ini dan statusnya 'Approve' atau 'Live'
    db.collection('releases')
        .where('uid', '==', uid)
        .onSnapshot(snap => {
            let approvedArtistName = "";

            snap.forEach(doc => {
                const d = doc.data();
                if (d.status === 'Approve' || d.status === 'Live') {
                    approvedArtistName = d.artist; // Ambil nama artis yang sudah sukses rilis
                }
            });

            // Jika ditemukan rilis yang sudah di-approve
            if (approvedArtistName !== "") {
                inputArtis.value = approvedArtistName; // Set otomatis nilainya
                inputArtis.disabled = true;           // Kunci kolom inputnya
                if (txtInfoKunci) txtInfoKunci.classList.remove('hidden'); // Tampilkan info
            } else {
                // Jika belum ada rilis yang di-approve, biarkan terbuka normal
                inputArtis.disabled = false;
                if (txtInfoKunci) txtInfoKunci.classList.add('hidden');
            }
        });
}


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
    console.log("Tombol Withdraw diklik...");
    const user = auth.currentUser;
    
    // Ambil elemen dari HTML
    const elName = document.getElementById('wd-paypal-name');
    const elEmail = document.getElementById('wd-paypal-email');
    const elBalance = document.getElementById('user-balance');

    // Validasi elemen
    if (!elName || !elEmail || !elBalance) {
        alert("Sistem Error: Elemen input tidak ditemukan di HTML.");
        return;
    }

    const paypalName = elName.value.trim();
    const paypalEmail = elEmail.value.trim();
    const currentBalance = parseFloat(elBalance.innerText) || 0;

    // Validasi Input Kosong
    if (!paypalName || !paypalEmail) {
        alert("Mohon lengkapi Nama Pemilik dan Email PayPal!");
        return;
    }

    // Validasi Saldo
    if (currentBalance <= 0) {
        alert("Saldo Anda $0.00. Tidak ada saldo untuk ditarik.");
        return;
    }

    const confirmMsg = `Konfirmasi Penarikan:\n\nNama Pemilik: ${paypalName}\nEmail PayPal: ${paypalEmail}\nJumlah: $${currentBalance.toFixed(2)}\n\nHarap cek kembali. Kesalahan input data bukan tanggung jawab kami. Lanjutkan?`;

    if (confirm(confirmMsg)) {
        try {
            // 1. Simpan ke koleksi withdrawals
            await db.collection('withdrawals').add({
                uid: user.uid,
                email: user.email,
                paypalName: paypalName,
                paypalEmail: paypalEmail,
                amount: currentBalance,
                status: 'Pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Update saldo menjadi 0 di Firestore
            await db.collection('users').doc(user.uid).set({ 
                balance: 0 
            }, { merge: true });

            alert("Permintaan penarikan berhasil dikirim!");
            
            // Bersihkan form
            elName.value = "";
            elEmail.value = "";
            
            // Pindah ke section riwayat pendapatan
            showSection('earnings-history');

        } catch (e) { 
            console.error("Firebase Error:", e);
            alert("Gagal memproses penarikan: " + e.message); 
        }
    }
}

// ==========================================
// RIWAYAT PENDAPATAN
// ==========================================
function loadEarningsHistory(uid) {
    const tableBody = document.getElementById('earnings-table-body');
    if (!tableBody) return;

    db.collection('withdrawals')
        .where('uid', '==', uid)
        .onSnapshot(snap => {
            tableBody.innerHTML = "";
            if (snap.empty) {
                tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#999;">Belum ada riwayat penarikan.</td></tr>`;
                return;
            }

            let docs = [];
            snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
            
            // Urutkan riwayat berdasarkan waktu terbaru
            docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            docs.forEach(d => {
                const date = d.timestamp ? d.timestamp.toDate().toLocaleDateString('id-ID') : '-';
                
                let dotClass = "dot-review"; // Pending (Kuning)
                if (d.status === 'Paid') dotClass = "dot-live"; // Hijau
                if (d.status === 'Reject') dotClass = "dot-decline"; // Merah

                tableBody.innerHTML += `
                    <tr>
                        <td style="font-size: 13px;">${date}</td>
                        <td>
                            <div style="font-weight:700; font-size:13px;">Tarik ke PayPal</div>
                            <div style="font-size:11px; color:#666;">${d.paypalEmail} (${d.paypalName})</div>
                        </td>
                        <td style="font-weight:800;">$${d.amount.toFixed(2)}</td>
                        <td>
                            <span class="status-dot ${dotClass}"></span>
                            <span style="font-size:12px;">${d.status || 'Pending'}</span>
                        </td>
                    </tr>
                `;
            });
        });
}

// ==========================================
// AUTH & NAV
// ==========================================
function login() { auth.signInWithPopup(provider).catch(err => alert("Gagal Login: " + err.message)); }
function logout() { 
    if(confirm("Yakin ingin keluar?")) {
        auth.signOut().then(() => location.reload()); 
    }
}
function toggleProfile(e) { e.stopPropagation(); document.getElementById('profile-dropdown').classList.toggle('active'); }

function showSection(id) {
    document.querySelectorAll('.dashboard').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    const dropdown = document.getElementById('profile-dropdown');
    if(dropdown) dropdown.classList.remove('active');
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
// RILIS & TABEL
// ==========================================
function toggleAllStores() {
    const cbs = document.querySelectorAll('.store-cb');
    const all = Array.from(cbs).every(c => c.checked);
    cbs.forEach(c => c.checked = !all);
}

// Konfigurasi Cloudinary Anda (Ganti dengan data dari dashboard Anda)
const CLOUDINARY_CLOUD_NAME = "dqb0x46ny";
const CLOUDINARY_UPLOAD_PRESET = "Vantone_preset"; // Contoh: vantone_preset

// Fungsi memvalidasi dimensi gambar minimum 3000x3000px
function validateImageResolution(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (e) {
            const image = new Image();
            image.src = e.target.result;
            image.onload = function () {
                if (this.width < 3000 || this.height < 3000) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            };
        };
    });
}

async function distribute() {
    const audioInput = document.getElementById('audio-file');
    const artworkInput = document.getElementById('artwork-file');
    const title = document.getElementById('song-title').value.trim();
    const artist = document.getElementById('artist-name').value.trim();
    const genre = document.getElementById('genre').value;
    const releaseDate = document.getElementById('release-date').value;
    const stores = Array.from(document.querySelectorAll('.store-cb:checked')).map(cb => cb.value);
    
    const errorDimen = document.getElementById('error-artwork-dimen');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const statusText = document.getElementById('upload-status-text');
    const btn = document.getElementById('btn-submit');

    // 1. Validasi Input Dasar
    if(!audioInput.files[0] || !artworkInput.files[0] || !title || !artist || stores.length === 0) {
        return alert("Mohon lengkapi semua data dan pilih file yang ingin diunggah!");
    }

    const audioFile = audioInput.files[0];
    const artworkFile = artworkInput.files[0];

    // 2. Validasi Resolusi Artwork (Minimal 3000x3000px)
    if(errorDimen) errorDimen.classList.add('hidden');
    const isImageValid = await validateImageResolution(artworkFile);
    if (!isImageValid) {
        if(errorDimen) errorDimen.classList.remove('hidden');
        alert("Gagal: Ukuran artwork Anda tidak memenuhi standar minimal 3000x3000px.");
        return;
    }

    // Aktifkan loading status & progress bar
    btn.disabled = true;
    btn.innerText = "Memproses Pengunggahan...";
    if(progressContainer) progressContainer.classList.remove('hidden');
    if(statusText) statusText.classList.remove('hidden');

    try {
        const urlCloudinary = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

        // 3. Upload File Audio MP3 ke Cloudinary
        statusText.innerText = "Mengunggah file audio MP3 ke Cloudinary...";
        if(progressBar) progressBar.style.width = "30%";

        const formDataAudio = new FormData();
        formDataAudio.append("file", audioFile);
        formDataAudio.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formDataAudio.append("resource_type", "video"); // Cloudinary mendeteksi mp3 sebagai tipe video/raw

        const resAudio = await fetch(urlCloudinary, { method: "POST", body: formDataAudio });
        const dataAudio = await resAudio.json();
        
        if(!dataAudio.secure_url) throw new Error("Gagal mengunggah audio ke Cloudinary");
        const audioUrl = dataAudio.secure_url;

        // 4. Upload File Artwork ke Cloudinary
        statusText.innerText = "Mengunggah file Artwork Cover ke Cloudinary...";
        if(progressBar) progressBar.style.width = "70%";

        const formDataArtwork = new FormData();
        formDataArtwork.append("file", artworkFile);
        formDataArtwork.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formDataArtwork.append("resource_type", "image");

        const resArtwork = await fetch(urlCloudinary, { method: "POST", body: formDataArtwork });
        const dataArtwork = await resArtwork.json();

        if(!dataArtwork.secure_url) throw new Error("Gagal mengunggah artwork ke Cloudinary");
        const artworkUrl = dataArtwork.secure_url;

        // 5. Simpan Semua URL ke Firestore Gratisan Anda
        statusText.innerText = "Menyimpan data rilis ke sistem VanTone...";
        if(progressBar) progressBar.style.width = "90%";

        await db.collection('releases').add({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            title, 
            artist, 
            audioLink: audioUrl,     
            artworkLink: artworkUrl, 
            stores, 
            genre, 
            releaseDate,
            status: 'Review',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        if(progressBar) progressBar.style.width = "100%";
        alert("Lagu dan Artwork berhasil diajukan!");
        location.reload();

    } catch(e) {
        console.error(e);
        alert("Terjadi kesalahan saat mengunggah file: " + e.message);
        btn.disabled = false;
        btn.innerText = "AJUKAN DISTRIBUSI";
        if(progressContainer) progressContainer.classList.add('hidden');
        if(statusText) statusText.classList.add('hidden');
    }
}


function loadMyReleases(uid) {
    db.collection('releases').where('uid', '==', uid).onSnapshot(snap => {
        const body = document.getElementById('my-release-body');
        if(!body) return;
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
// ADMIN PANEL LOGIC (REPLACE TOTAL FUNGSI INI)
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
            
            // Pengaman jika ada data rilis lama yang masih menggunakan format Google Drive
            const linkAudio = d.audioLink || d.driveLink || "#";
            const linkArtwork = d.artworkLink || "https://via.placeholder.com/150?text=No+Artwork";

            let dotClass = "dot-review";
            if(d.status === 'Live' || d.status === 'Approve') dotClass = "dot-live";
            if(d.status === 'Decline') dotClass = "dot-decline";

            adminList.innerHTML += `
                <div class="card-light" style="border-bottom:1px solid #eee; padding:20px; background: #fff; margin-bottom: 15px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <p style="margin:0"><strong>${d.title}</strong> - ${d.artist}</p>
                    <p style="font-size:12px; color:#666; margin: 5px 0;">User: ${d.email}</p>
                    
                    <div style="background:#f5f5f5; padding:8px; border-radius:6px; margin: 10px 0;">
                        <span style="font-size:11px; color:#555;">UID Artis: <strong>${d.uid}</strong></span>
                        <button onclick="navigator.clipboard.writeText('${d.uid}'); alert('UID dicopy!')" style="font-size:9px; margin-left:5px; cursor:pointer;">Copy</button>
                    </div>

                    <!-- AREA PREVIEW TERBARU DI PANEL ADMIN (CLOUDINARY) -->
                    <div style="margin: 15px 0; background: #fafafa; padding: 12px; border-radius: 8px; border: 1px solid #eaeaea;">
                        <p style="font-size:11px; margin: 0 0 5px; color: #555; font-weight: bold;">🎨 Artwork Cover (Klik untuk Perbesar):</p>
                        <a href="${linkArtwork}" target="_blank" style="display: inline-block; margin-bottom: 12px;">
                            <img src="${linkArtwork}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; display: block;" alt="Artwork Admin">
                        </a>
                        
                        <p style="font-size:11px; margin: 0 0 5px; color: #555; font-weight: bold;">🎵 Audio Pemutar (Format: MP3):</p>
                        <audio controls style="width: 100%; max-width: 280px; height: 32px; display: block;">
                            <source src="${linkAudio}" type="audio/mpeg">
                            Browser Anda tidak mendukung pemutar audio langsung.
                        </audio>
                    </div>
                    
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
        await db.collection('users').doc(uid).set({ 
            balance: amount,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        alert(`Berhasil! Saldo untuk UID ${uid} sekarang: $${amount}`);
        
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

// Tutup dropdown jika klik di luar
window.onclick = function(event) {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
        if (!event.target.closest('.profile-trigger')) {
            dropdown.classList.remove('active');
        }
    }
};

// Accordion FAQ
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => btn.parentElement.classList.toggle('active'));
});

// ==========================================
// LOGIKA INSTANT PREVIEW AUDIO & ARTWORK
// ==========================================

// 1. Preview Jalankan Otomatis Saat File Audio Dipilih
document.getElementById('audio-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('audio-preview-container');
    const player = document.getElementById('audio-preview-player');

    if (file) {
        // Buat url lokal instan tanpa upload ke internet terlebih dahulu
        const blobUrl = URL.createObjectURL(file);
        player.src = blobUrl;
        
        // Munculkan pemutar musiknya
        previewContainer.classList.remove('hidden');
    } else {
        previewContainer.classList.add('hidden');
    }
});

// 2. Preview Jalankan Otomatis Saat File Artwork Dipilih + Validasi Resolusi
document.getElementById('artwork-file').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('artwork-preview-container');
    const previewImg = document.getElementById('artwork-preview-img');
    const errorDimen = document.getElementById('error-artwork-dimen');

    if (file) {
        errorDimen.classList.add('hidden');
        
        // Panggil fungsi validasi resolusi 3000x3000px
        const isImageValid = await validateImageResolution(file);
        
        if (!isImageValid) {
            errorDimen.classList.remove('hidden');
            previewContainer.classList.add('hidden');
            event.target.value = ""; // Reset inputan jika tidak valid
            alert("Gagal: Ukuran artwork Anda tidak memenuhi standar minimal 3000x3000px.");
            return;
        }

        // Jika valid, buat url lokal instan dan tampilkan gambarnya di web
        const blobUrl = URL.createObjectURL(file);
        previewImg.src = blobUrl;
        previewContainer.classList.remove('hidden');
    } else {
        previewContainer.classList.add('hidden');
    }
});

// Variabel global untuk menyimpan objek grafik agar tidak duplikat saat diredraw
let myChartInstance = null;

// ==========================================
// LOGIKA USER: MEMUAT ANALITIK & GRAFIK
// ==========================================
function loadUserAnalytics(uid) {
    const royaltyTable = document.getElementById('royalty-table-body');
    if (!royaltyTable) return;

    db.collection('analytics').where('uid', '==', uid).onSnapshot(snap => {
        if (snap.empty) return;

        royaltyTable.innerHTML = "";
        let totalStreams = 0;
        let topSongName = "-";
        let maxStreams = 0;

        // Penampung data grafik bulanan (Simulasi 3 Bulan)
        let monthlyData = { "April": 0, "Mei": 0, "Juni": 0 }; 

        snap.forEach(doc => {
            const d = doc.data();
            totalStreams += parseInt(d.streams || 0);

            // Cari lagu terpopuler
            if (parseInt(d.streams || 0) > maxStreams) {
                maxStreams = d.streams;
                topSongName = d.title;
            }

            // Kelompokkan data streams untuk grafik (Sederhana berdasarkan data masuk)
            // Di dunia nyata ini dicocokkan dengan timestamp bulan dokumen dimasukkan
            monthlyData["Juni"] += parseInt(d.streams || 0); 

            // Render baris tabel royalti per lagu
            royaltyTable.innerHTML += `
                <tr>
                    <td style="font-weight:700; font-size:13px;">${d.title}</td>
                    <td><span style="background:#e3f2fd; color:#0d47a1; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">${d.topPlatform || 'Spotify'}</span></td>
                    <td style="font-weight:600;">${parseInt(d.streams).toLocaleString('id-ID')} Streams</td>
                    <td style="font-weight:800; color:#2e7d32;">+$${parseFloat(d.amount || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        // Update teks ringkasan di dashboard atas
        document.getElementById('total-streams-display').innerText = totalStreams.toLocaleString('id-ID');
        document.getElementById('top-song-display').innerText = topSongName;

        // Render atau update Grafik Chart.js
        renderAnalyticsChart(Object.keys(monthlyData), Object.values(monthlyData));
    });
}

function renderAnalyticsChart(labels, dataValues) {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    // Hancurkan grafik lama jika ada, mencegah error tumpang tindih saat data diperbarui
    if (myChartInstance) {
        myChartInstance.destroy();
    }

    myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Pemutaran Musik',
                data: dataValues,
                borderColor: '#ff0050', // Warna merah khas VanTone
                backgroundColor: 'rgba(255, 0, 80, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ==========================================
// LOGIKA ADMIN: INPUT ROYALTI & ANALITIK baru
// ==========================================
async function submitRoyaltyAndAnalytics() {
    const uid = document.getElementById('admin-royalty-uid').value.trim();
    const title = document.getElementById('admin-royalty-title').value.trim();
    const platform = document.getElementById('admin-royalty-platform').value.trim();
    const streams = parseInt(document.getElementById('admin-royalty-streams').value);
    const amount = parseFloat(document.getElementById('admin-royalty-amount').value);

    if(!uid || !title || !platform || isNaN(streams) || isNaN(amount)) {
        return alert("Mohon isi semua kolom input data royalti secara valid!");
    }

    try {
        // 1. Masukkan log performa ke koleksi 'analytics'
        await db.collection('analytics').add({
            uid, title, topPlatform: platform, streams, amount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Ambil saldo user saat ini untuk ditambahkan dengan nilai royalti baru otomatis
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        let currentBalance = 0;
        
        if (userDoc.exists) {
            currentBalance = parseFloat(userDoc.data().balance || 0);
        }

        // 3. Update total saldo akhir user di database agar mereka bisa melakukan withdraw
        await userRef.set({
            balance: currentBalance + amount,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert(`Sukses! Data analitik berhasil disimpan dan saldo artis otomatis bertambah sebesar $${amount}`);
        
        // Bersihkan Form input admin
        document.getElementById('admin-royalty-uid').value = "";
        document.getElementById('admin-royalty-title').value = "";
        document.getElementById('admin-royalty-platform').value = "";
        document.getElementById('admin-royalty-streams').value = "";
        document.getElementById('admin-royalty-amount').value = "";

    } catch (e) {
        console.error(e);
        alert("Gagal memproses data royalti: " + e.message);
    }
}

// ==========================================
// VALIDASI KALENDER: MINIMAL 7 HARI KE DEPAN
// ==========================================
function batasiTanggalRilis() {
    const dateInput = document.getElementById('release-date');
    if (!dateInput) return;

    const hariIni = new Date();
    hariIni.setDate(hariIni.getDate() + 7); // Kunci 7 hari ke depan

    const tahun = hariIni.getFullYear();
    const bulan = String(hariIni.getMonth() + 1).padStart(2, '0');
    const tanggal = String(hariIni.getDate()).padStart(2, '0');

    const tglMinimal = `${tahun}-${bulan}-${tanggal}`;
    dateInput.min = tglMinimal;
    dateInput.value = tglMinimal;
}

// ==========================================
// KONTROL SELECTION PLATFORM (26 DSP)
// ==========================================
function hitungPilihan() {
    const checkedCount = document.querySelectorAll('.store-cb:checked').length;
    const displayCount = document.getElementById('selected-count');
    if (displayCount) {
        displayCount.innerText = checkedCount;
    }
}

function toggleAllStores(forceState = null) {
    const checkboxes = document.querySelectorAll('.store-cb');
    const checkTarget = (forceState !== null) ? forceState : document.querySelectorAll('.store-cb:checked').length < checkboxes.length;

    checkboxes.forEach(cb => {
        cb.checked = checkTarget;
    });
    hitungPilihan();
}

// Panggil fungsi pembatasan tanggal agar langsung aktif saat halaman dimuat
batasiTanggalRilis();
