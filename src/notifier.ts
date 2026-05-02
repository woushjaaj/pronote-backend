// src/notifier.ts
import axios from 'axios';
import { TimetableEvent, GradeEvent } from './detector';
 
// Fonction de base : envoie une notif à ntfy.sh
async function send(opts: {
  title: string;
  body: string;
  tags?: string[];
  priority?: 1 | 2 | 3 | 4 | 5; // 1=min, 3=défaut, 5=urgent
}) {
  const url = `${process.env.NTFY_URL}/${process.env.NTFY_TOPIC}`;
 
  try {
    await axios.post(url, opts.body, {
      headers: {
        'Title':    opts.title,
        'Tags':     (opts.tags || []).join(','),
        'Priority': String(opts.priority || 3),
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    console.log(`📤 Notif envoyée : ${opts.title}`);
  } catch (err) {
    console.error('❌ Erreur envoi notif :', err);
  }
}
 
// ── Notifications EDT ─────────────────────────────────────────────────
 
export async function notifyTimetableEvent(event: TimetableEvent) {
  const { type, slot, movedTo, statusLabel } = event;
  const subject = slot.subject?.name || 'Cours inconnu';
  const date = formatDate(slot.date);
  const time = `${slot.startTime}–${slot.endTime}`;
  const room = slot.room?.name ? ` (${slot.room.name})` : '';
 
  switch (type) {
    case 'absent':
      await send({
        title: `📚 Cours annulé — ${subject}`,
        body: `${date}, ${time}${room}\nRaison : ${statusLabel}`,
        tags: ['no_entry_sign', 'calendar'],
        priority: 4,
      });
      break;
 
    case 'moved':
      // Affiche les deux créneaux : annulé ET nouveau
      const movedInfo = movedTo
        ? `\n↪️ Nouveau : ${formatDate(movedTo.date)}, ${movedTo.startTime}–${movedTo.endTime}${movedTo.room?.name ? ` (${movedTo.room.name})` : ''}`
        : '\n↪️ Nouveau créneau non trouvé (vérifie l\'EDT)';
      await send({
        title: `🔄 Cours déplacé — ${subject}`,
        body: `❌ Annulé : ${date}, ${time}${room}${movedInfo}`,
        tags: ['arrows_counterclockwise', 'calendar'],
        priority: 4,
      });
      break;
 
    case 'exam':
    case 'exam_by_slots':
      await send({
        title: `📝 Examen/Compo — ${subject}`,
        body: `${date}, ${time}${room}\nStatut : ${statusLabel}`,
        tags: ['pencil', 'warning'],
        priority: 4,
      });
      break;
 
    case 'status_change':
      await send({
        title: `ℹ️ Changement EDT — ${subject}`,
        body: `${date}, ${time}${room}\nNouveau statut : ${statusLabel}`,
        tags: ['information_source'],
        priority: 3,
      });
      break;
  }
}
 
// ── Notification nouvelle note ─────────────────────────────────────────
 
export async function notifyNewGrade(event: GradeEvent) {
  const { grade, prediction } = event;
  const subject = grade.subject?.name || 'Matière inconnue';
  const score = `${grade.grade}/${grade.outOf}`;
 
  let body = `${subject} : ${score}`;
  if (grade.coefficient && grade.coefficient !== 1) body += ` (coef. ${grade.coefficient})`;
  if (grade.comment) body += `\nCommentaire : ${grade.comment}`;
 
  // Si une prédiction avait été saisie, affiche la comparaison
  if (prediction !== undefined && prediction !== null) {
    const diff = grade.grade - prediction;
    const sign = diff >= 0 ? '+' : '';
    const emoji = diff >= 0 ? '🎉' : '😅';
    body += `\n\nTa prédiction : ${prediction}/${grade.outOf}`;
    body += `\nÉcart : ${sign}${diff.toFixed(1)} pts ${emoji}`;
  }
 
  await send({
    title: `📊 Nouvelle note — ${subject}`,
    body,
    tags: ['chart_increasing'],
    priority: 4,
  });
}
 
// ── Notification prédiction de note ───────────────────────────────────
// Envoyée le soir après une éval pour inviter l'élève à saisir sa prédiction
 
export async function notifyPredictionPrompt(subject: string, evalDate: string) {
  await send({
    title: `🎯 Comment s'est passée ton éval ? — ${subject}`,
    body: `Tu avais une évaluation de ${subject} le ${formatDate(evalDate)}.\n`
        + `Ouvre l'app pour saisir ta prédiction de note avant que le résultat soit publié !`,
    tags: ['thinking', 'pencil'],
    priority: 3,
  });
}
 
// ── Notification devoir non fait ──────────────────────────────────────
 
export async function notifyUndonHomework(subject: string, description: string, dueDate: string) {
  await send({
    title: `⏰ Devoir non fait — ${subject}`,
    body: `À rendre le ${formatDate(dueDate)}\n${description.slice(0, 150)}${description.length > 150 ? '...' : ''}`,
    tags: ['books', 'warning'],
    priority: 4,
  });
}
 
// ── Notifications vie scolaire ────────────────────────────────────────
 
export async function notifyNewMessage(sender: string, subject: string) {
  await send({
    title: `✉️ Nouveau message — ${sender}`,
    body: `Objet : ${subject}`,
    tags: ['envelope'],
    priority: 3,
  });
}
 
export async function notifyPunishment(type: string, reason: string, date: string) {
  await send({
    title: `⚠️ Nouvelle sanction — ${type}`,
    body: `Motif : ${reason}\nDate : ${formatDate(date)}`,
    tags: ['rotating_light'],
    priority: 5,
  });
}
 
export async function notifyLifeEvent(type: 'absence' | 'retard' | 'infirmerie', date: string, duration?: string) {
  const emojis = { absence: '🏠', retard: '⏱️', infirmerie: '🏥' };
  const labels = { absence: 'Absence enregistrée', retard: 'Retard enregistré', infirmerie: 'Passage infirmerie' };
  await send({
    title: `${emojis[type]} ${labels[type]}`,
    body: `Date : ${formatDate(date)}${duration ? `\nDurée : ${duration}` : ''}`,
    tags: [type === 'absence' ? 'house' : type === 'retard' ? 'clock1' : 'hospital'],
    priority: 4,
  });
}
 
// ── Utilitaire : formater une date en français ─────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return 'date inconnue';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
