
const {
    Avis,
    AvisLike,
    ReponseAvis,
    User,
    Pneu,
    Commande,
    CommandeItem
} = require("../models/associations");

const {
    envoyerNotificationTelegram
} = require("../services/telegramService");


// ========================================
// Ajouter un avis
// ========================================

const createAvis = async (req, res) => {
    try {
        const userId = req.userId;
        const { commandeId, pneuId, note, commentaire } = req.body;

        if (
            !commandeId ||
            !pneuId ||
            note === undefined ||
            note === null ||
            note === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "La commande, le pneu et la note sont obligatoires."
            });
        }

        const noteNombre = Number(note);

        if (
            !Number.isInteger(noteNombre) ||
            noteNombre < 1 ||
            noteNombre > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "La note doit être un nombre entier entre 1 et 5."
            });
        }

        if (
            commentaire !== undefined &&
            commentaire !== null &&
            typeof commentaire !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Le commentaire doit être un texte."
            });
        }

        // Vérifier que la commande appartient au client connecté
        const commande = await Commande.findOne({
            where: {
                id: commandeId,
                userId
            }
        });

        if (!commande) {
            return res.status(404).json({
                success: false,
                message: "Commande introuvable ou non autorisée."
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        // Vérifier le statut de la commande
        const statutsAutorises = [
            "confirmée",
            "expédiée",
            "livrée"
        ];

        if (!statutsAutorises.includes(commande.statut)) {
            return res.status(400).json({
                success: false,
                message:
                    "Vous pourrez laisser un avis lorsque votre commande sera confirmée."
            });
        }

        // Vérifier que le pneu figure dans la commande
        const articleAchete = await CommandeItem.findOne({
            where: {
                commandeId: commande.id,
                pneuId: Number(pneuId)
            }
        });

        if (!articleAchete) {
            return res.status(403).json({
                success: false,
                message:
                    "Vous ne pouvez pas évaluer un pneu qui ne figure pas dans cette commande."
            });
        }

        // Créer l'avis
        const avis = await Avis.create({
            userId,
            commandeId: commande.id,
            pneuId: Number(pneuId),
            note: noteNombre,
            commentaire:
                typeof commentaire === "string"
                    ? commentaire.trim() || null
                    : null
        });

        // Notification Telegram
        try {
            const nomClient = `${user.prenom} ${user.nom}`;

            const messageTelegram =
                `⭐ NOUVEL AVIS - LANDOLSI TIRES\n\n` +
                `👤 Client : ${nomClient}\n` +
                `📦 Commande n° : ${commande.id}\n` +
                `🛞 Pneu n° : ${pneuId}\n` +
                `⭐ Note : ${noteNombre}/5\n` +
                `💬 Commentaire : ${
                    typeof commentaire === "string" && commentaire.trim()
                        ? commentaire.trim()
                        : "Aucun commentaire écrit"
                }`;

            await envoyerNotificationTelegram(messageTelegram);
        } catch (telegramError) {
            console.error(
                "Erreur notification Telegram avis :",
                telegramError.message
            );
        }

        // Retourner l'avis avec ses informations
        const avisAvecDetails = await Avis.findByPk(avis.id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nom", "prenom"]
                },
                {
                    model: Pneu,
                    as: "pneu"
                }
            ]
        });

        return res.status(201).json({
            success: true,
            message: "Votre avis a été ajouté avec succès.",
            avis: avisAvecDetails
        });
    } catch (error) {
        console.error("Erreur création avis :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible d'ajouter l'avis.",
            error: error.message
        });
    }
};


// ========================================
// Récupérer les avis d'une commande
// ========================================

