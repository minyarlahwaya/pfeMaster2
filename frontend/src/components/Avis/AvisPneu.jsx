
import { useEffect, useState } from "react";

import {
    getAvisByPneu,
    toggleLikeAvis,
    ajouterReponseAvis,
    modifierAvis,
    deleteAvis,
    modifierReponseAvis,
    supprimerReponseAvis
} from "../../services/avisApi";

import {
    FaEdit,
    FaTrash,
    FaSave,
    FaTimes
} from "react-icons/fa";

import "./AvisPneu.css";

// Récupérer l'utilisateur connecté depuis localStorage
const recupererUtilisateur = () => {
    const cles = [
        "utilisateur",
        "user",
        "utilisateurConnecte",
        "currentUser",
        "userInfo"
    ];

    for (const cle of cles) {
        try {
            const donnees = localStorage.getItem(cle);

            if (!donnees) continue;

            let utilisateur = JSON.parse(donnees);

            if (utilisateur?.data && typeof utilisateur.data === "object") {
                utilisateur = utilisateur.data;
            }

            if (utilisateur?.utilisateur) {
                utilisateur = utilisateur.utilisateur;
            } else if (utilisateur?.user) {
                utilisateur = utilisateur.user;
            }

            if (
                utilisateur &&
                typeof utilisateur === "object" &&
                (
                    utilisateur.id != null ||
                    utilisateur.userId != null ||
                    utilisateur.role === "admin"
                )
            ) {
                return utilisateur;
            }
        } catch (error) {
            console.warn(`Impossible de lire la clé ${cle} :`, error);
        }
    }

    return null;
};

