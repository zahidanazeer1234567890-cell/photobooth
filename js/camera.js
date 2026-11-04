(function () {
  'use strict';
  var video = document.getElementById('camera-video');
  var placeholder = document.getElementById('camera-placeholder');
  var cameraStatus = document.getElementById('camera-status');
  var enableCameraButton = document.getElementById('enable-camera');
  var captureButton = document.getElementById('capture-button');
  var saveButton = document.getElementById('save-strip');
  var printButton = document.getElementById('print-strip');
  var printPhotos = document.getElementById('a4-print-photos');
  var printPlaceholder = document.getElementById('print-image-placeholder');
  var printDate = document.getElementById('print-date');
  var stripPhotos = document.getElementById('strip-photos');
  var stripPreview = document.getElementById('strip-preview');
  var countdown = document.getElementById('countdown-overlay');
  var statusMessage = document.getElementById('capture-status');
  var photoUpload = document.getElementById('photo-upload');
  var guestCodesPanel = document.getElementById('guest-codes-panel');
  var guestCodesList = document.getElementById('guest-codes-list');
  var shotCodeStates = [];
  var codeJobs = 0;
  var stream = null;
  var cameraConnecting = false;
  var stillImage = null;
  var photos = [];
  var savedShotMemories = [];
  var selectedLayout = 'strip';
  var selectedFilter = 'normal';
  var selectedFrame = 'pink';
  var timerSeconds = 0;
  var timerId = null;
  var previewGeneration = 0;
  var sharingPending = false;

  var filterStyles = {
    normal: 'none',
    mono: 'grayscale(1)',
    vintage: 'sepia(.55) contrast(1.08)',
    sepia: 'sepia(1)',
    warm: 'sepia(.24) saturate(1.2)',
    cool: 'hue-rotate(12deg) saturate(.9)',
    faded: 'saturate(.7) contrast(.85) brightness(1.08)',
    dramatic: 'contrast(1.3) saturate(1.15)'
  };
  var frameStyles = {
    pink: { base: '#e986ad', dark: false },
    blue: { base: '#5b9bd5', dark: false },
    burgundy: { base: '#842d48', dark: true },
    lavender: { base: '#9b7bb8', dark: false },
    sage: { base: '#71866b', dark: false },
    yellow: { base: '#d9af45', dark: false },
    peach: { base: '#e99479', dark: false },
    teal: { base: '#368d8d', dark: true },
    navy: { base: '#30456d', dark: true },
    black: { base: '#242424', dark: true },
    cream: { base: '#e8d6b8', dark: false },
    red: { base: '#c34b4b', dark: true }
  };
  function targetCount() {
    return selectedLayout === 'single' ? 1 : selectedLayout === 'duo' ? 2 : selectedLayout === 'trio' ? 3 : 4;
  }

  function showStatus(message) {
    statusMessage.textContent = message;
  }

  function clearGuestCodes() {
    guestCodesList.replaceChildren();
    guestCodesPanel.hidden = true;
  }

  function showGuestCodes() {
    guestCodesList.replaceChildren();
    shotCodeStates.forEach(function (state, index) {
      var card = document.createElement('article');
      card.className = 'guest-code-card';
      var title = document.createElement('span');
      title.className = 'guest-code-photo-label';
      title.textContent = 'Photo ' + (index + 1);
      card.appendChild(title);
      var memory = state && state.memory;
      if (state && state.status === 'ready' && window.FlashbackStorage.hasActiveAccess(memory)) {
        var code = document.createElement('strong');
        code.className = 'guest-code-value';
        code.textContent = memory.accessCode;
        var expiry = document.createElement('time');
        expiry.dateTime = memory.accessExpiresAt;
        expiry.textContent = 'Expires ' + new Date(memory.accessExpiresAt).toLocaleString();
        var copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'button button-outline';
        copy.textContent = 'Copy code';
        copy.addEventListener('click', function () {
          window.FlashbackStorage.copyText(memory.accessCode).then(function () {
            copy.textContent = 'Copied!';
            globalThis.setTimeout(function () { copy.textContent = 'Copy code'; }, 1800);
          }).catch(function (error) {
            showStatus(error.message);
          });
        });
        card.append(code, expiry, copy);
      } else {
        var status = document.createElement('p');
        status.className = 'guest-code-status';
        status.textContent = state && state.status === 'failed' ? state.error : 'Creating private code…';
        card.appendChild(status);
        if (state && state.status === 'failed') {
          var retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'button button-outline';
          retry.textContent = 'Try again';
          retry.addEventListener('click', function () { createGuestCode(index); });
          card.appendChild(retry);
        }
      }
      guestCodesList.appendChild(card);
    });
    guestCodesPanel.hidden = guestCodesList.childElementCount === 0;
    if (!guestCodesPanel.hidden) guestCodesPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setSharingPending(pending) {
    sharingPending = pending;
    updateBusyControls();
  }

  function updateBusyControls() {
    var busy = sharingPending || codeJobs > 0;
    document.querySelectorAll('.control-panel button').forEach(function (button) { button.disabled = busy; });
    document.getElementById('clear-photos').disabled = busy;
    photoUpload.disabled = busy;
    saveButton.disabled = sharingPending || codeJobs > 0 || photos.length === 0;
    captureButton.disabled = busy || photos.length >= targetCount();
    refreshPrintPreview();
  }

  function cameraIsLive() {
    return !!(stream && stream.getTracks().some(function (track) { return track.readyState === 'live'; }));
  }

  function updateStrip() {
    stripPhotos.replaceChildren();
    stripPhotos.className = 'strip-photos layout-' + selectedLayout;
    photos.forEach(function (photo) {
      var frameStyle = frameStyles[photo.frame] || frameStyles.pink;
      var framedPhoto = document.createElement('div');
      framedPhoto.className = 'captured-photo';
      framedPhoto.style.backgroundColor = frameStyle.base;
      var image = document.createElement('img');
      image.src = photo.dataUrl;
      image.alt = 'Captured photobooth moment';
      image.style.filter = filterStyles[photo.filter || 'normal'];
      framedPhoto.appendChild(image);
      stripPhotos.appendChild(framedPhoto);
    });
    if (!photos.length) {
      var empty = document.createElement('div');
      empty.className = 'strip-empty';
      empty.innerHTML = 'Your captured photos<br>will show up here ♡';
      stripPhotos.appendChild(empty);
    }
    saveButton.disabled = sharingPending || codeJobs > 0 || photos.length === 0;
    captureButton.disabled = sharingPending || photos.length >= targetCount();
    captureButton.innerHTML = photos.length >= targetCount() ? '✓ &nbsp; Strip complete' : '▣ &nbsp; Take Photo' + (photos.length ? ' (' + (photos.length + 1) + '/' + targetCount() + ')' : '');
    refreshPrintPreview();
  }

  function refreshPrintPreview() {
    var generation = ++previewGeneration;
    printPhotos.replaceChildren();
    if (!photos.length) {
      printPlaceholder.innerHTML = 'Take photos to create a private code for each picture';
      printPhotos.appendChild(printPlaceholder);
      printButton.disabled = true;
      return;
    }
    printDate.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    var hasSavedCodes = photos.length > 0 && photos.every(function (photo, index) {
      return window.FlashbackStorage.hasActiveAccess(savedShotMemories[index]);
    });
    printButton.disabled = sharingPending || !hasSavedCodes;
    if (!hasSavedCodes) {
      var note = document.createElement('p');
      note.className = 'print-qr-note';
      note.textContent = 'Each photo gets its private code immediately after capture.';
      printPhotos.appendChild(note);
    }
    photos.forEach(function (photo, index) {
      var row = document.createElement('div');
      row.className = 'print-photo-row';
      var image = document.createElement('img');
      image.className = 'print-photo-image';
      image.alt = 'Photo ' + (index + 1);
      image.src = savedShotMemories[index] && savedShotMemories[index].dataUrl ? savedShotMemories[index].dataUrl : photo.dataUrl;
      var details = document.createElement('div');
      details.className = 'print-photo-details';
      var label = document.createElement('span');
      label.textContent = 'PHOTO ' + String(index + 1).padStart(2, '0');
      details.appendChild(label);
      if (window.FlashbackStorage.hasActiveAccess(savedShotMemories[index])) {
        var accessCode = document.createElement('strong');
        accessCode.className = 'print-access-code';
        accessCode.textContent = savedShotMemories[index].accessCode;
        details.appendChild(accessCode);
        var expires = document.createElement('small');
        expires.textContent = 'Valid 24 hours · ' + new Date(savedShotMemories[index].accessExpiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        details.appendChild(expires);
      } else {
        var pending = document.createElement('small');
        pending.textContent = shotCodeStates[index] && shotCodeStates[index].status === 'failed' ? 'Code unavailable — see the guest-code panel to retry' : 'Code appears after this photo is captured';
        details.appendChild(pending);
      }
      row.append(image, details);
      printPhotos.appendChild(row);
    });
  }

  function loadCamera() {
    if (cameraConnecting || cameraIsLive()) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showStatus('Camera access is unavailable in this browser. Upload a photo instead.');
      cameraStatus.textContent = 'Camera unavailable';
      return;
    }
    cameraConnecting = true;
    enableCameraButton.disabled = true;
    cameraStatus.textContent = 'Connecting…';
    showStatus('Requesting camera access…');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (newStream) {
      stream = newStream;
      video.srcObject = stream;
      return Promise.resolve(video.play());
    }).then(function () {
      placeholder.hidden = true;
      cameraStatus.textContent = 'Camera ready';
      showStatus('');
    }).catch(function (error) {
      if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
      video.srcObject = null;
      placeholder.hidden = false;
      cameraStatus.textContent = 'Camera not connected';
      var messages = {
        NotAllowedError: 'Camera permission was denied. Allow camera access in your browser settings and try again.',
        SecurityError: 'Camera access requires a secure page (HTTPS or localhost). Open the site securely or upload a photo.',
        NotFoundError: 'No camera was found. Connect a camera or upload a photo.',
        NotReadableError: 'The camera could not start. Close other apps using it, check its privacy shutter, and try again.'
      };
      showStatus(messages[error.name] || 'The camera could not connect' + (error.message ? ': ' + error.message : '. Upload a photo instead.'));
    }).finally(function () {
      cameraConnecting = false;
      enableCameraButton.disabled = false;
    });
  }

  function countdownThenCapture() {
    if (timerId) globalThis.clearInterval(timerId);
    var remaining = timerSeconds;
    if (!remaining) {
      capturePhoto();
      return;
    }
    countdown.textContent = String(remaining);
    countdown.classList.add('active');
    timerId = globalThis.setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        globalThis.clearInterval(timerId);
        timerId = null;
        countdown.classList.remove('active');
        capturePhoto();
      } else {
        countdown.textContent = String(remaining);
      }
    }, 1000);
  }

  function capturePhoto() {
    var source = stillImage || video;
    var sourceWidth = stillImage ? stillImage.naturalWidth : video.videoWidth;
    var sourceHeight = stillImage ? stillImage.naturalHeight : video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      showStatus('The camera is not ready yet. Wait a moment and try again.');
      return;
    }
    var scale = Math.min(1, 1280 / sourceWidth);
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    var context = canvas.getContext('2d');
    if (!stillImage) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    var photo = { dataUrl: canvas.toDataURL('image/jpeg', 0.84), frame: selectedFrame, filter: selectedFilter };
    photos.push(photo);
    var photoIndex = photos.length - 1;
    updateStrip();
    showStatus('Photo ' + (photoIndex + 1) + ' captured. Creating its private guest code…');
    createGuestCode(photoIndex);
  }

  function createGuestCode(index) {
    var photo = photos[index];
    if (!photo) return;
    var existingState = shotCodeStates[index];
    var memory = existingState && existingState.memory;
    shotCodeStates[index] = { status: 'creating', memory: memory || null };
    codeJobs += 1;
    showGuestCodes();
    updateBusyControls();
    var prepareMemory = memory ? Promise.resolve(memory) : renderPhoto(photo).then(function (dataUrl) {
      var saved = window.FlashbackStorage.save({
        title: 'Photo ' + (index + 1),
        type: 'photo',
        dataUrl: dataUrl
      });
      savedShotMemories[index] = saved;
      shotCodeStates[index].memory = saved;
      return saved;
    });
    prepareMemory.then(function (savedMemory) {
      return window.FlashbackStorage.publish(savedMemory);
    }).then(function (published) {
      savedShotMemories[index] = published;
      shotCodeStates[index] = { status: 'ready', memory: published };
      showStatus('Photo ' + (index + 1) + ' code is ready. ' +
        (photos.length === targetCount() ? 'Your photo set is complete.' : 'Take the next photo or save your strip.'));
    }).catch(function (error) {
      shotCodeStates[index] = { status: 'failed', memory: memory || savedShotMemories[index] || null, error: error.message };
      showStatus('Photo ' + (index + 1) + ' was captured, but its guest code could not be created: ' + error.message);
    }).finally(function () {
      codeJobs = Math.max(0, codeJobs - 1);
      showGuestCodes();
      updateBusyControls();
    });
  }

  function renderPhoto(photo) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 1200;
        var context = canvas.getContext('2d');
        var frameStyle = frameStyles[photo.frame] || frameStyles.pink;
        context.fillStyle = frameStyle.base;
        context.fillRect(0, 0, canvas.width, canvas.height);
        var inset = 30;
        var innerWidth = canvas.width - inset * 2;
        var innerHeight = canvas.height - inset * 2;
        var scale = Math.min(innerWidth / image.width, innerHeight / image.height);
        var drawWidth = image.width * scale;
        var drawHeight = image.height * scale;
        context.filter = filterStyles[photo.filter || 'normal'];
        context.drawImage(image, inset + (innerWidth - drawWidth) / 2, inset + (innerHeight - drawHeight) / 2, drawWidth, drawHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      image.onerror = function () { reject(new Error('A captured photo could not be prepared for printing.')); };
      image.src = photo.dataUrl;
    });
  }

  function renderStrip(includeBackground) {
    return new Promise(function (resolve, reject) {
      if (!photos.length) {
        reject(new Error('Take at least one photo before saving your strip.'));
        return;
      }
      var width = selectedLayout === 'strip' ? 480 : selectedLayout === 'duo' ? 900 : selectedLayout === 'trio' ? 900 : 720;
      var columns = selectedLayout === 'duo' || selectedLayout === 'trio' ? 2 : 1;
      var rows = Math.ceil(photos.length / columns);
      var gap = 14;
      var padding = 42;
      var imageWidth = columns === 1 ? width - padding * 2 : 420;
      var imageHeight = selectedLayout === 'strip' ? 230 : selectedLayout === 'duo' ? 310 : selectedLayout === 'trio' ? 280 : 420;
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = padding * 2 + rows * imageHeight + Math.max(0, rows - 1) * gap + 86;
      var context = canvas.getContext('2d');
      if (includeBackground !== false) {
        context.fillStyle = '#f7f0df';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      var loadJobs = photos.map(function (src, index) {
        return new Promise(function (imageResolve, imageReject) {
          var image = new Image();
          image.onload = function () {
            var photo = photos[index];
            var frameStyle = frameStyles[photo.frame] || frameStyles.pink;
            var col = index % columns;
            var row = Math.floor(index / columns);
            var cellWidth = imageWidth;
            var x = columns === 1 ? padding : Math.round((width - columns * imageWidth - (columns - 1) * gap) / 2) + col * (imageWidth + gap);
            var y = padding + row * (imageHeight + gap);
            if (selectedLayout === 'trio' && index === photos.length - 1 && photos.length % 2 === 1) {
              x = Math.round((width - imageWidth) / 2);
              y = padding + row * (imageHeight + gap);
            }
            context.fillStyle = frameStyle.base;
            context.fillRect(x, y, cellWidth, imageHeight);
            var inset = Math.max(3, Math.round(Math.min(cellWidth, imageHeight) * .04));
            var innerWidth = cellWidth - inset * 2;
            var innerHeight = imageHeight - inset * 2;
            var scale = Math.min(innerWidth / image.width, innerHeight / image.height);
            var drawWidth = image.width * scale;
            var drawHeight = image.height * scale;
            var drawX = x + inset + (innerWidth - drawWidth) / 2;
            var drawY = y + inset + (innerHeight - drawHeight) / 2;
            context.save();
            context.filter = filterStyles[photo.filter || 'normal'];
            context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
            context.restore();
            imageResolve();
          };
          image.onerror = function () { imageReject(new Error('A captured photo could not be loaded into the strip.')); };
          image.src = src.dataUrl;
        });
      });
      Promise.all(loadJobs).then(function () {
        var footerY = canvas.height - 58;
        context.textAlign = 'center';
        var lastFrameStyle = frameStyles[photos[photos.length - 1].frame] || frameStyles.pink;
        context.fillStyle = lastFrameStyle.dark ? '#f1dfc1' : '#775335';
        context.font = '15px Georgia';
        if (document.getElementById('stamp-toggle').checked) {
          context.fillText(new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }), width / 2, footerY - 17);
        }
        context.font = 'bold 12px Arial';
        context.letterSpacing = '3px';
        context.fillText('FLASHBACK', width / 2, footerY + 10);
        resolve(canvas.toDataURL(includeBackground === false ? 'image/png' : 'image/jpeg', 0.9));
      }).catch(reject);
    });
  }

  enableCameraButton.addEventListener('click', loadCamera);
  captureButton.addEventListener('click', countdownThenCapture);
  document.getElementById('clear-photos').addEventListener('click', function () {
    if (timerId) globalThis.clearInterval(timerId);
    timerId = null;
    countdown.classList.remove('active');
    photos = [];
    savedShotMemories = [];
    shotCodeStates = [];
    clearGuestCodes();
    stillImage = null;
    placeholder.hidden = cameraIsLive();
    updateStrip();
    showStatus('Ready when you are!');
  });
  document.querySelectorAll('[data-setting="timer"] button').forEach(function (button) {
    button.addEventListener('click', function () {
      timerSeconds = Number(button.dataset.value);
      document.querySelectorAll('[data-setting="timer"] button').forEach(function (item) { item.classList.toggle('selected', item === button); });
    });
  });
  document.querySelectorAll('.layout-choice').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedLayout = button.dataset.layout;
      document.querySelectorAll('.layout-choice').forEach(function (item) { item.classList.toggle('selected', item === button); });
      if (photos.length > targetCount()) {
        photos = photos.slice(0, targetCount());
        savedShotMemories = savedShotMemories.slice(0, targetCount());
        shotCodeStates = shotCodeStates.slice(0, targetCount());
      }
      showGuestCodes();
      updateStrip();
    });
  });
  document.querySelectorAll('.filter-option').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedFilter = button.dataset.filter;
      document.querySelectorAll('.filter-option').forEach(function (item) { item.classList.toggle('selected', item === button); });
      video.style.filter = filterStyles[selectedFilter];
      updateStrip();
    });
  });
  document.querySelectorAll('.frame-choice').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedFrame = button.dataset.frame;
      document.querySelectorAll('.frame-choice').forEach(function (item) { item.classList.toggle('selected', item === button); });
      updateStrip();
    });
  });
  photoUpload.addEventListener('change', function () {
    var file = photoUpload.files && photoUpload.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showStatus('Please choose an image file.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      stillImage = new Image();
      stillImage.onload = function () {
        photos = [];
        savedShotMemories = [];
        shotCodeStates = [];
        clearGuestCodes();
        placeholder.hidden = true;
        cameraStatus.textContent = 'Photo ready';
        capturePhoto();
      };
      stillImage.onerror = function () { showStatus('That image could not be opened. Try another photo.'); };
      stillImage.src = reader.result;
    };
    reader.onerror = function () { showStatus('Your photo could not be read from this device.'); };
    reader.readAsDataURL(file);
  });
  saveButton.addEventListener('click', function () {
    setSharingPending(true);
    showStatus('Preparing your decorated photo strip…');
    Promise.all([renderStrip(true), renderStrip(false)]).then(function (renders) {
      var dataUrl = renders[0];
      var editSource = renders[1];
      window.FlashbackStorage.save({
        title: 'Photo strip',
        type: 'strip',
        dataUrl: dataUrl,
        editSource: editSource,
        frame: selectedFrame,
        layout: selectedLayout,
        framesApplied: true,
        hasDateStamp: document.getElementById('stamp-toggle').checked
      });
      window.FlashbackStorage.download(dataUrl, 'flashback-strip.jpg');
      showStatus('Photo strip saved and downloaded. Each individual photo already has its own guest code above.');
    }).catch(function (error) {
      showStatus(error.message);
    }).finally(function () {
      setSharingPending(false);
    });
  });
  printButton.addEventListener('click', function () {
    if (!photos.length || printButton.disabled) return;
    window.print();
  });
  document.getElementById('reset-booth').addEventListener('click', function () {
    photos = [];
    savedShotMemories = [];
    shotCodeStates = [];
    clearGuestCodes();
    selectedFilter = 'normal';
    selectedFrame = 'pink';
    selectedLayout = 'strip';
    timerSeconds = 0;
    stillImage = null;
    video.style.filter = 'none';
    document.querySelectorAll('.selected').forEach(function (item) { item.classList.remove('selected'); });
    document.querySelector('[data-value="0"]').classList.add('selected');
    document.querySelector('[data-layout="strip"]').classList.add('selected');
    document.querySelector('[data-filter="normal"]').classList.add('selected');
    document.querySelector('[data-frame="pink"]').classList.add('selected');
    document.getElementById('stamp-toggle').checked = true;
    placeholder.hidden = cameraIsLive();
    updateStrip();
    showStatus('Photobooth settings reset.');
  });
  window.addEventListener('pagehide', function () {
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
  });
  updateStrip();
}());
