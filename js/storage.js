(function (global) {
  'use strict';

  var key = 'flashback-memories-v1';

  function readAll() {
    try {
      var value = global.localStorage.getItem(key);
      var memories = value ? JSON.parse(value) : [];
      return Array.isArray(memories) ? memories : [];
    } catch (error) {
      throw new Error('Your browser could not read saved photos. Try enabling local storage and refreshing.');
    }
  }

  function writeAll(memories) {
    try {
      global.localStorage.setItem(key, JSON.stringify(memories));
    } catch (error) {
      if (error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        throw new Error('This device is out of photo storage. Remove a few memories from your gallery and try again.');
      }
      throw new Error('Your browser could not save this photo. Check that local storage is available.');
    }
  }

  function createMemory(memory, now) {
    if (!memory || typeof memory.dataUrl !== 'string' || memory.dataUrl.indexOf('data:image/') !== 0) {
      throw new Error('This photo could not be saved because its image data is invalid.');
    }
    var item = {
      id: 'memory-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      title: memory.title || 'A Flashback',
      type: memory.type === 'strip' ? 'strip' : 'photo',
      dataUrl: memory.dataUrl,
      hasDateStamp: memory.hasDateStamp === true,
      createdAt: memory.createdAt || now
    };
    if (memory.type === 'strip' && typeof memory.editSource === 'string' && memory.editSource.indexOf('data:image/') === 0) {
      item.editSource = memory.editSource;
      item.frame = typeof memory.frame === 'string' ? memory.frame : 'classic';
      item.layout = typeof memory.layout === 'string' ? memory.layout : 'strip';
      item.framesApplied = memory.framesApplied === true;
    }
    return item;
  }

  function saveMany(items) {
    if (!Array.isArray(items) || !items.length) {
      throw new Error('Choose at least one photo to save.');
    }
    var now = new Date().toISOString();
    var savedItems = items.map(function (memory) { return createMemory(memory, now); });
    writeAll(savedItems.concat(readAll()));
    return savedItems;
  }

  function save(memory) {
    return saveMany([memory])[0];
  }

  function remove(id) {
    var memories = readAll();
    var next = memories.filter(function (memory) { return memory.id !== id; });
    if (next.length === memories.length) return false;
    writeAll(next);
    return true;
  }

  function download(dataUrl, filename) {
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename || 'flashback-photo.jpg';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function shareUrlFor(memoryId) {
    if (!memoryId) return '';
    var current = new URL(window.location.href);
    var isInPagesFolder = /\/pages\//i.test(current.pathname);
    var galleryUrl = new URL(isInPagesFolder ? 'gallery.html' : 'pages/gallery.html', current.href);
    galleryUrl.searchParams.set('memory', memoryId);
    return galleryUrl.toString();
  }

  function qrImageUrlFor(memoryId, size) {
    var dimension = size || 220;
    var shareUrl = shareUrlFor(memoryId);
    if (!shareUrl) return '';
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + dimension + 'x' + dimension + '&margin=2&ecc=M&data=' + encodeURIComponent(shareUrl);
  }

  global.FlashbackStorage = {
    list: readAll,
    save: save,
    saveMany: saveMany,
    remove: remove,
    latest: function () { return readAll()[0] || null; },
    download: download,
    shareUrlFor: shareUrlFor,
    qrImageUrlFor: qrImageUrlFor
  };
}(window));
