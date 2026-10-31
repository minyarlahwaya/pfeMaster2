import "./SearchResultsPhoto.css";

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaCamera,
    FaUpload,
    FaRedo,
    FaSearch,
    FaCheckCircle,
    FaExclamationTriangle,
    FaShoppingCart,
    FaLightbulb,
    FaLock
} from "react-icons/fa";

import { analyzeTirePhoto, matchTirePhoto } from "../../services/aiApi";
import { prepareTirePhoto } from "../../utils/prepareTirePhoto";
import { useCart } from "../../context/CartContext";
import { API_URL } from "../../config";

const CORRESPONDANCES = {
    meme_modele: { label: "Même marque et même modèle", className: "exact" },
    meme_marque: { label: "Même marque, même dimension", className: "brand" },
    meme_dimension: { label: "Même dimension", className: "dim" },
    dimension_a_verifier: { label: "Dimension à vérifier", className: "check" }
};

const CONFIANCE = { haute: "Lecture sûre", moyenne: "Lecture probable", faible: "Lecture incertaine" };

// ========================================
// Carte d'un pneu proposé
// ========================================

function PhotoProductCard({ product }) {
    const { addToCart } = useCart();
    const corr = CORRESPONDANCES[product.correspondance] || CORRESPONDANCES.meme_dimension;
    const disponible = product.stock > 0;

    const ajouter = () => addToCart({
        id: product.id,
        modele: product.modele,
        dimension: product.dimension,
        saison: product.saison,
        prix: product.prix,
        stock: product.stock,
        image: product.image,
        marque: { nom: product.marque }
    });

    return (
        <article className="photo-product">
            <span className={`photo-product-badge ${corr.className}`}>{corr.label}</span>

            <Link to={product.url} className="photo-product-image">
                {product.image
                    ? <img src={`${API_URL}/uploadPneu/${product.image}`} alt={`${product.marque || ""} ${product.modele}`} loading="lazy" />
                    : <span>Image non disponible</span>}
            </Link>

            <div className="photo-product-body">
                <p className="photo-product-brand">{product.marque || "Marque"}</p>
                <h3><Link to={product.url}>{product.modele}</Link></h3>
                <p className="photo-product-dim">{product.dimension} · {product.saison}</p>

                <p className="photo-product-price">
                    {product.prixPromo != null ? (
                        <>
                            <s>{Number(product.prix).toFixed(2)} DT</s>
                            <strong>{Number(product.prixPromo).toFixed(2)} DT</strong>
                            <em>-{product.pourcentagePromotion}%</em>
                        </>
                    ) : (
                        <strong>{Number(product.prix).toFixed(2)} DT</strong>
                    )}
                </p>

                <p className={`photo-product-stock ${disponible ? "in" : "out"}`}>
                    {disponible ? "Disponible" : "Rupture de stock"}
                </p>

                <div className="photo-product-actions">
                    <Link to={product.url} className="photo-btn-secondary">Voir la fiche</Link>
                    <button type="button" className="photo-btn-primary" onClick={ajouter} disabled={!disponible}>
                        <FaShoppingCart /> Ajouter
                    </button>
                </div>
            </div>
        </article>
    );
}

// ========================================
// Informations reconnues sur le pneu
// ========================================

