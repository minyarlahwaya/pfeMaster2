
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaStar,
    FaTrash,
    FaReply,
    FaArrowLeft,
    FaHome,
    FaSearch,
    FaCommentDots
} from "react-icons/fa";

import {
    getAllAvis,
    ajouterReponseAvis,
    supprimerReponseAvis,
    deleteAvis
} from "../../services/avisApi";

import "./GestionAvis.css";
import { API_URL } from "../../config";

const IMAGE_URL = `${API_URL}/uploadPneu/`;

function GestionAvis() {

    const navigate = useNavigate();

    const [avis, setAvis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [pneuSelectionne, setPneuSelectionne] = useState(null);
    const [reponses, setReponses] = useState({});
    const [recherche, setRecherche] = useState("");

    const [actionEnCours, setActionEnCours] = useState(false);

    // ========================================
    // CHARGER TOUS LES AVIS
    // ========================================

    const chargerAvis = async () => {

        try {

            setError("");

            const response = await getAllAvis();

            if (response.success) {
                setAvis(response.avis || []);
            } else {
                setError(
                    response.message || "Impossible de récupérer les avis."
                );
            }

        } catch (err) {

            console.error("Erreur récupération avis :", err);

            setError(
                err.response?.data?.message ||
                "Impossible de récupérer les avis."
            );

        } finally {

            setLoading(false);

        }
    };

    useEffect(() => {
        chargerAvis();
    }, []);

    // ========================================
    // REGROUPER LES AVIS PAR PNEU
    // ========================================

    const pneusAvecAvis = useMemo(() => {

        const groupes = {};

        avis.forEach((item) => {

            const pneuId = item.pneuId;

            if (!groupes[pneuId]) {

                groupes[pneuId] = {
                    id: pneuId,
                    pneu: item.pneu || {},
                    avis: []
                };

            }

            groupes[pneuId].avis.push(item);

        });

        return Object.values(groupes);

    }, [avis]);

    // ========================================
    // RECHERCHE D'UN PNEU
    // ========================================

    const pneusFiltres = pneusAvecAvis.filter((groupe) => {

        const modele = groupe.pneu?.modele || "";
        const dimension = groupe.pneu?.dimension || "";
        const marque =
            groupe.pneu?.marque?.nom ||
            groupe.pneu?.Marque?.nom ||
            "";

        const texte = `${modele} ${dimension} ${marque}`.toLowerCase();

        return texte.includes(recherche.toLowerCase());

    });

    // ========================================
    // AVIS DU PNEU SÉLECTIONNÉ
    // ========================================

    const groupeSelectionne = pneusAvecAvis.find(
        (groupe) => Number(groupe.id) === Number(pneuSelectionne)
    );

    // ========================================
    // SAISIR UNE RÉPONSE
    // ========================================

    const handleChangeReponse = (avisId, contenu) => {

        setReponses((anciennes) => ({
            ...anciennes,
            [avisId]: contenu
        }));

    };

    // ========================================
    // AJOUTER UNE RÉPONSE
    // ========================================

    const handleAjouterReponse = async (avisId) => {

        const contenu = reponses[avisId]?.trim();

        if (!contenu) {
            alert("Veuillez saisir une réponse.");
            return;
        }

        try {

            setActionEnCours(true);

            await ajouterReponseAvis(avisId, contenu);

            setReponses((anciennes) => ({
                ...anciennes,
                [avisId]: ""
            }));

            await chargerAvis();

            alert("Réponse ajoutée avec succès.");

        } catch (err) {

            console.error("Erreur ajout réponse :", err);

            alert(
                err.response?.data?.message ||
                "Impossible d'ajouter la réponse."
            );

        } finally {

            setActionEnCours(false);

        }
    };

    // ========================================
    // SUPPRIMER UN AVIS
    // ========================================

    const handleSupprimerAvis = async (avisId) => {

        const confirmation = window.confirm(
            "Voulez-vous vraiment supprimer cet avis ?"
        );

        if (!confirmation) return;

        try {

            setActionEnCours(true);

            await deleteAvis(avisId);

            setAvis((anciens) =>
                anciens.filter((item) => item.id !== avisId)
            );

            alert("Avis supprimé avec succès.");

        } catch (err) {

            console.error("Erreur suppression avis :", err);

            alert(
                err.response?.data?.message ||
                "Impossible de supprimer cet avis."
            );

        } finally {

            setActionEnCours(false);

        }
    };

    // ========================================
    // SUPPRIMER UNE RÉPONSE
    // ========================================

    const handleSupprimerReponse = async (reponseId) => {

        const confirmation = window.confirm(
            "Voulez-vous vraiment supprimer cette réponse ?"
        );

        if (!confirmation) return;

        try {

            setActionEnCours(true);

            await supprimerReponseAvis(reponseId);

            await chargerAvis();

            alert("Réponse supprimée avec succès.");

        } catch (err) {

            console.error("Erreur suppression réponse :", err);

            alert(
                err.response?.data?.message ||
                "Impossible de supprimer cette réponse."
            );

        } finally {

            setActionEnCours(false);

        }
    };

    // ========================================
    // AFFICHER LES ÉTOILES
    // ========================================

    const afficherEtoiles = (note) => {

        return (
            <div className="gestion-avis-etoiles">

                {[1, 2, 3, 4, 5].map((etoile) => (

                    <FaStar
                        key={etoile}
                        className={
                            etoile <= Number(note)
                                ? "etoile-active"
                                : "etoile-inactive"
                        }
                    />

                ))}

                <span>{note}/5</span>

            </div>
        );
    };

    // ========================================
    // CHARGEMENT
    // ========================================

    if (loading) {

        return (
            <div className="gestion-avis-page">
                <div className="gestion-avis-loading">
                    Chargement des avis...
                </div>
            </div>
        );
    }

    // ========================================
    // AFFICHAGE
    // ========================================

    return (

        <div className="gestion-avis-page">

            {/* HEADER */}

            <div className="gestion-avis-header">

                <div>
                    <h1>Gestion des avis clients</h1>

                    <p>
                        Consultez et gérez les avis des clients
                        sur les pneus LANDOLSI TIRES.
                    </p>
                </div>

                <button
                    className="gestion-avis-dashboard"
                    onClick={() => navigate("/admin")}
                >
                    <FaHome />
                    Dashboard
                </button>

            </div>

            {/* ERREUR */}

            {error && (
                <div className="gestion-avis-error">
                    {error}
                    <button onClick={chargerAvis}>
                        Réessayer
                    </button>
                </div>
            )}

            {/* STATISTIQUES */}

            <div className="gestion-avis-stats">

                <div className="gestion-avis-stat">
                    <FaCommentDots />
                    <div>
                        <span>Total des avis</span>
                        <strong>{avis.length}</strong>
                    </div>
                </div>

                <div className="gestion-avis-stat">
                    <FaStar />
                    <div>
                        <span>Pneus concernés</span>
                        <strong>{pneusAvecAvis.length}</strong>
                    </div>
                </div>

            </div>

            {/* LISTE DES PNEUS */}

            {!pneuSelectionne ? (

                <>

                    <div className="gestion-avis-section-title">
                        <h2>Pneus ayant reçu des avis</h2>
                        <p>
                            Sélectionnez un pneu pour consulter
                            les commentaires de ses clients.
                        </p>
                    </div>

                    <div className="gestion-avis-search">

                        <FaSearch />

                        <input
                            type="text"
                            placeholder="Rechercher un pneu..."
                            value={recherche}
                            onChange={(e) => setRecherche(e.target.value)}
                        />

                    </div>

                    {pneusFiltres.length === 0 ? (

                        <div className="gestion-avis-empty">
                            Aucun pneu avec avis trouvé.
                        </div>

                    ) : (

                        <div className="gestion-avis-pneus-grid">

                            {pneusFiltres.map((groupe) => (

                                <div
                                    className="gestion-avis-pneu-card"
                                    key={groupe.id}
                                    onClick={() =>
                                        setPneuSelectionne(groupe.id)
                                    }
                                >

                                    <div className="gestion-avis-pneu-image">

                                        {groupe.pneu.image ? (

                                            <img
                                                src={`${IMAGE_URL}${groupe.pneu.image}`}
                                                alt={groupe.pneu.modele}
                                            />

                                        ) : (

                                            <span>Aucune image</span>

                                        )}

                                    </div>

                                    <div className="gestion-avis-pneu-content">

                                        <h3>
                                            {groupe.pneu.modele ||
                                                `Pneu ${groupe.id}`}
                                        </h3>

                                        <p>
                                            {groupe.pneu.dimension || "-"}
                                        </p>

                                        <div className="gestion-avis-pneu-footer">

                                            <span>
                                                <FaCommentDots />
                                                {groupe.avis.length} avis
                                            </span>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPneuSelectionne(groupe.id);
                                                }}
                                            >
                                                Consulter
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>

                    )}

                </>

            ) : (

                /* AVIS DU PNEU SÉLECTIONNÉ */

                <>

                    <button
                        className="gestion-avis-retour"
                        onClick={() => setPneuSelectionne(null)}
                    >
                        <FaArrowLeft />
                        Retour aux pneus
                    </button>

                    {groupeSelectionne && (

                        <>

                            <div className="gestion-avis-pneu-selected">

                                {groupeSelectionne.pneu.image && (

                                    <img
                                        src={`${IMAGE_URL}${groupeSelectionne.pneu.image}`}
                                        alt={groupeSelectionne.pneu.modele}
                                    />

                                )}

                                <div>
                                    <h2>
                                        {groupeSelectionne.pneu.modele}
                                    </h2>

                                    <p>
                                        Dimension :{" "}
                                        {groupeSelectionne.pneu.dimension || "-"}
                                    </p>

                                    <strong>
                                        {groupeSelectionne.avis.length} avis clients
                                    </strong>
                                </div>

                            </div>

                            <h2 className="gestion-avis-list-title">
                                Commentaires des clients
                            </h2>

                            {groupeSelectionne.avis.map((item) => (

                                <div
                                    className="gestion-avis-card"
                                    key={item.id}
                                >

                                    {/* CLIENT */}

                                    <div className="gestion-avis-card-header">

                                        <div className="gestion-avis-client">

                                            <div className="gestion-avis-avatar">
                                                {item.user?.prenom?.charAt(0) || "C"}
                                            </div>

                                            <div>
                                                <strong>
                                                    {item.user
                                                        ? `${item.user.prenom} ${item.user.nom}`
                                                        : "Client"}
                                                </strong>

                                                <small>
                                                    {item.createdAt
                                                        ? new Date(item.createdAt).toLocaleDateString("fr-FR")
                                                        : ""}
                                                </small>
                                            </div>

                                        </div>

                                        <button
                                            className="gestion-avis-delete"
                                            title="Supprimer cet avis"
                                            disabled={actionEnCours}
                                            onClick={() =>
                                                handleSupprimerAvis(item.id)
                                            }
                                        >
                                            <FaTrash />
                                        </button>

                                    </div>

                                    {/* NOTE */}

                                    {afficherEtoiles(item.note)}

                                    {/* COMMENTAIRE */}

                                    <p className="gestion-avis-commentaire">
                                        {item.commentaire ||
                                            "Le client n'a pas laissé de commentaire écrit."}
                                    </p>

                                    {/* RÉPONSES */}

                                    {item.reponses?.length > 0 && (

                                        <div className="gestion-avis-reponses">

                                            <h4>Réponses</h4>

                                            {item.reponses.map((reponse) => (

                                                <div
                                                    className="gestion-avis-reponse"
                                                    key={reponse.id}
                                                >

                                                    <div>

                                                        <strong>
                                                            {reponse.auteur
                                                                ? `${reponse.auteur.prenom} ${reponse.auteur.nom}`
                                                                : "Utilisateur"}
                                                        </strong>

                                                        {reponse.auteur?.role === "admin" && (
                                                            <span className="gestion-avis-admin-label">
                                                                Administrateur
                                                            </span>
                                                        )}

                                                        <p>{reponse.contenu}</p>

                                                    </div>

                                                    <button
                                                        title="Supprimer cette réponse"
                                                        disabled={actionEnCours}
                                                        onClick={() =>
                                                            handleSupprimerReponse(reponse.id)
                                                        }
                                                    >
                                                        <FaTrash />
                                                    </button>

                                                </div>

                                            ))}

                                        </div>

                                    )}

                                    {/* AJOUTER UNE RÉPONSE */}

                                    <div className="gestion-avis-reply-form">

                                        <label>
                                            <FaReply />
                                            Répondre à cet avis
                                        </label>

                                        <textarea
                                            rows="3"
                                            maxLength="2000"
                                            placeholder="Écrire une réponse au client..."
                                            value={reponses[item.id] || ""}
                                            onChange={(e) =>
                                                handleChangeReponse(
                                                    item.id,
                                                    e.target.value
                                                )
                                            }
                                        />

                                        <button
                                            disabled={
                                                actionEnCours ||
                                                !reponses[item.id]?.trim()
                                            }
                                            onClick={() =>
                                                handleAjouterReponse(item.id)
                                            }
                                        >
                                            Envoyer la réponse
                                        </button>

                                    </div>

                                </div>

                            ))}

                        </>

                    )}

                </>

            )}

        </div>

    );

}

export default GestionAvis;
