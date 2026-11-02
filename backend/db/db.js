const { Sequelize } = require("sequelize");
const fs = require("fs");
const config = require("../config");

const { db } = config;

// Certificat CA facultatif : utilisé uniquement si son chemin est configuré
const sslOptions = db.ssl
  ? {
      require: true,
      rejectUnauthorized: db.sslRejectUnauthorized,
      ...(process.env.DB_SSL_CA_PATH
        ? {
            ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8")
          }
        : {})
    }
  : {};

const sequelize = new Sequelize(
  db.name,
  db.user,
  db.password,
  {
    host: db.host,
    port: db.port,
    dialect: "postgres",
    logging: false,
    pool: {
      max: db.poolMax,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: db.ssl
      ? { ssl: sslOptions }
      : {}
  }
);

module.exports = sequelize;