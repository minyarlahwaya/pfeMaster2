
const sequelize = require("../db/db");
const { envoyerNotificationTelegram } = require("../services/telegramService");
const { envoyerFactureCommandeConfirmee } = require("../services/factureEmailService");

const User = require("../models/UserModel");
const Pneu = require("../models/PneuModel");
const Marque = require("../models/MarqueModel");
const Vehicule = require("../models/VehiculeModel");
const VehiculePneu = require("../models/VehiculePneuModel");

const Commande = require("../models/Commande");
const CommandeItem = require("../models/CommandeItem");
const Promotion = require("../models/PromotionModel");
const Facture = require("../models/FactureModel");


// ========================================
// CRÉER UNE COMMANDE
// ========================================



module.exports.createCommande = async (req, res) => {

    let transaction;

    try {

        // ========================================
        // DÉMARRER LA TRANSACTION
        // ========================================

        transaction = await sequelize.transaction();

        // ========================================
        // UTILISATEUR CONNECTÉ
        // ========================================

        const userId = req.userId;

        console.log("Utilisateur connecté :", userId);

        const user = await User.findByPk(userId, {
            transaction
        });

        if (!user) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        // ========================================
        // RÉCUPÉRER LE PANIER
        // ========================================

        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                success: false,
                message: "Le panier est vide."
            });
        }

        // ========================================
        // INITIALISER LES VARIABLES
        // ========================================

        let sousTotal = 0;
        let quantiteTotale = 0;
        let remisePourcentage = 0;
        let remiseMontant = 0;
        let typeRemise = "aucune";
        let total = 0;

        const produits = [];

        // ========================================
        // PARCOURIR LES ARTICLES DU PANIER
        // ========================================

        for (const item of items) {

            if (
                !item.pneuId ||
                item.quantite === undefined ||
                item.quantite === null
            ) {
                await transaction.rollback();
                transaction = null;

                return res.status(400).json({
                    success: false,
                    message: "pneuId et quantite sont obligatoires."
                });
            }

            // ========================================
            // VALIDER LA QUANTITÉ
            // ========================================

            const quantite = Number(item.quantite);

            if (
                !Number.isSafeInteger(quantite) ||
                quantite <= 0
            ) {
                await transaction.rollback();
                transaction = null;

                return res.status(400).json({
                    success: false,
                    message: "La quantité est invalide."
                });
            }

            // ========================================
            // RÉCUPÉRER LE PNEU
            // ========================================

            const pneu = await Pneu.findByPk(item.pneuId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!pneu) {
                await transaction.rollback();
                transaction = null;

                return res.status(404).json({
                    success: false,
                    message: `Pneu ${item.pneuId} introuvable.`
                });
            }

            // ========================================
            // VÉRIFIER LE STOCK
            // ========================================

            if (Number(pneu.stock) < quantite) {
                await transaction.rollback();
                transaction = null;

                return res.status(400).json({
                    success: false,
                    message: `Stock insuffisant pour ${pneu.modele}.`
                });
            }

            // ========================================
            // RECHERCHER LA PROMOTION
            // ========================================

            const maintenant = new Date();

            const promotion = await Promotion.findOne({
                where: {
                    pneuId: pneu.id,
                    active: true
                },
                transaction
            });

            // ========================================
            // CALCULER LE PRIX
            // ========================================

            const prixOriginal = Number(pneu.prix);

            if (!Number.isFinite(prixOriginal) || prixOriginal < 0) {
                throw new Error(
                    `Prix invalide pour le pneu ${pneu.id}.`
                );
            }

            let prixFinal = prixOriginal;
            let pourcentagePromotion = 0;

            if (promotion) {

                const dateDebut = new Date(promotion.dateDebut);
                const dateFin = new Date(promotion.dateFin);

                const pourcentage = Number(promotion.pourcentage);

                const datesValides =
                    !Number.isNaN(dateDebut.getTime()) &&
                    !Number.isNaN(dateFin.getTime());

                const pourcentageValide =
                    Number.isFinite(pourcentage) &&
                    pourcentage >= 0 &&
                    pourcentage <= 100;

                if (
                    datesValides &&
                    pourcentageValide &&
                    maintenant >= dateDebut &&
                    maintenant <= dateFin
                ) {

                    pourcentagePromotion = pourcentage;

                    prixFinal = Number(
                        (
                            prixOriginal -
                            (prixOriginal * pourcentagePromotion / 100)
                        ).toFixed(2)
                    );

                    console.log(
                        `Promotion appliquée au pneu ${pneu.id} :`,
                        pourcentagePromotion,
                        "%"
                    );
                }
            }

            // ========================================
            // CALCULER LE SOUS-TOTAL
            // APRÈS PROMOTIONS INDIVIDUELLES
            // ========================================

            sousTotal += Number(
                (prixFinal * quantite).toFixed(2)
            );

            quantiteTotale += quantite;

            // ========================================
            // STOCKER LES PRODUITS
            // ========================================

            produits.push({
                pneu,
                quantite,
                prixOriginal,
                prixFinal,
                pourcentagePromotion
            });
        }

        // ========================================
        // ARRONDIR LE SOUS-TOTAL
        // ========================================

        sousTotal = Number(sousTotal.toFixed(2));

        // ========================================
        // DÉTERMINER LE TYPE DE CLIENT
        // ========================================

        const typeClient = String(
            user.typeClient || ""
        ).toLowerCase().trim();

        // ========================================
        // REMISE CLIENT PARTICULIER
        // À PARTIR DE 4 PNEUS
        // ========================================

        if (
            typeClient === "particulier" &&
            quantiteTotale >= 4
        ) {

            remisePourcentage = 5;
            typeRemise = "particulier";

        }

        // ========================================
        // REMISE CLIENT PROFESSIONNEL
        // À PARTIR DE 10 PNEUS
        // ========================================

        else if (
            typeClient === "professionnel" &&
            quantiteTotale >= 10
        ) {

            remisePourcentage = 10;
            typeRemise = "professionnel";

        }

        // ========================================
        // CALCULER LE MONTANT DE LA REMISE
        // ========================================

        remiseMontant = Number(
            (
                sousTotal * remisePourcentage / 100
            ).toFixed(2)
        );

        // ========================================
        // CALCULER LE TOTAL FINAL
        // ========================================

        total = Number(
            (sousTotal - remiseMontant).toFixed(2)
        );

        // ========================================
        // AFFICHER LES INFORMATIONS
        // ========================================

        console.log("========== REMISE COMMANDE ==========");

        console.log("CLIENT :", user.prenom, user.nom);
        console.log("TYPE CLIENT :", typeClient);
        console.log("QUANTITÉ TOTALE :", quantiteTotale);
        console.log("SOUS-TOTAL :", sousTotal);
        console.log("REMISE :", remisePourcentage, "%");
        console.log("MONTANT REMISE :", remiseMontant);
        console.log("TOTAL FINAL :", total);

        console.log("=====================================");

        // ========================================
        // CRÉER LA COMMANDE
        // ========================================

        const commande = await Commande.create({

            userId: user.id,

            nom: user.nom,
            prenom: user.prenom,
            telephone: user.telephone,
            adresse: user.adresse,
            ville: user.ville,
            codePostal: user.codePostal,

            sousTotal,
            remisePourcentage,
            remiseMontant,
            typeRemise,

            total,

            statut: "en attente"

        }, {
            transaction
        });

        // ========================================
        // CRÉER LES ARTICLES ET DIMINUER LE STOCK
        // ========================================

        for (const produit of produits) {

            await CommandeItem.create({

                commandeId: commande.id,

                pneuId: produit.pneu.id,

                quantite: produit.quantite,

                prix: produit.prixFinal,

                prixOriginal: produit.prixOriginal,

                pourcentagePromotion: produit.pourcentagePromotion

            }, {
                transaction
            });

            await produit.pneu.update({

                stock: Number(produit.pneu.stock) - produit.quantite

            }, {
                transaction
            });
        }

        // ========================================
        // VALIDER LA TRANSACTION
        // ========================================

        await transaction.commit();
        transaction = null;

        // ========================================
        // NOTIFICATION TELEGRAM
        // ========================================

        const messageTelegram =

            `🛒 NOUVELLE COMMANDE - LANDOLSI TIRES\n\n` +

            `📦 Commande n° : ${commande.id}\n` +

            `👤 Client : ${user.prenom} ${user.nom}\n` +

            `🏷️ Type client : ${typeClient}\n` +

            `📞 Téléphone : ${user.telephone || "Non renseigné"}\n` +

            `📦 Quantité : ${quantiteTotale} pneus\n` +

            `💰 Sous-total : ${sousTotal.toFixed(2)} DT\n` +

            `🎁 Remise : ${remisePourcentage}%\n` +

            `💵 Montant remise : ${remiseMontant.toFixed(2)} DT\n` +

            `💰 Total final : ${total.toFixed(2)} DT\n` +

            `📌 Statut : ${commande.statut}\n\n` +

            `Le client récupérera sa commande chez LANDOLSI TIRES.`;

        try {

            await envoyerNotificationTelegram(messageTelegram);

        } catch (telegramError) {

            console.error(
                "Erreur notification Telegram :",
                telegramError.message
            );

        }

        // ========================================
        // RÉPONSE
        // ========================================

        return res.status(201).json({

            success: true,

            message: "Commande créée avec succès.",

            commande: {

                id: commande.id,

                sousTotal: commande.sousTotal,

                remisePourcentage: commande.remisePourcentage,

                remiseMontant: commande.remiseMontant,

                typeRemise: commande.typeRemise,

                total: commande.total,

                statut: commande.statut

            }

        });

    } catch (error) {

        console.error(
            "Erreur création commande :",
            error
        );

        // ========================================
        // ANNULER LA TRANSACTION SI NÉCESSAIRE
        // ========================================

        if (transaction) {

            try {

                await transaction.rollback();

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError
                );

            }
        }

        return res.status(500).json({

            success: false,

            message: "Impossible de créer la commande.",

            error: error.message

        });
    }
};

