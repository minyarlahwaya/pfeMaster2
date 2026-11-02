
import "./Auth.css";

import {
    Link,
    useNavigate
} from "react-router-dom";

import {
    useState
} from "react";

import {
    login,
    loginMfa
} from "../../services/apiuser";


function Login() {

    const navigate = useNavigate();


    // ==============================
    // FORMULAIRE
    // ==============================

    const [formData, setFormData] = useState({

        email: "",
        password: ""

    });


    // ==============================
    // ERREUR
    // ==============================

    const [error, setError] = useState("");


    // ==============================
    // DOUBLE AUTHENTIFICATION
    // ==============================

    const [mfaStep, setMfaStep] = useState(false);

    const [mfaCode, setMfaCode] = useState("");

    const [useRecoveryCode, setUseRecoveryCode] = useState(false);


    // ==============================
    // MODIFICATION CHAMPS
    // ==============================

    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;


        setFormData({

            ...formData,

            [name]: value

        });


        setError("");

    };


    // ==============================
    // CONNEXION
    // ==============================

    const handleSubmit = async (e) => {

        e.preventDefault();


        try {

            // ========================================
            // APPEL API LOGIN
            // ========================================

            const response = await login(formData);


            // ========================================
            // COMPTE PROTÉGÉ PAR LA DOUBLE AUTHENTIFICATION
            // ========================================

            if (response.data.mfaRequired) {

                setMfaStep(true);

                return;

            }


            finishLogin(response.data.user);

        }

        catch (error) {

            console.log(
                "STATUS :",
                error.response?.status
            );


            console.log(
                "DATA :",
                error.response?.data
            );


            console.log(
                "MESSAGE :",
                error.response?.data?.message
            );


            setError(

                error.response?.data?.message ||

                "Erreur de connexion"

            );

        }

    };


    // ==============================
    // 2E ÉTAPE : CODE AUTHENTICATOR
    // ==============================

    const handleMfaSubmit = async (e) => {

        e.preventDefault();

        try {

            const response = await loginMfa(

                useRecoveryCode
                    ? { recoveryCode: mfaCode }
                    : { code: mfaCode }

            );

            if (useRecoveryCode) {

                alert(
                    `Code de secours utilisé. Il vous en reste ${response.data.recoveryCodesLeft}.`
                );

            }

            finishLogin(response.data.user);

        }

        catch (error) {

            setMfaCode("");

            // Jeton intermédiaire expiré ou trop de tentatives
            if ([401, 429].includes(error.response?.status)) {

                setMfaStep(false);

                setFormData({ ...formData, password: "" });

            }

            setError(

                error.response?.data?.message ||

                "Code de vérification incorrect"

            );

        }

    };


    const handleBackToLogin = () => {

        setMfaStep(false);

        setMfaCode("");

        setUseRecoveryCode(false);

        setError("");

    };


    // ==============================
    // CONNEXION TERMINÉE
    // ==============================


const finishLogin = (user) => {

    console.log("✅ Connexion réussie :", user);

    // Informer la Navbar que l'authentification a changé
    window.dispatchEvent(new Event("authChanged"));

    // Redirection selon le rôle
    if (user.role === "admin") {
        navigate("/admin");
    } else {
        navigate("/profile");
    }
};


    // ==============================
    // AFFICHAGE
    // ==============================

    if (mfaStep) {

        return (

            <div className="auth-container">


                <div className="auth-card">


                    <h2>
                        Vérification en deux étapes
                    </h2>


                    <p className="mfa-help">

                        {useRecoveryCode
                            ? "Saisissez l'un de vos codes de secours (usage unique)."
                            : "Ouvrez votre application d'authentification (Google Authenticator, Microsoft Authenticator...) et saisissez le code à 6 chiffres affiché pour LANDOLSI TIRES."
                        }

                    </p>


                    <form onSubmit={handleMfaSubmit}>


                        <input

                            type="text"

                            name="mfaCode"

                            className="mfa-code-input"

                            placeholder={useRecoveryCode ? "XXXXX-XXXXX" : "123456"}

                            inputMode={useRecoveryCode ? "text" : "numeric"}

                            autoComplete="one-time-code"

                            maxLength={useRecoveryCode ? 11 : 6}

                            value={mfaCode}

                            onChange={(e) => {
                                setMfaCode(e.target.value);
                                setError("");
                            }}

                            autoFocus

                            required

                        />


                        {error && (

                            <p className="error">

                                {error}

                            </p>

                        )}


                        <button

                            type="submit"

                            className="submit-btn"

                        >

                            Vérifier

                        </button>


                    </form>


                    <div className="auth-links">


                        <button
                            type="button"
                            className="mfa-link-btn"
                            onClick={() => {
                                setUseRecoveryCode(!useRecoveryCode);
                                setMfaCode("");
                                setError("");
                            }}
                        >

                            {useRecoveryCode
                                ? "Utiliser l'application d'authentification"
                                : "Téléphone indisponible ? Utiliser un code de secours"
                            }

                        </button>


                        <button
                            type="button"
                            className="mfa-link-btn"
                            onClick={handleBackToLogin}
                        >

                            Retour à la connexion

                        </button>


                    </div>


                </div>


            </div>

        );

    }


    return (

        <div className="auth-container">


            <div className="auth-card">


                <h2>
                    Connexion
                </h2>


                <form onSubmit={handleSubmit}>


                    {/* EMAIL */}

                    <input

                        type="email"

                        name="email"

                        placeholder="Adresse email"

                        value={formData.email}

                        onChange={handleChange}

                        required

                    />


                    {/* MOT DE PASSE */}

                    <input

                        type="password"

                        name="password"

                        placeholder="Mot de passe"

                        value={formData.password}

                        onChange={handleChange}

                        required

                    />


                    {/* ERREUR */}

                    {error && (

                        <p className="error">

                            {error}

                        </p>

                    )}


                    {/* BOUTON */}

                    <button

                        type="submit"

                        className="submit-btn"

                    >

                        Se connecter

                    </button>


                </form>


                <div className="auth-links">


                    <a href="/forgot-password">

                        Mot de passe oublié ?

                    </a>


                    <p>

                        Vous n'avez pas de compte ?{" "}


                        <Link to="/register">

                            Créer un compte

                        </Link>

                    </p>


                </div>


            </div>


        </div>

    );

}


export default Login;

