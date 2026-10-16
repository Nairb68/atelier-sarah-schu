/**
 * ATELIER SARAH SCHU — ÉDITEUR VISUEL EN VUE RÉELLE (IN SITU)
 * Modification directe sur la page réelle sans formulaires abstraits
 */

(function () {
  'use strict';

  let siteData = null;
  let isDirty = false;
  let activeDrawerProjectId = null;
  let drawerGallery = [];

  document.addEventListener('DOMContentLoaded', initVisualAdmin);

  async function initVisualAdmin() {
    await loadSiteData();
    checkAuth();
    initVisualEditorUI();
  }

  /**
   * Chargement des données (arbitrage intelligent par horodatage)
   */
  async function loadSiteData() {
    let serverData = null;
    try {
      const resp = await fetch('data/site-data.json?v=' + Date.now());
      if (resp.ok) {
        serverData = await resp.json();
      }
    } catch (e) {
      console.warn('Lecture serveur non disponible');
    }

    let localData = null;
    const local = localStorage.getItem('sarah_site_data');
    if (local) {
      try {
        localData = JSON.parse(local);
      } catch (e) {
        console.error('Erreur lecture localStorage', e);
      }
    }

    const localTime = localData?.lastUpdated ? new Date(localData.lastUpdated).getTime() : 0;
    const serverTime = serverData?.lastUpdated ? new Date(serverData.lastUpdated).getTime() : 0;
    const localProjectsCount = localData?.projects?.length || 0;
    const serverProjectsCount = serverData?.projects?.length || 0;

    let hasRescuedLocal = false;

    // Arbitrage intelligent : si le stockage local est plus riche en créations ou plus récent, on le priorise absolument
    if (localData && (!serverData || localProjectsCount > serverProjectsCount || localTime >= serverTime)) {
      siteData = localData;
      hasRescuedLocal = true;
      // Secours immédiat : transmission automatique au serveur
      try {
        fetch('/api/rescue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localData)
        }).then(r => r.json()).then(res => {
          if (res.success) {
            console.log('✅ Données locales synchronisées sur le serveur avec succès');
          }
        }).catch(err => console.warn('Échec envoi rescue:', err));
      } catch (e) {}
    } else if (serverData) {
      siteData = serverData;
      localStorage.setItem('sarah_site_data', JSON.stringify(serverData));
    } else if (localData) {
      siteData = localData;
    }

    if (!siteData) {
      alert('Impossible de charger les données du site.');
    } else {
      ensureCategoriesInitialized();
      if (hasRescuedLocal && localProjectsCount > serverProjectsCount) {
        setTimeout(() => {
          showToast(`✨ Vos travaux ont été récupérés (${localProjectsCount} créations). Cliquez sur « Sauvegardes » pour télécharger votre fichier de sécurité.`, 'success');
        }, 1200);
      }
    }
  }

  /**
   * Sécurité par mot de passe
   */
  function checkAuth() {
    const isAuth = sessionStorage.getItem('sarah_admin_auth') === 'true';
    const authScreen = document.getElementById('admin-auth-screen');
    const authBtn = document.getElementById('admin-auth-btn');
    const authInput = document.getElementById('admin-auth-input');

    if (isAuth) {
      if (authScreen) authScreen.classList.add('hidden');
      document.body.classList.add('admin-mode');
      setupEditablePage();
      return;
    }

    if (authBtn && authInput) {
      const submitAuth = () => {
        const pass = authInput.value.trim();
        const expected = siteData?.artist?.adminPasswordHash || 'sarah2024';
        if (pass === expected) {
          sessionStorage.setItem('sarah_admin_auth', 'true');
          authScreen.classList.add('hidden');
          document.body.classList.add('admin-mode');
          setupEditablePage();
        } else {
          alert('Mot de passe incorrect. (Par défaut : sarah2024)');
        }
      };

      authBtn.addEventListener('click', submitAuth);
      authInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitAuth();
      });
    }
  }

  /**
   * Initialisation de la barre administrative et des composants visuels
   */
  function initVisualEditorUI() {
    const saveBtn = document.getElementById('admin-bar-save-btn');
    const floatSaveBtn = document.getElementById('admin-floating-save-btn');
    const exportBtn = document.getElementById('admin-bar-export-btn');
    const backupBtn = document.getElementById('admin-bar-backup-btn') || exportBtn;
    const previewBtn = document.getElementById('admin-bar-preview-btn');
    const addProjectBtn = document.getElementById('admin-bar-add-btn');
    const exitBtn = document.getElementById('admin-bar-exit-btn');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveAllChanges());
    }

    if (floatSaveBtn) {
      floatSaveBtn.addEventListener('click', () => saveAllChanges());
    }

    // Modal de Sauvegarde & Sécurité
    const backupModal = document.getElementById('admin-backup-modal');
    const backupCloseBtn = document.getElementById('admin-backup-close-btn');
    const btnDownload = document.getElementById('btn-backup-download');
    const btnUpload = document.getElementById('btn-backup-upload');
    const backupFileInput = document.getElementById('backup-file-input');
    const githubStatusBox = document.getElementById('github-status-box');

    function checkPersistenceStatus() {
      if (!githubStatusBox) return;
      fetch('/api/status')
        .then(r => r.json())
        .then(status => {
          if (status.hasGithubToken) {
            githubStatusBox.innerHTML = `
              <div style="color: #16a34a; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem;">
                <i class="fa-solid fa-cloud-check"></i> Persistance Cloud GitHub Active
              </div>
              <div style="color: #475569; font-size: 0.74rem;">
                Vos sauvegardes et photos sont synchronisées directement sur GitHub. Aucune perte possible au redémarrage de Render.
              </div>
            `;
            githubStatusBox.style.background = '#f0fdf4';
            githubStatusBox.style.borderColor = '#bbf7d0';
          } else {
            githubStatusBox.innerHTML = `
              <div style="color: #d97706; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem;">
                <i class="fa-solid fa-triangle-exclamation"></i> Hébergement Render éphémère (Sauvegarde Locale Active)
              </div>
              <div style="color: #475569; font-size: 0.74rem;">
                Vos créations et photos sont sécurisées dans votre navigateur. Cliquez sur <strong>« Télécharger ma sauvegarde »</strong> ci-dessus pour en garder une copie sur votre ordinateur.
              </div>
            `;
            githubStatusBox.style.background = '#fffbeb';
            githubStatusBox.style.borderColor = '#fde68a';
          }
        })
        .catch(() => {
          if (githubStatusBox) {
            githubStatusBox.innerHTML = `
              <div style="color: #64748b; font-size: 0.74rem;">
                Mode autonome. Cliquez sur Télécharger pour sauvegarder vos modifications.
              </div>
            `;
          }
        });
    }

    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        if (backupModal) {
          backupModal.style.display = 'flex';
          checkPersistenceStatus();
        } else {
          exportSiteDataJSON();
        }
      });
    }

    if (backupCloseBtn && backupModal) {
      backupCloseBtn.addEventListener('click', () => {
        backupModal.style.display = 'none';
      });
      backupModal.addEventListener('click', (e) => {
        if (e.target === backupModal) backupModal.style.display = 'none';
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        exportSiteDataJSON();
      });
    }

    if (btnUpload && backupFileInput) {
      btnUpload.addEventListener('click', () => {
        backupFileInput.click();
      });

      backupFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const json = JSON.parse(text);
          if (!json || !json.projects || !Array.isArray(json.projects)) {
            alert('Le fichier sélectionné n\'est pas un fichier de sauvegarde valide pour ce site.');
            return;
          }

          if (confirm(`Restaurer cette sauvegarde (${json.projects.length} créations trouvées) ? Cela appliquera ces projets à votre catalogue.`)) {
            siteData = json;
            siteData.lastUpdated = new Date().toISOString();
            localStorage.setItem('sarah_site_data', JSON.stringify(siteData));

            try {
              await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(siteData)
              });
            } catch(e) {}

            renderAllSiteSections();
            if (backupModal) backupModal.style.display = 'none';
            showToast(`Sauvegarde restaurée avec succès ! (${json.projects.length} créations)`, 'success');
          }
        } catch (err) {
          alert('Erreur lors de la lecture du fichier : ' + err.message);
        } finally {
          backupFileInput.value = '';
        }
      });
    }

    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const isPreview = document.body.classList.toggle('preview-active');
        previewBtn.innerHTML = isPreview
          ? '<i class="fa-solid fa-pen-to-square"></i> <span class="btn-text">Éditer</span>'
          : '<i class="fa-solid fa-eye"></i> <span class="btn-text">Aperçu</span>';
        showToast(isPreview ? 'Mode aperçu propre activé (sans repères)' : 'Mode édition directe réactivé', 'info');
      });
    }

    if (addProjectBtn) {
      addProjectBtn.addEventListener('click', () => openProjectDrawer(null));
    }

    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        if (isDirty && !confirm('Vous avez des modifications non publiées. Voulez-vous vraiment quitter ?')) return;
        sessionStorage.removeItem('sarah_admin_auth');
        window.location.href = 'index.html';
      });
    }

    // Raccourci Échap pour refermer n'importe quel tiroir ou modale
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDrawers();
        closeLightbox();
      }
    });

    initDrawerListeners();
    initInboxHandlers();
  }

  /**
   * Configuration de tous les éléments éditables directement sur la page réelle
   */
  function setupEditablePage() {
    renderAllSiteSections();
    enableContentEditable();
    enableImageReplacements();
    initPortfolioFilters();
    initLightboxListeners();
  }

  /**
   * Rendu complet des sections avec les données actuelles
   */
  function renderAllSiteSections() {
    if (!siteData) return;
    const a = siteData.artist;

    // Titres & Marque
    setText('.brand-name', a.brandName);
    setText('.brand-sub', a.brandSubtitle || 'ATELIER DE FRESQUES & AQUARELLE · ALSACE');
    setText('#hero-eyebrow-text', a.heroEyebrow || 'FRESQUES PERSONNALISÉES · PARTICULIERS & PROFESSIONNELS · ALSACE 🥨');
    setText('#hero-title', a.quote || "J'embellis vos murs, peints à la main, en Alsace.");
    setText('#hero-desc-text', a.heroBio || '');

    // Photos principales
    setImg('#hero-main-img', a.heroImage || 'assets/images/post2_Dd9GbcwDM6-_01.jpg');
    setImg('#about-photo', a.profilePhoto || 'assets/images/profile_fb.jpg');

    // Chiffres Clés
    const statsContainer = document.getElementById('stats-grid-container');
    if (statsContainer && siteData.stats) {
      statsContainer.innerHTML = siteData.stats.map((s, idx) => `
        <div class="trust-item" data-stat-idx="${idx}">
          <div class="trust-num" contenteditable="true" title="Cliquez pour modifier le chiffre">${s.value}</div>
          <div class="trust-lbl" contenteditable="true" title="Cliquez pour modifier le libellé">${s.label}</div>
        </div>
      `).join('');
    }

    // Savoir-faire
    const servContainer = document.getElementById('services-grid-container');
    if (servContainer && siteData.services) {
      servContainer.innerHTML = siteData.services.map((s, idx) => `
        <div class="service-card" data-service-idx="${idx}">
          <span class="service-badge" contenteditable="true">${s.badge || 'Savoir-Faire'}</span>
          <h3 class="service-title" contenteditable="true">${s.title}</h3>
          <div class="service-subtitle" contenteditable="true">${s.subtitle || ''}</div>
          <p class="service-desc" contenteditable="true">${s.description}</p>
          <ul class="service-points">
            ${(s.points || []).map((pt, ptIdx) => `
              <li class="service-point-item" data-pt-idx="${ptIdx}">
                <i class="fa-solid fa-check"></i>
                <span contenteditable="true">${pt}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('');
    }

    // Biographie
    setText('#about-bio-text', a.bioFull);

    // Formations
    const formContainer = document.getElementById('formations-container');
    if (formContainer && siteData.formations) {
      formContainer.innerHTML = siteData.formations.map((f, idx) => `
        <div class="academic-card" data-form-idx="${idx}">
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.3rem;">
            <span class="academic-school" contenteditable="true">${f.school}</span>
            <span style="font-size: 0.8rem; color: var(--text-faint); font-weight: 600;" contenteditable="true">${f.years} &bull; ${f.city}</span>
          </div>
          <div class="academic-diploma" contenteditable="true">${f.diploma}</div>
          <p class="academic-desc" contenteditable="true">${f.description || ''}</p>
        </div>
      `).join('');
    }

    // Processus (4 étapes)
    const procContainer = document.getElementById('process-grid-container');
    if (procContainer && siteData.processus) {
      procContainer.innerHTML = siteData.processus.map((p, idx) => `
        <div class="step-card" data-step-idx="${idx}">
          <div class="step-num" contenteditable="true">${p.step}</div>
          <h3 class="step-title" contenteditable="true">${p.title}</h3>
          <p class="step-desc" contenteditable="true">${p.description}</p>
        </div>
      `).join('');
    }

    // Témoignages (Slider fluide universel Mobile & Desktop)
    const testContainer = document.getElementById('testimonials-grid-container');
    const dotsContainer = document.getElementById('testimonials-dots-container');
    const prevBtn = document.getElementById('testimonials-prev-btn');
    const nextBtn = document.getElementById('testimonials-next-btn');
    const viewport = document.getElementById('testimonials-viewport') || testContainer?.parentElement;

    if (testContainer && siteData.temoignages && siteData.temoignages.length > 0) {
      const items = siteData.temoignages;
      const N = items.length;

      const clonedItems = [
        { ...items[N - 2], _realIdx: N - 2 },
        { ...items[N - 1], _realIdx: N - 1 },
        ...items.map((it, idx) => ({ ...it, _realIdx: idx })),
        { ...items[0], _realIdx: 0 },
        { ...items[1], _realIdx: 1 }
      ];

      testContainer.innerHTML = clonedItems.map((t, idx) => `
        <div class="testimonial-card ${idx === 2 ? 'active' : ''}" data-index="${idx}" data-test-idx="${t._realIdx}" style="cursor: pointer;">
          <div class="testimonial-quote" contenteditable="true" data-field="quote">« ${t.quote} »</div>
          <div>
            <div class="testimonial-author" contenteditable="true" data-field="author">${t.author}</div>
            <div class="testimonial-context" contenteditable="true" data-field="role">${t.role} &bull; ${t.location}</div>
          </div>
        </div>
      `).join('');

      if (dotsContainer) {
        dotsContainer.innerHTML = items.map((_, idx) => `
          <button type="button" class="testimonials-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="Avis ${idx + 1}"></button>
        `).join('');
      }

      let currentIndex = 2;
      let isAnimating = false;
      let animSafetyTimer = null;

      function getCards() {
        return testContainer.querySelectorAll('.testimonial-card');
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

      function calculateOffset(index) {
        const cards = getCards();
        if (!viewport || !cards[index]) return 0;
        const card = cards[index];
        const viewportWidth = viewport.offsetWidth;
        const cardWidth = card.offsetWidth;
        const cardLeft = card.offsetLeft;
        return (viewportWidth - cardWidth) / 2 - cardLeft;
      }

      function setPosition(index, animate = true) {
        const offset = calculateOffset(index);

        if (animate) {
          testContainer.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
          isAnimating = true;
          clearTimeout(animSafetyTimer);
          animSafetyTimer = setTimeout(() => {
            isAnimating = false;
          }, 460);
        } else {
          testContainer.style.transition = 'none';
          isAnimating = false;
          clearTimeout(animSafetyTimer);
        }

        testContainer.style.transform = `translate3d(${offset}px, 0, 0)`;
        updateActiveStates();
      }

      function goToSlide(index, animate = true) {
        if (isAnimating && animate) return;
        currentIndex = index;
        setPosition(currentIndex, animate);
      }

      testContainer.addEventListener('transitionend', (e) => {
        if (e.target !== testContainer || e.propertyName !== 'transform') return;
        isAnimating = false;
        clearTimeout(animSafetyTimer);

        if (currentIndex >= N + 2) {
          currentIndex = 2;
          setPosition(currentIndex, false);
        } else if (currentIndex <= 1) {
          currentIndex = N + 1;
          setPosition(currentIndex, false);
        }
      });

      if (prevBtn) prevBtn.onclick = (e) => { e.preventDefault(); goToSlide(currentIndex - 1, true); };
      if (nextBtn) nextBtn.onclick = (e) => { e.preventDefault(); goToSlide(currentIndex + 1, true); };

      if (dotsContainer) {
        dotsContainer.querySelectorAll('.testimonials-dot').forEach(dot => {
          dot.addEventListener('click', (e) => {
            e.preventDefault();
            const targetRealIdx = parseInt(dot.getAttribute('data-idx'), 10);
            goToSlide(targetRealIdx + 2, true);
          });
        });
      }

      // Clic direct sur une carte visible pour la centrer
      getCards().forEach((card, idx) => {
        card.addEventListener('click', (e) => {
          if (e.target.isContentEditable) return;
          if (!isDragging && idx !== currentIndex) {
            goToSlide(idx, true);
          }
        });
      });

      // Pointer drag pour Desktop & Mobile
      let startX = 0;
      let startTranslateX = 0;
      let isDragging = false;
      let hasMoved = false;

      function getTrackCurrentX() {
        const transform = window.getComputedStyle(testContainer).transform;
        if (transform && transform !== 'none') {
          const matrix = new DOMMatrix(transform);
          return matrix.m41;
        }
        return calculateOffset(currentIndex);
      }

      viewport.style.touchAction = 'pan-y';

      viewport.addEventListener('pointerdown', (e) => {
        if (e.target.isContentEditable) return;
        if (e.button !== undefined && e.button !== 0) return;
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startTranslateX = getTrackCurrentX();
        testContainer.style.transition = 'none';
        clearTimeout(animSafetyTimer);
        isAnimating = false;
        try { viewport.setPointerCapture(e.pointerId); } catch(err) {}
      });

      viewport.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const diffX = e.clientX - startX;
        if (Math.abs(diffX) > 6) {
          hasMoved = true;
        }
        testContainer.style.transform = `translate3d(${startTranslateX + diffX}px, 0, 0)`;
      });

      function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        try { viewport.releasePointerCapture(e.pointerId); } catch(err) {}

        if (!hasMoved) return;

        const diffX = e.clientX - startX;
        if (diffX < -45) {
          goToSlide(currentIndex + 1, true);
        } else if (diffX > 45) {
          goToSlide(currentIndex - 1, true);
        } else {
          setPosition(currentIndex, true);
        }
      }

      viewport.addEventListener('pointerup', endDrag);
      viewport.addEventListener('pointercancel', endDrag);

      setTimeout(() => {
        setPosition(currentIndex, false);
      }, 60);

      window.addEventListener('resize', () => {
        setPosition(currentIndex, false);
      });
    }

    // FAQ
    const faqContainer = document.getElementById('faq-list-container');
    if (faqContainer && siteData.faq) {
      faqContainer.innerHTML = siteData.faq.map((f, idx) => `
        <div class="faq-row ${idx === 0 ? 'active' : ''}" data-faq-idx="${idx}">
          <button class="faq-trigger" type="button">
            <span contenteditable="true">${f.question}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="faq-content">
            <p contenteditable="true">${f.answer}</p>
          </div>
        </div>
      `).join('');

      faqContainer.querySelectorAll('.faq-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (e.target.hasAttribute('contenteditable')) return;
          btn.closest('.faq-row').classList.toggle('active');
        });
      });
    }

    // Coordonnées
    setText('#contact-phone-text', a.phone);
    setText('#contact-email-text', a.email);
    setText('#contact-location-text', a.location);
    setText('#contact-instagram-text', a.instagramHandle || (a.instagram ? '@' + a.instagram.replace(/\/+$/, '').split('/').pop() : '@sarahschu.art'));
    setText('#contact-facebook-text', a.facebook ? (a.facebook.includes('profile.php') ? 'Sarah Schu Art' : a.facebook.replace(/\/+$/, '').split('/').pop()) : 'Sarah Schu Art');

    // Rendu dynamique des filtres de catégories
    renderCategoryFilters();

    // Rendu du Catalogue des Œuvres
    renderVisualPortfolio();
  }

  let activeFilter = 'all';

  const DEFAULT_SITE_CATEGORIES = [
    { id: 'fresques', label: 'Particuliers & Résidentiel', shortLabel: 'Particuliers' },
    { id: 'collectivites', label: 'Professionnels & Santé', shortLabel: 'Professionnels' },
    { id: 'peintures', label: "Trompe-l'œil & Peintures", shortLabel: "Trompe-l'œil" },
    { id: 'illustrations', label: 'Aquarelle & Illustrations', shortLabel: 'Aquarelle & Illustrations' },
    { id: 'graphisme', label: 'Identité & Édition', shortLabel: 'Identité & Édition' },
    { id: 'divers', label: 'Autres créations', shortLabel: 'Autres' }
  ];

  function ensureCategoriesInitialized() {
    if (!siteData) return;
    if (!siteData.categories || !Array.isArray(siteData.categories) || siteData.categories.length === 0) {
      siteData.categories = DEFAULT_SITE_CATEGORIES.map(c => ({ ...c }));
    }

    const catMap = new Map();
    siteData.categories.forEach(c => {
      if (c && c.id) catMap.set(c.id, c);
    });

    // 1. S'assurer que les catégories maîtresses sont toujours présentes
    DEFAULT_SITE_CATEGORIES.forEach(defCat => {
      if (!catMap.has(defCat.id)) {
        const item = { ...defCat };
        siteData.categories.push(item);
        catMap.set(defCat.id, item);
      }
    });

    // 2. S'assurer que toutes les catégories des œuvres existantes sont bien indexées
    (siteData.projects || []).forEach(p => {
      if (p.category && !catMap.has(p.category)) {
        const newCat = {
          id: p.category,
          label: p.categoryLabel || (p.category.charAt(0).toUpperCase() + p.category.slice(1)),
          shortLabel: p.category
        };
        siteData.categories.push(newCat);
        catMap.set(p.category, newCat);
      }
    });
  }

  /**
   * Liste dynamique des catégories (depuis siteData.categories et projets)
   */
  function getCategoriesList() {
    ensureCategoriesInitialized();
    return siteData.categories ? [...siteData.categories] : [...DEFAULT_SITE_CATEGORIES];
  }

  /**
   * Rendu dynamique et synchronisé des filtres (Hero tags + Pills catalogue)
   */
  function renderCategoryFilters() {
    const categories = getCategoriesList();

    const heroTags = document.getElementById('hero-tags-container') || document.querySelector('.hero-tags');
    if (heroTags) {
      heroTags.innerHTML = `
        <button class="hero-tag-pill ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Tous</button>
        ${categories.map(c => `
          <button class="hero-tag-pill ${activeFilter === c.id ? 'active' : ''}" data-filter="${escapeHtml(c.id)}">${escapeHtml(c.shortLabel || c.label)}</button>
        `).join('')}
      `;
    }

    const catFilters = document.getElementById('catalog-filters-container') || document.querySelector('.catalog-filters');
    if (catFilters) {
      catFilters.innerHTML = `
        <button class="filter-pill ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Toutes les créations</button>
        ${categories.map(c => `
          <button class="filter-pill ${activeFilter === c.id ? 'active' : ''}" data-filter="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>
        `).join('')}
      `;
    }

    bindFilterEvents();
  }

  function bindFilterEvents() {
    const filterPills = document.querySelectorAll('.filter-pill');
    const heroTagPills = document.querySelectorAll('.hero-tag-pill');

    function applyFilter(category, shouldScroll = false) {
      activeFilter = category || 'all';

      filterPills.forEach(p => {
        p.classList.toggle('active', (p.getAttribute('data-filter') || 'all') === activeFilter);
      });

      heroTagPills.forEach(p => {
        p.classList.toggle('active', (p.getAttribute('data-filter') || 'all') === activeFilter);
      });

      renderVisualPortfolio();

      if (shouldScroll) {
        const catSection = document.getElementById('catalogue');
        if (catSection) {
          catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    filterPills.forEach(pill => {
      pill.onclick = () => {
        const cat = pill.getAttribute('data-filter');
        applyFilter(cat, false);
      };
    });

    heroTagPills.forEach(pill => {
      pill.onclick = () => {
        const cat = pill.getAttribute('data-filter');
        applyFilter(cat, true);
      };
    });
  }

  /**
   * Filtres synchronisés du catalogue (initialisation)
   */
  function initPortfolioFilters() {
    renderCategoryFilters();
  }

  /**
   * Rendu visuel du catalogue avec carte d'ajout, boutons de déplacement et drag & drop
   */
  function renderVisualPortfolio() {
    const container = document.getElementById('portfolio-grid-container');
    if (!container || !siteData.projects) return;

    const filtered = activeFilter === 'all'
      ? siteData.projects
      : siteData.projects.filter(p => p.category === activeFilter);

    let html = `
      <div class="card-add-new-project" id="btn-visual-add-project">
        <div class="card-add-icon"><i class="fa-solid fa-plus"></i></div>
        <div class="card-add-title">Ajouter une création</div>
        <div class="card-add-sub">Nouvelle fresque, trompe-l'œil ou aquarelle</div>
      </div>
    `;

    if (filtered.length === 0) {
      html += `
        <div style="grid-column: 2/-1; text-align: center; padding: 3rem 1rem;">
          <p style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--text-muted);">Aucune création dans cette catégorie.</p>
        </div>
      `;
    } else {
      html += filtered.map((p, idx) => {
        const photosCount = (p.gallery && p.gallery.length > 1) ? p.gallery.length : 1;
        const globalIdx = siteData.projects.findIndex(x => x.id === p.id);
        const displayIdx = globalIdx !== -1 ? globalIdx + 1 : idx + 1;
        const isFirst = idx === 0;
        const isLast = idx === filtered.length - 1;

        return `
          <article class="artwork-card" data-project-id="${p.id}" data-project-idx="${idx}" draggable="true" style="position: relative;">
            
            <span class="artwork-order-badge" title="Position dans la galerie">
              #${displayIdx}
            </span>

            <div class="card-admin-actions">
              <button class="btn-card-admin move-prev" data-action="move-prev" title="Déplacer vers la gauche" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                <i class="fa-solid fa-arrow-left"></i>
              </button>
              <button class="btn-card-admin move-next" data-action="move-next" title="Déplacer vers la droite" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button class="btn-card-admin drag-handle" title="Glisser pour déplacer la création" style="cursor: grab;">
                <i class="fa-solid fa-grip-vertical"></i>
              </button>
              <button class="btn-card-admin manage" data-action="manage" title="Gérer photos & diaporama">
                <i class="fa-solid fa-images"></i>
              </button>
              <button class="btn-card-admin delete" data-action="delete" title="Supprimer cette œuvre">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="artwork-frame">
              <img src="${p.mainImage}" alt="${p.title}" loading="lazy" onerror="this.onerror=null; this.src='assets/images/hero-art.jpg'; const o=this.parentElement.querySelector('.photo-change-overlay'); if(o){ o.style.opacity='1'; o.innerHTML='<i class=\\'fa-solid fa-cloud-arrow-up\\'></i> Photo à réimporter'; }">
              ${photosCount > 1 ? `
                <span class="artwork-photo-badge">
                  <i class="fa-solid fa-images"></i> ${photosCount} photos
                </span>
              ` : ''}
              <div class="artwork-hover-overlay">
                <span class="artwork-view-btn" data-action="open-lightbox">
                  <i class="fa-solid fa-expand"></i> Voir l'œuvre
                </span>
              </div>
              <div class="photo-change-overlay" data-target="project-main" data-id="${p.id}">
                <i class="fa-solid fa-camera"></i> Changer photo
              </div>
            </div>

            <div class="artwork-details">
              <div class="artwork-meta">
                <span contenteditable="true" data-field="categoryLabel" title="Modifier la catégorie">${p.categoryLabel || p.category}</span>
                <span class="artwork-meta-sep">&bull;</span>
                <span contenteditable="true" data-field="location" title="Modifier le lieu">${p.location || 'Alsace'}</span>
              </div>
              <h3 class="artwork-title" contenteditable="true" data-field="title" title="Modifier le titre">«&nbsp;${p.title}&nbsp;»</h3>
              <div class="artwork-technique-tag" contenteditable="true" data-field="technique" title="Modifier la technique">${p.technique || 'Création peinte in situ'}</div>
            </div>
          </article>
        `;
      }).join('');
    }

    container.innerHTML = html;

    // Écouteur sur la carte d'ajout
    const addCard = document.getElementById('btn-visual-add-project');
    if (addCard) {
      addCard.addEventListener('click', () => openProjectDrawer(null));
    }

    // Actions sur chaque carte
    container.querySelectorAll('.artwork-card').forEach(card => {
      const projId = card.getAttribute('data-project-id');

      // Bouton Déplacer vers la gauche (Précédent)
      const prevBtn = card.querySelector('[data-action="move-prev"]');
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          moveProject(projId, 'prev');
        });
      }

      // Bouton Déplacer vers la droite (Suivant)
      const nextBtn = card.querySelector('[data-action="move-next"]');
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          moveProject(projId, 'next');
        });
      }

      // Gestionnaire HTML5 Drag & Drop
      card.addEventListener('dragstart', (e) => {
        if (e.target.hasAttribute('contenteditable')) {
          e.preventDefault();
          return;
        }
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', projId);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        container.querySelectorAll('.artwork-card').forEach(c => {
          c.classList.remove('drag-over-prev', 'drag-over-next', 'is-dragging');
        });
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = card.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const isAfter = relX > rect.width / 2;
        card.classList.toggle('drag-over-prev', !isAfter);
        card.classList.toggle('drag-over-next', isAfter);
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over-prev', 'drag-over-next');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        card.classList.remove('drag-over-prev', 'drag-over-next');
        if (!sourceId || sourceId === projId) return;

        const rect = card.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const isAfter = relX > rect.width / 2;

        const fromIdx = siteData.projects.findIndex(p => p.id === sourceId);
        if (fromIdx === -1) return;

        const [movedItem] = siteData.projects.splice(fromIdx, 1);
        const targetCurrentIdx = siteData.projects.findIndex(p => p.id === projId);
        const insertIdx = isAfter ? targetCurrentIdx + 1 : targetCurrentIdx;

        siteData.projects.splice(insertIdx, 0, movedItem);
        markDirty();
        renderVisualPortfolio();
        showToast(`« ${movedItem.title} » déplacée en position #${insertIdx + 1} !`, 'success');
      });

      // Bouton Voir l'œuvre (ouvre la visionneuse Théâtre)
      card.querySelectorAll('[data-action="open-lightbox"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openLightbox(projId);
        });
      });

      // Clic sur la carte : en mode aperçu visiteur, ouvre la Lightbox !
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-admin-actions') || e.target.closest('.photo-change-overlay') || e.target.hasAttribute('contenteditable')) return;
        if (document.body.classList.contains('preview-active')) {
          openLightbox(projId);
        }
      });

      // Bouton Gérer / Détails (ouvre le volet latéral)
      card.querySelectorAll('[data-action="manage"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openProjectDrawer(projId);
        });
      });

      // Bouton Supprimer
      const deleteBtn = card.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteProject(projId);
        });
      }

      // Changement photo principale
      const changeOverlay = card.querySelector('.photo-change-overlay');
      if (changeOverlay) {
        changeOverlay.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerImageUpload((newUrl) => {
            const p = siteData.projects.find(x => x.id === projId);
            if (p) {
              p.mainImage = newUrl;
              if (p.gallery && p.gallery.length > 0) p.gallery[0] = newUrl;
              else p.gallery = [newUrl];
              card.querySelector('.artwork-frame img').src = newUrl;
              markDirty();
              showToast('Photo de la création mise à jour !', 'success');
            }
          });
        });
      }

      // Synchronisation de l'édition in-situ des textes de la carte
      card.querySelectorAll('[contenteditable="true"]').forEach(field => {
        field.addEventListener('input', () => {
          const p = siteData.projects.find(x => x.id === projId);
          if (!p) return;
          const fieldName = field.getAttribute('data-field');
          let val = field.textContent.trim();
          if (fieldName === 'title') {
            val = val.replace(/^«\s*|\s*»$/g, '').trim();
            p.title = val;
          } else if (fieldName) {
            p[fieldName] = val;
          }
          markDirty();
        });
      });
    });
  }

  /**
   * Déplace une création vers la gauche ou la droite
   */
  function moveProject(projId, direction) {
    const currentIdx = siteData.projects.findIndex(p => p.id === projId);
    if (currentIdx === -1) return;

    let targetIdx;
    if (activeFilter === 'all') {
      targetIdx = direction === 'prev' ? currentIdx - 1 : currentIdx + 1;
    } else {
      const filtered = siteData.projects.filter(p => p.category === activeFilter);
      const filteredIdx = filtered.findIndex(p => p.id === projId);
      if (filteredIdx === -1) return;
      const targetFilteredIdx = direction === 'prev' ? filteredIdx - 1 : filteredIdx + 1;
      if (targetFilteredIdx < 0 || targetFilteredIdx >= filtered.length) return;
      const targetProj = filtered[targetFilteredIdx];
      targetIdx = siteData.projects.findIndex(p => p.id === targetProj.id);
    }

    if (targetIdx < 0 || targetIdx >= siteData.projects.length) return;

    const [item] = siteData.projects.splice(currentIdx, 1);
    siteData.projects.splice(targetIdx, 0, item);

    markDirty();
    renderVisualPortfolio();
    showToast(`« ${item.title} » déplacée en position #${targetIdx + 1} !`, 'success');
  }

  /**
   * Modale d'Exposition (Lightbox - Aperçu Visiteur)
   */
  /* ==========================================================================
     VERROUILLAGE DU DÉFILEMENT (MODALE & TIROIR ADMIN)
     ========================================================================== */
  let scrollLockCount = 0;
  let preservedScrollY = 0;

  function lockScroll() {
    if (scrollLockCount === 0) {
      preservedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      document.documentElement.style.setProperty('--scroll-y', `-${preservedScrollY}px`);

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
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

      window.scrollTo(0, preservedScrollY);
    }
  }

  document.addEventListener('touchmove', (e) => {
    if (document.body.classList.contains('scroll-locked')) {
      if (e.target.closest('.theater-thumbs-strip') || e.target.closest('.admin-drawer-body')) {
        return;
      }
      e.preventDefault();
    }
  }, { passive: false });

  let currentLightboxProject = null;
  let currentLightboxImageIndex = 0;

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
    const sheet = document.getElementById('theater-details-sheet');
    if (sheet) sheet.classList.remove('active');
    unlockScroll();
    currentLightboxProject = null;
  }

  function updateLightboxContent() {
    if (!currentLightboxProject) return;
    const p = currentLightboxProject;
    const gallery = (p.gallery && p.gallery.length > 0) ? p.gallery : [p.mainImage];

    const activeImgSrc = gallery[currentLightboxImageIndex] || p.mainImage;
    const mainImgEl = document.getElementById('lightbox-img');
    if (mainImgEl) {
      mainImgEl.onerror = () => { mainImgEl.src = 'assets/images/hero-art.jpg'; };
      mainImgEl.src = activeImgSrc;
      mainImgEl.alt = `${p.title} - vue ${currentLightboxImageIndex + 1}`;
    }

    const ambientEl = document.getElementById('lightbox-ambient-backdrop');
    if (ambientEl && activeImgSrc) {
      ambientEl.style.backgroundImage = `url("${activeImgSrc}")`;
    }

    const counterBadge = document.getElementById('lightbox-counter-badge');
    if (counterBadge) {
      if (gallery.length > 1) {
        counterBadge.style.display = 'block';
        counterBadge.textContent = `${currentLightboxImageIndex + 1} / ${gallery.length}`;
      } else {
        counterBadge.style.display = 'none';
      }
    }

    const prevBtn = document.getElementById('lightbox-prev-btn');
    const nextBtn = document.getElementById('lightbox-next-btn');
    if (prevBtn && nextBtn) {
      const showArrows = gallery.length > 1;
      prevBtn.style.display = showArrows ? 'flex' : 'none';
      nextBtn.style.display = showArrows ? 'flex' : 'none';
    }

    // Métadonnées principales
    const catLabel = (p.categoryLabel || p.category || 'FRESQUE').toUpperCase();
    setText('#lightbox-category', catLabel);
    setText('#lightbox-title', p.title);
    setText('#lightbox-location', p.location || 'Alsace');
    setText('#lightbox-year', p.year || '2026');
    setText('#lightbox-technique', p.technique || 'Peinture acrylique in situ');
    setText('#lightbox-desc', p.description);

    // Synchronisation de la fiche mobile détaillée (texte intégral sans coupure)
    setText('#sheet-category', catLabel);
    setText('#sheet-title', p.title);
    setText('#sheet-location', p.location || 'Alsace');
    setText('#sheet-year', p.year || '2026');
    setText('#sheet-tech', p.technique || 'Peinture acrylique in situ');
    setText('#sheet-desc', p.description || 'Création unique peinte in situ.');

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

    const adminCloseBtn = document.getElementById('lightbox-admin-close-btn');
    if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeLightbox);

    // Gestion de la fiche coulissante mobile "Détails & Histoire"
    const sheet = document.getElementById('theater-details-sheet');
    const sheetCloseBtn = document.getElementById('theater-sheet-close');
    const sheetBackdrop = document.getElementById('theater-sheet-backdrop');
    const sheetAdminClose = document.getElementById('sheet-admin-close-btn');
    const infoBtn = document.getElementById('lightbox-info-btn');
    const mobileDetailsBtn = document.getElementById('lightbox-mobile-details-btn');

    const openSheet = () => {
      if (sheet) sheet.classList.add('active');
    };
    const closeSheet = () => {
      if (sheet) sheet.classList.remove('active');
    };

    if (infoBtn) infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSheet();
    });
    if (mobileDetailsBtn) mobileDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSheet();
    });
    if (sheetCloseBtn) sheetCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSheet();
    });
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSheet();
    });
    if (sheetAdminClose) sheetAdminClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSheet();
      closeLightbox();
    });
  }

  /**
   * Active l'édition textuelle en direct (contenteditable) et détecte les frappes
   */
  function enableContentEditable() {
    const editables = [
      '#hero-eyebrow-text',
      '#hero-title',
      '#hero-desc-text',
      '.brand-name',
      '.brand-sub',
      '#about-bio-text',
      '#contact-phone-text',
      '#contact-email-text',
      '#contact-location-text',
      '#contact-instagram-text',
      '#contact-facebook-text'
    ];

    editables.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('title', 'Cliquez directement pour modifier ce texte');
      }
    });

    // Écoute universelle des modifications textuelles
    document.addEventListener('input', (e) => {
      if (e.target.hasAttribute('contenteditable')) {
        markDirty();
      }
    });
  }

  /**
   * Ajoute des boutons de remplacement photo au survol des photos du site
   */
  function enableImageReplacements() {
    // 1. Photo Hero (Fresque dans l'arche)
    const archWindow = document.querySelector('.arch-window');
    if (archWindow && !archWindow.querySelector('.photo-change-overlay')) {
      const btn = document.createElement('div');
      btn.className = 'photo-change-overlay';
      btn.innerHTML = '<i class="fa-solid fa-camera"></i> Changer cette fresque';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerImageUpload((newUrl) => {
          document.getElementById('hero-main-img').src = newUrl;
          siteData.artist.heroImage = newUrl;
          markDirty();
          showToast('Fresque de l\'arche mise à jour !', 'success');
        });
      });
      archWindow.appendChild(btn);
    }

    // 2. Portrait de l'artiste
    const artistFrame = document.querySelector('.artist-arch-frame');
    const updateArtistPhoto = () => {
      triggerImageUpload((newUrl) => {
        const img = document.getElementById('about-photo');
        if (img) img.src = newUrl;
        siteData.artist.profilePhoto = newUrl;
        markDirty();
        showToast('Portrait d\'artiste mis à jour !', 'success');
      });
    };

    if (artistFrame && !artistFrame.querySelector('.photo-change-overlay')) {
      const btn = document.createElement('div');
      btn.className = 'photo-change-overlay';
      btn.innerHTML = '<i class="fa-solid fa-camera"></i> Changer votre portrait';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateArtistPhoto();
      });
      artistFrame.appendChild(btn);
    }

    // Bouton dédié bien visible sous le portrait en mode administration
    const directBtn = document.getElementById('btn-change-artist-photo');
    if (directBtn && !directBtn.dataset.listenerBound) {
      directBtn.dataset.listenerBound = 'true';
      directBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateArtistPhoto();
      });
    }
  }

  /**
   * Compresse et optimise une image avant upload admin (max 2000px, JPEG 85%)
   * Intègre le décodeur UTIF pour la conversion automatique des fichiers TIFF
   */
  async function compressImageFile(file, maxWidth = 2000, quality = 0.85) {
    if (!file) return null;

    const isTiff = (file.name && file.name.match(/\.(tiff?|tif)$/i)) || (file.type && file.type.includes('tiff'));

    // Décodage spécialisé pour les fichiers TIFF via UTIF
    if (isTiff && typeof UTIF !== 'undefined') {
      try {
        const buffer = await file.arrayBuffer();
        const ifds = UTIF.decode(buffer);
        if (ifds && ifds.length > 0) {
          UTIF.decodeImage(buffer, ifds[0]);
          const rgba = UTIF.toRGBA8(ifds[0]);
          const origW = ifds[0].width;
          const origH = ifds[0].height;

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = origW;
          tempCanvas.height = origH;
          const tCtx = tempCanvas.getContext('2d');
          const imgData = tCtx.createImageData(origW, origH);
          imgData.data.set(rgba);
          tCtx.putImageData(imgData, 0, 0);

          let width = origW;
          let height = origH;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempCanvas, 0, 0, width, height);

          return canvas.toDataURL('image/jpeg', quality);
        }
      } catch (err) {
        console.warn('Erreur décodage TIFF avec UTIF:', err);
      }
    }

    // Traitement standard (JPEG, PNG, WebP, etc.)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
          // En cas d'erreur avec le constructeur Image, on retourne la dataURL brute
          resolve(e.target.result);
        };
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Traite et téléverse un fichier unique (compresse + upload serveur / fallback dataUrl)
   */
  async function uploadSingleFile(file) {
    if (!file) return null;
    // Compression optimale (1600px, 82% JPEG) : qualité d'art préservée et volume réduit
    const base64Data = await compressImageFile(file, 1600, 0.82);
    if (!base64Data) return null;

    const cleanFileName = (file.name ? file.name.replace(/\.[^/.]+$/, "") : "photo") + ".jpg";

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, filename: cleanFileName })
      });
      if (resp.ok) {
        const data = await resp.json();
        // 1. Si commité avec succès sur GitHub, l'URL assets/images/... est permanente
        if (data.success && data.committedToGithub && data.url) {
          return data.url;
        }
        // 2. Si le serveur tourne sur disque éphémère (sans GITHUB_TOKEN), on utilise le Base64
        // afin que la photo reste gravée dans siteData et ne disparaisse JAMAIS lors d'un redémarrage !
        if (data.success && !data.committedToGithub) {
          console.info('Sécurité Render : image intégrée en Base64 permanente dans les données');
          return base64Data;
        }
        if (data.success && data.url) {
          return data.url;
        }
      }
    } catch (err) {
      console.warn('Mode autonome ou upload serveur indisponible, utilisation directe dataURL:', err);
    }

    return base64Data;
  }

  /**
   * Sélecteur universel de fichier et téléversement
   * Supporte la sélection unique (par défaut) ou multiple (options.multiple = true)
   */
  function triggerImageUpload(callback, options = {}) {
    const isMultiple = !!options.multiple;
    
    // Création d'un élément input neuf pour chaque appel pour éviter le bug de re-sélection du même fichier
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*, .jpg, .jpeg, .png, .webp, .tif, .tiff, .heic';
    if (isMultiple) input.multiple = true;
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    input.onchange = async () => {
      try {
        if (!input.files || input.files.length === 0) return;
        const files = Array.from(input.files);

        if (typeof options.onStart === 'function') {
          options.onStart(files.length);
        }

        const uploadedUrls = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (typeof options.onProgress === 'function') {
            options.onProgress(i + 1, files.length, file.name);
          }
          const url = await uploadSingleFile(file);
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length > 0) {
          if (isMultiple) {
            callback(uploadedUrls);
          } else {
            callback(uploadedUrls[0]);
          }
        } else {
          showToast("Impossible de charger la photo sélectionnée. Vérifiez le format du fichier.", "error");
        }
      } catch (err) {
        console.error('Erreur lors de l\'importation photo:', err);
        showToast("Erreur lors de l'importation de la photo.", "error");
      } finally {
        if (typeof options.onFinish === 'function') {
          options.onFinish();
        }
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      }
    };

    input.click();
  }

  /**
   * Tiroir latéral de gestion détaillée d'une œuvre (Photos multiples & infos)
   */
  function openProjectDrawer(projectId) {
    activeDrawerProjectId = projectId;
    const drawer = document.getElementById('admin-drawer');
    const backdrop = document.getElementById('admin-drawer-backdrop');
    const titleEl = document.getElementById('drawer-project-title');
    const newCatBox = document.getElementById('drawer-new-cat-box');
    const newCatInput = document.getElementById('drawer-new-cat-name');
    if (newCatBox) newCatBox.style.display = 'none';
    if (newCatInput) newCatInput.value = '';

    // Remplissage dynamique des catégories
    const catSelect = document.getElementById('drawer-cat-input');
    const cats = getCategoriesList();
    if (catSelect) {
      catSelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
    }
    renderCategoryManageList();

    drawerGallery = [];

    if (projectId) {
      const p = siteData.projects.find(x => x.id === projectId);
      if (!p) return;
      titleEl.textContent = `Gérer : ${p.title}`;
      setValue('#drawer-title-input', p.title);
      setValue('#drawer-cat-input', p.category);
      setValue('#drawer-loc-input', p.location || 'Alsace');
      setValue('#drawer-year-input', p.year || '2026');
      setValue('#drawer-tech-input', p.technique || 'Peinture murale acrylique in situ');
      setValue('#drawer-desc-input', p.description);

      drawerGallery = (p.gallery && p.gallery.length > 0) ? [...p.gallery] : [p.mainImage];
    } else {
      titleEl.textContent = 'Ajouter une nouvelle création';
      setValue('#drawer-title-input', '');
      const firstCat = (cats && cats.length > 0) ? cats[0].id : 'fresques';
      setValue('#drawer-cat-input', firstCat);
      setValue('#drawer-loc-input', 'Alsace');
      setValue('#drawer-year-input', new Date().getFullYear().toString());
      setValue('#drawer-tech-input', 'Acrylique in situ');
      setValue('#drawer-desc-input', '');
      drawerGallery = [];
    }

    // Remplissage du sélecteur de position dans le catalogue
    const posSelect = document.getElementById('drawer-position-input');
    if (posSelect) {
      posSelect.innerHTML = '';
      const total = siteData.projects.length;
      const currentPos = projectId ? siteData.projects.findIndex(x => x.id === projectId) : 0;
      const numOptions = projectId ? total : total + 1;
      for (let i = 0; i < numOptions; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        let label = `Position ${i + 1}`;
        if (i === 0) label += " (En tête d'affiche)";
        else if (i === numOptions - 1) label += " (Dernière place)";
        opt.textContent = label;
        if (i === currentPos) opt.selected = true;
        posSelect.appendChild(opt);
      }
    }

    renderDrawerGallery();
    drawer.classList.add('active');
    backdrop.classList.add('active');
    lockScroll();
  }

  function closeProjectDrawer() {
    const drawer = document.getElementById('admin-drawer');
    const backdrop = document.getElementById('admin-drawer-backdrop');
    if (drawer) drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    unlockScroll();
    activeDrawerProjectId = null;
  }

  function closeAllDrawers() {
    closeProjectDrawer();
    closeInbox();
  }

  function renderCategoryManageList() {
    const container = document.getElementById('drawer-cat-manage-list');
    if (!container) return;

    const cats = getCategoriesList();
    
    if (cats.length === 0) {
      container.innerHTML = '<div style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 0.4rem;">Aucune catégorie</div>';
      return;
    }

    container.innerHTML = cats.map(c => {
      const count = (siteData.projects || []).filter(p => p.category === c.id).length;
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-card); font-size: 0.78rem;">
          <span style="font-weight: 600; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;" title="${escapeHtml(c.label)}">
            ${escapeHtml(c.label)}
          </span>
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="font-size: 0.7rem; color: var(--text-muted);">${count} œuvre${count > 1 ? 's' : ''}</span>
            <button type="button" class="btn-del-cat-item" data-cat-id="${escapeHtml(c.id)}" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 2px 4px; border-radius: 4px;" title="Supprimer la catégorie « ${escapeHtml(c.label)} »">
              <i class="fa-solid fa-trash-can" style="pointer-events: none;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-del-cat-item').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const catId = btn.getAttribute('data-cat-id');
        deleteCategory(catId);
      };
    });
  }

  function deleteCategory(catId) {
    ensureCategoriesInitialized();
    const cat = siteData.categories.find(c => c.id === catId);
    if (!cat) return;

    if (siteData.categories.length <= 1) {
      alert("Impossible de supprimer la dernière catégorie du site.");
      return;
    }

    const affectedProjects = (siteData.projects || []).filter(p => p.category === catId);
    const count = affectedProjects.length;

    let confirmMsg = `Confirmez-vous la suppression de la catégorie « ${cat.label} » ?`;
    if (count > 0) {
      confirmMsg += `\n\n${count} création(s) sont actuellement classée(s) dans cette catégorie. Elles seront automatiquement reclassées dans la catégorie « Autres créations » afin de préserver l'ensemble de votre portfolio.`;
    }

    if (!confirm(confirmMsg)) return;

    // 1. Assurer l'existence de la catégorie de repli 'divers'
    let fallbackCat = siteData.categories.find(c => c.id === 'divers');
    if (!fallbackCat) {
      fallbackCat = {
        id: 'divers',
        label: 'Autres créations',
        shortLabel: 'Autres'
      };
      siteData.categories.push(fallbackCat);
    }

    // 2. Si la catégorie supprimée était 'divers' elle-même, prendre la 1ère autre disponible
    if (catId === 'divers') {
      const alt = siteData.categories.find(c => c.id !== 'divers');
      fallbackCat = alt || { id: 'fresques', label: 'Particuliers & Résidentiel', shortLabel: 'Particuliers' };
    }

    // 3. Reclasser toutes les créations affectées
    affectedProjects.forEach(p => {
      p.category = fallbackCat.id;
      p.categoryLabel = fallbackCat.label;
    });

    // 4. Supprimer la catégorie de siteData.categories
    siteData.categories = siteData.categories.filter(c => c.id !== catId);

    // 5. Mettre à jour le sélecteur du drawer
    const catSelect = document.getElementById('drawer-cat-input');
    if (catSelect) {
      const cats = getCategoriesList();
      catSelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
      catSelect.value = fallbackCat.id;
    }

    // 6. Rafraîchir la liste de gestion
    renderCategoryManageList();

    // 7. Si le filtre actif de la page était la catégorie supprimée, basculer sur 'all'
    if (activeFilter === catId) {
      activeFilter = 'all';
    }

    // 8. Rendu et persistance
    renderCategoryFilters();
    renderVisualPortfolio();
    markDirty();

    showToast(`Catégorie « ${cat.label} » supprimée. ${count > 0 ? count + ' création(s) déplacée(s) dans « ' + fallbackCat.label + ' ».' : ''}`, 'info');
  }

  function initDrawerListeners() {
    const closeBtn = document.getElementById('drawer-close-btn');
    const cancelBtn = document.getElementById('drawer-cancel-btn');
    const backdrop = document.getElementById('admin-drawer-backdrop');
    const saveBtn = document.getElementById('drawer-save-btn');
    const addPhotoBtn = document.getElementById('drawer-add-photo-btn');

    // Gestion de la création et suppression de catégories par l'artiste
    const newCatBtn = document.getElementById('drawer-new-cat-btn');
    const delCatBtn = document.getElementById('drawer-delete-cat-btn');
    const newCatBox = document.getElementById('drawer-new-cat-box');
    const newCatInput = document.getElementById('drawer-new-cat-name');
    const newCatConfirm = document.getElementById('drawer-add-cat-confirm');
    const newCatCancel = document.getElementById('drawer-add-cat-cancel');

    if (newCatBtn && newCatBox) {
      newCatBtn.addEventListener('click', () => {
        const isHidden = newCatBox.style.display === 'none';
        newCatBox.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          renderCategoryManageList();
          if (newCatInput) {
            newCatInput.value = '';
            newCatInput.focus();
          }
        }
      });
    }

    if (delCatBtn) {
      delCatBtn.addEventListener('click', () => {
        const catSelect = document.getElementById('drawer-cat-input');
        const selectedCat = catSelect ? catSelect.value : null;
        if (selectedCat) {
          deleteCategory(selectedCat);
        }
      });
    }

    if (newCatCancel && newCatBox) {
      newCatCancel.addEventListener('click', () => {
        newCatBox.style.display = 'none';
      });
    }

    function createNewCategory() {
      if (!newCatInput) return;
      const rawName = newCatInput.value.trim();
      if (!rawName) {
        alert('Veuillez entrer un nom pour la nouvelle catégorie.');
        return;
      }

      let slug = rawName.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (!slug) slug = 'cat-' + Date.now();

      ensureCategoriesInitialized();
      let existing = siteData.categories.find(c => c.id === slug);
      if (!existing) {
        existing = { id: slug, label: rawName, shortLabel: rawName };
        siteData.categories.push(existing);
      } else {
        existing.label = rawName;
        existing.shortLabel = rawName;
      }

      // Recharger le sélecteur du tiroir
      const catSelect = document.getElementById('drawer-cat-input');
      if (catSelect) {
        const cats = getCategoriesList();
        catSelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
        catSelect.value = slug;
      }

      // Mettre à jour la liste de gestion
      renderCategoryManageList();

      // Mettre à jour immédiatement les filtres du site (Hero & Catalogue)
      renderCategoryFilters();

      // Réinitialiser la saisie
      newCatInput.value = '';
      markDirty();
      showToast(`Nouvelle catégorie « ${rawName} » créée et intégrée au site !`, 'success');
    }

    if (newCatConfirm) {
      newCatConfirm.addEventListener('click', createNewCategory);
    }
    if (newCatInput) {
      newCatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          createNewCategory();
        }
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeProjectDrawer);
    if (cancelBtn) cancelBtn.addEventListener('click', closeProjectDrawer);
    if (backdrop) backdrop.addEventListener('click', closeAllDrawers);

    if (addPhotoBtn) {
      addPhotoBtn.addEventListener('click', () => {
        const origBtnHtml = addPhotoBtn.innerHTML;
        triggerImageUpload((urls) => {
          urls.forEach(u => drawerGallery.push(u));
          renderDrawerGallery();
          showToast(`${urls.length} photo${urls.length > 1 ? 's ajoutées' : ' ajoutée'} à la création !`, 'success');
        }, {
          multiple: true,
          onStart: (count) => {
            addPhotoBtn.disabled = true;
            addPhotoBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Préparation de ${count} photo${count > 1 ? 's' : ''}...`;
          },
          onProgress: (current, total, name) => {
            addPhotoBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Traitement (${current}/${total})...`;
          },
          onFinish: () => {
            addPhotoBtn.disabled = false;
            addPhotoBtn.innerHTML = origBtnHtml;
          }
        });
      });
    }

    // Support Glisser-Déposer de photos directement sur la zone de galerie
    const strip = document.getElementById('drawer-gallery-strip');
    async function handleDroppedFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList).filter(f => f.type.startsWith('image/') || (f.name && f.name.match(/\.(jpe?g|png|webp|tiff?|tif|heic)$/i)));
      if (files.length === 0) {
        showToast("Seuls les fichiers images sont acceptés.", "error");
        return;
      }

      const origBtnHtml = addPhotoBtn ? addPhotoBtn.innerHTML : '';
      if (addPhotoBtn) {
        addPhotoBtn.disabled = true;
        addPhotoBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Traitement de ${files.length} photo(s)...`;
      }

      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        if (addPhotoBtn) {
          addPhotoBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Traitement (${i + 1}/${files.length})...`;
        }
        const url = await uploadSingleFile(files[i]);
        if (url) uploaded.push(url);
      }

      if (uploaded.length > 0) {
        uploaded.forEach(u => drawerGallery.push(u));
        renderDrawerGallery();
        showToast(`${uploaded.length} photo${uploaded.length > 1 ? 's ajoutées' : ' ajoutée'} par glisser-déposer !`, 'success');
      }

      if (addPhotoBtn) {
        addPhotoBtn.disabled = false;
        addPhotoBtn.innerHTML = origBtnHtml;
      }
    }

    if (strip) {
      ['dragenter', 'dragover'].forEach(evt => {
        strip.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          strip.style.borderColor = 'var(--accent-terra)';
          strip.style.backgroundColor = 'rgba(196, 112, 79, 0.08)';
        });
      });
      ['dragleave', 'drop'].forEach(evt => {
        strip.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          strip.style.borderColor = '';
          strip.style.backgroundColor = '';
        });
      });
      strip.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer && e.dataTransfer.files) {
          handleDroppedFiles(e.dataTransfer.files);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const title = getValue('#drawer-title-input');
        const cat = getValue('#drawer-cat-input');
        const loc = getValue('#drawer-loc-input');
        const year = getValue('#drawer-year-input');
        const tech = getValue('#drawer-tech-input');
        const desc = getValue('#drawer-desc-input');
        const targetPos = parseInt(getValue('#drawer-position-input'), 10);

        if (!title) {
          alert('Veuillez renseigner un titre pour la création.');
          return;
        }

        if (drawerGallery.length === 0) {
          alert('Veuillez ajouter au moins une photo pour cette création.');
          return;
        }

        const allCats = getCategoriesList();
        const foundCat = allCats.find(c => c.id === cat);
        const resolvedCategoryLabel = foundCat ? foundCat.label : (cat.charAt(0).toUpperCase() + cat.slice(1));

        if (activeDrawerProjectId) {
          const p = siteData.projects.find(x => x.id === activeDrawerProjectId);
          if (p) {
            p.title = title;
            p.category = cat;
            p.categoryLabel = resolvedCategoryLabel;
            p.location = loc;
            p.year = year;
            p.technique = tech;
            p.description = desc;
            p.mainImage = drawerGallery[0];
            p.gallery = [...drawerGallery];

            // Réorganisation de position si modifiée
            if (!isNaN(targetPos)) {
              const curIdx = siteData.projects.findIndex(x => x.id === activeDrawerProjectId);
              if (curIdx !== -1 && curIdx !== targetPos && targetPos >= 0 && targetPos < siteData.projects.length) {
                const [item] = siteData.projects.splice(curIdx, 1);
                siteData.projects.splice(targetPos, 0, item);
              }
            }
          }
        } else {
          const newProject = {
            id: 'proj-' + Date.now(),
            title: title,
            category: cat,
            categoryLabel: resolvedCategoryLabel,
            location: loc,
            year: year,
            technique: tech,
            description: desc,
            mainImage: drawerGallery[0],
            gallery: [...drawerGallery],
            featured: true
          };

          if (!isNaN(targetPos) && targetPos >= 0 && targetPos <= siteData.projects.length) {
            siteData.projects.splice(targetPos, 0, newProject);
          } else {
            siteData.projects.unshift(newProject);
          }
        }

        closeProjectDrawer();
        renderCategoryFilters();
        renderVisualPortfolio();
        siteData.lastUpdated = new Date().toISOString();
        localStorage.setItem('sarah_site_data', JSON.stringify(siteData));
        markDirty();
        showToast(`Création « ${title} » enregistrée dans votre catalogue !`, 'success');
      });
    }
  }

  function renderDrawerGallery() {
    const container = document.getElementById('drawer-gallery-strip');
    if (!container) return;

    if (drawerGallery.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-faint); font-size: 0.85rem; border: 1.5px dashed var(--border-card); border-radius: 8px; cursor: pointer; transition: all 0.2s;" id="drawer-dropzone-empty">
          <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.8rem; color: var(--accent-terra); margin-bottom: 0.5rem; display: block;"></i>
          <strong>Glissez-déposez vos photos ici</strong><br>
          <span style="font-size: 0.78rem; color: var(--text-muted);">ou cliquez sur le bouton ci-dessous pour sélectionner un ou plusieurs fichiers</span>
        </div>
      `;
      const emptyBox = document.getElementById('drawer-dropzone-empty');
      if (emptyBox) {
        emptyBox.addEventListener('click', () => {
          const addBtn = document.getElementById('drawer-add-photo-btn');
          if (addBtn) addBtn.click();
        });
      }
      return;
    }

    container.innerHTML = `
      <div style="display: flex; gap: 0.6rem; overflow-x: auto; padding: 0.5rem 0; align-items: center;">
        ${drawerGallery.map((src, idx) => `
          <div style="position: relative; width: 78px; height: 78px; flex-shrink: 0; border-radius: 8px; overflow: hidden; border: 2px solid ${idx === 0 ? 'var(--accent-terra)' : 'var(--border-card)'}; box-shadow: 0 2px 6px rgba(0,0,0,0.06); background: #fff;" title="${idx === 0 ? 'Photo de couverture principale' : 'Photo secondaire (cliquez pour définir en principale)'}">
            <img src="${src}" alt="vue ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" class="drawer-thumb-img" data-idx="${idx}" onerror="this.onerror=null; this.src='assets/images/hero-art.jpg';">
            <button class="drawer-rm-photo" data-idx="${idx}" type="button" style="position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border-radius: 50%; background: rgba(220,38,38,0.92); color: #fff; border: none; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2;" title="Supprimer cette photo">
              <i class="fa-solid fa-xmark"></i>
            </button>
            ${idx === 0 
              ? '<span style="position: absolute; bottom: 0; left: 0; right: 0; background: var(--accent-terra); color: #fff; font-size: 0.58rem; font-weight: 700; text-align: center; text-transform: uppercase; padding: 2px 0; letter-spacing: 0.5px;">★ Principale</span>' 
              : `<button class="drawer-set-main" data-idx="${idx}" type="button" style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(30,30,30,0.75); color: #fff; font-size: 0.55rem; text-align: center; border: none; cursor: pointer; padding: 2px 0;" title="Définir comme photo principale">Mettre en 1ère</button>`
            }
          </div>
        `).join('')}
      </div>
      <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">
        ${drawerGallery.length} photo${drawerGallery.length > 1 ? 's' : ''} au total. La première photo est la couverture sur le catalogue.
      </div>
    `;

    container.querySelectorAll('.drawer-rm-photo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        drawerGallery.splice(idx, 1);
        renderDrawerGallery();
      });
    });

    container.querySelectorAll('.drawer-set-main, .drawer-thumb-img').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        if (idx > 0 && idx < drawerGallery.length) {
          const [selected] = drawerGallery.splice(idx, 1);
          drawerGallery.unshift(selected);
          renderDrawerGallery();
          showToast('Photo principale mise à jour !', 'info');
        }
      });
    });
  }

  function deleteProject(id) {
    const p = siteData.projects.find(x => x.id === id);
    const title = p ? p.title : 'cette œuvre';
    if (!confirm(`Supprimer définitivement « ${title} » de votre site ?`)) return;

    siteData.projects = siteData.projects.filter(x => x.id !== id);
    renderVisualPortfolio();
    markDirty();
    showToast(`L'œuvre « ${title} » a été supprimée du site.`, 'info');
  }

  /* ==========================================================================
     BOÎTE DE RÉCEPTION DES DEMANDES DE PROJET / DEVIS (DOUBLE SÉCURITÉ)
     ========================================================================== */
  const LOCAL_INBOX_KEY = 'sarah_admin_inbox_messages_v1';

  function getLocalInboxMessages() {
    try {
      const raw = localStorage.getItem(LOCAL_INBOX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }

  function saveLocalInboxMessages(msgs) {
    try {
      localStorage.setItem(LOCAL_INBOX_KEY, JSON.stringify(msgs || []));
    } catch(e) {}
  }

  let inboxMessages = getLocalInboxMessages();

  function closeInbox() {
    const drawer = document.getElementById('admin-inbox-drawer');
    const backdrop = document.getElementById('admin-drawer-backdrop');
    if (drawer) drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    unlockScroll();
  }

  function initInboxHandlers() {
    const inboxBtn = document.getElementById('admin-bar-inbox-btn');
    const closeBtn = document.getElementById('inbox-close-btn');
    const closeBtnBottom = document.getElementById('inbox-close-btn-bottom');
    const refreshBtn = document.getElementById('inbox-refresh-btn');

    if (inboxBtn) {
      inboxBtn.addEventListener('click', openInboxDrawer);
    }

    if (closeBtn) closeBtn.addEventListener('click', closeInbox);
    if (closeBtnBottom) closeBtnBottom.addEventListener('click', closeInbox);

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Actualisation...';
        await fetchInboxMessages();
        renderInboxMessages();
        updateInboxBadge();
        setTimeout(() => {
          refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Actualiser';
        }, 500);
      });
    }

    // Chargement et affichage immédiat sans attendre le réseau
    inboxMessages = getLocalInboxMessages();
    updateInboxBadge();
    renderInboxMessages();

    // Actualisation silencieuse en arrière-plan
    fetchInboxMessages().then(() => {
      updateInboxBadge();
      renderInboxMessages();
    });
  }

  async function fetchInboxMessages() {
    const localMsgs = getLocalInboxMessages();
    let serverMsgs = [];
    let serverOk = false;

    try {
      const resp = await fetch('/api/messages?v=' + Date.now());
      if (resp.ok) {
        serverMsgs = await resp.json();
        serverOk = true;
      }
    } catch (e) {
      console.warn('Lecture des messages serveur impossible', e);
    }

    // Fusion intelligente : conservation absolue de tous les messages
    const mergedMap = new Map();
    localMsgs.forEach(m => {
      if (m && m.id) mergedMap.set(m.id, m);
    });
    serverMsgs.forEach(m => {
      if (m && m.id) mergedMap.set(m.id, m);
    });

    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    inboxMessages = merged;
    saveLocalInboxMessages(merged);

    // Restauration automatique sur le serveur si besoin
    if (serverOk && localMsgs.length > serverMsgs.length) {
      try {
        await fetch('/api/messages/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: merged })
        });
        console.log('Demandes de projets synchronisées et restaurées sur le serveur.');
      } catch(e) {}
    }

    return inboxMessages;
  }

  function updateInboxBadge() {
    const badge = document.getElementById('admin-inbox-badge');
    if (!badge) return;
    if (inboxMessages && inboxMessages.length > 0) {
      badge.textContent = inboxMessages.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function openInboxDrawer() {
    const drawer = document.getElementById('admin-inbox-drawer');
    const backdrop = document.getElementById('admin-drawer-backdrop');
    if (drawer) drawer.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    lockScroll();

    // Rendu immédiat des messages existants
    renderInboxMessages();
    updateInboxBadge();

    // Rafraîchissement silencieux
    fetchInboxMessages().then(() => {
      renderInboxMessages();
      updateInboxBadge();
    });
  }

  function convertTiffBase64ToJpeg(tiffBase64) {
    if (typeof UTIF === 'undefined' || !tiffBase64 || !tiffBase64.startsWith('data:image/tif')) return tiffBase64;
    try {
      const base64Data = tiffBase64.split(',')[1];
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
      const ifds = UTIF.decode(bytes.buffer);
      if (ifds && ifds.length > 0) {
        UTIF.decodeImage(bytes.buffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        const w = ifds[0].width;
        const h = ifds[0].height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(w, h);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch(err) {
      console.warn('Erreur conversion TIFF en JPEG', err);
    }
    return tiffBase64;
  }

  function openAdminPhotoModal(src, author) {
    const modal = document.getElementById('admin-photo-viewer-modal');
    const img = document.getElementById('admin-photo-viewer-img');
    const cap = document.getElementById('admin-photo-viewer-caption');
    const closeBtn = document.getElementById('admin-photo-viewer-close');
    if (!modal || !img) return;

    img.src = src;
    if (cap) cap.textContent = `Photo transmise par : ${author || 'Client'}`;
    modal.style.display = 'flex';

    function closeModal() {
      modal.style.display = 'none';
      img.src = '';
      window.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') closeModal();
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal || e.target === closeBtn || e.target.closest('#admin-photo-viewer-close')) {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
  }

  function renderInboxMessages() {
    const container = document.getElementById('inbox-messages-list');
    if (!container) return;

    if (!inboxMessages || inboxMessages.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size: 2.5rem; color: #D6D3D1; margin-bottom: 0.8rem; display: block;"></i>
          <p style="font-size: 0.95rem; font-weight: 600;">Aucune demande de projet pour le moment.</p>
          <p style="font-size: 0.8rem; color: var(--text-faint); margin-top: 0.4rem; line-height: 1.5;">
            Dès qu'un visiteur remplit le formulaire sur le site, sa demande apparaîtra ici avec ses coordonnées et sa photo, et vous recevrez également un e-mail avec la photo jointe.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = inboxMessages.map((m) => {
      const dateFormatted = m.date ? new Date(m.date).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '';

      let photoSrc = m.photoData || m.photoUrl;
      if (photoSrc && (photoSrc.startsWith('data:image/tif') || photoSrc.startsWith('data:image/x-tif'))) {
        photoSrc = convertTiffBase64ToJpeg(photoSrc);
        m.photoData = photoSrc;
      }

      return `
        <div class="inbox-msg-card" style="background: #FAF8F5; border: 1px solid var(--border-card); border-radius: 12px; padding: 1.1rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; gap: 0.5rem;">
            <div>
              <strong style="font-size: 1rem; color: var(--text-main);">${escapeHtml(m.nom || 'Sans nom')}</strong>
              <div style="font-size: 0.78rem; color: var(--text-faint);">${dateFormatted}</div>
            </div>
            <span style="background: var(--accent-terra-light); color: var(--accent-terra); font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
              ${escapeHtml(m.typeProjet || 'Projet')}
            </span>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.8rem; font-size: 0.85rem;">
            ${m.tel ? `<a href="tel:${escapeHtml(m.tel)}" style="color: var(--accent-terra); font-weight: 600; text-decoration: none;"><i class="fa-solid fa-phone"></i> ${escapeHtml(m.tel)}</a>` : ''}
            ${m.email ? `<a href="mailto:${escapeHtml(m.email)}" style="color: var(--accent-terra); font-weight: 600; text-decoration: none;"><i class="fa-solid fa-envelope"></i> ${escapeHtml(m.email)}</a>` : ''}
            ${m.dimensions ? `<span style="color: var(--text-muted);"><i class="fa-solid fa-ruler-combined"></i> ${escapeHtml(m.dimensions)}</span>` : ''}
          </div>

          <div style="background: #FFFFFF; border-radius: 8px; padding: 0.8rem; font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin-bottom: 0.8rem; border-left: 3px solid var(--accent-terra); white-space: pre-wrap;">
            ${escapeHtml(m.message || '')}
          </div>

          ${photoSrc ? `
            <div style="margin-bottom: 0.8rem; background: #FFFFFF; padding: 0.6rem; border-radius: 8px; border: 1px dashed var(--border-card);">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">
                <i class="fa-solid fa-camera"></i> Photo du mur reçue :
              </div>
              <div class="inbox-photo-zoom-trigger" data-photo-src="${escapeHtml(photoSrc)}" data-author="${escapeHtml(m.nom || 'Client')}" style="cursor: zoom-in; display: block; text-align: center;">
                <img src="${escapeHtml(photoSrc)}" alt="Photo du mur" style="max-height: 200px; width: auto; max-width: 100%; border-radius: 6px; object-fit: contain; box-shadow: var(--shadow-sm); pointer-events: none;">
                <span style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--accent-terra); margin-top: 0.35rem; pointer-events: none;">
                  <i class="fa-solid fa-magnifying-glass-plus"></i> Cliquer pour agrandir la photo
                </span>
              </div>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button class="btn-admin-bar btn-admin-danger btn-del-msg" data-id="${m.id}" type="button" style="padding: 4px 10px; font-size: 0.75rem;">
              <i class="fa-solid fa-trash"></i> Supprimer
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.inbox-photo-zoom-trigger').forEach(trigger => {
      trigger.onclick = () => {
        const src = trigger.getAttribute('data-photo-src');
        const author = trigger.getAttribute('data-author');
        openAdminPhotoModal(src, author);
      };
    });

    container.querySelectorAll('.btn-del-msg').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Supprimer cette demande de devis ?')) return;
        try {
          await fetch('/api/messages/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
        } catch(e) {}

        inboxMessages = inboxMessages.filter(x => x.id !== id);
        saveLocalInboxMessages(inboxMessages);
        renderInboxMessages();
        updateInboxBadge();
        showToast('Demande supprimée', 'info');
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Sauvegarde intégrale en 1 Clic (Disque + localStorage)
   */
  async function saveAllChanges() {
    collectLiveDOMData();
    siteData.lastUpdated = new Date().toISOString();

    const saveBtn = document.getElementById('admin-bar-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span class="btn-text">Publication...</span>';
      saveBtn.disabled = true;
    }

    // 1. Sauvegarde dans le localStorage du navigateur
    localStorage.setItem('sarah_site_data', JSON.stringify(siteData));

    // 2. Envoi direct sur le serveur Node.js pour écriture sur le disque (data/site-data.json)
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
    } catch (e) {
      // localStorage suffit en mode statique
    }

    setTimeout(() => {
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span class="btn-text">Publié !</span>';
        saveBtn.disabled = false;
        setTimeout(() => {
          saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span class="btn-text">Sauvegarder</span>';
        }, 2200);
      }
      isDirty = false;
      updateStatusBadge();
      showToast('Toutes vos modifications sont en ligne et immédiatement visibles !', 'success');
    }, 400);
  }

  /**
   * Extrait les textes modifiés directement dans le DOM pour les réinjecter dans siteData
   */
  function collectLiveDOMData() {
    const a = siteData.artist;
    a.brandName = getText('.brand-name') || a.brandName;
    a.brandSubtitle = getText('.brand-sub') || a.brandSubtitle;
    a.heroEyebrow = getText('#hero-eyebrow-text') || a.heroEyebrow;
    a.quote = getText('#hero-title') || a.quote;
    a.heroBio = getText('#hero-desc-text') || a.heroBio;
    a.bioFull = getText('#about-bio-text') || a.bioFull;
    a.phone = getText('#contact-phone-text') || a.phone;
    a.phoneClean = a.phone.replace(/\s+/g, '');
    a.email = getText('#contact-email-text') || a.email;
    a.location = getText('#contact-location-text') || a.location;
    const igVal = getText('#contact-instagram-text');
    if (igVal) {
      a.instagramHandle = igVal.startsWith('@') ? igVal : '@' + igVal.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      a.instagram = igVal.startsWith('http') ? igVal : `https://www.instagram.com/${igVal.replace('@', '')}`;
    }
    const fbVal = getText('#contact-facebook-text');
    if (fbVal) {
      a.facebook = fbVal.startsWith('http') ? fbVal : (fbVal.includes('profile.php') ? fbVal : `https://www.facebook.com/${fbVal.replace('@', '')}`);
    }

    // Chiffres Clés
    document.querySelectorAll('.trust-item').forEach(item => {
      const idx = parseInt(item.getAttribute('data-stat-idx'), 10);
      if (!isNaN(idx) && siteData.stats[idx]) {
        siteData.stats[idx].value = item.querySelector('.trust-num')?.textContent.trim() || siteData.stats[idx].value;
        siteData.stats[idx].label = item.querySelector('.trust-lbl')?.textContent.trim() || siteData.stats[idx].label;
      }
    });

    // Savoir-faire
    document.querySelectorAll('.service-card').forEach(card => {
      const idx = parseInt(card.getAttribute('data-service-idx'), 10);
      if (!isNaN(idx) && siteData.services[idx]) {
        const s = siteData.services[idx];
        s.badge = card.querySelector('.service-badge')?.textContent.trim() || s.badge;
        s.title = card.querySelector('.service-title')?.textContent.trim() || s.title;
        s.subtitle = card.querySelector('.service-subtitle')?.textContent.trim() || s.subtitle;
        s.description = card.querySelector('.service-desc')?.textContent.trim() || s.description;

        card.querySelectorAll('.service-point-item').forEach((ptItem, ptIdx) => {
          if (s.points && s.points[ptIdx] !== undefined) {
            s.points[ptIdx] = ptItem.querySelector('span')?.textContent.trim() || s.points[ptIdx];
          }
        });
      }
    });

    // Formations
    document.querySelectorAll('.academic-card').forEach(card => {
      const idx = parseInt(card.getAttribute('data-form-idx'), 10);
      if (!isNaN(idx) && siteData.formations[idx]) {
        const f = siteData.formations[idx];
        f.school = card.querySelector('.academic-school')?.textContent.trim() || f.school;
        f.diploma = card.querySelector('.academic-diploma')?.textContent.trim() || f.diploma;
        f.description = card.querySelector('.academic-desc')?.textContent.trim() || f.description;
      }
    });

    // Processus
    document.querySelectorAll('.step-card').forEach(card => {
      const idx = parseInt(card.getAttribute('data-step-idx'), 10);
      if (!isNaN(idx) && siteData.processus[idx]) {
        siteData.processus[idx].step = card.querySelector('.step-num')?.textContent.trim() || siteData.processus[idx].step;
        siteData.processus[idx].title = card.querySelector('.step-title')?.textContent.trim() || siteData.processus[idx].title;
        siteData.processus[idx].description = card.querySelector('.step-desc')?.textContent.trim() || siteData.processus[idx].description;
      }
    });

    // FAQ
    document.querySelectorAll('.faq-row').forEach(row => {
      const idx = parseInt(row.getAttribute('data-faq-idx'), 10);
      if (!isNaN(idx) && siteData.faq[idx]) {
        siteData.faq[idx].question = row.querySelector('.faq-trigger span')?.textContent.trim() || siteData.faq[idx].question;
        siteData.faq[idx].answer = row.querySelector('.faq-content p')?.textContent.trim() || siteData.faq[idx].answer;
      }
    });

    // Témoignages
    document.querySelectorAll('.testimonial-card').forEach(card => {
      const realIdx = parseInt(card.getAttribute('data-test-idx'), 10);
      if (!isNaN(realIdx) && siteData.temoignages && siteData.temoignages[realIdx]) {
        const quoteEl = card.querySelector('.testimonial-quote');
        const authorEl = card.querySelector('.testimonial-author');
        const contextEl = card.querySelector('.testimonial-context');
        if (quoteEl) {
          siteData.temoignages[realIdx].quote = quoteEl.textContent.trim().replace(/^«\s*|\s*»$/g, '');
        }
        if (authorEl) {
          siteData.temoignages[realIdx].author = authorEl.textContent.trim();
        }
        if (contextEl) {
          const parts = contextEl.textContent.split('•');
          if (parts.length > 1) {
            siteData.temoignages[realIdx].role = parts[0].trim();
            siteData.temoignages[realIdx].location = parts[1].trim();
          } else {
            siteData.temoignages[realIdx].role = contextEl.textContent.trim();
          }
        }
      }
    });

    // Créations du portfolio éditées in-situ
    document.querySelectorAll('.artwork-card').forEach(card => {
      const projId = card.getAttribute('data-project-id');
      const p = siteData.projects?.find(x => x.id === projId);
      if (p) {
        const titleEl = card.querySelector('[data-field="title"]');
        const catLabelEl = card.querySelector('[data-field="categoryLabel"]');
        const locEl = card.querySelector('[data-field="location"]');
        const techEl = card.querySelector('[data-field="technique"]');
        if (titleEl) p.title = titleEl.textContent.trim().replace(/^«\s*|\s*»$/g, '');
        if (catLabelEl) {
          const newLabel = catLabelEl.textContent.trim();
          p.categoryLabel = newLabel;
          if (siteData.categories) {
            const catItem = siteData.categories.find(c => c.id === p.category);
            if (catItem) {
              catItem.label = newLabel;
              catItem.shortLabel = newLabel;
            }
          }
        }
        if (locEl) p.location = locEl.textContent.trim();
        if (techEl) p.technique = techEl.textContent.trim();
      }
    });
  }

  /**
   * Téléchargement autonome du fichier site-data.json pour sauvegarde ou déploiement statique
   */
  function exportSiteDataJSON() {
    collectLiveDOMData();
    siteData.lastUpdated = new Date().toISOString();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(siteData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'site-data.json');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Fichier site-data.json téléchargé avec succès !', 'success');
  }

  function markDirty() {
    isDirty = true;
    updateStatusBadge();
  }

  function updateStatusBadge() {
    const dot = document.querySelector('.admin-status-dot');
    const text = document.getElementById('admin-status-text');
    const floatSaveBtn = document.getElementById('admin-floating-save-btn');
    if (dot && text) {
      if (isDirty) {
        dot.classList.add('dirty');
        text.textContent = 'Non enregistré';
        if (floatSaveBtn) floatSaveBtn.classList.add('dirty');
      } else {
        dot.classList.remove('dirty');
        text.textContent = 'Synchronisé';
        if (floatSaveBtn) floatSaveBtn.classList.remove('dirty');
      }
    }
  }

  function setText(sel, val) {
    const el = document.querySelector(sel);
    if (el && val !== undefined) el.textContent = val;
  }

  function getText(sel) {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : '';
  }

  function setImg(sel, src) {
    const el = document.querySelector(sel);
    if (el && src) el.src = src;
  }

  function setValue(sel, val) {
    const el = document.querySelector(sel);
    if (el && val !== undefined) el.value = val;
  }

  function getValue(sel) {
    const el = document.querySelector(sel);
    return el ? el.value.trim() : '';
  }

  function showToast(message, type = 'info') {
    let toast = document.getElementById('visual-admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'visual-admin-toast';
      toast.className = 'admin-toast-badge';
      document.body.appendChild(toast);
    }

    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
    toast.className = `admin-toast-badge ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toast.classList.add('active');

    setTimeout(() => {
      toast.classList.remove('active');
    }, 3500);
  }

})();
