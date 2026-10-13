package fr.asso.treso;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;

/**
 * Classement automatique des transactions.
 * 1. Les règles « le motif contient … » passent en premier ; la plus précise (motif le plus long) gagne.
 * 2. Sinon, suggestion par ressemblance : une transaction déjà classée à la main avec les mêmes mots,
 *    ou un classeur dont le nom ressemble au motif. En cas d'hésitation entre deux classeurs, on ne classe pas.
 * La raison est gardée dans operation.classement_auto : la ligne reste « à vérifier » jusqu'à confirmation.
 */
@Service
public class AutoClassement {

    public record Regle(String motif, int classeurId) {}
    public record Exemple(String libelle, Set<String> mots, int classeurId) {}
    public record Classeur(int id, Set<String> mots) {}
    public record Proposition(int classeurId, String raison) {}

    /** Part minimale de mots communs (indice de Jaccard) pour proposer un classeur. */
    static final double SEUIL = 0.5;

    // Mots présents dans presque tous les libellés bancaires : ils ne disent rien du classement
    private static final Set<String> MOTS_VIDES = Set.of(
            "carte", "vir", "virement", "sepa", "recu", "emi", "emis", "prlv", "prelevement", "paiement", "achat",
            "ref", "motif", "pour", "des", "les", "par", "avec", "une", "sur", "aux", "dans", "the", "and");

    private final JdbcClient db;

    public AutoClassement(JdbcClient db) { this.db = db; }

    /** Classe celles des opérations données qui ne sont pas encore classées. Retourne le nombre de lignes classées. */
    public int appliquer(int mandatId, Collection<Long> ids) {
        if (ids.isEmpty()) return 0;
        var regles = db.sql("""
                SELECT r.motif, r.classeur_id FROM regle_classement r
                JOIN classeur cl ON cl.id = r.classeur_id WHERE cl.mandat_id = ?""")
                .param(mandatId).query((rs, i) -> new Regle(rs.getString(1), rs.getInt(2))).list();
        // Historique : lignes classées à la main, tous mandats confondus, ramenées au classeur du même nom dans ce mandat
        var exemples = db.sql("""
                SELECT o.libelle, o.nature, cur.id FROM operation o
                JOIN classeur cl ON cl.id = o.classeur_id
                JOIN classeur cur ON cur.mandat_id = ? AND cur.categorie_id = cl.categorie_id AND cur.nom = cl.nom
                WHERE o.classement_auto IS NULL
                ORDER BY o.date_operation DESC LIMIT 5000""")
                .param(mandatId).query((rs, i) -> exemple(rs.getString(1), rs.getString(2), rs.getInt(3))).list();
        var classeurs = db.sql("SELECT id, nom FROM classeur WHERE mandat_id = ?")
                .param(mandatId).query((rs, i) -> new Classeur(rs.getInt(1), mots(rs.getString(2)))).list();

        List<Object> p = new ArrayList<>(List.of(mandatId));
        p.addAll(ids);
        var ops = db.sql("SELECT id, libelle, nature FROM operation WHERE mandat_id = ? AND classeur_id IS NULL AND id IN ("
                        + String.join(",", Collections.nCopies(ids.size(), "?")) + ")")
                .params(p).query().listOfRows();

        int n = 0;
        for (var o : ops) {
            var prop = proposer((String) o.get("libelle"), (String) o.get("nature"), regles, exemples, classeurs);
            if (prop.isPresent()) {
                n += db.sql("UPDATE operation SET classeur_id = ?, classement_auto = ? WHERE id = ? AND classeur_id IS NULL")
                        .params(prop.get().classeurId(), prop.get().raison(), o.get("id")).update();
            }
        }
        return n;
    }

    static Exemple exemple(String libelle, String nature, int classeurId) {
        return new Exemple(libelle, mots(libelle + " " + Objects.toString(nature, "")), classeurId);
    }

    static Optional<Proposition> proposer(String libelle, String nature, List<Regle> regles,
                                          List<Exemple> exemples, List<Classeur> classeurs) {
        String texte = libelle + " " + Objects.toString(nature, "");

        String t = " " + norm(texte) + " ";
        Regle meilleure = null;
        for (var r : regles) {
            String m = norm(r.motif());
            if (!m.isEmpty() && t.contains(m) && (meilleure == null || m.length() > norm(meilleure.motif()).length()))
                meilleure = r;
        }
        if (meilleure != null)
            return Optional.of(new Proposition(meilleure.classeurId(), "Règle « " + meilleure.motif().trim() + " »"));

        Set<String> mots = mots(texte);
        if (mots.isEmpty()) return Optional.empty();
        Map<Integer, Candidat> candidats = new HashMap<>();
        for (var e : exemples) {
            double s = jaccard(mots, e.mots());
            if (s > 0) candidats.computeIfAbsent(e.classeurId(), k -> new Candidat()).proches++;
            if (s >= SEUIL) candidats.get(e.classeurId()).retenir(s, "Comme « " + e.libelle() + " »", true);
        }
        for (var c : classeurs) {
            double s = jaccard(mots, c.mots());
            if (s >= SEUIL) candidats.computeIfAbsent(c.id(), k -> new Candidat()).retenir(s, "Motif proche du nom du classeur", false);
        }

        // Le plus ressemblant gagne ; à égalité, celui qui a le plus de lignes semblables dans l'historique
        Comparator<Candidat> ordre = Comparator.<Candidat>comparingDouble(c -> c.score).thenComparingInt(c -> c.proches);
        var retenus = candidats.entrySet().stream().filter(e -> e.getValue().score >= SEUIL)
                .sorted(Map.Entry.<Integer, Candidat>comparingByValue(ordre).reversed()).toList();
        if (retenus.isEmpty()) return Optional.empty();
        if (retenus.size() > 1 && ordre.compare(retenus.get(0).getValue(), retenus.get(1).getValue()) == 0)
            return Optional.empty(); // deux classeurs aussi plausibles : on laisse choisir
        return Optional.of(new Proposition(retenus.get(0).getKey(), retenus.get(0).getValue().raison));
    }

    private static final class Candidat {
        double score;
        int proches;
        String raison;
        boolean historique;

        void retenir(double s, String r, boolean h) {
            if (s > score || (s == score && h && !historique)) { score = s; raison = r; historique = h; }
        }
    }

    static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        long communs = a.stream().filter(b::contains).count();
        return (double) communs / (a.size() + b.size() - communs);
    }

    /** Mots significatifs : sans accents, en minuscules, au singulier, sans chiffres ni mots bancaires génériques. */
    static Set<String> mots(String s) {
        Set<String> out = new LinkedHashSet<>();
        for (String m : norm(s).split(" ")) {
            if (m.length() < 3 || m.chars().anyMatch(Character::isDigit)) continue;
            if (m.length() > 3 && m.endsWith("s")) m = m.substring(0, m.length() - 1);
            if (!MOTS_VIDES.contains(m)) out.add(m);
        }
        return out;
    }

    static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase().replaceAll("[^a-z0-9]+", " ").trim();
    }
}
