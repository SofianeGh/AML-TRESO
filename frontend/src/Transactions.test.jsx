import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./api.js', () => ({
    api: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
    euro: (n) => `${Number(n).toFixed(2)} €`,
}))
import { api, post, upload } from './api.js'
import Transactions from './Transactions.jsx'

const classeurs = [
    { id: 7, nom: 'Vente de crèpes', categorie_id: 1, categorie_nom: 'Événements' },
    { id: 9, nom: 'Assurance', categorie_id: 2, categorie_nom: 'Fonctionnement' },
]
const operations = [
    { id: 1, date_operation: '2025-11-28', nature: 'CARTE', libelle: 'PHARMACIE', montant: -23.4, classeur_id: null,
        classement_auto: null, commentaire: '', justificatifs: [] },
    { id: 2, date_operation: '2025-11-12', nature: 'CARTE', libelle: 'METRO CASH', montant: -79.99, classeur_id: 7,
        classement_auto: 'Comme « CARTE X4481 05/10 METRO CASH »', commentaire: '', justificatifs: [] },
]

const afficher = (props = {}) =>
    render(<Transactions mandatId={1} classeurs={classeurs} filtre="" setFiltre={vi.fn()} {...props} />)

beforeEach(() => {
    api.mockReset().mockResolvedValue(operations)
    post.mockReset()
    upload.mockReset()
})

describe('Transactions', () => {
    it('signale les lignes classées automatiquement avec leur raison', async () => {
        afficher()
        const ligne = (await screen.findByText('METRO CASH')).closest('tr')
        expect(ligne.className).toContain('averifier')
        expect(ligne.textContent).toContain('à vérifier')
        expect(ligne.textContent).toContain('Événements › Vente de crèpes · Comme « CARTE X4481 05/10 METRO CASH »')
    })

    it('confirme un classement automatique en un clic', async () => {
        post.mockResolvedValue({ confirmees: 1 })
        afficher()
        fireEvent.click(await screen.findByTitle('Confirmer le classement automatique'))
        await waitFor(() => expect(post).toHaveBeenCalledWith('/operations/confirmer', { ids: [2] }))
        expect(await screen.findByText(/1 classement confirmé/)).toBeTruthy()
    })

    it('classe plusieurs lignes sélectionnées d\'un coup', async () => {
        post.mockResolvedValue({ modifiees: 2 })
        afficher()
        await screen.findByText('PHARMACIE')
        fireEvent.click(screen.getByLabelText('Tout sélectionner'))
        expect(screen.getByText('2 lignes sélectionnées')).toBeTruthy()
        fireEvent.change(screen.getByLabelText('Dossier'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('Étiquette'), { target: { value: '7' } })
        fireEvent.click(screen.getByRole('button', { name: 'Classer' }))
        await waitFor(() => expect(post).toHaveBeenCalledWith('/operations/classer', { ids: [1, 2], classeurId: 7 }))
        expect(await screen.findByText(/2 transactions classées dans Événements › Vente de crèpes/)).toBeTruthy()
    })

    it('propose de confirmer seulement les lignes auto de la sélection', async () => {
        afficher()
        fireEvent.click(await screen.findByLabelText('Sélectionner PHARMACIE'))
        expect(screen.queryByText(/Confirmer le classement automatique \(/)).toBeNull()
        fireEvent.click(screen.getByLabelText('Sélectionner METRO CASH'))
        expect(screen.getByText(/Confirmer le classement automatique \(1\)/)).toBeTruthy()
    })

    it('résume l\'import et propose de vérifier les lignes classées automatiquement', async () => {
        upload.mockResolvedValue({ lues: 16, ajoutees: 16, classeesAuto: 12, aClasser: 4, doublonsIgnores: 0 })
        const setFiltre = vi.fn()
        const { container } = afficher({ setFiltre })
        await screen.findByText('PHARMACIE')
        fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [new File(['x'], 'releve.csv')] } })
        expect(await screen.findByText(/16 ajoutées, 12 classées automatiquement, 4 à classer\./)).toBeTruthy()
        fireEvent.click(screen.getByText(/Vérifier les lignes classées/))
        expect(setFiltre).toHaveBeenCalledWith('a-verifier')
    })

    it('interroge l\'API avec le filtre choisi', async () => {
        afficher({ filtre: 'sans-justificatif' })
        await screen.findByText('PHARMACIE')
        expect(api).toHaveBeenCalledWith('/operations?mandatId=1&mois=&sansJustificatif=true')
    })
})
