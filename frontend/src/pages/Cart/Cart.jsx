
import "./Cart.css";

import { Link, useNavigate } from "react-router-dom";

import {
    FaTrash,
    FaMinus,
    FaPlus,
    FaShoppingCart
} from "react-icons/fa";

import { useCart } from "../../context/CartContext";

import { useState, useEffect } from "react";

import { API_URL } from "../../config";

import { getProfile } from "../../services/apiuser";


function Cart() {

    const navigate = useNavigate();


    // ==============================
    // CONTEXTE PANIER
    // ==============================

    const {
        cartItems,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
        cartTotal
    } = useCart();


    // ==============================
    // STATES
    // ==============================

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    const [user, setUser] = useState(null);


    // ==============================
    // RÉCUPÉRER UTILISATEUR CONNECTÉ
    // ==============================

    useEffect(() => {

        const checkUser = async () => {

            try {

                const response = await getProfile();

                setUser(response.data.user);

            } catch {

                console.log("Aucun utilisateur connecté.");

                setUser(null);

            }

        };


        checkUser();


        // Actualiser après connexion ou déconnexion

        window.addEventListener(
            "authChanged",
            checkUser
        );


        return () => {

            window.removeEventListener(
                "authChanged",
                checkUser
            );

        };

    }, []);


    // ==============================
    // CALCUL QUANTITÉ TOTALE
    // ==============================

    const quantiteTotale = cartItems.reduce(

        (total, pneu) => {

            return total + Number(pneu.quantity);

        },

        0

    );


    // ==============================
    // CALCUL DE LA REMISE
    // ==============================

    const typeClient = user?.typeClient;

    let remisePourcentage = 0;


    // Particulier : 5 % à partir de 4 pneus

    if (
        typeClient === "particulier" &&
        quantiteTotale >= 4
    ) {

        remisePourcentage = 5;

    }


    // Professionnel : 10 % à partir de 10 pneus

    if (
        typeClient === "professionnel" &&
        quantiteTotale >= 10
    ) {

        remisePourcentage = 10;

    }


    // ==============================
    // CALCUL DES MONTANTS
    // ==============================

    const sousTotal = Number(cartTotal) || 0;

    const remiseMontant = Number(

        (
            sousTotal * remisePourcentage / 100

        ).toFixed(2)

    );

    const totalEstime = Number(

        (
            sousTotal - remiseMontant

        ).toFixed(2)

    );


    // ==============================
    // PASSER LA COMMANDE
    // ==============================

    const handleCommande = async () => {

        // Sécurité

        if (cartItems.length === 0) {

            setError("Votre panier est vide.");

            return;

        }


        // Vérifier la connexion

        if (!user) {

            setError(
                "Vous devez être connecté pour passer une commande."
            );

            setTimeout(() => {

                navigate("/login");

            }, 1500);

            return;

        }


        setLoading(true);

        setError("");


        try {

            // ==============================
            // PRÉPARER LES ARTICLES
            // ==============================

            const items = cartItems.map((pneu) => ({

                pneuId: pneu.id,

                quantite: Number(pneu.quantity)

            }));


            console.log(
                "Articles envoyés :",
                items
            );


            // ==============================
            // ENVOYER AU BACKEND
            // ==============================

            const response = await fetch(

                `${API_URL}/commandes`,

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json"

                    },

                    credentials: "include",

                    body: JSON.stringify({

                        items

                    })

                }

            );


            const data = await response.json();


            console.log(
                "Réponse commande :",
                data
            );


            // ==============================
            // ERREUR BACKEND
            // ==============================

            if (!response.ok) {

                // Utilisateur non connecté

                if (response.status === 401) {

                    setError(
                        "Vous devez être connecté pour passer une commande."
                    );

                    setTimeout(() => {

                        navigate("/login");

                    }, 1500);

                    return;

                }


                setError(

                    data.message ||

                    "Impossible de créer la commande."

                );

                return;

            }


            // ==============================
            // COMMANDE CRÉÉE
            // ==============================

            if (data.success && data.commande?.id) {

                console.log(
                    "Commande créée :",
                    data.commande
                );


                // Vider le panier

                clearCart();


                // Redirection

                navigate(

                    `/commande/${data.commande.id}`

                );

            }

        } catch (error) {

            console.error(
                "Erreur commande :",
                error
            );


            setError(
                "Une erreur est survenue. Vérifiez votre connexion au serveur."
            );

        } finally {

            setLoading(false);

        }

    };


    // ==============================
    // PANIER VIDE
    // ==============================

    if (cartItems.length === 0) {

        return (

            <div className="cart-page">

                <div className="cart-container">

                    <div className="cart-empty">

                        <FaShoppingCart
                            className="cart-empty-icon"
                        />

                        <h1>
                            Votre panier est vide
                        </h1>

                        <p>
                            Vous n'avez encore ajouté aucun pneu à votre panier.
                        </p>

                        <Link
                            to="/pneus"
                            className="cart-continue-btn"
                        >
                            Voir les pneus
                        </Link>

                    </div>

                </div>

            </div>

        );

    }


    // ==============================
    // AFFICHAGE DU PANIER
    // ==============================

    return (

        <div className="cart-page">

            <div className="cart-container">


                {/* ==============================
                    TITRE
                ============================== */}

                <div className="cart-header">

                    <h1>
                        Mon panier
                    </h1>

                    <span>

                        {cartItems.length} produit

                        {cartItems.length > 1 ? "s" : ""}

                    </span>

                </div>


                {/* ==============================
                    ERREUR
                ============================== */}

                {error && (

                    <div className="cart-error">

                        {error}

                    </div>

                )}


                <div className="cart-content">


                    {/* ==============================
                        PRODUITS
                    ============================== */}

                    <div className="cart-products">

                        {cartItems.map((pneu) => (

                            <div
                                className="cart-item"
                                key={pneu.id}
                            >


                                {/* IMAGE */}

                                <div className="cart-item-image">

                                    <img

                                        src={`${API_URL}/uploadPneu/${pneu.image}`}

                                        alt={pneu.modele}

                                    />

                                </div>


                                {/* INFORMATIONS */}

                                <div className="cart-item-info">

                                    <h2>
                                        {pneu.modele}
                                    </h2>

                                    <p>
                                        Dimension : {pneu.dimension}
                                    </p>

                                    <p>
                                        Saison : {pneu.saison}
                                    </p>
<div className="cart-item-price">

    {Number(pneu.pourcentagePromotion) > 0 ? (

        <>
            <span className="cart-original-price">
                {Number(pneu.prixOriginal).toFixed(2)} DT
            </span>

            <span className="cart-promotion-badge">
                -{pneu.pourcentagePromotion} %
            </span>

            <strong className="cart-promotional-price">
                {Number(pneu.prix).toFixed(2)} DT
            </strong>
        </>

    ) : (

        <strong>
            {Number(pneu.prix).toFixed(2)} DT
        </strong>

    )}

</div>

                                </div>


                                {/* QUANTITÉ */}

                                <div className="cart-quantity">

                                    <button

                                        type="button"

                                        onClick={() =>
                                            decreaseQuantity(pneu.id)
                                        }

                                    >

                                        <FaMinus />

                                    </button>


                                    <span>
                                        {pneu.quantity}
                                    </span>


                                    <button

                                        type="button"

                                        onClick={() =>
                                            increaseQuantity(pneu.id)
                                        }

                                    >

                                        <FaPlus />

                                    </button>

                                </div>


                                {/* SOUS TOTAL PRODUIT */}

                                <div className="cart-item-subtotal">

                                    <strong>

                                        {(
                                            Number(pneu.prix) *
                                            Number(pneu.quantity)
                                        ).toFixed(2)} DT

                                    </strong>

                                </div>


                                {/* SUPPRIMER */}

                                <button

                                    type="button"

                                    className="cart-remove"

                                    onClick={() =>
                                        removeFromCart(pneu.id)
                                    }

                                    aria-label="Supprimer"

                                >

                                    <FaTrash />

                                </button>

                            </div>

                        ))}


                        {/* ==============================
                            VIDER LE PANIER
                        ============================== */}

                        <button

                            type="button"

                            className="cart-clear-btn"

                            onClick={clearCart}

                        >

                            <FaTrash />

                            Vider le panier

                        </button>

                    </div>


                    {/* ==============================
                        RÉSUMÉ COMMANDE
                    ============================== */}

                    <div className="cart-summary">

                        <h2>
                            Résumé de la commande
                        </h2>


                        {/* ==============================
                            INFORMATION REMISES
                        ============================== */}

                        <div className="cart-discount-info">

                            <div className="cart-discount-title">

                                <span>🎁</span>

                                <strong>
                                    Profitez de nos remises !
                                </strong>

                            </div>


                            <p>

                                <strong>
                                    Particuliers :
                                </strong>

                                {" "}5 % de remise à partir de 4 pneus.

                            </p>


                            <p>

                                <strong>
                                    Professionnels :
                                </strong>

                                {" "}10 % de remise à partir de 10 pneus.

                            </p>


                            <div className="cart-discount-progress">

                                Votre panier contient actuellement{" "}

                                <strong>
                                    {quantiteTotale} pneu(x)
                                </strong>.

                            </div>


                            {user && remisePourcentage > 0 ? (

                                <p className="cart-discount-success">

                                    Félicitations ! Vous bénéficiez de{" "}

                                    <strong>
                                        {remisePourcentage} %
                                    </strong>{" "}

                                    de remise.

                                </p>

                            ) : user ? (

                                <small>

                                    {typeClient === "particulier"

                                        ? `Ajoutez encore ${Math.max(0, 4 - quantiteTotale)} pneu(x) pour bénéficier de 5 % de remise.`

                                        : typeClient === "professionnel"

                                            ? `Ajoutez encore ${Math.max(0, 10 - quantiteTotale)} pneu(x) pour bénéficier de 10 % de remise.`

                                            : "Votre type de compte ne permet pas de déterminer une remise."

                                    }

                                </small>

                            ) : (

                                <small>
                                    Connectez-vous pour bénéficier de votre remise selon votre type de compte.
                                </small>

                            )}

                        </div>


                        {/* SOUS-TOTAL */}

                        <div className="cart-summary-line">

                            <span>
                                Sous-total
                            </span>

                            <strong>
                                {sousTotal.toFixed(2)} DT
                            </strong>

                        </div>


                        {/* REMISE */}

                        {remisePourcentage > 0 && (

                            <div className="cart-summary-line cart-discount-line">

                                <span>

                                    Remise ({remisePourcentage} %)

                                </span>

                                <strong>

                                    - {remiseMontant.toFixed(2)} DT

                                </strong>

                            </div>

                        )}


                        {/* RETRAIT */}

                        <div className="cart-summary-line">

                            <span>
                                Retrait en magasin
                            </span>

                            <span>
                                Gratuit
                            </span>

                        </div>


                        {/* TOTAL */}

                        <div className="cart-summary-total">

                            <span>
                                Total estimé
                            </span>

                            <strong>
                                {totalEstime.toFixed(2)} DT
                            </strong>

                        </div>


                        {/* ==============================
                            PASSER COMMANDE
                        ============================== */}

                        <button

                            type="button"

                            className="cart-order-btn"

                            onClick={handleCommande}

                            disabled={loading}

                        >

                            {loading

                                ? "Création de la commande..."

                                : "Passer la commande"

                            }

                        </button>


                        {/* CONTINUER ACHATS */}

                        <Link

                            to="/pneus"

                            className="cart-continue-link"

                        >

                            Continuer mes achats

                        </Link>

                    </div>

                </div>

            </div>

        </div>

    );

}


export default Cart;
