/**
 * ATELIER SARAH SCHU — LOGIQUE D'EXPOSITION DU SITE VITRINE
 * Rendu dynamique boutique atelier, catalogue d'art, lightbox in situ & brief projet
 */

(function () {
  'use strict';

  let siteData = null;
  let activeFilter = 'all';
  let currentLightboxProject = null;
  let currentLightboxImageIndex = 0;

  document.addEventListener('DOMContentLoaded', initApp);

  async function initApp() {
    await loadSiteData();
    initNavigation();
    renderSite();
    initPortfolioFilters();
    initLightboxListeners();
    initFaqAccordion();
    initQuoteForm();
    initHeaderScroll();

    // Écoute des mises à jour directes en provenance de l'espace administration (multi-onglets)
    window.addEventListener('storage', (e) => {
      if (e.key === 'sarah_site_data' && e.newValue) {
        try {
          siteData = JSON.parse(e.newValue);
          renderSite();
          showToast('Site mis à jour avec vos dernières modifications !', 'success');
        } catch (err) {
          console.error('Erreur mise à jour en direct', err);
        }
      }
    });
  }

  /**
   * Chargement des données : synchronise intelligemment entre localStorage et le serveur
   * en priorisant toujours la version la plus récente via l'horodatage lastUpdated.
   */
  async function loadSiteData() {
    let serverData = null;
    try {
      const response = await fetch('data/site-data.json?v=' + Date.now());
      if (response.ok) {
        serverData = await response.json();
      }
    } catch (e) {
      console.warn('Lecture serveur non disponible ou mode hors-ligne');
    }

    let localData = null;
    const localSaved = localStorage.getItem('sarah_site_data');
    if (localSaved) {
      try {
        localData = JSON.parse(localSaved);
      } catch (e) {
        console.error('Erreur lecture localStorage', e);
      }
    }

    // Arbitrage par horodatage (lastUpdated)
    if (localData && serverData) {
      const localTime = localData.lastUpdated ? new Date(localData.lastUpdated).getTime() : 0;
      const serverTime = serverData.lastUpdated ? new Date(serverData.lastUpdated).getTime() : 0;
      if (localTime >= serverTime) {
        siteData = localData;
      } else {
        siteData = serverData;
        localStorage.setItem('sarah_site_data', JSON.stringify(serverData));
      }
    } else if (localData) {
      siteData = localData;
    } else if (serverData) {
      siteData = serverData;
      localStorage.setItem('sarah_site_data', JSON.stringify(serverData));
    }

    if (!siteData) {
      console.error('Aucune donnée valide trouvée');
      showToast('Erreur lors du chargement des données de l\'Atelier.', 'error');
    }
  }

  /**
   * Rendu complet de toutes les sections
   */
  function renderSite() {
    if (!siteData) return;
    const a = siteData.artist;

    // Métadonnées & Marque
    document.title = `${a.brandName} — Atelier de Fresques & Aquarelle · Alsace`;
    updateElementText('.brand-name', a.brandName);
    updateElementText('.brand-sub', a.brandSubtitle || 'ATELIER DE FRESQUES & AQUARELLE · ALSACE');
    updateElementSrc('.brand-avatar', a.profilePhoto);

    // Hero Showcase
    if (a.heroEyebrow) updateElementText('#hero-eyebrow-text', a.heroEyebrow);
    if (a.quote) updateElementText('#hero-title', a.quote);
    if (a.heroBio) updateElementText('#hero-desc-text', a.heroBio);
    if (a.heroImage) {
      updateElementSrc('#hero-main-img', a.heroImage);
    }

    // Rendu des sections éditoriales
    renderStats();
    renderPortfolio();
    renderServices();
    renderAbout();
    renderProcessus();
    renderTestimonials();
    renderFaq();
    renderContactInfo();

    // Footer
    updateElementText('.footer-tagline', `« ${a.quote || "J'embellis vos murs, peints à la main, en Alsace."} »`);
  }

  function updateElementText(selector, text) {
    const el = document.querySelector(selector);
    if (el && text) el.textContent = text;
  }

  function updateElementSrc(selector, src) {
    const el = document.querySelector(selector);
    if (el && src) el.src = src;
  }

  /**
   * Ruban de confiance (Chiffres & Métriques clés)
   */
  function renderStats() {
    const container = document.getElementById('stats-grid-container');
    if (!container || !siteData.stats) return;

    container.innerHTML = siteData.stats.map(s => `
      <div class="trust-item">
        <div class="trust-num">${s.value}</div>
        <div class="trust-lbl">${s.label}</div>
      </div>
    `).join('');
  }

  let portfolioLimit = 6;
  const DEFAULT_PORTFOLIO_LIMIT = 6;

  /**
   * Catalogue des Œuvres (Portfolio avec Palette de Couleurs & Détails)
   */
  function renderPortfolio() {
    const container = document.getElementById('portfolio-grid-container');
    const loadMoreWrap = document.getElementById('portfolio-load-more-wrap');
    const loadMoreBtn = document.getElementById('portfolio-load-more-btn');
    const loadMoreText = document.getElementById('load-more-text');
    if (!container || !siteData.projects) return;

    const filtered = activeFilter === 'all' 
      ? siteData.projects 
      : siteData.projects.filter(p => p.category === activeFilter);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
          <i class="fa-solid fa-paintbrush" style="font-size: 2.5rem; color: var(--accent-terra); margin-bottom: 1rem; opacity: 0.7;"></i>
          <p style="font-family: var(--font-serif); font-size: 1.25rem; color: var(--text-muted);">Aucune création enregistrée dans cette catégorie pour le moment.</p>
        </div>
      `;
      if (loadMoreWrap) loadMoreWrap.style.display = 'none';
      return;
    }

    // Évite l'empilement infini sur mobile en affichant les premiers projets
    const isFilteredSpecific = activeFilter !== 'all';
    const itemsToDisplay = (isFilteredSpecific && filtered.length <= 6) ? filtered : filtered.slice(0, portfolioLimit);

    container.innerHTML = itemsToDisplay.map((p) => {
      const photosCount = (p.gallery && p.gallery.length > 1) ? p.gallery.length : 1;

      return `
        <article class="artwork-card" data-project-id="${p.id}">
          <div class="artwork-frame">
            <img src="${p.mainImage}" alt="${p.title}" loading="lazy">
            ${photosCount > 1 ? `
              <span class="artwork-photo-badge">
                <i class="fa-solid fa-images"></i> ${photosCount} photos
              </span>
            ` : ''}
            <div class="artwork-hover-overlay">
              <span class="artwork-view-btn">
                <i class="fa-solid fa-expand"></i> Voir l'œuvre
              </span>
            </div>
          </div>
          <div class="artwork-details">
            <div class="artwork-meta">
              <span>${p.categoryLabel || p.category}</span>
              <span class="artwork-meta-sep">&bull;</span>
              <span>${p.location || 'Alsace'}</span>
            </div>
            <h3 class="artwork-title">«&nbsp;${p.title}&nbsp;»</h3>
            <div class="artwork-technique-tag">${p.technique || 'Création peinte in situ'}</div>
          </div>
        </article>
      `;
    }).join('');

    // Bouton Afficher plus
    if (loadMoreWrap && loadMoreBtn) {
      const remaining = filtered.length - itemsToDisplay.length;
      if (remaining > 0) {
        loadMoreWrap.style.display = 'block';
        if (loadMoreText) {
          loadMoreText.textContent = `Afficher plus de créations (${remaining} restantes)`;
        }
        loadMoreBtn.onclick = () => {
          portfolioLimit += 6;
          renderPortfolio();
        };
      } else {
        loadMoreWrap.style.display = 'none';
      }
    }

    // Clic pour ouvrir la modale d'exposition
    container.querySelectorAll('.artwork-card').forEach(card => {
      card.addEventListener('click', () => {
        const projId = card.getAttribute('data-project-id');
        openLightbox(projId);
      });
    });
  }

  /**
   * Filtres synchronisés du catalogue (Hero tags + Pills catalogue)
   */
  function initPortfolioFilters() {
    const filterPills = document.querySelectorAll('.filter-pill');
    const heroTagPills = document.querySelectorAll('.hero-tag-pill');

    function applyFilter(category, shouldScroll = false) {
      activeFilter = category || 'all';
      portfolioLimit = DEFAULT_PORTFOLIO_LIMIT; // Réinitialise la limite pour un affichage propre

      filterPills.forEach(p => {
        p.classList.toggle('active', (p.getAttribute('data-filter') || 'all') === activeFilter);
      });

      heroTagPills.forEach(p => {
        p.classList.toggle('active', (p.getAttribute('data-filter') || 'all') === activeFilter);
      });

      renderPortfolio();

      if (shouldScroll) {
        const catSection = document.getElementById('catalogue');
        if (catSection) {
          catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const cat = pill.getAttribute('data-filter');
        applyFilter(cat, false);
      });
    });

    heroTagPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const cat = pill.getAttribute('data-filter');
        applyFilter(cat, true);
      });
    });
  }

  /**
   * Domaines d'intervention & Savoir-faire
   */
  function renderServices() {
    const container = document.getElementById('services-grid-container');
    if (!container || !siteData.services) return;

    container.innerHTML = siteData.services.map(s => `
      <div class="service-card">
        <span class="service-badge">${s.badge || 'Savoir-Faire'}</span>
        <h3 class="service-title">${s.title}</h3>
        <div class="service-subtitle">${s.subtitle || ''}</div>
        <p class="service-desc">${s.description}</p>
        <ul class="service-points">
          ${(s.points || []).map(pt => `
            <li class="service-point-item">
              <i class="fa-solid fa-check"></i>
              <span>${pt}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');
  }

  /**
   * Biographie & Formations académiques
   */
  function renderAbout() {
    const a = siteData.artist;
    updateElementText('#about-bio-text', a.bioFull);
    updateElementSrc('#about-photo', a.profilePhoto);

    // Formations
    const formContainer = document.getElementById('formations-container');
    if (formContainer && siteData.formations) {
      formContainer.innerHTML = siteData.formations.map(f => `
        <div class="academic-card">
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.3rem;">
            <span class="academic-school">${f.school}</span>
            <span style="font-size: 0.8rem; color: var(--text-faint); font-weight: 600;">${f.years} &bull; ${f.city}</span>
          </div>
          <div class="academic-diploma">${f.diploma}</div>
          <p class="academic-desc">${f.description || ''}</p>
        </div>
      `).join('');
    }
  }

  /**
   * Les 4 étapes de la démarche in situ
   */
  function renderProcessus() {
    const container = document.getElementById('process-grid-container');
    if (!container || !siteData.processus) return;

    container.innerHTML = siteData.processus.map(p => `
      <div class="step-card">
        <div class="step-num">${p.step}</div>
        <h3 class="step-title">${p.title}</h3>
        <p class="step-desc">${p.description}</p>
      </div>
    `).join('');
  }

  /**
   * Témoignages & Retours d'expérience (Slider fluide sur une seule ligne)
   */
  function renderTestimonials() {
    const track = document.getElementById('testimonials-grid-container');
    const dotsContainer = document.getElementById('testimonials-dots-container');
    const prevBtn = document.getElementById('testimonials-prev-btn');
    const nextBtn = document.getElementById('testimonials-next-btn');
    const viewport = document.getElementById('testimonials-viewport') || track.parentElement;
    if (!track || !siteData.temoignages || siteData.temoignages.length === 0) return;

    const items = siteData.temoignages;
    const N = items.length;

    // Clones pour circuit fermé infini (2 avant, 2 après) permettant un centrage continu
    const clonedItems = [
      { ...items[N - 2], _realIdx: N - 2 },
      { ...items[N - 1], _realIdx: N - 1 },
      ...items.map((it, idx) => ({ ...it, _realIdx: idx })),
      { ...items[0], _realIdx: 0 },
      { ...items[1], _realIdx: 1 }
    ];

    track.innerHTML = clonedItems.map((t, idx) => `
      <div class="testimonial-card ${idx === 2 ? 'active' : ''}" data-index="${idx}" data-real-idx="${t._realIdx}">
        <div class="testimonial-quote">« ${t.quote} »</div>
        <div>
          <div class="testimonial-author">${t.author}</div>
          <div class="testimonial-context">${t.role} &bull; ${t.location}</div>
        </div>
      </div>
    `).join('');

    // Pagination à points (pour les N vrais avis)
    if (dotsContainer) {
      dotsContainer.innerHTML = items.map((_, idx) => `
        <button type="button" class="testimonials-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="Avis ${idx + 1}"></button>
      `).join('');
    }

    let currentIndex = 2; // Démarre sur le premier avis réel (index 2)
    let isAnimating = false;

    function getCards() {
      return track.querySelectorAll('.testimonial-card');
    }

    function updateActiveStates() {
      const realIdx = ((currentIndex - 2) % N + N) % N;
      const cards = getCards();
      cards.forEach((c, i) => {
        c.classList.toggle('active', i === currentIndex);
      });
      if (dotsContainer) {
        dotsContainer.querySelectorAll('.testimonials-dot').forEach((d, i) => {
          d.classList.toggle('active', i === realIdx);
        });
      }
    }

    function setPosition(index, animate = true) {
      const cards = getCards();
      if (!viewport || !cards[index]) return;
      const card = cards[index];
      const viewportWidth = viewport.offsetWidth;
      const cardWidth = card.offsetWidth;
      const cardLeft = card.offsetLeft;

      // Centrage mathématique parfait de la carte active dans le viewport
      const offset = (viewportWidth - cardWidth) / 2 - cardLeft;

      if (animate) {
        track.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
      } else {
        track.style.transition = 'none';
      }

      track.style.transform = `translate3d(${offset}px, 0, 0)`;
      updateActiveStates();
    }

    function goToSlide(index, animate = true) {
      if (isAnimating && animate) return;
      if (animate) isAnimating = true;
      currentIndex = index;
      setPosition(currentIndex, animate);
    }

    // Boucle infinie en circuit fermé : saut imperceptible aux extrémités
    track.addEventListener('transitionend', () => {
      isAnimating = false;
      if (currentIndex >= N + 2) {
        currentIndex = 2;
        setPosition(currentIndex, false);
      } else if (currentIndex <= 1) {
        currentIndex = N + 1;
        setPosition(currentIndex, false);
      }
    });

    function nextSlide() {
      goToSlide(currentIndex + 1, true);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1, true);
    }

    if (prevBtn) prevBtn.onclick = () => prevSlide();
    if (nextBtn) nextBtn.onclick = () => nextSlide();

    if (dotsContainer) {
      dotsContainer.querySelectorAll('.testimonials-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const targetRealIdx = parseInt(dot.getAttribute('data-idx'), 10);
          goToSlide(targetRealIdx + 2, true);
        });
      });
    }

    // Gestion du glissement tactile (Swipe mobile fluide)
    let touchStartX = 0;
    let touchStartY = 0;
    let startTranslateX = 0;
    let isDragging = false;

    function getTrackOffset() {
      const transform = window.getComputedStyle(track).transform;
      if (transform && transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        return matrix.m41;
      }
      return 0;
    }

    viewport.addEventListener('touchstart', (e) => {
      if (isAnimating) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      startTranslateX = getTrackOffset();
      isDragging = true;
      track.style.transition = 'none';
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartX;
      const diffY = currentY - touchStartY;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        track.style.transform = `translate3d(${startTranslateX + diffX}px, 0, 0)`;
      }
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const diffX = e.changedTouches[0].clientX - touchStartX;
      if (diffX < -40) {
        nextSlide();
      } else if (diffX > 40) {
        prevSlide();
      } else {
        goToSlide(currentIndex, true);
      }
    }, { passive: true });

    // Initialisation du centrage au chargement et au redimensionnement
    setTimeout(() => {
      setPosition(currentIndex, false);
    }, 60);

    window.addEventListener('resize', () => {
      setPosition(currentIndex, false);
    });
  }

  /**
   * FAQ Accordéon
   */
  function renderFaq() {
    const container = document.getElementById('faq-list-container');
    if (!container || !siteData.faq) return;

    container.innerHTML = siteData.faq.map((item, idx) => `
      <div class="faq-row ${idx === 0 ? 'active' : ''}">
        <button class="faq-trigger" type="button" aria-expanded="${idx === 0}">
          <span>${item.question}</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="faq-content">
          <p>${item.answer}</p>
        </div>
      </div>
    `).join('');

    initFaqAccordion();
  }

  function initFaqAccordion() {
    const rows = document.querySelectorAll('.faq-row');
    rows.forEach(row => {
      const trigger = row.querySelector('.faq-trigger');
      if (trigger && !trigger._hasFaqListener) {
        trigger._hasFaqListener = true;
        trigger.addEventListener('click', () => {
          const isActive = row.classList.contains('active');
          rows.forEach(r => {
            r.classList.remove('active');
            r.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
          });
          if (!isActive) {
            row.classList.add('active');
            trigger.setAttribute('aria-expanded', 'true');
          }
        });
      }
    });
  }

  /**
   * Coordonnées & Liens
   */
  function renderContactInfo() {
    if (!siteData || !siteData.artist) return;
    const a = siteData.artist;
    const cleanPhone = (a.phoneClean || a.phone || '').replace(/\s+/g, '');

    // Téléphone : synchronisation de tous les liens et textes
    const phoneLinks = document.querySelectorAll('a[href^="tel:"], .contact-phone-link, #contact-phone-link, #mobile-nav-phone');
    phoneLinks.forEach(link => {
      link.href = `tel:${cleanPhone}`;
    });
    const phoneTexts = document.querySelectorAll('#contact-phone-text, .contact-phone-text, #mobile-nav-phone-text');
    phoneTexts.forEach(el => {
      el.textContent = a.phone;
    });

    // Email : synchronisation de tous les liens et textes
    const emailLinks = document.querySelectorAll('a[href^="mailto:"], .contact-email-link, #contact-email-link, #footer-email-link');
    emailLinks.forEach(link => {
      link.href = `mailto:${a.email}`;
    });
    const emailTexts = document.querySelectorAll('#contact-email-text, .contact-email-text');
    emailTexts.forEach(el => {
      el.textContent = a.email;
    });

    // Localisation
    const locEls = document.querySelectorAll('#contact-location-text, .contact-location-text');
    locEls.forEach(el => {
      el.textContent = a.location;
    });

    // Instagram
    const igLinks = document.querySelectorAll('.link-instagram, .nav-link-ig, a[href*="instagram.com"]');
    igLinks.forEach(link => {
      if (a.instagram) link.href = a.instagram;
    });
    const igHandles = document.querySelectorAll('.contact-ig-handle, #contact-ig-text, #header-ig-text, #mobile-ig-text');
    igHandles.forEach(el => {
      if (a.instagramHandle) {
        el.textContent = a.instagramHandle;
      } else if (a.instagram) {
        const parts = a.instagram.replace(/\/+$/, '').split('/');
        el.textContent = '@' + parts[parts.length - 1];
      }
    });

    // Facebook
    const fbLinks = document.querySelectorAll('.link-facebook, a[href*="facebook.com"]');
    fbLinks.forEach(link => {
      if (a.facebook) link.href = a.facebook;
    });
  }

  /* ==========================================================================
     VERROUILLAGE DU DÉFILEMENT (ARRIÈRE-PLAN FIGÉ POUR POPUP & MENU MOBILE)
     ========================================================================== */
  let scrollLockCount = 0;
  let preservedScrollY = 0;

  function lockScroll() {
    if (scrollLockCount === 0) {
      preservedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      document.documentElement.style.setProperty('--scroll-y', `-${preservedScrollY}px`);

      // Évite le décalage horizontal de layout sur les écrans avec barre de défilement visible
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        const fixedHeader = document.querySelector('.site-header');
        if (fixedHeader) fixedHeader.style.paddingRight = `${scrollbarWidth}px`;
      }

      document.documentElement.classList.add('scroll-locked');
      document.body.classList.add('scroll-locked');
    }
    scrollLockCount++;
  }

  function unlockScroll(force = false) {
    if (force) {
      scrollLockCount = 0;
    } else {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
    }

    if (scrollLockCount === 0) {
      document.documentElement.classList.remove('scroll-locked');
      document.body.classList.remove('scroll-locked');
      document.body.style.paddingRight = '';
      const fixedHeader = document.querySelector('.site-header');
      if (fixedHeader) fixedHeader.style.paddingRight = '';

      window.scrollTo(0, preservedScrollY);
    }
  }

  // Interdiction stricte des défilements tactiles accidentels en arrière-plan
  document.addEventListener('touchmove', (e) => {
    if (document.body.classList.contains('scroll-locked')) {
      if (e.target.closest('.theater-thumbs-strip')) {
        return;
      }
      e.preventDefault();
    }
  }, { passive: false });

  /**
   * Modale d'Exposition (Lightbox Haute Définition)
   */
  function openLightbox(projectId) {
    const project = siteData.projects.find(p => p.id === projectId);
    if (!project) return;

    currentLightboxProject = project;
    currentLightboxImageIndex = 0;

    const modal = document.getElementById('lightbox-modal');
    updateLightboxContent();
    if (modal) modal.classList.add('active');
    lockScroll();
  }

  function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.classList.remove('active');
    unlockScroll();
    currentLightboxProject = null;
  }

  function updateLightboxContent() {
    if (!currentLightboxProject) return;
    const p = currentLightboxProject;
    const gallery = (p.gallery && p.gallery.length > 0) ? p.gallery : [p.mainImage];

    // Image active
    const activeImgSrc = gallery[currentLightboxImageIndex] || p.mainImage;
    const mainImgEl = document.getElementById('lightbox-img');
    if (mainImgEl) {
      mainImgEl.src = activeImgSrc;
      mainImgEl.alt = `${p.title} - vue ${currentLightboxImageIndex + 1}`;
    }

    // Halo d'ambiance harmonisé
    const ambientEl = document.getElementById('lightbox-ambient-backdrop');
    if (ambientEl && activeImgSrc) {
      ambientEl.style.backgroundImage = `url("${activeImgSrc}")`;
    }

    // Badge compteur sur la photo
    const counterBadge = document.getElementById('lightbox-counter-badge');
    if (counterBadge) {
      if (gallery.length > 1) {
        counterBadge.style.display = 'block';
        counterBadge.textContent = `${currentLightboxImageIndex + 1} / ${gallery.length}`;
      } else {
        counterBadge.style.display = 'none';
      }
    }

    // Flèches
    const prevBtn = document.getElementById('lightbox-prev-btn');
    const nextBtn = document.getElementById('lightbox-next-btn');
    if (prevBtn && nextBtn) {
      const showArrows = gallery.length > 1;
      prevBtn.style.display = showArrows ? 'flex' : 'none';
      nextBtn.style.display = showArrows ? 'flex' : 'none';
    }

    // Métadonnées
    updateElementText('#lightbox-category', (p.categoryLabel || p.category || 'FRESQUE').toUpperCase());
    updateElementText('#lightbox-title', p.title);
    updateElementText('#lightbox-location', p.location || 'Alsace');
    updateElementText('#lightbox-year', p.year || '2026');
    updateElementText('#lightbox-technique', p.technique || 'Peinture acrylique in situ');
    updateElementText('#lightbox-desc', p.description);

    // Vignettes miniatures
    const carouselContainer = document.getElementById('lightbox-carousel');
    if (carouselContainer) {
      if (gallery.length > 1) {
        carouselContainer.style.display = 'flex';
        carouselContainer.innerHTML = gallery.map((src, idx) => `
          <img src="${src}" alt="Vue ${idx + 1}" class="theater-thumb ${idx === currentLightboxImageIndex ? 'active' : ''}" data-idx="${idx}">
        `).join('');

        carouselContainer.querySelectorAll('.theater-thumb').forEach(thumb => {
          thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            currentLightboxImageIndex = parseInt(thumb.getAttribute('data-idx'), 10);
            updateLightboxContent();
          });
        });

        // Défilement doux vers la vignette sélectionnée
        const activeThumb = carouselContainer.querySelector('.theater-thumb.active');
        if (activeThumb) {
          activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      } else {
        carouselContainer.style.display = 'none';
      }
    }
  }

  function initLightboxListeners() {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('lightbox-close-btn');
    const prevBtn = document.getElementById('lightbox-prev-btn');
    const nextBtn = document.getElementById('lightbox-next-btn');
    const viewerArea = document.getElementById('lightbox-viewer-area');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLightbox();
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentLightboxProject) return;
        const gallery = currentLightboxProject.gallery || [currentLightboxProject.mainImage];
        currentLightboxImageIndex = (currentLightboxImageIndex - 1 + gallery.length) % gallery.length;
        updateLightboxContent();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentLightboxProject) return;
        const gallery = currentLightboxProject.gallery || [currentLightboxProject.mainImage];
        currentLightboxImageIndex = (currentLightboxImageIndex + 1) % gallery.length;
        updateLightboxContent();
      });
    }

    // Support du glissement tactile (swipe) sur mobile / tablette
    if (viewerArea) {
      let touchStartX = 0;
      let touchEndX = 0;
      viewerArea.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      viewerArea.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 45) {
          if (diff > 0 && nextBtn && nextBtn.style.display !== 'none') {
            nextBtn.click();
          } else if (diff < 0 && prevBtn && prevBtn.style.display !== 'none') {
            prevBtn.click();
          }
        }
      }, { passive: true });
    }

    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft' && prevBtn && prevBtn.style.display !== 'none') prevBtn.click();
      if (e.key === 'ArrowRight' && nextBtn && nextBtn.style.display !== 'none') nextBtn.click();
    });

    const ctaLink = document.getElementById('lightbox-cta-link');
    if (ctaLink) {
      ctaLink.addEventListener('click', (e) => {
        e.preventDefault();
        closeLightbox();
        const contactSection = document.getElementById('contact');
        if (contactSection) {
          setTimeout(() => {
            contactSection.scrollIntoView({ behavior: 'smooth' });
          }, 10);
        }
      });
    }
  }

  /**
   * Formulaire de Devis & Brief Projet
   */
  function initQuoteForm() {
    const form = document.getElementById('devis-form');
    const fileInput = document.getElementById('devis-photo-mur');
    const uploadZone = document.getElementById('upload-zone-mur');
    const uploadLabel = document.getElementById('upload-zone-label');
    const submitBtn = form?.querySelector('button[type="submit"]');

    if (uploadZone && fileInput) {
      uploadZone.addEventListener('click', () => fileInput.click());
      
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          uploadLabel.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--accent-terra); margin-bottom: 0.3rem; display: block; font-size: 1.2rem;"></i> Photo jointe : <strong>${file.name}</strong>`;
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('devis-nom').value.trim();
        const email = document.getElementById('devis-email').value.trim();
        const tel = document.getElementById('devis-tel').value.trim();
        const typeProjet = document.getElementById('devis-type').value;
        const dimensions = document.getElementById('devis-dimensions').value.trim();
        const message = document.getElementById('devis-message').value.trim();

        if (!nom || !email || !message) {
          showToast('Veuillez renseigner votre nom, e-mail et description de projet.', 'warning');
          return;
        }

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Envoyer ma demande';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Envoi en cours...';
        }

        // 1. Envoi direct via API serveur ou service externe (Formspree / Web3Forms)
        const customAction = form.getAttribute('action');
        let sent = false;

        if (customAction && customAction.startsWith('http')) {
          try {
            const formData = new FormData(form);
            const resp = await fetch(customAction, {
              method: 'POST',
              body: formData,
              headers: { 'Accept': 'application/json' }
            });
            if (resp.ok) sent = true;
          } catch (err) {
            console.warn('Erreur envoi service externe', err);
          }
        } else {
          try {
            const resp = await fetch('/api/contact', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nom, email, tel, typeProjet, dimensions, message })
            });
            if (resp.ok) {
              const resData = await resp.json();
              if (resData.success) sent = true;
            }
          } catch (err) {
            // Pas de serveur local/Node disponible
          }
        }

        if (sent) {
          showToast('Votre demande a été transmise avec succès à Sarah Schu !', 'success');
          form.reset();
          if (uploadLabel) {
            uploadLabel.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="color: var(--accent-terra); font-size: 1.4rem; display: block; margin-bottom: 0.4rem;"></i><span>Cliquez pour joindre une photo de votre mur</span>`;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Demande transmise !';
            setTimeout(() => { submitBtn.innerHTML = originalBtnText; }, 3000);
          }
          return;
        }

        // 2. Repli fluide sur la messagerie (mailto) si aucun serveur n'est configuré
        const subject = encodeURIComponent(`Projet Fresque / Décor — ${typeProjet} (${nom})`);
        const body = encodeURIComponent(
          `Bonjour Sarah,\n\n` +
          `Nom : ${nom}\n` +
          `E-mail : ${email}\n` +
          `Téléphone : ${tel || 'Non renseigné'}\n` +
          `Typologie : ${typeProjet}\n` +
          `Dimensions / Commune : ${dimensions || 'À préciser'}\n\n` +
          `Description du projet :\n${message}\n\n` +
          `--\nEnvoyé depuis le site vitrine Atelier Sarah Schu`
        );

        const mailtoUrl = `mailto:${siteData?.artist?.email || 'sarah.schu16@gmail.com'}?subject=${subject}&body=${body}`;
        
        showToast('Demande préparée ! Ouverture de votre messagerie...', 'info');
        
        setTimeout(() => {
          window.location.href = mailtoUrl;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }, 900);

        form.reset();
        if (uploadLabel) {
          uploadLabel.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="color: var(--accent-terra); font-size: 1.4rem; display: block; margin-bottom: 0.4rem;"></i><span>Cliquez pour joindre une photo de votre mur</span>`;
        }
      });
    }
  }

  /**
   * Navigation Mobile & Défilement
   */
  function initNavigation() {
    const toggle = document.querySelector('.mobile-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    const backdrop = document.querySelector('.mobile-nav-backdrop');
    const closeBtn = document.querySelector('.mobile-nav-close');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    const openMobileNav = () => {
      mobileNav.classList.add('active');
      backdrop.classList.add('active');
      lockScroll();
    };

    const closeMobileNav = () => {
      if (mobileNav.classList.contains('active')) {
        mobileNav.classList.remove('active');
        backdrop.classList.remove('active');
        unlockScroll();
      }
    };

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (mobileNav.classList.contains('active')) {
          closeMobileNav();
        } else {
          openMobileNav();
        }
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeMobileNav);
    if (backdrop) backdrop.addEventListener('click', closeMobileNav);

    mobileLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetHref = link.getAttribute('href');
        closeMobileNav();
        if (targetHref && targetHref.startsWith('#') && targetHref.length > 1) {
          const targetEl = document.querySelector(targetHref);
          if (targetEl) {
            e.preventDefault();
            setTimeout(() => {
              targetEl.scrollIntoView({ behavior: 'smooth' });
            }, 10);
          }
        }
      });
    });
  }

  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? '#223F33' : type === 'warning' ? '#AF5239' : '#1C1917';
    toast.style.cssText = `
      background: ${bg};
      color: #ffffff;
      padding: 0.85rem 1.6rem;
      border-radius: 9999px;
      font-family: var(--font-sans);
      font-size: 0.88rem;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      pointer-events: auto;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(10px);
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  window.SarahSchuApp = {
    reload: renderSite,
    openLightbox: openLightbox
  };

})();
