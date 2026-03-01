(function () {
  if (typeof window.__TAURI__ === 'undefined') return;
  var pickerActive = false;
  var hoveredEl = null;
  var HOVER_OUTLINE = '2px solid #7C6FF7';
  var HOVER_BG = '#7C6FF720';

  function getUniqueIdSelector(el) {
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) {
      var others = document.querySelectorAll('#' + CSS.escape(el.id));
      if (others.length === 1) return '#' + el.id;
    }
    return null;
  }

  function getClassSelector(el) {
    if (!el.className || typeof el.className !== 'string') return null;
    var classes = el.className.trim().split(/\s+/).filter(Boolean);
    if (classes.length === 0) return null;
    var selector = '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
    try {
      var others = document.querySelectorAll(selector);
      if (others.length === 1) return selector;
    } catch (_) {}
    return null;
  }

  function buildPathSelector(el) {
    var path = [];
    var current = el;
    while (current && current !== document.body) {
      var part = current.tagName.toLowerCase();
      if (current.id && /^[a-zA-Z][\w-]*$/.test(current.id)) {
        path.unshift('#' + current.id);
        break;
      }
      if (current.className && typeof current.className === 'string') {
        var classes = current.className.trim().split(/\s+/).filter(Boolean);
        if (classes.length > 0 && classes.length <= 3) {
          part += '.' + classes.slice(0, 2).map(function(c) { return CSS.escape(c); }).join('.');
        }
      }
      var parent = current.parentElement;
      if (parent) {
        var sameTag = [].filter.call(parent.children, function(c) {
          return c.tagName === current.tagName;
        });
        var idx = sameTag.indexOf(current) + 1;
        if (sameTag.length > 1) part += ':nth-of-type(' + idx + ')';
      }
      path.unshift(part);
      current = parent;
    }
    return path.join(' > ');
  }

  function generateSelector(el) {
    var s = getUniqueIdSelector(el);
    if (s) return s;
    s = getClassSelector(el);
    if (s) return s;
    return buildPathSelector(el);
  }

  function clearHover() {
    if (hoveredEl) {
      hoveredEl.style.outline = '';
      hoveredEl.style.outlineOffset = '';
      hoveredEl.style.backgroundColor = '';
      hoveredEl = null;
    }
  }

  function onMouseOver(e) {
    if (!pickerActive) return;
    var el = e.target;
    clearHover();
    hoveredEl = el;
    el.style.outline = HOVER_OUTLINE;
    el.style.outlineOffset = '2px';
    el.style.backgroundColor = HOVER_BG;
  }

  function onMouseOut() {
    if (!pickerActive) return;
    clearHover();
  }

  function onMouseDown(e) {
    if (!pickerActive) return;
    e.preventDefault();
    e.stopPropagation();
    var selector = generateSelector(e.target);
    try {
      window.__TAURI__.event.emit('selector-picked', selector);
    } catch (err) {
      console.warn('Tauri emit failed:', err);
    }
    return false;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      pickerActive = false;
      clearHover();
      document.body.style.cursor = '';
      try {
        window.__TAURI__.event.emit('picker-deactivated', {});
      } catch (_) {}
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    try {
      window.__TAURI__.event.listen('picker-activate', function() {
        pickerActive = true;
        document.body.style.cursor = 'crosshair';
      });
      window.__TAURI__.event.listen('picker-deactivate', function() {
        pickerActive = false;
        clearHover();
        document.body.style.cursor = '';
      });
    } catch (_) {}
  }
  init();
})();
