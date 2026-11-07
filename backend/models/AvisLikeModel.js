
const { DataTypes } = require("sequelize");
const sequelize = require("../db/db");

const AvisLike = sequelize.define(
    "AvisLike",
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
        }
    },
    {
        tableName: "avis_likes",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["avisId", "userId"]
            }
        ]
    }
);

module.exports = AvisLike;
