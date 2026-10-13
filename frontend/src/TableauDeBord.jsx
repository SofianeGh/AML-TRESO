import {useEffect, useRef, useState} from 'react'
import {api, euro} from './api.js'

const BLEU = '#2b5fd9', ROUGE = '#c0392b'
const JOUR = 864e5

// Graduations « rondes » (pas de 1, 2, 2,5 ou 5 × 10^n) couvrant [min, max]
export function graduations(min, max, n = 5) {
    if (min === max) max = min + 1
    const brut = (max - min) / n
    const p = 10 ** Math.floor(Math.log10(brut))
    const pas = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= brut)
    const out = []
    for (let v = Math.floor(min / pas) * pas; v <= Math.ceil(max / pas) * pas + pas / 1000; v += pas)
        out.push(Math.round(v * 100) / 100)
    return out
}

const compact = (n) => new Intl.NumberFormat('fr-FR', {notation: 'compact', maximumFractionDigits: 1}).format(n) + ' €'
const dateLongue = (ms) => new Date(ms).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})

function CourbeSolde({points}) {
    const W = 800, H = 240, G = 64, D = 84, HAUT = 16, BAS = 28
    const ref = useRef(null)
    const [survol, setSurvol] = useState(null)

    const t = points.map((p) => new Date(p.date).getTime())
    const v = points.map((p) => Number(p.solde))
    const t0 = t[0], t1 = Math.max(t[t.length - 1], t0 + JOUR)
    const ticks = graduations(Math.min(0, ...v), Math.max(0, ...v))
    const y0 = ticks[0], y1 = ticks[ticks.length - 1]
    const x = (ti) => G + (ti - t0) / (t1 - t0) * (W - G - D)
    const y = (vi) => HAUT + (y1 - vi) / (y1 - y0) * (H - HAUT - BAS)

    // Le solde ne bouge qu'aux dates d'opération : courbe en escalier
    let trace = `M${x(t[0])},${y(v[0])}`
    for (let i = 1; i < t.length; i++) trace += `H${x(t[i])}V${y(v[i])}`
    const aire = `${trace}V${y(0)}H${x(t[0])}Z`

    // Un libellé par mois, centré sur la partie du mois couverte ; un trait à chaque changement de mois
    const mois = []
    for (let m = Date.UTC(new Date(t0).getUTCFullYear(), new Date(t0).getUTCMonth(), 1); m <= t1;) {
        const suivant = Date.UTC(new Date(m).getUTCFullYear(), new Date(m).getUTCMonth() + 1, 1)
        const a = Math.max(m, t0), b = Math.min(suivant, t1)
        mois.push({m, debut: m > t0, centre: (x(a) + x(b)) / 2, assez: b - a >= 5 * JOUR})
        m = suivant
    }

    const viser = (clientX) => {
        const r = ref.current.getBoundingClientRect()
        const xv = (clientX - r.left) * W / r.width
        let i = 0
        for (let k = 1; k < t.length; k++) if (Math.abs(x(t[k]) - xv) < Math.abs(x(t[i]) - xv)) i = k
        setSurvol(i)
    }
    const clavier = (e) => {
        if (e.key === 'ArrowRight') setSurvol((s) => Math.min(t.length - 1, (s ?? -1) + 1))
        if (e.key === 'ArrowLeft') setSurvol((s) => Math.max(0, (s ?? t.length) - 1))
    }
    const dernier = t.length - 1

    return (
        <div className="courbe">
            <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0}
                 aria-label={`Évolution du solde, de ${euro(v[0])} le ${dateLongue(t0)} à ${euro(v[dernier])} le ${dateLongue(t[dernier])}`}
                 onPointerMove={(e) => viser(e.clientX)} onPointerLeave={() => setSurvol(null)}
                 onKeyDown={clavier} onBlur={() => setSurvol(null)}>
                {ticks.map((g) => (
                    <g key={g}>
                        <line x1={G} x2={W - D} y1={y(g)} y2={y(g)} className={g === 0 ? 'axe-zero' : 'grille'}/>
                        <text x={G - 8} y={y(g)} className="graduation" textAnchor="end" dominantBaseline="middle">{compact(g)}</text>
                    </g>
                ))}
                {mois.map(({m, debut, centre, assez}) => (
                    <g key={m}>
                        {debut && <line x1={x(m)} x2={x(m)} y1={H - BAS} y2={H - BAS + 5} className="axe-zero"/>}
                        {assez && <text x={centre} y={H - 8} className="graduation" textAnchor="middle">
                            {new Date(m).toLocaleDateString('fr-FR', {month: 'short', timeZone: 'UTC'})}
                        </text>}
                    </g>
                ))}
                <path d={aire} fill={BLEU} opacity="0.1"/>
                <path d={trace} fill="none" stroke={BLEU} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                <circle cx={x(t[dernier])} cy={y(v[dernier])} r="4" fill={BLEU} stroke="#fff" strokeWidth="2"/>
                <text x={x(t[dernier]) + 10} y={y(v[dernier])} className="etiquette-fin" dominantBaseline="middle">
                    {euro(v[dernier])}
                </text>
                {survol !== null && (
                    <g>
                        <line x1={x(t[survol])} x2={x(t[survol])} y1={HAUT} y2={H - BAS} className="viseur"/>
                        <circle cx={x(t[survol])} cy={y(v[survol])} r="5" fill={BLEU} stroke="#fff" strokeWidth="2"/>
                    </g>
                )}
            </svg>
            {survol !== null && (
                <div className="infobulle" style={{left: `${x(t[survol]) / W * 100}%`, top: `${y(v[survol]) / H * 100}%`}}>
                    <strong>{euro(v[survol])}</strong>
                    <span>{dateLongue(t[survol])}</span>
                </div>
            )}
            <details>
                <summary>Voir les données</summary>
                <table>
                    <thead><tr><th>Date</th><th className="num">Solde cumulé</th></tr></thead>
                    <tbody>{points.map((p) => <tr key={p.date}><td>{p.date}</td><td className="num">{euro(p.solde)}</td></tr>)}</tbody>
                </table>
            </details>
        </div>
    )
}

