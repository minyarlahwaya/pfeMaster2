// =====================================================
// Fonctionnalité 4 — Recherche de pneus à partir d'une photo
// =====================================================
// Le client photographie le flanc de son pneu usé. Le modèle de vision
// Mistral se contente de LIRE les inscriptions et de les renvoyer en JSON.
// Tout le reste est fait ici, sans LLM :
//   - validation de chaque valeur lue (plages ETRTO, indices, DOT) ;
//   - rapprochement de la marque avec les marques RÉELLES du catalogue ;
//   - recherche des pneus neufs correspondants dans PostgreSQL.
// Un produit ne peut donc jamais être inventé par le modèle.

const { parseDimension, isDimensionConsistent, productUrl } = require("./tireTools");

// ---------------------------------------------------------------
// Image : type réel (signature binaire), indépendant du nom de fichier
// ---------------------------------------------------------------
function detectImageType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return null;
}

// ---------------------------------------------------------------
// Consigne du modèle de vision
// ---------------------------------------------------------------
const PHOTO_PROMPT = `Tu es un expert en pneumatiques. On te montre la photo d'un pneu (souvent usé) envoyée par un client.
Ta seule tâche : LIRE les inscriptions réellement visibles sur le flanc. Tu ne devines rien.

Définitions (ne les confonds pas) :
- "marque" = le FABRICANT, écrit en grandes lettres sur le flanc : Michelin, Bridgestone, Continental,
  Pirelli, Goodyear, Dunlop, Hankook, Sailun, Kumho, Nexen, Firestone, BFGoodrich, Yokohama, Toyo...
- "modele" = la GAMME du fabricant, écrite à côté de la marque : Primacy 4, Pilot Sport 4 S, Turanza T005,
  EcoContact 6, Cinturato P7, Kinergy 4S2, Atrezzo Elite...
  Exemple : flanc « MICHELIN PILOT SPORT 4 S » -> marque "Michelin", modele "Pilot Sport 4 S".
- "dimension" = largeur/hauteur R diamètre, ex. « 205/55 R16 91V » -> "205/55 R16", indice_charge 91, indice_vitesse "V".

Réponds UNIQUEMENT par un objet JSON avec exactement ces clés :
{
  "est_un_pneu": true|false,
  "marque": "fabricant lu ou null",
  "marque_confiance": "haute"|"moyenne"|"faible",
  "modele": "gamme lue ou null",
  "modele_confiance": "haute"|"moyenne"|"faible",
  "dimension": "ex. 205/55 R16, ou null",
  "dimension_confiance": "haute"|"moyenne"|"faible",
  "indice_charge": nombre ou null,
  "indice_vitesse": "lettre ou null",
  "marquage_m_s": true|false,
  "marquage_3pmsf": true|false,
  "dot": "4 derniers chiffres du code DOT (semaine+année, ex. 2319) ou null",
  "texte_lu": "toutes les inscriptions lisibles recopiées telles quelles (200 caractères max)",
  "probleme_photo": "null, ou en une phrase ce qui empêche la lecture (flou, reflet, trop loin, flanc non visible...)"
}

Règles :
- Une valeur illisible, partielle ou incertaine vaut null : ne complète jamais un chiffre manquant.
  Les chiffres de la dimension sont souvent petits : "haute" uniquement si chaque chiffre est net.
- "faible" si tu hésites entre plusieurs lectures.
- Le marquage 3PMSF est le pictogramme montagne à trois pics avec un flocon.
- Si l'image ne montre pas un pneu (logo, voiture entière, autre objet), "est_un_pneu": false.
- N'écris rien en dehors du JSON.`;

// ---------------------------------------------------------------
// Validation de la lecture du modèle
// ---------------------------------------------------------------
const CONFIDENCES = ["haute", "moyenne", "faible"];
const SPEED_INDEXES = ["L", "M", "N", "P", "Q", "R", "S", "T", "U", "H", "V", "W", "Y", "Z"];

const normalize = (s) => String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");

const cleanText = (v, max = 60) => {
    if (typeof v !== "string") return null;
    const t = v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
    if (!t || /^(null|inconnu|illisible|n\/a|none)$/i.test(t)) return null;
    return t.slice(0, max);
};

const confidence = (v) => (CONFIDENCES.includes(v) ? v : "faible");

