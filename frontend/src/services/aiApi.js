import { API_URL } from "../config";

// Appels aux assistants IA. fetch + cookie de session : pas de redirection
// automatique vers /login (les visiteurs peuvent utiliser le conseiller).
// La clé Mistral reste côté serveur : elle n'apparaît jamais ici.

async function postChat(path, message, history) {
    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history })
        });
    } catch {
        throw new Error("Connexion au serveur impossible. Vérifiez votre réseau.");
    }
    let data = {};
    try {
        data = await response.json();
    } catch {
        // réponse non JSON
    }
    if (!response.ok || !data.success) {
        const error = new Error(data.message || "L'assistant est momentanément indisponible.");
        error.status = response.status;
        throw error;
    }
    return data;
}

export const chatTireAdvisor = (message, history) => postChat("/ai/tire-advisor/chat", message, history);
export const chatSupport = (message, history) => postChat("/ai/support/chat", message, history);
export const chatAnalytics = (message, history) => postChat("/ai/admin/analytics/chat", message, history);

export async function getAnalyticsKpis() {
    const response = await fetch(`${API_URL}/ai/admin/analytics/kpis`, { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        const error = new Error(data.message || "Indicateurs indisponibles.");
        error.status = response.status;
        throw error;
    }
    return data;
}

// Création réelle d'une réclamation (route existante), après confirmation du client
export async function sendReclamation({ sujet, description }) {
    const response = await fetch(`${API_URL}/reclamations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujet, description })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || "Envoi de la réclamation impossible.");
        error.status = response.status;
        throw error;
    }
    return data;
}

// Historique transmis au serveur : texte seulement, 12 derniers messages
export const toHistory = (messages) => messages
    .filter((m) => !m.error && !m.local)
    .slice(-12)
    .map((m) => ({ role: m.type === "user" ? "user" : "assistant", content: m.text }));

// ========================================
// Recherche de pneus par photo
// ========================================

async function readJson(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        const error = new Error(data.message || fallback);
        error.status = response.status;
        throw error;
    }
    return data;
}

// Envoi de la photo (multipart, champ « photo »). Le navigateur fixe lui-même
// l'en-tête Content-Type avec la frontière multipart : ne pas le définir ici.
export async function analyzeTirePhoto(blob, filename = "pneu.jpg") {
    const form = new FormData();
    form.append("photo", blob, filename);
    let response;
    try {
        response = await fetch(`${API_URL}/ai/tire-photo/analyze`, {
            method: "POST",
            credentials: "include",
            body: form
        });
    } catch {
        throw new Error("Connexion au serveur impossible. Vérifiez votre réseau.");
    }
    return readJson(response, "L'analyse de la photo est momentanément indisponible.");
}

// Relance de la recherche après correction par le client (sans IA)
export async function matchTirePhoto({ dimension, marque, modele }) {
    let response;
    try {
        response = await fetch(`${API_URL}/ai/tire-photo/match`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dimension, marque, modele })
        });
    } catch {
        throw new Error("Connexion au serveur impossible. Vérifiez votre réseau.");
    }
    return readJson(response, "Recherche impossible.");
}
