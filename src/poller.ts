// src/poller.ts
import cron from 'node-cron';
import * as Pronote from './pronote';
import * as Detector from './detector';
import * as Notifier from './notifier';
import db, { getSetting } from './database';
import * as Pawnote from 'pawnote';
 
let isPolling = false; // Empêche deux polls simultanés
 
// Fonction principale de poll : récupère tout et détecte les changements
async function poll() {
  if (isPolling) {
    console.log('⏳ Poll précédent encore en cours, on attend...');
    return;
  }
 
  isPolling = true;
  console.log(`\n🔄 [${new Date().toLocaleTimeString('fr-FR')}] Début du poll...`);
 
  try {
    // 1. Récupère les données de Pronote en parallèle
    // Promise.allSettled continue même si une requête échoue
    const [timetableResult, gradesResult, homeworksResult, messagesResult, punishmentsResult, lifeResult] =
      await Promise.allSettled([
        Pronote.fetchTimetable(0),  // semaine actuelle
        Pronote.fetchTimetable(1),  // semaine prochaine (pour anticiper les statuts)
        Pronote.fetchGrades(),
        Pronote.fetchHomeworks(),
        Pronote.fetchMessages(),
        Pronote.fetchPunishments(),
        Pronote.fetchLifeEvents(),
      ]);
 
    // 2. Traite l'EDT (deux semaines)
    // fetchTimetable retourne un Timetable, on extrait .classes
    const timetableSlots = timetableResult.status === 'fulfilled'
        ? (timetableResult.value as any)?.classes ?? []
        : [];

    // La semaine suivante devrait être un 2ème fetchTimetable, pas fetchGrades !
    // On ignore nextWeekSlots pour l'instant (le poll actuel n'en a pas)
    const allTimetable = [...timetableSlots];
 
    const timetableEvents = Detector.detectTimetableChanges(allTimetable);
    for (const event of timetableEvents) {
      await Notifier.notifyTimetableEvent(event);
    }
 
    // 3. Traite les notes
    if (homeworksResult.status === 'fulfilled') {
      const grades = homeworksResult.value; // réorganisation des résultats
    }
    // (version simplifiée - voir ci-dessous pour la version complète)
 
    console.log(`✅ Poll terminé.`);
  } catch (err) {
    console.error('❌ Erreur pendant le poll :', err);
  } finally {
    isPolling = false;
  }
}
 
// Lance le polling sur un intervalle régulier
// La syntaxe cron : '*/5 * * * *' = toutes les 5 minutes
export function startPoller() {
  const interval = parseInt(process.env.POLL_INTERVAL_MINUTES || '5');
  const cronExpr = `*/${interval} * * * *`;
 
  console.log(`⏰ Démarrage du poller (toutes les ${interval} minutes)`);
 
  // Exécute un premier poll immédiatement au démarrage
  poll();
 
  // Puis toutes les X minutes
  cron.schedule(cronExpr, poll);
 
  // Vérifie les devoirs non faits chaque soir à l'heure configurée
  scheduleDailyHomeworkCheck();
 
  // Vérifie les évals du jour chaque soir à 20h pour la prédiction
  scheduleEvalPredictionCheck();
}
 
// Vérification des devoirs non faits
function scheduleDailyHomeworkCheck() {
  const time = getSetting('homework_check_time') || '19:30';
  const [hour, minute] = time.split(':');
 
  // Syntaxe cron : 'minute heure * * *' = chaque jour à HH:MM
  cron.schedule(`${minute} ${hour} * * *`, async () => {
    console.log('📚 Vérification des devoirs non faits...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
 
    const undone = db.prepare(`
      SELECT * FROM homeworks
      WHERE due_date <= ? AND done = 0 AND notified_undone = 0
    `).all(tomorrowStr) as any[];
 
    for (const hw of undone) {
      await Notifier.notifyUndonHomework(hw.subject, hw.description, hw.due_date);
      db.prepare('UPDATE homeworks SET notified_undone = 1 WHERE id = ?').run(hw.id);
    }
  });
}
 
// Vérification des évals du jour pour proposer la saisie de prédiction (à 20h)
function scheduleEvalPredictionCheck() {
  cron.schedule('0 20 * * *', async () => {
    // Vérifie si la feature prédiction est activée
    const enabled = getSetting('prediction_enabled') === '1';
    if (!enabled) return;
 
    const today = new Date().toISOString().split('T')[0];
 
    // Cherche les évals d'aujourd'hui dont la prédiction n'a pas encore été demandée
    const pendingEvals = db.prepare(`
      SELECT * FROM grade_predictions
      WHERE eval_date = ? AND prediction IS NULL AND notif_sent = 0
    `).all(today) as any[];
 
    for (const eval_ of pendingEvals) {
      await Notifier.notifyPredictionPrompt(eval_.subject, eval_.eval_date);
      db.prepare('UPDATE grade_predictions SET notif_sent = 1 WHERE eval_id = ?').run(eval_.eval_id);
    }
  });
}