const getAvisByCommande = async (req, res) => {
    try {
        const userId = req.userId;
        const { commandeId } = req.params;

        const commande = await Commande.findOne({
            where: {
                id: commandeId,
                userId
            }
        });

        if (!commande) {
            return res.status(404).json({
                success: false,
                message: "Commande introuvable ou non autorisée."
            });
        }

        const avis = await Avis.findAll({
            where: {
                commandeId: commande.id,
                userId
            },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nom", "prenom"]
                },
                {
                    model: Pneu,
                    as: "pneu"
                },
                {
                    model: AvisLike,
                    as: "likes",
                    attributes: ["id", "userId"]
                },
                {
                    model: ReponseAvis,
                    as: "reponses",
                    include: [
                        {
                            model: User,
                            as: "auteur",
                            attributes: ["id", "nom", "prenom", "role"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]],
            distinct: true
        });

        const avisFormates = avis.map((item) => {
            const donnees = item.toJSON();
            const likes = donnees.likes || [];

            return {
                ...donnees,
                likesCount: likes.length,
                aimeParUtilisateur: likes.some(
                    (like) => Number(like.userId) === Number(userId)
                )
            };
        });

        return res.status(200).json({
            success: true,
            existe: avisFormates.length > 0,
            count: avisFormates.length,
            avis: avisFormates
        });
    } catch (error) {
        console.error("Erreur récupération avis commande :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer les avis.",
            error: error.message
        });
    }
};


// ========================================
// Afficher tous les avis
// ========================================

const getAllAvis = async (req, res) => {
    try {
        const avis = await Avis.findAll({
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nom", "prenom"]
                },
                {
                    model: Pneu,
                    as: "pneu"
                },
                {
                    model: AvisLike,
                    as: "likes",
                    attributes: ["id", "userId"]
                },
                {
                    model: ReponseAvis,
                    as: "reponses",
                    include: [
                        {
                            model: User,
                            as: "auteur",
                            attributes: ["id", "nom", "prenom", "role"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]],
            distinct: true
        });

        const avisFormates = avis.map((item) => {
            const donnees = item.toJSON();
            const likes = donnees.likes || [];

            return {
                ...donnees,
                likesCount: likes.length
            };
        });

        return res.status(200).json({
            success: true,
            count: avisFormates.length,
            avis: avisFormates
        });
    } catch (error) {
        console.error("Erreur récupération avis :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer les avis.",
            error: error.message
        });
    }
};










 // ========================================
 // Récupérer les avis publics
 // ========================================

const getPublicAvis = async (req, res) => {
    try {
        const avis = await Avis.findAll({
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nom", "prenom"]
                },
                {
                    model: Pneu,
                    as: "pneu"
                },
                {
                    model: ReponseAvis,
                    as: "reponses",
                    include: [
                        {
                            model: User,
                            as: "auteur",
                            attributes: ["id", "nom", "prenom", "role"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]],
            distinct: true
        });

        return res.status(200).json({
            success: true,
            count: avis.length,
            avis
        });

    } catch (error) {
        console.error("Erreur récupération avis publics :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer les avis."
        });
    }
};

// ========================================
// Supprimer un avis
// Le client supprime son propre avis.
// L'administrateur peut supprimer tous les avis.
// ========================================

// ========================================
// Récupérer les avis d'un pneu
// ========================================

const getAvisByPneu = async (req, res) => {
    try {
        const { pneuId } = req.params;

        if (
            !Number.isInteger(Number(pneuId)) ||
            Number(pneuId) < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Identifiant du pneu invalide."
            });
        }

        const pneu = await Pneu.findByPk(Number(pneuId));

        if (!pneu) {
            return res.status(404).json({
                success: false,
                message: "Pneu introuvable."
            });
        }

        // Cette route est publique. Si le middleware d'authentification
        // optionnel a renseigné req.userId, on l'utilise.
        const userId = req.userId ? Number(req.userId) : null;

        const avis = await Avis.findAll({
            where: {
                pneuId: Number(pneuId)
            },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nom", "prenom"]
                },
                {
                    model: AvisLike,
                    as: "likes",
                    attributes: ["id", "userId"]
                },
                {
                    model: ReponseAvis,
                    as: "reponses",
                    include: [
                        {
                            model: User,
                            as: "auteur",
                            attributes: ["id", "nom", "prenom", "role"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]],
            distinct: true
        });

        const avisFormates = avis.map((item) => {
            const donnees = item.toJSON();
            const likes = donnees.likes || [];

            return {
                ...donnees,
                likesCount: likes.length,
                aimeParUtilisateur: userId !== null
                    ? likes.some(
                        (like) => Number(like.userId) === userId
                    )
                    : false
            };
        });

        return res.status(200).json({
            success: true,
            count: avisFormates.length,
            avis: avisFormates
        });
    } catch (error) {
        console.error("Erreur récupération avis du pneu :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer les avis du pneu.",
            error: error.message
        });
    }
};


