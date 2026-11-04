
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaImage, FaSave } from "react-icons/fa";

import { addPneu } from "../../services/pneuApi";
import { getAllMarques } from "../../services/marqueApi";

import "./AjouterPneu.css";

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
    stock: "",
    description: "",
    marqueId: ""
};

function calculerPrix(data) {
    const prixHT = Number(data.prixAchatHT);
    const remise = Number(data.remiseFournisseur);
    const tva = Number(data.tauxTVA);
    const marge = Number(data.marge);

    if (
        data.prixAchatHT === "" ||
        data.remiseFournisseur === "" ||
        data.tauxTVA === "" ||
        data.marge === "" ||
        !Number.isFinite(prixHT) ||
        !Number.isFinite(remise) ||
        !Number.isFinite(tva) ||
        !Number.isFinite(marge) ||
        prixHT < 0 ||
        remise < 0 || remise > 100 ||
        tva < 0 ||
        marge < 0
    ) {
        return {
            prixAchatTTC: "",
            prix: ""
        };
    }

    const prixNetHT = prixHT * (1 - remise / 100);
    const prixTTC = prixNetHT * (1 + tva / 100);
    const prixVente = prixTTC * (1 + marge / 100);

    return {
        prixAchatTTC: prixTTC.toFixed(3),
        prix: prixVente.toFixed(3)
    };
}

