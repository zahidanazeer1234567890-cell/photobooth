(function () {
  'use strict';
  var input = document.getElementById('editor-upload');
  var image = document.getElementById('editor-image');
  var empty = document.getElementById('editor-empty');
  var stage = document.getElementById('editor-canvas-inner');
  var stickerLayer = document.getElementById('editor-sticker-layer');
  var datePreview = document.getElementById('editor-date-preview');
  var stampToggle = document.getElementById('editor-stamp');
  var dateInput = document.getElementById('editor-date');
  var photoName = document.getElementById('editor-photo-name');
  var status = document.getElementById('editor-status');
  var accessPanel = document.getElementById('editor-access-result');
  var accessCodeOutput = document.getElementById('editor-access-code');
  var accessExpiry = document.getElementById('editor-access-expiry');
  var accessLink = document.getElementById('editor-access-link');
  var originalUrl = '';
  var sourceHasDateStamp = false;
  var zoom = 100, brightness = 100, contrast = 100, rotation = 0, filter = 'normal', frame = 'none', ratio = 'free', stickerPosition = 'top-right';
  var textSize = 24, textColor = '#fff8e9', selectedCaption = null;
  var requestedFrame = new URLSearchParams(window.location.search).get('frame');
  var filters = {
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
    red: { base: '#c34b4b', dark: true },
    classic: { base: '#e8d6b8', dark: false },
    dark: { base: '#242424', dark: true },
    floral: { base: '#e986ad', dark: false },
    vintage: { base: '#e99479', dark: false },
    ochre: { base: '#d9af45', dark: false },
    purple: { base: '#9b7bb8', dark: false },
    starburst: { base: '#d9af45', dark: false },
    ornate: { base: '#842d48', dark: true },
    gallery: { base: '#e8d6b8', dark: false }
  };
  var frameClassNames = Object.keys(frameStyles).map(function (name) { return 'frame-' + name; });
  var stickerCoordinates = {
    'top-left': [12, 12], 'top-center': [50, 12], 'top-right': [88, 12],
    'center-left': [12, 50], center: [50, 50], 'center-right': [88, 50],
    'bottom-left': [12, 88], 'bottom-center': [50, 88], 'bottom-right': [88, 88]
  };

  function report(message) { status.textContent = message; }
  function hasDateStamp(memory) {
    if (typeof memory.hasDateStamp === 'boolean') return memory.hasDateStamp;
    return memory.type === 'strip' || memory.title === 'Edited Flashback';
  }
  function updateDatePreview() {
    datePreview.textContent = dateInput.value.trim() || new Date().toLocaleDateString();
    datePreview.hidden = !stampToggle.checked || image.hidden;
    if (datePreview.hidden) return;
    var stageBounds = stage.getBoundingClientRect();
    var imageBounds = image.getBoundingClientRect();
    var visibleWidth = Math.min(imageBounds.width, stageBounds.width);
    var visibleHeight = Math.min(imageBounds.height, stageBounds.height);
    datePreview.style.left = (imageBounds.left - stageBounds.left + imageBounds.width / 2) + 'px';
    datePreview.style.top = (Math.min(imageBounds.bottom, stageBounds.bottom) - stageBounds.top - visibleHeight * .04) + 'px';
    datePreview.style.bottom = 'auto';
    datePreview.style.maxWidth = Math.max(0, visibleWidth * .88) + 'px';
  }
  function setCaptionPosition(caption, x, y) {
    var left = Math.max(3, Math.min(97, x));
    var top = Math.max(3, Math.min(97, y));
    caption.dataset.x = String(left);
    caption.dataset.y = String(top);
    caption.style.left = left + '%';
    caption.style.top = top + '%';
    var nearest = 'center';
    var nearestDistance = Infinity;
    Object.keys(stickerCoordinates).forEach(function (position) {
      var point = stickerCoordinates[position];
      var distance = Math.pow(point[0] - left, 2) + Math.pow(point[1] - top, 2);
      if (distance < nearestDistance) {
        nearest = position;
        nearestDistance = distance;
      }
    });
    caption.dataset.position = nearest;
  }
  function selectCaption(caption) {
    if (selectedCaption) selectedCaption.classList.remove('selected');
    selectedCaption = caption;
    caption.classList.add('selected');
    stickerPosition = caption.dataset.position || 'center';
    textSize = Number(caption.dataset.size || textSize);
    textColor = caption.dataset.color || textColor;
    document.getElementById('text-size').value = textSize;
    document.getElementById('text-size-value').value = textSize + ' px';
    document.getElementById('text-color').value = textColor;
    document.querySelectorAll('.sticker-positions button').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.position === stickerPosition);
    });
    document.getElementById('text-adjustment-hint').textContent = 'Drag the selected caption on the photo to position it.';
  }
  function refresh() {
    image.style.filter = (filters[filter] === 'none' ? '' : filters[filter] + ' ') + 'brightness(' + brightness + '%) contrast(' + contrast + '%)';
    image.style.transform = 'rotate(' + rotation + 'deg) scale(' + (zoom / 100) * (frame === 'none' ? 1 : .91) + ')';
    stage.classList.remove.apply(stage.classList, frameClassNames.concat(['ratio-1', 'ratio-4-5', 'ratio-3-4', 'ratio-16-9']));
    stage.style.setProperty('--frame-color', frameStyles[frame] ? frameStyles[frame].base : 'transparent');
    if (frame !== 'none') stage.classList.add('frame-' + frame);
    if (ratio !== 'free') stage.classList.add('ratio-' + ratio.replace(':', '-'));
    var stageBounds = stage.getBoundingClientRect();
    var imageBounds = image.getBoundingClientRect();
    var visibleLeft = Math.max(imageBounds.left, stageBounds.left);
    var visibleTop = Math.max(imageBounds.top, stageBounds.top);
    var visibleRight = Math.min(imageBounds.right, stageBounds.right);
    var visibleBottom = Math.min(imageBounds.bottom, stageBounds.bottom);
    stickerLayer.style.left = (visibleLeft - stageBounds.left) + 'px';
    stickerLayer.style.top = (visibleTop - stageBounds.top) + 'px';
    stickerLayer.style.width = Math.max(0, visibleRight - visibleLeft) + 'px';
    stickerLayer.style.height = Math.max(0, visibleBottom - visibleTop) + 'px';
    updateDatePreview();
    document.getElementById('zoom-value').value = zoom + '%';
    document.getElementById('brightness-value').value = brightness + '%';
    document.getElementById('contrast-value').value = contrast + '%';
  }
  function setPhoto(src, name, hasDateStamp, savedFrame, framesApplied) {
    image.onload = function () {
      originalUrl = src;
      sourceHasDateStamp = hasDateStamp === true;
      var initialFrame = framesApplied ? 'none' : requestedFrame && frameStyles[requestedFrame] ? requestedFrame : savedFrame || 'none';
      frame = initialFrame;
      document.querySelectorAll('.editor-frames .frame-choice').forEach(function (button) {
        button.classList.toggle('selected', button.dataset.frame === frame);
      });
      stampToggle.checked = !sourceHasDateStamp;
      image.hidden = false;
      empty.hidden = true;
      photoName.textContent = name || 'Your Flashback';
      refresh();
      report('');
    };
    image.onerror = function () { report('This image could not be opened. Choose another photo.'); };
    image.src = src;
  }
  function loadLatest() {
    try {
      var memory = window.FlashbackStorage.latest();
      if (!memory) { report('No saved photos yet. Visit the photobooth or upload a photo to get started.'); return; }
      setPhoto(memory.editSource || memory.dataUrl, memory.title, hasDateStamp(memory), memory.frame, memory.framesApplied === true);
    } catch (error) { report(error.message); }
  }
  function paintFrame(context, width, height, border) {
    var style = frameStyles[frame];
    if (!style) return;
    context.fillStyle = style.base;
    context.fillRect(0, 0, width, height);
  }
  function drawEdited() {
    return new Promise(function (resolve, reject) {
      if (!originalUrl || !image.naturalWidth) { reject(new Error('Choose a photo before saving your edit.')); return; }
      var source = document.createElement('canvas');
      var sourceContext = source.getContext('2d');
      var quarterTurn = Math.abs(rotation % 180) === 90;
      source.width = quarterTurn ? image.naturalHeight : image.naturalWidth;
      source.height = quarterTurn ? image.naturalWidth : image.naturalHeight;
      sourceContext.save();
      sourceContext.translate(source.width / 2, source.height / 2);
      sourceContext.rotate(rotation * Math.PI / 180);
      sourceContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      sourceContext.restore();

      var wantedRatio = ratio === 'free' ? source.width / source.height : Number(ratio.split(':')[0]) / Number(ratio.split(':')[1]);
      var cropWidth = source.width;
      var cropHeight = source.height;
      if (cropWidth / cropHeight > wantedRatio) cropWidth = cropHeight * wantedRatio;
      else cropHeight = cropWidth / wantedRatio;
      cropWidth /= zoom / 100;
      cropHeight /= zoom / 100;
      var canvas = document.createElement('canvas');
      var border = 0;
      if (frame !== 'none') {
        var frameScale = Math.min(cropWidth, cropHeight);
        border = Math.max(1, Math.min(Math.max(8, Math.round(frameScale * .045)), Math.max(1, Math.round(frameScale * .12))));
      }
      canvas.width = Math.round(cropWidth + border * 2);
      canvas.height = Math.round(cropHeight + border * 2);
      var context = canvas.getContext('2d');
      if (frame === 'none') {
        context.fillStyle = '#f7f0df';
        context.fillRect(0, 0, canvas.width, canvas.height);
      } else paintFrame(context, canvas.width, canvas.height, border);
      context.save();
      context.filter = filters[filter] + ' brightness(' + brightness + '%) contrast(' + contrast + '%)';
      context.drawImage(source, (source.width - cropWidth) / 2, (source.height - cropHeight) / 2, cropWidth, cropHeight, border, border, cropWidth, cropHeight);
      context.restore();
      Array.prototype.forEach.call(stickerLayer.querySelectorAll('.editor-sticker'), function (sticker) {
        var coordinates = stickerCoordinates[sticker.dataset.position] || stickerCoordinates.center;
        context.save();
        context.font = Math.round(Math.max(28, cropWidth * .07)) + 'px serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(sticker.textContent, border + cropWidth * coordinates[0] / 100, border + cropHeight * coordinates[1] / 100);
        context.restore();
      });
      Array.prototype.forEach.call(stickerLayer.querySelectorAll('.editor-caption'), function (caption) {
        var fallback = stickerCoordinates[caption.dataset.position] || stickerCoordinates.center;
        var coordinates = [Number(caption.dataset.x || fallback[0]), Number(caption.dataset.y || fallback[1])];
        var maxWidth = cropWidth * 0.45;
        var previewWidth = stickerLayer.clientWidth || cropWidth;
        var fontSize = Math.max(12, Math.round(Number(caption.dataset.size || textSize) * cropWidth / previewWidth));
        var lineHeight = fontSize * 1.2;
        var words = caption.textContent.trim().split(/\s+/);
        var lines = [];
        var line = '';
        context.save();
        context.font = '700 ' + fontSize + 'px Georgia';
        words.forEach(function (word) {
          var candidate = line ? line + ' ' + word : word;
          if (line && context.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });
        if (line) lines.push(line);
        var centerX = border + cropWidth * coordinates[0] / 100;
        var centerY = border + cropHeight * coordinates[1] / 100;
        var firstLineY = centerY - (lines.length - 1) * lineHeight / 2;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineJoin = 'round';
        context.lineWidth = Math.max(3, fontSize * 0.16);
        context.strokeStyle = '#533621';
        context.fillStyle = caption.dataset.color || textColor;
        lines.forEach(function (textLine, index) {
          var y = firstLineY + index * lineHeight;
          context.strokeText(textLine, centerX, y, maxWidth);
          context.fillText(textLine, centerX, y, maxWidth);
        });
        context.restore();
      });
      if (document.getElementById('editor-stamp').checked) {
        var darkFrame = frameStyles[frame] ? frameStyles[frame].dark : false;
        var previewWidth = image.getBoundingClientRect().width || canvas.width;
        var dateFontSize = Math.max(10, Math.round(12 * canvas.width / previewWidth));
        var dateText = dateInput.value.trim() || new Date().toLocaleDateString();
        var dateY = border + cropHeight * .96;
        var datePaddingX = dateFontSize * .75;
        var datePaddingY = dateFontSize * .25;
        context.font = dateFontSize + 'px Georgia';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        var dateWidth = Math.min(cropWidth * .88, context.measureText(dateText).width + datePaddingX * 2);
        context.fillStyle = darkFrame ? '#332a25d9' : '#fff8e9d9';
        context.fillRect((canvas.width - dateWidth) / 2, dateY - dateFontSize / 2 - datePaddingY, dateWidth, dateFontSize + datePaddingY * 2);
        context.fillStyle = darkFrame ? '#f6e6c8' : '#765638';
        context.fillText(dateText, canvas.width / 2, dateY, cropWidth * .88);
      }
      resolve(canvas.toDataURL('image/jpeg', .9));
    });
  }

  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { report('Please choose an image file.'); return; }
    var reader = new FileReader();
    reader.onload = function () { setPhoto(reader.result, file.name, false); };
    reader.onerror = function () { report('Your photo could not be read. Please try another file.'); };
    reader.readAsDataURL(file);
  });
  document.getElementById('load-latest').addEventListener('click', loadLatest);
  stampToggle.addEventListener('change', updateDatePreview);
  dateInput.addEventListener('input', function () {
    if (dateInput.value.trim()) stampToggle.checked = true;
    updateDatePreview();
  });
  document.getElementById('zoom-slider').addEventListener('input', function (event) { zoom = Number(event.target.value); refresh(); });
  document.getElementById('brightness-slider').addEventListener('input', function (event) { brightness = Number(event.target.value); refresh(); });
  document.getElementById('contrast-slider').addEventListener('input', function (event) { contrast = Number(event.target.value); refresh(); });
  document.getElementById('rotate-left').addEventListener('click', function () { rotation = (rotation - 90) % 360; refresh(); });
  document.getElementById('rotate-right').addEventListener('click', function () { rotation = (rotation + 90) % 360; refresh(); });
  document.querySelectorAll('.crop-options button').forEach(function (button) {
    button.addEventListener('click', function () {
      ratio = button.dataset.ratio;
      document.querySelectorAll('.crop-options button').forEach(function (item) { item.classList.toggle('selected', item === button); });
      refresh();
    });
  });
  document.querySelectorAll('.editor-filters .filter-option').forEach(function (button) {
    button.addEventListener('click', function () {
      filter = button.dataset.filter;
      document.querySelectorAll('.editor-filters .filter-option').forEach(function (item) { item.classList.toggle('selected', item === button); });
      refresh();
    });
  });
  document.querySelectorAll('.editor-frames .frame-choice').forEach(function (button) {
    button.addEventListener('click', function () {
      frame = button.dataset.frame;
      document.querySelectorAll('.editor-frames .frame-choice').forEach(function (item) { item.classList.toggle('selected', item === button); });
      refresh();
    });
  });
  if (requestedFrame && frameStyles[requestedFrame]) {
    frame = requestedFrame;
    document.querySelectorAll('.editor-frames .frame-choice').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.frame === frame);
    });
  }
  document.querySelectorAll('.sticker-positions button').forEach(function (button) {
    button.addEventListener('click', function () {
      stickerPosition = button.dataset.position;
      document.querySelectorAll('.sticker-positions button').forEach(function (item) {
        item.classList.toggle('selected', item === button);
      });
      if (selectedCaption) {
        var coordinates = stickerCoordinates[stickerPosition];
        setCaptionPosition(selectedCaption, coordinates[0], coordinates[1]);
      }
    });
  });
  document.getElementById('add-overlay-text').addEventListener('click', function () {
    var field = document.getElementById('overlay-text');
    var text = field.value.trim();
    if (!text) { report('Type a caption before adding text.'); field.focus(); return; }
    if (image.hidden) { report('Choose a photo before adding text.'); return; }
    var caption = document.createElement('span');
    caption.className = 'editor-caption';
    caption.dataset.position = stickerPosition;
    caption.dataset.size = String(textSize);
    caption.dataset.color = textColor;
    caption.textContent = text;
    var coordinates = stickerCoordinates[stickerPosition];
    setCaptionPosition(caption, coordinates[0], coordinates[1]);
    caption.style.fontSize = textSize + 'px';
    caption.style.color = textColor;
    caption.addEventListener('click', function () {
      selectCaption(caption);
    });
    var dragState = null;
    caption.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      selectCaption(caption);
      var bounds = stickerLayer.getBoundingClientRect();
      dragState = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        startX: Number(caption.dataset.x),
        startY: Number(caption.dataset.y),
        width: bounds.width,
        height: bounds.height
      };
      caption.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    caption.addEventListener('pointermove', function (event) {
      if (!dragState) return;
      var x = dragState.startX + (event.clientX - dragState.pointerX) / dragState.width * 100;
      var y = dragState.startY + (event.clientY - dragState.pointerY) / dragState.height * 100;
      setCaptionPosition(caption, x, y);
      document.querySelectorAll('.sticker-positions button').forEach(function (button) {
        button.classList.toggle('selected', button.dataset.position === caption.dataset.position);
      });
      stickerPosition = caption.dataset.position;
    });
    function stopDragging() { dragState = null; }
    caption.addEventListener('pointerup', stopDragging);
    caption.addEventListener('pointercancel', stopDragging);
    if (selectedCaption) selectedCaption.classList.remove('selected');
    selectedCaption = caption;
    caption.classList.add('selected');
    stickerLayer.appendChild(caption);
    field.value = '';
    report('Text added to your photo.');
  });
  document.getElementById('overlay-text').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('add-overlay-text').click();
    }
  });
  document.getElementById('text-size').addEventListener('input', function (event) {
    textSize = Number(event.target.value);
    document.getElementById('text-size-value').value = textSize + ' px';
    if (selectedCaption) {
      selectedCaption.dataset.size = String(textSize);
      selectedCaption.style.fontSize = textSize + 'px';
    }
  });
  document.getElementById('text-color').addEventListener('input', function (event) {
    textColor = event.target.value;
    if (selectedCaption) {
      selectedCaption.dataset.color = textColor;
      selectedCaption.style.color = textColor;
    }
  });
  document.querySelectorAll('.sticker-picker button').forEach(function (button) {
    button.addEventListener('click', function () {
      if (image.hidden) { report('Choose a photo before adding stickers.'); return; }
      var sticker = document.createElement('span');
      sticker.className = 'editor-sticker';
      sticker.textContent = button.dataset.sticker;
      sticker.dataset.position = stickerPosition;
      var coordinates = stickerCoordinates[stickerPosition];
      sticker.style.left = coordinates[0] + '%';
      sticker.style.top = coordinates[1] + '%';
      stickerLayer.appendChild(sticker);
    });
  });
  document.getElementById('undo-edit').addEventListener('click', function () {
    if (stickerLayer.lastElementChild) {
      if (stickerLayer.lastElementChild === selectedCaption) {
        selectedCaption.classList.remove('selected');
        selectedCaption = null;
      }
      stickerLayer.lastElementChild.remove();
    }
    else { rotation = 0; zoom = 100; brightness = 100; contrast = 100; refresh(); }
  });
  document.getElementById('reset-edit').addEventListener('click', function () {
    zoom = 100; brightness = 100; contrast = 100; rotation = 0; filter = 'normal'; frame = 'none'; ratio = 'free'; stickerPosition = 'top-right';
    stickerLayer.replaceChildren();
    selectedCaption = null;
    textSize = 24;
    textColor = '#fff8e9';
    document.getElementById('zoom-slider').value = zoom;
    document.getElementById('brightness-slider').value = brightness;
    document.getElementById('contrast-slider').value = contrast;
    document.getElementById('text-size').value = textSize;
    document.getElementById('text-size-value').value = textSize + ' px';
    document.getElementById('text-color').value = textColor;
    document.getElementById('text-adjustment-hint').textContent = 'Select a caption on the photo to adjust it, or set defaults for new text.';
    stampToggle.checked = true;
    dateInput.value = '';
    updateDatePreview();
    document.querySelectorAll('.selected').forEach(function (item) { item.classList.remove('selected'); });
    document.querySelector('.editor-filters [data-filter="normal"]').classList.add('selected');
    document.querySelector('.editor-frames [data-frame="none"]').classList.add('selected');
    document.querySelector('.crop-options [data-ratio="free"]').classList.add('selected');
    document.querySelectorAll('.sticker-positions button').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.position === stickerPosition);
    });
    refresh();
    report('Edits reset.');
  });
  document.getElementById('copy-editor-code').addEventListener('click', function () {
    window.FlashbackStorage.copyText(accessCodeOutput.textContent).then(function () {
      report('Private access code copied. It expires in 24 hours.');
    }).catch(function (error) { report(error.message); });
  });
  document.getElementById('save-edit').addEventListener('click', function () {
    var saveButton = document.getElementById('save-edit');
    saveButton.disabled = true;
    accessPanel.hidden = true;
    drawEdited().then(function (dataUrl) {
      var memory = window.FlashbackStorage.save({ title: 'Edited Flashback', type: 'photo', dataUrl: dataUrl, hasDateStamp: sourceHasDateStamp || stampToggle.checked });
      window.FlashbackStorage.download(dataUrl, 'flashback-edited.jpg');
      report('Saved to this device. Creating a private guest code…');
      return window.FlashbackStorage.publish(memory).then(function (published) {
        accessCodeOutput.textContent = published.accessCode;
        accessExpiry.textContent = 'Valid until ' + new Date(published.accessExpiresAt).toLocaleString();
        accessLink.href = window.FlashbackStorage.accessUrlFor(published.accessCode);
        accessPanel.hidden = false;
        accessPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        report(published.accessStorageWarning ? 'The code was created, but could not be saved in this browser. Copy it now: ' + published.accessStorageWarning : 'Your photo is ready to share. Give the guest this code; it expires in 24 hours.');
      }).catch(function (error) {
        report('Saved on this device only. A guest code could not be created: ' + error.message);
      });
    }).catch(function (error) { report(error.message); }).finally(function () { saveButton.disabled = false; });
  });
  try {
    var latest = window.FlashbackStorage.latest();
    if (latest) setPhoto(latest.editSource || latest.dataUrl, latest.title, hasDateStamp(latest), latest.frame, latest.framesApplied === true);
  } catch (error) { report(error.message); }
  refresh();
  window.addEventListener('resize', updateDatePreview);
}());
