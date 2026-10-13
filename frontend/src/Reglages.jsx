import { useEffect, useState } from 'react'
import { post, api, del } from './api.js'
import ChoixClasseur from './ChoixClasseur.jsx'
import { accord } from './classement.js'

export default function Reglages({ mandats, mandatId, classeurs, onChange }) {
  const [cats, setCats] = useState([])
  const [regles, setRegles] = useState([])
  const [m, setM] = useState({ nom: '', debut: '', fin: '', copier: true })
  const [c, setC] = useState({ categorieId: '', nom: '' })
  const [r, setR] = useState({ motif: '', classeurId: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { api('/categories').then(setCats) }, [])
  const chargerRegles = () => mandatId && api('/regles?mandatId=' + mandatId).then(setRegles)
  useEffect(() => { chargerRegles() }, [mandatId])

  // affiche l'erreur du serveur (nom déjà pris, motif trop court…) au lieu d'échouer en silence
  const essayer = (fn) => async (e) => {
    e?.preventDefault()
    try { setMsg(await fn() || '') } catch (err) { setMsg('Erreur : ' + err.message) }
  }

  const creerMandat = essayer(async () => {
    await post('/mandats', { nom: m.nom, debut: m.debut, fin: m.fin, copierClasseursDe: m.copier ? mandatId : null })
    setM({ nom: '', debut: '', fin: '', copier: true }); onChange()
    return `Mandat « ${m.nom} » créé.`
  })
  const creerClasseur = essayer(async () => {
    await post('/classeurs', { mandatId, categorieId: Number(c.categorieId), nom: c.nom })
    setC({ ...c, nom: '' }); onChange()
    return `Classeur « ${c.nom} » ajouté.`
  })
  const creerRegle = essayer(async () => {
    await post('/regles', { classeurId: Number(r.classeurId), motif: r.motif })
    setR({ ...r, motif: '' }); chargerRegles()
    return `Règle « ${r.motif.trim()} » ajoutée.`
  })
  const supprimerRegle = (id) => essayer(async () => { await del('/regles/' + id); chargerRegles() })()
  const appliquer = essayer(async () => {
    const res = await post('/operations/auto-classer?mandatId=' + mandatId)
    return `${accord(res.classees, 'ligne classée', 'lignes classées')} automatiquement (à vérifier dans Transactions), `
      + `${res.restantes} encore à classer.`
  })

  return (
    <section className="reglages">
      {msg && <p className="msg">{msg}</p>}
      <h2>Règles de classement automatique</h2>
      <p className="aide">
        À l'import, une transaction dont le motif ou la nature contient ce texte (sans tenir compte des majuscules
        ni des accents) est rangée dans le classeur choisi, puis marquée « à vérifier ». Sans règle, l'application
        s'inspire des transactions déjà classées à la main.
      </p>
      <form onSubmit={creerRegle} className="barre">
        <input placeholder="Le motif contient… (ex. HELLOASSO)" required minLength={3} value={r.motif} size={32}
               onChange={(e) => setR({ ...r, motif: e.target.value })} />
        <ChoixClasseur classeurs={classeurs} valeur={r.classeurId} onChange={(v) => setR({ ...r, classeurId: v })} />
        <button disabled={!r.classeurId}>Ajouter la règle</button>
      </form>
      {regles.length > 0 && (
        <table className="regles">
          <thead><tr><th>Si le motif contient</th><th>Ranger dans</th><th></th></tr></thead>
          <tbody>
          {regles.map((g) => (
            <tr key={g.id}>
              <td><strong>{g.motif}</strong></td>
              <td>{g.categorie_nom} › {g.classeur_nom}</td>
              <td className="actions"><button className="danger" onClick={() => supprimerRegle(g.id)}>Supprimer</button></td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
      <p><button className="secondaire" onClick={appliquer}>🤖 Appliquer aux lignes à classer</button></p>

      <h2>Nouveau mandat</h2>
      <form onSubmit={creerMandat} className="barre">
        <input placeholder="2026 - 2027" required value={m.nom} onChange={(e) => setM({ ...m, nom: e.target.value })} />
        <input type="date" required value={m.debut} onChange={(e) => setM({ ...m, debut: e.target.value })} />
        <input type="date" required value={m.fin} onChange={(e) => setM({ ...m, fin: e.target.value })} />
        <label><input type="checkbox" checked={m.copier} onChange={(e) => setM({ ...m, copier: e.target.checked })} /> Reprendre les classeurs (et leurs règles) du mandat sélectionné</label>
        <button>Créer</button>
      </form>

      <h2>Ajouter un classeur au mandat sélectionné</h2>
      <form onSubmit={creerClasseur} className="barre">
        <select required value={c.categorieId} onChange={(e) => setC({ ...c, categorieId: e.target.value })}>
          <option value="">Catégorie…</option>
          {cats.map((k) => <option key={k.id} value={k.id}>{k.nom}</option>)}
        </select>
        <input placeholder="Nom du classeur" required value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} />
        <button>Ajouter</button>
      </form>
      <p>{classeurs.length} classeurs dans ce mandat.</p>
    </section>
  )
}
