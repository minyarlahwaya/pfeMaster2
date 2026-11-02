
import { useEffect, useState } from "react";

import {
    getAllVehiculesCompatibilites,
    ajouterCompatibilite,
    supprimerCompatibilite
} from "../../services/compatibiliteApi";

import {
    getAllPneus,
    searchVehiculeByImmatriculation
} from "../../services/pneuApi";

import "./GestionCompatibilites.css";


function GestionCompatibilites() {

    // =====================================
    // ETATS
    // =====================================

    const [vehicules, setVehicules] = useState([]);
    const [pneus, setPneus] = useState([]);

    const [vehiculeId, setVehiculeId] = useState("");
    const [pneuId, setPneuId] = useState("");

    const [immatriculation, setImmatriculation] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rechercheLoading, setRechercheLoading] = useState(false);
    const [suppressionLoading, setSuppressionLoading] = useState(null);

    const [message, setMessage] = useState("");
    const [erreur, setErreur] = useState("");


    // =====================================
    // NORMALISER UNE IMMATRICULATION
    // =====================================

    const normaliserImmatriculation = (valeur) => {

        return String(valeur || "")
            .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
            .toUpperCase();

    };


    // =====================================
    // RECUPERER LE NOM DE LA MARQUE
    // =====================================

    const getNomMarque = (pneu) => {

        return (
            pneu.marque?.nom ||
            pneu.Marque?.nom ||
            pneu.marque?.libelle ||
            pneu.Marque?.libelle ||
            "Marque inconnue"
        );

    };


    // =====================================
    // CHARGER LES VEHICULES ET LES PNEUS
    // =====================================

    const chargerDonnees = async () => {

        try {

            setErreur("");

            const [vehiculesRes, pneusRes] = await Promise.all([
                getAllVehiculesCompatibilites(),
                getAllPneus()
            ]);

            const listeVehicules =
                vehiculesRes.data.vehicules || [];

            const listePneus = Array.isArray(pneusRes.data)
                ? pneusRes.data
                : pneusRes.data.pneus || [];

            setVehicules(listeVehicules);
            setPneus(listePneus);

            return listeVehicules;

        } catch (error) {

            console.error("Erreur chargement :", error);

            setErreur(
                error.response?.data?.message ||
                "Impossible de charger les données."
            );

            return [];

        }

    };


    // =====================================
    // CHARGEMENT INITIAL
    // =====================================

    useEffect(() => {

        const initialiser = async () => {

            setLoading(true);

            const liste = await chargerDonnees();

            if (liste.length > 0) {
                setVehiculeId(String(liste[0].id));
            }

            setLoading(false);

        };

        initialiser();

    }, []);


    // =====================================
    // RECHERCHER UN VEHICULE AVEC REGCHECK
    // =====================================

    const handleRechercheVehicule = async (e) => {

        e.preventDefault();

        const numero = normaliserImmatriculation(immatriculation);
        console.log("Valeur originale :", JSON.stringify(immatriculation));
console.log("Valeur normalisée :", JSON.stringify(numero));
console.log("Longueur :", numero.length);
console.log("Codes caractères :", [...numero].map(c => c.charCodeAt(0)));

        if (!numero) {

            setErreur("Veuillez saisir une immatriculation.");
            setMessage("");

            return;

        }

        try {

            setRechercheLoading(true);
            setErreur("");
            setMessage("");

            console.log(
                "Immatriculation envoyée à RegCheck :",
                JSON.stringify(numero)
            );

            // 1. Recherche auprès de RegCheck

            const response =
                await searchVehiculeByImmatriculation(numero);

            if (!response.data.success || !response.data.vehicule) {

                setErreur("Aucun véhicule identifié.");
                return;

            }

            const vehiculeTrouve = response.data.vehicule;

            // 2. Recharger les données depuis PostgreSQL

            const listeVehicules = await chargerDonnees();

            // 3. Rechercher le véhicule dans la liste

            const vehiculeDansListe = listeVehicules.find(
                (v) => String(v.id) === String(vehiculeTrouve.id)
            );

            // 4. Ajouter ou actualiser le véhicule dans la liste

            if (!vehiculeDansListe) {

                setVehicules((ancienneListe) => [
                    {
                        ...vehiculeTrouve,
                        pneus: response.data.pneus || []
                    },
                    ...ancienneListe
                ]);

            } else {

                setVehicules((ancienneListe) =>
                    ancienneListe.map((v) =>
                        String(v.id) === String(vehiculeTrouve.id)
                            ? {
                                ...v,
                                ...vehiculeTrouve,
                                pneus: v.pneus || response.data.pneus || []
                            }
                            : v
                    )
                );

            }

            // 5. Sélection automatique du véhicule

            setVehiculeId(String(vehiculeTrouve.id));

            setPneuId("");

            setMessage(
                response.data.created
                    ? "Véhicule identifié et enregistré avec succès par RegCheck."
                    : "Véhicule retrouvé avec succès."
            );

            setImmatriculation("");

        } catch (error) {

            console.error("Erreur recherche véhicule :", error);

            const messageErreur = error.response?.data?.message;

            setErreur(
                messageErreur ||
                "Impossible d'identifier ce véhicule. Vérifiez l'immatriculation ou réessayez ultérieurement."
            );

        } finally {

            setRechercheLoading(false);

        }

    };


    // =====================================
    // VEHICULE SELECTIONNE
    // =====================================

    const vehiculeSelectionne = vehicules.find(
        (v) => String(v.id) === String(vehiculeId)
    );

    const pneusCompatibles = vehiculeSelectionne?.pneus || [];

    const pneusDisponibles = pneus.filter(
        (pneu) =>
            !pneusCompatibles.some(
                (p) => String(p.id) === String(pneu.id)
            )
    );


    // =====================================
    // CHANGER DE VEHICULE
    // =====================================

    const handleChangerVehicule = (e) => {

        setVehiculeId(e.target.value);

        setPneuId("");
        setMessage("");
        setErreur("");

    };


    // =====================================
    // AJOUTER UNE COMPATIBILITE
    // =====================================

    const handleAjouter = async (e) => {

        e.preventDefault();

        if (!vehiculeId || !pneuId) {

            setErreur("Veuillez sélectionner un véhicule et un pneu.");
            setMessage("");

            return;

        }

        try {

            setSaving(true);
            setErreur("");
            setMessage("");

            await ajouterCompatibilite(
                Number(vehiculeId),
                Number(pneuId)
            );

            setMessage("Compatibilité ajoutée avec succès !");

            setPneuId("");

            await chargerDonnees();

        } catch (error) {

            console.error("Erreur ajout :", error);

            setErreur(
                error.response?.data?.message ||
                "Impossible d'ajouter cette compatibilité."
            );

        } finally {

            setSaving(false);

        }

    };


    // =====================================
    // SUPPRIMER UNE COMPATIBILITE
    // =====================================

    const handleSupprimer = async (idPneu) => {

        const confirmation = window.confirm(
            "Voulez-vous vraiment supprimer cette compatibilité ?"
        );

        if (!confirmation) return;

        try {

            setSuppressionLoading(idPneu);
            setErreur("");
            setMessage("");

            await supprimerCompatibilite(
                Number(vehiculeId),
                Number(idPneu)
            );

            setMessage("Compatibilité supprimée avec succès !");

            await chargerDonnees();

        } catch (error) {

            console.error("Erreur suppression :", error);

            setErreur(
                error.response?.data?.message ||
                "Impossible de supprimer cette compatibilité."
            );

        } finally {

            setSuppressionLoading(null);

        }

    };


    // =====================================
    // CHARGEMENT INITIAL
    // =====================================

    if (loading) {

        return (

            <div className="gc-page">

                <div className="gc-loading">

                    <div className="gc-spinner"></div>

                    <p>Chargement des compatibilités...</p>

                </div>

            </div>

        );

    }


    // =====================================
    // AFFICHAGE PRINCIPAL
    // =====================================

    return (

        <div className="gc-page">

            {/* EN-TETE */}

            <div className="gc-heading">

                <div>

                    <h2>Gestion des compatibilités</h2>

                    <p>
                        Gérez les associations entre les véhicules
                        identifiés par RegCheck et les pneus du catalogue.
                    </p>

                </div>

                <div className="gc-count">

                    <span>{vehicules.length}</span>

                    <small>Véhicules identifiés</small>

                </div>

            </div>


            {/* MESSAGES */}

            {message && (

                <div className="gc-alert gc-alert-success">

                    <span>{message}</span>

                    <button
                        type="button"
                        onClick={() => setMessage("")}
                    >
                        ×
                    </button>

                </div>

            )}

            {erreur && (

                <div className="gc-alert gc-alert-error">

                    <span>{erreur}</span>

                    <button
                        type="button"
                        onClick={() => setErreur("")}
                    >
                        ×
                    </button>

                </div>

            )}


            {/* RECHERCHE PAR IMMATRICULATION */}

            <section className="gc-card gc-search-card">

                <div className="gc-card-header">

                    <div>

                        <h3>Rechercher un véhicule</h3>

                        <p>
                            Identifiez automatiquement un véhicule
                            à partir de son numéro d'immatriculation.
                        </p>

                    </div>

                    <span className="gc-api-badge">
                        API REGCHECK
                    </span>

                </div>


                <form
                    className="gc-search-form"
                    onSubmit={handleRechercheVehicule}
                >

                    <div className="gc-field">

                        <label htmlFor="immatriculation">
                            Numéro d'immatriculation
                        </label>

                        <input
                            id="immatriculation"
                            type="text"
                            placeholder="Exemple : 818TU223"
                            value={immatriculation}
                            onChange={(e) =>
                                setImmatriculation(
                                    normaliserImmatriculation(e.target.value)
                                )
                            }
                        />

                    </div>


                    <button
                        type="submit"
                        className="gc-btn gc-btn-primary"
                        disabled={rechercheLoading}
                    >

                        {rechercheLoading
                            ? "Recherche en cours..."
                            : "Rechercher"
                        }

                    </button>

                </form>

            </section>


            {/* AUCUN VEHICULE */}

            {vehicules.length === 0 ? (

                <div className="gc-empty">

                    <h3>Aucun véhicule enregistré</h3>

                    <p>
                        Effectuez une recherche par immatriculation
                        pour identifier et enregistrer un véhicule
                        avec RegCheck.
                    </p>

                </div>

            ) : (

                <>

                    {/* SELECTION DU VEHICULE */}

                    <section className="gc-card">

                        <div className="gc-card-header">

                            <div>

                                <h3>Sélection du véhicule</h3>

                                <p>
                                    Choisissez un véhicule déjà enregistré
                                    ou recherchez une nouvelle immatriculation.
                                </p>

                            </div>

                        </div>


                        <div className="gc-card-body">

                            <div className="gc-field">

                                <label htmlFor="vehiculeSelect">
                                    Véhicule enregistré
                                </label>

                                <select
                                    id="vehiculeSelect"
                                    value={vehiculeId}
                                    onChange={handleChangerVehicule}
                                >

                                    <option value="">
                                        -- Sélectionner un véhicule --
                                    </option>

                                    {vehicules.map((v) => (

                                        <option
                                            key={v.id}
                                            value={v.id}
                                        >
                                            {v.immatriculation} - {v.marque} {v.modele}
                                        </option>

                                    ))}

                                </select>

                            </div>

                        </div>

                    </section>


                    {/* INFORMATIONS DU VEHICULE */}

                    {vehiculeSelectionne && (

                        <section className="gc-card">

                            <div className="gc-card-header">

                                <div>

                                    <h3>Informations du véhicule</h3>

                                    <p>
                                        Informations récupérées depuis RegCheck.
                                    </p>

                                </div>

                                <span className="gc-api-badge">
                                    REGCHECK
                                </span>

                            </div>


                            <div className="gc-card-body">

                                <div className="gc-vehicle-details">

                                    <div className="gc-vehicle-image">

                                        {vehiculeSelectionne.image ? (

                                            <img
                                                src={vehiculeSelectionne.image}
                                                alt={`${vehiculeSelectionne.marque || ""} ${vehiculeSelectionne.modele || ""}`}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";

                                                    const fallback =
                                                        e.currentTarget.parentElement.querySelector(".gc-no-image");

                                                    if (fallback) {
                                                        fallback.style.display = "flex";
                                                    }
                                                }}
                                            />

                                        ) : null}

                                        <div
                                            className="gc-no-image"
                                            style={{
                                                display: vehiculeSelectionne.image
                                                    ? "none"
                                                    : "flex"
                                            }}
                                        >
                                            Image non disponible
                                        </div>

                                    </div>


                                    <div className="gc-vehicle-grid">

                                        <div className="gc-info-item">
                                            <span>Immatriculation</span>
                                            <strong>
                                                {vehiculeSelectionne.immatriculation || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Marque</span>
                                            <strong>
                                                {vehiculeSelectionne.marque || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Modèle</span>
                                            <strong>
                                                {vehiculeSelectionne.modele || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Année</span>
                                            <strong>
                                                {vehiculeSelectionne.annee || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Carburant</span>
                                            <strong>
                                                {vehiculeSelectionne.carburant || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Type</span>
                                            <strong>
                                                {vehiculeSelectionne.type || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Variante</span>
                                            <strong>
                                                {vehiculeSelectionne.variante || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Moteur</span>
                                            <strong>
                                                {vehiculeSelectionne.moteur || "-"}
                                            </strong>
                                        </div>

                                        <div className="gc-info-item">
                                            <span>Puissance fiscale</span>
                                            <strong>
                                                {vehiculeSelectionne.puissanceFiscale || "-"}
                                            </strong>
                                        </div>

                                    </div>

                                </div>

                            </div>

                        </section>

                    )}


                    {/* AJOUTER UNE COMPATIBILITE */}

                    {vehiculeSelectionne && (

                        <section className="gc-card">

                            <div className="gc-card-header">

                                <div>

                                    <h3>Ajouter une compatibilité</h3>

                                    <p>
                                        Associez un pneu existant au véhicule sélectionné.
                                    </p>

                                </div>

                            </div>


                            <form
                                className="gc-card-body"
                                onSubmit={handleAjouter}
                            >

                                <div className="gc-add-form">

                                    <div className="gc-field">

                                        <label htmlFor="pneuSelect">
                                            Choisir un pneu
                                        </label>

                                        <select
                                            id="pneuSelect"
                                            value={pneuId}
                                            onChange={(e) =>
                                                setPneuId(e.target.value)
                                            }
                                        >

                                            <option value="">
                                                -- Sélectionner un pneu --
                                            </option>

                                            {pneusDisponibles.map((pneu) => (

                                                <option
                                                    key={pneu.id}
                                                    value={pneu.id}
                                                >
                                                    {getNomMarque(pneu)}
                                                    {" - "}
                                                    {pneu.modele || "-"}
                                                    {" - "}
                                                    {pneu.dimension || "Dimension inconnue"}
                                                    {" - "}
                                                    {pneu.saison || "Saison non renseignée"}
                                                    {" - "}
                                                    {pneu.prix} DT
                                                </option>

                                            ))}

                                        </select>

                                    </div>


                                    <button
                                        type="submit"
                                        className="gc-btn gc-btn-primary"
                                        disabled={!pneuId || saving}
                                    >

                                        {saving
                                            ? "Ajout en cours..."
                                            : "Ajouter la compatibilité"
                                        }

                                    </button>

                                </div>


                                {pneusDisponibles.length === 0 && (

                                    <p className="gc-hint">
                                        Tous les pneus du catalogue sont
                                        déjà associés à ce véhicule.
                                    </p>

                                )}

                            </form>

                        </section>

                    )}


                    {/* PNEUS COMPATIBLES */}

                    {vehiculeSelectionne && (

                        <section className="gc-card">

                            <div className="gc-card-header">

                                <div>

                                    <h3>Pneus compatibles</h3>

                                    <p>
                                        {pneusCompatibles.length} pneu(s)
                                        associé(s) à ce véhicule.
                                    </p>

                                </div>

                            </div>


                            <div className="gc-card-body">

                                {pneusCompatibles.length === 0 ? (

                                    <div className="gc-empty gc-empty-small">

                                        <h4>Aucun pneu compatible</h4>

                                        <p>
                                            Ajoutez un pneu à l'aide du
                                            formulaire ci-dessus.
                                        </p>

                                    </div>

                                ) : (

                                    <div className="gc-table-wrapper">

                                        <table className="gc-table">

                                            <thead>

                                                <tr>
                                                    <th>Marque</th>
                                                    <th>Modèle</th>
                                                    <th>Dimension</th>
                                                    <th>Saison</th>
                                                    <th>Prix</th>
                                                    <th>Stock</th>
                                                    <th>Action</th>
                                                </tr>

                                            </thead>


                                            <tbody>

                                                {pneusCompatibles.map((pneu) => (

                                                    <tr key={pneu.id}>

                                                        <td className="gc-product-name">
                                                            {getNomMarque(pneu)}
                                                        </td>

                                                        <td className="gc-product-name">
                                                            {pneu.modele || "-"}
                                                        </td>

                                                        <td>
                                                            {pneu.dimension || "-"}
                                                        </td>

                                                        <td>
                                                            <span className="gc-season">
                                                                {pneu.saison || "Non renseignée"}
                                                            </span>
                                                        </td>

                                                        <td>
                                                            {pneu.prix} DT
                                                        </td>

                                                        <td>
                                                            {pneu.stock ?? 0}
                                                        </td>

                                                        <td>

                                                            <button
                                                                type="button"
                                                                className="gc-btn-delete"
                                                                disabled={suppressionLoading === pneu.id}
                                                                onClick={() =>
                                                                    handleSupprimer(pneu.id)
                                                                }
                                                            >

                                                                {suppressionLoading === pneu.id
                                                                    ? "Suppression..."
                                                                    : "Supprimer"
                                                                }

                                                            </button>

                                                        </td>

                                                    </tr>

                                                ))}

                                            </tbody>

                                        </table>

                                    </div>

                                )}

                            </div>

                        </section>

                    )}

                </>

            )}

        </div>

    );

}

export default GestionCompatibilites;
