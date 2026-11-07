
import axios from "axios";
import { API_URL } from "../config";

const apiURL = `${API_URL}/compatibilites`;

// Récupérer tous les véhicules identifiés par RegCheck
export const getAllVehiculesCompatibilites = () => {
    return axios.get(`${apiURL}/vehicules`, {
        withCredentials: true
    });
};

// Récupérer les pneus associés à un véhicule
export const getPneusByVehicule = (vehiculeId) => {
    return axios.get(`${apiURL}/vehicule/${vehiculeId}`, {
        withCredentials: true
    });
};

// Ajouter une compatibilité
export const ajouterCompatibilite = (vehiculeId, pneuId) => {
    return axios.post(
        apiURL,
        { vehiculeId, pneuId },
        { withCredentials: true }
    );
};

// Supprimer une compatibilité
export const supprimerCompatibilite = (vehiculeId, pneuId) => {
    return axios.delete(
        `${apiURL}/${vehiculeId}/${pneuId}`,
        { withCredentials: true }
    );
};
