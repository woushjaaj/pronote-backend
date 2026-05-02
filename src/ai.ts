// src/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
 
interface HomeworkItem {
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
}
 
interface GradeItem {
  subject: string;
  grade: number;
  outOf: number;
  coefficient: number;
}
 
 
// ── Résumé IA des devoirs ─────────────────────────────────────────────
// Envoie la liste des devoirs à Claude et retourne un résumé clair
 
export async function summarizeHomeworks(homeworks: HomeworkItem[]): Promise<string> {
  const pending = homeworks.filter(h => !h.done);
  if (pending.length === 0) return 'Aucun devoir en attente. 🎉';
 
  const listText = pending.map(h =>
    `- ${h.subject} (pour le ${new Date(h.dueDate).toLocaleDateString('fr-FR')}) : ${h.description}`
  ).join('\n');
 
  const prompt = `Tu es un assistant scolaire bienveillant. Voici les devoirs à faire :\n${listText}\n\n`
    + `Fais un résumé en français, court (4-6 phrases max), des travaux à faire. `
    + `Mets en avant les priorités selon les dates. Sois encourageant et concis. `
    + `Ne fais PAS de liste à puces, écris en prose naturelle.`;
 
  const result = await model.generateContent(prompt);
  return result.response.text() || 'Résumé indisponible.';
}
 
 
// ── Score de complexité ───────────────────────────────────────────────
// Calcule localement un score de charge de travail sans appel API
 
export interface ComplexityScore {
  bySubject: Record<string, number>;  // score par matière (0-20)
  total: number;                      // score global (0-100)
  label: string;                      // 'Tranquille', 'Chargé', 'Intense'
  emoji: string;
}
 
export function calculateComplexity(
  homeworks: HomeworkItem[],
  grades: GradeItem[]
): ComplexityScore {
  const pending = homeworks.filter(h => !h.done);
  const scoreBySubject: Record<string, number> = {};
 
  for (const hw of pending) {
    const subject = hw.subject;
 
    // Facteur 1 — Urgence : combien de jours avant la deadline ?
    // Plus c'est proche, plus le score est élevé
    const daysLeft = Math.max(0, daysBetween(new Date(), new Date(hw.dueDate)));
    const urgency = daysLeft === 0 ? 10 : daysLeft === 1 ? 7 : daysLeft <= 3 ? 4 : daysLeft <= 7 ? 2 : 0;
 
    // Facteur 2 — Moyenne : une matière où tu es en difficulté pèse plus
    const avg = getSubjectAverage(grades, subject);
    const gradeStress = avg === null ? 2 : avg < 8 ? 5 : avg < 11 ? 3 : avg < 14 ? 1 : 0;
 
    // Facteur 3 — Longueur de la description (indice de complexité de la tâche)
    const descScore = Math.min(4, Math.floor(hw.description.length / 60));
 
    // Score pour ce devoir
    const hwScore = urgency + gradeStress + descScore;
    scoreBySubject[subject] = (scoreBySubject[subject] || 0) + hwScore;
  }
 
  // Score global : moyenne des scores par matière, normalisée sur 100
  const values = Object.values(scoreBySubject);
  const rawTotal = values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
  const total = Math.min(100, Math.round(rawTotal * 5));
 
  const label = total < 30 ? 'Tranquille' : total < 60 ? 'Chargé' : 'Intense';
  const emoji = total < 30 ? '😌' : total < 60 ? '📚' : '🔥';
 
  return { bySubject: scoreBySubject, total, label, emoji };
}
 
// Calcule la moyenne d'une matière depuis les notes récentes
function getSubjectAverage(grades: GradeItem[], subject: string): number | null {
  const subjectGrades = grades.filter(g => g.subject === subject);
  if (subjectGrades.length === 0) return null;
 
  const sum = subjectGrades.reduce((acc, g) => acc + (g.grade / g.outOf) * 20 * g.coefficient, 0);
  const coeffSum = subjectGrades.reduce((acc, g) => acc + g.coefficient, 0);
  return sum / coeffSum;
}
 
// Calcule le nombre de jours entre deux dates
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
