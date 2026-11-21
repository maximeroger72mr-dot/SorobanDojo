/**
 * Cadence exacte d'un flash : chaque nombre s'affiche à une échéance calculée depuis le départ
 * (échéance n = départ + n × période), et non au bout d'attentes enchaînées dont les retards
 * s'additionnent. À 0,3 s par nombre, une dérive de 16 ms par nombre fait 5 % d'écart ; ici
 * l'écart ne se cumule pas.
 *
 * À l'écran (0.40.4), la cadence se compte en images de l'écran (une seule boucle
 * requestAnimationFrame, au moins une image vide entre deux nombres) ; sans affichage (tests,
 * onglet en arrière-plan), sur une minuterie calée sur l'horloge.
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
 * @param {number[]} [o.periodesMs] durée de CHAQUE élément (profil de vitesse) ; remplace periodeMs
 * @param {number} o.nombre
 * @param {number} [o.partVisible=0.85]  part de la période pendant laquelle l'élément est affiché
 * @param {(i:number) => void} o.surAfficher
 * @param {(i:number) => void} o.surMasquer
 * @param {() => boolean} [o.interrompu]  renvoie true pour arrêter
 * @returns {Promise<{ fini:boolean, ecartMaxMs:number }>}  écart le plus grand entre une échéance et son affichage réel
 */
