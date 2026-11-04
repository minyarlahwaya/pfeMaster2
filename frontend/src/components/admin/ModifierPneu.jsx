
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    FaArrowLeft,
    FaImage,
    FaSave
} from "react-icons/fa";

import {
    getPneuById,
    updatePneu
} from "../../services/pneuApi";

import { getAllMarques } from "../../services/marqueApi";

import "./AjouterPneu.css";
import { API_URL } from "../../config";

const initialFormData = {
    modele: "",
    dimension: "",
    largeur: "",
    hauteur: "",
    diametre: "",
    saison: "",
    prixAchatHT: "",
    remiseFournisseur: "20",
    tauxTVA: "19",
    prixAchatTTC: "",
    marge: "20",
    prix: "",
    stock: "0",
    description: "",
    marqueId: ""
};

// ========================================
// CALCUL DE LA TARIFICATION
// ========================================

const calculerPrix = (data) => {

    const prixHT = Number(data.prixAchatHT);
    const remise = Number(data.remiseFournisseur);
    const tva = Number(data.tauxTVA);
    const marge = Number(data.marge);

    if (
        data.prixAchatHT === "" ||
        !Number.isFinite(prixHT) ||
        prixHT <= 0 ||
        !Number.isFinite(remise) ||
        remise < 0 ||
        remise > 100 ||
        !Number.isFinite(tva) ||
        tva < 0 ||
        !Number.isFinite(marge) ||
        marge < 0
    ) {
        return {
            ...data,
            prixAchatTTC: "",
            prix: ""
        };
    }

    const prixNetHT = prixHT * (1 - remise / 100);

    const prixTTC = prixNetHT * (1 + tva / 100);

    const prixVente = prixTTC * (1 + marge / 100);

    return {
        ...data,
        prixAchatTTC: prixTTC.toFixed(3),
        prix: prixVente.toFixed(3)
    };
};

