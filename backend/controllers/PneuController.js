
const { Op } = require("sequelize");
const fs = require("fs");
const ExcelJS = require("exceljs");

const Pneu = require("../models/PneuModel");
const Marque = require("../models/MarqueModel");
// ========================================
// Fonctions utilitaires
// ========================================

// Arrondir à 3 chiffres après la virgule
const arrondir = (valeur) => {
    return Math.round((valeur + Number.EPSILON) * 1000) / 1000;
};

// Calculer les prix du pneu
const calculerPrix = ({
    prixAchatHT,
    remiseFournisseur,
    tauxTVA,
    marge
}) => {

    const paht = Number(prixAchatHT);
    const remise = Number(remiseFournisseur);
    const tva = Number(tauxTVA);
    const tauxMarge = Number(marge);

    if (
        !Number.isFinite(paht) ||
        !Number.isFinite(remise) ||
        !Number.isFinite(tva) ||
        !Number.isFinite(tauxMarge)
    ) {
        throw new Error("Les données de tarification doivent être numériques.");
    }

    if (paht <= 0) {
        throw new Error("Le prix d'achat HT doit être supérieur à zéro.");
    }

    if (remise < 0 || remise > 100) {
        throw new Error("La remise fournisseur doit être comprise entre 0 et 100 %.");
    }

    if (tva < 0 || tva > 100) {
        throw new Error("Le taux de TVA doit être compris entre 0 et 100 %.");
    }

    if (tauxMarge < 0) {
        throw new Error("La marge ne peut pas être négative.");
    }

    // Prix après remise fournisseur
    const prixApresRemise = paht * (1 - remise / 100);

    // Prix d'achat TTC
    const prixAchatTTC = prixApresRemise * (1 + tva / 100);

    // Prix de vente TTC
    const prixVenteTTC = prixAchatTTC * (1 + tauxMarge / 100);

    return {
        prixAchatHT: arrondir(paht),
        remiseFournisseur: remise,
        tauxTVA: tva,
        prixAchatTTC: arrondir(prixAchatTTC),
        marge: tauxMarge,
        prix: arrondir(prixVenteTTC)
    };
};

// Vérifier qu'une marque existe
const verifierMarque = async (marqueId) => {

    if (!marqueId) {
        return null;
    }

    return await Marque.findByPk(marqueId);
};


// ========================================
// Ajouter un pneu
// ========================================

