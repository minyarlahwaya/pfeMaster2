const crypto = require("crypto");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const config = require("../config");

// =====================================================
// DOUBLE AUTHENTIFICATION (MFA) — TOTP RFC 6238
// =====================================================
// Compatible Google Authenticator, Microsoft Authenticator,
// FreeOTP, Authy... : code à 6 chiffres renouvelé toutes les 30 s.

const STEP_SECONDS = 30;

// Tolérance d'une période avant/après (décalage d'horloge du téléphone)
authenticator.options = { step: STEP_SECONDS, window: 1, digits: 6 };

const RECOVERY_CODES_COUNT = 8;


// =====================================================
// CHIFFREMENT DU SECRET EN BASE (AES-256-GCM)
// =====================================================
// Le secret TOTP permet de générer les codes : il ne doit pas être lisible
// dans une sauvegarde de la base. Clé : MFA_ENCRYPTION_KEY, sinon dérivée
// de JWT_SECRET.

const encryptionKey = crypto
    .createHash("sha256")
    .update(config.mfaEncryptionKey || `mfa:${config.jwtSecret}`)
    .digest();

// Tag GCM de 128 bits imposé au chiffrement ET au déchiffrement (pas de tag tronqué)
const GCM_TAG_LENGTH = 16;

function encryptSecret(secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: GCM_TAG_LENGTH });
    // Faux positif Semgrep : « secret » est la variable à chiffrer, pas une valeur codée en dur
    // nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((b) => b.toString("base64")).join(":");
}

function decryptSecret(payload) {
    const [iv, tag, encrypted] = payload.split(":").map((p) => Buffer.from(p, "base64"));
    if (tag.length !== GCM_TAG_LENGTH) throw new Error("Tag d'authentification MFA invalide");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: GCM_TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}


// =====================================================
// ENRÔLEMENT
// =====================================================

async function generateSetup(email) {
    const secret = authenticator.generateSecret(20);
    const otpauthUrl = authenticator.keyuri(email, config.mfaIssuer, secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCode };
}


// =====================================================
// VÉRIFICATION D'UN CODE TOTP
// =====================================================
// Retourne le numéro de période utilisé (pour refuser la réutilisation
// d'un même code) ou null si le code est invalide.

function verifyTotp(code, encryptedSecret, lastUsedStep) {
    const token = String(code || "").replace(/\s+/g, "");

    if (!/^\d{6}$/.test(token) || !encryptedSecret) return null;

    const delta = authenticator.checkDelta(token, decryptSecret(encryptedSecret));

    if (delta === null) return null;

    const step = Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;

    if (lastUsedStep !== null && lastUsedStep !== undefined && step <= Number(lastUsedStep)) {
        return null;
    }

    return step;
}


// =====================================================
// CODES DE SECOURS (téléphone perdu)
// =====================================================
// Affichés une seule fois ; seule leur empreinte SHA-256 est conservée.

const hashRecoveryCode = (code) =>
    crypto
        .createHash("sha256")
        .update(String(code).replace(/[\s-]/g, "").toUpperCase())
        .digest("hex");

function generateRecoveryCodes() {
    const codes = [];

    for (let i = 0; i < RECOVERY_CODES_COUNT; i++) {
        const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }

    return {
        codes,
        hashes: codes.map(hashRecoveryCode)
    };
}

// Retourne la liste des empreintes restantes si le code est valide, sinon null
function consumeRecoveryCode(code, hashes) {
    if (!code || !Array.isArray(hashes)) return null;

    const hash = hashRecoveryCode(code);
    const index = hashes.indexOf(hash);

    if (index === -1) return null;

    return hashes.filter((_, i) => i !== index);
}


module.exports = {
    encryptSecret,
    generateSetup,
    verifyTotp,
    generateRecoveryCodes,
    consumeRecoveryCode
};
