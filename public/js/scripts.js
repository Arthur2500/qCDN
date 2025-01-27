document.addEventListener("DOMContentLoaded", function() {

  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("fileInput");
  const progressBar = document.getElementById("progressBar");
  const progressBarFill = document.getElementById("progressBarFill");
  const cancelUploadBtn = document.getElementById("cancelUploadBtn");
  const uploadResult = document.getElementById("uploadResult");
  const uploadedFileLink = document.getElementById("uploadedFileLink");
  const copyLinkButton = document.getElementById("copyLinkButton");
  const closeResultButton = document.getElementById("closeResultButton");
  const messageDiv = document.getElementById("message");

  let currentUploadRequest = null;

  function showMessage(type, text) {
    if (!messageDiv) return;
    messageDiv.style.display = "block";
    messageDiv.textContent = text;

    if (type === "error") {
      messageDiv.style.backgroundColor = "#f8d7da";
      messageDiv.style.color = "#721c24";
    } else if (type === "success") {
      messageDiv.style.backgroundColor = "#d4edda";
      messageDiv.style.color = "#155724";
    } else {
      messageDiv.style.backgroundColor = "#cce5ff";
      messageDiv.style.color = "#004085";
    }

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
    xhr.open("POST", "/upload", true);
    currentUploadRequest = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressBarFill.style.width = `${percentComplete}%`;
      }
    });

    xhr.onload = function() {
      currentUploadRequest = null;
      progressBar.style.display = "none";
      progressBarFill.style.width = "0%";
      cancelUploadBtn.style.display = "none";
      fileInput.value = "";

      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            showUploadResult(response.url);
          } else {
            showMessage("error", "Upload fehlgeschlagen (Server-Antwort).");
          }
        } catch (err) {
          console.error(err);
          showMessage("error", "Upload fehlgeschlagen (ungültige JSON-Antwort).");
        }
      } else {
        showMessage("error", "Upload fehlgeschlagen (Serverfehler).");
      }
    };

    xhr.onerror = function() {
      currentUploadRequest = null;
      progressBar.style.display = "none";
      progressBarFill.style.width = "0%";
      cancelUploadBtn.style.display = "none";
      fileInput.value = "";
      showMessage("error", "Upload fehlgeschlagen (Netzwerkfehler).");
    };

    xhr.send(formData);
  }

  function showUploadResult(url) {
    uploadedFileLink.textContent = url;
    uploadResult.style.display = "block";

    copyLinkButton.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        showMessage("success", "Link kopiert!");
      });
    };

    closeResultButton.onclick = () => {
      uploadResult.style.display = "none";
      window.location.reload();
    };
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
      showMessage("info", "Upload abgebrochen.");
    });
  }

  if (dropArea) {
    dropArea.addEventListener("click", () => {
      fileInput.click();
    });

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

  const copyBtns = document.querySelectorAll(".copy-btn");
  copyBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const url = e.target.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        showMessage("success", "Link kopiert!");
      });
    });
  });

  const deleteBtns = document.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const hash = e.target.dataset.hash;
      fetch(`/delete/${hash}`, { method: "DELETE" })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showMessage("success", "Datei gelöscht.");
            window.location.reload();
          } else {
            showMessage("error", "Konnte Datei nicht löschen: " + data.message);
          }
        })
        .catch(err => {
          console.error(err);
          showMessage("error", "Fehler beim Löschen der Datei.");
        });
    });
  });
});
