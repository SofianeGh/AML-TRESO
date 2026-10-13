import {useEffect, useState} from 'react'
import {api, post, put, del, upload, euro} from './api.js'
import ChoixClasseur from './ChoixClasseur.jsx'
import {FILTRES, accord, motCleSuggere, urlOperations} from './classement.js'

function Edition({op, mandatId, classeurs, onClose, onChange, annoncer}) {
    const initial = classeurs.find((c) => c.id === op.classeur_id)
    const [categorieId, setCategorieId] = useState(initial?.categorie_id ?? '')
    const [classeurId, setClasseurId] = useState(op.classeur_id ?? '')
    const [commentaire, setCommentaire] = useState(op.commentaire ?? '')
    const [libelle, setLibelle] = useState(op.libelle ?? '')
    const [regle, setRegle] = useState(false)
    const [motifRegle, setMotifRegle] = useState(motCleSuggere(op.libelle))
    const [erreur, setErreur] = useState('')

    const categories = [...new Map(classeurs.map((c) => [c.categorie_id, c.categorie_nom]))]
    const classeursDuDossier = classeurs.filter((c) => c.categorie_id === Number(categorieId))

    const enregistrer = async () => {
        try {
            await put(`/operations/${op.id}`, {
                classeurId: classeurId ? Number(classeurId) : null,
                commentaire,
                libelle
            })
            let texte = 'Transaction enregistrée.', autres = 0
            if (regle && classeurId && motifRegle.trim()) {
                // la nouvelle règle s'applique aussi tout de suite aux lignes encore à classer
                await post('/regles', {classeurId: Number(classeurId), motif: motifRegle})
                autres = (await post(`/operations/auto-classer?mandatId=${mandatId}`)).classees
                texte += ` Règle « ${motifRegle.trim()} » créée`
                    + (autres ? ` : ${accord(autres, 'autre ligne classée', 'autres lignes classées')}.` : '.')
            }
            annoncer(texte, autres > 0)
            onChange()
            onClose()
        } catch (e) {
            setErreur(e.message)
        }
    }
    const ajouterJustif = async (e) => {
        const input = e.target
        const f = input.files[0];
        if (!f) return
        try {
            // enregistre d'abord le classeur et le commentaire choisis, puis envoie le fichier
            await put(`/operations/${op.id}`, {classeurId: Number(classeurId), commentaire, libelle})
            await upload(`/operations/${op.id}/justificatifs`, f)
            setErreur('')
            annoncer('Justificatif envoyé dans Nextcloud.')
            onChange()
        } catch (err) {
            setErreur(err.message)
        }
        input.value = ''
    }

    return (
        <div className="fond" onClick={onClose}>
            <div className="fenetre" onClick={(e) => e.stopPropagation()}>
                <h2>Modifier la transaction</h2>
                <p className="resume">
                    {op.date_operation} — {op.nature} — <strong
                    className={op.montant < 0 ? 'neg' : 'pos'}>{euro(op.montant)}</strong><br/>
                    {op.libelle}
                </p>
                {op.classement_auto && <p className="aide auto">🤖 Classée automatiquement ({op.classement_auto}).
                    « Enregistrer » confirme ce classement.</p>}
                <label>Motif
                    <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)}/>
                </label>
                <label>Dossier (catégorie)
                    <select value={categorieId} onChange={(e) => {
                        setCategorieId(e.target.value);
                        setClasseurId('')
                    }}>
                        <option value="">— choisir —</option>
                        {categories.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
                    </select>
                </label>
                <label>Étiquette (classeur)
                    <select value={classeurId} onChange={(e) => setClasseurId(e.target.value)} disabled={!categorieId}>
                        <option value="">— choisir —</option>
                        {classeursDuDossier.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                </label>
                {classeurId && (
                    <div className="regle">
                        <label className="ligne"><input type="checkbox" checked={regle}
                                                        onChange={(e) => setRegle(e.target.checked)}/>
                            Classer ici automatiquement les transactions qui contiennent :</label>
                        <input type="text" aria-label="Texte de la règle" value={motifRegle} disabled={!regle}
                               onChange={(e) => setMotifRegle(e.target.value)}/>
                    </div>
                )}
                <label>Commentaire
                    <textarea rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}/>
                </label>

                <h3>Justificatifs</h3>
                {op.justificatifs.map((j) => <a key={j.id} href={`/api/justificatifs/${j.id}`} target="_blank"
                                                rel="noreferrer">📎 {j.nom}</a>)}
                {classeurId
                    ? <label className="bouton petit">Ajouter un justificatif<input type="file" hidden
                                                                                    onChange={ajouterJustif}/></label>
                    : <p className="aide">Choisis d'abord une étiquette (classeur) pour pouvoir ajouter un
                        justificatif.</p>}

                {erreur && <p className="msg erreur">{erreur}</p>}
                <div className="boutons">
                    <button className="secondaire" onClick={onClose}>Fermer</button>
                    <button onClick={enregistrer}>Enregistrer</button>
                </div>
            </div>
        </div>
    )
}

