
const { DataTypes } = require("sequelize");
const sequelize = require("../db/db");

const Pneu = sequelize.define("Pneu", {

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    modele: {
        type: DataTypes.STRING,
        allowNull: false
    },

    dimension: {
        type: DataTypes.STRING,
        allowNull: false
    },
largeur: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true
},

hauteur: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true
},

diametre: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true
},

    saison: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // Prix d'achat hors taxe
    prixAchatHT: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true
    },

    // Remise fournisseur en pourcentage
    remiseFournisseur: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 20.00
    },

    // Taux de TVA en pourcentage
    tauxTVA: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 19.00
    },

    // Prix d'achat TTC après remise et TVA
    prixAchatTTC: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true
    },

    // Marge commerciale en pourcentage
    marge: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 20.00
    },

    // Prix de vente TTC
    prix: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false
    },

    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
     

    isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
},
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    image: {
        type: DataTypes.STRING,
        allowNull: true
    },

    marqueId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }

});

module.exports = Pneu;
