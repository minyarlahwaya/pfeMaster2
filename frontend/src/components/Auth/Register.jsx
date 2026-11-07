
import "./Auth.css";
import { register } from "../../services/apiuser";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
    const [typeAccount, setTypeAccount] = useState("particulier");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        adresse: "",
        ville: "",
        codePostal: "",
        pays: "",
        password: "",
        confirmPassword: "",
        typeClient: "particulier",
        raisonSociale: "",
        activite: "",
        identifiantEntreprise: "",
        numeroTVA: "",
        secteur: ""
    });

    // =====================================
    // MODIFICATION DES CHAMPS
    // =====================================

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));

        // Supprimer l'erreur du champ modifié
        setErrors((prev) => ({
            ...prev,
            [name]: "",
            general: ""
        }));
    };

    // =====================================
    // CHANGEMENT TYPE DE COMPTE
    // =====================================

    const handleTypeAccount = (type) => {
        setTypeAccount(type);

        setFormData((prev) => ({
            ...prev,
            typeClient: type
        }));

        setErrors({});
    };

    // =====================================
    // TRADUCTION DES ERREURS BACKEND
    // =====================================

    const traduireErreur = (field, message) => {
        const erreurs = {
            nom: {
                "nom must be at least 2 characters":
                    "Le nom doit contenir au moins 2 caractères."
            },

            prenom: {
                "prenom must be at least 2 characters":
                    "Le prénom doit contenir au moins 2 caractères."
            },

            email: {
                "L'email est obligatoire":
                    "L'adresse email est obligatoire.",
                "Validation isEmail on email failed":
                    "Veuillez saisir une adresse email valide."
            },

            telephone: {
                "Le numéro doit contenir exactement 8 chiffres":
                    "Le numéro doit contenir exactement 8 chiffres."
            },

            adresse: {
                "L'adresse est obligatoire":
                    "L'adresse est obligatoire."
            },

            pays: {
                "Le pays est obligatoire":
                    "Le pays est obligatoire."
            },

            ville: {
                "La ville est obligatoire":
                    "La ville est obligatoire."
            },

            codePostal: {
                "Le code postal est obligatoire":
                    "Le code postal est obligatoire."
            },

            password: {
                "Le mot de passe doit contenir au moins une minuscule, une majuscule, un caractère spécial et un chiffre":
                    "Le mot de passe doit contenir une minuscule, une majuscule, un caractère spécial et un chiffre."
            }
        };

        return erreurs[field]?.[message] || message;
    };

    // =====================================
    // SOUMISSION FORMULAIRE
    // =====================================

    const handleSubmit = async (e) => {
        e.preventDefault();

        setErrors({});

        // Vérification confirmation mot de passe
        if (formData.password !== formData.confirmPassword) {
            setErrors({
                confirmPassword: "Les mots de passe ne correspondent pas."
            });
            return;
        }

        setLoading(true);

        try {
            // Ne pas envoyer confirmPassword au backend
            const userData = { ...formData };

            delete userData.confirmPassword;

            const response = await register(userData);

            console.log(response.data);

            alert("Compte créé avec succès !");

            navigate("/login");

        } catch (error) {
            console.error("Erreur inscription :", error);

            const apiErrors = {};

            const erreursBackend = error.response?.data?.errors;

            if (Array.isArray(erreursBackend)) {
                erreursBackend.forEach((err) => {
                    if (err.field) {
                        apiErrors[err.field] =
                            traduireErreur(err.field, err.message);
                    }
                });
            }

            if (Object.keys(apiErrors).length === 0) {
                apiErrors.general =
                    error.response?.data?.message ||
                    "Une erreur est survenue. Veuillez réessayer.";
            }

            setErrors(apiErrors);

        } finally {
            setLoading(false);
        }
    };

    // =====================================
    // AFFICHAGE D'UN CHAMP
    // =====================================

    const renderError = (name) => {
        if (!errors[name]) return null;

        return (
            <p className="error" role="alert">
                {errors[name]}
            </p>
        );
    };

    return (
        <div className="auth-container">

            <div className="auth-card">

                <h2>Créer un compte</h2>

                {/* CHOIX TYPE COMPTE */}

                <div className="account-choice">

                    <button
                        type="button"
                        className={typeAccount === "particulier" ? "active" : ""}
                        onClick={() => handleTypeAccount("particulier")}
                    >
                        Particulier
                    </button>

                    <button
                        type="button"
                        className={typeAccount === "professionnel" ? "active" : ""}
                        onClick={() => handleTypeAccount("professionnel")}
                    >
                        Professionnel
                    </button>

                </div>

                <form onSubmit={handleSubmit} noValidate>

                    {/* NOM ET PRENOM */}

                    <div className="input-group">

                        <div className="field">
                            <input
                                type="text"
                                name="nom"
                                placeholder="Nom"
                                value={formData.nom}
                                onChange={handleChange}
                                className={errors.nom ? "input-error" : ""}
                            />
                            {renderError("nom")}
                        </div>

                        <div className="field">
                            <input
                                type="text"
                                name="prenom"
                                placeholder="Prénom"
                                value={formData.prenom}
                                onChange={handleChange}
                                className={errors.prenom ? "input-error" : ""}
                            />
                            {renderError("prenom")}
                        </div>

                    </div>

                    {/* EMAIL */}

                    <div className="field">
                        <input
                            type="email"
                            name="email"
                            placeholder="Adresse email"
                            value={formData.email}
                            onChange={handleChange}
                            className={errors.email ? "input-error" : ""}
                        />
                        {renderError("email")}
                    </div>

                    {/* TELEPHONE */}

                    <div className="field">
                        <input
                            type="tel"
                            name="telephone"
                            placeholder="Numéro téléphone"
                            value={formData.telephone}
                            onChange={handleChange}
                            className={errors.telephone ? "input-error" : ""}
                        />
                        {renderError("telephone")}
                    </div>

                    {/* ADRESSE */}

                    <div className="field">
                        <input
                            type="text"
                            name="adresse"
                            placeholder="Adresse"
                            value={formData.adresse}
                            onChange={handleChange}
                            className={errors.adresse ? "input-error" : ""}
                        />
                        {renderError("adresse")}
                    </div>

                    {/* PAYS ET VILLE */}

                    <div className="input-group">

                        <div className="field">
                            <input
                                type="text"
                                name="pays"
                                placeholder="Pays"
                                value={formData.pays}
                                onChange={handleChange}
                                className={errors.pays ? "input-error" : ""}
                            />
                            {renderError("pays")}
                        </div>

                        <div className="field">
                            <input
                                type="text"
                                name="ville"
                                placeholder="Ville"
                                value={formData.ville}
                                onChange={handleChange}
                                className={errors.ville ? "input-error" : ""}
                            />
                            {renderError("ville")}
                        </div>

                    </div>

                    {/* CODE POSTAL */}

                    <div className="field">
                        <input
                            type="text"
                            name="codePostal"
                            placeholder="Code postal"
                            value={formData.codePostal}
                            onChange={handleChange}
                            className={errors.codePostal ? "input-error" : ""}
                        />
                        {renderError("codePostal")}
                    </div>

                    {/* MOT DE PASSE */}

                    <div className="field">
                        <input
                            type="password"
                            name="password"
                            placeholder="Mot de passe"
                            value={formData.password}
                            onChange={handleChange}
                            className={errors.password ? "input-error" : ""}
                        />
                        {renderError("password")}
                    </div>

                    {/* CONFIRMATION MOT DE PASSE */}

                    <div className="field">
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirmation mot de passe"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={
                                errors.confirmPassword ? "input-error" : ""
                            }
                        />
                        {renderError("confirmPassword")}
                    </div>

                    {/* INFORMATIONS PROFESSIONNELLES */}

                    {typeAccount === "professionnel" && (

                        <div className="professional-fields">

                            <h3>Informations entreprise</h3>

                            

                            

                            

                            <div className="field">
                                <input
                                    type="text"
                                    name="numeroTVA"
                                    placeholder="Numéro TVA intracommunautaire"
                                    value={formData.numeroTVA}
                                    onChange={handleChange}
                                    className={
                                        errors.numeroTVA ? "input-error" : ""
                                    }
                                />
                                {renderError("numeroTVA")}
                            </div>

                            <div className="field">
                                <select
                                    name="secteur"
                                    value={formData.secteur}
                                    onChange={handleChange}
                                    className={
                                        errors.secteur ? "input-error" : ""
                                    }
                                >
                                    <option value="">
                                        Secteur d'activité *
                                    </option>
                                    <option value="Commerce automobile">
                                        Commerce automobile
                                    </option>
                                    <option value="Distribution pneus">
                                        Distribution pneus
                                    </option>
                                    <option value="Garage automobile">
                                        Garage automobile
                                    </option>
                                    <option value="Autre">
                                        Autre
                                    </option>
                                </select>

                                {renderError("secteur")}
                            </div>

                        </div>

                    )}

                    {/* ERREUR GENERALE */}

                    {errors.general && (
                        <p className="error general-error" role="alert">
                            {errors.general}
                        </p>
                    )}

                    {/* BOUTON */}

                    <div className="register-buttons">
    <button
        type="submit"
        className="submit-btn"
        disabled={loading}
    >
        {loading ? "Création en cours..." : "Créer mon compte"}
    </button>

    <button
        type="button"
        className="btn-cancel"
        disabled={loading}
        onClick={() => navigate("/")}
    >
        Annuler
    </button>
</div>

                    

                </form>

            </div>

        </div>
    );
}

export default Register;
