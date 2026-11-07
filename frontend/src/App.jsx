
import {
    BrowserRouter,
    Routes,
    Route,
    useLocation
} from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import Home from "./pages/Home";
import Register from "./components/Auth/Register";
import Login from "./components/Auth/Login";
import ForgotPassword from "./components/Auth/ForgotPassword";
import VerifyResetCode from "./components/Auth/VerifyResetCode";
import ResetPassword from "./components/Auth/ResetPassword";
import Profile from "./pages/Profile";
import Pneus from "./pages/pneu";
import PneuDetails from "./pages/PneuDetails";
import Cart from "./pages/Cart/Cart";

import SearchResults from "./pages/SearchResults/SearchResult";
import SearchResultsMarque from "./pages/SearchResults/SearchResultsMarque";
import SearchResultsSaison from "./pages/SearchResults/SearchResultsSaison";
import SearchResultsImmatriculation from "./pages/SearchResults/SearchResultsImmatriculation";
import SearchResultsPhoto from "./pages/SearchResults/SearchResultsPhoto";

import {
    CartProvider,
    useCart
} from "./context/CartContext";

import Notification from "./components/Notification/Notification";

import CommandeDetails from "./pages/CommandeDetails/CommandeDetails";
import MesCommandes from "./components/CommandesPanier/MesCommandes";

import Promotions from "./components/pneus/Promotions";
import MesReclamations from "./components/Reclamation/MesReclamations";

// ========================================
// ADMIN
// ========================================

import AdminDashboard from "./components/admin/admindashboard";
import AdminPneus from "./components/admin/AdminPneus";
import AjouterPneu from "./components/admin/AjouterPneu";
import ModifierPneu from "./components/admin/ModifierPneu";
import AdminPromotions from "./components/admin/AdminPromotions";
import AjouterPromotion from "./components/admin/AjouterPromotion";
import ModifierPromotion from "./components/admin/ModifierPromotion";
import AdminCommandes from "./components/admin/AdminCommandes";
import AdminUtilisateurs from "./components/admin/AdminUtilisateurs";
import GestionMarques from "./components/admin/GestionMarques";
import GestionReclamations from "./components/admin/GestionReclamations";
import AdminSecurite from "./components/admin/AdminSecurite";
import AdminAssistantIA from "./components/admin/AdminAssistantIA";
import GestionAvis from "./components/admin/GestionAvis";
import GestionCompatibilites from "./components/admin/GestionCompatibilites";
import AdminPneusArchives from "./components/admin/AdminPneusArchives";

// ========================================
// CHATBOT
// ========================================

import Chatbot from "./components/chatbot/Chatbot";

// ========================================
// CONTENU DE L'APPLICATION
// ========================================

function AppContent() {

    const {
        notification,
        setNotification
    } = useCart();

    const location = useLocation();

    // Vérifier si on se trouve dans l'espace admin
    const isAdmin = location.pathname.startsWith("/admin");

    return (
        <>

            {/* NAVBAR CLIENT */}
            {!isAdmin && <Navbar />}

            {/* NOTIFICATION */}
            <Notification
                notification={notification}
                onClose={() => setNotification(null)}
            />

            {/* CHATBOT CLIENT */}
            {!isAdmin && <Chatbot />}

            {/* ROUTES */}
            <Routes>

                {/* PAGES CLIENT */}

                <Route path="/" element={<Home />} />

                <Route path="/login" element={<Login />} />

                <Route path="/forgot-password" element={<ForgotPassword />} />

                <Route path="/verify-reset-code" element={<VerifyResetCode />} />

                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/register" element={<Register />} />

                <Route path="/profile" element={<Profile />} />

                <Route path="/pneus" element={<Pneus />} />

                <Route path="/promotions" element={<Promotions />} />

                <Route path="/mes-reclamations" element={<MesReclamations />} />

                {/* RECHERCHE */}

                <Route path="/recherche-pneus" element={<SearchResults />} />

                <Route path="/pneu/:id" element={<PneuDetails />} />

                <Route path="/recherche-pneus-marque" element={<SearchResultsMarque />} />

                <Route path="/recherche-pneus-saison" element={<SearchResultsSaison />} />

                <Route path="/recherche/immatriculation" element={<SearchResultsImmatriculation />} />

                <Route path="/recherche/photo" element={<SearchResultsPhoto />} />

                {/* PANIER ET COMMANDES */}

                <Route path="/panier" element={<Cart />} />

                <Route path="/commande/:id" element={<CommandeDetails />} />

                <Route path="/mes-commandes" element={<MesCommandes />} />

                {/* ESPACE ADMIN */}

                <Route path="/admin" element={<AdminDashboard />} />

                <Route path="/admin/pneus" element={<AdminPneus />} />

                <Route path="/admin/marques" element={<GestionMarques />} />

                <Route path="/admin/pneus/ajouter" element={<AjouterPneu />} />

                <Route path="/admin/pneus/modifier/:id" element={<ModifierPneu />} />

                <Route path="/admin/promotions" element={<AdminPromotions />} />

                <Route path="/admin/promotions/ajouter" element={<AjouterPromotion />} />

                <Route path="/admin/promotions/modifier/:id" element={<ModifierPromotion />} />

                <Route path="/admin/commandes" element={<AdminCommandes />} />

                <Route path="/admin/utilisateurs" element={<AdminUtilisateurs />} />

                <Route path="/admin/securite" element={<AdminSecurite />} />

                <Route path="/admin/assistant-ia" element={<AdminAssistantIA />} />

                <Route path="/admin/reclamations" element={<GestionReclamations />} />

                <Route path="/admin/avis" element={<GestionAvis />} />

                <Route path="/admin/compatibilites" element={<GestionCompatibilites />} />
                <Route
                    path="/admin/pneus-archives"
                    element={<AdminPneusArchives />}
                />

            </Routes>

            {/* FOOTER CLIENT UNIQUEMENT */}
            {!isAdmin && <Footer />}

        </>
    );
}

// ========================================
// APP PRINCIPALE
// ========================================

function App() {
    return (
        <CartProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </CartProvider>
    );
}

export default App;
