
import axios from "axios";
import { API_URL } from "../config";

const apiURL = `${API_URL}/pneus`;

//import api from "./api";


// ==============================
// Récupérer tous les pneus
// ==============================

export const getAllPneus = () => {

    return axios.get(`${apiURL}/getallpneus`);

};


// ==============================
// Récupérer un pneu par son id
// ==============================

export const getPneuById = (id) => {

    return axios.get(`${apiURL}/${id}`);

};


// ==============================
// Rechercher pneus par dimension
// ==============================

export const searchPneusByDimension = (
    largeur,
    hauteur,
    diametre
) => {

    const params = {};


    // Largeur
    if (largeur) {

        params.largeur = largeur;

    }


    // Hauteur
    if (hauteur) {

        params.hauteur = hauteur;

    }


    // Diamètre
    if (diametre) {

        params.diametre = diametre;

    }


    return axios.get(
        `${apiURL}/search/dimension`,
        {
            params
        }
    );

};


// ==============================
// Ajouter un pneu (Admin)
// ==============================

export const addPneu = (formData) => {

    return axios.post(
        apiURL,
        formData,
        {

            headers: {

                "Content-Type": "multipart/form-data"

            },

            withCredentials: true

        }
    );

};


// ==============================
// Modifier un pneu
// ==============================

export const updatePneu = (id, formData) => {

    return axios.put(
        `${apiURL}/${id}`,
        formData,
        {

            headers: {

                "Content-Type": "multipart/form-data"

            },

            withCredentials: true

        }
    );

};


// ==============================
// Supprimer un pneu
// ==============================

export const deletePneu = (id) => {

    return axios.delete(
        `${apiURL}/${id}`,
        {

            withCredentials: true

        }
    );

};


export const getLargeurs = () => {

    return axios.get(
        `${apiURL}/dimensions/largeurs`
    );

};
// Récupérer les hauteurs disponibles selon la largeur
export const getHauteurs = (largeur) => {

    return axios.get(
        `${apiURL}/dimensions/hauteurs`,
        {
            params: {
                largeur
            }
        }
    );

};
export const getDiametres = (largeur, hauteur) => {

    return axios.get(
        `${apiURL}/dimensions/diametres`,
        {
            params: {
                largeur,
                hauteur
            }
        }
    );

};

export const searchPneusBySaison = (saison) => 
    { return axios.get( `${apiURL}/search/saison/${encodeURIComponent(saison)}` ); };

// ==============================
// Rechercher pneus par immatriculation
// ==============================

export const searchVehiculeByImmatriculation = (immatriculation) => {

    return axios.get(
        `${API_URL}/vehicules/immatriculation/${encodeURIComponent(
            immatriculation
        )}`
    );

};


// ==============================
// Importer des pneus depuis Excel
// ==============================
// Importer des pneus depuis Excel
// ==============================

export const importPneusExcel = (formData, dryRun = false) => {

    return axios.post(
        `${apiURL}/import-excel?dryRun=${dryRun}`,
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data"
            },
            withCredentials: true
        }
    );

};

// ========================================
// Récupérer les pneus archivés (ADMIN)
// ========================================

export const getArchivedPneus = () => {
    return axios.get(
        `${apiURL}/archives`,
        {
            withCredentials: true
        }
    );
};


// ========================================
// Restaurer un pneu archivé (ADMIN)
// ========================================

export const restorePneu = (id) => {
    return axios.put(
        `${apiURL}/restore/${id}`,
        {},
        {
            withCredentials: true
        }
    );
};