// ग्लोबल व्हेरिएबल मेमरी ट्रॅक करण्यासाठी
let activeVideoUrl = null;

// जेव्हा युजर व्हिडिओ निवडेल किंवा प्ले करेल तेव्हा हे फंक्शन वापर:
function loadAndPlayVideo(videoFile) {
    const videoElement = document.getElementById('myVideoPlayer'); // तुझ्या व्हिडिओ टॅगची ID इथे टाक
    
    if (!videoElement) return;

    // आधीची मेमरी पूर्णपणे मोकळी करा (महत्त्वाचे: यामुळे 'Aw, Snap!' एरर येत नाही)
    if (activeVideoUrl) {
        URL.revokeObjectURL(activeVideoUrl);
        activeVideoUrl = null;
    }

    try {
        // नवीन व्हिडिओसाठी सुरक्षित URL तयार करा
        activeVideoUrl = URL.createObjectURL(videoFile);
        videoElement.src = activeVideoUrl;
        
        // व्हिडिओ लोड करा
        videoElement.load();
    } catch (error) {
        console.error("व्हिडिओ लोड करताना एरर आला:", error);
    }
}

// पेज बंद करताना किंवा व्हिडिओ बदलताना मेमरी आपोआप साफ होईल
window.addEventListener('beforeunload', function() {
    if (activeVideoUrl) {
        URL.revokeObjectURL(activeVideoUrl);
    }
});
