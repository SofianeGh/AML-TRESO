package fr.asso.treso;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Mandats, catégories, classeurs, règles de classement automatique. */
@RestController
@RequestMapping("/api")
public class ReferentielController {

    private final JdbcClient db;
    public ReferentielController(JdbcClient db) { this.db = db; }

    public record NouveauMandat(String nom, LocalDate debut, LocalDate fin, Integer copierClasseursDe) {}
    public record NouveauClasseur(int mandatId, int categorieId, String nom) {}
    public record NouvelleRegle(int classeurId, String motif) {}

    @GetMapping("/mandats")
    public List<Map<String, Object>> mandats() {
        return db.sql("SELECT id, nom, debut, fin FROM mandat ORDER BY debut DESC").query().listOfRows();
    }

    @PostMapping("/mandats")
    public Map<String, Object> creerMandat(@RequestBody NouveauMandat m) {
        Integer id = db.sql("INSERT INTO mandat(nom, debut, fin) VALUES (?,?,?) RETURNING id")
                .params(m.nom().trim(), m.debut(), m.fin()).query(Integer.class).single();
        if (m.copierClasseursDe() != null) { // reprend la structure d'un ancien mandat, avec ses règles
            db.sql("INSERT INTO classeur(mandat_id, categorie_id, nom) SELECT ?, categorie_id, nom FROM classeur WHERE mandat_id = ?")
                    .params(id, m.copierClasseursDe()).update();
            db.sql("""
                    INSERT INTO regle_classement(classeur_id, motif)
                    SELECT n.id, r.motif FROM regle_classement r
                    JOIN classeur a ON a.id = r.classeur_id AND a.mandat_id = ?
                    JOIN classeur n ON n.mandat_id = ? AND n.categorie_id = a.categorie_id AND n.nom = a.nom""")
                    .params(m.copierClasseursDe(), id).update();
        }
        return Map.of("id", id);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        return db.sql("SELECT id, nom, hors_cr FROM categorie ORDER BY ordre").query().listOfRows();
    }

    @GetMapping("/classeurs")
    public List<Map<String, Object>> classeurs(@RequestParam int mandatId) {
        return db.sql("""
                SELECT cl.id, cl.nom, c.id AS categorie_id, c.nom AS categorie_nom
                FROM classeur cl JOIN categorie c ON c.id = cl.categorie_id
                WHERE cl.mandat_id = ? ORDER BY c.ordre, cl.nom""").param(mandatId).query().listOfRows();
    }

    @PostMapping("/classeurs")
    public Map<String, Object> creerClasseur(@RequestBody NouveauClasseur c) {
        Integer id = db.sql("INSERT INTO classeur(mandat_id, categorie_id, nom) VALUES (?,?,?) RETURNING id")
                .params(c.mandatId(), c.categorieId(), c.nom().trim()).query(Integer.class).single();
        return Map.of("id", id);
    }

    @GetMapping("/regles")
    public List<Map<String, Object>> regles(@RequestParam int mandatId) {
        return db.sql("""
                SELECT r.id, r.motif, cl.id AS classeur_id, cl.nom AS classeur_nom, c.nom AS categorie_nom
                FROM regle_classement r
                JOIN classeur cl ON cl.id = r.classeur_id JOIN categorie c ON c.id = cl.categorie_id
                WHERE cl.mandat_id = ? ORDER BY c.ordre, cl.nom, r.motif""").param(mandatId).query().listOfRows();
    }

    @PostMapping("/regles")
    public Map<String, Object> creerRegle(@RequestBody NouvelleRegle r) {
        String motif = r.motif() == null ? "" : r.motif().trim();
        if (motif.length() < 3) // un motif trop court classerait presque tout
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le motif doit faire au moins 3 caractères.");
        Integer id = db.sql("""
                INSERT INTO regle_classement(classeur_id, motif) VALUES (?,?)
                ON CONFLICT (classeur_id, motif) DO UPDATE SET motif = EXCLUDED.motif RETURNING id""")
                .params(r.classeurId(), motif).query(Integer.class).single();
        return Map.of("id", id);
    }

    @DeleteMapping("/regles/{id}")
    public void supprimerRegle(@PathVariable int id) {
        db.sql("DELETE FROM regle_classement WHERE id = ?").param(id).update();
    }
}
