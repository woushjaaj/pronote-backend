// src/index.ts
import dotenv from 'dotenv';
 
// IMPORTANT : charger dotenv en PREMIER avant tout le reste
// Sinon process.env.XXXX sera undefined dans les autres fichiers
dotenv.config();
 
import express from 'express';
import { initDB } from './database';
import { startPoller } from './poller';
import apiRouter from './api';
 
async function main() {
  console.log('🚀 Démarrage du backend Pronote...');
 
  // 1. Initialise la base de données (crée les tables si nécessaire)
  initDB();
 
  // 2. Crée le serveur Express
  const app = express();
  app.use(express.json()); // permet de lire le JSON dans req.body
 
  // 3. Branche les routes API sur le préfixe /api
  app.use('/api', apiRouter);
 
  // 4. Route de santé pour vérifier que le serveur tourne
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
 
  // 5. Démarre le serveur
  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Serveur Express démarré sur le port ${port}`);
  });
 
  // 6. Démarre la boucle de polling Pronote
  startPoller();
}
 
// Gestion des erreurs non catchées (évite que le serveur plante sans raison)
process.on('unhandledRejection', (reason) => {
  console.error('❌ Erreur non gérée :', reason);
});
 
main();
