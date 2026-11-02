
const {
    Avis,
    AvisLike,
    ReponseAvis,
    User
} = require("../models/associations");

// ========================================
// 1. Ajouter ou retirer un like
// POST /avis/:avisId/like
// ========================================
const toggleLike = async (req, res) => {
    try {
        const avisId = Number(req.params.avisId);
        const userId = Number(req.userId);

        const avis = await Avis.findByPk(avisId);

        if (!avis) {
            return res.status(404).json({
                success: false,
                message: "Avis introuvable"
            });
        }

        const likeExistant = await AvisLike.findOne({
            where: { avisId, userId }
        });

        let liked;

        if (likeExistant) {
            await likeExistant.destroy();
            liked = false;
        } else {
            await AvisLike.create({ avisId, userId });
            liked = true;
        }

        const likesCount = await AvisLike.count({
            where: { avisId }
        });

        return res.status(200).json({
            success: true,
            liked,
            likesCount,
            message: liked
                ? "Vous aimez cet avis"
                : "Vous n'aimez plus cet avis"
        });
    } catch (error) {
        console.error("Erreur toggleLike :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la gestion du like"
        });
    }
};

// ========================================
// 2. Ajouter une réponse à un avis
// POST /avis/:avisId/reponses
// ========================================
const ajouterReponse = async (req, res) => {
    try {
        const avisId = Number(req.params.avisId);
        const userId = Number(req.userId);
        const { contenu } = req.body;

        if (typeof contenu !== "string" || !contenu.trim()) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir une réponse"
            });
        }

        if (contenu.trim().length > 2000) {
            return res.status(400).json({
                success: false,
                message: "La réponse ne doit pas dépasser 2000 caractères"
            });
        }

        const avis = await Avis.findByPk(avisId);

        if (!avis) {
            return res.status(404).json({
                success: false,
                message: "Avis introuvable"
            });
        }

        const reponse = await ReponseAvis.create({
            avisId,
            userId,
            contenu: contenu.trim()
        });

        const reponseComplete = await ReponseAvis.findByPk(reponse.id, {
            include: [{
                model: User,
                as: "auteur",
                attributes: ["id", "nom", "prenom", "role"]
            }]
        });

        return res.status(201).json({
            success: true,
            message: "Réponse ajoutée avec succès",
            reponse: reponseComplete
        });
    } catch (error) {
        console.error("Erreur ajouterReponse :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout de la réponse"
        });
    }
};

// ========================================
// 3. Modifier sa propre réponse
// PUT /avis/reponses/:reponseId
// ========================================
const modifierReponse = async (req, res) => {
    try {
        const reponseId = Number(req.params.reponseId);
        const userId = Number(req.userId);
        const { contenu } = req.body;

        if (typeof contenu !== "string" || !contenu.trim()) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir une réponse"
            });
        }

        if (contenu.trim().length > 2000) {
            return res.status(400).json({
                success: false,
                message: "La réponse ne doit pas dépasser 2000 caractères"
            });
        }

        const reponse = await ReponseAvis.findByPk(reponseId);

        if (!reponse) {
            return res.status(404).json({
                success: false,
                message: "Réponse introuvable"
            });
        }

        if (Number(reponse.userId) !== userId) {
            return res.status(403).json({
                success: false,
                message: "Vous ne pouvez modifier que vos propres réponses"
            });
        }

        reponse.contenu = contenu.trim();
        await reponse.save();

        return res.status(200).json({
            success: true,
            message: "Réponse modifiée avec succès",
            reponse
        });
    } catch (error) {
        console.error("Erreur modifierReponse :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la modification de la réponse"
        });
    }
};

// ========================================
// 4. Supprimer sa réponse ou modérer comme admin
// DELETE /avis/reponses/:reponseId
// ========================================
const supprimerReponse = async (req, res) => {
    try {
        const reponseId = Number(req.params.reponseId);
        const userId = Number(req.userId);

        const reponse = await ReponseAvis.findByPk(reponseId);

        if (!reponse) {
            return res.status(404).json({
                success: false,
                message: "Réponse introuvable"
            });
        }

        const utilisateur = await User.findByPk(userId);

        if (!utilisateur) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        const estAuteur = Number(reponse.userId) === userId;
        const estAdmin = utilisateur.role === "admin";

        if (!estAuteur && !estAdmin) {
            return res.status(403).json({
                success: false,
                message: "Vous ne pouvez pas supprimer cette réponse"
            });
        }

        await reponse.destroy();

        return res.status(200).json({
            success: true,
            message: "Réponse supprimée avec succès"
        });
    } catch (error) {
        console.error("Erreur supprimerReponse :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression de la réponse"
        });
    }
};

module.exports = {
    toggleLike,
    ajouterReponse,
    modifierReponse,
    supprimerReponse
};