
import { API_URL } from "../config";
import axios from "axios";

const apiURL = `${API_URL}/avis`;

// Ajouter un avis
export const createAvis = async (avisData) => {
    const response = await axios.post(apiURL, avisData, {
        withCredentials: true
    });
    return response.data;
};

// Récupérer tous les avis
// Récupérer les avis publics
export const getAllAvis = async () => {
    const response = await axios.get(`${apiURL}/public`);
    return response.data;
};

// Récupérer les avis d'une commande
export const getAvisByCommande = async (commandeId) => {
    const response = await axios.get(
        `${apiURL}/commande/${commandeId}`,
        { withCredentials: true }
    );
    return response.data;
};

// Récupérer les avis d'un pneu
export const getAvisByPneu = async (pneuId) => {
    const response = await axios.get(
        `${apiURL}/pneu/${pneuId}`,
        { withCredentials: true }
    );
    return response.data;
};

// Aimer ou retirer son like
export const toggleLikeAvis = async (avisId) => {
    const response = await axios.post(
        `${apiURL}/${avisId}/like`,
        {},
        { withCredentials: true }
    );
    return response.data;
};

// Ajouter une réponse à un avis
export const ajouterReponseAvis = async (avisId, contenu) => {
    const response = await axios.post(
        `${apiURL}/${avisId}/reponses`,
        { contenu },
        { withCredentials: true }
    );
    return response.data;
};

// Modifier une réponse
export const modifierReponseAvis = async (reponseId, contenu) => {
    const response = await axios.put(
        `${apiURL}/reponses/${reponseId}`,
        { contenu },
        { withCredentials: true }
    );
    return response.data;
};

// Supprimer une réponse
export const supprimerReponseAvis = async (reponseId) => {
    const response = await axios.delete(
        `${apiURL}/reponses/${reponseId}`,
        { withCredentials: true }
    );
    return response.data;
};

// Modifier son avis
export const modifierAvis = async (avisId, avisData) => {
    const response = await axios.put(
        `${apiURL}/${avisId}`,
        avisData,
        { withCredentials: true }
    );
    return response.data;
};

// Supprimer un avis
export const deleteAvis = async (avisId) => {
    const response = await axios.delete(
        `${apiURL}/${avisId}`,
        { withCredentials: true }
    );
    return response.data;
};