// Le modèle peut entourer le JSON de ```json ... ``` malgré la consigne
function parseVisionJson(content) {
    const text = String(content || "").trim()
        .replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        const obj = JSON.parse(text.slice(start, end + 1));
        return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
    } catch {
        return null;
    }
}

// Plages des pneus tourisme / SUV / utilitaires légers (ETRTO)
function validDimension(d) {
    if (!d) return null;
    const { largeur, hauteur, diametre } = d;
    if (!Number.isInteger(largeur) || largeur < 125 || largeur > 355 || largeur % 5 !== 0) return null;
    if (!Number.isInteger(hauteur) || hauteur < 25 || hauteur > 85 || hauteur % 5 !== 0) return null;
    if (!Number.isInteger(diametre) || diametre < 12 || diametre > 24) return null;
    return { largeur, hauteur, diametre, texte: `${largeur}/${hauteur} R${diametre}` };
}

// DOT : SSAA (semaine, année). Ex. 2319 = 23e semaine de 2019.
function parseDot(value, now = new Date()) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 4) return null;
    const semaine = Number(digits.slice(0, 2));
    const annee = 2000 + Number(digits.slice(2));
    if (semaine < 1 || semaine > 53) return null;
    const fabrication = new Date(Date.UTC(annee, 0, 1 + (semaine - 1) * 7));
    if (fabrication > now) return null;
    const ageAns = Math.floor(((now - fabrication) / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
    return { code: digits, semaine, annee, ageAns };
}

// Rapprochement avec les marques du catalogue (aucune marque inventée)
function matchBrand(text, catalogBrands) {
    const n = normalize(text);
    if (n.length < 2) return null;
    const exact = catalogBrands.find((b) => normalize(b) === n);
    if (exact) return exact;
    // « MICHELIN X » / « Pirelli P » : la marque du catalogue est contenue dans la lecture
    return catalogBrands.find((b) => normalize(b).length >= 4 && n.includes(normalize(b))) || null;
}

function brandWarning(marque, hasDimension) {
    return hasDimension
        ? `La marque ${marque} n'est pas proposée par LANDOLSI TIRES : voici des pneus d'autres marques dans la même dimension.`
        : `La marque ${marque} n'est pas proposée par LANDOLSI TIRES.`;
}

/**
 * Transforme la réponse brute du modèle en lecture vérifiée.
 * @param {object} raw          JSON renvoyé par le modèle
 * @param {string[]} brands     marques réellement présentes dans le catalogue
 */
function normalizeReading(raw, brands, now = new Date()) {
    const r = raw || {};
    let marqueLue = cleanText(r.marque, 40);
    let modeleLu = cleanText(r.modele, 60);
    const texteLu = cleanText(r.texte_lu, 200);

    // Sécurité : le modèle range parfois la gamme dans « marque ». Si une
    // marque du catalogue figure dans la lecture, elle est retenue.
    if (!matchBrand(marqueLue, brands)) {
        const found = [marqueLue, modeleLu, texteLu].map((t) => matchBrand(t, brands)).find(Boolean);
        if (found) {
            if (marqueLue && !modeleLu && normalize(marqueLue) !== normalize(found)) modeleLu = marqueLue;
            marqueLue = found;
        }
    }
    // « MICHELIN Primacy 4 » lu comme modèle : retirer la marque du nom de gamme
    if (modeleLu && marqueLue && normalize(modeleLu).startsWith(normalize(marqueLue))) {
        modeleLu = cleanText(modeleLu.slice(marqueLue.length), 60);
    }
    const dimension = validDimension(parseDimension(r.dimension));
    const dimensionLue = cleanText(r.dimension, 30);

    const charge = Number(r.indice_charge);
    const vitesse = typeof r.indice_vitesse === "string" ? r.indice_vitesse.trim().toUpperCase() : "";

    const reading = {
        estUnPneu: r.est_un_pneu === true,
        marque: marqueLue ? {
            lue: marqueLue,
            confiance: confidence(r.marque_confiance),
            catalogue: matchBrand(marqueLue, brands)
        } : null,
        modele: modeleLu ? { lu: modeleLu, confiance: confidence(r.modele_confiance) } : null,
        dimension: dimension ? { ...dimension, confiance: confidence(r.dimension_confiance) } : null,
        indiceCharge: Number.isInteger(charge) && charge >= 60 && charge <= 130 ? charge : null,
        indiceVitesse: SPEED_INDEXES.includes(vitesse) ? vitesse : null,
        marquageMS: r.marquage_m_s === true,
        marquage3PMSF: r.marquage_3pmsf === true,
        dot: parseDot(r.dot, now),
        texteLu,
        problemePhoto: cleanText(r.probleme_photo, 200)
    };

    const avertissements = [];
    if (dimensionLue && !dimension) {
        avertissements.push(`La dimension lue (« ${dimensionLue} ») n'est pas une dimension valide : vérifiez-la et saisissez-la ci-dessous.`);
    }
    if (reading.dimension && reading.dimension.confiance !== "haute") {
        avertissements.push("La dimension a été lue avec une confiance limitée : comparez-la avec le flanc de votre pneu avant de commander.");
    }
    if (reading.marque && !reading.marque.catalogue) {
        avertissements.push(brandWarning(reading.marque.lue, Boolean(reading.dimension)));
    }
    if (reading.dot && reading.dot.ageAns >= 6) {
        avertissements.push(`D'après le code DOT, ce pneu a été fabriqué il y a environ ${Math.floor(reading.dot.ageAns)} ans : au-delà de 5 à 6 ans, faites-le contrôler par un professionnel, même si l'usure paraît faible.`);
    }
    return { reading, avertissements };
}

// ---------------------------------------------------------------
// Recherche des pneus neufs correspondants (requêtes paramétrées)
// ---------------------------------------------------------------
const effectivePrice = (t) => (t.prixPromo != null ? t.prixPromo : t.prix);

function toProduct(t, correspondance) {
    return {
        id: t.id, marque: t.marque, modele: t.modele, dimension: t.dimension, saison: t.saison,
        prix: t.prix, prixPromo: t.prixPromo, pourcentagePromotion: t.pourcentagePromotion,
        stock: t.stock, image: t.image, url: productUrl(t.id), correspondance
    };
}

/**
 * @param {object} repo  dépôt de données (services/ai/repository.js)
 * @param {{dimension?: object, marque?: string|null, modele?: string|null}} criteria
 *        dimension validée, marque = nom EXACT du catalogue
 * @returns {Promise<{mode: string, produits: object[]}>}
 *   mode : "dimension" (même dimension), "marque" (dimension inconnue), "aucun"
 */
async function findMatchingTires(repo, { dimension, marque, modele }, limit = 12) {
    const modeleN = normalize(modele);
    const sameModel = (t) => modeleN.length >= 3 && normalize(t.modele).length >= 3 &&
        (normalize(t.modele).includes(modeleN) || modeleN.includes(normalize(t.modele)));
    const sameBrand = (t) => Boolean(marque) && normalize(t.marque) === normalize(marque);

    if (dimension) {
        const found = (await repo.searchTires({
            largeur: dimension.largeur, hauteur: dimension.hauteur, diametre: dimension.diametre, limit: 60
        })).filter(isDimensionConsistent);

        const ranked = found.map((t) => {
            const correspondance = sameBrand(t) && sameModel(t) ? "meme_modele"
                : sameBrand(t) ? "meme_marque" : "meme_dimension";
            const score = { meme_modele: 0, meme_marque: 1, meme_dimension: 2 }[correspondance];
            return { t, correspondance, score };
        }).sort((a, b) =>
            a.score - b.score ||
            (b.t.stock > 0) - (a.t.stock > 0) ||
            effectivePrice(a.t) - effectivePrice(b.t));

        return { mode: "dimension", produits: ranked.slice(0, limit).map((x) => toProduct(x.t, x.correspondance)) };
    }

    // Sans dimension, la marque seule ne garantit PAS la compatibilité :
    // les fiches sont proposées comme pistes, « dimension à vérifier ».
    if (marque) {
        const found = (await repo.searchTires({ marque, limit: 40 })).filter(isDimensionConsistent);
        found.sort((a, b) => sameModel(b) - sameModel(a) || (b.stock > 0) - (a.stock > 0) || effectivePrice(a) - effectivePrice(b));
        return { mode: "marque", produits: found.slice(0, 8).map((t) => toProduct(t, "dimension_a_verifier")) };
    }

    return { mode: "aucun", produits: [] };
}

module.exports = {
    PHOTO_PROMPT,
    detectImageType,
    parseVisionJson,
    normalizeReading,
    validDimension,
    parseDot,
    matchBrand,
    brandWarning,
    findMatchingTires
};
