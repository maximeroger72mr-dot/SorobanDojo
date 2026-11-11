/**
 * Cadence exacte d'un flash : chaque nombre s'affiche à une échéance calculée depuis le départ
 * (échéance n = départ + n × période), et non au bout d'attentes enchaînées dont les retards
 * s'additionnent. À 0,3 s par nombre, une dérive de 16 ms par nombre fait 5 % d'écart ; ici
 * l'écart ne se cumule pas.
 *
 * Le changement d'affichage est calé sur le rafraîchissement de l'écran (requestAnimationFrame)
 * quand il existe ; sinon (tests, onglet en arrière-plan) sur une minuterie.
 */

const horloge = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Attend l'échéance `t` (millisecondes de l'horloge), au plus près, sans la dépasser d'une image. */
function jusqua(t) {
  return new Promise((ok) => {
    const verifier = () => {
      const reste = t - horloge();
      if (reste <= 1) { ok(); return; }
      // Loin de l'échéance : minuterie ; dans les 20 dernières ms : image par image.
      if (reste > 20 || typeof requestAnimationFrame === 'undefined' || (typeof document !== 'undefined' && document.hidden)) setTimeout(verifier, Math.max(0, reste - 16));
      else requestAnimationFrame(verifier);
    };
    verifier();
  });
}

/**
 * Fait défiler `nombre` éléments à cadence fixe.
 * @param {object} o
 * @param {number} o.periodeMs      durée totale par élément
 * @param {number} o.nombre
 * @param {number} [o.partVisible=0.85]  part de la période pendant laquelle l'élément est affiché
 * @param {(i:number) => void} o.surAfficher
 * @param {(i:number) => void} o.surMasquer
 * @param {() => boolean} [o.interrompu]  renvoie true pour arrêter
 * @returns {Promise<{ fini:boolean, ecartMaxMs:number }>}  écart le plus grand entre une échéance et son affichage réel
 */
export async function cadencer({ periodeMs, nombre, partVisible = 0.85, surAfficher, surMasquer, interrompu = () => false }) {
  const depart = horloge();
  let ecartMaxMs = 0;
  for (let i = 0; i < nombre; i++) {
    await jusqua(depart + i * periodeMs);
    if (interrompu()) return { fini: false, ecartMaxMs };
    ecartMaxMs = Math.max(ecartMaxMs, horloge() - (depart + i * periodeMs));
    surAfficher(i);
    await jusqua(depart + (i + partVisible) * periodeMs);
    if (interrompu()) return { fini: false, ecartMaxMs };
    surMasquer(i);
  }
  await jusqua(depart + nombre * periodeMs);
  return { fini: !interrompu(), ecartMaxMs };
}

/**
 * Affiche un nombre du flash, toujours CENTRÉ au même endroit : le signe moins est posé à gauche
 * du nombre sans le décaler (l'œil n'a pas à se recaler d'un nombre à l'autre).
 */
export function afficherNombreFlash(ecran, texte, negatif = false) {
  const doc = ecran.ownerDocument;
  const nombre = doc.createElement('span');
  nombre.className = 'flash-nombre';
  if (negatif) {
    const signe = doc.createElement('span');
    signe.className = 'flash-signe';
    signe.textContent = '−';
    nombre.append(signe);
  }
  nombre.append(texte);
  ecran.replaceChildren(nombre);
}

/**
 * Décompte avant un flash : trois points qui s'éteignent, petits et discrets. Pas de chiffres :
 * un « 3, 2, 1 » de la taille des nombres se confond avec les nombres à calculer.
 */
export async function decompteFlash(ecran, pasMs = 400, interrompu = () => false) {
  ecran.classList.add('decompte');
  for (const t of ['● ● ●', '● ●', '●']) {
    ecran.textContent = t;
    await new Promise((ok) => setTimeout(ok, pasMs));
    if (interrompu()) break;
  }
  ecran.classList.remove('decompte');
  ecran.textContent = '';
}
