/**
 * ATELIER SARAH SCHU - Serveur HTTP Léger (Zéro dépendance)
 * Utilise uniquement les modules natifs de Node.js (http, fs, path, url)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'site-data.json');
const IMAGES_DIR = path.join(ROOT, 'assets', 'images');

// Sécurité admin : mot de passe côté serveur (modifiable via variable d'environnement ADMIN_PASSWORD)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sarah2024';

function createSessionToken() {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [ts, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(ts).digest('hex');
  if (sig !== expectedSig) return false;
  const age = Date.now() - parseInt(ts, 10);
  return age >= 0 && age < (30 * 24 * 60 * 60 * 1000); // Valide 30 jours
}

function isAuthorized(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return verifySessionToken(token);
}

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
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS headers pour faciliter l'accès local et sécurisé
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GIT_TOKEN || process.env.TOKEN || null;
}

/**
 * Auto-Commit vers GitHub (pour rendre les données 100% permanentes sur Render)
 * Utilise la variable d'environnement GITHUB_TOKEN (ou GH_TOKEN, GIT_TOKEN) configurée sur Render.
 */
async function commitToGitHub(repoFilePath, bufferOrString, commitMessage) {
  const token = getGitHubToken();
  if (!token) return { success: false, reason: 'GITHUB_TOKEN_NOT_SET' };

  const owner = process.env.GITHUB_OWNER || 'Nairb68';
  const repo = process.env.GITHUB_REPO || 'atelier-sarah-schu';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${repoFilePath}?ref=${branch}`;

  try {
    let sha = null;
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Atelier-Sarah-Schu-App'
      }
    });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const contentBuffer = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString, 'utf-8');
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${repoFilePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Atelier-Sarah-Schu-App'
      },
      body: JSON.stringify({
        message: commitMessage || `Auto-save: mise à jour de ${repoFilePath}`,
        content: contentBuffer.toString('base64'),
        branch: branch,
        sha: sha || undefined
      })
    });

    if (putRes.ok) {
      console.log(`🚀 GitHub auto-commit réussi : ${repoFilePath}`);
      return { success: true };
    } else {
      const errText = await putRes.text();
      console.warn(`⚠️ Échec GitHub auto-commit (${putRes.status}):`, errText);
      return { success: false, error: errText };
    }
  } catch (err) {
    console.error('Erreur GitHub auto-commit:', err);
    return { success: false, error: err.message };
  }
}

  // --- API : Authentification sécurisée de l'artiste ---
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { password } = JSON.parse(body);
        if (password && password === ADMIN_PASSWORD) {
          const token = createSessionToken();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, token }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Mot de passe incorrect' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Format de requête invalide' }));
      }
    });
    return;
  }

  // --- API : Vérification du statut de connexion ---
  if (pathname === '/api/auth-verify' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: isAuthorized(req) }));
    return;
  }

  // --- API : Sauvegarde des données ---
  if (pathname === '/api/save' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Accès non autorisé. Veuillez vous connecter.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        // Sécurité absolue : s'assurer qu'aucun hash de mot de passe ne subsiste dans le fichier JSON
        if (json.artist && json.artist.adminPasswordHash) {
          delete json.artist.adminPasswordHash;
        }

        const jsonStr = JSON.stringify(json, null, 2);
        fs.writeFileSync(DATA_FILE, jsonStr, 'utf-8');
        console.log('✅ data/site-data.json mis à jour localement');

        // Sauvegarde de secours additionnelle
        const RESCUE_FILE = path.join(ROOT, 'data', 'site-data.rescue.json');
        try { fs.writeFileSync(RESCUE_FILE, jsonStr, 'utf-8'); } catch(e) {}

        let githubCommitted = false;
        if (getGitHubToken()) {
          const ghRes = await commitToGitHub('data/site-data.json', jsonStr, 'Auto-save catalogue par Sarah Schu');
          githubCommitted = ghRes.success;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Sauvegardé avec succès', 
          committedToGithub: githubCommitted,
          hasGithubToken: !!getGitHubToken() 
        }));
      } catch (err) {
        console.error('Erreur écriture JSON:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }


  // --- API : Téléchargement du fichier de sauvegarde JSON actuel ---
  if (pathname === '/api/backup/download' && req.method === 'GET') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Accès réservé à l\'administrateur');
      return;
    }

    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="site-data-backup.json"'
      });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Fichier non trouvé');
    }
    return;
  }

  // --- API : Statut du serveur & configuration de persistance ---
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      hasGithubToken: !!getGitHubToken(),
      uptime: process.uptime(),
      date: new Date().toISOString()
    }));
    return;
  }

  // --- API : Téléversement d'image Base64 ---
  if (pathname === '/api/upload' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Accès non autorisé. Veuillez vous connecter.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
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
        console.log(`✅ Image enregistrée localement : ${cleanName}`);

        let githubCommitted = false;
        if (getGitHubToken()) {
          const ghRes = await commitToGitHub(`assets/images/${cleanName}`, buffer, `Upload photo catalogue: ${cleanName}`);
          githubCommitted = ghRes.success;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          url: `assets/images/${cleanName}`,
          filename: cleanName,
          committedToGithub: githubCommitted,
          hasGithubToken: !!getGitHubToken() 
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
        const jsonStr = JSON.stringify(messages, null, 2);
        fs.writeFileSync(MESSAGES_FILE, jsonStr, 'utf-8');
        console.log(`📩 Nouvelle demande de projet reçue de : ${msg.nom} (${msg.email})`);

        if (getGitHubToken()) {
          commitToGitHub('data/messages.json', jsonStr, `Nouvelle demande de projet : ${msg.nom}`);
        }

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
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Accès non autorisé' }));
      return;
    }

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
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Accès non autorisé' }));
      return;
    }

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
        const jsonStr = JSON.stringify(messages, null, 2);
        fs.writeFileSync(MESSAGES_FILE, jsonStr, 'utf-8');

        if (getGitHubToken()) {
          commitToGitHub('data/messages.json', jsonStr, `Suppression demande de devis : ${id}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API : Synchronisation des messages (restauration persistante après redéploiement) ---
  if (pathname === '/api/messages/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const incoming = Array.isArray(data) ? data : (data.messages || []);
        const MESSAGES_FILE = path.join(ROOT, 'data', 'messages.json');
        let current = [];
        if (fs.existsSync(MESSAGES_FILE)) {
          try {
            current = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
          } catch(e) {}
        }
        const existingIds = new Set(current.map(m => m.id));
        let added = 0;
        incoming.forEach(m => {
          if (m && m.id && !existingIds.has(m.id)) {
            current.push(m);
            existingIds.add(m.id);
            added++;
          }
        });
        current.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        const jsonStr = JSON.stringify(current, null, 2);
        fs.writeFileSync(MESSAGES_FILE, jsonStr, 'utf-8');
        console.log(`🔄 Synchronisation messages terminée : +${added} restaurés (${current.length} au total)`);

        if (getGitHubToken() && added > 0) {
          commitToGitHub('data/messages.json', jsonStr, `Synchronisation demandes de devis (${current.length} messages)`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: current.length, added }));
      } catch (err) {
        console.error('Erreur sync messages:', err);
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

  // Pour index.html, adapter automatiquement le domaine pour Open Graph si servi sur un hôte personnalisé
  if (pathname === '/index.html') {
    const indexPath = path.join(ROOT, 'index.html');
    fs.readFile(indexPath, 'utf-8', (err, html) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Erreur de lecture');
      }
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        const proto = req.headers['x-forwarded-proto'] || (req.connection && req.connection.encrypted ? 'https' : 'https');
        const currentOrigin = `${proto}://${host}`;
        html = html.split('https://atelier-sarah-schu.onrender.com').join(currentOrigin);
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(html);
    });
    return;
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
    if (ext === '.json' || ext === '.html' || ext === '.js' || ext === '.css') {
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
