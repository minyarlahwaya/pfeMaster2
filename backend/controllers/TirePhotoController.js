// =====================================================
// Recherche de pneus par photo
// =====================================================
//   POST /ai/tire-photo/analyze   multipart, champ « photo » (JPG/PNG/WEBP, 5 Mo)
//                                 lecture du flanc par Mistral + pneus du catalogue
//   POST /ai/tire-photo/match     JSON { dimension, marque, modele } — SANS IA :
//                                 le client corrige une valeur mal lue et relance
//
// Confidentialité : la photo reste en mémoire le temps de la requête ;
// elle n'est ni écrite sur le disque, ni stockée en base, ni journalisée.

const config = require("../config");
const { defaultClient, AiServiceError } = require("../services/ai/mistralClient");
const defaultRepo = require("../services/ai/repository");
const { parseDimension } = require("../services/ai/tireTools");
const {
    PHOTO_PROMPT, detectImageType, parseVisionJson, normalizeReading,
    validDimension, matchBrand, brandWarning, findMatchingTires
} = require("../services/ai/tirePhoto");

function sendError(res, error) {
    if (error instanceof AiServiceError) {
        console.error(`❌ Recherche par photo : ${error.code}`);
        if (error.code === "AI_NOT_CONFIGURED") {
            return res.status(503).json({ success: false, message: "L'analyse de photo n'est pas encore configurée. Utilisez la recherche par dimension." });
        }
        if (error.code === "AI_RATE_LIMITED") {
            return res.status(429).json({ success: false, message: "Le service d'analyse est très sollicité. Réessayez dans un instant." });
        }
        return res.status(503).json({ success: false, message: "L'analyse de la photo est momentanément indisponible. Réessayez ou utilisez la recherche par dimension." });
    }
    console.error("❌ Recherche par photo :", error && error.message);
    return res.status(500).json({ success: false, message: "Une erreur est survenue pendant l'analyse." });
}

function summaryMessage(reading, mode, count) {
    if (!reading.estUnPneu) {
        return "Nous n'avons pas pu lire de pneu sur cette photo (photo floue, trop lointaine ou flanc non visible). Photographiez le flanc du pneu, de près et bien éclairé, là où la dimension est inscrite.";
    }
    if (mode === "dimension") {
        return count
            ? `${count} pneu(s) neuf(s) en ${reading.dimension.texte} trouvé(s) dans notre catalogue.`
            : `Aucun pneu en ${reading.dimension.texte} n'est actuellement au catalogue. Contactez LANDOLSI TIRES : nous pouvons le commander pour vous.`;
    }
    if (mode === "marque") {
        return "La dimension n'a pas pu être lue. Voici les pneus de la même marque : vérifiez la dimension sur votre pneu, ou saisissez-la ci-dessous pour un résultat exact.";
    }
    return "Les inscriptions du pneu n'ont pas pu être lues. Saisissez la dimension ci-dessous (ex. 205/55 R16) ou reprenez une photo plus nette.";
}

function createTirePhotoController({ client = defaultClient, repo = defaultRepo, visionModel = config.mistral.visionModel } = {}) {

    async function respond(res, reading, avertissements) {
        const criteria = {
            dimension: reading.estUnPneu ? reading.dimension : null,
            marque: reading.estUnPneu && reading.marque ? reading.marque.catalogue : null,
            modele: reading.estUnPneu && reading.modele ? reading.modele.lu : null
        };
        const { mode, produits } = reading.estUnPneu
            ? await findMatchingTires(repo, criteria)
            : { mode: "aucun", produits: [] };
        return res.json({
            success: true,
            lecture: reading,
            recherche: { mode, dimension: criteria.dimension ? criteria.dimension.texte : null },
            message: summaryMessage(reading, mode, produits.length),
            produits,
            avertissements
        });
    }

    return {
        async analyze(req, res) {
            try {
                const file = req.file;
                if (!file || !file.buffer || !file.buffer.length) {
                    return res.status(400).json({ success: false, message: "Ajoutez une photo de votre pneu." });
                }
                const mime = detectImageType(file.buffer);
                if (!mime) {
                    return res.status(400).json({ success: false, message: "Format d'image non reconnu (JPG, PNG ou WEBP)." });
                }

                const message = await client.chat({
                    model: visionModel,
                    temperature: 0,
                    maxTokens: 500,
                    responseFormat: { type: "json_object" },
                    messages: [
                        { role: "system", content: PHOTO_PROMPT },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Lis les inscriptions de ce pneu et réponds en JSON." },
                                { type: "image_url", image_url: `data:${mime};base64,${file.buffer.toString("base64")}` }
                            ]
                        }
                    ]
                });

                const raw = parseVisionJson(message.content);
                if (!raw) {
                    throw new AiServiceError("Réponse de vision non JSON", { code: "AI_BAD_RESPONSE" });
                }
                const brands = await repo.listBrands();
                const { reading, avertissements } = normalizeReading(raw, brands);
                return respond(res, reading, avertissements);
            } catch (error) {
                return sendError(res, error);
            }
        },

        // Recherche corrigée par le client : aucune donnée envoyée à l'IA
        async match(req, res) {
            try {
                const body = req.body || {};
                const dimText = typeof body.dimension === "string" ? body.dimension.slice(0, 30) : "";
                const dimension = dimText ? validDimension(parseDimension(dimText)) : null;
                if (dimText && !dimension) {
                    return res.status(400).json({ success: false, message: "Dimension non valide. Format attendu : 205/55 R16." });
                }
                const brands = await repo.listBrands();
                const marqueLue = typeof body.marque === "string" ? body.marque.trim().slice(0, 40) : "";
                const modeleLu = typeof body.modele === "string" ? body.modele.trim().slice(0, 60) : "";
                if (!dimension && !marqueLue) {
                    return res.status(400).json({ success: false, message: "Indiquez au moins la dimension ou la marque." });
                }

                const reading = {
                    estUnPneu: true,
                    marque: marqueLue ? { lue: marqueLue, confiance: "haute", catalogue: matchBrand(marqueLue, brands) } : null,
                    modele: modeleLu ? { lu: modeleLu, confiance: "haute" } : null,
                    dimension: dimension ? { ...dimension, confiance: "haute" } : null
                };
                const avertissements = reading.marque && !reading.marque.catalogue
                    ? [brandWarning(marqueLue, Boolean(dimension))]
                    : [];
                return respond(res, reading, avertissements);
            } catch (error) {
                return sendError(res, error);
            }
        }
    };
}

module.exports = { createTirePhotoController };