export async function cadencer({ periodeMs, periodesMs = null, nombre, partVisible = 0.85, surAfficher, surMasquer, interrompu = () => false }) {
  // 0.40.4 : à l'écran, la cadence se compte en IMAGES (rafraîchissements), avec au moins une image
  // vide entre deux nombres ; la minuterie ne sert plus que sans affichage (tests, onglet caché).
  if (imagesDisponibles()) {
    const imageMs = await dureeImage();
    return cadencerImages({ periodes: periodesMs ?? Array(nombre).fill(periodeMs), partVisible, surAfficher, surMasquer, interrompu, imageMs });
  }
  if (periodesMs) return cadencerProfil({ periodesMs, partVisible, surAfficher, surMasquer, interrompu });
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
 * 0.40.4 : les éléments sont créés une fois par écran puis réutilisés ; pendant le flash, seuls le
 * texte et la visibilité changent (pas d'allocation ni de remise en page à chaque nombre).
 */
export function afficherNombreFlash(ecran, texte, negatif = false) {
  let f = ecran.__flash;
  if (!f || f.nombre.parentNode !== ecran || ecran.childNodes.length !== 1) {
    const doc = ecran.ownerDocument;
    const nombre = doc.createElement('span');
    nombre.className = 'flash-nombre';
    const signe = doc.createElement('span');
    signe.className = 'flash-signe';
    signe.textContent = '−';
    const chiffres = doc.createTextNode('');
    nombre.append(signe, chiffres);
    ecran.replaceChildren(nombre);
    f = ecran.__flash = { nombre, signe, chiffres };
  }
  f.signe.style.display = negatif ? '' : 'none';
  f.chiffres.data = texte;
  f.nombre.style.visibility = 'visible';
}

/** Masque le nombre du flash sans le retirer (il resservira au nombre suivant). */
export function masquerNombreFlash(ecran) {
  const f = ecran.__flash;
  if (f && f.nombre.parentNode === ecran) f.nombre.style.visibility = 'hidden';
  else ecran.textContent = '';
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

// ---- Cadence en images (0.40.4) -------------------------------------------------------------
// La fréquence mesurée par le navigateur n'est pas fiable à 100 % : elle ne sert qu'à convertir les
// durées voulues en NOMBRES D'IMAGES. Ce qui est garanti l'est en images : au moins une image vide
// réellement affichée entre deux nombres, quelle que soit la fréquence.

/** Images vides au minimum entre deux nombres. */
export const IMAGES_VIDES_MIN = 1;
/** En dessous de 2 images d'écran vide voulues, l'écran est trop lent pour la vitesse : avertissement. */
export const IMAGES_VIDES_CONFORT = 2;

const imagesDisponibles = () => typeof requestAnimationFrame !== 'undefined' && !(typeof document !== 'undefined' && document.hidden);

let imageMsMesuree = null;
/**
 * Durée d'une image de l'écran (ms), mesurée une fois : médiane de 20 intervalles entre deux
 * rafraîchissements, bornée entre 4 ms (240 Hz) et 50 ms. Sans affichage : 1000 / 60.
 */
export function dureeImage() {
  if (imageMsMesuree) return Promise.resolve(imageMsMesuree);
  if (!imagesDisponibles()) return Promise.resolve(1000 / 60);
  return new Promise((ok) => {
    const t = [];
    const pas = (x) => {
      t.push(x);
      if (t.length < 21) { requestAnimationFrame(pas); return; }
      const d = t.slice(1).map((v, i) => v - t[i]).sort((a, b) => a - b);
      imageMsMesuree = Math.max(4, Math.min(50, d[Math.floor(d.length / 2)]));
      ok(imageMsMesuree);
    };
    requestAnimationFrame(pas);
  });
}

/**
 * Découpe une période en images : affichées, puis vides (au moins IMAGES_VIDES_MIN si
 * partVisible < 1). Pur.
 * @returns {{ total:number, visibles:number, vides:number }}
 */
export function decoupageImages(periodeMs, partVisible, imageMs) {
  const total = Math.max(1, Math.round(periodeMs / imageMs));
  if (partVisible >= 1) return { total, visibles: total, vides: 0 };
  const vides = Math.max(IMAGES_VIDES_MIN, Math.round((periodeMs * (1 - partVisible)) / imageMs));
  const visibles = Math.max(1, total - vides);
  return { total: visibles + vides, visibles, vides };
}

/**
 * Écran trop lent pour cette vitesse ? (moins de IMAGES_VIDES_CONFORT images d'écran vide voulues
 * entre deux nombres). Simple avertissement : l'exercice reste possible.
 */
export function ecranTropLent(periodeMs, imageMs, partVisible = 0.85) {
  return partVisible < 1 && (periodeMs * (1 - partVisible)) / imageMs < IMAGES_VIDES_CONFORT;
}

/**
 * Une seule boucle de rafraîchissement : chaque appel est une image. Une image sautée (onglet
 * chargé) compte quand même, pour ne pas ralentir la série ; mais un nombre n'apparaît jamais dans
 * l'image même où le précédent a été masqué : l'écran vide est toujours réellement affiché.
 */
function cadencerImages({ periodes, partVisible, surAfficher, surMasquer, interrompu, imageMs }) {
  const plans = periodes.map((p) => decoupageImages(p, partVisible, imageMs));
  return new Promise((fin) => {
    let i = 0;
    let k = 0;
    let visible = false;
    let t0 = null;
    let tPrec = 0;
    let ideal = 0;
    let ecartMaxMs = 0;
    const afficher = (t) => {
      ecartMaxMs = Math.max(ecartMaxMs, t - (t0 + ideal));
      surAfficher(i);
      visible = true;
    };
    const pas = (t) => {
      if (interrompu()) { fin({ fini: false, ecartMaxMs }); return; }
      if (t0 === null) { t0 = t; tPrec = t; afficher(t); requestAnimationFrame(pas); return; }
      k += Math.max(1, Math.round((t - tPrec) / imageMs));
      tPrec = t;
      const p = plans[i];
      let masqueIci = false;
      if (visible && k >= p.visibles && (p.vides > 0 || k >= p.total)) { surMasquer(i); visible = false; masqueIci = p.vides > 0; }
      if (k >= p.total && !masqueIci) {
        ideal += periodes[i];
        k -= p.total;
        i += 1;
        if (i >= plans.length) { fin({ fini: !interrompu(), ecartMaxMs }); return; }
        afficher(t);
      }
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  });
}

/** Même principe, avec une durée propre à chaque élément (échéances cumulées depuis le départ). */
async function cadencerProfil({ periodesMs, partVisible, surAfficher, surMasquer, interrompu }) {
  const depart = horloge();
  let ecartMaxMs = 0;
  let debut = 0;
  for (let i = 0; i < periodesMs.length; i++) {
    await jusqua(depart + debut);
    if (interrompu()) return { fini: false, ecartMaxMs };
    ecartMaxMs = Math.max(ecartMaxMs, horloge() - (depart + debut));
    surAfficher(i);
    await jusqua(depart + debut + partVisible * periodesMs[i]);
    if (interrompu()) return { fini: false, ecartMaxMs };
    surMasquer(i);
    debut += periodesMs[i];
  }
  await jusqua(depart + debut);
  return { fini: !interrompu(), ecartMaxMs };
}

/** Profils de vitesse d'une série : la durée totale ne change pas, seule sa répartition. */
export const PROFILS_VITESSE = {
  constant: 'vitesse constante',
  accelere: 'qui accélère',
  brusque: 'départ rapide, puis plus lent',
  cloche: 'accélère puis ralentit',
};

/**
 * Durée de chaque élément (ms) pour un profil : du plus lent (1,4 × la moyenne) au plus rapide
 * (0,6 ×), normalisé pour que le total reste nombre × periodeMs.
 */
export function periodesProfil(profil, nombre, periodeMs) {
  if (!PROFILS_VITESSE[profil] || profil === 'constant' || nombre < 2) return Array(nombre).fill(periodeMs);
  const x = (i) => i / (nombre - 1); // 0 au premier, 1 au dernier
  const poids = Array.from({ length: nombre }, (_, i) => (profil === 'accelere' ? 1.4 - 0.8 * x(i)
    : profil === 'brusque' ? 0.6 + 0.8 * x(i)
      : 0.6 + 0.8 * Math.abs(2 * x(i) - 1)));
  const somme = poids.reduce((t, w) => t + w, 0);
  return poids.map((w) => (w * nombre * periodeMs) / somme);
}
