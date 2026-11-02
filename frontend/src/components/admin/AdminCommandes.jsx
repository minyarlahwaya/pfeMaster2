
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaShoppingCart,
    FaUser,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaCalendarAlt,
    FaTrash,
    FaChevronDown,
    FaBoxOpen,
    FaHome,
    FaFilePdf,
    FaSearch,
    FaTimes,
    FaBriefcase,
    FaIdCard
} from "react-icons/fa";

import {
    getAllCommandesAdmin,
    updateStatutCommande,
    deleteCommande,
    downloadFacturePDF
} from "../../services/commandeApi";

import "./AdminCommandes.css";
import { API_URL } from "../../config";

// ========================================
// PROCHAIN STATUT
// ========================================

const getProchainStatut = (statut) => {
    const progression = {
        "en attente": "confirmée",
        "confirmée": "en préparation",
        "en préparation": "récupérée"
    };

    return progression[statut] || null;
};

// ========================================
// CLASSE DU STATUT
// ========================================
const getStatutClass = (statut) => {
    switch (statut) {
        case "en attente":
            return "status-en-attente";

        case "confirmée":
            return "status-confirmee";

        case "en préparation":
            return "status-en-preparation";

        case "récupérée":
            return "status-recuperee";

        case "annulée":
            return "status-annulee";

        default:
            return "";
    }
};
// ========================================
// FORMAT DATE ET HEURE
// ========================================

const formatDate = (date) => {
    if (!date) return "Date indisponible";

    const valeur = new Date(date);

    if (isNaN(valeur.getTime())) {
        return "Date indisponible";
    }

    return valeur.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
};

// ========================================
// FORMAT DATE LOCALE POUR LA RECHERCHE
// ========================================

const obtenirDateLocale = (date) => {
    if (!date) return "";

    const valeur = new Date(date);

    if (isNaN(valeur.getTime())) return "";

    const annee = valeur.getFullYear();
    const mois = String(valeur.getMonth() + 1).padStart(2, "0");
    const jour = String(valeur.getDate()).padStart(2, "0");

    return `${annee}-${mois}-${jour}`;
};

// ========================================
// COMPOSANT
// ========================================