// ========================================
// RÉCUPÉRER UNE COMMANDE PAR ID
// ========================================

module.exports.getCommandeById = async (req, res) => {

    try {

        const { id } = req.params;

        const userId =
            req.userId;


        // ========================================
        // VÉRIFIER L'UTILISATEUR
        // ========================================

        const user =
            await User.findByPk(userId);

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable."

            });

        }


        // ========================================
        // RÉCUPÉRER LA COMMANDE
        // ========================================

        const commande =
            await Commande.findOne({

                where: {

                    id:
                        id,

                    userId:
                        userId

                },

                include: [

                    {

                        model:
                            CommandeItem,

                        as:
                            "items",

                        include: [

                            {

                                model:
                                    Pneu,

                                as:
                                    "pneu",

                                attributes: [

                                    "id",

                                    "modele",

                                    "dimension",

                                    "saison",

                                    "prix",

                                    "image"

                                ],

                                include: [

                                    {

                                        model:
                                            Marque,

                                        as:
                                            "marque",

                                        attributes: [

                                            "id",

                                            "nom"

                                        ]

                                    }

                                ]

                            }

                        ]

                    }

                ]

            });


        // ========================================
        // COMMANDE INTROUVABLE
        // ========================================

        if (!commande) {

            return res.status(404).json({

                success: false,

                message:
                    "Commande introuvable."

            });

        }


        // ========================================
        // RÉPONSE
        // ========================================

        return res.status(200).json({

            success: true,

            commande:
                commande

        });


    } catch (error) {

        console.error(
            "❌ Erreur récupération commande :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer la commande.",

            error:
                error.message

        });

    }

};


