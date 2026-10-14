# 🎨 Atelier Sarah Schu — Site Vitrine & Éditeur Visuel In Situ

Site vitrine officiel de l'artiste peintre muraliste et aquarelliste : **Sarah Schu** (**Atelier Sarah Schu**), basée à **Zimmerbach / Colmar / Munster en Alsace**.

---

## 🌟 Nouveautés & Points Forts

### 1. Éditeur Visuel en « Vue Réelle » (Zéro boîte de dialogue abstraite)
* Accessible sur **`admin.html`** (mot de passe initial : `sarah2024`).
* Sarah Schu voit directement le **vrai site en situation réelle** :
  * **Édition directe de tous les textes** : cliquez directement sur un titre, une description, un tarif ou un numéro de téléphone pour le modifier au clavier (`contenteditable`).
  * **Remplacement direct des photos** : survolez n'importe quelle photo (fresque dans l'arche, portrait d'artiste, ou œuvres du catalogue) pour afficher le bouton `📷 Changer la photo`.
  * **Gestion in situ des créations** : carte d'ajout directe `➕ Ajouter une création` et boutons d'action sur chaque carte (`📷 Photos & Diaporama`, `🗑️ Supprimer`).
  * **Bouton « Sauvegarder & Publier en direct »** dans la barre supérieure flottante : sauvegarde en 1 clic sur le serveur et mise à jour immédiate.
  * **Mode « Aperçu visiteur »** : permet de masquer les contours d'édition pour admirer le rendu final.

### 2. Modale Lightbox & Slides d'Exposition Corrigés
* **Navigation par diaporama fluide** : flèches droite/gauche haute visibilité (`z-index: 100`), compteur de vue stylisé (`1 / 9`), touches clavier et **glissement tactile (swipe)** sur smartphone et tablette.
* **Bandeau de miniatures responsif** : vignettes carrées nettes avec défilement horizontal doux (`flex-shrink: 0`, auto-scroll vers la vue active).
* **Affichage typographique impeccable** : puce Unicode `•` (suppression définitive des `&BULL;` bruts).

### 3. Expérience Mobile Optimisée (Zéro empilement infini)
* **Affichage initial allégé** : les 6 créations phares sont présentées en premier.
* **Bouton interactif** : `Afficher plus de créations (12 restantes) ↓` permet de déployer la suite sans encombrer la page au chargement.
* **Filtres thématiques à défilement tactile** : sélection rapide (*Particuliers*, *Professionnels*, *Trompe-l'œil*, *Aquarelle*) pour n'afficher que les 3 à 4 créations pertinentes.
* **Proportions compactes des cartes** : ratio 16:10 et descriptions courtes pour une lecture mobile ultra fluide.

---

## 📁 Structure des Fichiers

```text
sarah-schu-art/
├── index.html              # Site vitrine public (boutique atelier, catalogue, contact)
├── admin.html              # Éditeur visuel en vue réelle (IN SITU)
├── data/
│   └── site-data.json      # Données éditoriales & catalogue JSON
├── assets/
│   ├── css/
│   │   ├── style.css       # Styles du site public (Alsace chic, arches romanes, mobile)
│   │   └── admin-visual.css# Styles de la barre flottante et des repères d'édition
│   ├── js/
│   │   ├── main.js         # Moteur d'exposition public, filtres & lightbox tactile
│   │   └── admin-visual.js # Moteur d'édition directe in situ & sauvegarde 1-clic
│   └── images/             # Photos authentiques des fresques de Sarah Schu
├── server.js               # Serveur local Node.js sans dépendances
└── README.md
```

---

## 🚀 Démarrage

```bash
cd /Users/brianlehmann/.gemini/antigravity/scratch/sarah-schu-art
node server.js
```

* **Site public** : [http://localhost:3000/](http://localhost:3000/)
* **Éditeur en vue réelle** : [http://localhost:3000/admin.html](http://localhost:3000/admin.html) (mot de passe : `sarah2024`)