function AvisPneu({ pneuId }) {
    const [avis, setAvis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erreur, setErreur] = useState("");

    const [reponsesSaisies, setReponsesSaisies] = useState({});
    const [actionEnCours, setActionEnCours] = useState(null);

    const [avisEnModification, setAvisEnModification] = useState(null);
    const [commentaireModifie, setCommentaireModifie] = useState("");

    const [reponseEnModification, setReponseEnModification] = useState(null);
    const [contenuReponseModifie, setContenuReponseModifie] = useState("");

    const [utilisateurConnecte, setUtilisateurConnecte] = useState(
        () => recupererUtilisateur()
    );

    // Actualiser l'utilisateur connecté
    useEffect(() => {
        const actualiserUtilisateur = () => {
            setUtilisateurConnecte(recupererUtilisateur());
        };

        window.addEventListener("storage", actualiserUtilisateur);
        window.addEventListener("authChanged", actualiserUtilisateur);

        return () => {
            window.removeEventListener("storage", actualiserUtilisateur);
            window.removeEventListener("authChanged", actualiserUtilisateur);
        };
    }, []);

    const utilisateurId =
        utilisateurConnecte?.id ??
        utilisateurConnecte?.userId ??
        utilisateurConnecte?.utilisateur?.id ??
        utilisateurConnecte?.user?.id;

    const estAdmin =
        utilisateurConnecte?.role === "admin" ||
        utilisateurConnecte?.utilisateur?.role === "admin" ||
        utilisateurConnecte?.user?.role === "admin";

    // Autorisations pour les avis
    const peutGererAvis = (item) => {
        if (estAdmin) return true;

        if (utilisateurId == null || item.userId == null) {
            return false;
        }

        return String(item.userId) === String(utilisateurId);
    };

    // Autorisations pour les réponses
    const peutGererReponse = (reponse) => {
        if (estAdmin) return true;

        const auteurId = reponse.userId ?? reponse.auteur?.id;

        if (utilisateurId == null || auteurId == null) {
            return false;
        }

        return String(auteurId) === String(utilisateurId);
    };

    // Charger les avis
    const chargerAvis = async () => {
        try {
            setErreur("");

            const resultat = await getAvisByPneu(pneuId);

            const listeAvis = Array.isArray(resultat)
                ? resultat
                : resultat?.avis || [];

            setAvis(listeAvis);
        } catch (error) {
            console.error("Erreur chargement des avis :", error);
            setErreur("Impossible de charger les avis.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (pneuId) {
            setLoading(true);
            chargerAvis();
        } else {
            setAvis([]);
            setLoading(false);
        }
    }, [pneuId]);

    // Formater une date
    const formaterDate = (date) => {
        if (!date) return "Date inconnue";

        const dateFormatee = new Date(date);

        if (Number.isNaN(dateFormatee.getTime())) {
            return "Date inconnue";
        }

        return dateFormatee.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };

    // Aimer ou retirer son like
    const gererLike = async (avisId) => {
        try {
            setActionEnCours(`like-${avisId}`);

            const resultat = await toggleLikeAvis(avisId);

            setAvis((anciensAvis) =>
                anciensAvis.map((item) =>
                    item.id === avisId
                        ? {
                              ...item,
                              likesCount: resultat.likesCount,
                              aimeParUtilisateur: resultat.liked
                          }
                        : item
                )
            );
        } catch (error) {
            console.error("Erreur like :", error);

            alert(
                error.response?.data?.message ||
                "Connectez-vous pour aimer un avis."
            );
        } finally {
            setActionEnCours(null);
        }
    };

    // Ajouter une réponse
    const gererAjoutReponse = async (avisId) => {
        const contenu = (reponsesSaisies[avisId] || "").trim();

        if (!contenu) {
            alert("Veuillez saisir une réponse.");
            return;
        }

        try {
            setActionEnCours(`reponse-${avisId}`);

            const resultat = await ajouterReponseAvis(avisId, contenu);

            if (!resultat?.reponse) {
                await chargerAvis();
            } else {
                setAvis((anciensAvis) =>
                    anciensAvis.map((item) =>
                        item.id === avisId
                            ? {
                                  ...item,
                                  reponses: [
                                      ...(item.reponses || []),
                                      resultat.reponse
                                  ]
                              }
                            : item
                    )
                );
            }

            setReponsesSaisies((anciennes) => ({
                ...anciennes,
                [avisId]: ""
            }));
        } catch (error) {
            console.error("Erreur ajout réponse :", error);

            alert(
                error.response?.data?.message ||
                "Impossible d'ajouter la réponse. Vérifiez votre connexion."
            );
        } finally {
            setActionEnCours(null);
        }
    };

    // Commencer la modification d'un avis
    const commencerModification = (item) => {
        if (!peutGererAvis(item)) {
            alert("Vous ne pouvez modifier que votre propre avis.");
            return;
        }

        setAvisEnModification(item.id);
        setCommentaireModifie(item.commentaire || "");
    };

    // Annuler la modification d'un avis
    const annulerModification = () => {
        setAvisEnModification(null);
        setCommentaireModifie("");
    };

    // Enregistrer la modification d'un avis
    const enregistrerModification = async (avisId) => {
        const item = avis.find((a) => a.id === avisId);
        const nouveauCommentaire = commentaireModifie.trim();

        if (!item || !peutGererAvis(item)) {
            alert("Vous n'êtes pas autorisé à modifier cet avis.");
            return;
        }

        if (!nouveauCommentaire) {
            alert("Le commentaire ne peut pas être vide.");
            return;
        }

        try {
            setActionEnCours(`modifier-${avisId}`);

            const resultat = await modifierAvis(avisId, {
                commentaire: nouveauCommentaire
            });

            setAvis((anciensAvis) =>
                anciensAvis.map((a) =>
                    a.id === avisId
                        ? {
                              ...a,
                              commentaire:
                                  resultat?.avis?.commentaire ??
                                  resultat?.commentaire ??
                                  nouveauCommentaire
                          }
                        : a
                )
            );

            annulerModification();
        } catch (error) {
            console.error("Erreur modification avis :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de modifier cet avis."
            );
        } finally {
            setActionEnCours(null);
        }
    };

    // Supprimer un avis
    const supprimerCommentaire = async (avisId) => {
        const item = avis.find((a) => a.id === avisId);

        if (!item || !peutGererAvis(item)) {
            alert("Vous n'êtes pas autorisé à supprimer cet avis.");
            return;
        }

        if (!window.confirm("Voulez-vous vraiment supprimer cet avis ?")) {
            return;
        }

        try {
            setActionEnCours(`supprimer-${avisId}`);

            await deleteAvis(avisId);

            setAvis((anciensAvis) =>
                anciensAvis.filter((a) => a.id !== avisId)
            );

            if (avisEnModification === avisId) {
                annulerModification();
            }
        } catch (error) {
            console.error("Erreur suppression avis :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de supprimer cet avis."
            );
        } finally {
            setActionEnCours(null);
        }
    };

    // Commencer la modification d'une réponse
    const commencerModificationReponse = (reponse) => {
        if (!peutGererReponse(reponse)) {
            alert("Vous ne pouvez modifier que vos propres réponses.");
            return;
        }

        setReponseEnModification(reponse.id);
        setContenuReponseModifie(reponse.contenu || "");
    };

    // Annuler la modification d'une réponse
    const annulerModificationReponse = () => {
        setReponseEnModification(null);
        setContenuReponseModifie("");
    };

    // Enregistrer la modification d'une réponse
    const enregistrerModificationReponse = async (avisId, reponse) => {
        const contenu = contenuReponseModifie.trim();

        if (!peutGererReponse(reponse)) {
            alert("Vous n'êtes pas autorisé à modifier cette réponse.");
            return;
        }

        if (!contenu) {
            alert("La réponse ne peut pas être vide.");
            return;
        }

        try {
            setActionEnCours(`modifier-reponse-${reponse.id}`);

            const resultat = await modifierReponseAvis(reponse.id, contenu);
            const reponseModifiee =
                resultat?.reponse ?? resultat?.data?.reponse;

            setAvis((anciensAvis) =>
                anciensAvis.map((item) =>
                    item.id === avisId
                        ? {
                              ...item,
                              reponses: (item.reponses || []).map((r) =>
                                  r.id === reponse.id
                                      ? {
                                            ...r,
                                            ...(reponseModifiee || {}),
                                            contenu:
                                                reponseModifiee?.contenu ??
                                                contenu
                                        }
                                      : r
                              )
                          }
                        : item
                )
            );

            annulerModificationReponse();
        } catch (error) {
            console.error("Erreur modification réponse :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de modifier cette réponse."
            );
        } finally {
            setActionEnCours(null);
        }
    };

    // Supprimer une réponse
    const supprimerReponse = async (avisId, reponse) => {
        if (!peutGererReponse(reponse)) {
            alert("Vous n'êtes pas autorisé à supprimer cette réponse.");
            return;
        }

        if (!window.confirm("Voulez-vous vraiment supprimer cette réponse ?")) {
            return;
        }

        try {
            setActionEnCours(`supprimer-reponse-${reponse.id}`);

            await supprimerReponseAvis(reponse.id);

            setAvis((anciensAvis) =>
                anciensAvis.map((item) =>
                    item.id === avisId
                        ? {
                              ...item,
                              reponses: (item.reponses || []).filter(
                                  (r) => r.id !== reponse.id
                              )
                          }
                        : item
                )
            );

            if (reponseEnModification === reponse.id) {
                annulerModificationReponse();
            }
        } catch (error) {
            console.error("Erreur suppression réponse :", error);

            alert(
                error.response?.data?.message ||
                "Impossible de supprimer cette réponse."
            );
        } finally {
            setActionEnCours(null);
        }
    };

    const moyenne = avis.length
        ? avis.reduce(
              (total, item) => total + Number(item.note || 0),
              0
          ) / avis.length
        : 0;

    return (
        <section className="avis-pneu-section">
            <h2>Avis des clients</h2>

            {loading ? (
                <p>Chargement des avis...</p>
            ) : erreur ? (
                <p>{erreur}</p>
            ) : avis.length === 0 ? (
                <p>Aucun avis pour ce pneu pour le moment.</p>
            ) : (
                <>
                    <div className="avis-resume">
                        <strong>{moyenne.toFixed(1)} / 5</strong>

                        <span className="avis-etoiles">
                            {"★".repeat(Math.round(moyenne))}
                            {"☆".repeat(5 - Math.round(moyenne))}
                        </span>

                        <span>{avis.length} avis</span>
                    </div>

                    <div className="avis-liste">
                        {avis.map((item) => (
                            <article className="avis-carte" key={item.id}>
                                <div className="achat-verifie">
                                    <span className="verification-icon">✓</span>
                                    Achat vérifié
                                </div>

                                <div className="avis-note">
                                    {"★".repeat(
                                        Math.min(
                                            5,
                                            Math.max(0, Number(item.note) || 0)
                                        )
                                    )}
                                    {"☆".repeat(
                                        5 -
                                        Math.min(
                                            5,
                                            Math.max(0, Number(item.note) || 0)
                                        )
                                    )}
                                </div>

                                <div className="avis-date">
                                    Date du commentaire :{" "}
                                    <strong>{formaterDate(item.createdAt)}</strong>
                                </div>

                                {avisEnModification === item.id ? (
                                    <div className="avis-edition">
                                        <textarea
                                            value={commentaireModifie}
                                            onChange={(e) =>
                                                setCommentaireModifie(e.target.value)
                                            }
                                            maxLength={2000}
                                            rows={3}
                                            placeholder="Modifier votre commentaire..."
                                        />

                                        <div className="avis-edition-actions">
                                            <button
                                                type="button"
                                                className="avis-btn-enregistrer"
                                                onClick={() =>
                                                    enregistrerModification(item.id)
                                                }
                                                disabled={
                                                    actionEnCours ===
                                                        `modifier-${item.id}` ||
                                                    !commentaireModifie.trim()
                                                }
                                            >
                                                <FaSave />{" "}
                                                {actionEnCours ===
                                                `modifier-${item.id}`
                                                    ? "Enregistrement..."
                                                    : "Enregistrer"}
                                            </button>

                                            <button
                                                type="button"
                                                className="avis-btn-annuler"
                                                onClick={annulerModification}
                                            >
                                                <FaTimes /> Annuler
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    item.commentaire && (
                                        <p className="avis-commentaire">
                                            {item.commentaire}
                                        </p>
                                    )
                                )}

                                <div className="avis-auteur">
                                    {item.user?.prenom || ""}{" "}
                                    {item.user?.nom || "Client"}
                                </div>

                                {peutGererAvis(item) && (
                                    <div className="avis-gestion-actions">
                                        <button
                                            type="button"
                                            className="avis-btn-modifier"
                                            title="Modifier mon avis"
                                            aria-label="Modifier mon avis"
                                            onClick={() =>
                                                commencerModification(item)
                                            }
                                            disabled={
                                                actionEnCours ===
                                                    `modifier-${item.id}` ||
                                                actionEnCours ===
                                                    `supprimer-${item.id}`
                                            }
                                        >
                                            <FaEdit />
                                        </button>

                                        <button
                                            type="button"
                                            className="avis-btn-supprimer"
                                            title="Supprimer mon avis"
                                            aria-label="Supprimer mon avis"
                                            onClick={() =>
                                                supprimerCommentaire(item.id)
                                            }
                                            disabled={
                                                actionEnCours ===
                                                    `modifier-${item.id}` ||
                                                actionEnCours ===
                                                    `supprimer-${item.id}`
                                            }
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                )}

                                {/* Likes */}
                                <div className="avis-actions">
                                    <button
                                        type="button"
                                        onClick={() => gererLike(item.id)}
                                        disabled={
                                            actionEnCours === `like-${item.id}`
                                        }
                                        className={
                                            item.aimeParUtilisateur
                                                ? "avis-like actif"
                                                : "avis-like"
                                        }
                                    >
                                        {item.aimeParUtilisateur ? "❤️" : "🤍"}{" "}
                                        J'aime ({item.likesCount ?? 0})
                                    </button>
                                </div>

                                {/* Réponses avec modification et suppression */}
                                <div className="avis-reponses">
                                    <h4>Réponses</h4>

                                    {(item.reponses || []).length === 0 ? (
                                        <p className="aucune-reponse">
                                            Aucune réponse pour le moment.
                                        </p>
                                    ) : (
                                        item.reponses.map((reponse) => (
                                            <div
                                                className="avis-reponse"
                                                key={reponse.id}
                                            >
                                                <strong>
                                                    {reponse.auteur?.prenom || ""}{" "}
                                                    {reponse.auteur?.nom ||
                                                        "Utilisateur"}
                                                </strong>

                                                {reponse.auteur?.role === "admin" && (
                                                    <span className="badge-admin">
                                                        Administrateur
                                                    </span>
                                                )}

                                                {reponseEnModification ===
                                                reponse.id ? (
                                                    <div className="avis-edition">
                                                        <textarea
                                                            value={
                                                                contenuReponseModifie
                                                            }
                                                            onChange={(e) =>
                                                                setContenuReponseModifie(
                                                                    e.target.value
                                                                )
                                                            }
                                                            maxLength={2000}
                                                            rows={3}
                                                            placeholder="Modifier la réponse..."
                                                        />

                                                        <div className="avis-edition-actions">
                                                            <button
                                                                type="button"
                                                                className="avis-btn-enregistrer"
                                                                onClick={() =>
                                                                    enregistrerModificationReponse(
                                                                        item.id,
                                                                        reponse
                                                                    )
                                                                }
                                                                disabled={
                                                                    actionEnCours ===
                                                                        `modifier-reponse-${reponse.id}` ||
                                                                    !contenuReponseModifie.trim()
                                                                }
                                                            >
                                                                <FaSave />{" "}
                                                                {actionEnCours ===
                                                                `modifier-reponse-${reponse.id}`
                                                                    ? "Enregistrement..."
                                                                    : "Enregistrer"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="avis-btn-annuler"
                                                                onClick={
                                                                    annulerModificationReponse
                                                                }
                                                            >
                                                                <FaTimes /> Annuler
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p>{reponse.contenu}</p>
                                                )}

                                                <small>
                                                    {formaterDate(
                                                        reponse.updatedAt ||
                                                        reponse.createdAt
                                                    )}
                                                </small>

                                                {peutGererReponse(reponse) &&
                                                    reponseEnModification !==
                                                        reponse.id && (
                                                        <div className="avis-gestion-actions">
                                                            <button
                                                                type="button"
                                                                className="avis-btn-modifier"
                                                                title="Modifier cette réponse"
                                                                aria-label="Modifier cette réponse"
                                                                onClick={() =>
                                                                    commencerModificationReponse(
                                                                        reponse
                                                                    )
                                                                }
                                                                disabled={
                                                                    actionEnCours ===
                                                                        `modifier-reponse-${reponse.id}` ||
                                                                    actionEnCours ===
                                                                        `supprimer-reponse-${reponse.id}`
                                                                }
                                                            >
                                                                <FaEdit />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="avis-btn-supprimer"
                                                                title="Supprimer cette réponse"
                                                                aria-label="Supprimer cette réponse"
                                                                onClick={() =>
                                                                    supprimerReponse(
                                                                        item.id,
                                                                        reponse
                                                                    )
                                                                }
                                                                disabled={
                                                                    actionEnCours ===
                                                                        `modifier-reponse-${reponse.id}` ||
                                                                    actionEnCours ===
                                                                        `supprimer-reponse-${reponse.id}`
                                                                }
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </div>
                                                    )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Formulaire de réponse */}
                                <div className="avis-form-reponse">
                                    <textarea
                                        value={reponsesSaisies[item.id] || ""}
                                        onChange={(e) =>
                                            setReponsesSaisies((anciennes) => ({
                                                ...anciennes,
                                                [item.id]: e.target.value
                                            }))
                                        }
                                        placeholder="Écrire une réponse..."
                                        maxLength={2000}
                                        rows={2}
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            gererAjoutReponse(item.id)
                                        }
                                        disabled={
                                            actionEnCours ===
                                            `reponse-${item.id}`
                                        }
                                    >
                                        {actionEnCours === `reponse-${item.id}`
                                            ? "Envoi..."
                                            : "Répondre"}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

export default AvisPneu;
