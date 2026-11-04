import { useEffect, useState } from "react";
import { FaArchive, FaUndo, FaSearch, FaBoxOpen } from "react-icons/fa";

import {
    getArchivedPneus,
    restorePneu
} from "../../services/pneuApi";

import { API_URL } from "../../config";

import "./AdminPneusArchives.css";

function AdminPneusArchives() {

    const [pneus, setPneus] = useState([]);
    const [recherche, setRecherche] = useState("");
    const [chargement, setChargement] = useState(true);
    const [restaurationId, setRestaurationId] = useState(null);
    const [erreur, setErreur] = useState("");
    const [message, setMessage] = useState("");

    // ========================================
    // CHARGER LES PNEUS ARCHIVÉS
    // ========================================

    const chargerPneusArchives = async () => {
        try {
            setChargement(true);
            setErreur("");

            const response = await getArchivedPneus();

            if (response.data.success) {
                setPneus(response.data.pneus || []);
            } else {
                setErreur("Impossible de récupérer les pneus archivés.");
            }

        } catch (error) {
            console.error("Erreur chargement pneus archivés :", error);

            setErreur(
                error.response?.data?.message ||
                "Une erreur est survenue lors du chargement."
            );
        } finally {
            setChargement(false);
        }
    };

    useEffect(() => {
        chargerPneusArchives();
    }, []);

    // ========================================
    // RESTAURER UN PNEU
    // ========================================

    const handleRestaurer = async (id) => {

        const confirmation = window.confirm(
            "Voulez-vous vraiment restaurer ce pneu ?"
        );

        if (!confirmation) return;

        try {
            setRestaurationId(id);
            setErreur("");
            setMessage("");

            const response = await restorePneu(id);

            if (response.data.success) {

                // Retirer le pneu de la liste des archives
                setPneus((anciensPneus) =>
                    anciensPneus.filter((pneu) => pneu.id !== id)
                );

                setMessage(
                    response.data.message ||
                    "Pneu restauré avec succès."
                );
            }

        } catch (error) {
            console.error("Erreur restauration pneu :", error);

            setErreur(
                error.response?.data?.message ||
                "Impossible de restaurer ce pneu."
            );
        } finally {
            setRestaurationId(null);
        }
    };

    // ========================================
    // RECHERCHE
    // ========================================

    const normaliser = (texte) =>
        (texte || "")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

    const pneusFiltres = pneus.filter((pneu) => {

        const marque =
            pneu.marque?.nom ||
            pneu.Marque?.nom ||
            "";

        const informations = [
            marque,
            pneu.modele,
            pneu.dimension,
            pneu.saison,
            pneu.largeur,
            pneu.hauteur,
            pneu.diametre
        ];

        return informations.some((information) =>
            normaliser(information).includes(normaliser(recherche))
        );
    });

    // ========================================
    // IMAGE DU PNEU
    // ========================================

    const getImageUrl = (image) => {

        if (!image) return null;

        if (image.startsWith("http://") || image.startsWith("https://")) {
            return image;
        }

        return `${API_URL}/uploadPneu/${image}`;
    };

    // ========================================
    // AFFICHAGE
    // ========================================

    return (
        <div className="admin-archives-container">

            <div className="archives-header">

                <div>
                    <h1>
                        <FaArchive /> Pneus archivés
                    </h1>

                    <p>
                        Consultez les pneus archivés et restaurez-les si nécessaire.
                    </p>
                </div>

                <div className="archives-counter">
                    <FaBoxOpen />
                    <span>{pneus.length} pneu(x) archivé(s)</span>
                </div>

            </div>

            {/* MESSAGES */}

            {message && (
                <div className="archives-message success">
                    {message}
                </div>
            )}

            {erreur && (
                <div className="archives-message error">
                    {erreur}
                </div>
            )}

            {/* RECHERCHE */}

            <div className="archives-search">
                <FaSearch />

                <input
                    type="text"
                    placeholder="Rechercher par marque, modèle, dimension..."
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                />
            </div>

            {/* CHARGEMENT */}

            {chargement ? (

                <div className="archives-loading">
                    Chargement des pneus archivés...
                </div>

            ) : pneusFiltres.length === 0 ? (

                <div className="archives-empty">
                    <FaArchive />

                    <h3>
                        {pneus.length === 0
                            ? "Aucun pneu archivé"
                            : "Aucun résultat trouvé"}
                    </h3>

                    <p>
                        {pneus.length === 0
                            ? "Les pneus archivés apparaîtront ici."
                            : "Essayez avec un autre terme de recherche."}
                    </p>
                </div>

            ) : (

                <div className="archives-table-wrapper">

                    <table className="archives-table">

                        <thead>
                            <tr>
                                <th>Image</th>
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

                            {pneusFiltres.map((pneu) => {

                                const marque =
                                    pneu.marque?.nom ||
                                    pneu.Marque?.nom ||
                                    "Non renseignée";

                                const imageUrl = getImageUrl(pneu.image);

                                return (
                                    <tr key={pneu.id}>

                                        <td>
                                            {imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={pneu.modele || "Pneu"}
                                                    className="archives-pneu-image"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="archives-no-image">
                                                    <FaBoxOpen />
                                                </div>
                                            )}
                                        </td>

                                        <td>{marque}</td>

                                        <td>{pneu.modele || "-"}</td>

                                        <td>{pneu.dimension || "-"}</td>

                                        <td>{pneu.saison || "-"}</td>

                                        <td>
                                            {pneu.prix != null
                                                ? `${pneu.prix} DT`
                                                : "-"}
                                        </td>

                                        <td>{pneu.stock ?? "-"}</td>

                                        <td>
                                            <button
                                                className="btn-restaurer-pneu"
                                                onClick={() => handleRestaurer(pneu.id)}
                                                disabled={restaurationId === pneu.id}
                                            >
                                                <FaUndo />

                                                {restaurationId === pneu.id
                                                    ? "Restauration..."
                                                    : "Restaurer"}
                                            </button>
                                        </td>

                                    </tr>
                                );
                            })}

                        </tbody>

                    </table>

                </div>
            )}

        </div>
    );
}

export default AdminPneusArchives;