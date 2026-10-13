-- Règles de classement automatique : "si le motif ou la nature contient <motif>, ranger dans <classeur>"
-- Une règle suit son classeur, donc son mandat ; elle est recopiée avec les classeurs lors d'un nouveau mandat.
CREATE TABLE regle_classement (
    id          SERIAL PRIMARY KEY,
    classeur_id INT NOT NULL REFERENCES classeur(id) ON DELETE CASCADE,
    motif       VARCHAR(200) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (classeur_id, motif)
);

-- NULL = classé à la main (ou pas encore classé).
-- Sinon : raison du classement automatique (ex. 'Règle « metro »'), la ligne reste "à vérifier" jusqu'à confirmation.
ALTER TABLE operation ADD COLUMN classement_auto TEXT;
