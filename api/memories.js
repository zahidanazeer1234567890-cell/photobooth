'use strict';

var crypto = require('crypto');
var supabase = require('../lib/supabase');
var alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
var maxImageBytes = 3 * 1024 * 1024;
var codeLifetimeMs = 24 * 60 * 60 * 1000;

function respond(res, status, body) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(status).json(body);
}

function newCode() {
  var bytes = crypto.randomBytes(12);
  var characters = Array.prototype.map.call(bytes, function (byte) {
    return alphabet[byte & 31];
  }).join('');
  return characters.slice(0, 4) + '-' + characters.slice(4, 8) + '-' + characters.slice(8);
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}

function readImage(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('Choose a photo before creating an access code.');
  var match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error('This photo format is not supported. Choose a JPEG, PNG, or WebP image.');
  var data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > maxImageBytes) {
    throw new Error('This photo is too large to share. Save an image smaller than 3 MB and try again.');
  }
  return { extension: match[1] === 'jpeg' ? 'jpg' : match[1], contentType: 'image/' + match[1], data: data };
}

function createMemory(req, res) {
  var image;
  try {
    image = readImage(req.body && req.body.dataUrl);
  } catch (error) {
    return respond(res, 400, { error: error.message });
  }
  var title = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 120) : 'A Flashback';
  var id = crypto.randomUUID();
  var createdAt = new Date();
  var expiresAt = new Date(createdAt.getTime() + codeLifetimeMs).toISOString();
  var path = supabase.objectPath(id, image.extension);

  function registerCode(attempt) {
    var code = newCode();
    return supabase.request('/rest/v1/flashback_memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: id,
        code_hash: hashCode(code),
        title: title || 'A Flashback',
        object_path: path,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt
      })
    }).then(function () {
      return code;
    }).catch(function (error) {
      if (error.status === 409 && attempt < 3) return registerCode(attempt + 1);
      throw error;
    });
  }

  return supabase.request(supabase.objectUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': image.contentType, 'x-upsert': 'false' },
    body: image.data
  }).then(function () {
    return registerCode(0);
  }).then(function (code) {
    return respond(res, 201, { code: code, expiresAt: expiresAt });
  }).catch(function (error) {
    return supabase.removeObjects([path]).catch(function (cleanupError) {
      console.error('Could not remove an unclaimed photo from Supabase:', cleanupError.message);
    }).then(function () {
      console.error('Could not create a private photo code:', error.message);
      return respond(res, 502, { error: 'The private photo could not be saved. Check the Supabase setup and try again.' });
    });
  });
}

function openMemory(req, res) {
  var suppliedCode = typeof req.query.code === 'string' ? req.query.code : '';
  var normalized = suppliedCode.replace(/-/g, '').toUpperCase();
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(normalized)) {
    return respond(res, 404, { error: 'That code is invalid or has expired.' });
  }
  var now = new Date().toISOString();
  var query = '?select=title,object_path,expires_at&code_hash=eq.' + hashCode(normalized) +
    '&expires_at=gt.' + encodeURIComponent(now) + '&limit=1';
  return supabase.request('/rest/v1/flashback_memories' + query).then(function (rows) {
    if (!rows.length) return respond(res, 404, { error: 'That code is invalid or has expired.' });
    return supabase.request(supabase.signedObjectUrl(rows[0].object_path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: Math.max(1, Math.min(60, Math.floor((new Date(rows[0].expires_at).getTime() - Date.now()) / 1000))) })
    }).then(function (signed) {
      var config = supabase.configuration();
      var url = signed.signedURL;
      if (url.charAt(0) === '/') url = config.baseUrl + '/storage/v1' + url;
      return respond(res, 200, { title: rows[0].title, expiresAt: rows[0].expires_at, imageUrl: url });
    });
  }).catch(function (error) {
    console.error('Could not open a private photo:', error.message);
    return respond(res, 502, { error: 'The photo could not be opened right now. Please try again later.' });
  });
}

module.exports = function (req, res) {
  if (req.method === 'POST') return createMemory(req, res);
  if (req.method === 'GET') return openMemory(req, res);
  res.setHeader('Allow', 'GET, POST');
  return respond(res, 405, { error: 'Method not allowed.' });
};
