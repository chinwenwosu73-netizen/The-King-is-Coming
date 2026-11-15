const canvas = document.querySelector("#flier-canvas");
const context = canvas.getContext("2d");
const photoInput = document.querySelector("#photo-input");
const uploadLabel = document.querySelector("#upload-label");
const downloadButton = document.querySelector("#download-button");
const whatsappButton = document.querySelector("#whatsapp-button");
const instagramButton = document.querySelector("#instagram-button");
const previewEmpty = document.querySelector("#preview-empty");
const previewFrame = document.querySelector(".preview-frame");
const previewCaption = document.querySelector("#preview-caption");
const adjustmentsPanel = document.querySelector("#photo-adjustments");
const statusMessage = document.querySelector("#status-message");
const adjustmentControls = {
  zoom: document.querySelector("#zoom-control"),
  rotation: document.querySelector("#rotation-control"),
  offsetX: document.querySelector("#horizontal-control"),
  offsetY: document.querySelector("#vertical-control"),
  flipX: document.querySelector("#flip-horizontal"),
  flipY: document.querySelector("#flip-vertical"),
  reset: document.querySelector("#reset-adjustments"),
};
const imageCache = new Map();
const defaultAdjustment = Object.freeze({
  zoom: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  flipX: false,
  flipY: false,
});
const photoAdjustment = { ...defaultAdjustment };

const templates = {
  circle: {
    image: "public/flier-attending-circle.png",
    photo: { x: 233, y: 607, width: 294, height: 294, radius: 147 },
  },
  rectangle: {
    image: "public/flier-attending-rectangle.png",
    photo: { x: 172, y: 605, width: 424, height: 270 },
  },
};

let selectedTemplate = "circle";
let selectedPhoto = null;
let renderedBlob = null;
let renderSequence = 0;
let photoReadSequence = 0;

function showMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function loadImage(src) {
  const cachedImage = imageCache.get(src);
  if (cachedImage) return cachedImage;

  const imagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image could not be loaded."));
    image.src = src;
  });
  imageCache.set(src, imagePromise);
  imagePromise.catch(() => imageCache.delete(src));
  return imagePromise;
}

function getImageLayout(image, area) {
  const radians = (photoAdjustment.rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const rotatedWidth = image.naturalWidth * cosine + image.naturalHeight * sine;
  const rotatedHeight = image.naturalWidth * sine + image.naturalHeight * cosine;
  const scale = Math.max(area.width / rotatedWidth, area.height / rotatedHeight) * photoAdjustment.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const boundsWidth = width * cosine + height * sine;
  const boundsHeight = width * sine + height * cosine;

  return {
    radians,
    width,
    height,
    maxShiftX: Math.max(0, (boundsWidth - area.width) / 2),
    maxShiftY: Math.max(0, (boundsHeight - area.height) / 2),
  };
}

function updateAdjustmentControls() {
  adjustmentControls.zoom.value = String(photoAdjustment.zoom);
  adjustmentControls.rotation.value = String(photoAdjustment.rotation);
  adjustmentControls.offsetX.value = String(Math.round(photoAdjustment.offsetX * 100));
  adjustmentControls.offsetY.value = String(Math.round(photoAdjustment.offsetY * 100));
  document.querySelector("#zoom-value").value = `${Math.round(photoAdjustment.zoom * 100)}%`;
  document.querySelector("#rotation-value").value = `${photoAdjustment.rotation}°`;
  document.querySelector("#horizontal-value").value = `${Math.round(photoAdjustment.offsetX * 100)}%`;
  document.querySelector("#vertical-value").value = `${Math.round(photoAdjustment.offsetY * 100)}%`;
  adjustmentControls.flipX.setAttribute("aria-pressed", String(photoAdjustment.flipX));
  adjustmentControls.flipY.setAttribute("aria-pressed", String(photoAdjustment.flipY));
}

function setAdjustmentControlsEnabled(enabled) {
  adjustmentsPanel.hidden = !enabled;
  Object.values(adjustmentControls).forEach((control) => {
    control.disabled = !enabled;
  });
}

function resetPhotoAdjustment() {
  Object.assign(photoAdjustment, defaultAdjustment);
  updateAdjustmentControls();
}

async function renderFlier() {
  const sequence = ++renderSequence;
  const template = templates[selectedTemplate];
  const photoSource = selectedPhoto;
  renderedBlob = null;
  downloadButton.disabled = true;
  whatsappButton.disabled = true;
  instagramButton.disabled = true;
  const background = await loadImage(template.image);

  if (sequence !== renderSequence) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  if (!photoSource) {
    previewEmpty.hidden = false;
    previewFrame.classList.remove("has-photo");
    previewEmpty.classList.toggle("is-rectangle", selectedTemplate === "rectangle");
    setAdjustmentControlsEnabled(false);
    previewCaption.textContent = "Your photo stays on this device until you choose to share it.";
    return;
  }

  const photo = await loadImage(photoSource);
  if (sequence !== renderSequence) return;
  const area = template.photo;
  const layout = getImageLayout(photo, area);
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  context.save();
  if (area.radius) {
    context.beginPath();
    context.arc(centerX, centerY, area.radius, 0, Math.PI * 2);
    context.clip();
  } else {
    context.beginPath();
    context.rect(area.x, area.y, area.width, area.height);
    context.clip();
  }
  context.translate(
    centerX + photoAdjustment.offsetX * layout.maxShiftX,
    centerY + photoAdjustment.offsetY * layout.maxShiftY,
  );
  context.rotate(layout.radians);
  context.scale(photoAdjustment.flipX ? -1 : 1, photoAdjustment.flipY ? -1 : 1);
  context.drawImage(photo, -layout.width / 2, -layout.height / 2, layout.width, layout.height);
  context.restore();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The flier image could not be created."));
    }, "image/png");
  });
  if (sequence !== renderSequence) return;
  renderedBlob = blob;
  previewEmpty.hidden = true;
  previewFrame.classList.add("has-photo");
  previewCaption.textContent = "Drag your photo inside the frame to reposition it.";
  setAdjustmentControlsEnabled(true);
  updateAdjustmentControls();
  downloadButton.disabled = false;
  whatsappButton.disabled = false;
  instagramButton.disabled = false;
}

