
const { DataTypes } = require("sequelize");
const sequelize = require("../db/db");

const Commande = sequelize.define(
    "Commande",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },

        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        nom: {
            type: DataTypes.STRING,
            allowNull: false
        },

        prenom: {
            type: DataTypes.STRING,
            allowNull: false
        },

        telephone: {
            type: DataTypes.STRING,
            allowNull: false
        },

        adresse: {
            type: DataTypes.STRING,
            allowNull: false
        },

        ville: {
            type: DataTypes.STRING,
            allowNull: false
        },

        codePostal: {
            type: DataTypes.STRING,
            allowNull: false
        },

        // Montant après les promotions sur les pneus
        sousTotal: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },

        // Pourcentage de remise selon le type de client
        remisePourcentage: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },

        // Montant économisé
        remiseMontant: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },

        // aucune, particulier ou professionnel
        typeRemise: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "aucune"
        },

        // Montant final après remise
        total: {
            type: DataTypes.FLOAT,
            allowNull: false
        },

        statut: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "en attente"
        }
    },
    {
        tableName: "commandes",
        timestamps: true
    }
);

module.exports = Commande;
