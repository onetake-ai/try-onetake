/**
 * /assets/info-bubbles/info-bubbles.js
 *
 * Info bubbles (tooltips) without dependencies. Load /assets/info-bubbles/info-bubbles.css too.
 *
 *   oneTakeInfoBubbles.renderGroups(container, families, items, options)
 *     families: [{ key, name, intro }]            one group per family, in this order
 *     items:    [{ family, name, description }]   rows of each group
 *     options:  { label: function (name) { return 'En savoir plus sur ' + name; } }
 *     Renders the groups, then binds the bubbles.
 *
 *   oneTakeInfoBubbles.bind(root)
 *     Binds every <button data-info-bubble="ID"> in root to the element #ID (the bubble text).
 *     Use it for triggers written in the HTML.
 *
 * Behavior: opens on hover (mouse) and keyboard focus; tap or click toggles it; closes on Escape,
 * outside tap, mouse leave or blur (unless opened by a click). One bubble open at a time.
 * Placed above the trigger, below when there is no room, always inside the viewport (16 px margin).
 */
(function () {
  'use strict';

  var MARGIN = 16;   // Minimum distance to the viewport edges
  var GAP = 10;      // Distance between the trigger and the bubble (room for the arrow)

  var layer = null;
  var current = null;   // { trigger, bubble, pinned }
  var counter = 0;

  function getLayer() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ib-layer';
      document.body.appendChild(layer);
    }
    return layer;
  }

  function place(trigger, bubble) {
    var rect = trigger.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    bubble.style.maxWidth = Math.min(280, vw - 2 * MARGIN) + 'px';
    bubble.style.left = '0px';
    bubble.style.top = '0px';
    var b = bubble.getBoundingClientRect();

    // Centered on the trigger's icon when it has one, else on the trigger
    var icon = trigger.querySelector('.ib-icon');
    var anchor = icon ? icon.getBoundingClientRect() : rect;
    var centerX = anchor.left + anchor.width / 2;
    var left = Math.max(MARGIN, Math.min(centerX - b.width / 2, vw - MARGIN - b.width));

    var above = rect.top - GAP - b.height >= MARGIN;
    var below = rect.bottom + GAP + b.height <= vh - MARGIN;
    var placeAbove = above || !below && rect.top > vh - rect.bottom;
    var top = placeAbove ? rect.top - GAP - b.height : rect.bottom + GAP;

    bubble.style.left = Math.round(left) + 'px';
    bubble.style.top = Math.round(top) + 'px';
    bubble.classList.toggle('ib-below', !placeAbove);
    var arrowX = Math.max(12, Math.min(centerX - left, b.width - 12));
    bubble.style.setProperty('--ib-arrow-x', Math.round(arrowX) + 'px');
  }

  function open(trigger, pinned) {
    var bubble = document.getElementById(trigger.getAttribute('data-info-bubble'));
    if (!bubble) return;
    if (current && current.trigger !== trigger) close();
    current = { trigger: trigger, bubble: bubble, pinned: !!pinned || !!(current && current.pinned) };
    bubble.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    place(trigger, bubble);
  }

  function close() {
    if (!current) return;
    current.bubble.hidden = true;
    current.trigger.setAttribute('aria-expanded', 'false');
    current.trigger.classList.remove('is-open');
    current = null;
  }

  function bindTrigger(trigger) {
    if (trigger.__infoBubble) return;
    trigger.__infoBubble = true;
    trigger.setAttribute('aria-expanded', 'false');

    var bubble = document.getElementById(trigger.getAttribute('data-info-bubble'));
    if (bubble) {
      bubble.hidden = true;
      bubble.setAttribute('role', 'tooltip');
      bubble.classList.add('ib-bubble');
      getLayer().appendChild(bubble);
    }

    trigger.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') open(trigger, false);
    });
    trigger.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && current && current.trigger === trigger && !current.pinned) close();
    });
    trigger.addEventListener('focus', function () {
      // Keyboard focus only: a click or tap is handled by the click listener
      var keyboard = true;
      try { keyboard = trigger.matches(':focus-visible'); } catch (e) { /* old browser */ }
      if (keyboard) open(trigger, false);
    });
    trigger.addEventListener('blur', function () {
      if (current && current.trigger === trigger) close();
    });
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      if (current && current.trigger === trigger && current.pinned) { close(); return; }
      if (current && current.trigger === trigger) { current.pinned = true; return; }
      open(trigger, true);
    });
  }

  function bind(root) {
    (root || document).querySelectorAll('[data-info-bubble]').forEach(bindTrigger);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current) {
      var trigger = current.trigger;
      close();
      if (document.activeElement !== trigger) trigger.focus({ preventScroll: true });
    }
  });
  document.addEventListener('pointerdown', function (e) {
    if (current && !current.trigger.contains(e.target) && !current.bubble.contains(e.target)) close();
  });
  window.addEventListener('resize', function () { if (current) place(current.trigger, current.bubble); });
  window.addEventListener('scroll', function () { if (current) place(current.trigger, current.bubble); }, { passive: true });

  function text(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function renderGroups(container, families, items, options) {
    var label = (options && options.label) || function (name) { return 'En savoir plus sur ' + name; };
    container.innerHTML = '';

    families.forEach(function (family) {
      var group = document.createElement('div');
      group.className = 'ib-group';
      var head = document.createElement('h4');
      head.className = 'ib-group-title';
      head.appendChild(text('span', 'ib-family', family.name));
      if (family.intro) head.appendChild(text('span', 'ib-intro', family.intro));
      group.appendChild(head);

      var list = document.createElement('ul');
      list.className = 'ib-list';
      items.filter(function (item) { return item.family === family.key; }).forEach(function (item) {
        var id = 'ib-' + (++counter);
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'ib-trigger';
        button.setAttribute('data-info-bubble', id);
        button.setAttribute('aria-label', label(item.name));
        button.setAttribute('aria-describedby', id);
        button.appendChild(text('span', 'ib-name', item.name));
        var icon = text('span', 'ib-icon', 'i');
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);

        var li = document.createElement('li');
        li.appendChild(button);
        li.appendChild(text('div', '', item.description)).id = id;
        list.appendChild(li);
      });
      group.appendChild(list);
      container.appendChild(group);
    });

    bind(container);
  }

  window.oneTakeInfoBubbles = { renderGroups: renderGroups, bind: bind, close: close };
})();
