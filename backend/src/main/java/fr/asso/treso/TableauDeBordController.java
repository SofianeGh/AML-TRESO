package fr.asso.treso;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/** Tableau de bord d'un mandat : chiffres clés, alertes, évolution du solde, répartition par catégorie. */
@RestController
@RequestMapping("/api")
public class TableauDeBordController {

    private final JdbcClient db;
    public TableauDeBordController(JdbcClient db) { this.db = db; }

    @GetMapping("/tableau-de-bord")
    public Map<String, Object> tableauDeBord(@RequestParam int mandatId) {
        // Dépenses / recettes : hors mouvements internes (catégories « hors compte de résultat »)
        var chiffres = db.sql("""
                SELECT COALESCE(SUM(o.montant), 0) AS solde,
                       COALESCE(SUM(o.montant) FILTER (WHERE o.montant < 0 AND NOT COALESCE(c.hors_cr, false)), 0) AS depenses,
                       COALESCE(SUM(o.montant) FILTER (WHERE o.montant > 0 AND NOT COALESCE(c.hors_cr, false)), 0) AS recettes,
                       COUNT(*) AS nb,
                       COUNT(*) FILTER (WHERE o.classeur_id IS NULL) AS a_classer,
                       COUNT(*) FILTER (WHERE o.classement_auto IS NOT NULL) AS a_verifier,
                       COUNT(*) FILTER (WHERE %s) AS sans_justificatif
                FROM operation o
                LEFT JOIN classeur cl ON cl.id = o.classeur_id
                LEFT JOIN categorie c ON c.id = cl.categorie_id
                WHERE o.mandat_id = ?""".formatted(OperationController.SANS_JUSTIFICATIF))
                .param(mandatId).query().singleRow();

        // Solde cumulé jour après jour depuis la première opération du mandat
        var courbe = db.sql("""
                SELECT date_operation AS date, SUM(SUM(montant)) OVER (ORDER BY date_operation) AS solde
                FROM operation WHERE mandat_id = ?
                GROUP BY date_operation ORDER BY date_operation""").param(mandatId).query().listOfRows();

        var parCategorie = db.sql("""
                SELECT COALESCE(c.nom, 'Non classé') AS categorie,
                       COALESCE(-SUM(o.montant) FILTER (WHERE o.montant < 0), 0) AS depenses,
                       COALESCE(SUM(o.montant) FILTER (WHERE o.montant > 0), 0) AS recettes
                FROM operation o
                LEFT JOIN classeur cl ON cl.id = o.classeur_id
                LEFT JOIN categorie c ON c.id = cl.categorie_id
                WHERE o.mandat_id = ? AND NOT COALESCE(c.hors_cr, false)
                GROUP BY c.nom, c.ordre ORDER BY c.ordre NULLS LAST""").param(mandatId).query().listOfRows();

        Map<String, Object> out = new LinkedHashMap<>(chiffres);
        out.put("courbe", courbe);
        out.put("parCategorie", parCategorie);
        return out;
    }
}
