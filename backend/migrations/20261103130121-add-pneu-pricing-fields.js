
"use strict";

const TABLE = "Pneus";

module.exports = {
    async up(queryInterface) {
        const table = await queryInterface.describeTable(TABLE);

        const requiredColumns = [
            "prixAchatHT",
            "remiseFournisseur",
            "tauxTVA",
            "prixAchatTTC",
            "marge"
        ];

        const missingColumns = requiredColumns.filter(
            (name) => !table[name]
        );

        if (missingColumns.length > 0) {
            throw new Error(
                `Colonnes manquantes dans ${TABLE} : ${missingColumns.join(", ")}. ` +
                "Vérifiez la structure Supabase avant de continuer."
            );
        }

        console.log("Les cinq colonnes tarifaires existent déjà dans Pneus.");
    },

    async down() {
        throw new Error(
            "Cette migration vérifie des colonnes déjà créées dans Supabase. " +
            "Ne les supprimez pas automatiquement."
        );
    }
};

