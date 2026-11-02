
const express = require("express");
const router = express.Router();

const avisController = require("../controllers/AvisController");
const avisInteractionController = require("../controllers/AvisInteractionController");

const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");

// ========================================
// Ajouter un avis : utilisateur connecté
// ========================================
router.post(
    "/",
    requireAuth,
    avisController.createAvis
);

// ========================================
// Récupérer les avis d'un pneu : public
// ========================================
router.get(
    "/pneu/:pneuId",
    avisController.getAvisByPneu
);



// Avis visibles sur le site public
router.get(
    "/public",
    avisController.getPublicAvis
);
// ========================================
// Récupérer tous les avis : administrateur
// ========================================
router.get(
    "/",
    requireAuth,
    requireAdmin,
    avisController.getAllAvis
);

// ========================================
// Récupérer les avis d'une commande
// ========================================
router.get(
    "/commande/:commandeId",
    requireAuth,
    avisController.getAvisByCommande
);

// ========================================
// Modifier son avis ou celui d'un autre
// en tant qu'administrateur
// ========================================
router.put(
    "/:id",
    requireAuth,
    avisController.modifierAvis
);

// ========================================
// Supprimer son avis ou celui d'un autre
// en tant qu'administrateur
// ========================================
router.delete(
    "/:id",
    requireAuth,
    avisController.deleteAvis
);

// ========================================
// Aimer / retirer un like
// ========================================
router.post(
    "/:avisId/like",
    requireAuth,
    avisInteractionController.toggleLike
);

// ========================================
// Ajouter une réponse à un avis
// ========================================
router.post(
    "/:avisId/reponses",
    requireAuth,
    avisInteractionController.ajouterReponse
);

// ========================================
// Modifier une réponse
// ========================================
router.put(
    "/reponses/:reponseId",
    requireAuth,
    avisInteractionController.modifierReponse
);

// ========================================
// Supprimer une réponse
// ========================================
router.delete(
    "/reponses/:reponseId",
    requireAuth,
    avisInteractionController.supprimerReponse
);

module.exports = router;
