
const express = require("express");
const router = express.Router();

const compatibiliteController = require("../controllers/compatibiliteController");
const requireAdmin = require("../middleware/requireAdmin");

// Liste des véhicules enregistrés par RegCheck
router.get(
    "/vehicules",
    compatibiliteController.getAllVehicules
);

// Ajouter une compatibilité
router.post(
    "/",
    requireAdmin,
    compatibiliteController.ajouterCompatibilite
);

// Consulter les pneus d'un véhicule
router.get(
    "/vehicule/:vehiculeId",
    requireAdmin,
    compatibiliteController.getCompatibilitesVehicule
);

// Supprimer une compatibilité
router.delete(
    "/:vehiculeId/:pneuId",
    requireAdmin,
    compatibiliteController.supprimerCompatibilite
);

module.exports = router;
