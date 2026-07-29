// ==========================================
// १. FIREBASE SETUP & INITIALIZATION
// ==========================================
// (टीप: खालील कॉन्फिगरेशनमध्ये तुझी खरी Firebase माहिती खात्री करून टाक)
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase इनिशिअलाईझ करणे (जर आधीच होत असेल तर ही ओळ सांभाळून वापर)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const storage = firebase.storage();

// ==========================================
// २. NAVIGATION & SECTION SWITCHING
// ==========================================
function showSection(sectionId, element) {
    // सर्व सेक्शन लपवणे
    const sections = document.querySelectorAll('.section-box');
    sections.forEach(sec => sec.style.display = 'none');

    // ठरवलेला सेक्शन दाखवणे
    const targetSection = document.getElementById('section-' + sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    // नेव्हिगेशन बटण ॲक्टिव्ह क्लास मॅनेज करणे
    if (element) {
        const buttons = document.querySelectorAll('.bottom-nav button');
        buttons.forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }
}

// ==========================================
// ३. VIDEO UPLOAD & FIREBASE STORAGE SAVING
// ==========================================
async function uploadAndSaveVideo(fileInputId, titleInputId) {
    const fileInput = document.getElementById(fileInputId);
    const titleInput = document.getElementById(titleInputId);

    if (!fileInput || !fileInput.files[0]) {
        alert("कृपया आधी व्हिडिओ निवडा!");
        return;
    }

    const file = fileInput.files[0];
    const title = titleInput ? titleInput.value : "Untitled Video";
    const storageRef = storage.ref('videos/' + Date.now() + '_' + file.name);

    alert("व्हिडिओ अपलोड होत आहे, कृपया वाट पाहा...");

    try {
        // Firebase Storage वर अपलोड करणे
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        // Firestore मध्ये व्हिडिओची माहिती (History साठी) सेव्ह करणे
        await db.collection("videos").add({
            title: title,
            url: downloadURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("व्हिडिओ यशस्वीपणे सेव्ह आणि अपलोड झाला!");
        loadVideoHistory(); // हिस्ट्री रिफ्रेश करणे
    } catch (error) {
        console.error("अपलोड करताना एरर आला: ", error);
        alert("अपलोड अयशस्वी ठरले: " + error.message);
    }
}

// ==========================================
// ४. VIDEO HISTORY (हिस्ट्री लोड करणे)
// ==========================================
function loadVideoHistory() {
    const historyContainer = document.getElementById('history-container');
    if (!historyContainer) return;

    historyContainer.innerHTML = "<p>लोद होत आहे...</p>";

    db.collection("videos").orderBy("createdAt", "desc").get().then((querySnapshot) => {
        historyContainer.innerHTML = "";
        if (querySnapshot.empty) {
            historyContainer.innerHTML = "<p>कोणतीही हिस्ट्री उपलब्ध नाही.</p>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const videoElement = document.createElement('div');
            videoElement.className = 'history-item';
            videoElement.innerHTML = `
                <h3>${data.title || 'कोनतेही शीर्षक नाही'}</h3>
                <video width="100%" controls src="${data.url}"></video>
                <hr>
            `;
            historyContainer.appendChild(videoElement);
        });
    }).catch((error) => {
        console.error("हिस्ट्री लोड करण्यात एरर: ", error);
        historyContainer.innerHTML = "<p>हिस्ट्री लोड करण्यात समस्या आली.</p>";
    });
}

// ==========================================
// ५. LIVE STREAMING (SCREEN & AUDIO CAPTURE)
// ==========================================
let localStream = null;

async function startLiveStream() {
    try {
        // स्क्रीन कॅप्चर करणे (Video) सोबत माईकचा आवाज (Audio) घेणे
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true, 
            audio: true 
        });

        // युजरचा स्वतःचा माईक वेगळा ॲड करायचा असल्यास:
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: false 
        });

        // ऑडिओ ट्रॅक स्क्रीन स्ट्रीममध्ये जोडणे जेणेकरून आवाज जाईल
        audioStream.getAudioTracks().forEach(track => {
            screenStream.addTrack(track);
        });

        localStream = screenStream;

        // लोकल व्हिडिओ elementi वर स्ट्रीम दाखवणे (स्वतःला दिसेल)
        const localVideo = document.getElementById('localLiveVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }

        alert("लाईव्ह स्ट्रीम सुरू झाली आहे! स्क्रीन आणि ऑडिओ कॅप्चर होत आहेत.");
        
        // इथे पुढे WebRTC सिग्नलिंकचा कोड टाकता येईल ज्यामुळे हा स्ट्रीम दुसऱ्यापर्यंत जाईल.

    } catch (error) {
        console.error("लाईव्ह सुरू करताना एरर आला:", error);
        alert("लाईव्ह सुरू होऊ शकली नाही. परवानग्या तपासा: " + error.message);
    }
}

function stopLiveStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        const localVideo = document.getElementById('localLiveVideo');
        if (localVideo) {
            localVideo.srcObject = null;
        }
        alert("लाईव्ह स्ट्रीम बंद करण्यात आली.");
    }
}
