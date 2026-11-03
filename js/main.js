(function () {
  'use strict';
  var menuButton = document.querySelector('.menu-toggle');
  var navigation = document.querySelector('.site-nav');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', function () {
      var open = navigation.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
  }

  var dateLabel = document.getElementById('strip-date');
  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}());
