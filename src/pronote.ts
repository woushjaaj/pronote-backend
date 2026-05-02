// src/pronote.ts
import * as Pawnote from 'pawnote';
import { randomUUID } from 'crypto';
import db from './database';

let session: Pawnote.SessionHandle | null = null;

// Récupère ou génère un deviceUUID stable (doit rester le même pour le token)
function getDeviceUUID(): string {
  const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get('device_uuid') as any;
  if (saved) return saved.value;
  const uuid = randomUUID();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('device_uuid', uuid);
  return uuid;
}

async function connect(): Promise<Pawnote.SessionHandle> {
  const s = Pawnote.createSessionHandle();
  const deviceUUID = getDeviceUUID();

  const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get('pawnote_token') as any;

  if (saved) {
    try {
      const tokenData = JSON.parse(saved.value);
      const info = await Pawnote.loginToken(s, { ...tokenData, deviceUUID });
      console.log('🔄 Reconnexion Pronote via token');
      session = s;
      return session;
    } catch {
      console.log('⚠️  Token expiré, reconnexion par identifiants...');
    }
  }

  console.log('🔐 Connexion à Pronote...');
  const info = await Pawnote.loginCredentials(s, {
    url: process.env.PRONOTE_URL!,
    username: process.env.PRONOTE_USERNAME!,
    password: process.env.PRONOTE_PASSWORD!,
    kind: Pawnote.AccountKind.STUDENT,
    deviceUUID,
  });


  // Sauvegarde le token (deviceUUID lié, on le stocke aussi)
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'pawnote_token',
    JSON.stringify({ ...info, deviceUUID })
  );

  console.log('✅ Connecté à Pronote !');
  session = s;
  return session;
}

async function getSession(): Promise<Pawnote.SessionHandle> {
  if (!session) await connect();
  return session!;
}

// Retourne la première période disponible (trimestre/semestre en cours)
function getCurrentPeriod(s: Pawnote.SessionHandle): Pawnote.Period {
  const now = new Date();
  return s.instance.periods.find(p => p.endDate >= now)
    ?? s.instance.periods[s.instance.periods.length - 1];
}

// Emploi du temps
export async function fetchTimetable(weekOffset = 0) {
  const s = await getSession();

  const now = new Date();
  const targetDate = new Date(now.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
  const weekNumber = Pawnote.translateToWeekNumber(targetDate, s.instance!.firstMonday);

  const raw = await Pawnote.timetableFromWeek(s, weekNumber);
  return Pawnote.parseTimetable(s, raw, {
    withCanceledClasses: true,
    withPlannedClasses: true,
    withSuperposedCanceledClasses: true,
  });
}

// Notes
export async function fetchGrades() {
  const s = await getSession();
  const overview = await Pawnote.gradesOverview(s, getCurrentPeriod(s));
  return overview.grades ?? [];
}

// Devoirs (14 jours)
export async function fetchHomeworks() {
  const s = await getSession();

  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const w1 = Pawnote.translateToWeekNumber(now, s.instance!.firstMonday);
  const w2 = Pawnote.translateToWeekNumber(in14, s.instance!.firstMonday);

  const weeks = [...new Set([w1, w2])];
  const results = await Promise.all(weeks.map(w => Pawnote.assignmentsFromWeek(s, w)));
  return results.flat();
}

// Messages
export async function fetchMessages() {
  const s = await getSession();
  return Pawnote.discussions(s);
}

// Sanctions
export async function fetchPunishments() {
  const s = await getSession();
  try {
    const nb = await Pawnote.notebook(s, getCurrentPeriod(s));
    return nb.punishments ?? [];
  } catch {
    return [];
  }
}

// Absences / retards
export async function fetchLifeEvents() {
  const s = await getSession();
  try {
    const nb = await Pawnote.notebook(s, getCurrentPeriod(s));
    return nb.absences ?? [];
  } catch {
    return [];
  }
}