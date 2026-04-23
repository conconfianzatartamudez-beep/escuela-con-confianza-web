/* ============================================================
   ESCUELA CON CONFIANZA – script.js
   Funcionalidad: menú móvil, header scroll
   Vanilla JS — sin dependencias
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. MENÚ MÓVIL
  ---------------------------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const mainNav   = document.getElementById('main-nav');

  if (hamburger && mainNav) {

    hamburger.addEventListener('click', function () {
      const isOpen = mainNav.classList.toggle('is-open');
      hamburger.classList.toggle('is-open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');

      // Bloquear scroll del body cuando el menú está abierto
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Cerrar al hacer clic en un enlace del menú
    mainNav.querySelectorAll('.header__nav-link, .header__nav-cta').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Abrir menú');
        document.body.style.overflow = '';
      });
    });

    // Cerrar al presionar Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mainNav.classList.contains('is-open')) {
        mainNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Abrir menú');
        document.body.style.overflow = '';
        hamburger.focus();
      }
    });

    // Cerrar si se hace clic fuera del menú en móvil
    document.addEventListener('click', function (e) {
      if (
        mainNav.classList.contains('is-open') &&
        !mainNav.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        mainNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Abrir menú');
        document.body.style.overflow = '';
      }
    });
  }


  /* ----------------------------------------------------------
     2. HEADER: SOMBRA AL HACER SCROLL
  ---------------------------------------------------------- */
  var header = document.getElementById('header');

  if (header) {
    var lastScroll = 0;

    window.addEventListener('scroll', function () {
      var currentScroll = window.scrollY;

      if (currentScroll > 20) {
        header.style.boxShadow = '0 2px 16px rgba(0,0,0,0.07)';
      } else {
        header.style.boxShadow = 'none';
      }

      lastScroll = currentScroll;
    }, { passive: true });
  }


  /* ----------------------------------------------------------
     3. ANIMACIÓN DE ENTRADA SUTIL (Intersection Observer)
     Solo para elementos que lo soporten — no afecta a JS
     deshabilitado o movimiento reducido.
  ---------------------------------------------------------- */
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {

    var fadeTargets = document.querySelectorAll(
      '.service-card, .value-card, .metrics__item, .profile__inner, .about-preview__inner, .guides__inner'
    );

    var observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    };

    var fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity    = '1';
          entry.target.style.transform  = 'translateY(0)';
          fadeObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    fadeTargets.forEach(function (el) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(18px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      fadeObserver.observe(el);
    });

  }

})();
