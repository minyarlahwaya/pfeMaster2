const express = require("express");

const config = require("../config");
const requireAdmin = require("../middleware/requireAdmin");
const optionalAuth = require("../middleware/optionalAuth");
const rateLimit = require("../middleware/rateLimit");
const uploadPhotoMemory = require("../middleware/uploadPhotoMemory");
const { createAiController } = require("../controllers/AiController");
const { createTirePhotoController } = require("../controllers/TirePhotoController");

// Fabrique : les tests injectent un client Mistral et un dépôt simulés
function createAiRouter({
    controller = createAiController(),
    photoController = createTirePhotoController(),
    admin = requireAdmin
} = {}) {
    const router = express.Router();
    const max = config.mistral.rateLimitPerMinute;

    router.post("/tire-advisor/chat",
        rateLimit({ key: "tire", max }),
        controller.tireAdvisorChat);

    router.post("/support/chat",
        rateLimit({ key: "support", max }),
        optionalAuth,
        controller.supportChat);

    // Contrôle des droits AVANT toute consommation de quota ou appel IA
    router.post("/admin/analytics/chat",
        admin,
        rateLimit({ key: "analytics", max }),
        controller.analyticsChat);

    router.get("/admin/analytics/kpis", admin, controller.analyticsKpis);

    // Recherche par photo : limite de débit AVANT la réception de l'image
    router.post("/tire-photo/analyze",
        rateLimit({ key: "photo", max: config.mistral.photoRateLimitPerMinute }),
        uploadPhotoMemory,
        photoController.analyze);

    // Correction manuelle de la lecture : base de données seulement, sans IA
    router.post("/tire-photo/match",
        rateLimit({ key: "photo-match", max: 30 }),
        photoController.match);

    return router;
}

module.exports = createAiRouter;
