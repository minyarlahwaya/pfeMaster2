const express = require("express");
const router = express.Router();

const pneuController = require("../controllers/PneuController");
const uploadFile = require("../middleware/uploadFile");
const requireAdmin = require("../middleware/requireAdmin");
const uploadExcel = require("../middleware/uploadExcel");
//  /pneus  //

router.post("/", requireAdmin, uploadFile.single("image"), pneuController.addPneu);
router.post(
    "/import-excel",
    requireAdmin,
    uploadExcel.single("fichier"),
    pneuController.importExcel
);
router.put("/:id", requireAdmin, uploadFile.single("image"), pneuController.updatePneu);
router.delete("/:id", requireAdmin, pneuController.deletePneu);
// Afficher pneus
router.get("/getallpneus", pneuController.getAllPneus);
router.get("/search/dimension", pneuController.searchPneusByDimension);
router.get("/dimensions/largeurs", pneuController.getLargeurs);
router.get("/dimensions/hauteurs", pneuController.getHauteurs);
router.get("/dimensions/diametres", pneuController.getDiametres);
router.get("/search/saison/:saison", pneuController.searchPneusBySaison);
// ========================================
// Gestion des pneus archivés (ADMIN)
// ========================================

router.get("/archives", requireAdmin, pneuController.getArchivedPneus);

router.put("/restore/:id", requireAdmin, pneuController.restorePneu);

router.get("/:id", pneuController.getPneuById);


module.exports = router;