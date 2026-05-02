// src/api.ts
import express from 'express';
import db, { getSetting, setSetting } from './database';
import * as Pronote from './pronote';
import { summarizeHomeworks, calculateComplexity } from './ai';
 
const router = express.Router();
 
// ── Routes de données ─────────────────────────────────────────────────
 
// GET /api/timetable?week=0
// Retourne l'EDT de la semaine (0 = actuelle, 1 = prochaine)
router.get('/timetable', async (req, res) => {
  try {
    const offset = parseInt(req.query.week as string || '0');
    const slots = await Pronote.fetchTimetable(offset);
    res.json({ success: true, data: slots });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
 
// GET /api/grades
router.get('/grades', async (req, res) => {
  try {
    const grades = await Pronote.fetchGrades();
    res.json({ success: true, data: grades });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
 
// GET /api/homeworks
router.get('/homeworks', async (req, res) => {
  try {
    const homeworks = await Pronote.fetchHomeworks();
    res.json({ success: true, data: homeworks });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
 
// GET /api/messages
router.get('/messages', async (req, res) => {
  try {
    const messages = await Pronote.fetchMessages();
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
 
// ── Routes IA ─────────────────────────────────────────────────────────
 
// GET /api/ai/summary — Résumé IA des devoirs
router.get('/ai/summary', async (req, res) => {
  try {
    const homeworks = await Pronote.fetchHomeworks();
    const hwList = homeworks.map((h: any) => ({
      subject: h.subject?.name || '',
      description: h.description || '',
      dueDate: h.dueDate,
      done: h.done || false,
    }));
    const summary = await summarizeHomeworks(hwList);
    res.json({ success: true, data: { summary } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
 
// GET /api/ai/complexity — Score de complexité
router.get('/ai/complexity', async (req, res) => {
  try {
    const [homeworks, grades] = await Promise.all([
      Pronote.fetchHomeworks(),
      Pronote.fetchGrades(),
    ]);
    const hwList = homeworks.map((h: any) => ({
      subject: h.subject?.name || '', description: h.description || '',
      dueDate: h.dueDate, done: h.done || false,
    }));
    const gradeList = grades.map((g: any) => ({
      subject: g.subject?.name || '', grade: g.grade, outOf: g.outOf, coefficient: g.coefficient || 1,
    }));
    const score = calculateComplexity(hwList, gradeList);
    res.json({ success: true, data: score });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
 
// ── Routes paramètres ─────────────────────────────────────────────────
 
// POST /api/settings — Met à jour un paramètre
router.post('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ success: false, error: 'key et value requis' });
  }
  setSetting(key, String(value));
  res.json({ success: true });
});
 
// POST /api/prediction — Enregistre une prédiction de note
router.post('/prediction', (req, res) => {
  const { evalId, prediction } = req.body;
  if (!evalId || prediction === undefined) {
    return res.status(400).json({ success: false, error: 'evalId et prediction requis' });
  }
  db.prepare(
    'UPDATE grade_predictions SET prediction = ? WHERE eval_id = ?'
  ).run(parseFloat(prediction), evalId);
  res.json({ success: true });
});
 
export default router;
