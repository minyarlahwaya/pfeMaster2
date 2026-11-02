const User = require("../models/UserModel");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require("../config");
const { sendResetPasswordEmail } = require("../services/emailService");
const mfa = require("../services/mfaService");


const maxAge = 2 * 60*60


const createToken = (id) => {
    return jwt.sign( { id }, config.jwtSecret, { expiresIn: maxAge, }
    )
}


// =====================================
// Double authentification : jeton intermédiaire
// =====================================
// Après un mot de passe correct, un compte avec MFA reçoit seulement
// ce cookie (5 minutes) ; la session (jwt_token) n'est créée qu'après
// la vérification du code de l'application Authenticator.

const MFA_PENDING_COOKIE = "mfa_pending";
const MFA_PENDING_MAX_AGE = 5 * 60;
const MFA_MAX_ATTEMPTS = 5;

// Tentatives par jeton intermédiaire (instance unique, voir README)
const mfaAttempts = new Map();

const cookieOptions = () => ({
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax"
});

const userPayload = (user) => ({
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    telephone: user.telephone,
    role: user.role,
    typeClient: user.typeClient
});

const openSession = (res, user) => {
    res.cookie("jwt_token", createToken(user.id), {
        ...cookieOptions(),
        maxAge: maxAge * 1000
    });
};

// Vérifie un code TOTP ou, à défaut, un code de secours, et met à jour
// l'utilisateur (période utilisée / code de secours consommé).
const checkSecondFactor = async (user, { code, recoveryCode }) => {

    if (recoveryCode) {
        const remaining = mfa.consumeRecoveryCode(recoveryCode, user.mfaRecoveryCodes);
        if (!remaining) return false;
        user.mfaRecoveryCodes = remaining;
        await user.save();
        return true;
    }

    const step = mfa.verifyTotp(code, user.mfaSecret, user.mfaLastUsedStep);
    if (step === null) return false;
    user.mfaLastUsedStep = step;
    await user.save();
    return true;
};






// =====================================
// Inscription d'un nouvel utilisateur
// =====================================
module.exports.signup = async (req, res) => {

    try {

        // Récupérer les données envoyées par le frontend
        const {
            nom,
            prenom,
            email,
            password,
            telephone,
            adresse,
            ville,
            codePostal,
            pays,
            typeClient,
            numeroTVA,
            secteur
        } = req.body;



        // Création de l'utilisateur
        // IMPORTANT :
        // Le password sera automatiquement haché
        // grâce au hook beforeCreate dans User.js
        const user = await User.create({

            nom,
            prenom,
            email,
            password,

            telephone,
            adresse,
            ville,
            codePostal,
            pays,

            typeClient,

            // Informations professionnelles
           
            numeroTVA,
            secteur

            // role n'est pas envoyé
            // par sécurité
            // Sequelize met automatiquement:
            // role = "client"

        });



        // Réponse envoyée au client
        return res.status(201).json({

            success: true,

            message: "Compte créé avec succès",

            user: {

                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                typeClient: user.typeClient

            }

        });



    } catch (error) {


        console.log(error);


        return res.status(500).json({

            success: false,

            message: "Erreur lors de la création du compte"

        });

    }

};
module.exports.login_post = async (req, res) => {

    try {

        // ==============================
        // 1. Récupérer les données
        // ==============================

        const { email, password } = req.body;


        // ==============================
        // 2. Vérifier les champs
        // ==============================

        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "L'adresse e-mail et le mot de passe sont obligatoires."

            });

        }


        // ==============================
        // 3. Rechercher l'utilisateur
        // ==============================

        const user = await User.findOne({

            where: {
                email: email.trim().toLowerCase()
            }

        });


        // Debug : on affiche seulement l'email
        console.log(
            "Tentative de connexion :",
            email
        );


        // ==============================
        // 4. Vérifier l'e-mail
        // ==============================

        if (!user) {

            return res.status(400).json({

                success: false,

                message:
                    "Adresse e-mail incorrecte."

            });

        }


        // ==============================
        // 5. Vérifier si le compte est actif
        // ==============================

        if (!user.isActive) {

            return res.status(403).json({

                success: false,

                message:
                    "Votre compte est désactivé."

            });

        }


        // ==============================
        // 6. Vérifier le mot de passe
        // ==============================

        const auth = await bcrypt.compare(

            password,

            user.password

        );


        if (!auth) {

            return res.status(400).json({

                success: false,

                message:
                    "Mot de passe incorrect."

            });

        }


        // ==============================
        // 7. Double authentification activée :
        //    demander le code Authenticator
        // ==============================

        if (user.mfaEnabled) {

            const pendingToken = jwt.sign(
                { id: user.id, purpose: "mfa", jti: crypto.randomUUID() },
                config.jwtSecret,
                { expiresIn: MFA_PENDING_MAX_AGE }
            );

            res.cookie(MFA_PENDING_COOKIE, pendingToken, {
                ...cookieOptions(),
                maxAge: MFA_PENDING_MAX_AGE * 1000
            });

            return res.status(200).json({
                success: true,
                mfaRequired: true,
                message: "Saisissez le code de votre application d'authentification."
            });

        }


        // ==============================
        // 8. Créer le JWT et envoyer le cookie
        // ==============================

        openSession(res, user);


        // ==============================
        // 9. Connexion réussie
        // ==============================

        console.log(
            "Connexion réussie pour :",
            user.email
        );


        return res.status(200).json({

            success: true,

            message:
                "Connexion réussie",

            user: userPayload(user)

        });


    } catch (error) {

        console.error(
            "Erreur login :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Une erreur est survenue lors de la connexion."

        });

    }

};