export default function Transactions({mandatId, classeurs, filtre, setFiltre}) {
    const [ops, setOps] = useState([])
    const [mois, setMois] = useState('')
    const [msg, setMsg] = useState('')
    const [lienVerif, setLienVerif] = useState(false)
    const [edition, setEdition] = useState(null)
    const [selection, setSelection] = useState(new Set())
    const [classeurGroupe, setClasseurGroupe] = useState('')

    // verif = proposer un raccourci vers les lignes classées automatiquement
    const annoncer = (texte, verif = false) => {
        setMsg(texte)
        setLienVerif(verif)
    }
    const charger = () =>
        api(urlOperations(mandatId, mois, filtre)).then(setOps).catch((e) => annoncer(e.message))
    useEffect(() => {
        charger()
        setSelection(new Set())
    }, [mandatId, mois, filtre])

    const importer = async (e) => {
        const f = e.target.files[0];
        if (!f) return
        try {
            const r = await upload('/operations/import', f, {mandatId})
            annoncer(`${accord(r.ajoutees, 'ajoutée', 'ajoutées')}, `
                + `${accord(r.classeesAuto, 'classée automatiquement', 'classées automatiquement')}, `
                + `${r.aClasser} à classer`
                + (r.doublonsIgnores ? `, ${accord(r.doublonsIgnores, 'doublon ignoré', 'doublons ignorés')}` : '') + '.',
                r.classeesAuto > 0)
            charger()
        } catch (err) {
            annoncer('Erreur : ' + err.message)
        }
        e.target.value = ''
    }
    const autoClasser = async () => {
        try {
            const r = await post(`/operations/auto-classer?mandatId=${mandatId}`)
            annoncer(`${accord(r.classees, 'ligne classée', 'lignes classées')} automatiquement, ${r.restantes} encore à classer.`,
                r.classees > 0)
            charger()
        } catch (err) {
            annoncer('Erreur : ' + err.message)
        }
    }
    const supprimer = async (o) => {
        if (!window.confirm(`Supprimer cette transaction ?\n${o.date_operation} — ${o.libelle} — ${euro(o.montant)}`)) return
        try {
            await del(`/operations/${o.id}`);
            annoncer('Transaction supprimée.');
            charger()
        } catch (err) {
            annoncer('Erreur : ' + err.message)
        }
    }
    const confirmer = async (ids) => {
        try {
            const r = await post('/operations/confirmer', {ids})
            annoncer(`${accord(r.confirmees, 'classement confirmé', 'classements confirmés')}.`)
            setSelection(new Set())
            charger()
        } catch (err) {
            annoncer('Erreur : ' + err.message)
        }
    }
    const classerSelection = async () => {
        try {
            const r = await post('/operations/classer', {ids: [...selection], classeurId: Number(classeurGroupe)})
            annoncer(`${accord(r.modifiees, 'transaction classée', 'transactions classées')} dans ${nomClasseur(Number(classeurGroupe))}.`)
            setSelection(new Set())
            charger()
        } catch (err) {
            annoncer('Erreur : ' + err.message)
        }
    }
    const basculer = (id) => setSelection((s) => {
        const n = new Set(s)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
    })
    const nomClasseur = (id) => {
        const c = classeurs.find((k) => k.id === id)
        return c ? `${c.categorie_nom} › ${c.nom}` : ''
    }
    const total = ops.reduce((s, o) => s + Number(o.montant), 0)
    const opEdit = ops.find((o) => o.id === edition)
    const tous = ops.length > 0 && ops.every((o) => selection.has(o.id))
    const autoSelectionnees = ops.filter((o) => selection.has(o.id) && o.classement_auto).map((o) => o.id)

    return (
        <section>
            <div className="barre">
                <label className="bouton">Importer un relevé CSV<input type="file" accept=".csv,text/csv" hidden
                                                                       onChange={importer}/></label>
                <button className="secondaire" onClick={autoClasser}>🤖 Classer automatiquement</button>
                <label>Mois <input type="month" value={mois} onChange={(e) => setMois(e.target.value)}/></label>
                <label>Afficher <select value={filtre} onChange={(e) => setFiltre(e.target.value)}>
                    {FILTRES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
                <strong>{ops.length} lignes — total {euro(total)}</strong>
            </div>
            {msg && <p className="msg">{msg} {lienVerif && filtre !== 'a-verifier' &&
                <button className="lien" onClick={() => setFiltre('a-verifier')}>Vérifier les lignes classées
                    automatiquement →</button>}</p>}
            {selection.size > 0 && (
                <div className="barre selection">
                    <strong>{accord(selection.size, 'ligne sélectionnée', 'lignes sélectionnées')}</strong>
                    <ChoixClasseur classeurs={classeurs} valeur={classeurGroupe} onChange={setClasseurGroupe}/>
                    <button disabled={!classeurGroupe} onClick={classerSelection}>Classer</button>
                    {autoSelectionnees.length > 0 &&
                        <button className="ok" onClick={() => confirmer(autoSelectionnees)}>
                            ✓ Confirmer le classement automatique ({autoSelectionnees.length})</button>}
                    <button className="secondaire" onClick={() => setSelection(new Set())}>Annuler</button>
                </div>
            )}
            <table>
                <thead>
                <tr>
                    <th className="case"><input type="checkbox" aria-label="Tout sélectionner" checked={tous}
                                                onChange={() => setSelection(tous ? new Set() : new Set(ops.map((o) => o.id)))}/>
                    </th>
                    <th>Date</th>
                    <th>Nature</th>
                    <th>Motif</th>
                    <th className="num">Montant</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {ops.map((o) => (
                    <tr key={o.id} className={!o.classeur_id ? 'aclasser' : o.classement_auto ? 'averifier' : ''}>
                        <td className="case"><input type="checkbox" aria-label={`Sélectionner ${o.libelle}`}
                                                    checked={selection.has(o.id)} onChange={() => basculer(o.id)}/></td>
                        <td>{o.date_operation}</td>
                        <td>{o.nature}</td>
                        <td>
                            {o.libelle}
                            <div className="petit-texte">
                                {o.classement_auto && <span className="badge-auto">🤖 à vérifier</span>}
                                {o.classeur_id ? nomClasseur(o.classeur_id) : 'À classer'}
                                {o.classement_auto && ` · ${o.classement_auto}`}
                                {o.justificatifs.length > 0 && ` · 📎 ${o.justificatifs.length}`}
                                {o.commentaire && ` · 💬 ${o.commentaire}`}
                            </div>
                        </td>
                        <td className={'num ' + (o.montant < 0 ? 'neg' : 'pos')}>{euro(o.montant)}</td>
                        <td className="actions">
                            {o.classement_auto && <button className="ok" onClick={() => confirmer([o.id])}
                                                          title="Confirmer le classement automatique">✓</button>}
                            <button onClick={() => setEdition(o.id)}>Modifier</button>
                            <button className="danger" onClick={() => supprimer(o)}>Supprimer</button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
            {opEdit && <Edition key={opEdit.id} op={opEdit} mandatId={mandatId} classeurs={classeurs}
                                onClose={() => setEdition(null)} onChange={charger} annoncer={annoncer}/>}
        </section>
    )
}
