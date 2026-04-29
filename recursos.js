(function () {
  'use strict';

  var videoCategories = [
    { id: 'destacados', label: 'Destacados', icon: 'fa-regular fa-star' },
    { id: 'abordaje', label: 'Abordaje', icon: 'fa-regular fa-rectangle-list' },
    { id: 'podcast', label: 'Podcast', icon: 'fa-solid fa-microphone' },
    { id: 'invitaciones', label: 'Invitaciones', icon: 'fa-regular fa-envelope' },
    { id: 'familias', label: 'Familias', icon: 'fa-solid fa-users' },
    { id: 'estrategias', label: 'Estrategias', icon: 'fa-regular fa-lightbulb' }
  ];

  var state = {
    audience: 'personas',
    category: 'destacados'
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[char];
    });
  }

  function getYouTubeId(video) {
    if (!video) return '';
    if (video.youtubeId) return video.youtubeId;
    var url = video.youtubeUrl || '';
    if (!url || url === 'PENDIENTE') return '';

    var patterns = [
      /[?&]v=([^&]+)/,
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/embed\/([^?&]+)/,
      /youtube\.com\/shorts\/([^?&]+)/
    ];

    for (var i = 0; i < patterns.length; i += 1) {
      var match = url.match(patterns[i]);
      if (match && match[1]) return match[1];
    }

    return '';
  }

  function getEmbedUrl(video) {
    var id = getYouTubeId(video);
    return id ? 'https://www.youtube.com/embed/' + id + '?rel=0' : '';
  }

  function getWatchUrl(video) {
    var id = getYouTubeId(video);
    return id ? 'https://www.youtube.com/watch?v=' + id : '#';
  }

  function getThumbUrl(video) {
    var id = getYouTubeId(video);
    return id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : 'images/testimonio-video.jpg';
  }

  function matchesAudience(video) {
    if (state.category === 'familias') {
      return video.audience === 'familiares';
    }
    return video.audience === state.audience || video.audience === 'todos';
  }

  function matchesCategory(video) {
    return Array.isArray(video.categories) && video.categories.indexOf(state.category) !== -1;
  }

  function getFilteredVideos() {
    var videos = window.RECURSOS_VIDEOS || [];
    return videos.filter(function (video) {
      return matchesAudience(video) && matchesCategory(video);
    });
  }

  function chooseMainVideo(videos) {
    return videos.find(function (video) {
      return video.use === 'principal' && getYouTubeId(video);
    }) || videos.find(function (video) {
      return getYouTubeId(video);
    }) || videos[0];
  }

  function renderVideoCategories() {
    var container = document.querySelector('[data-video-categories]');
    if (!container) return;

    container.innerHTML = videoCategories.map(function (category) {
      var active = category.id === state.category ? ' is-active' : '';
      return '<button class="resources-filter' + active + '" type="button" data-video-category="' + category.id + '">' +
        '<i class="' + category.icon + '" aria-hidden="true"></i>' +
        '<span>' + escapeHtml(category.label) + '</span>' +
      '</button>';
    }).join('');
  }

  function renderMainVideo(video) {
    var container = document.querySelector('[data-video-main]');
    if (!container) return;

    if (!video || !getEmbedUrl(video)) {
      container.innerHTML = '<div class="resources-video-main__placeholder">Video pendiente de publicación.</div>';
      return;
    }

    container.innerHTML =
      '<iframe src="' + getEmbedUrl(video) + '" title="' + escapeHtml(video.title) + '" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
  }

  function renderRelatedVideos(videos, mainVideo) {
    var container = document.querySelector('[data-video-related]');
    if (!container) return;

    var related = videos.filter(function (video) {
      return !mainVideo || video.id !== mainVideo.id;
    });

    if (!related.length && mainVideo) {
      related = [mainVideo];
    }

    if (!related.length) {
      container.innerHTML = '<p class="resources-empty">Pronto agregaremos más videos en esta categoría.</p>';
      return;
    }

    container.innerHTML = related.map(function (video) {
      var hasVideo = Boolean(getYouTubeId(video));
      var tag = hasVideo ? 'a' : 'div';
      var href = hasVideo ? ' href="' + getWatchUrl(video) + '" target="_blank" rel="noopener"' : '';
      var duration = video.duration || (hasVideo ? 'YouTube' : 'Pronto');

      return '<' + tag + href + ' class="resources-video-card">' +
        '<span class="resources-video-card__thumb">' +
          '<img src="' + getThumbUrl(video) + '" alt="Miniatura de ' + escapeHtml(video.title) + '" />' +
          '<span class="resources-video-card__time">' + escapeHtml(duration) + '</span>' +
        '</span>' +
        '<strong>' + escapeHtml(video.title) + '</strong>' +
      '</' + tag + '>';
    }).join('');
  }

  function renderVideos() {
    var videos = getFilteredVideos();
    var mainVideo = chooseMainVideo(videos);
    renderVideoCategories();
    renderMainVideo(mainVideo);
    renderRelatedVideos(videos, mainVideo);
  }

  function renderGuides() {
    var container = document.querySelector('[data-guides-list]');
    if (!container) return;

    container.innerHTML = (window.RECURSOS_GUIAS || []).map(function (guide) {
      return '<article class="resources-guide-card">' +
        '<i class="' + escapeHtml(guide.icon) + '" aria-hidden="true"></i>' +
        '<div class="resources-guide-card__body">' +
          '<h3>' + escapeHtml(guide.title) + '</h3>' +
          '<p>' + escapeHtml(guide.description) + '</p>' +
        '</div>' +
        '<a href="' + escapeHtml(guide.downloadUrl) + '" target="_blank" rel="noopener" class="resources-guide-card__btn">Descargar</a>' +
      '</article>';
    }).join('');
  }

  function getFeaturedArticles() {
    return (window.RECURSOS_ARTICULOS || []).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    }).filter(function (article) {
      return article.featured;
    }).slice(0, 3);
  }

  function articleCard(article) {
    var image = resolveAssetPath(article.image);
    return '<article class="resources-article-card">' +
      '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(article.title) + '" />' +
      '<div class="resources-article-card__body">' +
        '<h3>' + escapeHtml(article.title) + '</h3>' +
        '<p>' + escapeHtml(article.description) + '</p>' +
        '<a href="' + escapeHtml(article.url) + '" aria-label="Leer más sobre ' + escapeHtml(article.title) + '">Leer más <span aria-hidden="true">-></span></a>' +
      '</div>' +
      '<span class="resources-article-card__arrow" aria-hidden="true">›</span>' +
    '</article>';
  }

  function resolveAssetPath(path) {
    if (!path || /^(https?:)?\/\//.test(path) || path.charAt(0) === '/') {
      return path;
    }

    if (window.location.pathname.indexOf('/recursos-didacticos/articulos/') !== -1) {
      return '../../' + path;
    }

    return path;
  }

  function renderFeaturedArticles() {
    var container = document.querySelector('[data-featured-articles]');
    if (!container) return;
    container.innerHTML = getFeaturedArticles().map(articleCard).join('');
  }

  function renderAllArticles() {
    var container = document.querySelector('[data-all-articles]');
    if (!container) return;
    var articles = (window.RECURSOS_ARTICULOS || []).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    container.innerHTML = articles.map(articleCard).join('');
  }

  function bindAudienceButtons() {
    document.querySelectorAll('[data-audience]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.audience = button.getAttribute('data-audience') || 'personas';
        document.querySelectorAll('[data-audience]').forEach(function (item) {
          var active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-selected', String(active));
        });
        renderVideos();
      });
    });
  }

  function bindCategoryButtons() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-video-category]');
      if (!button) return;
      state.category = button.getAttribute('data-video-category') || 'destacados';
      renderVideos();
    });
  }

  function init() {
    bindAudienceButtons();
    bindCategoryButtons();
    renderVideos();
    renderGuides();
    renderFeaturedArticles();
    renderAllArticles();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