// =====================================
// Connexion — 2e étape : code Authenticator
// =====================================

module.exports.login_mfa = async (req, res) => {

    try {

        const token = req.cookies[MFA_PENDING_COOKIE];

        let decoded;

        try {
            decoded = jwt.verify(token || "", config.jwtSecret);
        } catch {
            decoded = null;
        }

        if (!decoded || decoded.purpose !== "mfa") {
            return res.status(401).json({
                success: false,
                message: "Session de vérification expirée. Reconnectez-vous."
            });
        }

        // Limiter les essais pour un même jeton intermédiaire
        const attempts = (mfaAttempts.get(decoded.jti) || 0) + 1;

        if (attempts > MFA_MAX_ATTEMPTS) {
            res.clearCookie(MFA_PENDING_COOKIE, cookieOptions());
            return res.status(429).json({
                success: false,
                message: "Trop de tentatives. Reconnectez-vous."
            });
        }

        mfaAttempts.set(decoded.jti, attempts);
        setTimeout(() => mfaAttempts.delete(decoded.jti), MFA_PENDING_MAX_AGE * 1000).unref();

        const user = await User.findByPk(decoded.id);

        if (!user || !user.isActive || !user.mfaEnabled) {
            res.clearCookie(MFA_PENDING_COOKIE, cookieOptions());
            return res.status(401).json({
                success: false,
                message: "Reconnectez-vous."
            });
        }

        const valid = await checkSecondFactor(user, req.body || {});

        if (!valid) {
            return res.status(400).json({
                success: false,
                message: "Code de vérification incorrect.",
                attemptsLeft: MFA_MAX_ATTEMPTS - attempts
            });
        }

        mfaAttempts.delete(decoded.jti);
        res.clearCookie(MFA_PENDING_COOKIE, cookieOptions());
        openSession(res, user);

        console.log("Connexion réussie (MFA) pour :", user.email);

        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            user: userPayload(user),
            recoveryCodesLeft: (user.mfaRecoveryCodes || []).length
        });

    } catch (error) {

        console.error("Erreur login MFA :", error);

        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la vérification du code."
        });

    }

};


// =====================================
// MFA — État pour l'utilisateur connecté
// =====================================

module.exports.mfaStatus = async (req, res) => {

    try {

        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        return res.status(200).json({
            success: true,
            mfaEnabled: user.mfaEnabled,
            recoveryCodesLeft: (user.mfaRecoveryCodes || []).length
        });

    } catch (error) {

        console.error("Erreur état MFA :", error);

        return res.status(500).json({ success: false, message: "Erreur serveur" });

    }

};


// =====================================
// MFA — Enrôlement : QR code à scanner
// =====================================

module.exports.mfaSetup = async (req, res) => {

    try {

        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        if (user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: "La double authentification est déjà activée."
            });
        }

        const { secret, otpauthUrl, qrCode } = await mfa.generateSetup(user.email);

        // Le secret n'est actif qu'après confirmation d'un premier code
        user.mfaTempSecret = mfa.encryptSecret(secret);
        await user.save();

        return res.status(200).json({
            success: true,
            qrCode,
            secret,
            otpauthUrl
        });

    } catch (error) {

        console.error("Erreur enrôlement MFA :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de générer le QR code."
        });

    }

};


