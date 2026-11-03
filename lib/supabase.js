'use strict';

var bucket = 'flashback-memories';

function configuration() {
  var baseUrl = process.env.SUPABASE_URL;
  var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), serviceRoleKey: serviceRoleKey };
}

function request(path, options) {
  var config = configuration();
  var headers = Object.assign({
    apikey: config.serviceRoleKey,
    Authorization: 'Bearer ' + config.serviceRoleKey
  }, options && options.headers);
  return fetch(config.baseUrl + path, Object.assign({}, options, { headers: headers })).then(function (response) {
    if (!response.ok) {
      var error = new Error('Supabase request failed (' + response.status + ').');
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    return response.text().then(function (body) {
      return body ? JSON.parse(body) : null;
    });
  });
}

function objectPath(id, extension) {
  return id + '.' + extension;
}

function objectUrl(path) {
  return '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/');
}

function signedObjectUrl(path) {
  return '/storage/v1/object/sign/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/');
}

function removeObjects(paths) {
  if (!paths.length) return Promise.resolve();
  return request('/storage/v1/object/' + bucket, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths })
  });
}

module.exports = {
  bucket: bucket,
  configuration: configuration,
  request: request,
  objectPath: objectPath,
  objectUrl: objectUrl,
  signedObjectUrl: signedObjectUrl,
  removeObjects: removeObjects
};
