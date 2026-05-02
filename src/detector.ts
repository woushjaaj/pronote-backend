// src/detector.ts
import db from './database';
 
// ── Constantes de détection ───────────────────────────────────────────
 
// Mots-clés qui indiquent un examen ou composition sur Pronote
// → PRIORITÉ 1 : si un de ces mots est dans le statut, c'est un examen
const EXAM_KEYWORDS = [
  'examen', 'examens', 'compo', 'composition',
  'bac blanc', 'brevet blanc', 'ds', 'devoir surveillé',
  'évaluation commune', 'dnb',
];
 
// Mots-clés pour prof absent
const ABSENT_KEYWORDS = [
  'prof absent', 'absence enseignant', 'professeur absent',
  'cours annulé', 'cours supprimé',
];
 
// Mots-clés pour cours déplacé
const MOVED_KEYWORDS = [
  'cours déplacé', 'déplacé', 'salle modifiée', 'cours modifié',
];
 
// Vérifie si un statut correspond à un examen/compo
function isExamStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return EXAM_KEYWORDS.some(k => s.includes(k));
}
 
// Analyse le type d'un créneau
function analyzeSlotType(status?: string): 'exam' | 'absent' | 'moved' | 'status_change' | null {
  if (!status || status.trim() === '') return null;
 
  if (isExamStatus(status)) return 'exam';
 
  const s = status.toLowerCase();
  if (ABSENT_KEYWORDS.some(k => s.includes(k))) return 'absent';
  if (MOVED_KEYWORDS.some(k => s.includes(k))) return 'moved';
 
  // Statut inconnu mais non vide = on le signale quand même
  return 'status_change';
}
 
// FALLBACK : détecte un examen si 3+ créneaux consécutifs du même cours
// dans la même journée, SEULEMENT si aucun statut explicite n'est trouvé
function detectExamByConsecutiveSlots(
  slots: any[],
  targetDate: string
): string[] {
  const slotsOfDay = slots.filter(s => s.date === targetDate);
 
  // Regroupe les créneaux sans statut explicite par matière
  const countBySubject: Record<string, number> = {};
  for (const slot of slotsOfDay) {
    // Si un statut explicite existe déjà, pas besoin du fallback
    if (analyzeSlotType(slot.status) === 'exam') continue;
    const subj = slot.subject?.name;
    if (!subj) continue;
    countBySubject[subj] = (countBySubject[subj] || 0) + 1;
  }
 
  // Retourne les matières avec 3 créneaux ou plus
  return Object.entries(countBySubject)
    .filter(([, count]) => count >= 3)
    .map(([subject]) => subject);
}
 
 
// ── Détection principale de l'EDT ─────────────────────────────────────
 
export interface TimetableEvent {
  type: 'exam' | 'absent' | 'moved' | 'status_change' | 'exam_by_slots';
  slot: any;           // créneau concerné
  movedTo?: any;       // créneau de remplacement si cours déplacé
  statusLabel: string; // texte du statut à afficher dans la notif
}
 
