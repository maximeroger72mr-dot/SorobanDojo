/**
 * Petits utilitaires DOM, pour écrire les écrans sans framework.
 *
 *   h('button', { class: 'principal', onclick: f }, 'Valider')
 */
export function h(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v; // réservé à des textes écrits dans le code, jamais à une saisie
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of enfants.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

/** Formate une durée en secondes, à la française : 3,4 s */
export function formaterDuree(ms) {
  return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;
}

/** Formate un nombre avec espaces de milliers : 12 345 */
export function formaterNombre(n) {
  return n.toLocaleString('fr-FR');
}

/** Pourcentage arrondi : 87 % */
export function formaterPourcent(justes, total) {
  return total ? `${Math.round((100 * justes) / total)} %` : '—';
}

/**
 * Raccourcis clavier actifs tant que l'écran est affiché.
 * Renvoie une fonction qui les supprime.
 */
export function raccourcis(table) {
  const f = (e) => {
    const action = table[e.key];
    if (!action) return;
    // Une fenêtre de démonstration ouverte garde le clavier pour elle.
    if (document.querySelector('dialog[open]')) return;
    // Entrée dans un champ de saisie : on laisse l'écran décider (il passe la touche ici volontairement).
    if (action(e) !== false) e.preventDefault();
  };
  window.addEventListener('keydown', f);
  return () => window.removeEventListener('keydown', f);
}

/**
 * Remplace le contenu d'un élément, en ignorant les valeurs vides (null, undefined, false).
 * À utiliser à la place de element.replaceChildren(), qui afficherait « null ».
 */
export function remplir(el, ...enfants) {
  el?.replaceChildren(...enfants.flat().filter((c) => c != null && c !== false));
}
