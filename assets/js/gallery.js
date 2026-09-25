/* ==========================================================================
   gallery.js  —  product carousel + zoom lightbox, written from scratch.
   No Swiper, no Flickity, no plugin of any kind.

   One factory, used twice:
     • the inline carousel in the product section (dots overlaid on the
       image, zoom button bottom-right)
     • the full-screen lightbox the zoom button opens (dots, arrows, close)
   The two stay in sync: the lightbox opens on the slide you were looking at,
   and closing it leaves the carousel on the slide you ended on.

   Slides can be images or a video. A video slide:
     • loads nothing until it first becomes the active slide
     • plays muted on a loop only while it is active and on screen
     • pauses the moment you swipe away, close the lightbox, or scroll off
     • with prefers-reduced-motion, never autoplays — native controls instead

   Input: arrow keys, pointer drag/swipe (mouse, touch, pen), the dots, and
   on desktop, clicking the left/right half of the image (a round arrow
   follows the mouse to show which way it will go).
   ========================================================================== */
(function (window, document) {
  'use strict';

  var VC = (window.VC = window.VC || {});
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function create(root, options) {
    var settings = options || {};
    var track = root.querySelector('[data-gallery-track]');
    var dots  = root.querySelector('[data-gallery-dots]');
    var prev  = root.querySelector('[data-gallery-prev]');
    var next  = root.querySelector('[data-gallery-next]');
    var live  = root.querySelector('[data-gallery-live]');

    var media = [];
    var index = 0;
    var active = settings.active !== false;   // the lightbox starts inactive
    var onScreen = true;

    /* ---- rendering ----------------------------------------------------- */

    function buildSlide(item, i) {
      var slide = document.createElement('li');
      slide.className = 'gallery__slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (i + 1) + ' of ' + media.length);

      if (item.type === 'video') {
        var video = document.createElement('video');
        video.className = 'gallery__video';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.preload = 'none';
        video.poster = item.poster;
        video.dataset.src = item.src;           // assigned on first activation
        video.setAttribute('aria-label', item.alt || '');
        if (reduceMotion) video.controls = true;
        slide.appendChild(video);
      } else {
        var img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt || '';
        img.width = 1200;
        img.height = 1200;
        img.decoding = 'async';
        if (i > 0 || settings.lazy) img.loading = 'lazy';
        img.draggable = false;
        slide.appendChild(img);
      }
      return slide;
    }

    function render() {
      track.textContent = '';
      if (dots) dots.textContent = '';

      media.forEach(function (item, i) {
        track.appendChild(buildSlide(item, i));

        if (dots) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'gallery__dot';
          dot.setAttribute('aria-label', 'Show slide ' + (i + 1) + ' of ' + media.length);
          dot.addEventListener('click', function () { goTo(i); });
          dots.appendChild(dot);
        }
      });

      update();
    }

    function update() {
      track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';

      if (dots) {
        for (var i = 0; i < dots.children.length; i++) {
          var current = i === index;
          dots.children[i].classList.toggle('is-active', current);
          if (current) dots.children[i].setAttribute('aria-current', 'true');
          else dots.children[i].removeAttribute('aria-current');
        }
      }

      /* Hide off-screen slides from assistive tech. */
      var slides = track.children;
      for (var j = 0; j < slides.length; j++) {
        slides[j].setAttribute('aria-hidden', String(j !== index));
      }

      if (live) live.textContent = 'Slide ' + (index + 1) + ' of ' + media.length;
      if (prev) prev.disabled = media.length < 2;
      if (next) next.disabled = media.length < 2;

      syncVideos();
      if (settings.onChange) settings.onChange(index);
    }

    /* Play the active slide's video (if any); pause every other one. */
    function syncVideos() {
      var videos = track.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        var v = videos[i];
        var isCurrent = v.parentNode === track.children[index];

        if (isCurrent && active && onScreen) {
          if (!v.src && v.dataset.src) v.src = v.dataset.src;   // lazy load
          if (!reduceMotion) {
            var p = v.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
          }
        } else if (!v.paused) {
          v.pause();
        }
      }
    }

    /* ---- navigation ------------------------------------------------------ */

    function goTo(i) {
      if (!media.length) return;
      index = (i % media.length + media.length) % media.length;   // wrap
      update();
    }

    function step(delta) { goTo(index + delta); }

    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    /* Hover navigation: the left/right halves of the image are the prev/next
       buttons, and a round arrow bubble follows the mouse over whichever
       half it's in. Mouse only — touch uses swipe, keyboard uses the arrows
       (and the bubble parks at the edge when a half is keyboard-focused). */
    var cursor = root.querySelector('[data-gallery-cursor]');
    var surface = track.parentNode;
    if (cursor && prev && next) {
      var showCursor = function (dir, x, y) {
        cursor.dataset.dir = dir;
        cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        cursor.classList.add('is-visible');
      };
      var hideCursor = function () { cursor.classList.remove('is-visible'); };

      [prev, next].forEach(function (zone) {
        var dir = zone === prev ? 'prev' : 'next';
        zone.addEventListener('pointermove', function (event) {
          if (event.pointerType !== 'mouse') return;
          var box = surface.getBoundingClientRect();
          showCursor(dir, event.clientX - box.left, event.clientY - box.top);
        });
        zone.addEventListener('pointerleave', hideCursor);
        zone.addEventListener('focus', function () {
          if (!zone.matches(':focus-visible')) return;
          var box = surface.getBoundingClientRect();
          showCursor(dir, dir === 'prev' ? 40 : box.width - 40, box.height / 2);
        });
        zone.addEventListener('blur', hideCursor);
      });
    }

    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft')  { step(-1); event.preventDefault(); }
      if (event.key === 'ArrowRight') { step(1);  event.preventDefault(); }
    });

    /* ---- drag / swipe ---------------------------------------------------- */
    (function enableSwipe() {
      var startX = 0, startY = 0, deltaX = 0, dragging = false, locked = false, width = 0;

      var surface = track.parentNode;
      var justDragged = false;
      surface.addEventListener('click', function (event) {
        if (justDragged) { event.stopPropagation(); event.preventDefault(); }
      }, true);

      surface.addEventListener('pointerdown', function (event) {
        if (event.target.closest('.gallery__dot, [data-gallery-zoom]')) return;
        if (event.button !== undefined && event.button !== 0) return;
        if (media.length < 2) return;
        dragging = true; locked = false;
        startX = event.clientX; startY = event.clientY; deltaX = 0;
        width = track.getBoundingClientRect().width || 1;
      });

      window.addEventListener('pointermove', function (event) {
        if (!dragging) return;
        deltaX = event.clientX - startX;
        /* Decide once whether this is a horizontal swipe or a page scroll. */
        if (!locked) {
          if (Math.abs(deltaX) < 6) return;
          if (Math.abs(event.clientY - startY) > Math.abs(deltaX)) { dragging = false; return; }
          locked = true;
          track.classList.add('is-dragging');
        }
        var offset = (-index * 100) + (deltaX / width) * 100;
        track.style.transform = 'translate3d(' + offset + '%,0,0)';
      }, { passive: true });

      function end() {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        if (!locked) return;
        justDragged = true;
        window.setTimeout(function () { justDragged = false; }, 0);
        var threshold = Math.min(width * 0.2, 60);
        if (deltaX > threshold) step(-1);
        else if (deltaX < -threshold) step(1);
        else update();
      }
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      surface.addEventListener('dragstart', function (e) { e.preventDefault(); });
    })();

    /* Pause the video when the carousel scrolls out of view. */
    if ('IntersectionObserver' in window && settings.observeVisibility) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        syncVideos();
      }, { threshold: 0.25 }).observe(root);
    }

    /* ---- public --------------------------------------------------------- */
    return {
      setMedia: function (nextMedia, keepIndex) {
        media = nextMedia.slice();
        if (!keepIndex || index >= media.length) index = 0;
        render();
      },
      goTo: goTo,
      setActive: function (on) { active = on; syncVideos(); },
      get index() { return index; }
    };
  }

  /* ======================================================================
     Lightbox — the zoom view. Full-screen, modal, same slides.
     ====================================================================== */
  function createLightbox(box, media, callbacks) {
    var closeBtn = box.querySelector('[data-lightbox-close]');
    var lastFocused = null;

    var viewer = create(box, { active: false, lazy: true });
    viewer.setMedia(media);

    function open(atIndex) {
      lastFocused = document.activeElement;
      box.hidden = false;
      document.body.classList.add('is-locked');
      viewer.goTo(atIndex || 0);
      viewer.setActive(true);
      window.requestAnimationFrame(function () {
        box.classList.add('is-open');
        if (closeBtn) closeBtn.focus();
      });
      if (callbacks && callbacks.onOpen) callbacks.onOpen();
    }

    function close() {
      if (box.hidden) return;
      viewer.setActive(false);
      box.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      window.setTimeout(function () { box.hidden = true; }, 250);
      if (callbacks && callbacks.onClose) callbacks.onClose(viewer.index);
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    if (closeBtn) closeBtn.addEventListener('click', close);
    /* Click on the dark backdrop (not the image) closes too. */
    box.addEventListener('click', function (event) {
      if (event.target === box || event.target.hasAttribute('data-lightbox-backdrop')) close();
    });

    document.addEventListener('keydown', function (event) {
      if (box.hidden) return;
      if (event.key === 'Escape') { close(); return; }
      /* Arrow keys are handled by the viewer's own keydown listener — focus
         is always inside the box while it's open. */
      if (event.key === 'Tab') {
        /* Keep focus inside the modal. */
        var f = box.querySelectorAll('button:not([disabled])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
      }
    });

    return { open: open, close: close, setMedia: function (m) { viewer.setMedia(m); } };
  }

  VC.Gallery = { create: create, createLightbox: createLightbox };
})(window, document);