function Lecture({ lecture }) {
    const items = [];
    if (lecture.marque) {
        items.push({
            label: "Marque",
            value: lecture.marque.catalogue || lecture.marque.lue,
            note: lecture.marque.catalogue ? CONFIANCE[lecture.marque.confiance] : "Non proposée par LANDOLSI TIRES",
            level: lecture.marque.catalogue ? lecture.marque.confiance : "faible"
        });
    }
    if (lecture.modele) {
        items.push({ label: "Modèle", value: lecture.modele.lu, note: CONFIANCE[lecture.modele.confiance], level: lecture.modele.confiance });
    }
    if (lecture.dimension) {
        items.push({ label: "Dimension", value: lecture.dimension.texte, note: CONFIANCE[lecture.dimension.confiance], level: lecture.dimension.confiance });
    }
    if (lecture.indiceCharge || lecture.indiceVitesse) {
        items.push({
            label: "Indices charge / vitesse",
            value: `${lecture.indiceCharge || "?"} ${lecture.indiceVitesse || "?"}`,
            note: "À conserver ou dépasser",
            level: "info"
        });
    }
    if (lecture.dot) {
        items.push({
            label: "Fabrication (DOT)",
            value: `Semaine ${lecture.dot.semaine}, ${lecture.dot.annee}`,
            note: `Environ ${Math.floor(lecture.dot.ageAns)} an(s)`,
            level: lecture.dot.ageAns >= 6 ? "faible" : "info"
        });
    }
    if (lecture.marquage3PMSF || lecture.marquageMS) {
        items.push({
            label: "Marquage hiver",
            value: [lecture.marquage3PMSF && "3PMSF (flocon)", lecture.marquageMS && "M+S"].filter(Boolean).join(" · "),
            note: "Pneu hiver ou 4 saisons",
            level: "info"
        });
    }

    if (!items.length) return null;

    return (
        <div className="photo-lecture">
            <h2>Informations reconnues</h2>
            <dl>
                {items.map((it) => (
                    <div key={it.label} className={`photo-lecture-item level-${it.level}`}>
                        <dt>{it.label}</dt>
                        <dd>{it.value}</dd>
                        <small>{it.note}</small>
                    </div>
                ))}
            </dl>
        </div>
    );
}

// ========================================
// PAGE
// ========================================

