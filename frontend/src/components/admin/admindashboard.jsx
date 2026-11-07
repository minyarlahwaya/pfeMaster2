import {
    FaTachometerAlt,
    FaBoxOpen,
    FaTags,
    FaShoppingCart,
    FaUsers,
    FaWarehouse,
    FaSignOutAlt,
    FaBars,
    FaTimes,
    FaTrademark,
    FaComments,
    FaCommentDots,
    FaShieldAlt,
    FaRobot,
    FaCarSide,
    FaArchive,
    FaMoneyBillWave
} from "react-icons/fa";

import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";

import "./admindashboard.css";

import { getAllPneus } from "../../services/pneuApi";
import { getAllUsers } from "../../services/apiuser";
import { getAllCommandesAdmin } from "../../services/commandeApi";
import { getAllPromotionsAdmin } from "../../services/promotionApi";
import { getAllReclamations } from "../../services/reclamationApi";


// ========================================
// CONSTANTES
// ========================================

const STATUTS = [
    { key: "en attente", label: "En attente", color: "#f59e0b" },
    { key: "confirmée", label: "Confirmée", color: "#22c55e" },
    { key: "en préparation", label: "En préparation", color: "#3b82f6" },
    { key: "récupérée", label: "Récupérée", color: "#8b5cf6" },
    { key: "annulée", label: "Annulée", color: "#ef4444" }
];

const NOMBRE_MOIS_AFFICHES = 12;


// ========================================
// OUTILS
// ========================================

const obtenirDateLocale = (date) => {
    if (!date) return "";

    const valeur = new Date(date);

    if (isNaN(valeur.getTime())) return "";

    const annee = valeur.getFullYear();
    const mois = String(valeur.getMonth() + 1).padStart(2, "0");
    const jour = String(valeur.getDate()).padStart(2, "0");

    return `${annee}-${mois}-${jour}`;
};

const obtenirCleMois = (date) => obtenirDateLocale(date).slice(0, 7);

const formatMontant = (valeur) => `${Number(valeur || 0).toFixed(2)} DT`;


