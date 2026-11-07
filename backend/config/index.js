const path = require("path");

// =====================================================
// CHARGEMENT DE LA CONFIGURATION
// =====================================================
// En développement, les variables viennent de backend/.env.
// En production (systemd), elles viennent de EnvironmentFile=
// et dotenv n'écrase jamais une variable déjà définie.

require("dotenv").config({
    path: process.env.ENV_FILE || path.join(__dirname, "..", ".env"),
    quiet: true
});

const env = process.env;

const NODE_ENV = env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const toBool = (value, defaultValue) => {
    if (value === undefined || value === "") return defaultValue;
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const toInt = (value, defaultValue) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? defaultValue : n;
};

// Valeurs d'exemple de .env.example (« replace_with_... ») = non configuré
const unlessPlaceholder = (value) =>
    value && !/^replace_with/i.test(String(value).trim()) ? String(value).trim() : undefined;

// Ancien secret codé en dur : conservé uniquement pour le développement
// local afin de ne pas casser les sessions existantes.
const DEV_JWT_SECRET = "net pneus secret";

const config = {
    nodeEnv: NODE_ENV,
    isProduction,

    host: env.HOST || undefined,
    port: toInt(env.PORT, 5001),
    trustProxy: toBool(env.TRUST_PROXY, isProduction),

    corsOrigins: (env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),

    jwtSecret: env.JWT_SECRET || (isProduction ? undefined : DEV_JWT_SECRET),
    cookieSecure: toBool(env.COOKIE_SECURE, isProduction),

    // Double authentification (application Authenticator)
    mfaIssuer: env.MFA_ISSUER || "LANDOLSI TIRES",
    mfaEncryptionKey: env.MFA_ENCRYPTION_KEY || undefined,

    db: {
        name: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        host: env.DB_HOST || "localhost",
        port: toInt(env.DB_PORT, 5432),
        ssl: toBool(env.DB_SSL, false),
        sslRejectUnauthorized: toBool(env.DB_SSL_REJECT_UNAUTHORIZED, true),
        // Certificat CA (Supabase : certs/prod-ca-2021.crt). Chemin relatif
        // résolu depuis backend/, quel que soit le répertoire courant.
        sslCaPath: env.DB_SSL_CA_PATH
            ? path.resolve(path.join(__dirname, ".."), env.DB_SSL_CA_PATH)
            : undefined,
        poolMax: toInt(env.DB_POOL_MAX, 10),
        // alter : comportement historique (modifie le schéma au démarrage)
        // safe  : crée uniquement les tables manquantes
        // none  : aucune synchronisation, schéma géré par les migrations
        sync: (env.DB_SYNC || (isProduction ? "none" : "alter")).toLowerCase()
    },

    uploadDir: path.resolve(
        env.UPLOAD_DIR || path.join(__dirname, "..", "public", "uploadPneu")
    ),

    telegramPollingEnabled: toBool(env.TELEGRAM_POLLING_ENABLED, true),

    // Assistants IA (Mistral) : clé exclusivement côté serveur
    mistral: {
        apiKey: unlessPlaceholder(env.MISTRAL_API_KEY),
        // Disponible même sur les offres où mistral-small/medium ont un quota nul
        model: unlessPlaceholder(env.MISTRAL_MODEL) || "ministral-14b-latest",
        baseUrl: (env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1").replace(/\/+$/, ""),
        timeoutMs: toInt(env.MISTRAL_TIMEOUT_MS, 30000),
        maxToolRounds: toInt(env.AI_MAX_TOOL_ROUNDS, 5),
        // Requêtes IA autorisées par IP et par minute
        rateLimitPerMinute: toInt(env.AI_RATE_LIMIT_PER_MINUTE, 15),
        // Recherche par photo du pneu : modèle capable de lire une image
        // (par défaut le même que MISTRAL_MODEL ; ministral-14b le permet)
        visionModel: unlessPlaceholder(env.MISTRAL_VISION_MODEL)
            || unlessPlaceholder(env.MISTRAL_MODEL) || "ministral-14b-latest",
        // Analyses de photo autorisées par IP et par minute (plus coûteuses)
        photoRateLimitPerMinute: toInt(env.AI_PHOTO_RATE_LIMIT_PER_MINUTE, 5)
    }
};

// =====================================================
// VALIDATION
// =====================================================

function validateConfig() {
    const errors = [];

    for (const key of ["DB_NAME", "DB_USER", "DB_PASSWORD"]) {
        if (!env[key]) errors.push(`${key} est obligatoire`);
    }

    if (config.db.sslCaPath && !require("fs").existsSync(config.db.sslCaPath)) {
        errors.push(`DB_SSL_CA_PATH introuvable : ${config.db.sslCaPath}`);
    }

    if (!["alter", "safe", "none"].includes(config.db.sync)) {
        errors.push("DB_SYNC doit valoir alter, safe ou none");
    }

    if (isProduction) {
        if (!env.JWT_SECRET) {
            errors.push("JWT_SECRET est obligatoire en production");
        } else if (env.JWT_SECRET === DEV_JWT_SECRET || env.JWT_SECRET.length < 32) {
            errors.push("JWT_SECRET doit être un secret aléatoire d'au moins 32 caractères");
        }

        if (env.MFA_ENCRYPTION_KEY && env.MFA_ENCRYPTION_KEY.length < 32) {
            errors.push("MFA_ENCRYPTION_KEY doit contenir au moins 32 caractères");
        }

        if (config.db.sync === "alter") {
            errors.push("DB_SYNC=alter est interdit en production; utilisez les migrations");
        }
    }

    if (errors.length) {
        const error = new Error(
            "Configuration invalide :\n - " + errors.join("\n - ")
        );
        error.code = "CONFIG_INVALID";
        throw error;
    }

    if (!isProduction && !env.JWT_SECRET) {
        console.warn("⚠️ JWT_SECRET absent : secret de développement utilisé.");
    }

    if (!config.mistral.apiKey) {
        console.warn("ℹ️ MISTRAL_API_KEY absent : assistants IA désactivés (réponse 503).");
    }

    if (isProduction && !config.cookieSecure) {
        console.warn("⚠️ COOKIE_SECURE=false : le cookie de session circule sans HTTPS.");
    }
}

config.validate = validateConfig;

module.exports = config;
