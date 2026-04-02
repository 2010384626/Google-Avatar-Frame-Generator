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
const GIF_WORKER_SCRIPT = "https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js";

const fileInput = document.getElementById("file-input");
const downloadButton = document.getElementById("download-button");
const status = document.getElementById("status");
const inputPreview = document.getElementById("input-preview");
const inputPlaceholder = document.getElementById("input-placeholder");
const outputPreview = document.getElementById("output-preview");
const outputPlaceholder = document.getElementById("output-placeholder");

let activeJobId = 0;
let outputUrl = "";
let outputFileName = "";
let currentInputObjectUrl = "";
let currentOutputObjectUrl = "";

function setStatus(message) {
  status.textContent = message;
}

function revokeObjectUrl(url) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function setDownloadState(enabled, label) {
  downloadButton.disabled = !enabled;
  downloadButton.textContent = label;
}

function resetOutputPreview() {
  revokeObjectUrl(currentOutputObjectUrl);
  currentOutputObjectUrl = "";
  outputUrl = "";
  outputFileName = "";
  outputPreview.removeAttribute("src");
  outputPreview.style.display = "none";
  outputPlaceholder.style.display = "block";
  setDownloadState(false, "Download");
}

function setInputPreview(fileUrl) {
  revokeObjectUrl(currentInputObjectUrl);
  currentInputObjectUrl = fileUrl;
  inputPreview.src = fileUrl;
  inputPreview.style.display = "block";
  inputPlaceholder.style.display = "none";
}

function setOutputPreview(url, fileName) {
  revokeObjectUrl(currentOutputObjectUrl);
  currentOutputObjectUrl = url.startsWith("blob:") ? url : "";
  outputUrl = url;
  outputFileName = fileName;
  outputPreview.src = url;
  outputPreview.style.display = "block";
  outputPlaceholder.style.display = "none";
  setDownloadState(true, fileName.endsWith(".gif") ? "Download GIF" : "Download PNG");
}

function getBaseName(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? fileName : fileName.slice(0, lastDot);
}

function resolveGifDelay(delay) {
  if (delay === undefined || delay === null || Number.isNaN(delay)) {
    return 100;
  }
  return Math.max(0, Math.round(delay));
}

