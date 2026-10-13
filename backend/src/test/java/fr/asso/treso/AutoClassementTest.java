package fr.asso.treso;

import org.junit.jupiter.api.Test;

import java.util.List;

import static fr.asso.treso.AutoClassement.*;
import static org.junit.jupiter.api.Assertions.*;

class AutoClassementTest {

    static final int CREPES = 1, RETRAIT = 2, ADHESION = 3, RELIQUAT_ADHESIONS = 4, PHARMACIE = 5, ESCAPE = 6;

    static final List<Classeur> CLASSEURS = List.of(
            new Classeur(CREPES, mots("Vente de crèpes")), new Classeur(RETRAIT, mots("Retrait especes")),
            new Classeur(ADHESION, mots("Adhésion")), new Classeur(RELIQUAT_ADHESIONS, mots("Adhésions")),
            new Classeur(PHARMACIE, mots("Pharmacie")), new Classeur(ESCAPE, mots("Escape Game")));

    static final List<Exemple> HISTORIQUE = List.of(
            exemple("CARTE X4481 05/10 METRO CASH", "CARTE X4481", CREPES),
            exemple("RETRAIT DAB 22/10 CAISSE CREPES", "RETRAIT DAB", RETRAIT),
            exemple("Adhesions rentree 2025", "VIR RECU", ADHESION));

    static Integer classeur(String libelle, String nature, List<Regle> regles) {
        return proposer(libelle, nature, regles, HISTORIQUE, CLASSEURS).map(Proposition::classeurId).orElse(null);
    }

    @Test
    void uneRegleSAppliqueSansTenirCompteDesMajusculesNiDesAccents() {
        var p = proposer("CARTE X4481 16/10 ESCAPE HUNT", "CARTE", List.of(new Regle("escape húnt", ESCAPE)), List.of(), List.of());
        assertEquals(ESCAPE, p.orElseThrow().classeurId());
        assertEquals("Règle « escape húnt »", p.get().raison());
    }

    @Test
    void laRegleLaPlusPreciseGagne() {
        var regles = List.of(new Regle("HELLOASSO", ADHESION), new Regle("HELLOASSO ESCAPE", ESCAPE));
        assertEquals(ESCAPE, classeur("VIR HELLOASSO ESCAPE GAME", "VIR RECU", regles));
        assertEquals(ADHESION, classeur("VIR HELLOASSO COTISATION", "VIR RECU", regles));
    }

    @Test
    void lesReglesPassentAvantLHistorique() {
        assertEquals(PHARMACIE, classeur("CARTE X4481 12/11 METRO CASH", "CARTE", List.of(new Regle("metro", PHARMACIE))));
    }

    @Test
    void unMotifDejaClasseEstReconnuMalgreLaDateEtLeNumeroDeCarte() {
        var p = proposer("CARTE X4481 12/11 METRO CASH", "CARTE X4481", List.of(), HISTORIQUE, CLASSEURS);
        assertEquals(CREPES, p.orElseThrow().classeurId());
        assertEquals("Comme « CARTE X4481 05/10 METRO CASH »", p.get().raison());
    }

    @Test
    void unMotifProcheDuNomDUnClasseurEstPropose() {
        assertEquals(PHARMACIE, classeur("CARTE X4481 27/11 PHARMACIE", "CARTE X4481", List.of()));
        assertEquals(CREPES, classeur("VERSEMENT ESPECES VENTE CREPES", "VERSEMENT", List.of()));
    }

    @Test
    void enCasDegaliteLHistoriqueDepartage() {
        // « Adhésion » et « Adhésions » (reliquats) ressemblent autant au motif, mais seul le premier a déjà servi
        assertEquals(ADHESION, classeur("Adhesions novembre", "VIR RECU", List.of()));
    }

    @Test
    void sansIndiceOuEnCasDeDouteRienNEstClasse() {
        assertNull(classeur("CARTE X4481 11/11 AMAZON MKTP", "CARTE X4481", List.of()));
        assertNull(proposer("Adhesions novembre", "VIR RECU", List.of(), List.of(), CLASSEURS).orElse(null));
    }

    @Test
    void lesMotsSignificatifsIgnorentChiffresAccentsPlurielsEtMotsBancaires() {
        assertEquals(List.of("metro", "cash"), List.copyOf(mots("CARTE X4481 05/10 MÉTRO CASH")));
        assertEquals(List.of("vente", "crepe"), List.copyOf(mots("Vente de crèpes")));
    }
}