function SearchResultsPhoto() {
    const cameraInput = useRef(null);
    const fileInput = useRef(null);

    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [form, setForm] = useState({ dimension: "", marque: "", modele: "" });

    // Libérer l'aperçu local quand il change
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const applyResult = (data) => {
        setResult(data);
        const l = data.lecture || {};
        setForm({
            dimension: l.dimension ? l.dimension.texte : "",
            marque: l.marque ? (l.marque.catalogue || l.marque.lue) : "",
            modele: l.modele ? l.modele.lu : ""
        });
    };

    const onFile = async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = ""; // permettre de reprendre la même photo
        if (!file) return;

        setError("");
        setResult(null);
        setLoading(true);
        try {
            const photo = await prepareTirePhoto(file);
            setPreview(URL.createObjectURL(photo));
            applyResult(await analyzeTirePhoto(photo));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const onCorrect = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await matchTirePhoto(form);
            // La lecture de la photo (DOT, indices) reste affichée ; seuls les critères changent
            setResult((prev) => ({
                ...data,
                lecture: { ...(prev && prev.lecture), ...data.lecture }
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setPreview(null);
        setResult(null);
        setError("");
        setForm({ dimension: "", marque: "", modele: "" });
    };

    const produits = (result && result.produits) || [];

    return (
        <div className="photo-search-page">
            <div className="container">

                <header className="photo-search-header">
                    <h1>Trouver mes pneus à partir d'une photo</h1>
                    <p>
                        Photographiez le flanc de votre pneu usé : nous lisons la marque, le modèle et la dimension,
                        puis nous vous proposons les pneus neufs correspondants de notre catalogue.
                    </p>
                </header>

                <div className="photo-search-layout">

                    {/* ========= PHOTO ========= */}
                    <section className="photo-capture">
                        <div className={`photo-dropzone ${preview ? "has-preview" : ""}`}>
                            {preview
                                ? <img src={preview} alt="Photo de votre pneu" />
                                : (
                                    <div className="photo-dropzone-empty">
                                        <FaCamera />
                                        <span>Aucune photo pour le moment</span>
                                    </div>
                                )}
                            {loading && (
                                <div className="photo-loading" role="status">
                                    <span className="photo-spinner" />
                                    Analyse en cours…
                                </div>
                            )}
                        </div>

                        {/* capture="environment" : ouvre directement l'appareil photo arrière sur mobile */}
                        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
                        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />

                        <div className="photo-capture-buttons">
                            <button type="button" className="photo-btn-primary" disabled={loading} onClick={() => cameraInput.current.click()}>
                                <FaCamera /> Prendre une photo
                            </button>
                            <button type="button" className="photo-btn-secondary" disabled={loading} onClick={() => fileInput.current.click()}>
                                <FaUpload /> Importer une photo
                            </button>
                            {preview && !loading && (
                                <button type="button" className="photo-btn-link" onClick={reset}>
                                    <FaRedo /> Recommencer
                                </button>
                            )}
                        </div>

                        <div className="photo-tips">
                            <h3><FaLightbulb /> Pour une lecture fiable</h3>
                            <ul>
                                <li>Cadrez le <strong>flanc</strong> du pneu, là où figure la dimension (ex. 205/55 R16 91V).</li>
                                <li>Approchez-vous : les chiffres doivent occuper une bonne partie de la photo.</li>
                                <li>Évitez le contre-jour ; une lumière rasante fait ressortir le relief.</li>
                                <li>Essuyez la poussière ou la boue sur les inscriptions.</li>
                            </ul>
                        </div>

                        <p className="photo-privacy">
                            <FaLock /> Votre photo est analysée par notre service d'intelligence artificielle (Mistral AI)
                            puis supprimée : elle n'est pas conservée sur nos serveurs. Les données de localisation
                            de la photo sont retirées avant l'envoi.
                        </p>
                    </section>

                    {/* ========= RÉSULTAT ========= */}
                    <section className="photo-result">
                        {error && (
                            <div className="photo-alert error" role="alert">
                                <FaExclamationTriangle /> {error}
                            </div>
                        )}

                        {!result && !error && !loading && (
                            <div className="photo-placeholder">
                                <FaSearch />
                                <p>Les pneus correspondants s'afficheront ici.</p>
                                <p className="photo-placeholder-alt">
                                    Vous connaissez déjà la dimension ? Saisissez-la dans le formulaire
                                    ci-dessous, sans photo.
                                </p>
                            </div>
                        )}

                        {result && (
                            <>
                                <div className={`photo-alert ${produits.length ? "success" : "info"}`}>
                                    {produits.length ? <FaCheckCircle /> : <FaExclamationTriangle />} {result.message}
                                </div>

                                {result.lecture && result.lecture.problemePhoto && !produits.length && (
                                    <p className="photo-problem">Remarque sur la photo : {result.lecture.problemePhoto}</p>
                                )}

                                {result.lecture && <Lecture lecture={result.lecture} />}

                                {(result.avertissements || []).map((a) => (
                                    <div key={a} className="photo-alert warning"><FaExclamationTriangle /> {a}</div>
                                ))}
                            </>
                        )}

                        {/* Correction ou saisie manuelle : recherche en base, sans IA */}
                        <form className="photo-correction" onSubmit={onCorrect}>
                            <h2>{result ? "Corriger la lecture" : "Recherche manuelle"}</h2>
                            <p>Vérifiez ces informations sur votre pneu : en cas d'erreur, corrigez-les et relancez la recherche.</p>
                            <div className="photo-correction-fields">
                                <label>
                                    Dimension
                                    <input
                                        value={form.dimension}
                                        onChange={(e) => setForm({ ...form, dimension: e.target.value })}
                                        placeholder="205/55 R16"
                                        maxLength={30}
                                    />
                                </label>
                                <label>
                                    Marque
                                    <input
                                        value={form.marque}
                                        onChange={(e) => setForm({ ...form, marque: e.target.value })}
                                        placeholder="Michelin"
                                        maxLength={40}
                                    />
                                </label>
                                <label>
                                    Modèle
                                    <input
                                        value={form.modele}
                                        onChange={(e) => setForm({ ...form, modele: e.target.value })}
                                        placeholder="Primacy 4"
                                        maxLength={60}
                                    />
                                </label>
                            </div>
                            <button type="submit" className="photo-btn-primary" disabled={loading || (!form.dimension.trim() && !form.marque.trim())}>
                                <FaSearch /> Rechercher
                            </button>
                        </form>

                        {produits.length > 0 && (
                            <div className="photo-products">
                                <h2>Pneus neufs proposés ({produits.length})</h2>
                                <div className="photo-products-grid">
                                    {produits.map((p) => <PhotoProductCard key={p.id} product={p} />)}
                                </div>
                                <p className="photo-disclaimer">
                                    Avant de commander, vérifiez que la dimension correspond aussi aux pneus indiqués
                                    pour votre véhicule (carnet d'entretien, étiquette de portière). Les indices de
                                    charge et de vitesse du pneu neuf doivent être au moins égaux à ceux d'origine.
                                    En cas de doute, contactez LANDOLSI TIRES.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default SearchResultsPhoto;