// =====================================
// MFA — Activation (confirmation du premier code)
// =====================================

module.exports.mfaEnable = async (req, res) => {

    try {

        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        if (user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: "La double authentification est déjà activée."
            });
        }

        if (!user.mfaTempSecret) {
            return res.status(400).json({
                success: false,
                message: "Générez d'abord le QR code."
            });
        }

        const step = mfa.verifyTotp(req.body?.code, user.mfaTempSecret, null);

        if (step === null) {
            return res.status(400).json({
                success: false,
                message: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez."
            });
        }

        const { codes, hashes } = mfa.generateRecoveryCodes();

        user.mfaSecret = user.mfaTempSecret;
        user.mfaTempSecret = null;
        user.mfaEnabled = true;
        user.mfaLastUsedStep = step;
        user.mfaRecoveryCodes = hashes;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Double authentification activée.",
            recoveryCodes: codes
        });

    } catch (error) {

        console.error("Erreur activation MFA :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible d'activer la double authentification."
        });

    }

};


// =====================================
// MFA — Désactivation (mot de passe + code)
// =====================================

module.exports.mfaDisable = async (req, res) => {

    try {

        const { password, code, recoveryCode } = req.body || {};

        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
        }

        if (!user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: "La double authentification n'est pas activée."
            });
        }

        if (!password || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, message: "Mot de passe incorrect." });
        }

        if (!(await checkSecondFactor(user, { code, recoveryCode }))) {
            return res.status(400).json({ success: false, message: "Code de vérification incorrect." });
        }

        user.mfaEnabled = false;
        user.mfaSecret = null;
        user.mfaTempSecret = null;
        user.mfaLastUsedStep = null;
        user.mfaRecoveryCodes = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Double authentification désactivée."
        });

    } catch (error) {

        console.error("Erreur désactivation MFA :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de désactiver la double authentification."
        });

    }

};


// =====================================
// MFA — Nouveaux codes de secours
// =====================================

module.exports.mfaRegenerateRecoveryCodes = async (req, res) => {

    try {

        const user = await User.findByPk(req.userId);

        if (!user || !user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: "La double authentification n'est pas activée."
            });
        }

        // Un code TOTP est exigé : un code de secours ne suffit pas
        const step = mfa.verifyTotp(req.body?.code, user.mfaSecret, user.mfaLastUsedStep);

        if (step === null) {
            return res.status(400).json({ success: false, message: "Code de vérification incorrect." });
        }

        const { codes, hashes } = mfa.generateRecoveryCodes();

        user.mfaLastUsedStep = step;
        user.mfaRecoveryCodes = hashes;
        await user.save();

        return res.status(200).json({ success: true, recoveryCodes: codes });

    } catch (error) {

        console.error("Erreur codes de secours MFA :", error);

        return res.status(500).json({ success: false, message: "Erreur serveur" });

    }

};


module.exports.logout = (req, res) => {

    // Supprimer les cookies de session et de vérification MFA
    res.clearCookie(MFA_PENDING_COOKIE, cookieOptions());

    res.clearCookie("jwt_token", {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "lax"
    });

    return res.status(200).json({
        success: true,
        message: "Déconnexion réussie"
    });

};

// =====================================
// Récupérer le profil de l'utilisateur connecté
// =====================================


// =====================================
// Récupérer le profil de l'utilisateur connecté
// =====================================

