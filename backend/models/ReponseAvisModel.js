
const { DataTypes } = require("sequelize");
const sequelize = require("../db/db");

const ReponseAvis = sequelize.define(
    "ReponseAvis",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        avisId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        contenu: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [1, 2000]
            }
        }
    },
    {
        tableName: "reponses_avis",
        timestamps: true
    }
);

module.exports = ReponseAvis;