// ========================================
// Modifier un avis
// Le client modifie son propre avis.
// L'administrateur peut modifier tous les avis.
// ========================================

/* ========================================
   Modifier un avis
======================================== */
const modifierAvis = async (req, res) => {
    try {
        const avisId = Number(req.params.id);
        const userId = Number(req.userId);
        const { note, commentaire } = req.body;

        if (
            !Number.isInteger(avisId) ||
            avisId < 1 ||
            !Number.isInteger(userId) ||
            userId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Identifiant invalide."
            });
        }

        const avis = await Avis.findByPk(avisId);

        if (!avis) {
            return res.status(404).json({
                success: false,
                message: "Avis introuvable."
            });
        }

        const utilisateur = await User.findByPk(userId);

        if (!utilisateur) {
            return res.status(401).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        const estAuteur = Number(avis.userId) === userId;
        const estAdmin = utilisateur.role === "admin";

        if (!estAuteur && !estAdmin) {
            return res.status(403).json({
                success: false,
                message: "Vous ne pouvez modifier que votre propre avis."
            });
        }

        // Au moins un champ doit être fourni.
        if (note === undefined && commentaire === undefined) {
            return res.status(400).json({
                success: false,
                message: "Aucune modification fournie."
            });
        }

        if (note !== undefined) {
            const noteNombre = Number(note);

            if (
                !Number.isInteger(noteNombre) ||
                noteNombre < 1 ||
                noteNombre > 5
            ) {
                return res.status(400).json({
                    success: false,
                    message: "La note doit être un entier entre 1 et 5."
                });
            }

            avis.note = noteNombre;
        }

        if (commentaire !== undefined) {
            if (
                typeof commentaire !== "string" ||
                commentaire.length > 2000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Le commentaire doit être un texte de 2000 caractères maximum."
                });
            }

            avis.commentaire = commentaire.trim() || null;
        }

        await avis.save();

        return res.status(200).json({
            success: true,
            message: "Avis modifié avec succès.",
            avis
        });

    } catch (error) {
        console.error("Erreur modification avis :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de modifier l'avis."
        });
    }
};


/* ========================================
   Supprimer un avis
======================================== */
const deleteAvis = async (req, res) => {
    try {
        const avisId = Number(req.params.id);
        const userId = Number(req.userId);

        if (
            !Number.isInteger(avisId) ||
            avisId < 1 ||
            !Number.isInteger(userId) ||
            userId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Identifiant invalide."
            });
        }

        const avis = await Avis.findByPk(avisId);

        if (!avis) {
            return res.status(404).json({
                success: false,
                message: "Avis introuvable."
            });
        }

        const utilisateur = await User.findByPk(userId);

        if (!utilisateur) {
            return res.status(401).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        const estAuteur = Number(avis.userId) === userId;
        const estAdmin = utilisateur.role === "admin";

        if (!estAuteur && !estAdmin) {
            return res.status(403).json({
                success: false,
                message: "Vous ne pouvez supprimer que vos propres avis."
            });
        }

        await avis.destroy();

        return res.status(200).json({
            success: true,
            message: "Avis supprimé avec succès."
        });

    } catch (error) {
        console.error("Erreur suppression avis :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de supprimer l'avis. Vérifiez également les relations avec les likes et les réponses."
        });
    }
};

// ========================================
// Export des fonctions
// ========================================

module.exports = {
    createAvis,
    getAvisByCommande,
    getAllAvis,
     getPublicAvis,
    deleteAvis,
    getAvisByPneu,
     modifierAvis
};
