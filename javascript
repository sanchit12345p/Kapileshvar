const fileInput = document.getElementById('yourFileInputId'); // तुझ्या फाइल इनपुटची आयडी इथे टाक
const videoElement = document.getElementById('myVideoPlayer');

fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        // जुनी मेमरी पूर्ण साफ करा
        videoElement.src = "";
        
        // सुरक्षितपणे नवीन URL बनवा
        const videoUrl = URL.createObjectURL(file);
        videoElement.src = videoUrl;
        
        // व्हिडिओ प्ले झाल्यावर किंवा बदलल्यावर जुनी लिंक मेमरीतून उडवून लावण्यासाठी
        videoElement.onended = function() {
            URL.revokeObjectURL(videoUrl);
        };
    }
});