module.exports.addPneu = async (req, res) => {

    try {

        const {
            modele,
            dimension,
            largeur,
            hauteur,
            diametre,
            saison,
            prixAchatHT,
            remiseFournisseur = 20,
            tauxTVA = 19,
            marge = 20,
            stock = 0,
            description,
            marqueId
        } = req.body;

        // Vérifier les champs obligatoires
        if (!modele || !dimension || !marqueId || !prixAchatHT) {
            return res.status(400).json({
                success: false,
                message: "Veuillez renseigner le modèle, la dimension, le prix d'achat HT et la marque."
            });
        }

        // Vérifier l'image
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Veuillez ajouter une image du pneu."
            });
        }

        // Vérifier la marque
        const marque = await verifierMarque(marqueId);

        if (!marque) {
            return res.status(404).json({
                success: false,
                message: "Cette marque n'existe pas."
            });
        }

        // Calculer automatiquement les prix
        const tarification = calculerPrix({
            prixAchatHT,
            remiseFournisseur,
            tauxTVA,
            marge
        });

        // Vérifier le stock
        const stockNombre = Number(stock);

        if (!Number.isInteger(stockNombre) || stockNombre < 0) {
            return res.status(400).json({
                success: false,
                message: "Le stock doit être un nombre entier positif ou nul."
            });
        }

        // Créer le pneu
        const pneu = await Pneu.create({

            modele,
            dimension,

            largeur: largeur || null,
            hauteur: hauteur || null,
            diametre: diametre || null,

            saison: saison || null,

            ...tarification,

            stock: stockNombre,
            description: description || null,

            image: req.file.filename,

            marqueId

        });

        return res.status(201).json({

            success: true,
            message: "Pneu ajouté avec succès.",
            pneu

        });

    } catch (error) {

        console.log(error);

        return res.status(400).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Récupérer tous les pneus
// ========================================
// ========================================
// Récupérer les pneus actifs
// ========================================

module.exports.getAllPneus = async (req, res) => {
    try {
        const pneus = await Pneu.findAll({
            where: {
                isActive: true
            },
            include: {
                model: Marque,
                as: "marque",
                attributes: ["id", "nom", "logo"]
            },
            order: [["id", "ASC"]]
        });

        return res.status(200).json({
            success: true,
            pneus
        });

    } catch (error) {
        console.error("Erreur getAllPneus :", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};






// ========================================
// Récupérer un pneu par son ID
// ========================================

module.exports.getPneuById = async (req, res) => {

    try {

        const pneu = await Pneu.findByPk(req.params.id, {

            include: [{
                model: Marque,
                as: "marque",
                attributes: ["id", "nom", "logo"]
            }]

        });

        if (!pneu) {
            return res.status(404).json({
                success: false,
                message: "Pneu introuvable."
            });
        }

        return res.status(200).json({
            success: true,
            pneu
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Rechercher les pneus par dimensions
// ========================================

module.exports.searchPneusByDimension = async (req, res) => {

    try {

        const {
            largeur,
            hauteur,
            diametre,
            marqueId
        } = req.query;

        if (!largeur && !hauteur && !diametre) {
            return res.status(400).json({
                success: false,
                message: "Veuillez renseigner au moins une dimension."
            });
        }

        const where = {};

        if (largeur) {
            where.largeur = Number(largeur);
        }

        if (hauteur) {
            where.hauteur = Number(hauteur);
        }

        if (diametre) {
            where.diametre = Number(diametre);
        }

        // Filtre facultatif par marque
        if (marqueId) {
            where.marqueId = Number(marqueId);
        }

        const pneus = await Pneu.findAll({

            where,

            include: {
                model: Marque,
                as: "marque",
                attributes: ["id", "nom", "logo"]
            }

        });

        return res.status(200).json({

            success: true,
            count: pneus.length,
            pneus

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Récupérer les largeurs disponibles
// ========================================

module.exports.getLargeurs = async (req, res) => {

    try {

        const largeurs = await Pneu.findAll({

            attributes: ["largeur"],

            where: {
                largeur: {
                    [Op.ne]: null
                }
            },

            group: ["largeur"],
            order: [["largeur", "ASC"]]

        });

        const result = largeurs.map(pneu => pneu.largeur);

        return res.status(200).json({
            success: true,
            largeurs: result
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Récupérer les hauteurs selon la largeur
// ========================================

module.exports.getHauteurs = async (req, res) => {

    try {

        const { largeur } = req.query;

        if (!largeur) {
            return res.status(400).json({
                success: false,
                message: "La largeur est obligatoire."
            });
        }

        const hauteurs = await Pneu.findAll({

            attributes: ["hauteur"],

            where: {
                largeur: Number(largeur),
                hauteur: {
                    [Op.ne]: null
                }
            },

            group: ["hauteur"],
            order: [["hauteur", "ASC"]]

        });

        const result = hauteurs.map(pneu => pneu.hauteur);

        return res.status(200).json({
            success: true,
            hauteurs: result
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Récupérer les diamètres selon largeur
// et hauteur
// ========================================

module.exports.getDiametres = async (req, res) => {

    try {

        const { largeur, hauteur } = req.query;

        if (!largeur || !hauteur) {
            return res.status(400).json({
                success: false,
                message: "La largeur et la hauteur sont obligatoires."
            });
        }

        const diametres = await Pneu.findAll({

            attributes: ["diametre"],

            where: {
                largeur: Number(largeur),
                hauteur: Number(hauteur),
                diametre: {
                    [Op.ne]: null
                }
            },

            group: ["diametre"],
            order: [["diametre", "ASC"]]

        });

        const result = diametres.map(pneu => pneu.diametre);

        return res.status(200).json({
            success: true,
            diametres: result
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Rechercher les pneus par saison
// ========================================

module.exports.searchPneusBySaison = async (req, res) => {

    try {

        const { saison } = req.params;

        const pneus = await Pneu.findAll({

            where: {
                saison
            },

            include: {
                model: Marque,
                as: "marque",
                attributes: ["id", "nom", "logo"]
            }

        });

        return res.status(200).json({

            success: true,
            count: pneus.length,
            saison,
            pneus

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ========================================
// Modifier un pneu
// ========================================

module.exports.updatePneu = async (req, res) => {
    try {
        const { id } = req.params;

        const pneu = await Pneu.findByPk(id);

        if (!pneu) {
            return res.status(404).json({
                success: false,
                message: "Pneu introuvable."
            });
        }

        const {
            modele,
            dimension,
            largeur,
            hauteur,
            diametre,
            saison,
            prixAchatHT,
            remiseFournisseur,
            tauxTVA,
            marge,
            stock,
            description,
            marqueId
        } = req.body;

        // Vérifier la marque
        const nouvelleMarqueId = marqueId ?? pneu.marqueId;
        const marque = await verifierMarque(nouvelleMarqueId);

        if (!marque) {
            return res.status(404).json({
                success: false,
                message: "Cette marque n'existe pas."
            });
        }

        const donnees = {};

        // Informations générales
        if (modele !== undefined) donnees.modele = modele;
        if (dimension !== undefined) donnees.dimension = dimension;

        if (largeur !== undefined) donnees.largeur = largeur || null;
        if (hauteur !== undefined) donnees.hauteur = hauteur || null;
        if (diametre !== undefined) donnees.diametre = diametre || null;

        // Saison facultative :
        // - valeur envoyée : on l'enregistre
        // - chaîne vide : on enregistre null
        // - champ absent : on conserve l'ancienne saison
        if (saison !== undefined) {
            donnees.saison =
                saison === null || String(saison).trim() === ""
                    ? null
                    : String(saison).trim();
        }

        if (description !== undefined) {
            donnees.description = description || null;
        }

        // Stock
        if (stock !== undefined) {
            const stockNombre = Number(stock);

            if (!Number.isInteger(stockNombre) || stockNombre < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Le stock doit être un nombre entier positif ou nul."
                });
            }

            donnees.stock = stockNombre;
        }

        donnees.marqueId = nouvelleMarqueId;

        // Calcul des prix en conservant les anciennes valeurs
        const nouvelleTarification = calculerPrix({
            prixAchatHT: prixAchatHT ?? pneu.prixAchatHT,
            remiseFournisseur: remiseFournisseur ?? pneu.remiseFournisseur,
            tauxTVA: tauxTVA ?? pneu.tauxTVA,
            marge: marge ?? pneu.marge
        });

        Object.assign(donnees, nouvelleTarification);

        // Image : conserver l'ancienne si aucune nouvelle image
        if (req.file) {
            donnees.image = req.file.filename;
        }

        await pneu.update(donnees);

        return res.status(200).json({
            success: true,
            message: "Pneu modifié avec succès.",
            pneu
        });

    } catch (error) {
        console.error("Erreur updatePneu :", error);

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// ========================================
// Supprimer un pneu
// ========================================
module.exports.deletePneu = async (req, res) => {
    try {
        const { id } = req.params;

        const pneu = await Pneu.findByPk(id);

        if (!pneu) {
            return res.status(404).json({
                success: false,
                message: "Pneu introuvable."
            });
        }

        if (!pneu.isActive) {
            return res.status(400).json({
                success: false,
                message: "Ce pneu est déjà archivé."
            });
        }

        // Archivage logique : aucune donnée historique supprimée
        await pneu.update({
            isActive: false
        });

        return res.status(200).json({
            success: true,
            message: "Pneu archivé avec succès."
        });

    } catch (error) {
        console.error("Erreur archivage pneu :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible d'archiver le pneu."
        });
    }
};




// ========================================
// Analyser les dimensions des pneus
// ========================================
// ========================================
// Analyser les dimensions des pneus
// ========================================


const analyserDimension = (dimension) => {
    const valeur = String(dimension || "")
        .replace(/\u00A0/g, " ")
        .trim()
        .replace(/,/g, ".")
        .replace(/\s+/g, "")
        .toUpperCase();

    if (!valeur) return null;

    // Formats standards :
    // 205/55/16, 225/45R17, 225/45/17, 315/80/22.5
    let match = valeur.match(
        /^(\d{3})\/(\d{2})(?:\/|R)(\d{2}(?:\.\d)?)/
    );

    if (match) {
        return {
            largeur: Number(match[1]),
            hauteur: Number(match[2]),
            diametre: Number(match[3])
        };
    }

    // Formats à deux parties :
    // 9.5/17.5, 13/22.5, 5.00/12, 750/16C, 650/16
    match = valeur.match(
        /^(\d{1,3}(?:\.\d{1,2})?)\/(\d{2}(?:\.\d)?)(?:C)?(?:\b|$)/
    );

    if (match) {
        return {
            largeur: Number(match[1]),
            hauteur: null,
            diametre: Number(match[2])
        };
    }

    // Format non reconnu :
    // conserver la dimension originale et laisser les valeurs numériques nulles
    return {
        largeur: null,
        hauteur: null,
        diametre: null
    };
};




module.exports.importExcel = async (req, res) => {
    try {
        // ========================================
        // Vérifier le fichier Excel
        // ========================================

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Veuillez sélectionner un fichier Excel."
            });
        }

        const dryRun = req.query.dryRun === "true";

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            return res.status(400).json({
                success: false,
                message: "Aucune feuille Excel trouvée."
            });
        }

        // ========================================
        // Normaliser les en-têtes
        // ========================================

        const normaliserEntete = (value) =>
            String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\u00A0/g, " ")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "");

        const headers = {};

        worksheet.getRow(1).eachCell((cell, colNumber) => {
            const entete = normaliserEntete(cell.value);

            if (entete) {
                headers[entete] = colNumber;
            }
        });

        const obligatoires = [
            "dimension",
            "modele",
            "prixachatht",
            "marge",
            "marque",
            "stock"
        ];

        const manquantes = obligatoires.filter(
            colonne => !headers[colonne]
        );

        if (manquantes.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Certaines colonnes obligatoires sont manquantes.",
                colonnes: manquantes
            });
        }

        // ========================================
        // Fonctions de lecture Excel
        // ========================================

        const lireTexte = (value) => {
            if (value === null || value === undefined) {
                return "";
            }

            if (typeof value === "object" && value.richText) {
                value = value.richText
                    .map(part => part.text || "")
                    .join("");
            }

            if (typeof value === "object" && value.result !== undefined) {
                value = value.result;
            }

            return String(value)
                .replace(/\u00A0/g, " ")
                .trim();
        };

        const lireNombre = (value) => {
            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return null;
            }

            if (typeof value === "object" && value.result !== undefined) {
                value = value.result;
            }

            const texte = String(value)
                .replace(/\u00A0/g, "")
                .replace(/\s/g, "")
                .replace(",", ".");

            if (!texte) {
                return null;
            }

            const nombre = Number(texte);

            return Number.isFinite(nombre) ? nombre : NaN;
        };

        // ========================================
        // Normaliser les noms de marques
        // ========================================

        const normaliserNomMarque = (nom) => {
            return String(nom || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .replace(/\s+/g, " ")
                .toUpperCase();
        };

        // Alias pour corriger certaines fautes courantes
        const aliasMarques = {
            "BRIDGSTONE": "BRIDGESTONE",
            "BRIDGSTON": "BRIDGESTONE",
            "BRIGSTONE": "BRIDGESTONE",
            "MICHLIN": "MICHELIN",
            "MECHELIN": "MICHELIN",
            "MECHLIN": "MICHELIN",
            "SEMPIRIT": "SEMPERIT"
        };

        // Charger les marques existantes une seule fois
        const toutesLesMarques = await Marque.findAll();

        const marquesNormalisees = new Map();

        for (const item of toutesLesMarques) {
            marquesNormalisees.set(
                normaliserNomMarque(item.nom),
                item
            );
        }

        // ========================================
        // Préparer les listes
        // ========================================

       const pneus = [];
const misesAJour = [];
const erreurs = [];
const doublons = [];

const nouveauxPneus = [];
const pneusExistants = [];

        const pneusDuFichier = new Set();

        // ========================================
        // Parcourir les lignes Excel
        // ========================================

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);

            const get = (colonne) => {
                return headers[colonne]
                    ? row.getCell(headers[colonne]).value
                    : null;
            };

            const dimension = lireTexte(get("dimension"))
                .replace(/\u00A0/g, " ")
                .trim()
                .replace(/\s+/g, " ")
                .replace(/,/g, ".");

            const modele = lireTexte(get("modele"));
            const nomMarque = lireTexte(get("marque"));

            // Ignorer les lignes vides
            if (!dimension && !modele && !nomMarque) {
                continue;
            }

            // ========================================
            // Vérifier la dimension
            // ========================================

            const dimensions = analyserDimension(dimension);

            if (!dimensions) {
                erreurs.push(
                    `Ligne ${i} : dimension invalide (${dimension}).`
                );
                continue;
            }

            // ========================================
            // Vérifier modèle et marque
            // ========================================

            if (!modele || !nomMarque) {
                erreurs.push(
                    `Ligne ${i} : modèle ou marque manquant.`
                );
                continue;
            }

            // ========================================
            // Lire les données financières
            // ========================================

            const prixAchatHT = lireNombre(get("prixachatht"));
            const marge = lireNombre(get("marge"));
            const stock = lireNombre(get("stock"));

            const valeurRemise = get("remisefournisseur");
            const valeurTVA = get("tauxtva");

            const remiseFournisseur =
                valeurRemise === null ||
                valeurRemise === undefined ||
                valeurRemise === ""
                    ? 20
                    : lireNombre(valeurRemise);

            const tauxTVA =
                valeurTVA === null ||
                valeurTVA === undefined ||
                valeurTVA === ""
                    ? 19
                    : lireNombre(valeurTVA);

            if (
                prixAchatHT === null ||
                !Number.isFinite(prixAchatHT) ||
                prixAchatHT <= 0 ||
                marge === null ||
                !Number.isFinite(marge) ||
                stock === null ||
                !Number.isInteger(stock) ||
                stock < 0 ||
                remiseFournisseur === null ||
                !Number.isFinite(remiseFournisseur) ||
                tauxTVA === null ||
                !Number.isFinite(tauxTVA)
            ) {
                erreurs.push(
                    `Ligne ${i} : prix d'achat HT, marge, remise, TVA ou stock invalide.`
                );
                continue;
            }

            // ========================================
            // Rechercher la marque existante
            // ========================================

            const nomMarqueNormalise =
                normaliserNomMarque(nomMarque);

            const nomMarqueRecherche =
                aliasMarques[nomMarqueNormalise] ||
                nomMarqueNormalise;

            const marque =
                marquesNormalisees.get(nomMarqueRecherche) || null;

            if (!marque) {
                erreurs.push(
                    `Ligne ${i} : marque "${nomMarque}" introuvable parmi les marques existantes.`
                );
                continue;
            }

            // ========================================
            // Détecter les doublons dans le fichier
            // ========================================

            const clePneu = [
                marque.id,
                dimension.toLowerCase(),
                modele.toLowerCase()
            ].join("|");

            if (pneusDuFichier.has(clePneu)) {
                doublons.push(
                    `Ligne ${i} : ${nomMarque} ${modele} (${dimension}) apparaît plusieurs fois dans le fichier Excel.`
                );
                continue;
            }

            pneusDuFichier.add(clePneu);

            // ========================================
            // Chercher le pneu dans la base
            // ========================================

            const pneuExistant = await Pneu.findOne({
                where: {
                    marqueId: marque.id,
                    dimension: {
                        [Op.iLike]: dimension
                    },
                    modele: {
                        [Op.iLike]: modele
                    }
                }
            });

            // ========================================
            // Calculer les prix automatiquement
            // ========================================

            let tarification;

            try {
                tarification = calculerPrix({
                    prixAchatHT,
                    remiseFournisseur,
                    tauxTVA,
                    marge
                });
            } catch (error) {
                erreurs.push(`Ligne ${i} : ${error.message}`);
                continue;
            }

            // ========================================
            // Préparer les données du pneu
            // ========================================

            const donneesPneu = {
                modele,
                dimension,

                largeur: dimensions.largeur,
                hauteur: dimensions.hauteur,
                diametre: dimensions.diametre,

                saison: lireTexte(get("saison")) || null,
                description: lireTexte(get("description")) || null,

                // Le stock Excel remplace le stock existant
                stock,

                marqueId: marque.id,

                ...tarification
            };

            // ========================================
            // Pneu existant : préparer une mise à jour
            // ========================================

            if (pneuExistant) {

    misesAJour.push({
        id: pneuExistant.id,
        modele: pneuExistant.modele,
        dimension: pneuExistant.dimension,
        marque: marque.nom,
        stockActuel: pneuExistant.stock,
        nouveauStock: stock,
        donnees: donneesPneu
    });

    pneusExistants.push({
        ligne: i,
        id: pneuExistant.id,
        marque: marque.nom,
        modele,
        dimension,
        message: "Ce pneu existe déjà : ses informations seront mises à jour."
    });
}

            // ========================================
            // Nouveau pneu : préparer une insertion
            // ========================================
else {

    pneus.push({
        ...donneesPneu,
        image: null
    });

    nouveauxPneus.push({
        ligne: i,
        marque: marque.nom,
        modele,
        dimension,
        message: "Ce pneu n'existe pas : il sera ajouté."
    });
}
        }

        // ========================================
        // Arrêter si erreurs ou doublons
        // ========================================

        if (erreurs.length > 0 || doublons.length > 0) {
           
            return res.status(400).json({
                success: false,
                message: "Import interrompu : veuillez corriger les lignes signalées.",

                erreurs,
                doublons,
                 nouveauxPneus,
                  pneusExistants,

                nombreValide: pneus.length + misesAJour.length,
                nombreNouveaux: pneus.length,
                nombreMisesAJour: misesAJour.length,

                nombreErreurs: erreurs.length,
                nombreDoublons: doublons.length
            });
        }

        // ========================================
        // Vérifier qu'il y a des données
        // ========================================

        if (pneus.length === 0 && misesAJour.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Aucun pneu valide à importer ou à mettre à jour."
            });
        }

        // ========================================
        // MODE PRÉVISUALISATION
        // ========================================

        if (dryRun) {
            return res.status(200).json({
                success: true,
                mode: "prévisualisation",

                message: "Fichier vérifié avec succès. Aucune donnée n'a été enregistrée.",

                nombreNouveaux: pneus.length,
                nombreMisesAJour: misesAJour.length,
                nombreTotal: pneus.length + misesAJour.length,
                 nouveauxPneus,
                  pneusExistants,

                nouveauxPneus: pneus,
                pneusAMettreAJour: misesAJour
            });
        }

        // ========================================
        // IMPORTATION RÉELLE AVEC TRANSACTION
        // ========================================

        const transaction = await Pneu.sequelize.transaction();

        try {
            if (pneus.length > 0) {
                await Pneu.bulkCreate(pneus, {
                    transaction,
                    validate: true
                });
            }

            for (const item of misesAJour) {
                await Pneu.update(item.donnees, {
                    where: {
                        id: item.id
                    },
                    transaction,
                    validate: true
                });
            }

            await transaction.commit();

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        // ========================================
        // RÉSULTAT FINAL
        // ========================================

        return res.status(201).json({
            success: true,

            message: "Importation terminée avec succès.",

            nombreImporte: pneus.length,
            nombreMisAJour: misesAJour.length,
            nombreTotal: pneus.length + misesAJour.length,
             nouveauxPneus,
              pneusExistants
        });

    } catch (error) {
        console.error("Erreur import Excel :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de l'importation Excel.",
            error: error.message
        });

    } finally {
        // Supprimer le fichier temporaire
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
};




// ========================================
// Afficher les pneus archivés (ADMIN)
// ========================================

module.exports.getArchivedPneus = async (req, res) => {
    try {
        const pneus = await Pneu.findAll({
            where: {
                isActive: false
            },
            include: [
                {
                    model: Marque,
                    as: "marque",
                    attributes: ["id", "nom", "logo"]
                }
            ],
            order: [["id", "DESC"]]
        });

        return res.status(200).json({
            success: true,
            message: "Liste des pneus archivés récupérée avec succès.",
            pneus
        });

    } catch (error) {
        console.error("Erreur getArchivedPneus :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer les pneus archivés."
        });
    }
};



// ========================================
// Restaurer un pneu archivé (ADMIN)
// ========================================

module.exports.restorePneu = async (req, res) => {
    try {
        const { id } = req.params;

        const pneu = await Pneu.findByPk(id);

        if (!pneu) {
            return res.status(404).json({
                success: false,
                message: "Pneu introuvable."
            });
        }

        if (pneu.isActive) {
            return res.status(400).json({
                success: false,
                message: "Ce pneu est déjà actif."
            });
        }

        await pneu.update({
            isActive: true
        });

        return res.status(200).json({
            success: true,
            message: "Pneu restauré avec succès.",
            pneu
        });

    } catch (error) {
        console.error("Erreur restorePneu :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de restaurer le pneu."
        });
    }
};