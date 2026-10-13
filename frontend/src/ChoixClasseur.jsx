import {useState} from 'react'

// Choix du dossier (catégorie) puis de l'étiquette (classeur) parmi les classeurs du mandat
export default function ChoixClasseur({classeurs, valeur, onChange}) {
    const [categorieId, setCategorieId] = useState(
        () => classeurs.find((c) => c.id === Number(valeur))?.categorie_id ?? '')
    const categories = [...new Map(classeurs.map((c) => [c.categorie_id, c.categorie_nom]))]

    return (
        <>
            <select aria-label="Dossier" value={categorieId} onChange={(e) => {
                setCategorieId(e.target.value)
                onChange('')
            }}>
                <option value="">Dossier…</option>
                {categories.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
            </select>
            <select aria-label="Étiquette" value={valeur} disabled={!categorieId}
                    onChange={(e) => onChange(e.target.value)}>
                <option value="">Étiquette…</option>
                {classeurs.filter((c) => c.categorie_id === Number(categorieId))
                    .map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
        </>
    )
}
