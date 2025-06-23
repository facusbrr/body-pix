const video = document.getElementById("video");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const photo = document.getElementById("photo");
const webcamBtn = document.getElementById("webcamBtn");
const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const videoControls = document.getElementById("videoControls");
let net;
let animationId = null;
let sourceType = null; // "webcam", "video", "image"

async function loadModel() {
  net = await bodyPix.load({
    architecture: "MobileNetV1",
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
  });
}

function stopSegmentation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// Webcam
async function startWebcam() {
  stopSegmentation();
  sourceType = "webcam";
  photo.style.display = "none";
  video.style.display = "";
  videoControls.style.display = "none";
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  video.play();
  await new Promise((res) => (video.onloadedmetadata = res));
  matchCanvasToSource(video);
  segmentStream(video);
}

// Imagen (solo un handler, robusto)
imageInput.addEventListener("change", async (e) => {
  stopSegmentation();
  if (!net) await loadModel();
  sourceType = "image";
  const file = e.target.files[0];
  if (!file) return;
  const imgURL = URL.createObjectURL(file);
  photo.onload = async () => {
    // Ajustar canvas y <img> al tamaño real de la imagen
    canvas.width = photo.naturalWidth;
    canvas.height = photo.naturalHeight;
    photo.width = photo.naturalWidth;
    photo.height = photo.naturalHeight;
    // Si quieres mostrar en tamaño fijo (por CSS, no HTML):
    // photo.style.width = "480px";
    // photo.style.height = "auto";
    // canvas.style.width = "480px";
    // canvas.style.height = "auto";
    // Segmenta usando la imagen real
    const segmentation = await net.segmentPerson(photo, {
      internalResolution: "high",
      segmentationThreshold: 0.7,
    });
    const mask = bodyPix.toMask(segmentation);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
    bodyPix.drawMask(canvas, photo, mask, 0.7, 0, false);
    photo.style.display = "";
    video.style.display = "none";
    videoControls.style.display = "none";
    URL.revokeObjectURL(imgURL);
  };
  photo.src = imgURL;
});

// Video archivo
videoInput.addEventListener("change", async (e) => {
  stopSegmentation();
  if (!net) await loadModel();
  sourceType = "video";
  const file = e.target.files[0];
  if (!file) return;
  const vidURL = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = vidURL;
  video.style.display = "";
  photo.style.display = "none";
  videoControls.style.display = "";
  video.onloadeddata = () => {
    matchCanvasToSource(video);
    video.play();
    segmentStream(video);
  };
  video.onpause = () => stopSegmentation();
  video.onplay = () => segmentStream(video);
});

// Botones de control de video
playBtn.addEventListener("click", () => {
  if (sourceType === "video") {
    video.play();
    segmentStream(video);
  }
});
pauseBtn.addEventListener("click", () => {
  if (sourceType === "video") {
    video.pause();
    stopSegmentation();
  }
});

// Webcam botón
webcamBtn.addEventListener("click", async () => {
  if (!net) await loadModel();
  startWebcam();
});

// Ajustar canvas al tamaño real del source
function matchCanvasToSource(source) {
  let width, height;
  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    width = source.naturalWidth;
    height = source.naturalHeight;
  } else {
    width = source.width;
    height = source.height;
  }
  if (width > 0 && height > 0) {
    canvas.width = width;
    canvas.height = height;
  }
}

// Segmenta frames de un stream (webcam/video)
function segmentStream(source) {
  stopSegmentation();
  matchCanvasToSource(source);
  async function segmentFrame() {
    if (
      (sourceType === "video" && (source.paused || source.ended)) ||
      sourceType === "image"
    )
      return;
    const segmentation = await net.segmentPerson(source, {
      internalResolution: "high",
      segmentationThreshold: 0.7,
    });
    const mask = bodyPix.toMask(segmentation);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    bodyPix.drawMask(canvas, source, mask, 0.7, 0, false);
    animationId = requestAnimationFrame(segmentFrame);
  }
  segmentFrame();
}

// Carga el modelo al iniciar
loadModel();
