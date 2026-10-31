// Tests de la recherche de pneus par photo : modèle de vision et base SIMULÉS.
// Aucun appel réseau, aucune base requise, aucun crédit Mistral consommé.
//   node --test test/tire-photo.test.js
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");

const createAiRouter = require("../routes/aiRoutes");
const { createTirePhotoController } = require("../controllers/TirePhotoController");
const { AiServiceError } = require("../services/ai/mistralClient");
const {
    detectImageType, parseVisionJson, normalizeReading, parseDot, matchBrand, findMatchingTires
} = require("../services/ai/tirePhoto");

// ---------------------------------------------------------------
// Données simulées
// ---------------------------------------------------------------
const TIRES = [
    { id: 1, marque: "Michelin", modele: "Primacy 4", dimension: "205/55 R16", largeur: 205, hauteur: 55, diametre: 16, saison: "Été", prix: 320, prixPromo: null, pourcentagePromotion: 0, stock: 8, image: "a.png" },
    { id: 2, marque: "Sailun", modele: "Atrezzo", dimension: "205/55 R16", largeur: 205, hauteur: 55, diametre: 16, saison: "Été", prix: 180, prixPromo: 162, pourcentagePromotion: 10, stock: 20, image: "b.png" },
    { id: 3, marque: "Michelin", modele: "Energy Saver", dimension: "205/55 R16", largeur: 205, hauteur: 55, diametre: 16, saison: "Été", prix: 300, prixPromo: null, pourcentagePromotion: 0, stock: 0, image: "c.png" },
    { id: 4, marque: "Hankook", modele: "Kinergy", dimension: "195/65 R15", largeur: 195, hauteur: 65, diametre: 15, saison: "4 saisons", prix: 210, prixPromo: null, pourcentagePromotion: 0, stock: 3, image: "d.png" },
    // Fiche incohérente : étiquette 205/55 R16 mais colonnes 195/65/15 -> jamais proposée
    { id: 5, marque: "Pirelli", modele: "Cinturato", dimension: "205/55 R16", largeur: 205, hauteur: 55, diametre: 15, saison: "Été", prix: 250, prixPromo: null, pourcentagePromotion: 0, stock: 5, image: "e.png" }
];
const BRANDS = ["Hankook", "Michelin", "Pirelli", "Sailun"];

function makeRepo() {
    return {
        calls: [],
        async listBrands() { return BRANDS; },
        async searchTires(f) {
            this.calls.push(f);
            return TIRES.filter((t) => (!f.largeur || t.largeur === f.largeur) && (!f.hauteur || t.hauteur === f.hauteur) &&
                (!f.diametre || t.diametre === f.diametre) && (!f.marque || t.marque.toLowerCase() === f.marque.toLowerCase()));
        }
    };
}

// Client de vision scripté : renvoie le JSON prévu et mémorise la requête
function visionClient(reply, { configured = true } = {}) {
    const seen = [];
    return {
        seen,
        isConfigured: () => configured,
        async chat(req) {
            seen.push(req);
            if (reply instanceof Error) throw reply;
            return { role: "assistant", content: typeof reply === "string" ? reply : JSON.stringify(reply) };
        }
    };
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]);

const READING_OK = {
    est_un_pneu: true,
    marque: "MICHELIN", marque_confiance: "haute",
    modele: "PRIMACY 4", modele_confiance: "haute",
    dimension: "205/55R16", dimension_confiance: "haute",
    indice_charge: 91, indice_vitesse: "v",
    marquage_m_s: false, marquage_3pmsf: false,
    dot: "2318", texte_lu: "MICHELIN PRIMACY 4 205/55 R16 91V", probleme_photo: null
};

