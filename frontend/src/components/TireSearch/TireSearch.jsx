
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCamera, FaSearch } from "react-icons/fa";

import { getAllPneus } from "../../services/pneuApi";
import "./TireSearch.css";

function TireSearch() {
  const navigate = useNavigate();

  const [pneus, setPneus] = useState([]);
  const [marqueId, setMarqueId] = useState("");
  const [dimension, setDimension] = useState("");
  const [saison, setSaison] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const chargerPneus = async () => {
      try {
        const response = await getAllPneus();
        setPneus(response.data.pneus || []);
      } catch (error) {
        console.error("Erreur de chargement des pneus :", error);
        setErreur("Impossible de charger les filtres.");
      }
    };

    chargerPneus();
  }, []);

  // Récupérer les marques disponibles
  const marques = [
    ...new Map(
      pneus
        .filter((pneu) => pneu.marque)
        .map((pneu) => [
          pneu.marque.id,
          pneu.marque,
        ])
    ).values(),
  ];

  // Récupérer les dimensions réellement disponibles
  const dimensions = [
    ...new Set(
      pneus
        .map((pneu) => pneu.dimension)
        .filter(Boolean)
    ),
  ];

  // Récupérer les saisons disponibles
  const saisons = [
    ...new Set(
      pneus
        .map((pneu) => pneu.saison)
        .filter(Boolean)
    ),
  ];

  const rechercher = (event) => {
    event.preventDefault();

    const params = new URLSearchParams();

    if (marqueId) params.set("marqueId", marqueId);
    if (dimension) params.set("dimension", dimension);
    if (saison) params.set("saison", saison);

    navigate(`/pneus?${params.toString()}`);
  };

  return (
    <section className="tire-search">
      <div className="search-container">
        <h2>
          Trouvez les pneus adaptés à votre véhicule
        </h2>

        <p>
          Recherchez facilement vos pneus par marque,
          dimension et saison.
        </p>

        {erreur && (
          <p className="search-error">{erreur}</p>
        )}

        <form className="search-box" onSubmit={rechercher}>
          <select
            value={marqueId}
            onChange={(e) => setMarqueId(e.target.value)}
          >
            <option value="">Toutes les marques</option>

            {marques.map((marque) => (
              <option key={marque.id} value={marque.id}>
                {marque.nom}
              </option>
            ))}
          </select>

          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
          >
            <option value="">Toutes les dimensions</option>

            {dimensions.map((dim) => (
              <option key={dim} value={dim}>
                {dim}
              </option>
            ))}
          </select>

          <select
            value={saison}
            onChange={(e) => setSaison(e.target.value)}
          >
            <option value="">Toutes les saisons</option>

            {saisons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button type="submit" className="btn-search">
            <FaSearch />
            Rechercher
          </button>
        </form>

        <Link to="/recherche/photo" className="search-photo-link">
          <FaCamera />
          Vous ne connaissez pas la dimension ? Trouvez vos pneus à partir d'une photo
        </Link>
      </div>
    </section>
  );
}

export default TireSearch;
