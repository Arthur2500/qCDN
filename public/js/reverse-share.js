document.addEventListener("DOMContentLoaded", function () {
  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("fileInput");
  const progressBar = document.getElementById("progressBar");
  const progressBarFill = document.getElementById("progressBarFill");
  const cancelUploadBtn = document.getElementById("cancelUploadBtn");
  const messageDiv = document.getElementById("message");

  let currentUploadRequest = null;

  function showMessage(type, text) {
    if (!messageDiv) return;
    messageDiv.style.display = "block";
    messageDiv.textContent = text;

    const colors = {
      error: ["#f8d7da", "#721c24"],
      success: ["#d4edda", "#155724"],
      info: ["#cce5ff", "#004085"],
    };

    const [bg, fg] = colors[type] || colors.info;
    messageDiv.style.backgroundColor = bg;
    messageDiv.style.color = fg;

    setTimeout(() => {
      messageDiv.style.display = "none";
    }, 5000);
  }

  function handleFileUpload(file) {
    progressBar.style.display = "block";
    progressBarFill.style.width = "0%";
    cancelUploadBtn.style.display = "inline-block";

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", window.location.pathname, true);
    currentUploadRequest = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressBarFill.style.width = `${percentComplete}%`;
      }
    });

    xhr.onload = function () {
      currentUploadRequest = null;
      progressBar.style.display = "none";
      progressBarFill.style.width = "0%";
      cancelUploadBtn.style.display = "none";
      fileInput.value = "";

      if (xhr.status === 200) {
        // Antwort ist gerenderte HTML-Seite
        document.open();
        document.write(xhr.responseText);
        document.close();
      } else {
        showMessage("error", "Upload failed (server error).");
      }
    };

    xhr.onerror = function () {
      currentUploadRequest = null;
      progressBar.style.display = "none";
      progressBarFill.style.width = "0%";
      cancelUploadBtn.style.display = "none";
      fileInput.value = "";
      showMessage("error", "Upload failed (network error).");
    };

    xhr.send(formData);
  }

  if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener("click", () => {
      if (currentUploadRequest) {
        currentUploadRequest.abort();
        currentUploadRequest = null;
      }
      progressBar.style.display = "none";
      progressBarFill.style.width = "0%";
      cancelUploadBtn.style.display = "none";
      fileInput.value = "";
      dropArea.classList.remove("drag-over");
      showMessage("info", "Upload canceled.");
    });
  }

  if (dropArea) {
    dropArea.addEventListener("click", () => fileInput.click());
    dropArea.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dropArea.classList.add("drag-over");
    });
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropArea.classList.add("drag-over");
    });
    dropArea.addEventListener("dragleave", () => {
      dropArea.classList.remove("drag-over");
    });
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      dropArea.classList.remove("drag-over");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileUpload(fileInput.files[0]);
      }
    });
  }

  const copyBtn = document.getElementById("copyLinkButton");
  if (copyBtn) {
    const linkElem = document.getElementById("uploadedFileLink");
    copyBtn.addEventListener("click", () => {
      if (linkElem) {
        navigator.clipboard.writeText(linkElem.href).then(() => {
          showMessage("success", "Link copied!");
        }).catch(() => {
          showMessage("error", "Clipboard access denied.");
        });
      }
    });
  }
});