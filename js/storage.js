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
    if (typeof memory.accessCode === 'string' && typeof memory.accessExpiresAt === 'string') {
      item.accessCode = memory.accessCode;
      item.accessExpiresAt = memory.accessExpiresAt;
    }
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

  function prepareSharedImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        var context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Your browser could not prepare this photo for sharing.'));
          return;
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        var prepared = canvas.toDataURL('image/jpeg', 0.82);
        if (prepared.length > 4 * 1024 * 1024) {
          reject(new Error('This photo is too large to share. Try a smaller image.'));
          return;
        }
        resolve(prepared);
      };
      image.onerror = function () { reject(new Error('This photo could not be prepared for sharing.')); };
      image.src = dataUrl;
    });
  }

  function updateAccess(memory, code, expiresAt) {
    memory.accessCode = code;
    memory.accessExpiresAt = expiresAt;
    try {
      var memories = readAll();
      var savedMemory = memories.find(function (item) { return item.id === memory.id; });
      if (!savedMemory) throw new Error('The saved photo could not be found in this browser.');
      savedMemory.accessCode = code;
      savedMemory.accessExpiresAt = expiresAt;
      writeAll(memories);
    } catch (error) {
      memory.accessStorageWarning = error.message;
    }
    return memory;
  }

  function publish(memory) {
    if (!memory || typeof memory.dataUrl !== 'string') {
      return Promise.reject(new Error('Save a photo before creating an access code.'));
    }
    return prepareSharedImage(memory.dataUrl).then(function (dataUrl) {
      return fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: memory.title || 'A Flashback', dataUrl: dataUrl })
      });
    }).then(function (response) {
      return response.json().catch(function () {
        throw new Error('The sharing service returned an unreadable response.');
      }).then(function (result) {
        if (!response.ok) throw new Error(result.error || 'The photo could not be shared. Please try again.');
        return updateAccess(memory, result.code, result.expiresAt);
      });
    });
  }

  function accessUrlFor(code) {
    var current = new URL(window.location.href);
    var isInPagesFolder = /\/pages\//i.test(current.pathname);
    var accessUrl = new URL(isInPagesFolder ? 'access.html' : 'pages/access.html', current.href);
    accessUrl.searchParams.set('code', code);
    return accessUrl.toString();
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
    return new Promise(function (resolve, reject) {
      var field = document.createElement('textarea');
      field.value = value;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      var copied = document.execCommand('copy');
      field.remove();
      if (copied) resolve();
      else reject(new Error('Your browser could not copy the code.'));
    });
  }

  function download(dataUrl, filename) {
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename || 'flashback-photo.jpg';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  global.FlashbackStorage = {
    list: readAll,
    save: save,
    saveMany: saveMany,
    remove: remove,
    latest: function () { return readAll()[0] || null; },
    publish: publish,
    accessUrlFor: accessUrlFor,
    copyText: copyText,
    download: download,
    hasActiveAccess: function (memory) {
      return !!(memory && memory.accessCode && new Date(memory.accessExpiresAt).getTime() > Date.now());
    }
  };
}(window));
