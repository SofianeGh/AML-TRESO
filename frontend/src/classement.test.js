// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { motCleSuggere, urlOperations, accord } from './classement.js'

describe('motCleSuggere', () => {
    it('garde les mots utiles du libellé, sans date, numéro de carte ni mot bancaire', () => {
        expect(motCleSuggere('CARTE X4481 05/10 METRO CASH')).toBe('METRO CASH')
        expect(motCleSuggere('PRLV SEPA CANVA PRO')).toBe('CANVA PRO')
        expect(motCleSuggere('VIR SEPA RECU /DE HELLOASSO')).toBe('HELLOASSO')
        expect(motCleSuggere(undefined)).toBe('')
    })
})

describe('urlOperations', () => {
    it('ajoute le paramètre du filtre choisi', () => {
        expect(urlOperations(1, '', '')).toBe('/operations?mandatId=1&mois=')
        expect(urlOperations(1, '2025-10', 'a-classer')).toBe('/operations?mandatId=1&mois=2025-10&aClasser=true')
        expect(urlOperations(2, '', 'a-verifier')).toBe('/operations?mandatId=2&mois=&aVerifier=true')
    })
})

describe('accord', () => {
    it('accorde au pluriel à partir de 2', () => {
        expect(accord(0, 'ajoutée', 'ajoutées')).toBe('0 ajoutée')
        expect(accord(1, 'ajoutée', 'ajoutées')).toBe('1 ajoutée')
        expect(accord(16, 'ajoutée', 'ajoutées')).toBe('16 ajoutées')
    })
})