export function detectTimetableChanges(freshSlots: any[]): TimetableEvent[] {
  const events: TimetableEvent[] = [];
  const processedDatesForFallback = new Set<string>();
 
  for (const slot of freshSlots) {
    const slotId = slot.id || `${slot.date}-${slot.startTime}-${slot.subject?.name}`;
    const currentStatus = slot.status || '';
 
    // Récupère l'état précédent depuis la base
    const previous = db.prepare(
      'SELECT status, notified FROM timetable_slots WHERE id = ?'
    ).get(slotId) as any;
 
    // NOUVEAU créneau (jamais vu avant) ou STATUT CHANGÉ
    const isNew = !previous;
    const statusChanged = previous && previous.status !== currentStatus;
    const alreadyNotified = previous?.notified === 1 && !statusChanged;
 
    if (alreadyNotified) continue;
    if (!isNew && !statusChanged) continue;
    if (!currentStatus && isNew) {
      // Nouveau créneau sans statut → on l'enregistre simplement, sans notifier
      upsertSlot(slotId, slot, currentStatus, 1);
      continue;
    }
 
    const eventType = analyzeSlotType(currentStatus);
    if (!eventType) {
      upsertSlot(slotId, slot, currentStatus, 1);
      continue;
    }
 
    // Cours déplacé : on essaie de trouver le créneau de remplacement
    let movedTo: any = undefined;
    if (eventType === 'moved') {
      movedTo = freshSlots.find(s =>
        s.id !== slotId &&
        s.subject?.name === slot.subject?.name &&
        s.date !== slot.date &&          // date différente
        !ABSENT_KEYWORDS.some(k => (s.status || '').toLowerCase().includes(k))
      );
    }
 
    events.push({ type: eventType, slot, movedTo, statusLabel: currentStatus });
    upsertSlot(slotId, slot, currentStatus, 1);
  }
 
  // FALLBACK : vérifie les journées avec 3+ créneaux consécutifs
  const uniqueDates = [...new Set(freshSlots.map(s => s.date))];
  for (const date of uniqueDates) {
    if (processedDatesForFallback.has(date)) continue;
    const examSubjects = detectExamByConsecutiveSlots(freshSlots, date);
    for (const subject of examSubjects) {
      const concernedSlots = freshSlots.filter(s => s.date === date && s.subject?.name === subject);
      // Vérifie qu'on n'a pas déjà notifié pour cette journée
      const alreadyDone = db.prepare(
        'SELECT 1 FROM timetable_slots WHERE date = ? AND subject = ? AND notified = 1'
      ).get(date, subject);
      if (!alreadyDone) {
        events.push({
          type: 'exam_by_slots',
          slot: concernedSlots[0],
          statusLabel: `${concernedSlots.length} créneaux consécutifs (composition probable)`,
        });
      }
    }
    processedDatesForFallback.add(date);
  }
 
  return events;
}
 
// Met à jour ou insère un créneau dans la base
function upsertSlot(id: string, slot: any, status: string, notified: number) {
  db.prepare(`
    INSERT OR REPLACE INTO timetable_slots
    (id, subject, date, start_time, end_time, room, teacher, status, raw_data, notified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    slot.subject?.name || '',
    slot.date,
    slot.startTime,
    slot.endTime,
    slot.room?.name || '',
    slot.teacher?.name || '',
    status,
    JSON.stringify(slot),
    notified
  );
}
// Toujours dans src/detector.ts
 
export interface GradeEvent {
  grade: any;
  prediction?: number; // prédiction de l'élève si elle existe
}
 
export function detectNewGrades(freshGrades: any[]): GradeEvent[] {
  const events: GradeEvent[] = [];
 
  for (const grade of freshGrades) {
    const exists = db.prepare(
      'SELECT notified FROM grades WHERE id = ?'
    ).get(grade.id) as any;
 
    if (exists?.notified) continue; // déjà notifié
 
    // Cherche si une prédiction avait été saisie pour cette matière/cette date
    const prediction = db.prepare(
      'SELECT prediction FROM grade_predictions WHERE subject = ? AND eval_date <= ? ORDER BY eval_date DESC LIMIT 1'
    ).get(grade.subject?.name, grade.date) as any;
 
    events.push({ grade, prediction: prediction?.prediction });
 
    // Enregistre la note en base
    db.prepare(`
      INSERT OR REPLACE INTO grades (id, subject, grade, out_of, coefficient, date, comment, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      grade.id, grade.subject?.name,
      grade.grade, grade.outOf, grade.coefficient || 1,
      grade.date, grade.comment || '', 1
    );
  }
 
  return events;
}
 
// Détecte les évaluations à venir (pour préparer la saisie de prédiction)
export function detectUpcomingEvals(homeworks: any[], timetable: any[]): any[] {
  const EVAL_KEYWORDS = ['contrôle', 'interrogation', 'évaluation', 'ds ', 'examen', 'test '];
  const evals: any[] = [];
  const today = new Date().toISOString().split('T')[0];
 
  // Source 1 : devoirs avec mots-clés d'évaluation dans la description
  for (const hw of homeworks) {
    const desc = (hw.description || '').toLowerCase();
    if (EVAL_KEYWORDS.some(k => desc.includes(k))) {
      evals.push({ source: 'homework', subject: hw.subject?.name, date: hw.dueDate, id: hw.id });
    }
  }
 
  // Source 2 : créneaux EDT avec statut d'examen ET dont la date est aujourd'hui
  for (const slot of timetable) {
    if (isExamStatus(slot.status) && slot.date === today) {
      evals.push({ source: 'timetable', subject: slot.subject?.name, date: slot.date, id: slot.id });
    }
  }
 
  return evals;
}
