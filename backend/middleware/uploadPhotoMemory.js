// Téléversement d'UNE photo en mémoire (recherche de pneus par photo).
// Contrairement à uploadFile.js, rien n'est écrit sur le disque : la photo
// du client n'est utilisée que le temps de l'analyse puis libérée.
const multer = require("multer");

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1, fields: 5 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED.includes(file.mimetype)) return cb(null, true);
        const err = new Error("Seules les images JPG, PNG et WEBP sont acceptées.");
        err.status = 400;
        cb(err);
    }
}).single("photo");

// Erreurs Multer converties en réponses JSON lisibles par le client
function uploadPhotoMemory(req, res, next) {
    upload(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "Photo trop volumineuse (5 Mo maximum)."
                : "Envoyez une seule photo, dans le champ « photo ».";
            return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ success: false, message });
        }
        return res.status(err.status || 400).json({ success: false, message: err.message || "Photo invalide." });
    });
}

module.exports = uploadPhotoMemory;