module.exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            attributes: [
                "id",
                "nom",
                "prenom",
                "email",
                "telephone",
                "adresse",
                "ville",
                "codePostal",
                "pays",
                "typeClient",
                "numeroTVA",
                "secteur",
                "role",
                "mfaEnabled"
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        return res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error("Erreur récupération profil :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
};




// =====================================
// Modifier le profil de l'utilisateur connecté
// =====================================

module.exports.updateProfile = async (req, res) => {

    try {

        // ID récupéré depuis le JWT
        const userId = req.userId;

        // Données envoyées par le frontend
        const {
            nom,
            prenom,
            telephone,
            adresse,
            ville,
            codePostal,
            pays,
            
            numeroTVA,
            secteur
        } = req.body;


        // ==============================
        // Récupérer l'utilisateur
        // ==============================

        const user = await User.findByPk(userId);

        if (!user) {

            return res.status(404).json({

                success: false,

                message: "Utilisateur introuvable."

            });

        }


        // ==============================
        // Modifier les informations
        // ==============================

        user.nom = nom;
        user.prenom = prenom;
        user.telephone = telephone;
        user.adresse = adresse;
        user.ville = ville;
        user.codePostal = codePostal;
        user.pays = pays;


        // ==============================
        // Informations professionnelles
        // ==============================

        //user.raisonSociale = raisonSociale;
        //user.activite = activite;
        //user.identifiantEntreprise = identifiantEntreprise;
        user.numeroTVA = numeroTVA;
        user.secteur = secteur;


        // ==============================
        // Sauvegarder
        // ==============================

        await user.save();


        // ==============================
        // Réponse
        // ==============================

        return res.status(200).json({

            success: true,

            message: "Profil modifié avec succès.",

            user: {

                id: user.id,

                nom: user.nom,

                prenom: user.prenom,

                email: user.email,

                telephone: user.telephone,

                adresse: user.adresse,

                ville: user.ville,

                codePostal: user.codePostal,

                pays: user.pays,

                typeClient: user.typeClient,

               

                numeroTVA: user.numeroTVA,

                secteur: user.secteur,

                role: user.role

            }

        });


    } catch (error) {

        console.error(
            "Erreur modification profil :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de modifier le profil."

        });

    }

};



// =====================================================
// MOT DE PASSE OUBLIÉ
// =====================================================

// =====================================================
// MOT DE PASSE OUBLIÉ
// =====================================================

module.exports.ForgotPassword = async (req, res) => {

    try {

        // ==============================
        // 1. Récupérer l'email
        // ==============================

        const { email } = req.body;

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Veuillez saisir votre adresse email."
            });

        }


        // ==============================
        // 2. Nettoyer l'email
        // ==============================

        const emailClean = email.trim().toLowerCase();


        // ==============================
        // 3. Rechercher l'utilisateur
        // ==============================

        const user = await User.findOne({
            where: {
                email: emailClean
            }
        });


        // ==============================
        // 4. Vérifier l'utilisateur
        // ==============================

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "Aucun compte associé à cette adresse email."
            });

        }


        // ==============================
        // 5. Générer un code à 6 chiffres
        // ==============================

        const resetCode = crypto
            .randomInt(100000, 1000000)
            .toString();


        // ==============================
        // 6. Expiration : 10 minutes
        // ==============================

        const expiration = new Date(
            Date.now() + 10 * 60 * 1000
        );


        // ==============================
        // 7. Enregistrer le code en base
        // ==============================

        user.resetPasswordCode = resetCode;
        user.resetPasswordExpires = expiration;

        await user.save();


        // ==============================
        // 8. Envoyer le code par email
        // ==============================

        await sendResetPasswordEmail(
            user.email,
            resetCode
        );


        // ==============================
        // 9. Réponse
        // ==============================

        return res.status(200).json({

            success: true,

            message:
                "Un code de récupération a été envoyé à votre adresse email."

        });


    } catch (error) {

        console.error(
            "❌ Erreur ForgotPassword :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Une erreur est survenue lors de l'envoi du code de récupération."

        });

    }

};