function AdminCommandes() {
    const [commandes, setCommandes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Critères de recherche
    const [rechercheClient, setRechercheClient] = useState("");
    const [dateRecherche, setDateRecherche] = useState("");
    const [statutRecherche, setStatutRecherche] = useState("");

    // Type de client sélectionné
    const [typeClientActif, setTypeClientActif] = useState("particulier");

    const navigate = useNavigate();

    // ========================================
    // CHARGER LES COMMANDES
    // ========================================

    const chargerCommandes = async () => {
        try {
            setLoading(true);

            const response = await getAllCommandesAdmin();

            if (response.data.success) {
                setCommandes(response.data.commandes || []);
            } else {
                setCommandes([]);
            }
        } catch (error) {
            console.error("Erreur récupération commandes :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de récupérer les commandes."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        chargerCommandes();
    }, []);

    // ========================================
    // RECHERCHE PAR CLIENT, DATE ET STATUT
    // ========================================

    const commandesFiltrees = commandes.filter((commande) => {
        const recherche = rechercheClient.trim().toLowerCase();

        const nom = String(commande.nom || "").toLowerCase();
        const prenom = String(commande.prenom || "").toLowerCase();

        const nomComplet = `${prenom} ${nom}`.trim();
        const nomInverse = `${nom} ${prenom}`.trim();

        const email = String(
            commande.user?.email || ""
        ).toLowerCase();

        const telephone = String(
            commande.telephone || commande.user?.telephone || ""
        ).toLowerCase();

        const correspondClient =
            !recherche ||
            nom.includes(recherche) ||
            prenom.includes(recherche) ||
            nomComplet.includes(recherche) ||
            nomInverse.includes(recherche) ||
            email.includes(recherche) ||
            telephone.includes(recherche);

        const dateCommande = obtenirDateLocale(commande.createdAt);

        const correspondDate =
            !dateRecherche || dateCommande === dateRecherche;

        const correspondStatut =
            !statutRecherche || commande.statut === statutRecherche;

        return correspondClient && correspondDate && correspondStatut;
    });

    // ========================================
    // SÉPARER LES COMMANDES PAR TYPE DE CLIENT
    // ========================================

    const commandesParType = commandesFiltrees.filter((commande) => {
        return commande.user?.typeClient === typeClientActif;
    });

    // Compteurs par type de client
    const nombreParticuliers = commandes.filter(
        (commande) => commande.user?.typeClient === "particulier"
    ).length;

    const nombreProfessionnels = commandes.filter(
        (commande) => commande.user?.typeClient === "professionnel"
    ).length;

    // ========================================
    // EFFACER TOUS LES FILTRES
    // ========================================

    const effacerFiltres = () => {
        setRechercheClient("");
        setDateRecherche("");
        setStatutRecherche("");
    };

    // ========================================
    // MODIFIER LE STATUT
    // ========================================

    const handleStatutChange = async (commandeId, nouveauStatut) => {
        if (nouveauStatut === "confirmée") {
            const commandeActuelle = commandes.find(
                (c) => c.id === commandeId
            );

            if (commandeActuelle?.statut !== "confirmée") {
                const ok = window.confirm(
                    `Confirmer la commande n°${commandeId} ?\n\n` +
                    "Vérifiez d'abord la commande avec le client.\n" +
                    "La facture lui sera envoyée automatiquement par e-mail, avec un message " +
                    "indiquant que sa commande est prête à être récupérée chez LANDOLSI TIRES."
                );

                if (!ok) {
                    chargerCommandes();
                    return;
                }
            }
        }

        try {
            const response = await updateStatutCommande(
                commandeId,
                nouveauStatut
            );

            const emailFacture = response.data.emailFacture;

            if (emailFacture) {
                alert(
                    emailFacture.envoye
                        ? `✅ Commande confirmée.\n${emailFacture.message}`
                        : `⚠️ Commande confirmée, mais ${emailFacture.message.charAt(0).toLowerCase()}${emailFacture.message.slice(1)}`
                );
            }

            if (response.data.success) {
                setCommandes((anciennesCommandes) =>
                    anciennesCommandes.map((commande) =>
                        commande.id === commandeId
                            ? {
                                ...commande,
                                statut: nouveauStatut,
                                facture:
                                    response.data.facture ||
                                    commande.facture
                            }
                            : commande
                    )
                );
            }
        } catch (error) {
            console.error("Erreur modification statut :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de modifier le statut."
            );

            chargerCommandes();
        }
    };

    // ========================================
    // TÉLÉCHARGER LA FACTURE
    // ========================================

    const handleDownloadFacture = async (commandeId) => {
        try {
            await downloadFacturePDF(commandeId);
        } catch (error) {
            console.error("Erreur téléchargement facture :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de télécharger la facture."
            );
        }
    };

    // ========================================
    // SUPPRIMER UNE COMMANDE
    // ========================================

    const handleDelete = async (commandeId) => {
        const confirmation = window.confirm(
            "Voulez-vous vraiment supprimer cette commande ?"
        );

        if (!confirmation) return;

        try {
            const response = await deleteCommande(commandeId);

            if (response.data.success) {
                setCommandes((anciennesCommandes) =>
                    anciennesCommandes.filter(
                        (commande) => commande.id !== commandeId
                    )
                );

                alert("Commande supprimée avec succès.");
            }
        } catch (error) {
            console.error("Erreur suppression commande :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de supprimer la commande."
            );
        }
    };

    // ========================================
    // CHARGEMENT
    // ========================================

    if (loading) {
        return (
            <div className="admin-commandes-page">
                <div className="commandes-loading">
                    <FaShoppingCart />
                    <p>Chargement des commandes...</p>
                </div>
            </div>
        );
    }

    // ========================================
    // AFFICHAGE
    // ========================================

    return (
        <div className="admin-commandes-page">

            {/* EN-TÊTE */}

            <div className="commandes-page-header">
                <div>
                    <h1>
                        <FaShoppingCart />
                        Commandes
                    </h1>

                    <p>Gestion des commandes clients</p>
                </div>

                <div className="commandes-header-actions">
                    <button
                        type="button"
                        className="btn-retour-dashboard"
                        title="Retour au dashboard"
                        onClick={() => navigate("/admin")}
                    >
                        <FaHome />
                        <span>Dashboard</span>
                    </button>

                    <div className="commandes-count">
                        {commandesParType.length}
                        <span>
                            commande
                            {commandesParType.length > 1 ? "s" : ""}
                        </span>
                    </div>
                </div>
            </div>

            {/* RECHERCHE ET FILTRES */}

            <section className="commandes-search-panel">
                <div className="commandes-search-title">
                    <FaSearch />

                    <div>
                        <h2>Rechercher une commande</h2>
                        <p>
                            Recherchez par client, téléphone, e-mail,
                            date ou statut de commande.
                        </p>
                    </div>
                </div>

                <div className="commandes-search-grid">

                    {/* RECHERCHE CLIENT */}

                    <div className="commandes-search-field">
                        <label htmlFor="rechercheClient">
                            Nom, prénom, téléphone ou e-mail
                        </label>

                        <div className="commandes-input-wrapper">
                            <FaSearch />

                            <input
                                id="rechercheClient"
                                type="text"
                                value={rechercheClient}
                                onChange={(e) =>
                                    setRechercheClient(e.target.value)
                                }
                                placeholder="Ex. : Minyar, 22..., client@email.com"
                            />
                        </div>
                    </div>

                    {/* RECHERCHE PAR DATE */}

                    <div className="commandes-search-field">
                        <label htmlFor="dateRecherche">
                            Date de commande
                        </label>

                        <div className="commandes-input-wrapper">
                            <FaCalendarAlt />

                            <input
                                id="dateRecherche"
                                type="date"
                                value={dateRecherche}
                                onChange={(e) =>
                                    setDateRecherche(e.target.value)
                                }
                            />
                        </div>
                    </div>

                    {/* RECHERCHE PAR STATUT */}

                    <div className="commandes-search-field">
                        <label htmlFor="statutRecherche">
                            Statut de commande
                        </label>

                        <div className="commandes-input-wrapper">
                            <FaShoppingCart />

                            <select
                                id="statutRecherche"
                                value={statutRecherche}
                                onChange={(e) =>
                                    setStatutRecherche(e.target.value)
                                }
                            >
                                <option value="">Tous les statuts</option>
                                <option value="en attente">En attente</option>
                                <option value="confirmée">Confirmée</option>
                                <option value="en préparation">En préparation</option>
                                <option value="récupérée">Récupérée</option>
                                <option value="annulée">Annulée</option>
                            </select>
                        </div>
                    </div>

                    {/* EFFACER */}

                    <div className="commandes-search-actions">
                        <button
                            type="button"
                            className="btn-effacer-filtres"
                            onClick={effacerFiltres}
                            disabled={
                                !rechercheClient &&
                                !dateRecherche &&
                                !statutRecherche
                            }
                        >
                            <FaTimes />
                            Effacer
                        </button>
                    </div>
                </div>

                <p className="commandes-search-result">
                    {commandesParType.length} résultat
                    {commandesParType.length > 1 ? "s" : ""}
                    {" "}sur {
                        typeClientActif === "particulier"
                            ? nombreParticuliers
                            : nombreProfessionnels
                    } commande
                    {
                        (
                            typeClientActif === "particulier"
                                ? nombreParticuliers
                                : nombreProfessionnels
                        ) > 1 ? "s" : ""
                    }
                </p>
            </section>

            {/* ONGLETS PARTICULIERS / PROFESSIONNELS */}

            <div className="commandes-type-tabs">

                <button
                    type="button"
                    className={`commandes-type-tab ${typeClientActif === "particulier" ? "active" : ""
                        }`}
                    onClick={() => setTypeClientActif("particulier")}
                >
                    <FaUser />
                    <span>Particuliers</span>
                    <strong>{nombreParticuliers}</strong>
                </button>

                <button
                    type="button"
                    className={`commandes-type-tab ${typeClientActif === "professionnel" ? "active" : ""
                        }`}
                    onClick={() => setTypeClientActif("professionnel")}
                >
                    <FaBriefcase />
                    <span>Professionnels</span>
                    <strong>{nombreProfessionnels}</strong>
                </button>

            </div>

            {/* AUCUNE COMMANDE */}

            {commandes.length === 0 ? (

                <div className="no-commandes">
                    <FaShoppingCart />
                    <h2>Aucune commande</h2>
                    <p>Aucune commande n'a encore été passée.</p>
                </div>

            ) : commandesParType.length === 0 ? (

                <div className="no-commandes">
                    {typeClientActif === "particulier"
                        ? <FaUser />
                        : <FaBriefcase />}

                    <h2>
                        {rechercheClient || dateRecherche || statutRecherche
                            ? "Aucun résultat"
                            : "Aucune commande"}
                    </h2>

                    <p>
                        {rechercheClient || dateRecherche || statutRecherche
                            ? `Aucune commande des clients ${typeClientActif === "particulier"
                                ? "particuliers"
                                : "professionnels"
                            } ne correspond à vos critères.`
                            : `Aucune commande n'a été passée par les clients ${typeClientActif === "particulier"
                                ? "particuliers"
                                : "professionnels"
                            }.`}
                    </p>

                    {(rechercheClient || dateRecherche || statutRecherche) && (
                        <button
                            type="button"
                            className="btn-effacer-filtres"
                            onClick={effacerFiltres}
                        >
                            <FaTimes />
                            Réinitialiser la recherche
                        </button>
                    )}
                </div>

            ) : (

                /* LISTE DES COMMANDES */

                <div className="commandes-list">

                    {commandesParType.map((commande) => {

                        const prochainStatut = getProchainStatut(
                            commande.statut
                        );

                        const commandeTerminee =
                            commande.statut === "récupérée" ||
                            commande.statut === "annulée";

                        return (
                            <div
                                className="commande-admin-card"
                                key={commande.id}
                            >

                                {/* EN-TÊTE DE COMMANDE */}

                                <div className="commande-card-header">

                                    <div className="commande-title">
                                        <FaShoppingCart />

                                        <div>
                                            <h2>Commande #{commande.id}</h2>

                                            <span>
                                                <FaCalendarAlt />
                                                {formatDate(commande.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="status-select-wrapper">

                                        <select
                                            value={commande.statut}
                                            onChange={(e) =>
                                                handleStatutChange(
                                                    commande.id,
                                                    e.target.value
                                                )
                                            }
                                            className={`status-select ${getStatutClass(
                                                commande.statut
                                            )}`}
                                            disabled={commandeTerminee}
                                        >
                                            <option value={commande.statut}>
                                                {commande.statut}
                                            </option>

                                            {prochainStatut && (
                                                <option value={prochainStatut}>
                                                    {prochainStatut}
                                                </option>
                                            )}

                                            {(commande.statut === "en attente" ||
                                                commande.statut === "confirmée") && (
                                                    <option value="annulée">
                                                        annulée
                                                    </option>
                                                )}
                                        </select>

                                        <FaChevronDown />
                                    </div>
                                </div>

                                {/* INFORMATIONS CLIENT */}

                                <div className="commande-client-section">

                                    <h3>
                                        <FaUser />
                                        Informations client
                                    </h3>

                                    <div className="client-info-grid">

                                        <div className="client-info">
                                            <FaUser />
                                            <div>
                                                <span>Client</span>
                                                <strong>
                                                    {commande.prenom || ""}{" "}
                                                    {commande.nom || ""}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="client-info">
                                            <FaEnvelope />
                                            <div>
                                                <span>Email</span>
                                                <strong>
                                                    {commande.user?.email || "-"}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="client-info">
                                            <FaPhone />
                                            <div>
                                                <span>Téléphone</span>
                                                <strong>
                                                    {commande.telephone ||
                                                        commande.user?.telephone ||
                                                        "-"}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="client-info">
                                            <FaMapMarkerAlt />
                                            <div>
                                                <span>Adresse</span>
                                                <strong>
                                                    {commande.adresse || "-"}
                                                    {commande.ville
                                                        ? `, ${commande.ville}`
                                                        : ""}
                                                    {commande.codePostal
                                                        ? ` ${commande.codePostal}`
                                                        : ""}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* INFORMATIONS PROFESSIONNELLES */}

                                        {typeClientActif === "professionnel" && (
                                            <>
                                                <div className="client-info">
                                                    <FaIdCard />
                                                    <div>
                                                        <span>Numéro TVA</span>
                                                        <strong>
                                                            {commande.user?.numeroTVA || "-"}
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div className="client-info">
                                                    <FaBriefcase />
                                                    <div>
                                                        <span>Secteur d'activité</span>
                                                        <strong>
                                                            {commande.user?.secteur || "-"}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                    </div>
                                </div>

                                {/* PRODUITS COMMANDÉS */}

                                <div className="commande-products-section">

                                    <h3>
                                        <FaBoxOpen />
                                        Produits commandés
                                    </h3>

                                    <div className="products-list">

                                        {commande.items?.map((item) => (

                                            <div
                                                className="commande-product"
                                                key={item.id}
                                            >

                                                <div className="product-image">
                                                    {item.pneu?.image ? (
                                                        <img
                                                            src={`${API_URL}/uploadPneu/${item.pneu.image}`}
                                                            alt={item.pneu.modele || "Pneu"}
                                                        />
                                                    ) : (
                                                        <FaBoxOpen />
                                                    )}
                                                </div>

                                                <div className="product-info">
                                                    <h4>
                                                        {item.pneu?.modele || "-"}
                                                    </h4>

                                                    <p>
                                                        <strong>Marque :</strong>{" "}
                                                        {item.pneu?.marque?.nom || "-"}
                                                    </p>

                                                    <p>
                                                        <strong>Dimension :</strong>{" "}
                                                        {item.pneu?.dimension || "-"}
                                                    </p>

                                                    <p>
                                                        <strong>Saison :</strong>{" "}
                                                        {item.pneu?.saison || "-"}
                                                    </p>
                                                </div>

                                                <div className="product-quantity">
                                                    <span>Quantité</span>
                                                    <strong>×{item.quantite}</strong>
                                                </div>

                                                <div className="product-price">

                                                    {Number(item.pourcentagePromotion) > 0 ? (
                                                        <>
                                                            <span className="old-price">
                                                                {Number(item.prixOriginal).toFixed(2)} DT
                                                            </span>

                                                            <strong className="promo-price">
                                                                {Number(item.prix).toFixed(2)} DT
                                                            </strong>

                                                            <span className="promo-badge">
                                                                -{item.pourcentagePromotion}%
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <strong>
                                                            {Number(item.prix).toFixed(2)} DT
                                                        </strong>
                                                    )}

                                                </div>

                                            </div>

                                        ))}

                                    </div>
                                </div>

                                {/* TOTAL ET ACTIONS */}

                                <div className="commande-card-footer">

                                    <div className="commande-total">
                                        <span>Total commande :</span>
                                        <strong>
                                            {Number(commande.total).toFixed(2)} DT
                                        </strong>
                                    </div>

                                    <div className="commande-footer-actions">

                                        {commande.facture && (
                                            <button
                                                type="button"
                                                className="facture-commande-btn"
                                                title={`Télécharger ${commande.facture.numeroFacture}`}
                                                onClick={() =>
                                                    handleDownloadFacture(commande.id)
                                                }
                                            >
                                                <FaFilePdf />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className="delete-commande-btn"
                                            onClick={() =>
                                                handleDelete(commande.id)
                                            }
                                        >
                                            <FaTrash />
                                            <span>Supprimer</span>
                                        </button>

                                    </div>
                                </div>

                            </div>
                        );
                    })}

                </div>
            )}

        </div>
    );
}

export default AdminCommandes;
