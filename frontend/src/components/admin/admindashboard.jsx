
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
    FaArchive
} from "react-icons/fa";

import {
    useEffect,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import "./admindashboard.css";

import {
    getAllPneus
} from "../../services/pneuApi";

import {
    getAllUsers
} from "../../services/apiuser";

import {
    getAllCommandesAdmin
} from "../../services/commandeApi";

import {
    getAllPromotionsAdmin
} from "../../services/promotionApi";

import {
    getAllReclamations
} from "../../services/reclamationApi";


function AdminDashboard() {

    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    // ========================================
    // STATISTIQUE : NOMBRE DE PNEUS
    // ========================================

    const [nombrePneus, setNombrePneus] = useState(0);
    const [nombreCommandes, setNombreCommandes] = useState(0);

    const [nombreUtilisateurs, setNombreUtilisateurs] = useState(0);

    const [nombrePromotions, setNombrePromotions] = useState(0);
    const [nombreReclamations, setNombreReclamations] = useState(0);


    // ========================================
    // RÉCUPÉRER LE NOMBRE DE PNEUS
    // ========================================

    useEffect(() => {

        const chargerStatistiques = async () => {

            try {

                // ========================================
                // NOMBRE DE PNEUS
                // ========================================

                const pneusResponse = await getAllPneus();

                if (pneusResponse.data.success) {

                    setNombrePneus(
                        pneusResponse.data.pneus.length
                    );

                }


                // ========================================
                // NOMBRE DE COMMANDES
                // ========================================

                const commandesResponse =
                    await getAllCommandesAdmin();

                if (commandesResponse.data.success) {

                    setNombreCommandes(
                        commandesResponse.data.commandes.length
                    );

                }


                // ========================================
                // NOMBRE D'UTILISATEURS
                // ========================================

                const usersResponse =
                    await getAllUsers();

                if (usersResponse.data.success) {

                    setNombreUtilisateurs(
                        usersResponse.data.users.length
                    );

                }

                // ========================================
                // NOMBRE DE RÉCLAMATIONS
                // ========================================

                const reclamationsResponse = await getAllReclamations();

                const reclamationsData = reclamationsResponse.data;

                const listeReclamations = Array.isArray(reclamationsData)
                    ? reclamationsData
                    : reclamationsData.reclamations ||
                    reclamationsData.data ||
                    [];

                setNombreReclamations(listeReclamations.length);


                // ========================================
                // NOMBRE DE PROMOTIONS ACTIVES
                // ========================================

                const promotionsResponse =
                    await getAllPromotionsAdmin();

                if (promotionsResponse.data.success) {

                    setNombrePromotions(
                        promotionsResponse.data.promotions.length
                    );

                }

            } catch (error) {

                console.error(
                    "❌ Erreur récupération statistiques :",
                    error
                );

            }

        };

        chargerStatistiques();

    }, []);

    // ========================================
    // DECONNEXION
    // ========================================

    const handleLogout = () => {

        // Pour le moment, on reviendra ici
        // lorsque nous connecterons la vraie API logout.

        window.dispatchEvent(
            new Event("authChanged")
        );

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


            {/* ========================================
                OVERLAY MOBILE
            ======================================== */}

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

                    <h2>
                        LANDOLSI
                    </h2>

                    <span>
                        Administration
                    </span>

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


                    {/* TABLEAU DE BORD */}

                    <button
                        className="admin-menu-item active"
                        onClick={() => handleNavigation("/admin")}
                    >

                        <FaTachometerAlt />

                        <span>
                            Tableau de bord
                        </span>

                    </button>


                    {/* PNEUS */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/pneus")}
                    >

                        <FaBoxOpen />

                        <span>
                            Pneus
                        </span>

                    </button>


                    {/* PNEUS ARCHIVÉS */}

<button
    className="admin-menu-item"
    onClick={() => handleNavigation("/admin/pneus-archives")}
>
    <FaArchive />

    <span>
        Pneus archivés
    </span>
</button>


                    {/* MARQUES */}
                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/marques")}
                    >
                        <FaTrademark />

                        <span>
                            Marques
                        </span>
                    </button>


                    {/* PROMOTIONS */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/promotions")}
                    >

                        <FaTags />

                        <span>
                            Promotions
                        </span>

                    </button>


                    {/* COMMANDES */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/commandes")}
                    >

                        <FaShoppingCart />

                        <span>
                            Commandes
                        </span>

                    </button>


                    {/* UTILISATEURS */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/utilisateurs")}
                    >

                        <FaUsers />

                        <span>
                            Utilisateurs
                        </span>

                    </button>


                    {/* RÉCLAMATIONS */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/reclamations")}
                    >
                        <FaComments />

                        <span>
                            Réclamations
                        </span>
                    </button>

                    {/* GESTION DES COMMENTAIRES */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/avis")}
                    >
                        <FaCommentDots />

                        <span>
                            Gestion des commentaires
                        </span>
                    </button>

                    {/* GESTION DES COMPATIBILITÉS */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/compatibilites")}
                    >
                        <FaCarSide />

                        <span>
                            Compatibilités véhicules
                        </span>
                    </button>


                    {/* ASSISTANT IA COMMERCIAL (MISTRAL) */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/assistant-ia")}
                    >

                        <FaRobot />

                        <span>
                            Assistant IA
                        </span>

                    </button>


                    {/* SÉCURITÉ (DOUBLE AUTHENTIFICATION) */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/securite")}
                    >

                        <FaShieldAlt />

                        <span>
                            Sécurité (MFA)
                        </span>

                    </button>


                    {/* STOCK */}

                    <button
                        className="admin-menu-item"
                        onClick={() => handleNavigation("/admin/stock")}
                    >

                        <FaWarehouse />

                        <span>
                            Stock
                        </span>

                    </button>


                </nav>


                {/* DECONNEXION */}

                <div className="admin-sidebar-bottom">

                    <button
                        className="admin-logout"
                        onClick={handleLogout}
                    >

                        <FaSignOutAlt />

                        <span>
                            Déconnexion
                        </span>

                    </button>

                </div>


            </aside>


            {/* ========================================
                CONTENU PRINCIPAL
            ======================================== */}

            <main className="admin-main">


                {/* HEADER */}

                <header className="admin-header">


                    {/* BOUTON MENU MOBILE */}

                    <button
                        className="menu-button"
                        onClick={() => setSidebarOpen(true)}
                    >

                        <FaBars />

                    </button>


                    <div>

                        <h1>
                            Tableau de bord
                        </h1>

                        <p>
                            Bienvenue dans l'espace administrateur Landolsi Motors.
                        </p>

                    </div>


                </header>


                {/* ========================================
                    STATISTIQUES
                ======================================== */}

                <section className="admin-stats">


                    {/* ========================================
                        NOMBRE DE PNEUS
                    ======================================== */}

                    <div className="admin-stat-card">

                        <div className="stat-icon">

                            <FaBoxOpen />

                        </div>

                        <div>

                            <h3>
                                {nombrePneus}
                            </h3>

                            <p>
                                Pneus
                            </p>

                        </div>

                    </div>


                    {/* ========================================
                        COMMANDES
                    ======================================== */}

                    <div className="admin-stat-card">

                        <div className="stat-icon">

                            <FaShoppingCart />

                        </div>

                        <div>

                            <h3>
                                {nombreCommandes}
                            </h3>

                            <p>
                                Commandes
                            </p>

                        </div>

                    </div>


                    {/* ========================================
                        UTILISATEURS
                    ======================================== */}

                    <div className="admin-stat-card">

                        <div className="stat-icon">

                            <FaUsers />

                        </div>

                        <div>

                            <h3>

                                {nombreUtilisateurs}

                            </h3>

                            <p>
                                Utilisateurs
                            </p>

                        </div>

                    </div>


                    {/* ========================================
                        PROMOTIONS
                    ======================================== */}

                    <div className="admin-stat-card">

                        <div className="stat-icon">

                            <FaTags />

                        </div>

                        <div>

                            <h3>

                                {nombrePromotions}

                            </h3>

                            <p>
                                Promotions actives
                            </p>

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
                    CONTENU
                ======================================== */}

                <section className="admin-welcome-card">

                    <h2>
                        Gestion de Landolsi Motors
                    </h2>

                    <p>
                        Depuis cet espace, vous pouvez gérer les pneus,
                        les promotions, les commandes, les utilisateurs
                        et le stock.
                    </p>


                    <div className="admin-quick-actions">


                        {/* GÉRER LES PNEUS */}

                        <button
                            onClick={() => handleNavigation("/admin/pneus")}
                        >

                            <FaBoxOpen />

                            Gérer les pneus

                        </button>


                        {/* GÉRER LES PROMOTIONS */}

                        <button
                            onClick={() => handleNavigation("/admin/promotions")}
                        >

                            <FaTags />

                            Gérer les promotions

                        </button>


                        {/* VOIR LES COMMANDES */}

                        <button
                            onClick={() => handleNavigation("/admin/commandes")}
                        >

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