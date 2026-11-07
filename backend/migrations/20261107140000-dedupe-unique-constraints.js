"use strict";

// =====================================================
// SUPPRESSION DES CONTRAINTES UNIQUE EN DOUBLE
// =====================================================
// L'ancien sync({ alter: true }) recréait à chaque démarrage les contraintes
// UNIQUE (users.email, Marques.nom, Vehicules.immatriculation,
// factures.numeroFacture) : jusqu'à 124 copies identiques, chacune avec son
// index, mises à jour à chaque insertion. Cette migration conserve une seule
// contrainte par définition (le nom le plus court, ex. users_email_key) et
// supprime les copies. Aucune donnée n'est modifiée ; idempotente.

const DUPLICATES = `
    SELECT conrelid::regclass::text AS tbl, conname
    FROM (
        SELECT conrelid, conname,
               row_number() OVER (
                   PARTITION BY conrelid, pg_get_constraintdef(oid)
                   ORDER BY length(conname), conname
               ) AS rn
        FROM pg_constraint
        WHERE contype = 'u' AND connamespace = 'public'::regnamespace
    ) c
    WHERE rn > 1`;

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(DUPLICATES);
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const { tbl, conname } of rows) {
                // Sans CASCADE : échoue proprement si un objet en dépend
                await queryInterface.sequelize.query(
                    `ALTER TABLE ${tbl} DROP CONSTRAINT "${conname.replace(/"/g, '""')}"`,
                    { transaction }
                );
            }
        });
        if (rows.length) console.log(`${rows.length} contrainte(s) UNIQUE en double supprimée(s).`);
    },

    async down() {
        // Les copies étaient redondantes : rien à recréer.
    }
};
