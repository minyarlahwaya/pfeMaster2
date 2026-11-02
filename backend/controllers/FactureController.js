
const Facture = require("../models/FactureModel");
const Commande = require("../models/Commande");
const CommandeItem = require("../models/CommandeItem");
const Pneu = require("../models/PneuModel");
const Marque = require("../models/MarqueModel");
const PDFDocument = require("pdfkit");
const { User } = require("../models/associations");


// ========================================
// CHARGER UNE FACTURE AVEC SA COMMANDE ET SES ARTICLES
// ========================================

const chargerFacture = (commandeId) => Facture.findOne({
    where: { commandeId },
    include: [
        {
            model: Commande,
            as: "commande",
            include: [
                {
                    model: CommandeItem,
                    as: "items",
                    include: [
                        {
                            model: Pneu,
                            as: "pneu",
                            include: [
                                { model: Marque, as: "marque" }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
});


// ========================================
// CONTRÔLE D'ACCÈS
// Client propriétaire ou administrateur
// ========================================

const peutAccederFacture = async (req, facture) => {

    if (
        facture.commande &&
        facture.commande.userId === req.userId
    ) {
        return true;
    }

    const user = await User.findByPk(req.userId, {
        attributes: ["role"]
    });

    return Boolean(user && user.role === "admin");
};


// ========================================
// RÉCUPÉRER UNE FACTURE PAR ID DE COMMANDE
// ========================================

const getFactureByCommandeId = async (req, res) => {

    try {

        const { commandeId } = req.params;

        const facture = await chargerFacture(commandeId);

        if (
            !facture ||
            !(await peutAccederFacture(req, facture))
        ) {
            return res.status(404).json({
                success: false,
                message: "Facture introuvable."
            });
        }

        return res.status(200).json({
            success: true,
            facture: facture
        });

    } catch (error) {

        console.error(
            "❌ Erreur récupération facture :",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer la facture.",
            error: error.message
        });

    }

};


// ========================================
// DESSINER LE CONTENU DE LA FACTURE
// Utilisé pour le téléchargement et l'e-mail
// ========================================

const dessinerFacture = (doc, facture) => {

    // ========================================
    // EN-TÊTE
    // ========================================

    doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("LANDOLSI TIRES", {
            align: "center"
        });

    doc
        .moveDown(0.3)
        .fontSize(11)
        .font("Helvetica")
        .text("Vente de pneumatiques", {
            align: "center"
        });

    doc.moveDown();

    doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("FACTURE", {
            align: "center"
        });

    doc.moveDown();


    // ========================================
    // INFORMATIONS FACTURE
    // ========================================

    doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`Facture N° : ${facture.numeroFacture}`);

    const dateFacture = new Date(
        facture.dateFacture
    ).toLocaleDateString("fr-FR");

    doc
        .font("Helvetica")
        .text(`Date : ${dateFacture}`);

    doc.moveDown(1.5);


    // ========================================
    // INFORMATIONS CLIENT
    // ========================================

    const commande = facture.commande;

    doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("CLIENT");

    doc.moveDown(0.4);

    doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Nom : ${commande.nom} ${commande.prenom}`);

    doc.text(`Téléphone : ${commande.telephone}`);

    doc.text(
        `Adresse : ${commande.adresse}, ${commande.ville}, ${commande.codePostal}`
    );

    doc.moveDown(1.5);


    // ========================================
    // TITRE ARTICLES
    // ========================================

    doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("DÉTAIL DE LA COMMANDE");

    doc.moveDown(0.7);


    // ========================================
    // TABLEAU DES ARTICLES
    // ========================================

    const tableTop = doc.y;

    const colX = {
        designation: 50,
        dimension: 225,
        quantite: 325,
        prix: 385,
        total: 465
    };


    // EN-TÊTE DU TABLEAU

    doc
        .fontSize(9)
        .font("Helvetica-Bold");

    doc.text(
        "Désignation",
        colX.designation,
        tableTop,
        { width: 165 }
    );

    doc.text(
        "Dimension",
        colX.dimension,
        tableTop,
        { width: 90 }
    );

    doc.text(
        "Qté",
        colX.quantite,
        tableTop,
        {
            width: 40,
            align: "center"
        }
    );

    doc.text(
        "P.U.",
        colX.prix,
        tableTop,
        {
            width: 60,
            align: "right"
        }
    );

    doc.text(
        "Total",
        colX.total,
        tableTop,
        {
            width: 80,
            align: "right"
        }
    );

    doc.moveDown(0.8);

    doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

    doc.moveDown(0.7);


    // ========================================
    // ARTICLES
    // ========================================

    for (const item of commande.items || []) {

        const pneu = item.pneu;

        if (!pneu) {
            continue;
        }

        const marque = pneu.marque
            ? pneu.marque.nom
            : "";

        const designation = `${marque} ${pneu.modele}`;

        const prixUnitaire = Number(item.prix) || 0;
        const quantite = Number(item.quantite) || 0;

        const totalItem = quantite * prixUnitaire;

        const ligneY = doc.y;

        doc
            .fontSize(9)
            .font("Helvetica");

        doc.text(
            designation,
            colX.designation,
            ligneY,
            { width: 165 }
        );

        doc.text(
            pneu.dimension || "",
            colX.dimension,
            ligneY,
            { width: 90 }
        );

        doc.text(
            String(quantite),
            colX.quantite,
            ligneY,
            {
                width: 40,
                align: "center"
            }
        );

        doc.text(
            `${prixUnitaire.toFixed(2)} DT`,
            colX.prix,
            ligneY,
            {
                width: 60,
                align: "right"
            }
        );

        doc.text(
            `${totalItem.toFixed(2)} DT`,
            colX.total,
            ligneY,
            {
                width: 80,
                align: "right"
            }
        );

        doc.moveDown(1.2);

        doc
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

        doc.moveDown(0.7);

    }


    // ========================================
    // RÉCAPITULATIF FINANCIER
    // ========================================

    doc.moveDown(0.8);

    doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

    doc.moveDown(0.8);


    // Sous-total enregistré dans la commande
    const sousTotal = Number(
        commande.sousTotal ??
        (commande.items || []).reduce(
            (sum, item) =>
                sum +
                (Number(item.quantite) || 0) *
                (Number(item.prix) || 0),
            0
        )
    );

    // Pourcentage de remise
    const remisePourcentage = Number(
        commande.remisePourcentage || 0
    );

    // Montant de remise enregistré dans la commande
    const remiseMontant = Number(
        commande.remiseMontant ??
        (sousTotal * remisePourcentage / 100)
    );

    // Total final enregistré dans la commande
    const totalFinal = Number(commande.total);


    // SOUS-TOTAL

    doc
        .fontSize(11)
        .font("Helvetica")
        .text(
            `Sous-total : ${sousTotal.toFixed(2)} DT`,
            300,
            doc.y,
            {
                width: 245,
                align: "right"
            }
        );

    doc.moveDown(0.5);


    // REMISE

    if (remiseMontant > 0) {

        doc
            .fontSize(11)
            .font("Helvetica")
            .fillColor("green")
            .text(
                `Remise (${remisePourcentage} %) : -${remiseMontant.toFixed(2)} DT`,
                300,
                doc.y,
                {
                    width: 245,
                    align: "right"
                }
            );

        doc.fillColor("black");

        doc.moveDown(0.5);
    }


    // TOTAL FINAL

    doc
        .fontSize(15)
        .font("Helvetica-Bold")
        .text(
            `TOTAL À PAYER : ${totalFinal.toFixed(2)} DT`,
            250,
            doc.y,
            {
                width: 295,
                align: "right"
            }
        );

    doc.moveDown(1.5);


    // ========================================
    // STATUT
    // ========================================

    doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(
            `Statut commande : ${commande.statut}`,
            50,
            doc.y,
            {
                width: 495,
                align: "left"
            }
        );

    doc.moveDown(2);


    // ========================================
    // INFORMATIONS RÉCUPÉRATION
    // ========================================

    doc
        .fontSize(10)
        .font("Helvetica")
        .text(
            "Le client récupère sa commande directement chez LANDOLSI TIRES.",
            50,
            doc.y,
            {
                width: 495,
                align: "center"
            }
        );

    doc.moveDown(0.7);


    // ========================================
    // MESSAGE FINAL
    // ========================================

    doc
        .fontSize(10)
        .font("Helvetica")
        .text(
            "Merci pour votre confiance !",
            50,
            doc.y,
            {
                width: 495,
                align: "center"
            }
        );

};


// ========================================
// PDF EN MÉMOIRE
// Pièce jointe d'e-mail
// ========================================

const genererFacturePdfBuffer = (facture) =>

    new Promise((resolve, reject) => {

        const doc = new PDFDocument({
            size: "A4",
            margin: 50
        });

        const chunks = [];

        doc.on("data", (chunk) => {
            chunks.push(chunk);
        });

        doc.on("end", () => {
            resolve(Buffer.concat(chunks));
        });

        doc.on("error", reject);

        try {

            dessinerFacture(doc, facture);

            doc.end();

        } catch (error) {

            reject(error);

        }

    });


// ========================================
// TÉLÉCHARGER LE PDF D'UNE FACTURE
// ========================================

const generateFacturePDF = async (req, res) => {

    try {

        const { commandeId } = req.params;

        const facture = await chargerFacture(commandeId);

        if (
            !facture ||
            !(await peutAccederFacture(req, facture))
        ) {

            return res.status(404).json({
                success: false,
                message: "Facture introuvable."
            });

        }

        const pdf = await genererFacturePdfBuffer(facture);

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${facture.numeroFacture}.pdf"`
        );

        return res.send(pdf);

    } catch (error) {

        console.error(
            "❌ Erreur génération PDF facture :",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Impossible de générer la facture PDF."
        });

    }

};


// ========================================
// EXPORTER LES FONCTIONS
// ========================================

module.exports = {
    getFactureByCommandeId,
    generateFacturePDF,
    chargerFacture,
    genererFacturePdfBuffer
};
