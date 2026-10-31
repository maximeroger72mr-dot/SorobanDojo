/**
 * Suivi de progression, sauvegardé localement.
 *
 * Dans l'application Electron, les données vont dans un fichier JSON (voir main.cjs).
 * Ouverte dans un simple navigateur (développement), l'appli se rabat sur localStorage.
 *
 * Structure des données (version 1) :
 * {
 *   version: 1,
 *   lecons:   { [idLecon]: { terminee: true, date: 'AAAA-MM-JJ' } },
 *   sessions: [ { date, module, mode, reglages, total, justes, dureeMs, erreurs: [...] } ],
 *   records:  { [cleDefi]: { dureeMs, date } }
 * }
 */

const VERSION = 1;
const CLE_LOCALE = 'soroban-progression';

const vide = () => ({ version: VERSION, lecons: {}, sessions: [], records: {} });

let donnees = vide();

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function aujourdhui(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const backend = typeof window !== 'undefined' && window.stockage
  ? window.stockage
  : {
    lire: async () => JSON.parse(globalThis.localStorage?.getItem(CLE_LOCALE) ?? 'null'),
    ecrire: async (d) => globalThis.localStorage?.setItem(CLE_LOCALE, JSON.stringify(d)),
  };

/** À appeler une fois au démarrage. */
export async function chargerProgression() {
  const lu = await backend.lire();
  donnees = lu && lu.version === VERSION ? { ...vide(), ...lu } : vide();
  return donnees;
}

async function sauver() {
  await backend.ecrire(donnees);
}

export function progression() {
  return donnees;
}

/**
 * Enregistre une série d'exercices terminée.
 * @param {{module:string, mode?:string, reglages?:object, total:number, justes:number, dureeMs:number, erreurs?:Array}} s
 */
export async function enregistrerSession(s) {
  donnees.sessions.push({ date: aujourdhui(), horodatage: Date.now(), ...s });
  await sauver();
}

export async function marquerLecon(id) {
  donnees.lecons[id] = { terminee: true, date: aujourdhui() };
  await sauver();
}

/** Enregistre un temps si c'est un record ; renvoie true si nouveau record. */
export async function proposerRecord(cle, dureeMs) {
  const actuel = donnees.records[cle];
  if (actuel && actuel.dureeMs <= dureeMs) return false;
  donnees.records[cle] = { dureeMs, date: aujourdhui() };
  await sauver();
  return true;
}

/** Statistiques agrégées, par module et par jour. */
export function statistiques() {
  const parModule = {};
  const parJour = {};
  for (const s of donnees.sessions) {
    for (const [cle, table] of [[s.module, parModule], [s.date, parJour]]) {
      const t = (table[cle] ??= { sessions: 0, total: 0, justes: 0, dureeMs: 0 });
      t.sessions += 1;
      t.total += s.total;
      t.justes += s.justes;
      t.dureeMs += s.dureeMs;
    }
  }
  return { parModule, parJour };
}