function Barres({titre, lignes, champ, couleur}) {
    const data = lignes.map((l) => ({nom: l.categorie, v: Number(l[champ])})).filter((d) => d.v > 0)
        .sort((a, b) => b.v - a.v)
    const max = Math.max(0, ...data.map((d) => d.v))
    const total = data.reduce((s, d) => s + d.v, 0)
    return (
        <div className="carte">
            <h3>{titre}</h3>
            {data.length === 0 ? <p className="aide">Rien pour l'instant.</p> : (
                <ul className="barres">
                    {data.map((d) => (
                        <li key={d.nom}>
                            <span className="barre-nom">{d.nom}</span>
                            <span className="barre-piste">
                                <span className="barre-valeur" style={{width: `calc((100% - 150px) * ${d.v / max})`, background: couleur}}/>
                                <span className="barre-chiffre">{euro(d.v)} <span className="muet">{Math.round(d.v / total * 100)} %</span></span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

const ALERTES = [
    ['a_classer', 'a-classer', 'à classer', 'Tout est classé'],
    ['a_verifier', 'a-verifier', 'classées automatiquement, à vérifier', 'Aucun classement automatique à vérifier'],
    ['sans_justificatif', 'sans-justificatif', 'dépenses sans justificatif', 'Toutes les dépenses ont un justificatif'],
]

export default function TableauDeBord({mandatId, onVoir}) {
    const [tdb, setTdb] = useState(null)
    const [chargement, setChargement] = useState(true)
    useEffect(() => {
        setChargement(true)
        api('/tableau-de-bord?mandatId=' + mandatId).then(setTdb).finally(() => setChargement(false))
    }, [mandatId])
    if (!tdb) return <p>Chargement…</p>

    if (Number(tdb.nb) === 0) return (
        <section className="tdb">
            <p className="msg">Aucune transaction dans ce mandat pour l'instant.
                <button className="lien" onClick={() => onVoir('')}>Importer un relevé →</button></p>
        </section>
    )

    const resultat = Number(tdb.recettes) + Number(tdb.depenses)
    const tuiles = [
        ['Solde des opérations', euro(tdb.solde), `${tdb.nb} transactions importées`],
        ['Recettes', euro(tdb.recettes), 'hors mouvements internes'],
        ['Dépenses', euro(-tdb.depenses), 'hors mouvements internes'],
        ['Résultat', euro(resultat), resultat >= 0 ? 'excédent, lignes non classées comprises' : 'déficit, lignes non classées comprises'],
    ]

    return (
        <section className="tdb" style={{opacity: chargement ? 0.5 : 1}}>
            <div className="tuiles">
                {tuiles.map(([l, val, sous]) => (
                    <div key={l} className="tuile">
                        <span className="tuile-libelle">{l}</span>
                        <span className="tuile-valeur">{val}</span>
                        <span className="aide">{sous}</span>
                    </div>
                ))}
            </div>

            <div className="alertes">
                {ALERTES.map(([cle, filtre, libelle, rien]) => {
                    const n = Number(tdb[cle])
                    return n > 0
                        ? <button key={cle} className="alerte attention" onClick={() => onVoir(filtre)}>
                            <span aria-hidden="true">⚠️</span> <strong>{n}</strong> {libelle} <span className="voir">Voir →</span>
                        </button>
                        : <div key={cle} className="alerte bon"><span aria-hidden="true">✅</span> {rien}</div>
                })}
            </div>

            <div className="carte">
                <h3>Évolution du solde</h3>
                <p className="aide">Cumul des opérations importées depuis le début du mandat.</p>
                <CourbeSolde points={tdb.courbe}/>
            </div>

            <div className="grille-2">
                <Barres titre="Dépenses par catégorie" lignes={tdb.parCategorie} champ="depenses" couleur={ROUGE}/>
                <Barres titre="Recettes par catégorie" lignes={tdb.parCategorie} champ="recettes" couleur={BLEU}/>
            </div>
        </section>
    )
}
