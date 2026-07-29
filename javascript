// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const storage = firebase.storage();

// WebRTC साठी मोफत Google STUN सर्व्हर (दुसऱ्या फोनला जोडण्यासाठी)
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

let localStream = null;
let peerConnection = null;

// Page लोड झाल्यावर लगेच हिस्ट्री दाखवणे
window.onload = function() {
    listenToHistoryRealtime();
    listenToLiveStreamsRealtime();
};

// ==========================================
// 2. REALTIME HISTORY (दुसऱ्या मोबाईलवर लगेच दिसणार)
// ==========================================
function listenToHistoryRealtime() {
    const historyContainer = document.getElementById('history-container');
    if (!historyContainer) return;

    // onSnapshot मुळे कोणत्याही फोनवरून व्हिडिओ सेव्ह झाला की दुसऱ्या फोनवर ऑटोमॅटिक दिसेल
    db.collection("videos").orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        historyContainer.innerHTML = "";
        if (snapshot.empty) {
            historyContainer.innerHTML = "<p>कोणतीही हिस्ट्री उपलब्ध नाही.</p>";
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const videoItem = document.createElement('div');
            videoItem.className = 'history-item';
            videoItem.style.cssText = "margin-bottom: 15px; background: #222; padding: 10px; border-radius: 8px;";
            videoItem.innerHTML = `
                <h4 style="color: #fff; margin-bottom: 5px;">${data.title || 'व्हिडिओ'}</h4>
                <video width="100%" controls src="${data.url}" style="border-radius: 5px;"></video>
            `;
            historyContainer.appendChild(videoItem);
        });
    }, (error) => {
        console.error("History Error: ", error);
        historyContainer.innerHTML = "<p>डेटा लोड करताना एरर आला. Firebase Rules तपासा.</p>";
    });
}

// ==========================================
// 3. VIDEO UPLOAD & SAVE (Firebase Storage)
// ==========================================
async function uploadAndSaveVideo(fileInputId, titleInputId) {
    const fileInput = document.getElementById(fileInputId);
    const titleInput = document.getElementById(titleInputId);

    if (!fileInput || !fileInput.files[0]) {
        alert("कृपया आधी व्हिडिओ निवडा!");
        return;
    }

    const file = fileInput.files[0];
    const title = titleInput ? titleInput.value : "My Video";
    const fileName = Date.now() + '_' + file.name;
    const storageRef = storage.ref('videos/' + fileName);

    alert("व्हिडिओ सेव्ह होतोय... थोडा वेळ थांब!");

    try {
        const uploadTask = await storageRef.put(file);
        const downloadURL = await uploadTask.ref.getDownloadURL();

        // Firestore मध्ये सेव्ह करणे
        await db.collection("videos").add({
            title: title,
            url: downloadURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("व्हिडिओ यशस्वीपणे सेव्ह झाला! आता तो हिस्ट्रीमध्ये दिसेल.");
    } catch (error) {
        console.error("Upload Error: ", error);
        alert("सेव्ह अयशस्वी: " + error.message);
    }
}

// ==========================================
// 4. LIVE STREAMING (SCREEN + AUDIO BROADCAST)
// ==========================================
async function startLiveStream() {
    try {
        // १. स्क्रीन आणि सिस्टीम ऑडिओ कॅप्चर करणे
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        // २. माईकचा आवाज कॅप्चर करणे
        let micStream;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch(e) {
            console.log("माईक ऑडिओ मिळाला नाही.");
        }

        // ३. स्क्रीन आणि माईक ऑडिओ एकत्र करणे
        localStream = new MediaStream();
        
        displayStream.getTracks().forEach(track => localStream.addTrack(track));
        if (micStream) {
            micStream.getAudioTracks().forEach(track => localStream.addTrack(track));
        }

        const localVideo = document.getElementById('localLiveVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }

        // 💡 WebRTC Connection सुरू करणे (दुसऱ्या फोनला पाठवण्यासाठी)
        peerConnection = new RTCPeerConnection(servers);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const liveDoc = db.collection('lives').doc('currentStream');
        const offerCandidates = liveDoc.collection('offerCandidates');
        const answerCandidates = liveDoc.collection('answerCandidates');

        peerConnection.onicecandidate = (event) => {
            event.candidate && offerCandidates.add(event.candidate.toJSON());
        };

        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
            isLive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await liveDoc.set({ offer });

        // समोरच्या फोनकडून उत्तर (Answer) ऐकणे
        liveDoc.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (peerConnection && !peerConnection.currentRemoteDescription && data && data.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                peerConnection.setRemoteDescription(answerDescription);
            }
        });

        answerCandidates.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    peerConnection.addIceCandidate(candidate);
                }
            });
        });

        alert("🔴 लाईव्ह सुरू झाले आहे! आता दुसऱ्या फोनवर व्हिडिओ आणि आवाज दोन्ही दिसेल.");

    } catch (error) {
        console.error("Live Error: ", error);
        alert("लाईव्ह सुरू करताना अडचण आली: " + error.message);
    }
}

// ==========================================
// 5. RECEIVE LIVE STREAM (दुसऱ्या फोनसाठी)
// ==========================================
async function watchLiveStream(remoteVideoElementId) {
    peerConnection = new RTCPeerConnection(servers);
    const remoteStream = new MediaStream();

    const remoteVideo = document.getElementById(remoteVideoElementId);
    if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
    }

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    const liveDoc = db.collection('lives').doc('currentStream');
    const offerCandidates = liveDoc.collection('offerCandidates');
    const answerCandidates = liveDoc.collection('answerCandidates');

    peerConnection.onicecandidate = (event) => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const liveData = (await liveDoc.get()).data();
    if (!liveData || !liveData.offer) {
        alert("सध्या कोणतीही लाईव्ह स्ट्रीम चालू नाही!");
        return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(liveData.offer));

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await liveDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                let data = change.doc.data();
                peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
}
