/**
 * ATELIER SARAH SCHU - Logique du CMS d'Administration
 * Modification visuelle directe sans code ni FTP
 */

(function () {
  'use strict';

  let siteData = null;
  let editingProjectId = null;
  let pendingProjectImages = [];

  document.addEventListener('DOMContentLoaded', initAdmin);

  async function initAdmin() {
    await loadData();
    checkAuth();
    initTabs();
    populateForms();
    renderProjectsManager();
    initModalHandlers();
    initSaveActions();
  }

  /**
   * Chargement des données (arbitrage intelligent par horodatage entre serveur et localStorage)
   */
  async function loadData() {
    let serverData = null;
    try {
      const resp = await fetch('data/site-data.json?v=' + Date.now());
      if (resp.ok) {
        serverData = await resp.json();
      }
    } catch (e) {
      console.warn('Lecture serveur directe non disponible');
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

    // Choisir la source la plus récente
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
      alert('Impossible de charger les données du site.');
    }
  }

  /**
   * Sécurisation par mot de passe
   */
  function checkAuth() {
    const isAuth = sessionStorage.getItem('sarah_admin_auth') === 'true';
    const authOverlay = document.getElementById('auth-overlay');
    const authBtn = document.getElementById('auth-submit-btn');
    const authInput = document.getElementById('auth-password-input');

    if (isAuth) {
      authOverlay.classList.add('hidden');
      return;
    }

    authBtn.addEventListener('click', async () => {
      const pass = authInput.value.trim();
      if (!pass) return;
      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        const data = await resp.json();
        if (resp.ok && data.success && data.token) {
          sessionStorage.setItem('sarah_admin_token', data.token);
          sessionStorage.setItem('sarah_admin_auth', 'true');
          authOverlay.classList.add('hidden');
        } else {
          alert(data.error || 'Mot de passe incorrect.');
        }
      } catch (e) {
        alert('Erreur de connexion au serveur.');
      }
    });

    authInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') authBtn.click();
    });
  }

  /**
   * Gestion des onglets
   */
  function initTabs() {
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(`tab-${target}`);
        if (activePane) activePane.classList.add('active');
      });
    });
  }

  /**
   * Remplit les champs du formulaire avec les données actuelles
   */
  function populateForms() {
    if (!siteData) return;
    const a = siteData.artist;

    // Profil & Marque
    setValue('#input-brand-name', a.brandName);
    setValue('#input-brand-subtitle', a.brandSubtitle || 'ATELIER DE FRESQUES & AQUARELLE · ALSACE');
    setValue('#input-artist-name', a.name);
    setValue('#input-hero-eyebrow', a.heroEyebrow || 'FRESQUES PERSONNALISÉES · PARTICULIERS & PROFESSIONNELS · ALSACE 🥨');
    setValue('#input-title', a.title);
    setValue('#input-tagline', a.tagline);
    setValue('#input-quote', a.quote);
    setValue('#input-phone', a.phone);
    setValue('#input-email', a.email);
    setValue('#input-location', a.location);
    setValue('#input-instagram', a.instagram);
    setValue('#input-facebook', a.facebook);
    setValue('#input-hero-bio', a.heroBio || '');
    setValue('#input-bio-short', a.bioShort);
    setValue('#input-bio-full', a.bioFull);

    // Photo de profil
    const avatarImg = document.getElementById('admin-profile-avatar-preview');
    if (avatarImg) avatarImg.src = a.profilePhoto;

    // Statistiques
    if (siteData.stats && siteData.stats.length >= 4) {
      setValue('#input-stat-0-val', siteData.stats[0].value);
      setValue('#input-stat-0-lbl', siteData.stats[0].label);
      setValue('#input-stat-1-val', siteData.stats[1].value);
      setValue('#input-stat-1-lbl', siteData.stats[1].label);
      setValue('#input-stat-2-val', siteData.stats[2].value);
      setValue('#input-stat-2-lbl', siteData.stats[2].label);
      setValue('#input-stat-3-val', siteData.stats[3].value);
      setValue('#input-stat-3-lbl', siteData.stats[3].label);
    }
  }

  function setValue(selector, val) {
    const el = document.querySelector(selector);
    if (el && val !== undefined) el.value = val;
  }

  function getValue(selector) {
    const el = document.querySelector(selector);
    return el ? el.value.trim() : '';
  }

  /**
   * Rendu de la grille des projets dans l'onglet Portfolio
   */
  function renderProjectsManager() {
    const container = document.getElementById('projects-manager-grid');
    if (!container || !siteData.projects) return;

    container.innerHTML = siteData.projects.map(p => `
      <div class="project-admin-card" data-id="${p.id}">
        <div class="project-admin-thumb">
          <img src="${p.mainImage}" alt="${p.title}">
        </div>
        <div class="project-admin-body">
          <div class="project-admin-title">${p.title}</div>
          <div class="project-admin-meta">
            <i class="fa-solid fa-tag"></i> ${p.categoryLabel || p.category} | ${p.location || ''} (${p.year || ''})
          </div>
          <div class="project-admin-actions">
            <button class="btn-admin btn-admin-outline btn-edit-proj" data-id="${p.id}" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
              <i class="fa-solid fa-pen-to-square"></i> Modifier
            </button>
            <button class="btn-admin btn-admin-danger btn-del-proj" data-id="${p.id}" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
              <i class="fa-solid fa-trash"></i> Supprimer
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Écouteurs Modifier & Supprimer
    container.querySelectorAll('.btn-edit-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditProjectModal(id);
      });
    });

    container.querySelectorAll('.btn-del-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteProject(id);
      });
    });
  }

  /**
   * Modale d'ajout / modification de projet
   */
  function initModalHandlers() {
    const modal = document.getElementById('project-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const addBtn = document.getElementById('btn-add-new-project');
    const saveProjBtn = document.getElementById('modal-save-project-btn');
    const dropZone = document.getElementById('modal-drop-zone');
    const fileInput = document.getElementById('modal-file-input');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openEditProjectModal(null);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    if (saveProjBtn) {
      saveProjBtn.addEventListener('click', saveProjectFromModal);
    }

    // Gestion du téléversement d'image par glisser-déposer ou sélection
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--admin-secondary)';
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--admin-border)';
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--admin-border)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadedFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          handleUploadedFiles(fileInput.files);
        }
      });
    }
  }

  /**
   * Compression intelligente des photos côté client (évite de saturer l'espace ou la mémoire)
   */
  function compressImage(file, maxDimension = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Traitement des images uploadées (avec tentative d'enregistrement direct sur serveur)
   */
  async function handleUploadedFiles(files) {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      try {
        const compressedBase64 = await compressImage(file);
        
        // Tentative d'upload direct sur le serveur Node.js s'il tourne
        try {
          const resp = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, image: compressedBase64 })
          });
          const result = await resp.json();
          if (result && result.success && result.url) {
            pendingProjectImages.push(result.url);
            renderPendingImages();
            continue;
          }
        } catch (e) {
          // Serveur non démarré, bascule transparente sur l'image compressée
        }

        pendingProjectImages.push(compressedBase64);
        renderPendingImages();
      } catch (err) {
        console.error('Erreur compression image', err);
      }
    }
  }

  function renderPendingImages() {
    const container = document.getElementById('modal-images-preview-list');
    if (!container) return;

    container.innerHTML = pendingProjectImages.map((src, idx) => `
      <div class="image-preview-item">
        <img src="${src}" alt="photo ${idx + 1}">
        <div class="image-preview-remove" data-idx="${idx}">
          <i class="fa-solid fa-xmark"></i>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.image-preview-remove').forEach(rm => {
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(rm.getAttribute('data-idx'), 10);
        pendingProjectImages.splice(idx, 1);
        renderPendingImages();
      });
    });
  }

  function openEditProjectModal(projectId) {
    editingProjectId = projectId;
    const modal = document.getElementById('project-modal');
    const modalTitle = document.getElementById('modal-project-title');

    pendingProjectImages = [];

    if (projectId) {
      const p = siteData.projects.find(x => x.id === projectId);
      if (!p) return;
      modalTitle.textContent = `Modifier : ${p.title}`;
      setValue('#modal-proj-title', p.title);
      setValue('#modal-proj-category', p.category);
      setValue('#modal-proj-location', p.location || '');
      setValue('#modal-proj-year', p.year || '');
      setValue('#modal-proj-technique', p.technique || '');
      setValue('#modal-proj-desc', p.description || '');

      pendingProjectImages = (p.gallery && p.gallery.length > 0) 
        ? [...p.gallery] 
        : [p.mainImage];
    } else {
      modalTitle.textContent = 'Ajouter une nouvelle création';
      setValue('#modal-proj-title', '');
      setValue('#modal-proj-category', 'fresques');
      setValue('#modal-proj-location', 'Alsace');
      setValue('#modal-proj-year', new Date().getFullYear().toString());
      setValue('#modal-proj-technique', 'Acrylique sur mur');
      setValue('#modal-proj-desc', '');
    }

    renderPendingImages();
    modal.classList.add('active');
  }

  async function saveProjectFromModal() {
    const title = getValue('#modal-proj-title');
    const category = getValue('#modal-proj-category');
    const location = getValue('#modal-proj-location');
    const year = getValue('#modal-proj-year');
    const technique = getValue('#modal-proj-technique');
    const desc = getValue('#modal-proj-desc');

    if (!title) {
      alert('Veuillez saisir un titre pour la création.');
      return;
    }

    if (pendingProjectImages.length === 0) {
      alert('Veuillez ajouter au moins une photo pour cette création.');
      return;
    }

    const categoryLabels = {
      'fresques': "Fresques & Trompe-l'œil",
      'collectivites': "Grands Espaces & Santé",
      'graphisme': "Identité & Édition",
      'illustrations': "Illustrations & BD",
      'peintures': "Études Académiques"
    };

    if (editingProjectId) {
      // Modification
      const p = siteData.projects.find(x => x.id === editingProjectId);
      if (p) {
        p.title = title;
        p.category = category;
        p.categoryLabel = categoryLabels[category] || category;
        p.location = location;
        p.year = year;
        p.technique = technique;
        p.description = desc;
        p.mainImage = pendingProjectImages[0];
        p.gallery = [...pendingProjectImages];
      }
    } else {
      // Nouveau projet
      const newProj = {
        id: 'proj-' + Date.now(),
        title: title,
        category: category,
        categoryLabel: categoryLabels[category] || category,
        location: location,
        year: year,
        technique: technique,
        description: desc,
        mainImage: pendingProjectImages[0],
        gallery: [...pendingProjectImages],
        featured: true
      };
      siteData.projects.unshift(newProj);
    }

    document.getElementById('project-modal').classList.remove('active');
    renderProjectsManager();
    await saveChanges(false);
    showAdminToast(`Création « ${title} » enregistrée et publiée avec succès !`, 'success');
  }

  async function deleteProject(id) {
    const proj = siteData.projects.find(p => p.id === id);
    const title = proj ? proj.title : 'cette œuvre';
    if (!confirm(`Supprimer « ${title} » du catalogue ?`)) return;

    siteData.projects = siteData.projects.filter(p => p.id !== id);
    renderProjectsManager();
    await saveChanges(false);
    showAdminToast(`La création a été supprimée.`, 'info');
  }

  /**
   * Sauvegarde des données
   */
  function initSaveActions() {
    const saveBtn = document.getElementById('admin-save-all-btn');
    const exportBtn = document.getElementById('admin-export-json-btn');
    const importInput = document.getElementById('admin-import-json-input');
    const resetBtn = document.getElementById('admin-reset-default-btn');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveChanges(true));
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportJsonFile);
    }

    if (importInput) {
      importInput.addEventListener('change', importJsonFile);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Attention : cela réinitialisera toutes les données aux valeurs par défaut de l\'Atelier. Continuer ?')) {
          localStorage.removeItem('sarah_site_data');
          window.location.reload();
        }
      });
    }
  }

  function collectFormData() {
    // Profil
    siteData.artist.brandName = getValue('#input-brand-name');
    siteData.artist.brandSubtitle = getValue('#input-brand-subtitle');
    siteData.artist.name = getValue('#input-artist-name');
    siteData.artist.heroEyebrow = getValue('#input-hero-eyebrow');
    siteData.artist.title = getValue('#input-title');
    siteData.artist.tagline = getValue('#input-tagline');
    siteData.artist.quote = getValue('#input-quote');
    siteData.artist.phone = getValue('#input-phone');
    siteData.artist.phoneClean = getValue('#input-phone').replace(/\s+/g, '');
    siteData.artist.email = getValue('#input-email');
    siteData.artist.location = getValue('#input-location');
    siteData.artist.instagram = getValue('#input-instagram');
    siteData.artist.facebook = getValue('#input-facebook');
    siteData.artist.heroBio = getValue('#input-hero-bio');
    siteData.artist.bioShort = getValue('#input-bio-short');
    siteData.artist.bioFull = getValue('#input-bio-full');

    // Stats
    if (siteData.stats && siteData.stats.length >= 4) {
      siteData.stats[0].value = getValue('#input-stat-0-val');
      siteData.stats[0].label = getValue('#input-stat-0-lbl');
      siteData.stats[1].value = getValue('#input-stat-1-val');
      siteData.stats[1].label = getValue('#input-stat-1-lbl');
      siteData.stats[2].value = getValue('#input-stat-2-val');
      siteData.stats[2].label = getValue('#input-stat-2-lbl');
      siteData.stats[3].value = getValue('#input-stat-3-val');
      siteData.stats[3].label = getValue('#input-stat-3-lbl');
    }
  }

  async function saveChanges(showToastAlert = true) {
    collectFormData();
    siteData.lastUpdated = new Date().toISOString();

    const saveBtns = [
      document.getElementById('admin-save-all-btn'),
      document.querySelector('.admin-save-bar button')
    ].filter(Boolean);

    saveBtns.forEach(btn => {
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enregistrement en direct...';
      btn.disabled = true;
    });

    // 1. Sauvegarde dans localStorage (persistant dans le navigateur)
    localStorage.setItem('sarah_site_data', JSON.stringify(siteData));

    // 2. Si un serveur backend Node.js tourne, envoi direct pour écriture sur le disque
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
    } catch (err) {
      // Pas de serveur Node actif, localStorage suffit en mode statique !
    }

    setTimeout(() => {
      saveBtns.forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistré & Publié !';
        btn.disabled = false;
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Sauvegarder et publier';
        }, 2200);
      });
    }, 400);

    if (showToastAlert) {
      showAdminToast('Modifications enregistrées ! Votre site est immédiatement à jour.', 'success');
    }
  }

  function showAdminToast(message, type = 'success') {
    let container = document.getElementById('admin-toast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'admin-toast';
      container.className = 'admin-toast-notice';
      document.body.appendChild(container);
    }

    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
    container.innerHTML = `
      <div class="admin-toast-inner ${type}">
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
        <a href="index.html" target="_blank" class="admin-toast-link">Voir le site public &rarr;</a>
      </div>
    `;

    container.classList.add('visible');
    setTimeout(() => {
      container.classList.remove('visible');
    }, 4000);
  }

  function exportJsonFile() {
    collectFormData();
    const jsonStr = JSON.stringify(siteData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.appendChild(a);
    a.remove();
    URL.revokeObjectURL(url);
    showAdminToast('Copie de sauvegarde exportée avec succès.', 'info');
  }

  function importJsonFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.artist && imported.projects) {
          siteData = imported;
          await saveChanges(false);
          populateForms();
          renderProjectsManager();
          showAdminToast('Sauvegarde restaurée avec succès !', 'success');
        } else {
          alert('Le fichier sélectionné ne semble pas être une sauvegarde valide du site.');
        }
      } catch (err) {
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
  }

})();
