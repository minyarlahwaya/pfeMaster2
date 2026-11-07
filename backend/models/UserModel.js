
const { DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const sequelize = require("../db/db");

const User = sequelize.define("User", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    nom: {
        type: DataTypes.STRING(100),
        allowNull: false
    },

    prenom: {
        type: DataTypes.STRING(100),
        allowNull: false
    },

    email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },

    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },

    resetPasswordCode: {
        type: DataTypes.STRING,
        allowNull: true
    },

    resetPasswordExpires: {
        type: DataTypes.DATE,
        allowNull: true
    },

    telephone: {
        type: DataTypes.STRING(20),
        allowNull: false
    },

    adresse: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    ville: {
        type: DataTypes.STRING(100),
        allowNull: false
    },

    codePostal: {
        type: DataTypes.STRING(20),
        allowNull: false
    },

    pays: {
        type: DataTypes.STRING(100),
        allowNull: false
    },

    typeClient: {
        type: DataTypes.ENUM(
            "particulier",
            "professionnel"
        ),
        allowNull: false,
        defaultValue: "particulier"
    },

    numeroTVA: {
        type: DataTypes.STRING(100),
        allowNull: true
    },

    secteur: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    role: {
        type: DataTypes.ENUM(
            "admin",
            "client"
        ),
        allowNull: false,
        defaultValue: "client"
    },

    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },

    // Double authentification
    mfaEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },

    mfaSecret: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    mfaTempSecret: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    mfaLastUsedStep: {
        type: DataTypes.BIGINT,
        allowNull: true
    },

    mfaRecoveryCodes: {
        type: DataTypes.JSONB,
        allowNull: true
    }

}, {
    tableName: "users",
    timestamps: true,

    hooks: {

        async beforeCreate(user) {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },

        async beforeUpdate(user) {
            if (user.changed("password")) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }

    }

});

module.exports = User;
