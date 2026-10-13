// Mots présents dans presque tous les libellés bancaires : inutiles pour une règle
const MOTS_BANCAIRES = new Set(['CARTE', 'VIR', 'VIREMENT', 'SEPA', 'RECU', 'EMIS', 'PRLV', 'PRELEVEMENT', 'PAIEMENT',
    'ACHAT', 'RETRAIT', 'DAB', 'REMISE', 'VERSEMENT', 'DE', 'DU', 'LA', 'LE', 'A'])

// Texte proposé pour une nouvelle règle : « CARTE X4481 05/10 METRO CASH » -> « METRO CASH »
export const motCleSuggere = (libelle = '') =>
    libelle.split(/[\s/]+/)
        .filter((m) => m && !/\d/.test(m) && !MOTS_BANCAIRES.has(m.toUpperCase()))
        .slice(0, 3).join(' ')

// Filtres de la liste des transactions -> paramètre de l'API
export const FILTRES = [
    ['', 'Toutes les transactions', null],
    ['a-classer', 'À classer', 'aClasser'],
    ['a-verifier', 'À vérifier (classées automatiquement)', 'aVerifier'],
    ['sans-justificatif', 'Dépenses sans justificatif', 'sansJustificatif'],
]
export const urlOperations = (mandatId, mois, filtre) => {
    const param = FILTRES.find(([k]) => k === filtre)?.[2]
    return `/operations?mandatId=${mandatId}&mois=${mois}` + (param ? `&${param}=true` : '')
}

// « 0 ajoutée », « 1 ajoutée », « 2 ajoutées »
export const accord = (n, singulier, pluriel) => `${n} ${n > 1 ? pluriel : singulier}`
