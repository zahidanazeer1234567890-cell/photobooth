(function () {
  'use strict';
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('empty-gallery');
  var search = document.getElementById('gallery-search');
  var filter = document.getElementById('gallery-filter');
  var count = document.getElementById('photo-count');
  var viewer = document.getElementById('photo-viewer');
  var codeViewer = document.getElementById('photo-code-viewer');
  var viewerImage = document.getElementById('photo-viewer-image');
  var viewerCaption = document.getElementById('photo-viewer-caption');
  var codeCaption = document.getElementById('photo-code-caption');
  var accessCode = document.getElementById('photo-access-code');
  var accessExpiry = document.getElementById('photo-access-expiry');
  var accessLink = document.getElementById('photo-access-link');
  var viewedMemory = null;
  var memories = [];

  function openViewer(memory) {
    viewedMemory = memory;
    viewerImage.src = memory.dataUrl;
    viewerImage.alt = memory.title;
    viewerCaption.textContent = memory.title + ' · ' + dateText(memory.createdAt);
    if (typeof viewer.showModal === 'function') {
      viewer.showModal();
    } else {
      viewer.setAttribute('open', '');
    }
  }

  function dateText(date) {
    var parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function openAccessCode(memory) {
    if (!memory) return;
    var active = window.FlashbackStorage.hasActiveAccess(memory);
    codeCaption.textContent = active ? 'Give this private code to the guest. It will only work for 24 hours after the photo was saved.' : 'This photo does not have an active guest code. Save it again on the hosted site to create one.';
    accessCode.hidden = !active;
    accessLink.hidden = !active;
    document.getElementById('copy-viewed-code').disabled = !active;
    if (active) {
      accessCode.textContent = memory.accessCode;
      accessExpiry.textContent = 'Expires ' + dateText(memory.accessExpiresAt);
      accessLink.href = window.FlashbackStorage.accessUrlFor(memory.accessCode);
    } else {
      accessCode.textContent = '';
      accessExpiry.textContent = '';
    }
    if (typeof codeViewer.showModal === 'function') codeViewer.showModal();
    else codeViewer.setAttribute('open', 'open');
  }

  function render() {
    grid.replaceChildren();
    var query = search.value.trim().toLowerCase();
    var shown = memories.filter(function (memory) {
      var matchesType = filter.value === 'all' || memory.type === filter.value;
      return matchesType && memory.title.toLowerCase().includes(query);
    });
    count.textContent = shown.length + (shown.length === 1 ? ' memory' : ' memories');
    empty.classList.toggle('visible', shown.length === 0);
    empty.querySelector('h2').textContent = memories.length && (query || filter.value !== 'all') ? 'No matching memories' : 'No photos yet!';
    empty.querySelector('p').textContent = memories.length && (query || filter.value !== 'all') ? 'Try another search or filter to find your photo.' : 'Start your own photobooth adventure and save some memories!';
    shown.forEach(function (memory, index) {
      var card = document.createElement('article');
      card.className = 'memory-card';
      card.style.setProperty('--tilt', ((index % 3) - 1) * .7 + 'deg');
      var image = document.createElement('img');
      image.className = 'memory-image' + (memory.type === 'strip' ? ' is-strip' : '');
      image.src = memory.dataUrl;
      image.alt = memory.title;
      image.addEventListener('click', function () { openViewer(memory); });
      var info = document.createElement('div');
      info.className = 'memory-info';
      var title = document.createElement('span');
      title.className = 'memory-title';
      title.textContent = memory.title;
      var date = document.createElement('time');
      date.dateTime = memory.createdAt;
      date.textContent = dateText(memory.createdAt);
      info.append(title, date);
      var actions = document.createElement('div');
      actions.className = 'memory-actions';
      var viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.textContent = 'View';
      viewButton.addEventListener('click', function () { openViewer(memory); });
      var downloadButton = document.createElement('button');
      downloadButton.type = 'button';
      downloadButton.textContent = '↓ Save';
      downloadButton.addEventListener('click', function () { window.FlashbackStorage.download(memory.dataUrl, 'flashback-memory.jpg'); });
      var codeButton = document.createElement('button');
      codeButton.type = 'button';
      codeButton.textContent = 'Code';
      codeButton.setAttribute('aria-label', 'Show guest code for ' + memory.title);
      codeButton.addEventListener('click', function () { openAccessCode(memory); });
      var deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-memory';
      deleteButton.setAttribute('aria-label', 'Delete ' + memory.title);
      deleteButton.textContent = '×';
      deleteButton.addEventListener('click', function () {
        if (!window.confirm('Delete this memory from your gallery?')) return;
        try {
          window.FlashbackStorage.remove(memory.id);
          memories = memories.filter(function (item) { return item.id !== memory.id; });
          render();
        } catch (error) {
          window.alert(error.message);
        }
      });
      actions.append(viewButton, downloadButton, codeButton, deleteButton);
      card.append(image, info, actions);
      grid.appendChild(card);
    });
  }

  search.addEventListener('input', render);
  filter.addEventListener('change', render);

  document.getElementById('close-photo-viewer').addEventListener('click', function () {
    viewer.close();
  });
  document.getElementById('download-viewed-photo').addEventListener('click', function () {
    if (viewedMemory) window.FlashbackStorage.download(viewedMemory.dataUrl, 'flashback-memory.jpg');
  });
  document.getElementById('show-viewed-code').addEventListener('click', function () {
    if (viewedMemory) openAccessCode(viewedMemory);
  });
  document.getElementById('close-photo-code-viewer').addEventListener('click', function () {
    codeViewer.close();
  });
  document.getElementById('copy-viewed-code').addEventListener('click', function () {
    if (!viewedMemory || !window.FlashbackStorage.hasActiveAccess(viewedMemory)) return;
    window.FlashbackStorage.copyText(viewedMemory.accessCode).then(function () {
      codeCaption.textContent = 'Private access code copied. It expires in 24 hours.';
    }).catch(function (error) {
      codeCaption.textContent = error.message;
    });
  });

  viewer.addEventListener('click', function (event) {
    if (event.target === viewer) viewer.close();
  });
  codeViewer.addEventListener('click', function (event) {
    if (event.target === codeViewer) codeViewer.close();
  });

  try {
    memories = window.FlashbackStorage.list();
    render();
    var sharedId = new URLSearchParams(window.location.search).get('memory');
    if (sharedId) {
      var sharedMemory = memories.find(function (memory) { return memory.id === sharedId; });
      if (sharedMemory) openViewer(sharedMemory);
    }
  } catch (error) {
    empty.classList.add('visible');
    empty.querySelector('h2').textContent = 'Gallery unavailable';
    empty.querySelector('p').textContent = error.message;
  }
}());
