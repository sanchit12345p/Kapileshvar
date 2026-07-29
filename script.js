<script src="script.js"></script>
async function startScreenSharing() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const videoElement = document.getElementById('screenView');
        if (videoElement) {
            videoElement.srcObject = stream;
        }
        console.log("स्क्रीन शेअरिंग सुरू झाले आहे.");
    } catch (err) {
        console.error("स्क्रीन शेअरिंग करताना एरर आली: ", err);
    }
}

const shareButton = document.getElementById('shareBtn');
if (shareButton) {
    shareButton.addEventListener('click', startScreenSharing);
}
