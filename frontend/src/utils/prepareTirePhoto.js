// Prépare la photo du pneu AVANT l'envoi :
//  - redimensionnée (1600 px max) : envoi rapide, même en 4G ;
//  - réencodée en JPEG : supprime les métadonnées EXIF, dont la position GPS
//    enregistrée par les téléphones (la photo n'a pas à révéler le domicile).
// Si le navigateur ne sait pas décoder l'image, le fichier d'origine est
// renvoyé tel quel et le serveur appliquera ses propres contrôles.

const MAX_SIDE = 1600;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
        img.src = url;
    });
}

export async function prepareTirePhoto(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
        throw new Error("Choisissez une image (JPG, PNG ou WEBP).");
    }
    let img;
    try {
        img = await loadImage(file);
    } catch {
        if (ACCEPTED.includes(file.type)) return file;
        throw new Error("Format de photo non pris en charge. Utilisez JPG, PNG ou WEBP.");
    }

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob || file;
}