async function startServer(photoController) {
    const app = express();
    app.use(express.json());
    const unused = (req, res) => res.status(500).end();
    const controller = { tireAdvisorChat: unused, supportChat: unused, analyticsChat: unused, analyticsKpis: unused };
    app.use("/ai", createAiRouter({ controller, photoController, admin: (q, s, n) => n() }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    return { server, url: `http://127.0.0.1:${server.address().port}` };
}

function uploadPhoto(url, buffer, type = "image/jpeg", name = "pneu.jpg") {
    const form = new FormData();
    if (buffer) form.append("photo", new Blob([buffer], { type }), name);
    return fetch(`${url}/ai/tire-photo/analyze`, { method: "POST", body: form });
}

// ---------------------------------------------------------------
// Lecture et validation
// ---------------------------------------------------------------
describe("lecture de la photo", () => {
    test("type d'image par signature binaire, pas par extension", () => {
        assert.strictEqual(detectImageType(JPEG), "image/jpeg");
        assert.strictEqual(detectImageType(PNG), "image/png");
        assert.strictEqual(detectImageType(Buffer.from("RIFF0000WEBPVP8 ")), "image/webp");
        assert.strictEqual(detectImageType(Buffer.from("<script>alert(1)</script>")), null);
    });

    test("JSON du modèle extrait même entouré de ```json", () => {
        assert.deepStrictEqual(parseVisionJson("```json\n{\"a\":1}\n```"), { a: 1 });
        assert.strictEqual(parseVisionJson("je ne sais pas"), null);
        assert.strictEqual(parseVisionJson("[1,2]"), null);
    });

    test("lecture complète : dimension normalisée, marque du catalogue, indices validés", () => {
        const { reading, avertissements } = normalizeReading(READING_OK, BRANDS, new Date(Date.UTC(2026, 9, 31)));
        assert.deepStrictEqual(
            { l: reading.dimension.largeur, h: reading.dimension.hauteur, d: reading.dimension.diametre, t: reading.dimension.texte },
            { l: 205, h: 55, d: 16, t: "205/55 R16" });
        assert.strictEqual(reading.marque.catalogue, "Michelin");
        assert.strictEqual(reading.indiceCharge, 91);
        assert.strictEqual(reading.indiceVitesse, "V");
        assert.strictEqual(reading.dot.annee, 2018);
        assert.strictEqual(reading.dot.semaine, 23);
        // Pneu de 2018 : plus de 8 ans -> conseil de contrôle
        assert.ok(avertissements.some((a) => a.includes("DOT")));
    });

    test("dimension impossible rejetée (jamais de recherche sur une valeur inventée)", () => {
        for (const dim of ["207/55 R16", "205/57 R16", "205/55 R31", "999/99 R99", "205/55"]) {
            const { reading } = normalizeReading({ ...READING_OK, dimension: dim }, BRANDS);
            assert.strictEqual(reading.dimension, null, dim);
        }
        const { avertissements } = normalizeReading({ ...READING_OK, dimension: "207/55 R16" }, BRANDS);
        assert.ok(avertissements.some((a) => a.includes("207/55 R16")));
    });

    test("indices et DOT invalides ignorés ; DOT futur refusé", () => {
        const { reading } = normalizeReading({ ...READING_OK, indice_charge: 500, indice_vitesse: "X", dot: "6099" }, BRANDS);
        assert.strictEqual(reading.indiceCharge, null);
        assert.strictEqual(reading.indiceVitesse, null);
        assert.strictEqual(reading.dot, null);
        assert.strictEqual(parseDot("0130", new Date(Date.UTC(2026, 9, 31))), null);
        assert.strictEqual(parseDot("12"), null);
    });

    test("marque : correspondance tolérante mais aucune marque inventée", () => {
        assert.strictEqual(matchBrand("MICHELIN", BRANDS), "Michelin");
        assert.strictEqual(matchBrand("Pirelli P", BRANDS), "Pirelli");
        assert.strictEqual(matchBrand("Bridgestone", BRANDS), null);
        assert.strictEqual(matchBrand("", BRANDS), null);
    });

    test("texte lu nettoyé (balises retirées, longueur bornée)", () => {
        const { reading } = normalizeReading({ ...READING_OK, texte_lu: "<img src=x onerror=alert(1)>" + "A".repeat(500) }, BRANDS);
        assert.ok(!reading.texteLu.includes("<"));
        assert.ok(reading.texteLu.length <= 200);
    });
});

// ---------------------------------------------------------------
// Recherche dans le catalogue
// ---------------------------------------------------------------
describe("recherche des pneus correspondants", () => {
    test("même dimension : même modèle d'abord, puis même marque, puis le reste ; fiche incohérente exclue", async () => {
        const repo = makeRepo();
        const { mode, produits } = await findMatchingTires(repo, {
            dimension: { largeur: 205, hauteur: 55, diametre: 16 }, marque: "Michelin", modele: "PRIMACY 4"
        });
        assert.strictEqual(mode, "dimension");
        assert.deepStrictEqual(produits.map((p) => [p.id, p.correspondance]),
            [[1, "meme_modele"], [3, "meme_marque"], [2, "meme_dimension"]]);
        assert.ok(!produits.some((p) => p.id === 5));
        assert.strictEqual(produits[0].url, "/pneu/1");
    });

    test("sans marque : en stock d'abord, puis prix effectif (promotion incluse)", async () => {
        const { produits } = await findMatchingTires(makeRepo(), { dimension: { largeur: 205, hauteur: 55, diametre: 16 } });
        assert.deepStrictEqual(produits.map((p) => p.id), [2, 1, 3]);
    });

    test("marque sans dimension : pistes « dimension à vérifier » seulement", async () => {
        const { mode, produits } = await findMatchingTires(makeRepo(), { marque: "Michelin" });
        assert.strictEqual(mode, "marque");
        assert.ok(produits.length > 0);
        assert.ok(produits.every((p) => p.correspondance === "dimension_a_verifier"));
    });

    test("ni dimension ni marque : aucune proposition", async () => {
        const repo = makeRepo();
        const r = await findMatchingTires(repo, {});
        assert.deepStrictEqual(r, { mode: "aucun", produits: [] });
        assert.strictEqual(repo.calls.length, 0);
    });
});

// ---------------------------------------------------------------
// API HTTP
// ---------------------------------------------------------------
describe("API /ai/tire-photo", () => {
    let srv; let client; let repo;
    before(async () => {
        client = visionClient(READING_OK);
        repo = makeRepo();
        srv = await startServer(createTirePhotoController({ client, repo, visionModel: "modele-vision-test" }));
    });
    after(() => srv.server.close());

    test("analyse : image transmise en data URL au modèle de vision, pneus du catalogue renvoyés", async () => {
        const res = await uploadPhoto(srv.url, JPEG);
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.recherche.mode, "dimension");
        assert.strictEqual(data.recherche.dimension, "205/55 R16");
        assert.strictEqual(data.produits[0].id, 1);
        assert.strictEqual(data.produits[0].correspondance, "meme_modele");

        const req = client.seen.at(-1);
        assert.strictEqual(req.model, "modele-vision-test");
        assert.deepStrictEqual(req.responseFormat, { type: "json_object" });
        assert.strictEqual(req.temperature, 0);
        const image = req.messages[1].content.find((c) => c.type === "image_url");
        assert.ok(image.image_url.startsWith("data:image/jpeg;base64,"));
    });

    test("sans photo : 400, aucun appel IA", async () => {
        const before = client.seen.length;
        const res = await uploadPhoto(srv.url, null);
        assert.strictEqual(res.status, 400);
        assert.strictEqual(client.seen.length, before);
    });

    test("faux fichier image (type déclaré image/png, contenu texte) : 400, aucun appel IA", async () => {
        const before = client.seen.length;
        const res = await uploadPhoto(srv.url, Buffer.from("ceci n'est pas une image, juste du texte"), "image/png", "x.png");
        assert.strictEqual(res.status, 400);
        assert.strictEqual(client.seen.length, before);
    });

    test("type refusé (PDF) : 400", async () => {
        const res = await uploadPhoto(srv.url, Buffer.from("%PDF-1.4"), "application/pdf", "x.pdf");
        assert.strictEqual(res.status, 400);
    });

    test("photo > 5 Mo : 413", async () => {
        const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
        const res = await uploadPhoto(srv.url, big);
        assert.strictEqual(res.status, 413);
    });

    test("correction manuelle : recherche sans IA", async () => {
        const before = client.seen.length;
        const res = await fetch(`${srv.url}/ai/tire-photo/match`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dimension: "195/65 R15", marque: "Bridgestone" })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(data.produits.map((p) => p.id), [4]);
        assert.ok(data.avertissements.some((a) => a.includes("Bridgestone")));
        assert.strictEqual(client.seen.length, before);
    });

    test("correction manuelle : dimension invalide ou critère manquant -> 400", async () => {
        for (const body of [{ dimension: "abc" }, {}]) {
            const res = await fetch(`${srv.url}/ai/tire-photo/match`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
            });
            assert.strictEqual(res.status, 400);
        }
    });
});

