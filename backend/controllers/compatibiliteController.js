const Vehicule = require("../models/VehiculeModel");
const Pneu = require("../models/PneuModel");
const VehiculePneu = require("../models/VehiculePneuModel");
const Marque = require("../models/MarqueModel");

// ========================================
// Ajouter une compatibilité véhicule / pneu
// ========================================

module.exports.ajouterCompatibilite = async (req, res) => {

    try {

        const { vehiculeId, pneuId } = req.body;


        // ==============================
        // Vérifier les données
        // ==============================

        if (!vehiculeId || !pneuId) {

            return res.status(400).json({

                success: false,

                message:
                    "vehiculeId et pneuId sont obligatoires."

            });

        }


        // ==============================
        // Vérifier le véhicule
        // ==============================

        const vehicule =
            await Vehicule.findByPk(vehiculeId);

        if (!vehicule) {

            return res.status(404).json({

                success: false,

                message:
                    "Véhicule introuvable."

            });

        }


        // ==============================
        // Vérifier le pneu
        // ==============================

        const pneu =
            await Pneu.findByPk(pneuId);

        if (!pneu) {

            return res.status(404).json({

                success: false,

                message:
                    "Pneu introuvable."

            });

        }


        // ==============================
        // Vérifier si la compatibilité
        // existe déjà
        // ==============================

        const existe =
            await VehiculePneu.findOne({

                where: {

                    vehiculeId,
                    pneuId

                }

            });


        if (existe) {

            return res.status(409).json({

                success: false,

                message:
                    "Cette compatibilité existe déjà."

            });

        }


        // ==============================
        // Créer la compatibilité
        // ==============================

        const compatibilite =
            await VehiculePneu.create({

                vehiculeId,
                pneuId

            });


        // ==============================
        // Réponse
        // ==============================

        return res.status(201).json({

            success: true,

            message:
                "Compatibilité ajoutée avec succès.",

            compatibilite

        });


    } catch (error) {

        console.error(
            "Erreur ajout compatibilité :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible d'ajouter la compatibilité."

        });

    }

};

module.exports.getCompatibilitesVehicule = async (req, res) => {

    try {

        const { vehiculeId } = req.params;


        // ==============================
        // Vérifier le véhicule
        // ==============================

        const vehicule =
            await Vehicule.findByPk(vehiculeId);

        if (!vehicule) {

            return res.status(404).json({

                success: false,

                message: "Véhicule introuvable."

            });

        }


        // ==============================
        // Récupérer les pneus compatibles
        // ==============================

        const pneus =
            await vehicule.getPneus({

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


        // ==============================
        // Réponse
        // ==============================

        return res.status(200).json({

            success: true,

            vehicule,

            pneus

        });


    } catch (error) {

        console.error(
            "Erreur récupération compatibilités :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer les compatibilités."

        });

    }

};

module.exports.supprimerCompatibilite = async (req, res) => {

    try {

        const { vehiculeId, pneuId } = req.params;


        // ==============================
        // Vérifier la compatibilité
        // ==============================

        const compatibilite =
            await VehiculePneu.findOne({

                where: {

                    vehiculeId,
                    pneuId

                }

            });


        if (!compatibilite) {

            return res.status(404).json({

                success: false,

                message:
                    "Cette compatibilité n'existe pas."

            });

        }


        // ==============================
        // Supprimer
        // ==============================

        await compatibilite.destroy();


        // ==============================
        // Réponse
        // ==============================

        return res.status(200).json({

            success: true,

            message:
                "Compatibilité supprimée avec succès."

        });


    } catch (error) {

        console.error(
            "Erreur suppression compatibilité :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de supprimer la compatibilité."

        });

    }

};



// ========================================
// Récupérer tous les véhicules enregistrés
// ========================================
module.exports.getAllVehicules = async (req, res) => {

    try {

        const vehicules = await Vehicule.findAll({

            include: [
                {
                    model: Pneu,
                    as: "pneus",

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
                        "image",
                        "marqueId"
                    ],

                    include: [
                        {
                            model: Marque,
                            as: "marque"
                        }
                    ],

                    through: {
                        attributes: []
                    }
                }
            ],

            order: [["createdAt", "DESC"]]

        });

        return res.status(200).json({

            success: true,
            nombre: vehicules.length,
            vehicules

        });

    } catch (error) {

        console.error(
            "Erreur récupération des véhicules :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer les véhicules."

        });

    }

};