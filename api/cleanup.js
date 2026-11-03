'use strict';

var supabase = require('../lib/supabase');

module.exports = function (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  var secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  var removed = 0;
  function removeBatch() {
    var now = new Date().toISOString();
    var query = '/rest/v1/flashback_memories?select=object_path&expires_at=lt.' +
      encodeURIComponent(now) + '&limit=100';
    return supabase.request(query).then(function (rows) {
      if (!rows.length) return;
      var paths = rows.map(function (row) { return row.object_path; });
      return supabase.removeObjects(paths).then(function () {
        return supabase.request('/rest/v1/flashback_memories?expires_at=lt.' + encodeURIComponent(now), {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
      }).then(function () {
        removed += rows.length;
        if (rows.length === 100) return removeBatch();
      });
    });
  }
  return removeBatch().then(function () {
    return res.status(200).json({ removed: removed });
  }).catch(function (error) {
    console.error('Could not clean up expired private photos:', error.message);
    return res.status(502).json({ error: 'Expired photos could not be cleaned up.' });
  });
};