module.exports.VerifyResetCode = async (req, res) => {

    try {

        const { email, code } = req.body;

        // Vérifier que les données sont présentes
        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: "Email et code sont obligatoires."
            });
        }

        // Nettoyer l'email
        const emailClean = email.trim().toLowerCase();

        // Chercher l'utilisateur
        const user = await User.findOne({
            where: {
                email: emailClean
            }
        });

        // Utilisateur inexistant
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Aucun compte associé à cette adresse email."
            });
        }

        // Vérifier qu'un code existe
        if (!user.resetPasswordCode) {
            return res.status(400).json({
                success: false,
                message: "Aucun code de récupération n'a été demandé."
            });
        }

        // Vérifier le code
        if (user.resetPasswordCode !== code.toString()) {
            return res.status(400).json({
                success: false,
                message: "Code de récupération incorrect."
            });
        }

        // Vérifier l'expiration
        if (
            !user.resetPasswordExpires ||
            new Date() > new Date(user.resetPasswordExpires)
        ) {
            return res.status(400).json({
                success: false,
                message: "Le code de récupération a expiré."
            });
        }

        // Tout est correct
        return res.status(200).json({
            success: true,
            message: "Code de récupération valide."
        });

    } catch (error) {

        console.error("❌ Erreur VerifyResetCode :", error);

        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la vérification du code."
        });
    }
};
module.exports.ResetPassword = async (req, res) => {

    try {

        const { email, code, newPassword } = req.body;

        // 1. Vérifier les données
        if (!email || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, code et nouveau mot de passe sont obligatoires."
            });
        }

        // 2. Vérifier la longueur du mot de passe
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Le nouveau mot de passe doit contenir au moins 8 caractères."
            });
        }

        // 3. Nettoyer l'email
        const emailClean = email.trim().toLowerCase();

        // 4. Chercher l'utilisateur
        const user = await User.findOne({
            where: {
                email: emailClean
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Aucun compte associé à cette adresse email."
            });
        }

        // 5. Vérifier qu'un code existe
        if (!user.resetPasswordCode) {
            return res.status(400).json({
                success: false,
                message: "Aucun code de récupération n'a été demandé."
            });
        }

        // 6. Vérifier le code
        if (user.resetPasswordCode !== code.toString()) {
            return res.status(400).json({
                success: false,
                message: "Code de récupération incorrect."
            });
        }

        // 7. Vérifier l'expiration
        if (
            !user.resetPasswordExpires ||
            new Date() > new Date(user.resetPasswordExpires)
        ) {
            return res.status(400).json({
                success: false,
                message: "Le code de récupération a expiré."
            });
        }

        // 8. Modifier le mot de passe
        user.password = newPassword;

        // 9. Supprimer le code après utilisation
        user.resetPasswordCode = null;
        user.resetPasswordExpires = null;

        // 10. Sauvegarder
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Votre mot de passe a été réinitialisé avec succès."
        });

    } catch (error) {

        console.error("❌ Erreur ResetPassword :", error);

        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la réinitialisation du mot de passe."
        });
    }
};





// ========================================
// ADMIN — Afficher tous les utilisateurs
// ========================================

module.exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: {
                exclude: [
                    "password",
                    "resetPasswordCode",
                    "resetPasswordExpires",
                    "mfaSecret",
                    "mfaTempSecret",
                    "mfaLastUsedStep",
                    "mfaRecoveryCodes"
                ]
            },
            order: [["createdAt", "DESC"]]
        });

        return res.status(200).json({
            success: true,
            users
        });

    } catch (error) {
        console.error("❌ Erreur récupération utilisateurs :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de récupérer les utilisateurs.",
            error: error.message
        });
    }
};


// ========================================
// ADMIN — Activer / désactiver un utilisateur
// ========================================

module.exports.toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        // L'admin connecté ne peut pas désactiver son propre compte
        if (Number(user.id) === Number(req.userId)) {
            return res.status(400).json({
                success: false,
                message: "Vous ne pouvez pas désactiver votre propre compte."
            });
        }

        user.isActive = !user.isActive;

        await user.save();

        return res.status(200).json({
            success: true,
            message: user.isActive
                ? "Utilisateur activé avec succès."
                : "Utilisateur désactivé avec succès.",
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                isActive: user.isActive
            }
        });

    } catch (error) {
        console.error("❌ Erreur modification statut utilisateur :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de modifier le statut de l'utilisateur.",
            error: error.message
        });
    }
};


// ========================================
// ADMIN — Réinitialiser la double authentification
// (utilisateur ayant perdu son téléphone et ses codes de secours)
// ========================================

module.exports.resetUserMfa = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        user.mfaEnabled = false;
        user.mfaSecret = null;
        user.mfaTempSecret = null;
        user.mfaLastUsedStep = null;
        user.mfaRecoveryCodes = null;
        await user.save();

        console.log(`MFA réinitialisée pour l'utilisateur ${user.id} par l'admin ${req.userId}`);

        return res.status(200).json({
            success: true,
            message: "Double authentification réinitialisée."
        });

    } catch (error) {
        console.error("❌ Erreur réinitialisation MFA :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de réinitialiser la double authentification."
        });
    }
};


// ========================================
// ADMIN — Supprimer un utilisateur
// ========================================

module.exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        // L'admin ne peut pas supprimer son propre compte
        if (Number(user.id) === Number(req.userId)) {
            return res.status(400).json({
                success: false,
                message: "Vous ne pouvez pas supprimer votre propre compte."
            });
        }

        await user.destroy();

        return res.status(200).json({
            success: true,
            message: "Utilisateur supprimé avec succès."
        });

    } catch (error) {
        console.error("❌ Erreur suppression utilisateur :", error);

        return res.status(500).json({
            success: false,
            message: "Impossible de supprimer cet utilisateur.",
            error: error.message
        });
    }
};