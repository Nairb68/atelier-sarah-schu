/**
 * ATELIER SARAH SCHU - Serveur HTTP Léger (Zéro dépendance)
 * Utilise uniquement les modules natifs de Node.js (http, fs, path, url)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'site-data.json');
const IMAGES_DIR = path.join(ROOT, 'assets', 'images');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS headers pour faciliter l'accès local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API : Sauvegarde des données ---
  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        fs.writeFileSync(DATA_FILE, JSON.stringify(json, null, 2), 'utf-8');
        console.log('✅ data/site-data.json mis à jour avec succès');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Sauvegardé avec succès' }));
      } catch (err) {
        console.error('Erreur écriture JSON:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API : Téléversement d'image Base64 ---
  if (pathname === '/api/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.image || !data.filename) {
          throw new Error('Données manquantes (image ou filename requis)');
        }
        
        // Décodage base64
        const matches = data.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(data.image, 'base64');
        
        const ext = path.extname(data.filename) || '.jpg';
        const cleanName = 'upload_' + Date.now() + ext;
        const filePath = path.join(IMAGES_DIR, cleanName);

        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Image enregistrée : ${cleanName}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          url: `assets/images/${cleanName}`,
          filename: cleanName 
        }));
      } catch (err) {
        console.error('Erreur upload image:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API : Réception de demande de projet / devis ---
  if (pathname === '/api/contact' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        const MESSAGES_FILE = path.join(ROOT, 'data', 'messages.json');
        let messages = [];
        if (fs.existsSync(MESSAGES_FILE)) {
          try {
            messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
          } catch(e) {}
        }
        msg.id = 'msg-' + Date.now();
        msg.date = new Date().toISOString();
        msg.read = false;
        messages.unshift(msg);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
        console.log(`📩 Nouvelle demande de projet reçue de : ${msg.nom} (${msg.email})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Demande enregistrée avec succès' }));
      } catch (err) {
        console.error('Erreur traitement contact:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API : Lecture de la liste des demandes de projet (Espace Admin) ---
  if (pathname === '/api/messages' && req.method === 'GET') {
    const MESSAGES_FILE = path.join(ROOT, 'data', 'messages.json');
    let messages = [];
    if (fs.existsSync(MESSAGES_FILE)) {
      try {
        messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
      } catch(e) {}
    }
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(messages));
    return;
  }

  // --- API : Suppression d'une demande de projet & nettoyage de la photo associée ---
  if (pathname === '/api/messages/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        const MESSAGES_FILE = path.join(ROOT, 'data', 'messages.json');
        let messages = [];
        if (fs.existsSync(MESSAGES_FILE)) {
          try {
            messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
          } catch(e) {}
        }

        // Nettoyage de la photo du mur associée sur le disque
        const target = messages.find(m => m.id === id);
        if (target && target.photoUrl) {
          const relPath = target.photoUrl.replace(/^\/+/, '');
          if (relPath.startsWith('assets/images/upload_')) {
            const fullPath = path.join(ROOT, relPath);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
                console.log(`🗑️ Fichier photo supprimé du disque : ${relPath}`);
              } catch (e) {
                console.warn('Erreur suppression photo:', e.message);
              }
            }
          }
        }

        messages = messages.filter(m => m.id !== id);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- Fichiers statiques ---
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(ROOT, pathname);

  // Sécurité traversée de répertoire
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Accès refusé');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Fichier non trouvé');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = { 'Content-Type': contentType };
    if (ext === '.json' || ext === '.html' || ext === '.js') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🎨 ATELIER SARAH SCHU - Serveur démarré`);
  console.log(`🌐 Site vitrine public : http://localhost:${PORT}/`);
  console.log(`🔒 Espace administration : http://localhost:${PORT}/admin.html`);
  console.log(`======================================================\n`);
});
