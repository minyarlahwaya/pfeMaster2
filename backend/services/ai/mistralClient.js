// =====================================================
// Client Mistral centralisé (API Chat Completions)
// =====================================================
// - La clé ne quitte jamais le serveur et n'est jamais journalisée.
// - Délai d'expiration, une nouvelle tentative sur 429/5xx.
// - Utilise fetch (Node >= 20) : aucune dépendance supplémentaire.

const config = require("../../config");

class AiServiceError extends Error {
    constructor(message, { code = "AI_ERROR", status = 503 } = {}) {
        super(message);
        this.name = "AiServiceError";
        this.code = code;
        this.status = status;
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createMistralClient(options = {}) {
    const settings = { ...config.mistral, ...options };
    const fetchImpl = options.fetchImpl || globalThis.fetch;

    const isConfigured = () => Boolean(settings.apiKey);

    async function callOnce(body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), settings.timeoutMs);

        try {
            const res = await fetchImpl(`${settings.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            if (!res.ok) {
                const err = new AiServiceError(`Mistral HTTP ${res.status}`, {
                    code: res.status === 429 ? "AI_RATE_LIMITED" : "AI_HTTP_ERROR",
                    status: res.status === 429 ? 429 : 503
                });
                err.retryable = res.status === 429 || res.status >= 500;
                throw err;
            }

            let data;
            try {
                data = await res.json();
            } catch {
                throw new AiServiceError("Réponse Mistral illisible", { code: "AI_BAD_RESPONSE" });
            }

            const message = data && data.choices && data.choices[0] && data.choices[0].message;
            if (!message) {
                throw new AiServiceError("Réponse Mistral sans message", { code: "AI_BAD_RESPONSE" });
            }
            return message;

        } catch (error) {
            if (error instanceof AiServiceError) throw error;
            const err = new AiServiceError(
                error.name === "AbortError" ? "Délai Mistral dépassé" : "Mistral injoignable",
                { code: error.name === "AbortError" ? "AI_TIMEOUT" : "AI_NETWORK" }
            );
            err.retryable = true;
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * @param {{messages: object[], tools?: object[], temperature?: number, maxTokens?: number,
     *          model?: string, responseFormat?: object}} req
     *   model : autre modèle que celui par défaut (ex. lecture d'image)
     *   responseFormat : ex. { type: "json_object" } pour imposer une réponse JSON
     * @returns {Promise<{role: string, content: string|null, tool_calls?: object[]}>}
     */
    async function chat({ messages, tools, temperature = 0.2, maxTokens = 900, model, responseFormat }) {
        if (!isConfigured()) {
            throw new AiServiceError("Assistant IA non configuré", { code: "AI_NOT_CONFIGURED" });
        }

        const body = {
            model: model || settings.model,
            messages,
            temperature,
            max_tokens: maxTokens
        };
        if (responseFormat) body.response_format = responseFormat;
        if (tools && tools.length) {
            body.tools = tools;
            body.tool_choice = "auto";
        }

        try {
            return await callOnce(body);
        } catch (error) {
            if (!error.retryable) throw error;
            console.warn(`⚠️ Mistral : ${error.code}, nouvelle tentative.`);
            await sleep(800);
            return callOnce(body);
        }
    }

    return { chat, isConfigured, model: settings.model };
}

// Instance partagée par les contrôleurs
const defaultClient = createMistralClient();

module.exports = { createMistralClient, defaultClient, AiServiceError };
