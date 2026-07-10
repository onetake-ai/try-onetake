(function () {
  var now = Date.now();
  var items = document.querySelectorAll('.episode-nav-item[data-release]');
  for (var i = 0; i < items.length; i++) {
    var el = items[i];
    var release = new Date(el.getAttribute('data-release')).getTime();
    if (now < release) {
      var span = document.createElement('span');
      span.className = 'episode-nav-item is-locked';
      span.innerHTML = el.querySelector('.episode-nav-label').outerHTML +
        '<span class="episode-nav-status">Coming soon</span>';
      el.parentNode.replaceChild(span, el);
    }
  }
})();