describe("cas dégradés", () => {
    async function analyzeWith(clientReply, opts) {
        const srv = await startServer(createTirePhotoController({ client: visionClient(clientReply, opts), repo: makeRepo() }));
        try {
            const res = await uploadPhoto(srv.url, JPEG);
            return { status: res.status, data: await res.json() };
        } finally {
            srv.server.close();
        }
    }

    test("photo qui ne montre pas un pneu : aucun produit, message explicatif", async () => {
        const { status, data } = await analyzeWith({ est_un_pneu: false, dimension: "205/55 R16", marque: "Michelin" });
        assert.strictEqual(status, 200);
        assert.deepStrictEqual(data.produits, []);
        assert.match(data.message, /flanc/);
    });

    test("dimension illisible, marque lue : pistes de la même marque", async () => {
        const { data } = await analyzeWith({ ...READING_OK, dimension: null });
        assert.strictEqual(data.recherche.mode, "marque");
        assert.ok(data.produits.every((p) => p.correspondance === "dimension_a_verifier"));
    });

    test("réponse non JSON du modèle : 503 propre", async () => {
        const { status, data } = await analyzeWith("Désolé, je ne peux pas.");
        assert.strictEqual(status, 503);
        assert.strictEqual(data.success, false);
    });

    test("IA non configurée : 503 avec repli vers la recherche par dimension", async () => {
        const { status, data } = await analyzeWith(new AiServiceError("x", { code: "AI_NOT_CONFIGURED" }));
        assert.strictEqual(status, 503);
        assert.match(data.message, /dimension/);
    });

    test("quota Mistral : 429", async () => {
        const { status } = await analyzeWith(new AiServiceError("x", { code: "AI_RATE_LIMITED", status: 429 }));
        assert.strictEqual(status, 429);
    });
});
