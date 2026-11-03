(function () {
  'use strict';
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('empty-gallery');
  var search = document.getElementById('gallery-search');
  var filter = document.getElementById('gallery-filter');
  var count = document.getElementById('photo-count');
  var viewer = document.getElementById('photo-viewer');
  var qrViewer = document.getElementById('photo-qr-viewer');
  var viewerImage = document.getElementById('photo-viewer-image');
  var viewerCaption = document.getElementById('photo-viewer-caption');
  var qrImage = document.getElementById('photo-qr-image');
  var qrCaption = document.getElementById('photo-qr-caption');
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

  function openQrCode(memory) {
    if (!memory) return;
    var qrUrl = typeof window.FlashbackStorage.qrImageUrlFor === 'function' ? window.FlashbackStorage.qrImageUrlFor(memory.id, 220) : '';
    if (!qrUrl) {
      qrCaption.textContent = 'A QR code could not be prepared for this photo.';
      return;
    }
    qrCaption.textContent = 'Scan to open "' + memory.title + '" in Flashback.';
    qrImage.src = qrUrl;
    if (typeof qrViewer.showModal === 'function') qrViewer.showModal();
    else qrViewer.setAttribute('open', 'open');
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
      actions.append(viewButton, downloadButton, deleteButton);
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
  document.getElementById('generate-viewed-qr').addEventListener('click', function () {
    if (viewedMemory) openQrCode(viewedMemory);
  });
  document.getElementById('close-photo-qr-viewer').addEventListener('click', function () {
    qrViewer.close();
  });
  document.getElementById('print-viewed-qr').addEventListener('click', function () {
    if (!qrImage.src) return;
    var printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Your browser blocked the print window. Please allow pop-ups and try again.');
      return;
    }
    printWindow.document.write('<html><head><title>Flashback QR code</title><style>body{display:flex;align-items:center;justify-content:center;margin:0;background:#f8f1e1;font-family:Georgia,serif;color:#3d2b1f;} .card{padding:24px;border:1px solid #d8bb8d;border-radius:12px;background:#fffdf7;text-align:center;box-shadow:0 12px 30px rgba(0,0,0,.08);} img{display:block;max-width:280px;width:100%;height:auto;margin:0 auto 14px;} p{margin:0;font-size:18px;}</style></head><body><div class="card"><img src="' + qrImage.src + '" alt="QR code"><p>Scan to view this memory</p></div></body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });

  viewer.addEventListener('click', function (event) {
    if (event.target === viewer) viewer.close();
  });
  qrViewer.addEventListener('click', function (event) {
    if (event.target === qrViewer) qrViewer.close();
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
