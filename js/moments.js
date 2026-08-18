(function() {
  'use strict';

  // Interaction model ported from astro-koharu's Moments components at
  // c48aa2c9f38af071d5fd24c3dce70ed9106f3e17 (AGPL-3.0).

  var INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, summary, video, audio, [role="button"], [contenteditable="true"]';
  var COLLAPSED_HEIGHT = 384;
  var COLLAPSED_FADE_HEIGHT = 88;
  var COLLAPSED_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), audio[controls], video[controls], [contenteditable="true"], [tabindex]';
  var LOAD_MARGIN = 320;
  var LOAD_TIMEOUT = 15000;
  var MIN_LOADING_TIME = 600;

  function installCardLinks(root) {
    root.querySelectorAll('.moments-message-card[data-message-href]:not([data-card-link-ready])').forEach(function(card) {
      card.dataset.cardLinkReady = 'true';
      card.addEventListener('click', function(event) {
        if (event.defaultPrevented || event.button !== 0) return;
        if (!(event.target instanceof Element) || event.target.closest(INTERACTIVE_SELECTOR)) return;
        var selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;
        var href = card.dataset.messageHref;
        if (!href) return;
        var url = new URL(href, window.location.href).href;
        if (event.metaKey || event.ctrlKey) window.open(url, '_blank', 'noopener');
        else window.location.assign(url);
      });
    });
  }

  function installCopyButtons(root) {
    root.querySelectorAll('.moments-copy-link:not([data-copy-ready])').forEach(function(button) {
      button.dataset.copyReady = 'true';
      button.addEventListener('click', async function() {
        var label = button.querySelector('[data-copy-text]');
        var status = button.querySelector('[data-copy-status]');
        var value = new URL(button.dataset.copyValue || window.location.href, window.location.href).href;
        var succeeded = false;
        try {
          await navigator.clipboard.writeText(value);
          succeeded = true;
        } catch (error) {
          window.prompt(button.dataset.copyFailedLabel || '复制链接', value);
        }
        var result = succeeded ? button.dataset.copiedLabel : button.dataset.copyFailedLabel;
        if (label) label.textContent = result || '';
        if (status) status.textContent = result || '';
        window.setTimeout(function() {
          if (label) label.textContent = button.dataset.copyLabel || '';
          if (status) status.textContent = '';
        }, 1800);
      });
    });
  }

  function installCollapsibleBodies(root) {
    root.querySelectorAll('.moments-message-body[data-collapsible-requested="true"]:not([data-collapse-ready])').forEach(function(body) {
      body.dataset.collapseReady = 'true';
      var content = body.querySelector('[data-message-content]');
      var button = body.querySelector('[data-message-toggle]');
      var label = button && button.querySelector('[data-message-toggle-label]');
      var collapsedStates = new Map();
      if (!content || !button || !label) return;

      function restoreCollapsedInteractions() {
        collapsedStates.forEach(function(state, element) {
          element.inert = state.inert;
          if (state.tabindex === null) element.removeAttribute('tabindex');
          else element.setAttribute('tabindex', state.tabindex);
        });
        collapsedStates.clear();
      }

      function syncCollapsedInteractions() {
        restoreCollapsedInteractions();
        if (body.dataset.expanded !== 'false') return;
        var visibleBottom = content.getBoundingClientRect().bottom - COLLAPSED_FADE_HEIGHT;
        content.querySelectorAll(COLLAPSED_FOCUSABLE_SELECTOR).forEach(function(element) {
          var rect = element.getBoundingClientRect();
          if (element.inert || rect.height === 0 || rect.bottom <= visibleBottom) return;
          collapsedStates.set(element, {
            inert: element.inert,
            tabindex: element.getAttribute('tabindex')
          });
          element.inert = true;
          element.setAttribute('tabindex', '-1');
        });
      }

      function update() {
        if (!body.isConnected) return;
        if (content.scrollHeight <= COLLAPSED_HEIGHT + 8) {
          delete body.dataset.collapsible;
          delete body.dataset.expanded;
          button.hidden = true;
          button.setAttribute('aria-expanded', 'true');
          restoreCollapsedInteractions();
          return;
        }
        if (body.dataset.collapsible !== 'true') {
          body.dataset.collapsible = 'true';
          body.dataset.expanded = 'false';
          button.hidden = false;
          button.setAttribute('aria-expanded', 'false');
          label.textContent = body.dataset.expandLabel || '展开';
        }
        syncCollapsedInteractions();
      }

      button.addEventListener('click', function() {
        var expanded = body.dataset.expanded === 'true';
        body.dataset.expanded = expanded ? 'false' : 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        label.textContent = expanded ? (body.dataset.expandLabel || '展开') : (body.dataset.collapseLabel || '收起');
        syncCollapsedInteractions();
      });

      requestAnimationFrame(update);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(update).catch(function() {});
      window.addEventListener('resize', update, { passive: true });
    });
  }

  function installMedia(root) {
    root.querySelectorAll('.moments-media-item:not([data-media-ready])').forEach(function(item) {
      item.dataset.mediaReady = 'true';
      item.querySelectorAll('img, video, audio').forEach(function(asset) {
        asset.addEventListener('error', function() {
          var visual = asset.closest('button, video, .moments-media-audio') || asset;
          visual.hidden = true;
          var fallback = item.querySelector('.moments-media-fallback');
          if (fallback) fallback.hidden = false;
        });
      });
    });

  }

  function setPaginationState(pagination, timeline, state, status, focusStatus) {
    pagination.dataset.state = state;
    var loading = state === 'loading';
    pagination.setAttribute('aria-busy', String(loading));
    timeline.setAttribute('aria-busy', String(loading));
    var link = pagination.querySelector('[data-next-link]');
    var linkLabel = pagination.querySelector('[data-next-label]');
    var statusElement = pagination.querySelector('[data-pagination-status]');
    var statusText = pagination.querySelector('[data-status-text]');
    var live = pagination.querySelector('[data-pagination-live]');
    if (linkLabel) linkLabel.textContent = state === 'error' ? (pagination.dataset.retryLabel || '重试') : (pagination.dataset.nextLabel || '加载更早记录');
    if (statusElement) statusElement.hidden = !status;
    if (statusText) statusText.textContent = status || '';
    if (live) live.textContent = status || '';
    if (link) {
      link.hidden = state === 'end';
      link.setAttribute('aria-disabled', String(loading));
    }
    if (state === 'end' && focusStatus && statusElement) statusElement.focus({ preventScroll: true });
  }

  function installPagination(root) {
    root.querySelectorAll('[data-moments-cursor-pagination]:not([data-pagination-ready])').forEach(function(pagination) {
      pagination.dataset.paginationReady = 'true';
      if (!('fetch' in window) || !('DOMParser' in window)) return;
      var timeline = pagination.previousElementSibling;
      var sentinel = pagination.querySelector('[data-pagination-sentinel]');
      var link = pagination.querySelector('[data-next-link]');
      if (!timeline || !timeline.matches('[data-moments-timeline]') || !sentinel || !link || !pagination.dataset.nextHref) return;

      var loading = false;
      var loaded = new Set();
      var observer;

      async function loadNext(focusStatus) {
        if (loading || !pagination.dataset.nextHref) return;
        var requestedUrl = new URL(pagination.dataset.nextHref, window.location.href);
        if (loaded.has(requestedUrl.href)) {
          setPaginationState(pagination, timeline, 'end', pagination.dataset.endLabel || '已经到底了', focusStatus);
          if (observer) observer.disconnect();
          return;
        }

        loading = true;
        var startedAt = Date.now();
        var controller = new AbortController();
        var timeout = window.setTimeout(function() { controller.abort(); }, LOAD_TIMEOUT);
        setPaginationState(pagination, timeline, 'loading', pagination.dataset.loadingLabel || '正在加载…');

        try {
          var response = await fetch(requestedUrl, {
            credentials: 'same-origin',
            headers: { Accept: 'text/html' },
            signal: controller.signal
          });
          if (!response.ok) throw new Error('Moments page request failed: ' + response.status);
          var html = await response.text();
          var page = new DOMParser().parseFromString(html, 'text/html');
          var nextTimeline = page.querySelector('[data-moments-timeline]');
          if (!nextTimeline || !nextTimeline.children.length) throw new Error('Moments response has no entries');
          var nextPagination = page.querySelector('[data-moments-cursor-pagination]');
          var candidate = nextPagination && nextPagination.dataset.nextHref;
          var nextUrl = candidate ? new URL(candidate, response.url || requestedUrl.href).href : '';
          var remaining = MIN_LOADING_TIME - (Date.now() - startedAt);
          if (remaining > 0) await new Promise(function(resolve) { window.setTimeout(resolve, remaining); });

          var items = Array.from(nextTimeline.children).map(function(item) {
            item.dataset.momentsEntering = 'true';
            return document.adoptNode(item);
          });
          timeline.append.apply(timeline, items);
          loaded.add(requestedUrl.href);
          installAll(timeline);
          document.dispatchEvent(new CustomEvent('moments:content-appended', { detail: { root: timeline } }));
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              items.forEach(function(item) { item.dataset.momentsEntering = 'settled'; });
              window.setTimeout(function() {
                items.forEach(function(item) { delete item.dataset.momentsEntering; });
              }, 260);
            });
          });

          if (!nextUrl || loaded.has(nextUrl)) {
            delete pagination.dataset.nextHref;
            setPaginationState(pagination, timeline, 'end', pagination.dataset.endLabel || '已经到底了', focusStatus);
            if (observer) observer.disconnect();
          } else {
            pagination.dataset.nextHref = nextUrl;
            link.href = nextUrl;
            setPaginationState(pagination, timeline, 'idle', pagination.dataset.loadedLabel || '已加载更多记录');
            window.setTimeout(function() {
              if (pagination.dataset.state === 'idle') setPaginationState(pagination, timeline, 'idle', '');
            }, 1600);
          }
        } catch (error) {
          if (error && error.name !== 'AbortError') {
            setPaginationState(pagination, timeline, 'error', pagination.dataset.errorLabel || '加载失败，请重试');
          }
        } finally {
          window.clearTimeout(timeout);
          loading = false;
        }
      }

      link.addEventListener('click', function(event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        loadNext(event.detail === 0);
      });

      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(function(entries) {
          if (entries[0] && entries[0].isIntersecting && pagination.dataset.state !== 'error') loadNext(false);
        }, { rootMargin: '0px 0px ' + LOAD_MARGIN + 'px', threshold: 0 });
        observer.observe(sentinel);
      }
      pagination.dataset.enhanced = 'true';
      setPaginationState(pagination, timeline, 'idle', '');
    });
  }

  function installAll(root) {
    installCardLinks(root);
    installCopyButtons(root);
    installCollapsibleBodies(root);
    installMedia(root);
    installPagination(root);
  }

  installAll(document);
  document.addEventListener('DOMContentLoaded', function() { installAll(document); }, { once: true });
  document.addEventListener('pjax:success', function() { installAll(document); });
})();
