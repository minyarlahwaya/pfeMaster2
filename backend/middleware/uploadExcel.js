const multer = require("multer");
const path = require("path");
const fs = require("fs");

const dossier = path.join(__dirname, "../uploads/excel");

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(dossier)) {
    fs.mkdirSync(dossier, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, dossier);
    },

    filename: (req, file, cb) => {
        cb(null, `import-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
    }
});

const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== ".xlsx") {
        return cb(new Error("Veuillez sélectionner un fichier Excel .xlsx."));
    }

    cb(null, true);
};

const uploadExcel = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = uploadExcel;