function AdminDashboard() {

    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    // ========================================
    // STATISTIQUES
    // ========================================

    const [nombrePneus, setNombrePneus] = useState(0);
    const [nombreUtilisateurs, setNombreUtilisateurs] = useState(0);
    const [nombrePromotions, setNombrePromotions] = useState(0);
    const [nombreReclamations, setNombreReclamations] = useState(0);

    // Liste complète des commandes (sert au nombre et aux graphiques)
    const [commandes, setCommandes] = useState([]);


    // ========================================
    // CHARGER LES STATISTIQUES
    // ========================================

    useEffect(() => {

        const chargerStatistiques = async () => {

            // allSettled : si une API échoue, les autres statistiques s'affichent quand même
            const [
                pneusResult,
                commandesResult,
                usersResult,
                reclamationsResult,
                promotionsResult
            ] = await Promise.allSettled([
                getAllPneus(),
                getAllCommandesAdmin(),
                getAllUsers(),
                getAllReclamations(),
                getAllPromotionsAdmin()
            ]);

            // PNEUS
            if (
                pneusResult.status === "fulfilled" &&
                pneusResult.value.data.success
            ) {
                setNombrePneus(pneusResult.value.data.pneus.length);
            }

            // COMMANDES
            if (
                commandesResult.status === "fulfilled" &&
                commandesResult.value.data.success
            ) {
                setCommandes(commandesResult.value.data.commandes || []);
            }

            // UTILISATEURS
            if (
                usersResult.status === "fulfilled" &&
                usersResult.value.data.success
            ) {
                setNombreUtilisateurs(usersResult.value.data.users.length);
            }

            // RÉCLAMATIONS
            if (reclamationsResult.status === "fulfilled") {
                const data = reclamationsResult.value.data;

                const liste = Array.isArray(data)
                    ? data
                    : data.reclamations || data.data || [];

                setNombreReclamations(liste.length);
            }

            // PROMOTIONS
            if (
                promotionsResult.status === "fulfilled" &&
                promotionsResult.value.data.success
            ) {
                setNombrePromotions(
                    promotionsResult.value.data.promotions.length
                );
            }

            [
                pneusResult,
                commandesResult,
                usersResult,
                reclamationsResult,
                promotionsResult
            ].forEach((resultat) => {
                if (resultat.status === "rejected") {
                    console.error(
                        "❌ Erreur récupération statistiques :",
                        resultat.reason
                    );
                }
            });
        };

        chargerStatistiques();

    }, []);


    // ========================================
    // DONNÉES DES GRAPHIQUES
    // ========================================

    const stats = useMemo(() => {

        // Les commandes annulées ne comptent pas dans le chiffre d'affaires
        const valides = commandes.filter((c) => c.statut !== "annulée");

        const chiffreAffaires = valides.reduce(
            (somme, c) => somme + Number(c.total || 0),
            0
        );

        const panierMoyen = valides.length
            ? chiffreAffaires / valides.length
            : 0;

        // Répartition par statut
        const parStatut = STATUTS
            .map((s) => ({
                name: s.label,
                value: commandes.filter((c) => c.statut === s.key).length,
                color: s.color
            }))
            .filter((s) => s.value > 0);

        // 7 derniers jours
        const jours = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);

            jours.push({
                cle: obtenirDateLocale(d),
                jour: d.toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit"
                }),
                commandes: 0
            });
        }

        // 12 derniers mois
        const mois = [];

        for (let i = NOMBRE_MOIS_AFFICHES - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);

            mois.push({
                cle: obtenirCleMois(d),
                mois: d.toLocaleDateString("fr-FR", {
                    month: "short",
                    year: "2-digit"
                }),
                ca: 0
            });
        }

        // Pneus les plus achetés
        const ventes = {};

        valides.forEach((c) => {
            const total = Number(c.total || 0);

            const jour = jours.find(
                (j) => j.cle === obtenirDateLocale(c.createdAt)
            );

            if (jour) jour.commandes += 1;

            const moisCommande = mois.find(
                (m) => m.cle === obtenirCleMois(c.createdAt)
            );

            if (moisCommande) moisCommande.ca += total;

            c.items?.forEach((item) => {
                const marque = item.pneu?.marque?.nom || "";
                const modele = item.pneu?.modele || "Pneu inconnu";
                const cle = item.pneu?.id ?? `${marque}-${modele}`;
                const quantite = Number(item.quantite || 0);

                if (!ventes[cle]) {
                    ventes[cle] = {
                        name: `${marque} ${modele}`.trim(),
                        dimension: item.pneu?.dimension || "",
                        quantite: 0,
                        revenu: 0
                    };
                }

                ventes[cle].quantite += quantite;
                // item.prix est considéré comme le prix unitaire
                ventes[cle].revenu += Number(item.prix || 0) * quantite;
            });
        });

        mois.forEach((m) => {
            m.ca = Number(m.ca.toFixed(2));
        });

        const topPneus = Object.values(ventes)
            .map((p) => ({ ...p, revenu: Number(p.revenu.toFixed(2)) }))
            .sort((a, b) => b.quantite - a.quantite)
            .slice(0, 5);

        return {
            chiffreAffaires,
            panierMoyen,
            parStatut,
            jours,
            mois,
            topPneus
        };

    }, [commandes]);


    // ========================================
    // DECONNEXION
    // ========================================

    const handleLogout = () => {

        // Pour le moment, on reviendra ici
        // lorsque nous connecterons la vraie API logout.

        window.dispatchEvent(new Event("authChanged"));

        navigate("/login");

    };


    // ========================================
    // NAVIGATION
    // ========================================

    const handleNavigation = (path) => {

        navigate(path);

        setSidebarOpen(false);

    };


    return (

        <div className="admin-layout">


            {/* OVERLAY MOBILE */}

            {sidebarOpen && (
                <div
                    className="admin-overlay"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}


            {/* ========================================
                SIDEBAR
            ======================================== */}

            <aside
                className={
                    sidebarOpen
                        ? "admin-sidebar open"
                        : "admin-sidebar"
                }
            >

                {/* LOGO */}

                <div className="admin-logo">
                    <h2>LANDOLSI</h2>
                    <span>Administration</span>
                </div>

                {/* BOUTON FERMER MOBILE */}

                <button
                    className="close-sidebar"
                    onClick={() => setSidebarOpen(false)}
                >
                    <FaTimes />
                </button>

                {/* MENU */}

                <nav className="admin-menu">

                    <button
                        className="admin-menu-item active"
                        onClick={() => handleNavigation("/admin")}
                    >
                        <FaTachometerAlt />
                        <span>Tableau de bord</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/pneus")}
                    >
                        <FaBoxOpen />
                        <span>Pneus</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/pneus-archives")}
                    >
                        <FaArchive />
                        <span>Pneus archivés</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/marques")}
                    >
                        <FaTrademark />
                        <span>Marques</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/promotions")}
                    >
                        <FaTags />
                        <span>Promotions</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/commandes")}
                    >
                        <FaShoppingCart />
                        <span>Commandes</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/utilisateurs")}
                    >
                        <FaUsers />
                        <span>Utilisateurs</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/reclamations")}
                    >
                        <FaComments />
                        <span>Réclamations</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/avis")}
                    >
                        <FaCommentDots />
                        <span>Gestion des commentaires</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/compatibilites")}
                    >
                        <FaCarSide />
                        <span>Compatibilités véhicules</span>
                    </button>

                    {/* ASSISTANT IA COMMERCIAL (MISTRAL) */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/assistant-ia")}
                    >
                        <FaRobot />
                        <span>Assistant IA</span>
                    </button>

                    {/* SÉCURITÉ (DOUBLE AUTHENTIFICATION) */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/securite")}
                    >
                        <FaShieldAlt />
                        <span>Sécurité (MFA)</span>
                    </button>

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/stock")}
                    >
                        <FaWarehouse />
                        <span>Stock</span>
                    </button>

                </nav>

                {/* DECONNEXION */}

                <div className="admin-sidebar-bottom">
                    <button
                        className="admin-logout"
                        onClick={handleLogout}
                    >
                        <FaSignOutAlt />
                        <span>Déconnexion</span>
                    </button>
                </div>

            </aside>


            {/* ========================================
                CONTENU PRINCIPAL
            ======================================== */}

            <main className="admin-main">

                {/* HEADER */}

                <header className="admin-header">

                    <button
                        className="menu-button"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <FaBars />
                    </button>

                    <div>
                        <h1>Tableau de bord</h1>

                        <p>
                            Bienvenue dans l'espace administrateur Landolsi Motors.
                        </p>
                    </div>

                </header>


                {/* ========================================
                    STATISTIQUES
                ======================================== */}

                <section className="admin-stats">

                    <div className="admin-stat-card">
                        <div className="stat-icon">
                            <FaBoxOpen />
                        </div>
                        <div>
                            <h3>{nombrePneus}</h3>
                            <p>Pneus</p>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="stat-icon">
                            <FaShoppingCart />
                        </div>
                        <div>
                            <h3>{commandes.length}</h3>
                            <p>Commandes</p>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="stat-icon">
                            <FaMoneyBillWave />
                        </div>
                        <div>
                            <h3>{formatMontant(stats.chiffreAffaires)}</h3>
                            <p>
                                Chiffre d'affaires
                                <small>
                                    {" "}· panier moyen {formatMontant(stats.panierMoyen)}
                                </small>
                            </p>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="stat-icon">
                            <FaUsers />
                        </div>
                        <div>
                            <h3>{nombreUtilisateurs}</h3>
                            <p>Utilisateurs</p>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="stat-icon">
                            <FaTags />
                        </div>
                        <div>
                            <h3>{nombrePromotions}</h3>
                            <p>Promotions actives</p>
                        </div>
                    </div>

                    {/* RÉCLAMATIONS */}

                    <div
                        className="admin-stat-card"
                        onClick={() => handleNavigation("/admin/reclamations")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleNavigation("/admin/reclamations");
                            }
                        }}
                        style={{ cursor: "pointer" }}
                    >
                        <div className="stat-icon">
                            <FaComments />
                        </div>
                        <div>
                            <h3>{nombreReclamations}</h3>
                            <p>Réclamations</p>
                        </div>
                    </div>

                </section>


                {/* ========================================
                    GRAPHIQUES
                ======================================== */}

                <section className="admin-charts">

                    {/* CHIFFRE D'AFFAIRES PAR MOIS */}

                    <div className="admin-chart-box chart-wide">
                        <h3>
                            Chiffre d'affaires par mois
                            <small>
                                {" "}({NOMBRE_MOIS_AFFICHES} derniers mois, hors commandes annulées)
                            </small>
                        </h3>

                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stats.mois}>
                                <defs>
                                    <linearGradient id="degradeCA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#e30613" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#e30613" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="mois" />
                                <YAxis
                                    width={75}
                                    tickFormatter={(v) => `${v} DT`}
                                />
                                <Tooltip
                                    formatter={(valeur) => [
                                        formatMontant(valeur),
                                        "Chiffre d'affaires"
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="ca"
                                    name="Chiffre d'affaires"
                                    stroke="#e30613"
                                    strokeWidth={2}
                                    fill="url(#degradeCA)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* RÉPARTITION PAR STATUT */}

                    <div className="admin-chart-box">
                        <h3>Commandes par statut</h3>

                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={stats.parStatut}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={2}
                                >
                                    {stats.parStatut.map((s) => (
                                        <Cell key={s.name} fill={s.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* COMMANDES DES 7 DERNIERS JOURS */}

                    <div className="admin-chart-box">
                        <h3>Commandes des 7 derniers jours</h3>

                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={stats.jours}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="jour" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar
                                    dataKey="commandes"
                                    name="Commandes"
                                    fill="#e30613"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* PNEUS LES PLUS ACHETÉS */}

                    <div className="admin-chart-box">
                        <h3>Pneus les plus achetés</h3>

                        {stats.topPneus.length === 0 ? (
                            <p className="chart-vide">
                                Aucune vente pour le moment.
                            </p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={stats.topPneus} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={120}
                                    />
                                    <Tooltip />
                                    <Bar
                                        dataKey="quantite"
                                        name="Quantité vendue"
                                        fill="#222"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* CLASSEMENT DES PNEUS AVEC PRIX */}

                    <div className="admin-chart-box">
                        <h3>Meilleurs pneus : quantité et revenu</h3>

                        {stats.topPneus.length === 0 ? (
                            <p className="chart-vide">
                                Aucune vente pour le moment.
                            </p>
                        ) : (
                            <ol className="top-pneus-list">
                                {stats.topPneus.map((pneu, index) => (
                                    <li key={`${pneu.name}-${index}`}>
                                        <span className="top-rang">{index + 1}</span>

                                        <div className="top-info">
                                            <strong>{pneu.name}</strong>
                                            <span>
                                                {pneu.dimension
                                                    ? `${pneu.dimension} · `
                                                    : ""}
                                                {pneu.quantite} vendu
                                                {pneu.quantite > 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        <strong className="top-revenu">
                                            {formatMontant(pneu.revenu)}
                                        </strong>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                </section>


                {/* ========================================
                    CONTENU
                ======================================== */}

                <section className="admin-welcome-card">

                    <h2>Gestion de Landolsi Motors</h2>

                    <p>
                        Depuis cet espace, vous pouvez gérer les pneus,
                        les promotions, les commandes, les utilisateurs
                        et le stock.
                    </p>

                    <div className="admin-quick-actions">

                        <button onClick={() => handleNavigation("/admin/pneus")}>
                            <FaBoxOpen />
                            Gérer les pneus
                        </button>

                        <button onClick={() => handleNavigation("/admin/promotions")}>
                            <FaTags />
                            Gérer les promotions
                        </button>

                        <button onClick={() => handleNavigation("/admin/commandes")}>
                            <FaShoppingCart />
                            Voir les commandes
                        </button>

                    </div>

                </section>

            </main>

        </div>

    );

}

export default AdminDashboard;
