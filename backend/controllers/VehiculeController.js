
const axios = require("axios");
const Vehicule = require("../models/VehiculeModel");

// =============================================
// Rechercher un véhicule par immatriculation
// =============================================

module.exports.searchVehicule = async (req, res) => {
    try {
        // 1. Récupérer et vérifier l'immatriculation
        const immatriculation = req.params.immatriculation?.trim();

        if (!immatriculation) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir une immatriculation."
            });
        }

        console.log("Immatriculation recherchée :", immatriculation);

        // 2. Vérifier la configuration API
        const username = process.env.VEHICULE_API_USERNAME;

        if (!username || !username.trim()) {
            console.error("VEHICULE_API_USERNAME est absent ou vide.");

            return res.status(500).json({
                success: false,
                message: "La configuration de l'API véhicule est manquante."
            });
        }

        // 3. Appeler RegCheck
        const response = await axios.get(
            "https://www.regcheck.org.uk/api/reg.asmx/CheckTunisia",
            {
                params: {
                    RegistrationNumber: immatriculation,
                    username: username.trim()
                },
                timeout: 15000
            }
        );

        // 4. Récupérer la réponse brute
        const data = response.data;

        console.log("Réponse brute RegCheck :", data);

        if (typeof data !== "string" || !data.trim()) {
            return res.status(502).json({
                success: false,
                message: "L'API a retourné une réponse vide ou invalide."
            });
        }

        // 5. Extraire le JSON de la réponse XML
        const jsonStart = data.indexOf("{");
        const jsonEnd = data.lastIndexOf("}");

        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
            return res.status(502).json({
                success: false,
                message: "Impossible d'extraire les informations du véhicule depuis l'API.",
                details: data.substring(0, 500)
            });
        }

        let vehiculeAPI;

        try {
            const jsonString = data.substring(jsonStart, jsonEnd + 1);
            vehiculeAPI = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Erreur parsing JSON :", parseError.message);

            return res.status(502).json({
                success: false,
                message: "Le format des données retournées par l'API est invalide."
            });
        }

        // 6. Vérifier si le véhicule a réellement été trouvé
        if (
            !vehiculeAPI ||
            typeof vehiculeAPI !== "object" ||
            vehiculeAPI.CarMake?.CurrentTextValue == null ||
            vehiculeAPI.CarModel?.CurrentTextValue == null
        ) {
            return res.status(404).json({
                success: false,
                message: "Aucun véhicule reconnu pour cette immatriculation.",
                resultatAPI: vehiculeAPI
            });
        }

        // 7. Préparer les informations du véhicule
        const vehicule = {
            immatriculation,
            description: vehiculeAPI.Description || null,
            annee: vehiculeAPI.RegistrationYear || null,
            dateImmatriculation: vehiculeAPI.RegistrationDate || null,
            marque: vehiculeAPI.CarMake?.CurrentTextValue || null,
            modele: vehiculeAPI.CarModel?.CurrentTextValue || null,
            carburant: vehiculeAPI.FuelType || null,
            variante: vehiculeAPI.Variant || null,
            moteur: vehiculeAPI.Engine || null,
            type: vehiculeAPI.Type || null,
            puissanceFiscale: vehiculeAPI.FiscalPower || null,
            image: vehiculeAPI.ImageUrl || null
        };

        console.log("Véhicule identifié :", vehicule);

        // 8. Enregistrer ou récupérer le véhicule dans PostgreSQL
        const [vehiculeDB, created] = await Vehicule.findOrCreate({
            where: {
                immatriculation
            },
            defaults: vehicule
        });

        console.log(
            created
                ? "Nouveau véhicule enregistré."
                : "Véhicule déjà existant."
        );

        // 9. Récupérer les pneus associés à ce véhicule
        const pneus = await vehiculeDB.getPneus({
            attributes: [
                "id",
                "modele",
                "dimension",
                "largeur",
                "hauteur",
                "diametre",
                "saison",
                "prix",
                "stock",
                "description",
                "image",
                "marqueId"
            ]
        });

        // 10. Retourner le résultat
        return res.status(200).json({
            success: true,
            message: "Véhicule identifié avec succès.",
            created,
            vehicule: vehiculeDB,
            pneus
        });

    } catch (error) {
        console.error("========== ERREUR VEHICULE ==========");
        console.error("Message :", error.message);
        console.error("Statut HTTP :", error.response?.status);
        console.error("Réponse API :", error.response?.data);
        console.error("Code erreur :", error.code);
        console.error("=====================================");

        // Erreurs provenant de l'API externe
        if (error.response) {
            return res.status(502).json({
                success: false,
                message: "Le service RegCheck a retourné une erreur.",
                apiStatus: error.response.status
            });
        }

        if (error.code === "ECONNABORTED") {
            return res.status(504).json({
                success: false,
                message: "Le service RegCheck met trop de temps à répondre."
            });
        }

        if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
            return res.status(503).json({
                success: false,
                message: "Impossible de contacter le service RegCheck."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Erreur interne lors de la recherche du véhicule."
        });
    }
};
