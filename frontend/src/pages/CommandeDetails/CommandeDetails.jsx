
import "./CommandeDetails.css";

import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import {
    FaCheckCircle,
    FaMapMarkerAlt,
    FaPhone,
    FaBoxOpen,
    FaArrowLeft,
    FaShoppingBag,
    FaCommentDots,
    FaTimes
} from "react-icons/fa";

import {
    getCommandeById,
    downloadFacturePDF
} from "../../services/commandeApi";

import { getAvisByCommande } from "../../services/avisApi";

import AvisForm from "../../components/Avis/AvisForm";
import { API_URL } from "../../config";


function CommandeDetails() {

    const { id } = useParams();

    const [commande, setCommande] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Plusieurs avis possibles pour chaque pneu
    const [avisParPneu, setAvisParPneu] = useState({});

    // État d'ouverture du formulaire par pneu
    const [avisOuverts, setAvisOuverts] = useState({});


    // ========================================
    // TÉLÉCHARGER LA FACTURE PDF
    // ========================================

    const handleDownloadFacture = async () => {
        try {
            await downloadFacturePDF(commande.id);
        } catch (error) {
            console.error(
                "Erreur téléchargement facture :",
                error
            );

            alert(
                error.response?.data?.message ||
                "Impossible de télécharger la facture."
            );
        }
    };


    // ========================================
    // RÉCUPÉRER LA COMMANDE
    // ========================================

    useEffect(() => {

        const fetchCommande = async () => {

            try {

                setLoading(true);
                setError("");

                const response = await getCommandeById(id);

                if (response.data.success) {
                    setCommande(response.data.commande);
                } else {
                    setError("Impossible de récupérer la commande.");
                }

            } catch (error) {

                console.error(
                    "Erreur récupération commande :",
                    error
                );

                setError(
                    error.response?.data?.message ||
                    "Impossible de récupérer la commande."
                );

            } finally {
                setLoading(false);
            }
        };

        fetchCommande();

    }, [id]);


    // ========================================
    // RÉCUPÉRER TOUS LES AVIS DE LA COMMANDE
    // ========================================

    useEffect(() => {

        if (!commande) return;

        const statutAutorise = [
            "confirmée",
            "expédiée",
            "livrée"
        ].includes(commande.statut);

        if (!statutAutorise) return;

        let actif = true;

        const fetchAvis = async () => {

            try {

                const response = await getAvisByCommande(commande.id);

                const data = response?.data ?? response;

                const listeAvis = Array.isArray(data.avis)
                    ? data.avis
                    : data.avis
                        ? [data.avis]
                        : [];

                const avisMap = {};

                listeAvis.forEach((avis) => {

                    const pneuId = avis.pneuId ?? avis.pneu?.id;

                    if (pneuId) {

                        if (!avisMap[pneuId]) {
                            avisMap[pneuId] = [];
                        }

                        avisMap[pneuId].push(avis);
                    }
                });

                if (actif) {
                    setAvisParPneu(avisMap);
                }

            } catch (error) {

                console.error(
                    "Erreur récupération des avis :",
                    error
                );
            }
        };

        fetchAvis();

        return () => {
            actif = false;
        };

    }, [commande]);


    // ========================================
    // AJOUTER UN NOUVEL AVIS À LA LISTE
    // ========================================

    const handleAvisAjoute = (pneuId, nouvelAvis) => {

        if (!nouvelAvis) return;

        setAvisParPneu((anciens) => {

            const avisExistants = anciens[pneuId] || [];

            return {
                ...anciens,
                [pneuId]: [
                    nouvelAvis,
                    ...avisExistants
                ]
            };
        });

    };


    // ========================================
    // CHARGEMENT
    // ========================================

    if (loading) {

        return (
            <div className="commande-page">

                <div className="commande-loading">

                    <div className="commande-loader"></div>

                    <p>
                        Chargement de votre commande...
                    </p>

                </div>

            </div>
        );

    }


    // ========================================
    // ERREUR
    // ========================================

    if (error || !commande) {

        return (

            <div className="commande-page">

                <div className="commande-error">

                    <h2>
                        Commande introuvable
                    </h2>

                    <p>
                        {error}
                    </p>

                    <Link
                        to="/pneus"
                        className="commande-back-btn"
                    >

                        <FaArrowLeft />

                        Retour aux pneus

                    </Link>

                </div>

            </div>
        );

    }


    // ========================================
    // AVIS AUTORISÉ ?
    // ========================================

    const avisAutorise = [
        "confirmée",
        "expédiée",
        "livrée"
    ].includes(commande.statut);


    // ========================================
    // AFFICHAGE
    // ========================================

    return (

        <div className="commande-page">

            <div className="commande-container">


                {/* ========================================
                    BREADCRUMB
                ======================================== */}

                <div className="commande-breadcrumb">

                    <Link to="/">
                        Accueil
                    </Link>

                    <span> / </span>

                    <Link to="/panier">
                        Panier
                    </Link>

                    <span> / </span>

                    <strong>
                        Commande #{commande.id}
                    </strong>

                </div>


                {/* ========================================
                    HEADER SUCCÈS
                ======================================== */}

                <div className="commande-success-card">

                    <div className="commande-success-icon">
                        <FaCheckCircle />
                    </div>

                    <div className="commande-success-text">

                        <h1>
                            Commande confirmée
                        </h1>

                        <p>
                            Merci pour votre commande,
                            <strong>
                                {" "}
                                {commande.prenom}
                            </strong>.
                        </p>

                        <span>
                            Votre commande a bien été enregistrée.
                        </span>

                    </div>

                    <div className="commande-number">

                        <span>
                            N° commande
                        </span>

                        <strong>
                            #{commande.id}
                        </strong>

                    </div>

                </div>


                {/* ========================================
                    STATUT
                ======================================== */}

                <div className="commande-status-card">

                    <div>

                        <span className="status-label">
                            Statut de la commande
                        </span>

                        <strong className="status-value">
                            {commande.statut}
                        </strong>

                    </div>

                    <div className="status-step">

                        <div className="status-circle active">
                            ✓
                        </div>

                        <span>
                            Commande reçue
                        </span>

                    </div>

                    <div className="status-line"></div>

                    <div className="status-step">

                        <div className="status-circle">
                            2
                        </div>

                        <span>
                            Préparation
                        </span>

                    </div>

                    <div className="status-line"></div>

                    <div className="status-step">

                        <div className="status-circle">
                            3
                        </div>

                        <span>
                            Récupération
                        </span>

                    </div>

                </div>


                {/* ========================================
                    CONTENU PRINCIPAL
                ======================================== */}

                <div className="commande-grid">


                    {/* ========================================
                        COLONNE GAUCHE
                    ======================================== */}

                    <div className="commande-main">


                        {/* ========================================
                            ARTICLES
                        ======================================== */}

                        <div className="commande-card">

                            <div className="commande-card-header">

                                <div>
                                    <FaShoppingBag />

                                    <h2>
                                        Articles commandés
                                    </h2>
                                </div>

                                <span>

                                    {commande.items?.length || 0} article
                                    {commande.items?.length > 1 ? "s" : ""}

                                </span>

                            </div>


                            <div className="commande-items">

                                {commande.items?.map((item) => (

                                    <div
                                        className="commande-item"
                                        key={item.id}
                                    >

                                        {/* IMAGE */}

                                        <div className="commande-item-image">

                                            {item.pneu?.image ? (

                                                <img
                                                    src={`${API_URL}/uploadPneu/${item.pneu.image}`}
                                                    alt={
                                                        item.pneu?.modele ||
                                                        "Pneu"
                                                    }
                                                />

                                            ) : (

                                                <div className="no-image">
                                                    🛞
                                                </div>

                                            )}

                                        </div>


                                        {/* INFOS */}

                                        <div className="commande-item-info">

                                            <h3>
                                                {item.pneu?.modele || "Pneu"}
                                            </h3>

                                            {item.pneu?.marque?.nom && (

                                                <span className="commande-marque">
                                                    {item.pneu.marque.nom}
                                                </span>

                                            )}

                                            <p>
                                                {item.pneu?.dimension ||
                                                    "Dimension non renseignée"}
                                            </p>

                                            <span>
                                                Saison :{" "}
                                                {item.pneu?.saison || "Non renseignée"}
                                            </span>

                                            <span>
                                                Quantité : {item.quantite}
                                            </span>

                                        </div>


                                        {/* PRIX */}

                                        <div className="commande-item-price">

                                            {Number(item.pourcentagePromotion) > 0 ? (

                                                <>

                                                    <span className="commande-original-price">

                                                        {Number(item.prixOriginal).toFixed(2)}{" "}
                                                        DT / unité

                                                    </span>

                                                    <span className="commande-promotion">

                                                        -{Number(item.pourcentagePromotion)} %

                                                    </span>

                                                    <strong className="commande-promo-price">

                                                        {Number(item.prix).toFixed(2)}{" "}
                                                        DT / unité

                                                    </strong>

                                                </>

                                            ) : (

                                                <span className="commande-normal-price">

                                                    {Number(item.prix).toFixed(2)}{" "}
                                                    DT / unité

                                                </span>

                                            )}

                                            <strong className="commande-item-total">

                                                {(
                                                    Number(item.prix) *
                                                    Number(item.quantite)
                                                ).toFixed(2)}{" "}
                                                DT

                                            </strong>

                                        </div>

                                    </div>

                                ))}

                            </div>

                        </div>


                        {/* ========================================
                            INFORMATIONS CLIENT
                        ======================================== */}

                        <div className="commande-card">

                            <div className="commande-card-header">

                                <div>

                                    <FaMapMarkerAlt />

                                    <h2>
                                        Informations de récupération
                                    </h2>

                                </div>

                            </div>

                            <div className="livraison-content">

                                <div className="livraison-icon">
                                    <FaMapMarkerAlt />
                                </div>

                                <div>

                                    <strong>
                                        {commande.prenom} {commande.nom}
                                    </strong>

                                    <p>
                                        {commande.adresse}
                                    </p>

                                    <p>
                                        {commande.codePostal} {commande.ville}
                                    </p>

                                    <p className="telephone">
                                        <FaPhone />
                                        {commande.telephone}
                                    </p>

                                </div>

                            </div>

                        </div>


                        {/* ========================================
                            AVIS CLIENT
                        ======================================== */}

                        {avisAutorise && (

                            <div className="commande-card">

                                <div className="commande-card-header">

                                    <div>

                                        <FaCommentDots />

                                        <h2>
                                            Avis sur vos pneus
                                        </h2>

                                    </div>

                                </div>


                                <div className="commande-avis-content">

                                    {commande.items?.map((item) => {

                                        const pneuId = item.pneuId ?? item.pneu?.id;

                                        if (!pneuId) return null;

                                        const listeAvisPneu =
                                            avisParPneu[pneuId] || [];

                                        const formulaireOuvert =
                                            !!avisOuverts[pneuId];

                                        return (

                                            <div
                                                key={item.id}
                                                className="avis-pneu-item"
                                            >

                                                <div className="avis-pneu-entete">

                                                    <div className="avis-pneu-infos">

                                                        <h3>
                                                            {item.pneu?.marque?.nom}{" "}
                                                            {item.pneu?.modele || "Pneu"}
                                                        </h3>

                                                        <span>
                                                            {item.pneu?.dimension ||
                                                                "Dimension non renseignée"}
                                                        </span>

                                                        <p className="avis-confirmation">

                                                            <FaCheckCircle />

                                                            {listeAvisPneu.length} avis publié(s)

                                                        </p>

                                                    </div>


                                                    {/* BOUTON TOUJOURS DISPONIBLE */}

                                                    <button
                                                        type="button"
                                                        className="avis-toggle-btn"
                                                        title={
                                                            formulaireOuvert
                                                                ? "Fermer le formulaire"
                                                                : "Ajouter un commentaire"
                                                        }
                                                        aria-label={
                                                            formulaireOuvert
                                                                ? "Fermer le formulaire"
                                                                : "Ajouter un commentaire"
                                                        }
                                                        aria-expanded={formulaireOuvert}
                                                        onClick={() => {

                                                            setAvisOuverts((anciens) => ({

                                                                ...anciens,

                                                                [pneuId]: !anciens[pneuId]

                                                            }));

                                                        }}
                                                    >

                                                        {formulaireOuvert
                                                            ? <FaTimes />
                                                            : <FaCommentDots />}

                                                    </button>

                                                </div>


                                                {/* FORMULAIRE D'AJOUT */}

                                                {formulaireOuvert && (

                                                    <div className="avis-form-container">

                                                        <AvisForm
                                                            key={`${commande.id}-${pneuId}`}
                                                            commandeId={commande.id}
                                                            pneuId={pneuId}
                                                            onAvisAjoute={(nouvelAvis) => {

                                                                handleAvisAjoute(
                                                                    pneuId,
                                                                    nouvelAvis
                                                                );

                                                            }}
                                                        />

                                                    </div>

                                                )}


                                                {/* HISTORIQUE DES AVIS */}

                                                {listeAvisPneu.length > 0 && (

                                                    <div className="avis-historique">

                                                        <h4>
                                                            Vos commentaires précédents
                                                        </h4>

                                                        {listeAvisPneu.map((avis) => (

                                                            <div
                                                                key={avis.id}
                                                                className="avis-historique-item"
                                                            >

                                                                <div className="avis-historique-note">

                                                                    {"★".repeat(Number(avis.note) || 0)}

                                                                    {"☆".repeat(
                                                                        5 - (Number(avis.note) || 0)
                                                                    )}

                                                                </div>

                                                                <p>
                                                                    {avis.commentaire ||
                                                                        "Aucun commentaire écrit."}
                                                                </p>

                                                                <small>
                                                                    {avis.createdAt
                                                                        ? new Date(
                                                                            avis.createdAt
                                                                        ).toLocaleDateString("fr-FR")
                                                                        : ""}
                                                                </small>

                                                            </div>

                                                        ))}

                                                    </div>

                                                )}

                                            </div>

                                        );

                                    })}

                                </div>

                            </div>

                        )}


                    </div>


                    {/* ========================================
                        COLONNE DROITE
                    ======================================== */}

                    <aside className="commande-sidebar">


                        {/* ========================================
                            RÉSUMÉ
                        ======================================== */}

                        <div className="commande-summary-card">

                            <div className="summary-header">

                                <FaBoxOpen />

                                <h2>
                                    Résumé
                                </h2>

                            </div>

                            <div className="summary-line">

                                <span>
                                    Sous-total
                                </span>

                                <strong>
                                    {Number(
                                        commande.sousTotal ?? commande.total
                                    ).toFixed(2)} DT
                                </strong>

                            </div>

                            {Number(commande.remiseQuantite) > 0 && (

                                <div className="summary-line">

                                    <span>

                                        Remise quantité

                                        {commande.pourcentageRemiseQuantite
                                            ? ` (-${commande.pourcentageRemiseQuantite} %)`
                                            : ""}

                                    </span>

                                    <strong className="summary-discount">

                                        -{Number(commande.remiseQuantite).toFixed(2)} DT

                                    </strong>

                                </div>

                            )}

                            <div className="summary-line">

                                <span>
                                    Récupération
                                </span>

                                <span className="summary-gray">
                                    Sur place
                                </span>

                            </div>

                            <div className="summary-separator"></div>

                            <div className="summary-total">

                                <span>
                                    Total à payer
                                </span>

                                <strong>
                                    {Number(commande.total).toFixed(2)} DT
                                </strong>

                            </div>

                            {Number(commande.quantiteTotale) >= 4 && (

                                <p className="summary-discount-message">

                                    Félicitations ! Vous bénéficiez de la remise de 10 % dès
                                    4 pneus achetés.

                                </p>

                            )}

                            <div className="summary-payment">
                                Paiement lors de la récupération
                            </div>

                        </div>


                        {/* ========================================
                            FACTURE
                        ======================================== */}

                        {commande.statut === "confirmée" && (

                            <button
                                type="button"
                                className="commande-facture-btn"
                                onClick={handleDownloadFacture}
                            >

                                📄 Télécharger la facture PDF

                            </button>

                        )}


                        {/* ========================================
                            ACTIONS
                        ======================================== */}

                        <Link
                            to="/pneus"
                            className="commande-shopping-btn"
                        >

                            <FaShoppingBag />

                            Continuer mes achats

                        </Link>


                        <Link
                            to="/"
                            className="commande-home-btn"
                        >

                            Retour à l'accueil

                        </Link>

                    </aside>

                </div>

            </div>

        </div>

    );

}


export default CommandeDetails;