function downloadFlier() {
  if (!renderedBlob) return;
  const url = URL.createObjectURL(renderedBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "the-king-is-coming-im-attending.png";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showMessage("Your flier is ready — see you there!");
}

async function shareToPlatform(platform) {
  if (!renderedBlob) return;
  const file = new File([renderedBlob], "the-king-is-coming-im-attending.png", { type: "image/png" });
  const shareData = {
    title: "I’m attending The King Is Coming",
    text: "I’ll be at The King Is Coming — inaugural service, Lagos, 22 November 2026.",
    files: [file],
  };

  try {
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share(shareData);
      showMessage(`Share menu closed. Finish sending or posting your flier in ${platform}.`);
      return;
    }

    downloadFlier();
    if (platform === "WhatsApp") {
      const url = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      showMessage("WhatsApp opened. Attach the downloaded flier to your message.");
    } else {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      showMessage("Instagram opened. Add the downloaded flier to your post or story.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    showMessage(`Sharing to ${platform} isn’t available here. Download your flier and attach it in the app.`, true);
  }
}

document.querySelectorAll(".template-option").forEach((button) => {
  button.addEventListener("click", async () => {
    selectedTemplate = button.dataset.template;
    document.querySelectorAll(".template-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    try {
      await renderFlier();
      showMessage("");
    } catch {
      showMessage("The flier template could not be loaded. Please refresh and try again.", true);
    }
  });
});

adjustmentControls.zoom.addEventListener("input", () => {
  photoAdjustment.zoom = Number(adjustmentControls.zoom.value);
  updateAdjustmentControls();
  renderFlier().catch((error) => {
    console.error("Could not zoom the selected photo.", error);
    showMessage("The photo adjustment could not be applied.", true);
  });
});

adjustmentControls.rotation.addEventListener("input", () => {
  photoAdjustment.rotation = Number(adjustmentControls.rotation.value);
  updateAdjustmentControls();
  renderFlier().catch((error) => {
    console.error("Could not rotate the selected photo.", error);
    showMessage("The photo adjustment could not be applied.", true);
  });
});

adjustmentControls.offsetX.addEventListener("input", () => {
  photoAdjustment.offsetX = Number(adjustmentControls.offsetX.value) / 100;
  updateAdjustmentControls();
  renderFlier().catch((error) => {
    console.error("Could not move the selected photo.", error);
    showMessage("The photo adjustment could not be applied.", true);
  });
});

adjustmentControls.offsetY.addEventListener("input", () => {
  photoAdjustment.offsetY = Number(adjustmentControls.offsetY.value) / 100;
  updateAdjustmentControls();
  renderFlier().catch((error) => {
    console.error("Could not move the selected photo.", error);
    showMessage("The photo adjustment could not be applied.", true);
  });
});

adjustmentControls.flipX.addEventListener("click", () => {
  photoAdjustment.flipX = !photoAdjustment.flipX;
  updateAdjustmentControls();
  renderFlier().catch((error) => {
    console.error("Could not flip the selected photo.", error);
    showMessage("The photo adjustment could not be applied.", true);
  });
});

adjustmentControls.flipY.addEventListener("click", () => {
  photoAdjustment.flipY = !photoAdjustment.flipY;
  updateAdjustmentControls();
  renderFlier().catch((error) => {
    console.error("Could not flip the selected photo.", error);
    showMessage("The photo adjustment could not be applied.", true);
  });
});

adjustmentControls.reset.addEventListener("click", () => {
  resetPhotoAdjustment();
  renderFlier().catch((error) => {
    console.error("Could not reset the photo adjustments.", error);
    showMessage("The photo adjustment could not be reset.", true);
  });
});

let activeDrag = null;

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (!selectedPhoto) return;
  const area = templates[selectedTemplate].photo;
  const point = getCanvasPoint(event);
  const deltaX = point.x - (area.x + area.width / 2);
  const deltaY = point.y - (area.y + area.height / 2);
  const inPhotoArea = area.radius
    ? deltaX ** 2 + deltaY ** 2 <= area.radius ** 2
    : Math.abs(deltaX) <= area.width / 2 && Math.abs(deltaY) <= area.height / 2;

  if (!inPhotoArea) return;
  activeDrag = { pointerId: event.pointerId, point };
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
  const point = getCanvasPoint(event);
  const area = templates[selectedTemplate].photo;
  const imageWidth = selectedPhoto ? imageCache.get(selectedPhoto) : null;

  if (!imageWidth) return;
  imageWidth.then((image) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const layout = getImageLayout(image, area);
    if (layout.maxShiftX > 0) {
      photoAdjustment.offsetX = Math.max(
        -1,
        Math.min(1, photoAdjustment.offsetX + (point.x - activeDrag.point.x) / layout.maxShiftX),
      );
    }
    if (layout.maxShiftY > 0) {
      photoAdjustment.offsetY = Math.max(
        -1,
        Math.min(1, photoAdjustment.offsetY + (point.y - activeDrag.point.y) / layout.maxShiftY),
      );
    }
    activeDrag.point = point;
    updateAdjustmentControls();
    renderFlier().catch((error) => {
      console.error("Could not move the selected photo.", error);
      showMessage("The photo adjustment could not be applied.", true);
    });
  });
});

