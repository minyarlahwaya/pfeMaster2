// Options TLS partagées par l'application (db.js) et sequelize-cli
// (sequelize-cli.config.js). Base managée Supabase : DB_SSL=true et
// DB_SSL_CA_PATH vers le certificat racine Supabase (certs/prod-ca-2021.crt).
const fs = require("fs");
const config = require("../config");

function dialectOptions() {
    const { db } = config;
    if (!db.ssl) return {};

    return {
        ssl: {
            require: true,
            rejectUnauthorized: db.sslRejectUnauthorized,
            ...(db.sslCaPath ? { ca: fs.readFileSync(db.sslCaPath, "utf8") } : {})
        }
    };
}

module.exports = { dialectOptions };