// ========================================
// MES COMMANDES
// ========================================

module.exports.getMesCommandes = async (req, res) => {

    try {

        const userId =
            req.userId;


        console.log(
            "🔥 Récupération commandes utilisateur :",
            userId
        );


        const commandes =
            await Commande.findAll({

                where: {

                    userId:
                        userId

                },

                include: [

                    {

                        model:
                            CommandeItem,

                        as:
                            "items",

                        include: [

                            {

                                model:
                                    Pneu,

                                as:
                                    "pneu",

                                attributes: [

                                    "id",

                                    "modele",

                                    "dimension",

                                    "saison",

                                    "prix",

                                    "image"

                                ],

                                include: [

                                    {

                                        model:
                                            Marque,

                                        as:
                                            "marque",

                                        attributes: [

                                            "id",

                                            "nom"

                                        ]

                                    }

                                ]

                            }

                        ]

                    }

                ],

                order: [

                    [

                        "createdAt",

                        "DESC"

                    ]

                ]

            });


        console.log(
            "🔥 Nombre de commandes :",
            commandes.length
        );


        return res.status(200).json({

            success: true,

            count:
                commandes.length,

            commandes:
                commandes

        });


    } catch (error) {

        console.error(
            "❌ ERREUR MES COMMANDES :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer vos commandes.",

            error:
                error.message

        });

    }

};



