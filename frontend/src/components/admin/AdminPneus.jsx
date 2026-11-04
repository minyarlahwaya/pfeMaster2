import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaPlus,
    FaEdit,
    FaTrash,
    FaHome,
    FaFileExcel,
    FaUpload,
    FaCheckCircle,
    FaExclamationTriangle,
    FaSyncAlt,
    FaTimesCircle,
    FaSearch,
    FaTimes,
     FaEye
} from "react-icons/fa";

import {
    getAllPneus,
    deletePneu,
    importPneusExcel
} from "../../services/pneuApi";

import "./AdminPneus.css";
import { API_URL } from "../../config";


// ========================================
// OUTILS RECHERCHE PAR MARQUE
// ========================================

// Enlève accents, espaces et majuscules :
// "West Lake" = "WESTLAKE" = "westlake"
const normaliser = (texte) =>
    (texte || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .toLowerCase();

// Nom de la marque d'un pneu (même logique que la carte)
const getNomMarque = (pneu) =>
    pneu.Marque?.nom || pneu.marque?.nom || "";


// ========================================
// RECHERCHE PAR MARQUE, MODÈLE ET CARACTÉRISTIQUES
// ========================================

const rechercherDansPneu = (pneu, recherche) => {
    const terme = normaliser(recherche);

    if (!terme) return true;

    const informationsPneu = [
        getNomMarque(pneu),
        pneu.modele,
        pneu.dimension,
        pneu.saison,
        pneu.largeur,
        pneu.hauteur,
        pneu.diametre
    ];

    return informationsPneu.some((information) =>
        normaliser(information).includes(terme)
    );
};


function AdminPneus() {

    const [pneus, setPneus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // ========================================
// DÉTAILS DU PNEU
// ========================================

const [pneuSelectionne, setPneuSelectionne] = useState(null);

    // ========================================
    // RECHERCHE PAR MARQUE
    // ========================================

    const [rechercheMarque, setRechercheMarque] = useState("");

    // ========================================
    // ÉTATS IMPORT EXCEL
    // ========================================

    const [fichierExcel, setFichierExcel] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [importing, setImporting] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    const navigate = useNavigate();


    // ========================================
    // RÉCUPÉRER LES PNEUS
    // ========================================

    const chargerPneus = async () => {

        try {

            const response = await getAllPneus();

            if (response.data.success) {
                setPneus(response.data.pneus);
            }

        } catch (error) {

            console.error("Erreur récupération pneus :", error);

            setError("Impossible de récupérer les pneus.");

        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {
        chargerPneus();
    }, []);


    // ========================================
    // SÉLECTIONNER LE FICHIER EXCEL
    // ========================================

    const handleFileChange = (event) => {

        const file = event.target.files[0];

        setPreviewData(null);

        if (!file) {
            setFichierExcel(null);
            return;
        }

        if (!file.name.toLowerCase().endsWith(".xlsx")) {

            alert(
                "Veuillez sélectionner un fichier Excel au format .xlsx."
            );

            event.target.value = "";
            setFichierExcel(null);

            return;
        }

        setFichierExcel(file);

    };


    // ========================================
    // PRÉVISUALISER LE FICHIER
    // ========================================

    const handlePreview = async () => {

        if (!fichierExcel) {
            alert("Veuillez sélectionner un fichier Excel.");
            return;
        }

        try {

            setPreviewLoading(true);
            setPreviewData(null);

            const formData = new FormData();

            formData.append("fichier", fichierExcel);

            const response = await importPneusExcel(formData, true);

            setPreviewData(response.data);

            console.log(
                "Prévisualisation Excel :",
                response.data
            );

        } catch (error) {

            const details = error.response?.data;

            console.error(
                "Erreur prévisualisation Excel :",
                details || error
            );

            setPreviewData(details || {
                success: false,
                message: "Impossible de contacter le serveur."
            });

        } finally {

            setPreviewLoading(false);

        }

    };


    // ========================================
    // IMPORTER LE FICHIER EXCEL
    // ========================================

    const handleImport = async () => {

        if (!fichierExcel || !previewData) {
            alert("Veuillez d'abord prévisualiser votre fichier.");
            return;
        }

        if (previewData.success !== true) {
            alert(
                "Le fichier contient des erreurs. Vérifiez-le avant l'importation."
            );
            return;
        }

        const confirmation = window.confirm(
            `Voulez-vous vraiment importer ce fichier Excel ?\n\n` +
            `${previewData.nombreNouveaux ?? 0} nouveau(x) pneu(s) à ajouter.\n` +
            `${previewData.nombreMisesAJour ?? 0} pneu(s) existant(s) à mettre à jour.\n\n` +
            "Le stock et les informations des pneus existants seront remplacés."
        );

        if (!confirmation) {
            return;
        }

        try {

            setImporting(true);

            const formData = new FormData();

            formData.append("fichier", fichierExcel);

            const response = await importPneusExcel(formData, false);

            if (response.data.success) {

                alert(
                    response.data.message ||
                    "Importation effectuée avec succès."
                );

                setFichierExcel(null);
                setPreviewData(null);

                // Actualiser la liste des pneus
                setLoading(true);
                setError("");

                await chargerPneus();

            }

        } catch (error) {

            console.error(
                "Erreur importation Excel :",
                error.response?.data || error
            );

            alert(
                error.response?.data?.message ||
                "Erreur lors de l'importation Excel."
            );

        } finally {

            setImporting(false);

        }

    };


    // ========================================
    // ARCHIVER UN PNEU
    // ========================================

    const handleDelete = async (id) => {

        const confirmation = window.confirm(
            "Êtes-vous sûr de vouloir archiver ce pneu ?"
        );

        if (!confirmation) {
            return;
        }

        try {

            await deletePneu(id);

            setPneus((pneusActuels) =>
                pneusActuels.filter(
                    (pneu) => pneu.id !== id
                )
            );

            alert("Pneu archivé avec succès.");

        } catch (error) {

            console.error(
                "Erreur archivage pneu :",
                error
            );

            alert(
                error.response?.data?.message ||
                "Impossible d'archiver ce pneu."
            );

        }

    };


    // ========================================
    // CHARGEMENT
    // ========================================

    if (loading) {

        return (
            <div className="admin-pneus-page">

                <div className="admin-pneus-loading">
                    Chargement des pneus...
                </div>

            </div>
        );

    }


    // ========================================
    // ERREUR
    // ========================================

    if (error) {

        return (
            <div className="admin-pneus-page">

                <div className="admin-pneus-error">
                    {error}
                </div>

            </div>
        );

    }


    // ========================================
    // PNEUS FILTRÉS PAR MARQUE
    // ========================================
const pneusFiltres = pneus.filter((pneu) =>
    rechercherDansPneu(pneu, rechercheMarque)
);


    // ========================================
    // AFFICHAGE
    // ========================================

    return (

        <div className="admin-pneus-page">

            {/* HEADER */}

            <div className="admin-pneus-header">

                <div>

                    <h1>Gestion des pneus</h1>

                    <p>
                        Gérez les pneus disponibles dans votre catalogue.
                    </p>

                </div>


                {/* BOUTONS */}

                <div className="admin-pneus-header-actions">

                    <button
                        className="btn-retour-dashboard"
                        title="Retour au dashboard"
                        onClick={() => navigate("/admin")}
                    >
                        <FaHome />
                        <span>Dashboard</span>
                    </button>


                    <button
                        className="btn-ajouter-pneu"
                        title="Ajouter un pneu"
                        onClick={() =>
                            navigate("/admin/pneus/ajouter")
                        }
                    >
                        <FaPlus />
                        <span>Ajouter un pneu</span>
                    </button>

                </div>

            </div>


            {/* ========================================
                IMPORT EXCEL
            ======================================== */}

            <div className="import-excel-section">

                <div className="import-excel-title">

                    <FaFileExcel />

                    <div>

                        <h2>Importation Excel</h2>

                        <p>
                            Importez plusieurs pneus à partir d'un fichier Excel.
                        </p>

                    </div>

                </div>


                {/* SÉLECTION ET PRÉVISUALISATION */}

                <div className="import-excel-controls">

                    <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileChange}
                        disabled={previewLoading || importing}
                    />


                    <button
                        className="btn-preview-excel"
                        onClick={handlePreview}
                        disabled={
                            !fichierExcel ||
                            previewLoading ||
                            importing
                        }
                    >

                        <FaUpload />

                        {previewLoading
                            ? "Vérification..."
                            : "Prévisualiser"}

                    </button>

                </div>


                {/* NOM DU FICHIER */}

                {fichierExcel && (

                    <p className="excel-file-name">

                        <FaFileExcel />

                        {fichierExcel.name}

                    </p>

                )}


                {/* ========================================
                    RÉSULTAT PRÉVISUALISATION
                ======================================== */}

                {previewData && (

                    <div className="excel-preview-result">

                        <h3>
                            Résultat de la prévisualisation
                        </h3>


                        {previewData.success ? (

                            <>

                                {/* MESSAGE DE SUCCÈS */}

                                <div className="excel-preview-success">

                                    <FaCheckCircle />

                                    <span>
                                        {previewData.message}
                                    </span>

                                </div>


                                {/* RÉSUMÉ */}

                                <div className="excel-summary">

                                    <div className="excel-summary-card success">

                                        <FaPlus />

                                        <div>

                                            <strong>
                                                {previewData.nombreNouveaux ?? 0}
                                            </strong>

                                            <span>
                                                Nouveaux pneus
                                            </span>

                                        </div>

                                    </div>


                                    <div className="excel-summary-card update">

                                        <FaSyncAlt />

                                        <div>

                                            <strong>
                                                {previewData.nombreMisesAJour ?? 0}
                                            </strong>

                                            <span>
                                                Pneus existants
                                            </span>

                                        </div>

                                    </div>


                                    <div className="excel-summary-card total">

                                        <FaFileExcel />

                                        <div>

                                            <strong>
                                                {previewData.nombreTotal ?? 0}
                                            </strong>

                                            <span>
                                                Total des pneus
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                {/* ========================================
                                    NOUVEAUX PNEUS
                                ======================================== */}

                                {previewData.nouveauxPneus?.length > 0 && (

                                    <div className="excel-result-group">

                                        <h4 className="excel-result-title success">

                                            <FaPlus />

                                            Pneus à ajouter

                                        </h4>


                                        {previewData.nouveauxPneus.map(
                                            (pneu, index) => (

                                                <div
                                                    className="excel-result-item"
                                                    key={`nouveau-${index}`}
                                                >

                                                    <div>

                                                        <strong>
                                                            {pneu.marque} - {pneu.modele}
                                                        </strong>

                                                        <span>
                                                            Dimension : {pneu.dimension}
                                                        </span>

                                                        <small>
                                                            Ligne Excel : {pneu.ligne}
                                                        </small>

                                                    </div>


                                                    <span className="excel-result-message success">
                                                        {pneu.message}
                                                    </span>

                                                </div>

                                            )
                                        )}

                                    </div>

                                )}


                                {/* ========================================
                                    PNEUS EXISTANTS
                                ======================================== */}

                                {previewData.pneusExistants?.length > 0 && (

                                    <div className="excel-result-group">

                                        <h4 className="excel-result-title update">

                                            <FaSyncAlt />

                                            Pneus déjà existants - Mise à jour

                                        </h4>


                                        {previewData.pneusExistants.map(
                                            (pneu, index) => (

                                                <div
                                                    className="excel-result-item"
                                                    key={`existant-${pneu.id}-${index}`}
                                                >

                                                    <div>

                                                        <strong>
                                                            {pneu.marque} - {pneu.modele}
                                                        </strong>

                                                        <span>
                                                            Dimension : {pneu.dimension}
                                                        </span>

                                                        <small>
                                                            Ligne Excel : {pneu.ligne} | ID : {pneu.id}
                                                        </small>

                                                    </div>


                                                    <span className="excel-result-message update">
                                                        {pneu.message}
                                                    </span>

                                                </div>

                                            )
                                        )}

                                    </div>

                                )}


                                {/* AVERTISSEMENT */}

                                <div className="excel-preview-warning">

                                    <FaExclamationTriangle />

                                    <span>
                                        Attention : les informations et le stock
                                        des pneus existants seront remplacés par
                                        les valeurs du fichier Excel.
                                    </span>

                                </div>


                                {/* CONFIRMER IMPORTATION */}

                                <button
                                    className="btn-import-excel"
                                    onClick={handleImport}
                                    disabled={
                                        importing ||
                                        previewLoading
                                    }
                                >

                                    <FaFileExcel />

                                    {importing
                                        ? "Importation en cours..."
                                        : "Confirmer l'importation"}

                                </button>

                            </>

                        ) : (

                            <>

                                {/* MESSAGE D'ERREUR */}

                                <div className="excel-preview-error">

                                    <FaTimesCircle />

                                    <span>
                                        {previewData.message ||
                                            "Le fichier contient des erreurs."}
                                    </span>

                                </div>


                                {/* LISTE DES ERREURS */}

                                {previewData.erreurs?.map(
                                    (erreur, index) => (

                                        <p
                                            className="excel-error-item"
                                            key={`erreur-${index}`}
                                        >
                                            <FaExclamationTriangle />
                                            {erreur}
                                        </p>

                                    )
                                )}


                                {/* LISTE DES DOUBLONS */}

                                {previewData.doublons?.map(
                                    (doublon, index) => (

                                        <p
                                            className="excel-error-item"
                                            key={`doublon-${index}`}
                                        >
                                            <FaTimesCircle />
                                            {doublon}
                                        </p>

                                    )
                                )}

                            </>

                        )}

                    </div>

                )}

            </div>


            {/* ========================================
                RECHERCHE PAR MARQUE
            ======================================== */}

            <div className="recherche-marque-section">

                <div className="recherche-marque-box">

                    <FaSearch className="recherche-marque-icon" />

                    <input
    type="text"
    placeholder="Rechercher par marque, modèle, dimension ou saison..."
    value={rechercheMarque}
    onChange={(e) => setRechercheMarque(e.target.value)}
/>

                    {rechercheMarque && (

                        <button
                            type="button"
                            className="btn-effacer-recherche"
                            title="Effacer la recherche"
                            onClick={() => setRechercheMarque("")}
                        >
                            <FaTimes />
                        </button>

                    )}

                </div>

            </div>


            {/* ========================================
                INFORMATIONS
            ======================================== */}

            <div className="pneus-info">

                <span>
                    {rechercheMarque
                        ? `Résultats pour « ${rechercheMarque} »`
                        : "Nombre de pneus"}
                </span>

                <strong>
                    {rechercheMarque
                        ? `${pneusFiltres.length} / ${pneus.length}`
                        : pneus.length}
                </strong>

            </div>


            {/* ========================================
                GRILLE DES PNEUS
            ======================================== */}

            <div className="admin-pneus-grid">

                {pneusFiltres.length === 0 ? (
<div className="aucun-pneu">
    {rechercheMarque
        ? `Aucun pneu trouvé pour « ${rechercheMarque} ».`
        : "Aucun pneu trouvé."}
</div>

                ) : (

                    pneusFiltres.map((pneu) => (

                        <div
                            className="admin-pneu-card"
                            key={pneu.id}
                        >

                            {/* IMAGE */}

                            <div className="admin-pneu-image-container">

                                {pneu.image ? (

                                    <img
                                        src={`${API_URL}/uploadPneu/${pneu.image}`}
                                        alt={pneu.modele}
                                        className="admin-pneu-image"
                                    />

                                ) : (

                                    <span className="no-image">
                                        Aucune image
                                    </span>

                                )}

                            </div>


                            {/* CONTENU */}

                            <div className="admin-pneu-content">

                                <h3 title={pneu.modele}>
                                    {pneu.modele}
                                </h3>


                                <p className="admin-pneu-marque">

                                    {pneu.Marque?.nom ||
                                        pneu.marque?.nom ||
                                        "-"}

                                </p>


                                <div className="admin-pneu-details">

                                    <span>
                                        {pneu.dimension || "-"}
                                    </span>

                                    <span>
                                        {pneu.saison || "-"}
                                    </span>

                                </div>


                                <div className="admin-pneu-bottom">

                                    <strong>
                                        {pneu.prix} DT
                                    </strong>

                                    <span
                                        className={
                                            pneu.stock > 0
                                                ? "stock-disponible"
                                                : "stock-rupture"
                                        }
                                    >

                                        {pneu.stock > 0
                                            ? `Stock : ${pneu.stock}`
                                            : "Rupture"}

                                    </span>

                                </div>


                                {/* ACTIONS */}

                               {/* ACTIONS */}
<div className="actions-pneu">
  <button
    className="btn-action btn-details"
    title="Voir les détails"
    onClick={() => setPneuSelectionne(pneu)}
  >
    <FaEye />
  </button>

  <div className="actions-pneu-droite">
    <button
      className="btn-action btn-edit"
      title="Modifier"
      onClick={() => navigate(`/admin/pneus/modifier/${pneu.id}`)}
    >
      <FaEdit />
    </button>

    <button
      className="btn-action btn-delete"
      title="Archiver"
      onClick={() => handleDelete(pneu.id)}
    >
      <FaTrash />
    </button>
  </div>
</div>

                            </div>

                        </div>

                    ))

                )}

            </div>

            {/* ========================================
    MODALE DÉTAILS DU PNEU
======================================== */}

{pneuSelectionne && (

    <div
        className="details-pneu-overlay"
        onClick={() => setPneuSelectionne(null)}
    >

        <div
            className="details-pneu-modal"
            onClick={(e) => e.stopPropagation()}
        >

            {/* HEADER */}

            <div className="details-pneu-header">

                <div>
                    <h2>Détails du pneu</h2>
                    <p>
                        {pneuSelectionne.marque?.nom ||
                            pneuSelectionne.Marque?.nom ||
                            "Marque inconnue"} - {pneuSelectionne.modele}
                    </p>
                </div>

                <button
                    className="details-pneu-close"
                    onClick={() => setPneuSelectionne(null)}
                    title="Fermer"
                >
                    <FaTimes />
                </button>

            </div>

            {/* CONTENU */}

            <div className="details-pneu-body">

                {/* IMAGE */}

                <div className="details-pneu-image">

                    {pneuSelectionne.image ? (

                        <img
                            src={`${API_URL}/uploadPneu/${pneuSelectionne.image}`}
                            alt={pneuSelectionne.modele}
                        />

                    ) : (

                        <span>Aucune image disponible</span>

                    )}

                </div>

                {/* INFORMATIONS GÉNÉRALES */}

                <div className="details-pneu-section">

                    <h3>Informations générales</h3>

                    <div className="details-pneu-grid">

                        <div>
                            <span>Identifiant</span>
                            <strong>{pneuSelectionne.id}</strong>
                        </div>

                        <div>
                            <span>Marque</span>
                            <strong>
                                {pneuSelectionne.marque?.nom ||
                                    pneuSelectionne.Marque?.nom || "-"}
                            </strong>
                        </div>

                        <div>
                            <span>Modèle</span>
                            <strong>{pneuSelectionne.modele || "-"}</strong>
                        </div>

                        <div>
                            <span>Dimension</span>
                            <strong>{pneuSelectionne.dimension || "-"}</strong>
                        </div>

                        <div>
                            <span>Largeur</span>
                            <strong>{pneuSelectionne.largeur ?? "-"} </strong>
                        </div>

                        <div>
                            <span>Hauteur</span>
                            <strong>{pneuSelectionne.hauteur ?? "-"}</strong>
                        </div>

                        <div>
                            <span>Diamètre</span>
                            <strong>{pneuSelectionne.diametre ?? "-"}</strong>
                        </div>

                        <div>
                            <span>Saison</span>
                            <strong>{pneuSelectionne.saison || "-"}</strong>
                        </div>

                    </div>

                </div>

                {/* INFORMATIONS FINANCIÈRES */}

                <div className="details-pneu-section">

                    <h3>Informations financières</h3>

                    <div className="details-pneu-grid">

                        <div>
                            <span>Prix d'achat HT</span>
                            <strong>
                                {pneuSelectionne.prixAchatHT ?? "-"} DT
                            </strong>
                        </div>

                        <div>
                            <span>Remise fournisseur</span>
                            <strong>
                                {pneuSelectionne.remiseFournisseur ?? "-"} %
                            </strong>
                        </div>

                        <div>
                            <span>Taux TVA</span>
                            <strong>
                                {pneuSelectionne.tauxTVA ?? "-"} %
                            </strong>
                        </div>

                        <div>
                            <span>Prix d'achat TTC</span>
                            <strong>
                                {pneuSelectionne.prixAchatTTC ?? "-"} DT
                            </strong>
                        </div>

                        <div>
                            <span>Marge</span>
                            <strong>
                                {pneuSelectionne.marge ?? "-"} %
                            </strong>
                        </div>

                        <div>
                            <span>Prix de vente</span>
                            <strong className="details-prix-vente">
                                {pneuSelectionne.prix ?? "-"} DT
                            </strong>
                        </div>

                    </div>

                </div>

                {/* STOCK ET DESCRIPTION */}

                <div className="details-pneu-section">

                    <h3>Stock et disponibilité</h3>

                    <div className="details-pneu-grid">

                        <div>
                            <span>Quantité en stock</span>
                            <strong>{pneuSelectionne.stock ?? 0}</strong>
                        </div>

                        <div>
                            <span>État</span>
                            <strong>
                                {pneuSelectionne.isActive
                                    ? "Actif"
                                    : "Archivé"}
                            </strong>
                        </div>

                    </div>

                </div>

                <div className="details-pneu-section">

                    <h3>Description</h3>

                    <p className="details-pneu-description">
                        {pneuSelectionne.description ||
                            "Aucune description disponible."}
                    </p>

                </div>

            </div>

            {/* FOOTER */}

            <div className="details-pneu-footer">

                <button
                    onClick={() => setPneuSelectionne(null)}
                >
                    Fermer
                </button>

            </div>

        </div>

    </div>

)}

        </div>

    );

}


export default AdminPneus;