function calculateLayout(size) {
  return {
    borderWidth: Math.max(1, Math.round(size * BORDER_RATIO)),
    gapWidth: Math.max(1, Math.round(size * GAP_RATIO)),
  };
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
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

function drawCircularAvatar(ctx, source, sourceWidth, sourceHeight, size, borderWidth, gapWidth) {
  const avatarDiameter = size - 2 * (borderWidth + gapWidth);
  const avatarX = borderWidth + gapWidth;
  const avatarY = borderWidth + gapWidth;

  const cropSize = Math.min(sourceWidth, sourceHeight);
  const cropX = (sourceWidth - cropSize) / 2;
  const cropY = (sourceHeight - cropSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, avatarDiameter / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    source,
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

function renderFrameToCanvas(source, sourceWidth, sourceHeight, outputSize, borderWidth, gapWidth) {
  const canvas = createCanvas(outputSize, outputSize);
  const ctx = canvas.getContext("2d");

  drawRing(ctx, outputSize, borderWidth);

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2 - borderWidth, 0, Math.PI * 2);
  ctx.fill();

  drawCircularAvatar(ctx, source, sourceWidth, sourceHeight, outputSize, borderWidth, gapWidth);
  return canvas;
}

function publishStaticCanvas(canvas, fileName) {
  const url = canvas.toDataURL("image/png");
  setOutputPreview(url, fileName);
}

function getGifuctApi() {
  return window.GIFUCT || window.gifuctjs || window.gifuctJs || window.gifuct || null;
}

function applyPreviousFrameDisposal(ctx, previousFrame, previousSnapshot) {
  if (!previousFrame) {
    return;
  }

  if (previousFrame.disposalType === 2) {
    ctx.clearRect(
      previousFrame.dims.left,
      previousFrame.dims.top,
      previousFrame.dims.width,
      previousFrame.dims.height
    );
  } else if (previousFrame.disposalType === 3 && previousSnapshot) {
    ctx.putImageData(previousSnapshot, 0, 0);
  }
}

async function renderAnimatedGif(file, jobId) {
  const gifuct = getGifuctApi();
  if (!gifuct) {
    throw new Error("GIF support library could not be loaded.");
  }

  const arrayBuffer = await file.arrayBuffer();
  if (jobId !== activeJobId) {
    return;
  }

  const decodedGif = new gifuct(arrayBuffer);
  const frames = decodedGif.decompressFrames(true);

  if (!frames.length) {
    throw new Error("This GIF does not contain any readable frames.");
  }

  if (frames.length === 1) {
    const singleFrameImage = new Image();
    singleFrameImage.src = currentInputObjectUrl;
    await singleFrameImage.decode();
    if (jobId !== activeJobId) {
      return;
    }

    const outputSize = Math.min(singleFrameImage.width, singleFrameImage.height);
    const { borderWidth, gapWidth } = calculateLayout(outputSize);
    const canvas = renderFrameToCanvas(
      singleFrameImage,
      singleFrameImage.width,
      singleFrameImage.height,
      outputSize,
      borderWidth,
      gapWidth
    );
    publishStaticCanvas(canvas, `${getBaseName(file.name)}_google_frame.png`);
    setStatus(`Generated ${outputSize}x${outputSize} PNG from a single-frame GIF.`);
    return;
  }

  const gifWidth = decodedGif.raw.lsd.width;
  const gifHeight = decodedGif.raw.lsd.height;
  const outputSize = Math.min(gifWidth, gifHeight);
  const { borderWidth, gapWidth } = calculateLayout(outputSize);

  const compositingCanvas = createCanvas(gifWidth, gifHeight);
  const compositingCtx = compositingCanvas.getContext("2d");

  const encoder = new GIF({
    workers: 2,
    quality: 10,
    width: outputSize,
    height: outputSize,
    workerScript: GIF_WORKER_SCRIPT,
    repeat: 0,
  });

  let previousFrame = null;
  let previousSnapshot = null;

  frames.forEach((frame) => {
    applyPreviousFrameDisposal(compositingCtx, previousFrame, previousSnapshot);
    const nextSnapshot = frame.disposalType === 3
      ? compositingCtx.getImageData(0, 0, gifWidth, gifHeight)
      : null;

    const patchCanvas = createCanvas(frame.dims.width, frame.dims.height);
    const patchCtx = patchCanvas.getContext("2d");
    const patchData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height
    );
    patchCtx.putImageData(patchData, 0, 0);
    compositingCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

    const outputCanvas = renderFrameToCanvas(
      compositingCanvas,
      gifWidth,
      gifHeight,
      outputSize,
      borderWidth,
      gapWidth
    );

    encoder.addFrame(outputCanvas, {
      copy: true,
      delay: resolveGifDelay(frame.delay),
      dispose: 2,
    });

    previousFrame = frame;
    previousSnapshot = nextSnapshot;
  });

  const gifBlob = await new Promise((resolve, reject) => {
    encoder.on("finished", resolve);
    encoder.on("abort", () => reject(new Error("GIF encoding was aborted.")));
    encoder.render();
  });

  if (jobId !== activeJobId) {
    return;
  }

  const gifUrl = URL.createObjectURL(gifBlob);
  setOutputPreview(gifUrl, `${getBaseName(file.name)}_google_frame.gif`);
  setStatus(`Generated animated GIF with ${frames.length} frames at ${outputSize}x${outputSize}.`);
}

async function renderStaticImage(file, jobId) {
  const image = new Image();
  image.src = currentInputObjectUrl;
  await image.decode();

  if (jobId !== activeJobId) {
    return;
  }

  const outputSize = Math.min(image.width, image.height);
  const { borderWidth, gapWidth } = calculateLayout(outputSize);
  const canvas = renderFrameToCanvas(
    image,
    image.width,
    image.height,
    outputSize,
    borderWidth,
    gapWidth
  );

  publishStaticCanvas(canvas, `${getBaseName(file.name)}_google_frame.png`);
  setStatus(`Generated ${outputSize}x${outputSize} PNG with a ${borderWidth}px color ring and ${gapWidth}px white spacer.`);
}

async function handleFile(file) {
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose an image file.");
    return;
  }

  activeJobId += 1;
  const jobId = activeJobId;
  resetOutputPreview();

  const fileUrl = URL.createObjectURL(file);
  setInputPreview(fileUrl);

  try {
    setStatus(file.type === "image/gif" ? "Rendering animated GIF..." : "Rendering avatar...");

    if (file.type === "image/gif") {
      await renderAnimatedGif(file, jobId);
    } else {
      await renderStaticImage(file, jobId);
    }
  } catch (error) {
    if (jobId !== activeJobId) {
      return;
    }

    resetOutputPreview();
    setStatus(error instanceof Error ? error.message : "This image could not be processed.");
  }
}

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

downloadButton.addEventListener("click", () => {
  if (!outputUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = outputUrl;
  link.download = outputFileName || "google-avatar-frame.png";
  link.click();
});