// ========================================
// RÉCUPÉRER TOUTES LES COMMANDES - ADMIN
// ========================================

// ========================================
// Récupérer toutes les commandes - ADMIN
// ========================================

module.exports.getAllCommandesAdmin = async (req, res) => {
    try {

        const commandes = await Commande.findAll({

            include: [

                // ========================================
                // Produits de la commande
                // ========================================

                {
                    model: CommandeItem,
                    as: "items",

                    include: [

                        {
                            model: Pneu,
                            as: "pneu",

                            attributes: [
                                "id",
                                "modele",
                                "dimension",
                                "saison",
                                "prix",
                                "image"
                            ],

                            include: [

                                {
                                    model: Marque,
                                    as: "marque",

                                    attributes: [
                                        "id",
                                        "nom"
                                    ]
                                }

                            ]
                        }

                    ]
                },


                // ========================================
                // Client de la commande
                // ========================================

                {
                    model: User,
                    as: "user",

                    attributes: [
                        "id",
                        "nom",
                        "prenom",
                        "email",
                        "telephone",
                        "typeClient",
                        "numeroTVA",
                        "secteur"
                    ]
                },


                // ========================================
                // Facture de la commande
                // ========================================

                {
                    model: Facture,
                    as: "facture",

                    attributes: [
                        "id",
                        "numeroFacture",
                        "dateFacture",
                        "statut"
                    ]
                }

            ],


            // ========================================
            // Plus récente commande en premier
            // ========================================

            order: [
                [
                    "createdAt",
                    "DESC"
                ]
            ]

        });


        console.log(
            "🔥 Nombre total de commandes :",
            commandes.length
        );


        return res.status(200).json({

            success: true,

            count: commandes.length,

            commandes: commandes

        });


    } catch (error) {

        console.error(
            "❌ Erreur récupération commandes admin :",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Impossible de récupérer les commandes.",

            error: error.message

        });

    }
};

// ==================================================
// ADMIN : MODIFIER LE STATUT D'UNE COMMANDE
// ==================================================

// ==================================================
// ADMIN : MODIFIER LE STATUT D'UNE COMMANDE
// ==================================================