function ModifierPneu() {

    const navigate = useNavigate();
    const { id } = useParams();

    const [marques, setMarques] = useState([]);

    const [formData, setFormData] = useState(initialFormData);

    const [image, setImage] = useState(null);
    const [ancienneImage, setAncienneImage] = useState("");

    const [loading, setLoading] = useState(true);
    const [loadingMarques, setLoadingMarques] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ========================================
    // RÉCUPÉRER LE PNEU
    // ========================================

    useEffect(() => {

        const chargerPneu = async () => {

            try {

                const response = await getPneuById(id);

                const pneu =
                    response.data.pneu ||
                    response.data;

                const donnees = {
                    modele: pneu.modele || "",
                    dimension: pneu.dimension || "",
                    largeur: pneu.largeur ?? "",
                    hauteur: pneu.hauteur ?? "",
                    diametre: pneu.diametre ?? "",
                   saison: pneu.saison ?? "",

                    prixAchatHT: pneu.prixAchatHT ?? "",
                    remiseFournisseur: pneu.remiseFournisseur ?? 20,
                    tauxTVA: pneu.tauxTVA ?? 19,
                    prixAchatTTC: pneu.prixAchatTTC ?? "",
                    marge: pneu.marge ?? 20,

                    prix: pneu.prix ?? "",
                    stock: pneu.stock ?? 0,
                    description: pneu.description || "",
                    marqueId: pneu.marqueId || ""
                };

                setFormData(calculerPrix(donnees));

                setAncienneImage(pneu.image || "");

            } catch (error) {

                console.error(
                    "Erreur récupération pneu :",
                    error
                );

                setError(
                    "Impossible de récupérer les informations du pneu."
                );

            } finally {

                setLoading(false);

            }

        };

        chargerPneu();

    }, [id]);

    // ========================================
    // RÉCUPÉRER LES MARQUES
    // ========================================

    useEffect(() => {

        const chargerMarques = async () => {

            try {

                const response = await getAllMarques();

                if (Array.isArray(response.data)) {

                    setMarques(response.data);

                } else if (Array.isArray(response.data.marques)) {

                    setMarques(response.data.marques);

                }

            } catch (error) {

                console.error(
                    "Erreur récupération marques :",
                    error
                );

                setError(
                    "Impossible de récupérer les marques."
                );

            } finally {

                setLoadingMarques(false);

            }

        };

        chargerMarques();

    }, []);

    // ========================================
    // MODIFIER LES CHAMPS
    // ========================================

    const handleChange = (e) => {

        const { name, value } = e.target;

        setFormData((prev) => {

            let nouveauFormData = {
                ...prev,
                [name]: value
            };

            // Modification de la largeur
            if (name === "largeur") {

                nouveauFormData.dimension =
                    `${value}/${prev.hauteur} R${prev.diametre}`;

            }

            // Modification de la hauteur
            if (name === "hauteur") {

                nouveauFormData.dimension =
                    `${prev.largeur}/${value} R${prev.diametre}`;

            }

            // Modification du diamètre
            if (name === "diametre") {

                nouveauFormData.dimension =
                    `${prev.largeur}/${prev.hauteur} R${value}`;

            }

            // Modification directe de la dimension
            if (name === "dimension") {

                const match = value.match(
                    /^(\d+)\/(\d+)\s*R(\d+)$/i
                );

                if (match) {

                    nouveauFormData.largeur = match[1];
                    nouveauFormData.hauteur = match[2];
                    nouveauFormData.diametre = match[3];

                }

            }

            // Recalcul automatique des prix
            if (
                [
                    "prixAchatHT",
                    "remiseFournisseur",
                    "tauxTVA",
                    "marge"
                ].includes(name)
            ) {

                nouveauFormData = calculerPrix(nouveauFormData);

            }

            return nouveauFormData;

        });

    };

    // ========================================
    // CHOISIR UNE NOUVELLE IMAGE
    // ========================================

    const handleImageChange = (e) => {

        const file = e.target.files[0];

        if (file) {

            setImage(file);

        }

    };

    // ========================================
    // MODIFIER LE PNEU
    // ========================================

    const handleSubmit = async (e) => {

        e.preventDefault();

        setError("");
        setSuccess("");

        if (!formData.marqueId) {

            setError("Veuillez sélectionner une marque.");
            return;

        }

        if (!formData.prixAchatHT || Number(formData.prixAchatHT) <= 0) {

            setError("Veuillez saisir un prix d'achat HT supérieur à zéro.");
            return;

        }

        if (
            Number(formData.remiseFournisseur) < 0 ||
            Number(formData.remiseFournisseur) > 100
        ) {

            setError("La remise fournisseur doit être comprise entre 0 et 100 %.");
            return;

        }

        if (
            Number(formData.tauxTVA) < 0 ||
            Number(formData.marge) < 0
        ) {

            setError("La TVA et la marge ne peuvent pas être négatives.");
            return;

        }

        if (
            formData.prixAchatTTC === "" ||
            formData.prix === ""
        ) {

            setError("Impossible de calculer les prix. Vérifiez les valeurs saisies.");
            return;

        }

        if (
            formData.stock === "" ||
            !Number.isInteger(Number(formData.stock)) ||
            Number(formData.stock) < 0
        ) {

            setError("Veuillez saisir un stock entier positif ou nul.");
            return;

        }

        try {

            setSaving(true);

            const data = new FormData();

            data.append("modele", formData.modele);
            data.append("dimension", formData.dimension);

            data.append("largeur", formData.largeur);
            data.append("hauteur", formData.hauteur);
            data.append("diametre", formData.diametre);

          data.append("saison", formData.saison.trim());

            data.append("prixAchatHT", formData.prixAchatHT);
            data.append("remiseFournisseur", formData.remiseFournisseur);
            data.append("tauxTVA", formData.tauxTVA);
            data.append("marge", formData.marge);

            // Le backend recalcule lui-même ces deux prix.
            data.append("prixAchatTTC", formData.prixAchatTTC);
            data.append("prix", formData.prix);

            data.append("stock", formData.stock);
            data.append("description", formData.description);
            data.append("marqueId", formData.marqueId);

            // Ajouter l'image uniquement si une nouvelle image est choisie
            if (image) {

                data.append("image", image);

            }

            const response = await updatePneu(id, data);

            console.log("Pneu modifié :", response.data);

            if (response.data.success) {

                setSuccess("Pneu modifié avec succès !");

                setTimeout(() => {

                    navigate("/admin/pneus");

                }, 1000);

            }

        } catch (error) {

            console.error(
                "Erreur modification pneu :",
                error
            );

            setError(
                error.response?.data?.message ||
                "Erreur lors de la modification du pneu."
            );

        } finally {

            setSaving(false);

        }

    };

    // ========================================
    // CHARGEMENT
    // ========================================

    if (loading) {

        return (

            <div className="ajouter-pneu-page">

                <div className="ajouter-pneu-loading">
                    Chargement du pneu...
                </div>

            </div>

        );

    }

    // ========================================
    // AFFICHAGE
    // ========================================

    return (

        <div className="ajouter-pneu-page">

            {/* HEADER */}

            <div className="ajouter-pneu-header">

                <button
                    type="button"
                    className="btn-retour"
                    onClick={() => navigate("/admin/pneus")}
                >

                    <FaArrowLeft />

                    <span>Retour aux pneus</span>

                </button>

                <div>

                    <h1>Modifier un pneu</h1>

                    <p>
                        Modifier les informations et la tarification du pneu.
                    </p>

                </div>

            </div>

            {/* MESSAGES */}

            {error && (

                <div className="message-error">
                    {error}
                </div>

            )}

            {success && (

                <div className="message-success">
                    {success}
                </div>

            )}

            <form
                className="ajouter-pneu-form"
                onSubmit={handleSubmit}
            >

                {/* INFORMATIONS PRINCIPALES */}

                <div className="form-section">

                    <h2>Informations du pneu</h2>

                    <div className="form-grid">

                        <div className="form-group">

                            <label>Modèle *</label>

                            <input
                                type="text"
                                name="modele"
                                value={formData.modele}
                                onChange={handleChange}
                                placeholder="Ex : Primacy 4"
                                required
                            />

                        </div>

                        <div className="form-group">

                            <label>Marque *</label>

                            <select
                                name="marqueId"
                                value={formData.marqueId}
                                onChange={handleChange}
                                required
                                disabled={loadingMarques}
                            >

                                <option value="">
                                    {loadingMarques
                                        ? "Chargement..."
                                        : "Sélectionner une marque"}
                                </option>

                                {marques.map((marque) => (

                                    <option
                                        key={marque.id}
                                        value={marque.id}
                                    >
                                        {marque.nom}
                                    </option>

                                ))}

                            </select>

                        </div>

                        <div className="form-group">

                            <label>Dimension *</label>

                            <input
                                type="text"
                                name="dimension"
                                value={formData.dimension}
                                onChange={handleChange}
                                placeholder="Ex : 205/55 R16"
                                required
                            />

                        </div>

                        
<div className="form-group">
    <label>Saison (facultatif)</label>

    <select
        name="saison"
        value={formData.saison}
        onChange={handleChange}
    >
        <option value="">
            Aucune saison sélectionnée
        </option>

        <option value="Été">Été</option>
        <option value="Hiver">Hiver</option>
        <option value="4 saisons">4 saisons</option>
    </select>

    <small className="text-muted">
        Ce champ est facultatif. Vous pouvez le laisser vide.
    </small>
</div>


                    </div>

                </div>

                {/* DIMENSIONS TECHNIQUES */}

                <div className="form-section">

                    <h2>Dimensions techniques</h2>

                    <div className="form-grid three-columns">

                        <div className="form-group">

                            <label>Largeur</label>

                            <input
                                type="number"
                                name="largeur"
                                value={formData.largeur}
                                onChange={handleChange}
                                placeholder="Ex : 205"
                                min="0"
                            />

                        </div>

                        <div className="form-group">

                            <label>Hauteur</label>

                            <input
                                type="number"
                                name="hauteur"
                                value={formData.hauteur}
                                onChange={handleChange}
                                placeholder="Ex : 55"
                                min="0"
                            />

                        </div>

                        <div className="form-group">

                            <label>Diamètre</label>

                            <input
                                type="number"
                                name="diametre"
                                value={formData.diametre}
                                onChange={handleChange}
                                placeholder="Ex : 16"
                                min="0"
                            />

                        </div>

                    </div>

                </div>

                {/* TARIFICATION */}

                <div className="form-section">

                    <h2>Tarification</h2>

                    <div className="form-grid">

                        <div className="form-group">

                            <label>Prix d'achat HT (DT) *</label>

                            <input
                                type="number"
                                name="prixAchatHT"
                                value={formData.prixAchatHT}
                                onChange={handleChange}
                                placeholder="Ex : 200"
                                min="0.001"
                                step="0.001"
                                required
                            />

                        </div>

                        <div className="form-group">

                            <label>Remise fournisseur (%) *</label>

                            <input
                                type="number"
                                name="remiseFournisseur"
                                value={formData.remiseFournisseur}
                                onChange={handleChange}
                                min="0"
                                max="100"
                                step="0.01"
                                required
                            />

                        </div>

                        <div className="form-group">

                            <label>TVA (%) *</label>

                            <input
                                type="number"
                                name="tauxTVA"
                                value={formData.tauxTVA}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                required
                            />

                        </div>

                        <div className="form-group">

                            <label>Marge bénéficiaire (%) *</label>

                            <input
                                type="number"
                                name="marge"
                                value={formData.marge}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                required
                            />

                        </div>

                        <div className="form-group">

                            <label>Prix d'achat TTC (DT)</label>

                            <input
                                type="number"
                                value={formData.prixAchatTTC}
                                readOnly
                                className="input-calcul"
                            />

                        </div>

                        <div className="form-group">

                            <label>Prix de vente TTC (DT) *</label>

                            <input
                                type="number"
                                value={formData.prix}
                                readOnly
                                className="input-calcul"
                                required
                            />

                        </div>

                    </div>

                    <p className="text-muted">
                        Les prix TTC sont calculés automatiquement à partir
                        du prix d'achat HT, de la remise, de la TVA et de la marge.
                    </p>

                </div>

                {/* STOCK */}

                <div className="form-section">

                    <h2>Stock</h2>

                    <div className="form-grid">

                        <div className="form-group">

                            <label>Quantité en stock *</label>

                            <input
                                type="number"
                                name="stock"
                                value={formData.stock}
                                onChange={handleChange}
                                min="0"
                                step="1"
                                required
                            />

                        </div>

                    </div>

                </div>

                {/* DESCRIPTION */}

                <div className="form-section">

                    <h2>Description</h2>

                    <div className="form-group">

                        <label>Description du pneu</label>

                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Décrivez le pneu..."
                            rows="5"
                        />

                    </div>

                </div>

                {/* IMAGE */}

                <div className="form-section">

                    <h2>Image du pneu</h2>

                    {ancienneImage && (

                        <div className="current-image">

                            <p>Image actuelle :</p>

                            <img
                                src={`${API_URL}/uploadPneu/${ancienneImage}`}
                                alt={formData.modele}
                            />

                        </div>

                    )}

                    <div className="image-upload">

                        <FaImage />

                        <label htmlFor="image">
                            Choisir une nouvelle image
                        </label>

                        <input
                            id="image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                        />

                        {image && (

                            <p>
                                Nouvelle image sélectionnée :
                                <strong> {image.name}</strong>
                            </p>

                        )}

                    </div>

                </div>

                {/* BOUTONS */}

                <div className="form-actions">

                    <button
                        type="button"
                        className="btn-annuler"
                        onClick={() => navigate("/admin/pneus")}
                    >
                        Annuler
                    </button>

                    <button
                        type="submit"
                        className="btn-enregistrer"
                        disabled={saving || loadingMarques}
                    >

                        <FaSave />

                        {saving
                            ? "Modification..."
                            : "Modifier le pneu"}

                    </button>

                </div>

            </form>

        </div>

    );

}

export default ModifierPneu;
