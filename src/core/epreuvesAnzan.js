/**
 * Épreuves d'anzan (暗算能力検定, Ligue japonaise du soroban) : tout se calcule de tête, soroban rangé.
 *
 * Format trouvé dans des sources NON officielles (voir AUDIT-PARCOURS.md) :
 *  - 1er au 6e kyū : 20 additions/soustractions, 30 multiplications, 30 divisions, 12 minutes ;
 *  - 7e au 10e kyū : 50 additions à 1 chiffre, 12 minutes ;
 *  - 500 points ; réussite à 400 (1er au 7e), 350 (8e), 300 (9e), 250 (10e) ;
 *  - × et ÷ : 5 chiffres au total au 1er kyū, 4 aux 2e et 3e, 3 du 4e au 6e.
 * Le reste (longueur des colonnes, répartition des points entre les parties) n'est pas donné par
 * ces sources : il est RECONSTITUÉ ici pour que chaque grade soit plus exigeant que le précédent.
 * Tous les grades portent donc verifie: false, et l'écran affiche « format indicatif ».
 */

import { genererMitori, genererMulGrade, genererDivGrade } from './epreuves.js';

const seul = (lignes, soustractions = false) => ({ nb: 50, lignes, min: 1, max: 1, soustractions, points: 10 });
const complet = (lignes, chiffres, total) => ({
  mitori: { nb: 20, lignes, min: chiffres, max: chiffres, soustractions: true, points: 10 },
  mul: { nb: 30, total, court: 1, points: 5 },
  div: { nb: 30, total, court: 1, points: 5, maxDiviseur: 2 },
});

export const GRADES_ANZAN = [
  { id: 'a10', nom: '10e kyū d\'anzan', japonais: '暗算10級', minutes: 12, seuil: 250 / 500, verifie: false, mitori: seul(3) },
  { id: 'a9', nom: '9e kyū d\'anzan', japonais: '暗算9級', minutes: 12, seuil: 300 / 500, verifie: false, mitori: seul(4) },
  { id: 'a8', nom: '8e kyū d\'anzan', japonais: '暗算8級', minutes: 12, seuil: 350 / 500, verifie: false, mitori: seul(5) },
  { id: 'a7', nom: '7e kyū d\'anzan', japonais: '暗算7級', minutes: 12, seuil: 400 / 500, verifie: false, mitori: seul(6) },
  { id: 'a6', nom: '6e kyū d\'anzan', japonais: '暗算6級', minutes: 12, seuil: 400 / 500, verifie: false, ...complet(4, 1, 3) },
  { id: 'a5', nom: '5e kyū d\'anzan', japonais: '暗算5級', minutes: 12, seuil: 400 / 500, verifie: false, ...complet(5, 1, 3) },
  { id: 'a4', nom: '4e kyū d\'anzan', japonais: '暗算4級', minutes: 12, seuil: 400 / 500, verifie: false, ...complet(3, 2, 3) },
  { id: 'a3', nom: '3e kyū d\'anzan', japonais: '暗算3級', minutes: 12, seuil: 400 / 500, verifie: false, ...complet(4, 2, 4) },
  { id: 'a2', nom: '2e kyū d\'anzan', japonais: '暗算2級', minutes: 12, seuil: 400 / 500, verifie: false, ...complet(5, 2, 4) },
  { id: 'a1', nom: '1er kyū d\'anzan', japonais: '暗算1級', minutes: 12, seuil: 400 / 500, verifie: false, ...complet(4, 3, 5) },
];

/** Série sans deux problèmes identiques (30 essais par problème, puis on accepte). */
function serie(nb, gen, cle) {
  const vus = new Set();
  return Array.from({ length: nb }, () => {
    let p;
    for (let e = 0; e < 30; e++) { p = gen(); if (!vus.has(cle(p))) break; }
    vus.add(cle(p));
    return p;
  });
}

/** Sujet d'anzan : les problèmes sont marques `mental` (aucune explication au soroban). */
export function genererSujetAnzan(grade) {
  const sections = [];
  const m = grade.mitori;
  sections.push({ cle: 'mitori', titre: 'Additions et soustractions de tête (見取暗算)', points: m.points,
    problemes: serie(m.nb, () => genererMitori(m), (p) => p.lignes.map((l) => `${l.op}${l.n}`).join()) });
  if (grade.mul) sections.push({ cle: 'mul', titre: 'Multiplications de tête (乗暗算)', points: grade.mul.points, problemes: serie(grade.mul.nb, () => genererMulGrade(grade.mul), (p) => `${p.a}|${p.b}`) });
  if (grade.div) sections.push({ cle: 'div', titre: 'Divisions de tête (除暗算)', points: grade.div.points, problemes: serie(grade.div.nb, () => genererDivGrade(grade.div), (p) => `${p.a}|${p.b}`) });
  return { grade, sections };
}

export const totalPointsAnzan = (g) => ['mitori', 'mul', 'div'].reduce((s, k) => s + (g[k] ? g[k].nb * g[k].points : 0), 0);
