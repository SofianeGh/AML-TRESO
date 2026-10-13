import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('./api.js', () => ({
    api: vi.fn(),
    euro: (n) => `${Number(n).toFixed(2)} €`,
}))
import { api } from './api.js'
import TableauDeBord, { graduations } from './TableauDeBord.jsx'

const tdb = (surcharge = {}) => ({
    solde: 1798.67, depenses: -776.33, recettes: 3075, nb: 16,
    a_classer: 2, a_verifier: 3, sans_justificatif: 0,
    courbe: [{ date: '2025-10-01', solde: -89.4 }, { date: '2025-10-03', solde: 710.6 }, { date: '2025-11-28', solde: 1798.67 }],
    parCategorie: [
        { categorie: 'Événements', depenses: 465.05, recettes: 420 },
        { categorie: 'Fonctionnement', depenses: 95.9, recettes: 2040 },
        { categorie: 'Partenariats', depenses: 0, recettes: 0 },
    ],
    ...surcharge,
})
beforeEach(() => api.mockReset())

describe('TableauDeBord', () => {
    it('affiche les chiffres clés', async () => {
        api.mockResolvedValue(tdb())
        const { container } = render(<TableauDeBord mandatId={1} onVoir={vi.fn()} />)
        await screen.findByText('Évolution du solde')
        // solde, recettes, dépenses (en positif), résultat
        expect([...container.querySelectorAll('.tuile-valeur')].map((e) => e.textContent))
            .toEqual(['1798.67 €', '3075.00 €', '776.33 €', '2298.67 €'])
        expect(api).toHaveBeenCalledWith('/tableau-de-bord?mandatId=1')
    })

    it('les alertes ouvrent les transactions filtrées', async () => {
        api.mockResolvedValue(tdb())
        const onVoir = vi.fn()
        render(<TableauDeBord mandatId={1} onVoir={onVoir} />)
        fireEvent.click((await screen.findByText(/à classer/)).closest('button'))
        expect(onVoir).toHaveBeenCalledWith('a-classer')
        fireEvent.click(screen.getByText(/à vérifier/).closest('button'))
        expect(onVoir).toHaveBeenCalledWith('a-verifier')
        // rien à signaler : pas de bouton
        expect(screen.getByText('Toutes les dépenses ont un justificatif').closest('button')).toBeNull()
    })

    it('trie les barres par montant et ignore les catégories vides', async () => {
        api.mockResolvedValue(tdb())
        render(<TableauDeBord mandatId={1} onVoir={vi.fn()} />)
        const recettes = (await screen.findByText('Recettes par catégorie')).closest('.carte')
        expect([...recettes.querySelectorAll('.barre-nom')].map((e) => e.textContent)).toEqual(['Fonctionnement', 'Événements'])
        expect(recettes.textContent).not.toContain('Partenariats')
    })

    it('invite à importer quand le mandat est vide', async () => {
        api.mockResolvedValue(tdb({ nb: 0, courbe: [], parCategorie: [] }))
        const onVoir = vi.fn()
        render(<TableauDeBord mandatId={1} onVoir={onVoir} />)
        fireEvent.click(await screen.findByText(/Importer un relevé/))
        expect(onVoir).toHaveBeenCalledWith('')
    })
})

describe('graduations', () => {
    it('donne des pas ronds qui couvrent les valeurs, zéro compris', () => {
        expect(graduations(-89.4, 2025.55)).toEqual([-500, 0, 500, 1000, 1500, 2000, 2500])
        expect(graduations(0, 100)).toEqual([0, 20, 40, 60, 80, 100])
        expect(graduations(0, 0)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    })
})
