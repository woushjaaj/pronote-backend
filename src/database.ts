// src/database.ts
import Database from 'better-sqlite3';
import path from 'path';
 
// Crée (ou ouvre) le fichier de base de données
// __dirname = dossier du fichier actuel
const db = new Database(path.join(__dirname, '..', 'pronote_data.db'));
 
// Optimisation : active le mode WAL pour de meilleures performances
db.pragma('journal_mode = WAL');
 
// Cette fonction crée toutes les tables si elles n'existent pas encore
// On l'appelle au démarrage du serveur
export function initDB(): void {
  db.exec(`
 
    -- Table : créneaux de l'emploi du temps
    -- On stocke chaque créneau et son statut pour détecter les changements
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id          TEXT PRIMARY KEY,   -- identifiant unique du créneau (fourni par Pawnote)
      subject     TEXT,               -- nom de la matière
      date        TEXT,               -- date au format YYYY-MM-DD
      start_time  TEXT,               -- heure de début (HH:MM)
      end_time    TEXT,               -- heure de fin (HH:MM)
      room        TEXT,               -- salle
      teacher     TEXT,               -- nom du prof
      status      TEXT,               -- statut actuel ('Prof absent', 'Examens', etc.)
      raw_data    TEXT,               -- JSON complet du créneau (pour l'app Flutter)
      notified    INTEGER DEFAULT 0   -- 1 = notif déjà envoyée pour ce statut
    );
 
    -- Table : notes
    CREATE TABLE IF NOT EXISTS grades (
      id          TEXT PRIMARY KEY,
      subject     TEXT,
      grade       REAL,              -- note obtenue (ex: 14.5)
      out_of      REAL,              -- note maximale (ex: 20)
      coefficient REAL DEFAULT 1,
      date        TEXT,
      comment     TEXT,
      notified    INTEGER DEFAULT 0
    );
 
    -- Table : prédictions de notes (saisies par l'utilisateur dans l'app)
    CREATE TABLE IF NOT EXISTS grade_predictions (
      eval_id       TEXT PRIMARY KEY, -- ID du créneau d'éval ou du devoir
      subject       TEXT,
      eval_date     TEXT,             -- date de l'évaluation
      source        TEXT,             -- 'timetable' ou 'homework'
      prediction    REAL,             -- note prédite par l'élève (nulle si pas encore saisie)
      real_grade_id TEXT,             -- ID de la note réelle une fois publiée
      notif_sent    INTEGER DEFAULT 0 -- 1 = notif de prédiction déjà envoyée
    );
 
    -- Table : devoirs
    CREATE TABLE IF NOT EXISTS homeworks (
      id              TEXT PRIMARY KEY,
      subject         TEXT,
      description     TEXT,
      due_date        TEXT,           -- date limite au format YYYY-MM-DD
      done            INTEGER DEFAULT 0,  -- 1 = marqué comme fait sur Pronote
      notified_new    INTEGER DEFAULT 0,  -- 1 = notif 'nouveau devoir' envoyée
      notified_undone INTEGER DEFAULT 0   -- 1 = notif 'non fait' envoyée
    );
 
    -- Table : messages (boîte de réception Pronote)
    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      sender     TEXT,
      subject    TEXT,
      date       TEXT,
      notified   INTEGER DEFAULT 0
    );
 
    -- Table : sanctions (retenues, exclusions...)
    CREATE TABLE IF NOT EXISTS punishments (
      id         TEXT PRIMARY KEY,
      type       TEXT,
      reason     TEXT,
      date       TEXT,
      notified   INTEGER DEFAULT 0
    );
 
    -- Table : vie scolaire (absences, retards, infirmerie)
    CREATE TABLE IF NOT EXISTS life_events (
      id         TEXT PRIMARY KEY,
      type       TEXT,   -- 'absence' | 'retard' | 'infirmerie'
      date       TEXT,
      duration   TEXT,
      justified  INTEGER DEFAULT 0,
      notified   INTEGER DEFAULT 0
    );
 
    -- Table : paramètres utilisateur
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
 
  // Insère les paramètres par défaut si ils n'existent pas
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  insertSetting.run('prediction_enabled', '1');   // feature activée par défaut
  insertSetting.run('homework_check_time', process.env.HOMEWORK_CHECK_TIME || '19:30');
 
  console.log('✅ Base de données initialisée');
}
 
// Fonctions utilitaires pour requêter la base
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}
 
export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}
 
// Export de l'instance db pour l'utiliser dans les autres fichiers
export default db;
