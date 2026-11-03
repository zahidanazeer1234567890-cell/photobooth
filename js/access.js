(function () {
  'use strict';
  var form = document.getElementById('access-form');
  var input = document.getElementById('access-code-input');
  var status = document.getElementById('access-status');
  var result = document.getElementById('access-result');
  var photo = document.getElementById('access-image');
  var download = document.getElementById('access-download');
  var imageUrl = '';
  var imageDownloadUrl = '';

  function unlock(code) {
    result.hidden = true;
    if (imageDownloadUrl.indexOf('blob:') === 0) URL.revokeObjectURL(imageDownloadUrl);
    imageDownloadUrl = '';
    status.textContent = 'Checking your private code…';
    fetch('/api/memories?code=' + encodeURIComponent(code)).then(function (response) {
      return response.json().catch(function () {
        throw new Error('The photo service returned an unreadable response.');
      }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'That code is invalid or has expired.');
        return data;
      });
    }).then(function (memory) {
      imageUrl = memory.imageUrl;
      photo.src = imageUrl;
      photo.alt = memory.title;
      document.getElementById('access-title').textContent = memory.title;
      document.getElementById('access-expiry').textContent = 'This private link expires ' + new Date(memory.expiresAt).toLocaleString() + '.';
      result.hidden = false;
      status.textContent = '';
      return fetch(imageUrl).then(function (response) {
        if (!response.ok) throw new Error('The photo could not be prepared for download.');
        return response.blob();
      }).then(function (blob) {
        imageDownloadUrl = URL.createObjectURL(blob);
        photo.src = imageDownloadUrl;
      }).catch(function () {
        imageDownloadUrl = imageUrl;
      });
    }).catch(function (error) {
      status.textContent = error.message;
    });
  }

  download.addEventListener('click', function (event) {
    if (!imageDownloadUrl) return;
    event.preventDefault();
    var link = document.createElement('a');
    link.href = imageDownloadUrl;
    link.download = 'flashback-photo.jpg';
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  input.addEventListener('input', function () {
    input.value = input.value.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ-]/g, '').slice(0, 14);
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = input.value.replace(/-/g, '');
    if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(code)) {
      status.textContent = 'Enter all 12 characters from your photo code.';
      return;
    }
    unlock(code);
  });

  var sharedCode = new URLSearchParams(window.location.search).get('code');
  if (sharedCode) {
    input.value = sharedCode.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ-]/g, '').slice(0, 14);
    if (input.value.replace(/-/g, '').length === 12) unlock(input.value.replace(/-/g, ''));
  }
}());
