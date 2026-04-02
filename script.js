const COLORS = {
  red: "#EA4335",
  blue: "#4285F4",
  yellow: "#FBBC05",
  green: "#34A853",
};

const SEGMENTS = [
  { color: COLORS.red, start: 206, end: 314 },
  { color: COLORS.blue, start: 314, end: 408 },
  { color: COLORS.green, start: 48, end: 138 },
  { color: COLORS.yellow, start: 138, end: 206 },
];

const BORDER_RATIO = 0.04;
const GAP_RATIO = 0.02;

const fileInput = document.getElementById("file-input");
const downloadButton = document.getElementById("download-button");
const status = document.getElementById("status");
const inputPreview = document.getElementById("input-preview");
const inputPlaceholder = document.getElementById("input-placeholder");
const outputCanvas = document.getElementById("output-canvas");
const outputPlaceholder = document.getElementById("output-placeholder");

let outputDataUrl = "";

function setStatus(message) {
  status.textContent = message;
}

function calculateLayout(size) {
  return {
    borderWidth: Math.max(1, Math.round(size * BORDER_RATIO)),
    gapWidth: Math.max(1, Math.round(size * GAP_RATIO)),
  };
}

function drawRing(ctx, size, borderWidth) {
  const center = size / 2;
  const radius = center - borderWidth / 2;

  ctx.save();
  ctx.lineWidth = borderWidth;
  ctx.lineCap = "butt";

  SEGMENTS.forEach((segment) => {
    ctx.beginPath();
    ctx.strokeStyle = segment.color;
    ctx.arc(
      center,
      center,
      radius,
      (segment.start * Math.PI) / 180,
      (segment.end * Math.PI) / 180,
      false
    );
    ctx.stroke();
  });

  ctx.restore();
}

function drawCircularAvatar(ctx, image, size, borderWidth, gapWidth) {
  const avatarDiameter = size - 2 * (borderWidth + gapWidth);
  const avatarX = borderWidth + gapWidth;
  const avatarY = borderWidth + gapWidth;

  const cropSize = Math.min(image.width, image.height);
  const cropX = (image.width - cropSize) / 2;
  const cropY = (image.height - cropSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, avatarDiameter / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropSize,
    cropSize,
    avatarX,
    avatarY,
    avatarDiameter,
    avatarDiameter
  );
  ctx.restore();
}

function renderAvatar(image) {
  const outputSize = Math.min(image.width, image.height);
  const { borderWidth, gapWidth } = calculateLayout(outputSize);

  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  outputCanvas.style.display = "block";
  outputPlaceholder.style.display = "none";

  const ctx = outputCanvas.getContext("2d");
  ctx.clearRect(0, 0, outputSize, outputSize);

  drawRing(ctx, outputSize, borderWidth);

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(
    outputSize / 2,
    outputSize / 2,
    outputSize / 2 - borderWidth,
    0,
    Math.PI * 2
  );
  ctx.fill();

  drawCircularAvatar(ctx, image, outputSize, borderWidth, gapWidth);

  outputDataUrl = outputCanvas.toDataURL("image/png");
  downloadButton.disabled = false;
  setStatus(`Generated ${outputSize}x${outputSize} PNG with a ${borderWidth}px color ring and ${gapWidth}px white spacer.`);
}

function handleFile(file) {
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose an image file.");
    return;
  }

  const fileUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    inputPreview.src = fileUrl;
    inputPreview.style.display = "block";
    inputPlaceholder.style.display = "none";
    renderAvatar(image);
    URL.revokeObjectURL(fileUrl);
  };

  image.onerror = () => {
    URL.revokeObjectURL(fileUrl);
    setStatus("This image could not be loaded.");
  };

  image.src = fileUrl;
  setStatus("Rendering avatar...");
}

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

downloadButton.addEventListener("click", () => {
  if (!outputDataUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = outputDataUrl;
  link.download = "google-avatar-frame.png";
  link.click();
});