function finishDrag(event) {
  if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
  activeDrag = null;
}

canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);

photoInput.addEventListener("change", async () => {
  const sequence = ++photoReadSequence;
  const file = photoInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showMessage("Please choose an image file.", true);
    photoInput.value = "";
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showMessage("That photo is over 12 MB. Please choose a smaller image.", true);
    photoInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    if (sequence === photoReadSequence) showMessage("We couldn’t read that photo. Please try another one.", true);
  };
  reader.onload = async () => {
    if (sequence !== photoReadSequence) return;
    const previousPhoto = selectedPhoto;
    const previousAdjustment = { ...photoAdjustment };
    try {
      selectedPhoto = reader.result;
      resetPhotoAdjustment();
      await renderFlier();
      if (sequence !== photoReadSequence) return;
      uploadLabel.textContent = file.name;
      showMessage("Looking good. Your flier is ready to share.");
    } catch (error) {
      if (sequence !== photoReadSequence) return;
      selectedPhoto = previousPhoto;
      Object.assign(photoAdjustment, previousAdjustment);
      updateAdjustmentControls();
      try {
        await renderFlier();
      } catch (renderError) {
        console.error("Could not restore the flier preview after a photo error.", renderError);
        showMessage("The flier could not be rendered. Please refresh and try again.", true);
        return;
      }
      console.error("Could not add the selected photo to the flier.", error);
      showMessage("We couldn’t use that photo. Please try another image.", true);
    }
  };
  reader.readAsDataURL(file);
});

downloadButton.addEventListener("click", downloadFlier);
whatsappButton.addEventListener("click", () => shareToPlatform("WhatsApp"));
instagramButton.addEventListener("click", () => shareToPlatform("Instagram"));

renderFlier().catch(() => {
  showMessage("The flier template could not be loaded. Please refresh and try again.", true);
});
