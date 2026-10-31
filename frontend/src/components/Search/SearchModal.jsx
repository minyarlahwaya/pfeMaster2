
import "./SearchModal.css";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaTimes,
    FaRulerCombined,
    FaCar,
    FaTag,
    FaCloudSun,
    FaCamera
} from "react-icons/fa";

import SearchParDimension from "./SearchParDimension";
import SearchParMarque from "./SearchParMarque";
import SearchParSaison from "./SearchParSaison";
import SearchParImmatriculation from "./SearchParImmatriculation";


function SearchModal({ onClose }) {

    const [searchType, setSearchType] = useState("menu");

    const navigate = useNavigate();

    const ouvrirRecherchePhoto = () => {
        onClose();
        navigate("/recherche/photo");
    };


    return (

        <div
            className="search-overlay"
            onClick={onClose}
        >

            <div
                className="search-modal"
                onClick={(e) => e.stopPropagation()}
            >


                {/* =========================
                    PAR DIMENSION
                ========================= */}

                {searchType === "dimension" && (

                    <SearchParDimension
                        onBack={() => setSearchType("menu")}
                        onClose={onClose}
                    />

                )}


                {/* =========================
                    PAR IMMATRICULATION
                ========================= */}

                {searchType === "immatriculation" && (

                    <SearchParImmatriculation
                        onBack={() => setSearchType("menu")}
                        onClose={onClose}
                    />

                )}


                {/* =========================
                    PAR MARQUE
                ========================= */}

                {searchType === "marque" && (

                    <SearchParMarque
                        onBack={() => setSearchType("menu")}
                        onClose={onClose}
                    />

                )}


                {/* =========================
                    PAR SAISON
                ========================= */}

                {searchType === "saison" && (

                    <SearchParSaison
                        onBack={() => setSearchType("menu")}
                        onClose={onClose}
                    />

                )}


                {/* =========================
                    MENU PRINCIPAL
                ========================= */}

                {searchType === "menu" && (

                    <>

                        {/* En-tête */}

                        <div className="search-modal-header">

                            <h2>
                                Rechercher mes pneus auto
                            </h2>


                            <button
                                className="search-close"
                                onClick={onClose}
                                aria-label="Fermer"
                            >

                                <FaTimes />

                            </button>

                        </div>


                        {/* Méthodes de recherche */}

                        <div className="search-options">


                            {/* =========================
                                PAR DIMENSION
                            ========================= */}

                            <button
                                type="button"
                                className="search-option"
                                onClick={() =>
                                    setSearchType("dimension")
                                }
                            >

                                <div className="search-option-icon">

                                    <FaRulerCombined />

                                </div>


                                <div className="search-option-content">

                                    <h3>
                                        Par dimension
                                    </h3>

                                    <p>
                                        Largeur, hauteur et diamètre
                                    </p>

                                </div>


                                <span className="search-option-arrow">
                                    ›
                                </span>

                            </button>


                            {/* =========================
                                PAR PHOTO DU PNEU
                            ========================= */}

                            <button
                                type="button"
                                className="search-option"
                                onClick={ouvrirRecherchePhoto}
                            >

                                <div className="search-option-icon">

                                    <FaCamera />

                                </div>


                                <div className="search-option-content">

                                    <h3>
                                        Par photo du pneu
                                    </h3>

                                    <p>
                                        Photographiez votre pneu usé, nous trouvons l'équivalent neuf
                                    </p>

                                </div>


                                <span className="search-option-arrow">
                                    ›
                                </span>

                            </button>


                            {/* =========================
                                PAR IMMATRICULATION
                            ========================= */}

                            <button
                                type="button"
                                className="search-option"
                                onClick={() =>
                                    setSearchType("immatriculation")
                                }
                            >

                                <div className="search-option-icon">

                                    <FaCar />

                                </div>


                                <div className="search-option-content">

                                    <h3>
                                        Par immatriculation
                                    </h3>

                                    <p>
                                        Trouvez les pneus adaptés à votre véhicule
                                    </p>

                                </div>


                                <span className="search-option-arrow">
                                    ›
                                </span>

                            </button>


                            {/* =========================
                                PAR MARQUE
                            ========================= */}

                            <button
                                type="button"
                                className="search-option"
                                onClick={() =>
                                    setSearchType("marque")
                                }
                            >

                                <div className="search-option-icon">

                                    <FaTag />

                                </div>


                                <div className="search-option-content">

                                    <h3>
                                        Par marque
                                    </h3>

                                    <p>
                                        Découvrez les pneus par marque
                                    </p>

                                </div>


                                <span className="search-option-arrow">
                                    ›
                                </span>

                            </button>


                            {/* =========================
                                PAR SAISON
                            ========================= */}

                            <button
                                type="button"
                                className="search-option"
                                onClick={() =>
                                    setSearchType("saison")
                                }
                            >

                                <div className="search-option-icon">

                                    <FaCloudSun />

                                </div>


                                <div className="search-option-content">

                                    <h3>
                                        Par saison
                                    </h3>

                                    <p>
                                        Été, hiver ou 4 saisons
                                    </p>

                                </div>


                                <span className="search-option-arrow">
                                    ›
                                </span>

                            </button>


                        </div>

                    </>

                )}

            </div>

        </div>

    );

}


export default SearchModal;

