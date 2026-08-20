(function() {
  'use strict';

  if (window.BlogLinkPreview) return;
  var enhanced = new WeakSet();

  function showImageFallback(image) {
    if (!image || enhanced.has(image) && image.classList.contains('error')) return;
    image.classList.add('error');
    var media = image.closest('.link-preview-media');
    var fallback = media && media.querySelector('.link-preview-image-error');
    if (fallback) fallback.hidden = false;
  }

  function enhanceImage(image) {
    if (enhanced.has(image)) return;
    enhanced.add(image);
    image.addEventListener('error', function() { showImageFallback(image); }, { once: true });
    if (image.complete && image.naturalWidth === 0) showImageFallback(image);
  }

  function enhance(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches('.link-preview-image')) enhanceImage(scope);
    scope.querySelectorAll('.link-preview-image').forEach(enhanceImage);
  }

  enhance(document);
  document.addEventListener('pjax:success', function() { enhance(document); });
  document.addEventListener('moments:content-appended', function(event) {
    enhance(event.detail && event.detail.root || document);
  });

  window.BlogLinkPreview = { enhance: enhance };
})();