module.exports.updateStatutCommande = async (req, res) => {

    try {

        const { id } = req.params;
        const { statut } = req.body;


        // ========================================
        // STATUTS AUTORISÉS
        // ========================================

        const statutsAutorises = [
            "attente",
            "confirmée",
            "en préparation",
            "récupéréen e",
            "annulée"
        ];


        // ========================================
        // VÉRIFIER LE STATUT
        // ========================================

        if (!statutsAutorises.includes(statut)) {

            return res.status(400).json({

                success: false,

                message:
                    "Statut de commande invalide."

            });

        }


        // ========================================
        // CHERCHER LA COMMANDE
        // ========================================

        const commande = await Commande.findByPk(id);



        if (!commande) {





            return res.status(404).json({

                success: false,

                message:
                    "Commande introuvable."

            });

        }

        // MÉMORISER L'ANCIEN STATUT
        const ancienStatut = commande.statut;
        // ========================================
        // MODIFIER LE STATUT DE LA COMMANDE
        // ========================================

        commande.statut = statut;

        await commande.save();


        // ========================================
        // CRÉER LA FACTURE SI COMMANDE CONFIRMÉE
        // ========================================

        let facture = null;


        if (statut === "confirmée") {


            // ========================================
            // VÉRIFIER SI UNE FACTURE EXISTE DÉJÀ
            // ========================================

            facture =
                await Facture.findOne({

                    where: {

                        commandeId:
                            commande.id

                    }

                });


            // ========================================
            // CRÉER LA FACTURE SI ELLE N'EXISTE PAS
            // ========================================

            if (!facture) {

                const annee =
                    new Date().getFullYear();


                const numeroFacture =
                    `FAC-${annee}-${String(commande.id).padStart(4, "0")}`;


                facture =
                    await Facture.create({

                        commandeId:
                            commande.id,

                        numeroFacture:
                            numeroFacture,

                        dateFacture:
                            new Date(),

                        statut:
                            "confirmée"

                    });

            }

        }

        // ========================================
        // E-MAIL AU CLIENT : FACTURE + COMMANDE PRÊTE AU RETRAIT
        // Uniquement au passage à « confirmée » (pas de renvoi si
        // l'administrateur réenregistre le même statut).
        // ========================================

        let emailFacture = null;

        if (statut === "confirmée" && ancienStatut !== "confirmée" && facture) {

            emailFacture =
                await envoyerFactureCommandeConfirmee(commande);

        }


        // NOTIFICATION TELEGRAM - CHANGEMENT DE STATUT
        if (ancienStatut !== commande.statut) {
            const messageTelegram =
    `🔔 CHANGEMENT DE STATUT - LANDOLSI TIRES\n\n` +
    `📦 Commande n° : ${commande.id}\n` +
    `👤 Client : ${commande.prenom} ${commande.nom}\n` +
    `🔄 Ancien statut : ${ancienStatut}\n` +
    `✅ Nouveau statut : ${commande.statut}\n` +
    `💰 Total : ${Number(commande.total).toFixed(2)} DT\n\n` +
    `🏪 Retrait en magasin : LANDOLSI TIRES, Msaken`;

            await envoyerNotificationTelegram(messageTelegram);
        }


        // ========================================
        // RÉPONSE
        // ========================================

        return res.status(200).json({

            success: true,

            message:
                "Statut de la commande modifié avec succès.",

            commande:
                commande,

            facture:
                facture,

            emailFacture:
                emailFacture

        });


    } catch (error) {


        console.error(

            "❌ Erreur modification statut commande :",

            error

        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de modifier le statut de la commande.",

            error:
                error.message

        });

    }

};



// ==================================================
// ADMIN : SUPPRIMER UNE COMMANDE
// ==================================================

module.exports.deleteCommande = async (req, res) => {

    try {

        const { id } = req.params;

        // Chercher la commande
        const commande = await Commande.findByPk(id);

        if (!commande) {

            return res.status(404).json({
                success: false,
                message: "Commande introuvable."
            });

        }

        // Supprimer les lignes de la commande
        await CommandeItem.destroy({
            where: {
                commandeId: id
            }
        });

        // Supprimer la commande
        await commande.destroy();

        return res.status(200).json({
            success: true,
            message: "Commande supprimée avec succès."
        });

    } catch (error) {

        console.error(
            "❌ Erreur suppression commande :",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Impossible de supprimer la commande.",
            error: error.message
        });

    }

};