function AjouterPneu() {
    const navigate = useNavigate();

    const [marques, setMarques] = useState([]);
    const [formData, setFormData] = useState(initialFormData);
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMarques, setLoadingMarques] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Récupération des marques
    useEffect(() => {
        const chargerMarques = async () => {
            try {
                const response = await getAllMarques();

                if (Array.isArray(response.data)) {
                    setMarques(response.data);
                } else if (Array.isArray(response.data.marques)) {
                    setMarques(response.data.marques);
                } else {
                    setMarques([]);
                }
            } catch (err) {
                console.error("Erreur récupération marques :", err);
                setError("Impossible de récupérer les marques.");
            } finally {
                setLoadingMarques(false);
            }
        };

        chargerMarques();
    }, []);

    // Modification des champs
    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((previous) => {
            const updated = {
                ...previous,
                [name]: value
            };

            if (
                [
                    "prixAchatHT",
                    "remiseFournisseur",
                    "tauxTVA",
                    "marge"
                ].includes(name)
            ) {
                return {
                    ...updated,
                    ...calculerPrix(updated)
                };
            }

            return updated;
        });

        setError("");
        setSuccess("");
    };

    // Sélection de l'image
    const handleImageChange = (e) => {
        const file = e.target.files?.[0];

        if (file) {
            if (!file.type.startsWith("image/")) {
                setError("Veuillez sélectionner un fichier image valide.");
                e.target.value = "";
                return;
            }

            setImage(file);
            setError("");
        }
    };

    // Ajouter le pneu
    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setSuccess("");

        if (!image) {
            setError("Veuillez sélectionner une image.");
            return;
        }

        if (!formData.marqueId) {
            setError("Veuillez sélectionner une marque.");
            return;
        }

        if (
            formData.prixAchatHT === "" ||
            formData.prixAchatTTC === "" ||
            formData.prix === ""
        ) {
            setError("Veuillez renseigner un prix d'achat HT valide.");
            return;
        }

        if (
            Number(formData.remiseFournisseur) < 0 ||
            Number(formData.remiseFournisseur) > 100
        ) {
            setError("La remise doit être comprise entre 0 et 100 %.");
            return;
        }

        if (
            Number(formData.tauxTVA) < 0 ||
            Number(formData.marge) < 0 ||
            Number(formData.stock || 0) < 0
        ) {
            setError("Les valeurs tarifaires et le stock doivent être positifs.");
            return;
        }

        try {
            setLoading(true);

            const data = new FormData();

            data.append("modele", formData.modele);
            data.append("dimension", formData.dimension);
            data.append("largeur", formData.largeur);
            data.append("hauteur", formData.hauteur);
            data.append("diametre", formData.diametre);
            data.append("saison", formData.saison);

            data.append("prixAchatHT", formData.prixAchatHT);
            data.append("remiseFournisseur", formData.remiseFournisseur);
            data.append("tauxTVA", formData.tauxTVA);
            data.append("prixAchatTTC", formData.prixAchatTTC);
            data.append("marge", formData.marge);
            data.append("prix", formData.prix);

            data.append("stock", formData.stock || "0");
            data.append("description", formData.description);
            data.append("marqueId", formData.marqueId);
            data.append("image", image);

            const response = await addPneu(data);

            console.log("Pneu ajouté :", response.data);

            if (response.data.success) {
                setSuccess("Pneu ajouté avec succès !");

                setFormData({ ...initialFormData });
                setImage(null);

                const imageInput = document.getElementById("image");
                if (imageInput) {
                    imageInput.value = "";
                }
            } else {
                setError(
                    response.data.message ||
                    "Erreur lors de l'ajout du pneu."
                );
            }
        } catch (err) {
            console.error("Erreur ajout pneu :", err);

            setError(
                err.response?.data?.message ||
                "Erreur lors de l'ajout du pneu."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ajouter-pneu-page">

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
                    <h1>Ajouter un pneu</h1>
                    <p>Ajouter un nouveau pneu au catalogue.</p>
                </div>
            </div>

            {error && (
                <div className="message-error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="message-success" role="status">
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
                            <label htmlFor="modele">Modèle *</label>
                            <input
                                id="modele"
                                type="text"
                                name="modele"
                                value={formData.modele}
                                onChange={handleChange}
                                placeholder="Ex : Primacy 4"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="marqueId">Marque *</label>
                            <select
                                id="marqueId"
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
                            <label htmlFor="dimension">Dimension *</label>
                            <input
                                id="dimension"
                                type="text"
                                name="dimension"
                                value={formData.dimension}
                                onChange={handleChange}
                                placeholder="Ex : 205/55 R16"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="saison">Saison *</label>
                            <select
                                id="saison"
                                name="saison"
                                value={formData.saison}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Sélectionner une saison</option>
                                <option value="Été">Été</option>
                                <option value="Hiver">Hiver</option>
                                <option value="4 saisons">4 saisons</option>
                            </select>
                        </div>

                    </div>
                </div>

                {/* DIMENSIONS TECHNIQUES */}
                <div className="form-section">
                    <h2>Dimensions techniques</h2>

                    <div className="form-grid three-columns">

                        <div className="form-group">
                            <label htmlFor="largeur">Largeur</label>
                            <input
                                id="largeur"
                                type="number"
                                name="largeur"
                                value={formData.largeur}
                                onChange={handleChange}
                                placeholder="Ex : 205"
                                min="0"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="hauteur">Hauteur</label>
                            <input
                                id="hauteur"
                                type="number"
                                name="hauteur"
                                value={formData.hauteur}
                                onChange={handleChange}
                                placeholder="Ex : 55"
                                min="0"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="diametre">Diamètre</label>
                            <input
                                id="diametre"
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
                    <h2>Informations tarifaires</h2>

                    <div className="form-grid">

                        <div className="form-group">
                            <label htmlFor="prixAchatHT">
                                Prix d'achat HT (DT) *
                            </label>
                            <input
                                id="prixAchatHT"
                                type="number"
                                name="prixAchatHT"
                                value={formData.prixAchatHT}
                                onChange={handleChange}
                                placeholder="Ex : 200"
                                min="0"
                                step="0.001"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="remiseFournisseur">
                                Remise fournisseur (%)
                            </label>
                            <input
                                id="remiseFournisseur"
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
                            <label htmlFor="tauxTVA">TVA (%)</label>
                            <input
                                id="tauxTVA"
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
                            <label htmlFor="prixAchatTTC">
                                Prix d'achat TTC (DT)
                            </label>
                            <input
                                id="prixAchatTTC"
                                type="number"
                                value={formData.prixAchatTTC}
                                readOnly
                                placeholder="Calcul automatique"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="marge">Marge (%)</label>
                            <input
                                id="marge"
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
                            <label htmlFor="prix">
                                Prix de vente TTC (DT)
                            </label>
                            <input
                                id="prix"
                                type="number"
                                value={formData.prix}
                                readOnly
                                placeholder="Calcul automatique"
                            />
                        </div>

                    </div>

                    <p className="tarif-info">
                        Le prix d'achat TTC et le prix de vente TTC
                        sont calculés automatiquement selon la remise,
                        la TVA et la marge.
                    </p>
                </div>

                {/* STOCK */}
                <div className="form-section">
                    <h2>Stock</h2>

                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="stock">Quantité en stock</label>
                            <input
                                id="stock"
                                type="number"
                                name="stock"
                                value={formData.stock}
                                onChange={handleChange}
                                placeholder="Ex : 10"
                                min="0"
                            />
                        </div>
                    </div>
                </div>

                {/* DESCRIPTION */}
                <div className="form-section">
                    <h2>Description</h2>

                    <div className="form-group">
                        <label htmlFor="description">
                            Description du pneu
                        </label>
                        <textarea
                            id="description"
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

                    <div className="image-upload">
                        <FaImage />

                        <label htmlFor="image">
                            Choisir une image
                        </label>

                        <input
                            id="image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            required
                        />

                        {image && (
                            <p>
                                Image sélectionnée :
                                <strong> {image.name}</strong>
                            </p>
                        )}
                    </div>
                </div>

                {/* ACTIONS */}
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
                        disabled={loading || loadingMarques}
                    >
                        <FaSave />
                        {loading
                            ? "Enregistrement..."
                            : "Ajouter le pneu"}
                    </button>
                </div>

            </form>
        </div>
    );
}

export default AjouterPneu;
