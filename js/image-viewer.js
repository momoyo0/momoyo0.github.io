(function() {
  'use strict';

  // Vanilla Hexo port of astro-koharu's Markdown image enhancer,
  // ImageLightbox and useZoomPan at c48aa2c9f38af071d5fd24c3dce70ed9106f3e17.
  // The original React/rehype boundary is replaced with one progressively
  // enhanced DOM component so posts and Git-backed Moments share a viewer.
  if (window.BlogImageViewer) return;

  var MIN_SCALE = 0.5;
  var MAX_SCALE = 5;
  var CONTENT_SELECTOR = '.post-body';
  var enhancedImages = new WeakSet();
  var enhancedContainers = new WeakSet();
  var lastFocused = null;
  var previousBodyOverflow = '';
  var hintTimer = 0;
  var transformFrame = 0;
  var state = {
    open: false,
    images: [],
    index: 0,
    scale: 1,
    translateX: 0,
    translateY: 0,
    rotation: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    initialPinchDistance: 0,
    initialPinchScale: 1
  };

  function svg(path, className) {
    return '<svg class="' + (className || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + path + '"></path></svg>';
  }

  var icons = {
    zoomIn: 'm18.031 16.617l4.283 4.282l-1.415 1.415l-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9s9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617m-2.006-.742A6.98 6.98 0 0 0 18 11c0-3.867-3.133-7-7-7s-7 3.133-7 7s3.133 7 7 7a6.98 6.98 0 0 0 4.875-1.975zM10 10V7h2v3h3v2h-3v3h-2v-3H7v-2z',
    zoomOut: 'm18.031 16.617l4.283 4.282l-1.415 1.415l-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9s9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617m-2.006-.742A6.98 6.98 0 0 0 18 11c0-3.867-3.133-7-7-7s-7 3.133-7 7s3.133 7 7 7a6.98 6.98 0 0 0 4.875-1.975zM7 10h8v2H7z',
    rotate: 'm20 10.586l1.828-1.829l1.415 1.415L19 14.414l-4.243-4.242l1.415-1.415L18 10.586V8a3 3 0 0 0-3-3h-4V3h4a5 5 0 0 1 5 5zM13 9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zm-1 2H4v8h8z',
    close: 'm12 10.587l4.95-4.95l1.414 1.414l-4.95 4.95l4.95 4.95l-1.415 1.414l-4.95-4.95l-4.949 4.95l-1.414-1.415l4.95-4.95l-4.95-4.95L7.05 5.638z',
    previous: 'm10.828 12l4.95 4.95l-1.414 1.415L8 12l6.364-6.364l1.414 1.414z',
    next: 'm13.172 12l-4.95-4.95l1.414-1.413L16 12l-6.364 6.364l-1.414-1.415z',
    fullscreen: 'M8 3v2H4v4H2V3zM2 21v-6h2v4h4v2zm20 0h-6v-2h4v-4h2zm0-12h-2V5h-4V3h6z'
  };

  function createButton(action, label, icon) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'image-lightbox-button image-lightbox-' + action;
    button.dataset.lightboxAction = action;
    button.setAttribute('aria-label', label);
    button.title = label;
    if (icon) button.innerHTML = svg(icon, 'image-lightbox-icon');
    return button;
  }

  var overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = [
    '<div class="image-lightbox-backdrop"></div>',
    '<div class="image-lightbox-layer" role="dialog" aria-modal="true" aria-label="图片查看器">',
    '  <div class="image-lightbox-toolbar" data-lightbox-toolbar></div>',
    '  <div class="image-lightbox-viewport" data-lightbox-viewport role="img">',
    '    <div class="image-lightbox-frame">',
    '      <img class="image-lightbox-image" alt="" draggable="false">',
    '    </div>',
    '  </div>',
    '  <div class="image-lightbox-navigation" data-lightbox-navigation hidden></div>',
    '  <div class="image-lightbox-hint" aria-hidden="true">',
    '    <span class="image-lightbox-hint-desktop">滚轮缩放 · 双击放大 · 拖动</span>',
    '    <span class="image-lightbox-hint-mobile">双指缩放 · 拖动</span>',
    '  </div>',
    '  <span class="image-lightbox-status moments-sr-only" aria-live="polite"></span>',
    '</div>'
  ].join('');

  var layer = overlay.querySelector('.image-lightbox-layer');
  var viewport = overlay.querySelector('[data-lightbox-viewport]');
  var frame = overlay.querySelector('.image-lightbox-frame');
  var lightboxImage = overlay.querySelector('.image-lightbox-image');
  var toolbar = overlay.querySelector('[data-lightbox-toolbar]');
  var navigation = overlay.querySelector('[data-lightbox-navigation]');
  var hint = overlay.querySelector('.image-lightbox-hint');
  var status = overlay.querySelector('.image-lightbox-status');

  var zoomInButton = createButton('zoom-in', '放大', icons.zoomIn);
  var zoomLevelButton = createButton('reset', '重置缩放与旋转');
  zoomLevelButton.classList.add('image-lightbox-zoom-level');
  zoomLevelButton.textContent = '100%';
  var zoomOutButton = createButton('zoom-out', '缩小', icons.zoomOut);
  var rotateButton = createButton('rotate', '顺时针旋转', icons.rotate);
  var closeButton = createButton('close', '关闭', icons.close);
  var separatorOne = document.createElement('span');
  var separatorTwo = document.createElement('span');
  separatorOne.className = separatorTwo.className = 'image-lightbox-separator';
  toolbar.append(zoomInButton, zoomLevelButton, zoomOutButton, separatorOne, rotateButton, separatorTwo, closeButton);

  var previousButton = createButton('previous', '上一张', icons.previous);
  var counter = document.createElement('span');
  counter.className = 'image-lightbox-counter';
  var nextButton = createButton('next', '下一张', icons.next);
  navigation.append(previousButton, counter, nextButton);

  function appendOverlay() {
    if (!overlay.isConnected && document.body) document.body.appendChild(overlay);
  }

  function clampScale(value) {
    return Math.min(Math.max(MIN_SCALE, value), MAX_SCALE);
  }

  function applyTransform() {
    lightboxImage.style.transform = 'translate3d(' + state.translateX + 'px, ' + state.translateY + 'px, 0) scale(' + state.scale + ') rotate(' + state.rotation + 'deg)';
    lightboxImage.style.cursor = state.scale > 1.05 ? (state.dragging ? 'grabbing' : 'grab') : 'zoom-in';
    zoomLevelButton.textContent = Math.round(state.scale * 100) + '%';
    zoomInButton.disabled = state.scale >= 4.9;
    zoomOutButton.disabled = state.scale <= 0.55;
  }

  function scheduleTransform() {
    if (transformFrame) return;
    transformFrame = requestAnimationFrame(function() {
      transformFrame = 0;
      applyTransform();
    });
  }

  function resetTransform() {
    if (transformFrame) {
      cancelAnimationFrame(transformFrame);
      transformFrame = 0;
    }
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    state.rotation = 0;
    state.dragging = false;
    applyTransform();
  }

  function zoomTo(targetScale, centerX, centerY) {
    var nextScale = clampScale(targetScale);
    var rect = viewport.getBoundingClientRect();
    var cx = (centerX == null ? rect.left + rect.width / 2 : centerX) - rect.left - rect.width / 2;
    var cy = (centerY == null ? rect.top + rect.height / 2 : centerY) - rect.top - rect.height / 2;
    var factor = nextScale / state.scale;
    state.translateX = cx - (cx - state.translateX) * factor;
    state.translateY = cy - (cy - state.translateY) * factor;
    state.scale = nextScale;
    scheduleTransform();
  }

  function syncNavigation() {
    var multiple = state.images.length > 1;
    navigation.hidden = !multiple;
    previousButton.disabled = state.index <= 0;
    nextButton.disabled = state.index >= state.images.length - 1;
    counter.textContent = (state.index + 1) + ' / ' + state.images.length;
    status.textContent = '第 ' + (state.index + 1) + ' 张，共 ' + state.images.length + ' 张';
  }

  function loadCurrentImage() {
    var current = state.images[state.index];
    if (!current) return;
    resetTransform();
    lightboxImage.classList.remove('is-loaded');
    lightboxImage.alt = current.alt || '图片';
    viewport.setAttribute('aria-label', current.alt || '图片');
    lightboxImage.src = current.src;
    if (lightboxImage.complete && lightboxImage.naturalWidth > 0) {
      requestAnimationFrame(function() { lightboxImage.classList.add('is-loaded'); });
    }
    syncNavigation();
  }

  function normalizeImageList(detail) {
    var source = detail && Array.isArray(detail.images) ? detail.images : [];
    var images = source.map(function(image) {
      return {
        src: String(image && image.src || ''),
        alt: String(image && image.alt || '图片')
      };
    }).filter(function(image) { return image.src; });
    if (!images.length && detail && detail.src) {
      images.push({ src: String(detail.src), alt: String(detail.alt || '图片') });
    }
    var index = Number(detail && detail.currentIndex);
    if (!Number.isInteger(index) || index < 0 || index >= images.length) index = 0;
    return { images: images, index: index };
  }

  function openLightbox(detail) {
    var normalized = normalizeImageList(detail);
    if (!normalized.images.length) return;
    appendOverlay();
    if (!state.open) {
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousBodyOverflow = document.body.style.overflow;
    }
    state.open = true;
    state.images = normalized.images;
    state.index = normalized.index;
    document.body.style.overflow = 'hidden';
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function() { overlay.classList.add('is-open'); });
    loadCurrentImage();
    hint.classList.remove('is-hidden');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function() { hint.classList.add('is-hidden'); }, 4000);
    window.setTimeout(function() { zoomInButton.focus({ preventScroll: true }); }, 0);
  }

  function closeLightbox() {
    if (!state.open) return;
    state.open = false;
    state.dragging = false;
    if (transformFrame) {
      cancelAnimationFrame(transformFrame);
      transformFrame = 0;
    }
    window.clearTimeout(hintTimer);
    overlay.classList.remove('is-open');
    document.body.style.overflow = previousBodyOverflow;
    window.setTimeout(function() {
      if (state.open) return;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      lightboxImage.removeAttribute('src');
      if (lastFocused && lastFocused.isConnected) lastFocused.focus({ preventScroll: true });
    }, 200);
  }

  function navigate(direction) {
    var nextIndex = state.index + direction;
    if (nextIndex < 0 || nextIndex >= state.images.length) return;
    state.index = nextIndex;
    loadCurrentImage();
  }

  function handleAction(action) {
    if (action === 'zoom-in') zoomTo(state.scale * 1.5);
    else if (action === 'zoom-out') zoomTo(state.scale / 1.5);
    else if (action === 'reset') resetTransform();
    else if (action === 'rotate') {
      state.rotation = (state.rotation + 90) % 360;
      applyTransform();
    } else if (action === 'close') closeLightbox();
    else if (action === 'previous') navigate(-1);
    else if (action === 'next') navigate(1);
  }

  overlay.addEventListener('click', function(event) {
    if (!(event.target instanceof Element)) return;
    var actionButton = event.target.closest('[data-lightbox-action]');
    if (actionButton) {
      handleAction(actionButton.dataset.lightboxAction);
      return;
    }
    if (state.scale > 1.05) return;
    if (event.target === viewport || event.target === frame || event.target === layer || event.target.classList.contains('image-lightbox-backdrop')) {
      closeLightbox();
    }
  });

  lightboxImage.addEventListener('load', function() {
    lightboxImage.classList.add('is-loaded');
  });

  lightboxImage.addEventListener('error', function() {
    status.textContent = '图片加载失败';
  });

  viewport.addEventListener('dblclick', function(event) {
    event.preventDefault();
    if (state.scale > 1.05) resetTransform();
    else zoomTo(2, event.clientX, event.clientY);
  });

  viewport.addEventListener('wheel', function(event) {
    if (!state.open) return;
    event.preventDefault();
    zoomTo(state.scale * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY);
  }, { passive: false });

  viewport.addEventListener('mousedown', function(event) {
    if (event.button !== 0) return;
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.startTranslateX = state.translateX;
    state.startTranslateY = state.translateY;
    applyTransform();
  });

  document.addEventListener('mousemove', function(event) {
    if (!state.open || !state.dragging) return;
    state.translateX = state.startTranslateX + event.clientX - state.startX;
    state.translateY = state.startTranslateY + event.clientY - state.startY;
    scheduleTransform();
  });

  document.addEventListener('mouseup', function() {
    if (!state.dragging) return;
    state.dragging = false;
    applyTransform();
  });

  function touchDistance(first, second) {
    var x = first.clientX - second.clientX;
    var y = first.clientY - second.clientY;
    return Math.sqrt(x * x + y * y);
  }

  viewport.addEventListener('touchstart', function(event) {
    if (event.touches.length === 2) {
      event.preventDefault();
      state.initialPinchDistance = touchDistance(event.touches[0], event.touches[1]);
      state.initialPinchScale = state.scale;
      state.dragging = false;
    } else if (event.touches.length === 1) {
      state.dragging = true;
      state.startX = event.touches[0].clientX;
      state.startY = event.touches[0].clientY;
      state.startTranslateX = state.translateX;
      state.startTranslateY = state.translateY;
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', function(event) {
    if (event.touches.length === 2 && state.initialPinchDistance) {
      event.preventDefault();
      state.scale = clampScale(state.initialPinchScale * touchDistance(event.touches[0], event.touches[1]) / state.initialPinchDistance);
      scheduleTransform();
    } else if (event.touches.length === 1 && state.dragging) {
      state.translateX = state.startTranslateX + event.touches[0].clientX - state.startX;
      state.translateY = state.startTranslateY + event.touches[0].clientY - state.startY;
      scheduleTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', function() {
    state.dragging = false;
    state.initialPinchDistance = 0;
    applyTransform();
  });

  document.addEventListener('wheel', function(event) {
    if (state.open) event.preventDefault();
  }, { passive: false });

  document.addEventListener('keydown', function(event) {
    if (!state.open) return;
    if (event.key === 'Escape') closeLightbox();
    else if (event.key === 'ArrowLeft') navigate(-1);
    else if (event.key === 'ArrowRight') navigate(1);
    else if (event.key === '=' || event.key === '+') zoomTo(state.scale * 1.5);
    else if (event.key === '-') zoomTo(state.scale / 1.5);
    else if (event.key === 'r' || event.key === 'R') handleAction('rotate');
    else if (event.key === '0') resetTransform();
    else if (event.key === 'Tab') {
      var focusable = Array.from(layer.querySelectorAll('button:not([disabled]):not([hidden])')).filter(function(button) {
        return !button.closest('[hidden]');
      });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  function createFullscreenButton() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'markdown-image-fullscreen';
    button.setAttribute('aria-label', '全屏查看');
    button.title = '全屏查看';
    button.innerHTML = svg(icons.fullscreen, 'markdown-image-fullscreen-icon');
    return button;
  }

  function createErrorPlaceholder(img) {
    var placeholder = document.createElement('div');
    placeholder.className = 'markdown-image-error';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', img.alt ? '图片加载失败：' + img.alt : '图片加载失败');
    placeholder.innerHTML = '<span class="markdown-image-error-icon" aria-hidden="true"></span><span class="markdown-image-error-text">图片加载失败</span>';
    return placeholder;
  }

  function handleImageLoaded(img, container) {
    img.classList.add('loaded');
    var wrapper = img.closest('.markdown-image-wrapper');
    if (!wrapper) return;
    var portrait = img.naturalHeight > img.naturalWidth * 1.2;
    wrapper.classList.toggle('portrait', portrait);
    if (img.naturalWidth && img.naturalHeight) wrapper.dataset.aspectRatio = String(img.naturalWidth / img.naturalHeight);
    if (!wrapper.querySelector('.markdown-image-fullscreen')) wrapper.appendChild(createFullscreenButton());
    img.style.cursor = 'zoom-in';
    window.setTimeout(function() { groupPortraitImages(container); }, 100);
  }

  function handleImageError(img) {
    img.classList.add('error');
    var wrapper = img.closest('.markdown-image-wrapper');
    if (wrapper && !wrapper.querySelector('.markdown-image-error')) wrapper.appendChild(createErrorPlaceholder(img));
  }

  function unwrapFigureParagraphs(container) {
    container.querySelectorAll('p').forEach(function(paragraph) {
      var meaningful = Array.from(paragraph.childNodes).filter(function(node) {
        return node.nodeType !== Node.TEXT_NODE || node.textContent.trim() !== '';
      });
      if (!meaningful.length || !meaningful.every(function(node) {
        return node.nodeType === Node.ELEMENT_NODE && node.matches('.markdown-image-wrapper');
      })) return;
      meaningful.forEach(function(figure) { paragraph.parentNode.insertBefore(figure, paragraph); });
      paragraph.remove();
    });
  }

  function isConsecutiveSibling(first, second) {
    var next = first.nextSibling;
    while (next) {
      if (next.nodeType === Node.TEXT_NODE && next.textContent.trim() === '') {
        next = next.nextSibling;
        continue;
      }
      return next === second;
    }
    return false;
  }

  function groupPortraitImages(container) {
    var wrappers = Array.from(container.querySelectorAll('.markdown-image-wrapper'));
    var current = [];
    function flush() {
      if (current.length >= 2) {
        var row = document.createElement('div');
        row.className = 'markdown-image-row';
        current[0].parentNode.insertBefore(row, current[0]);
        current.forEach(function(wrapper) {
          if (wrapper.dataset.aspectRatio) wrapper.style.flex = wrapper.dataset.aspectRatio;
          row.appendChild(wrapper);
        });
      }
      current = [];
    }
    wrappers.forEach(function(wrapper, index) {
      if (wrapper.parentElement && wrapper.parentElement.classList.contains('markdown-image-row')) return;
      if (wrapper.classList.contains('portrait')) {
        var previous = wrappers[index - 1];
        if (current.length && previous && previous.classList.contains('portrait') && isConsecutiveSibling(previous, wrapper)) current.push(wrapper);
        else {
          flush();
          current = [wrapper];
        }
      } else flush();
    });
    flush();
  }

  function enhanceImage(img, container) {
    if (enhancedImages.has(img)) return;
    enhancedImages.add(img);
    img.loading = 'lazy';
    img.decoding = 'async';

    // Match Cosine's rehype rule: linked images keep their original link and
    // only receive loading hints; pre-existing figures/custom media stay owned
    // by their component rather than being wrapped a second time.
    if (img.closest('a, figure, pre, .highlight, .moments-media-gallery') || img.classList.contains('moments-media-image')) return;

    var wrapper = document.createElement('figure');
    wrapper.className = 'markdown-image-wrapper';
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    img.classList.add('markdown-image');
    if (img.alt && img.alt.trim()) {
      var caption = document.createElement('figcaption');
      caption.className = 'markdown-image-caption';
      caption.textContent = img.alt.trim();
      wrapper.appendChild(caption);
    }

    if (img.complete && img.naturalWidth > 0) handleImageLoaded(img, container);
    else if (img.complete && img.naturalWidth === 0) handleImageError(img);
    else {
      img.addEventListener('load', function() { handleImageLoaded(img, container); }, { once: true });
      img.addEventListener('error', function() { handleImageError(img); }, { once: true });
    }
  }

  function enhanceContainer(container) {
    if (!enhancedContainers.has(container)) {
      enhancedContainers.add(container);
      container.addEventListener('click', function(event) {
        if (!(event.target instanceof Element)) return;
        var target = event.target;
        var button = target.closest('.markdown-image-fullscreen');
        var img = button
          ? button.closest('.markdown-image-wrapper').querySelector('.markdown-image')
          : target.closest('.markdown-image');
        if (!img || !img.classList.contains('loaded')) return;
        if (button) event.stopPropagation();
        var images = Array.from(container.querySelectorAll('.markdown-image.loaded')).map(function(item) {
          return { src: item.currentSrc || item.src, alt: item.alt || '图片' };
        });
        var allImages = Array.from(container.querySelectorAll('.markdown-image.loaded'));
        window.dispatchEvent(new CustomEvent('open-image-lightbox', {
          detail: {
            src: img.currentSrc || img.src,
            alt: img.alt || '图片',
            images: images,
            currentIndex: Math.max(0, allImages.indexOf(img))
          }
        }));
      });
    }
    container.querySelectorAll('img').forEach(function(img) { enhanceImage(img, container); });
    unwrapFigureParagraphs(container);
    window.setTimeout(function() { groupPortraitImages(container); }, 100);
  }

  function enhanceAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(CONTENT_SELECTOR)) enhanceContainer(scope);
    scope.querySelectorAll(CONTENT_SELECTOR).forEach(enhanceContainer);
  }

  document.addEventListener('click', function(event) {
    if (!(event.target instanceof Element)) return;
    var button = event.target.closest('.moments-media-image-button');
    if (!button) return;
    var gallery = button.closest('.moments-media-gallery');
    if (!gallery) return;
    var buttons = Array.from(gallery.querySelectorAll('.moments-media-image-button'));
    var images = buttons.map(function(item) {
      var img = item.querySelector('.moments-media-image');
      return {
        src: item.dataset.originalSrc || img.currentSrc || img.src,
        alt: item.dataset.alt || img.alt || '图片'
      };
    });
    var index = buttons.indexOf(button);
    window.dispatchEvent(new CustomEvent('open-image-lightbox', {
      detail: Object.assign({}, images[index], { images: images, currentIndex: index })
    }));
  });

  window.addEventListener('open-image-lightbox', function(event) { openLightbox(event.detail); });
  document.addEventListener('pjax:success', function() {
    closeLightbox();
    enhanceAll(document);
  });
  document.addEventListener('moments:content-appended', function(event) {
    enhanceAll(event.detail && event.detail.root || document);
  });

  appendOverlay();
  enhanceAll(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { enhanceAll(document); }, { once: true });
  }

  window.BlogImageViewer = {
    close: closeLightbox,
    enhance: enhanceAll,
    open: openLightbox
  };
})();
