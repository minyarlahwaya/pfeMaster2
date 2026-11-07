
import "./SearchParDimension.css";
import { useNavigate } from "react-router-dom";

import {
    FaTimes,
    FaArrowLeft,
    FaSearch
} from "react-icons/fa";

import { useState, useEffect } from "react";

import {
    getLargeurs,
    getHauteurs,
    getDiametres
} from "../../services/pneuApi";

function SearchParDimension({ onBack, onClose }) {

    const navigate = useNavigate();

    // Dimensions saisies par le client
    const [width, setWidth] = useState("");
    const [height, setHeight] = useState("");
    const [diameter, setDiameter] = useState("");

    // Suggestions provenant de la base de données
    const [widths, setWidths] = useState([]);
    const [heights, setHeights] = useState([]);
    const [diameters, setDiameters] = useState([]);

    // =====================================
    // Charger les largeurs disponibles
    // =====================================

    useEffect(() => {

        const loadLargeurs = async () => {
            try {
                const response = await getLargeurs();

                setWidths(response.data.largeurs || []);

            } catch (error) {
                console.error("Erreur chargement largeurs :", error);
            }
        };

        loadLargeurs();

    }, []);

    // =====================================
    // Charger les hauteurs selon largeur
    // =====================================

    useEffect(() => {

        const valeur = width.trim().replace(",", ".");

        if (!valeur || !Number.isFinite(Number(valeur)) || Number(valeur) <= 0) {
            setHeights([]);
            return;
        }

        let cancelled = false;

        const loadHauteurs = async () => {
            try {
                const response = await getHauteurs(valeur);

                if (!cancelled) {
                    setHeights(response.data.hauteurs || []);
                }

            } catch (error) {
                if (!cancelled) {
                    console.error("Erreur chargement hauteurs :", error);
                    setHeights([]);
                }
            }
        };

        loadHauteurs();

        return () => {
            cancelled = true;
        };

    }, [width]);

    // =====================================
    // Charger les diamètres
    // selon largeur + hauteur
    // =====================================

    useEffect(() => {

        const largeur = width.trim().replace(",", ".");
        const hauteur = height.trim().replace(",", ".");

        if (
            !largeur ||
            !hauteur ||
            !Number.isFinite(Number(largeur)) ||
            !Number.isFinite(Number(hauteur)) ||
            Number(largeur) <= 0 ||
            Number(hauteur) <= 0
        ) {
            setDiameters([]);
            return;
        }

        let cancelled = false;

        const loadDiametres = async () => {
            try {
                const response = await getDiametres(
                    largeur,
                    hauteur
                );

                if (!cancelled) {
                    setDiameters(response.data.diametres || []);
                }

            } catch (error) {
                if (!cancelled) {
                    console.error("Erreur chargement diamètres :", error);
                    setDiameters([]);
                }
            }
        };

        loadDiametres();

        return () => {
            cancelled = true;
        };

    }, [width, height]);

    // =====================================
    // Recherche des pneus
    // =====================================

    const handleSearch = () => {

        const largeur = width.trim().replace(",", ".");
        const hauteur = height.trim().replace(",", ".");
        const diametre = diameter.trim().replace(",", ".");

        if (!largeur && !hauteur && !diametre) {
            alert("Veuillez saisir au moins une dimension.");
            return;
        }

        // Vérifier les valeurs saisies
        const dimensions = [
            { nom: "Largeur", valeur: largeur },
            { nom: "Hauteur", valeur: hauteur },
            { nom: "Diamètre", valeur: diametre }
        ];

        for (const dimension of dimensions) {

            if (
                dimension.valeur &&
                (
                    !Number.isFinite(Number(dimension.valeur)) ||
                    Number(dimension.valeur) <= 0
                )
            ) {
                alert(`${dimension.nom} doit être un nombre positif.`);
                return;
            }
        }

        // Construire les paramètres de recherche
        const params = new URLSearchParams();

        if (largeur) params.set("largeur", largeur);
        if (hauteur) params.set("hauteur", hauteur);
        if (diametre) params.set("diametre", diametre);

        navigate(`/recherche-pneus?${params.toString()}`);

        onClose();

    };

    return (
        <>
            {/* Header */}

            <div className="dimension-header">

                <div className="dimension-header-left">

                    <button
                        className="dimension-back"
                        onClick={onBack}
                        aria-label="Retour"
                    >
                        <FaArrowLeft />
                    </button>

                    <h2>Par dimension</h2>

                </div>

                <button
                    className="dimension-close"
                    onClick={onClose}
                    aria-label="Fermer"
                >
                    <FaTimes />
                </button>

            </div>

            {/* Description */}

            <p className="dimension-description">
                Sélectionnez une dimension proposée ou saisissez
                directement les dimensions de votre pneu.
            </p>

            {/* Formulaire */}

            <div className="dimension-form">

                {/* Largeur */}

                <div className="dimension-field">

                    <label htmlFor="width">Largeur</label>

                    <input
                        type="text"
                        inputMode="decimal"
                        id="width"
                        list="largeurs-list"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        placeholder="Ex : 205"
                        autoComplete="off"
                    />

                    <datalist id="largeurs-list">
                        {widths.map((value) => (
                            <option key={value} value={value} />
                        ))}
                    </datalist>

                </div>

                {/* Hauteur */}

                <div className="dimension-field">

                    <label htmlFor="height">Hauteur</label>

                    <input
                        type="text"
                        inputMode="decimal"
                        id="height"
                        list="hauteurs-list"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="Ex : 55"
                        autoComplete="off"
                    />

                    <datalist id="hauteurs-list">
                        {heights.map((value) => (
                            <option key={value} value={value} />
                        ))}
                    </datalist>

                </div>

                {/* Diamètre */}

                <div className="dimension-field">

                    <label htmlFor="diameter">Diamètre</label>

                    <input
                        type="text"
                        inputMode="decimal"
                        id="diameter"
                        list="diametres-list"
                        value={diameter}
                        onChange={(e) => setDiameter(e.target.value)}
                        placeholder="Ex : 16"
                        autoComplete="off"
                    />

                    <datalist id="diametres-list">
                        {diameters.map((value) => (
                            <option key={value} value={value} />
                        ))}
                    </datalist>

                </div>

            </div>

            {/* Dimension sélectionnée */}

            {(width || height || diameter) && (

                <div className="dimension-preview">

                    <span>Dimension recherchée :</span>

                    <strong>
                        {width || "—"} / {height || "—"} R{diameter || "—"}
                    </strong>

                </div>

            )}

            {/* Bouton recherche */}

            <button
                className="dimension-search-button"
                onClick={handleSearch}
            >

                <FaSearch />

                Rechercher mes pneus

            </button>

        </>
    );
}

export default SearchParDimension;
