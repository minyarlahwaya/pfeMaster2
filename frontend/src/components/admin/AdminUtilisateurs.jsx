
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaTrash,
    FaHome,
    FaUserCheck,
    FaUserTimes,
    FaShieldAlt,
    FaSearch,
    FaTimes
} from "react-icons/fa";

import {
    getAllUsers,
    toggleUserStatus,
    deleteUser,
    resetUserMfa
} from "../../services/apiuser";

import "./AdminUtilisateurs.css";


function AdminUtilisateurs() {

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Recherche
    const [searchTerm, setSearchTerm] = useState("");

    const navigate = useNavigate();


    // ========================================
    // RÉCUPÉRER LES UTILISATEURS
    // ========================================

    const chargerUtilisateurs = async () => {

        try {

            const response = await getAllUsers();

            console.log(
                "Utilisateurs récupérés :",
                response.data
            );

            if (response.data.success) {
                setUsers(response.data.users);
            }

        } catch (error) {

            console.error(
                "Erreur récupération utilisateurs :",
                error
            );

            setError(
                "Impossible de récupérer les utilisateurs."
            );

        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        chargerUtilisateurs();

    }, []);


    // ========================================
    // RECHERCHE DES UTILISATEURS
    // ========================================

    const normaliserTexte = (texte) => {

        return String(texte || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

    };


    const utilisateursFiltres = users.filter((user) => {

        const recherche = normaliserTexte(searchTerm);

        if (!recherche) {
            return true;
        }

        const informationsUtilisateur = [

            user.id,
            user.nom,
            user.prenom,
            user.email,
            user.telephone,
            user.ville,
            user.typeClient,
            user.role

        ];

        return informationsUtilisateur.some((information) =>
            normaliserTexte(information).includes(recherche)
        );

    });


    // ========================================
    // ACTIVER / DÉSACTIVER UN UTILISATEUR
    // ========================================

    const handleToggleStatus = async (id) => {

        try {

            await toggleUserStatus(id);

            const response = await getAllUsers();

            if (response.data.success) {
                setUsers(response.data.users);
            }

            alert("Statut de l'utilisateur modifié avec succès.");

        } catch (error) {

            console.error(
                "Erreur modification statut :",
                error
            );

            alert(
                error.response?.data?.message ||
                "Impossible de modifier le statut de l'utilisateur."
            );

        }

    };


    // ========================================
    // RÉINITIALISER LA DOUBLE AUTHENTIFICATION
    // ========================================

    const handleResetMfa = async (id) => {

        const confirmation = window.confirm(
            "Réinitialiser la double authentification de cet utilisateur ? " +
            "Vérifiez d'abord son identité : il pourra ensuite se connecter avec son seul mot de passe."
        );

        if (!confirmation) {
            return;
        }

        try {

            await resetUserMfa(id);

            setUsers((usersActuels) =>
                usersActuels.map((user) =>
                    user.id === id
                        ? { ...user, mfaEnabled: false }
                        : user
                )
            );

            alert("Double authentification réinitialisée.");

        } catch (error) {

            console.error(
                "Erreur réinitialisation MFA :",
                error
            );

            alert(
                error.response?.data?.message ||
                "Impossible de réinitialiser la double authentification."
            );

        }

    };


    // ========================================
    // SUPPRIMER UN UTILISATEUR
    // ========================================

    const handleDelete = async (id) => {

        const confirmation = window.confirm(
            "Êtes-vous sûr de vouloir supprimer cet utilisateur ?"
        );

        if (!confirmation) {
            return;
        }

        try {

            await deleteUser(id);

            setUsers((usersActuels) =>
                usersActuels.filter(
                    (user) => user.id !== id
                )
            );

            alert("Utilisateur supprimé avec succès.");

        } catch (error) {

            console.error(
                "Erreur suppression utilisateur :",
                error
            );

            alert(
                error.response?.data?.message ||
                "Impossible de supprimer cet utilisateur."
            );

        }

    };


    // ========================================
    // CHARGEMENT
    // ========================================

    if (loading) {

        return (
            <div className="admin-utilisateurs-page">
                <div className="admin-utilisateurs-loading">
                    Chargement des utilisateurs...
                </div>
            </div>
        );

    }


    // ========================================
    // ERREUR
    // ========================================

    if (error) {

        return (
            <div className="admin-utilisateurs-page">
                <div className="admin-utilisateurs-error">
                    {error}
                </div>
            </div>
        );

    }


    // ========================================
    // AFFICHAGE
    // ========================================

    return (

        <div className="admin-utilisateurs-page">


            {/* HEADER */}

            <div className="admin-utilisateurs-header">

                <div>

                    <h1>
                        Gestion des utilisateurs
                    </h1>

                    <p>
                        Gérez les comptes clients de Landolsi Motors.
                    </p>

                </div>


                <div className="admin-utilisateurs-header-actions">

                    <button
                        className="btn-retour-dashboard"
                        title="Retour au dashboard"
                        onClick={() => navigate("/admin")}
                    >

                        <FaHome />

                        <span>
                            Dashboard
                        </span>

                    </button>

                </div>

            </div>


            {/* INFORMATIONS */}

            <div className="utilisateurs-info">

                <span>
                    Nombre d'utilisateurs
                </span>

                <strong>
                    {users.length}
                </strong>

            </div>


            {/* BARRE DE RECHERCHE */}

            <div className="utilisateurs-search-container">

                <div className="utilisateurs-search-box">

                    <FaSearch className="search-icon" />

                    <input
                        type="text"
                        placeholder="Rechercher par nom, prénom, email, téléphone, ville..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {searchTerm && (

                        <button
                            type="button"
                            className="clear-search"
                            title="Effacer la recherche"
                            onClick={() => setSearchTerm("")}
                        >
                            <FaTimes />
                        </button>

                    )}

                </div>

                <span className="search-result-count">
                    {utilisateursFiltres.length} résultat(s)
                </span>

            </div>


            {/* GRILLE DES UTILISATEURS */}

            <div className="admin-utilisateurs-grid">


                {utilisateursFiltres.length === 0 ? (

                    <div className="aucun-utilisateur">

                        {searchTerm
                            ? "Aucun client ne correspond à votre recherche."
                            : "Aucun utilisateur trouvé."
                        }

                    </div>

                ) : (

                    utilisateursFiltres.map((user) => (

                        <div
                            className="admin-utilisateur-card"
                            key={user.id}
                        >


                            {/* EN-TÊTE CARTE */}

                            <div className="admin-utilisateur-card-header">

                                <div className="utilisateur-avatar">

                                    {user.prenom?.charAt(0).toUpperCase()}
                                    {user.nom?.charAt(0).toUpperCase()}

                                </div>


                                <div className="utilisateur-identite">

                                    <h3 title={`${user.prenom} ${user.nom}`}>

                                        {user.prenom} {user.nom}

                                    </h3>

                                    <span>
                                        #{user.id}
                                    </span>

                                </div>

                            </div>


                            {/* INFORMATIONS */}

                            <div className="admin-utilisateur-details">


                                <div className="utilisateur-info-ligne">

                                    <span>
                                        Email
                                    </span>

                                    <strong title={user.email}>
                                        {user.email}
                                    </strong>

                                </div>


                                <div className="utilisateur-info-ligne">

                                    <span>
                                        Téléphone
                                    </span>

                                    <strong>
                                        {user.telephone || "-"}
                                    </strong>

                                </div>


                                <div className="utilisateur-info-ligne">

                                    <span>
                                        Type
                                    </span>

                                    <strong>

                                        {user.typeClient === "professionnel"
                                            ? "Professionnel"
                                            : "Particulier"}

                                    </strong>

                                </div>


                                <div className="utilisateur-info-ligne">

                                    <span>
                                        Ville
                                    </span>

                                    <strong>
                                        {user.ville || "-"}
                                    </strong>

                                </div>

                            </div>


                            {/* TYPE + STATUT */}

                            <div className="admin-utilisateur-bottom">


                                <span
                                    className={
                                        user.role === "admin"
                                            ? "role-admin"
                                            : "role-client"
                                    }
                                >

                                    {user.role === "admin"
                                        ? "Admin"
                                        : "Client"}

                                </span>


                                <span
                                    className={
                                        user.isActive
                                            ? "status-active"
                                            : "status-inactive"
                                    }
                                >

                                    {user.isActive
                                        ? "Actif"
                                        : "Inactif"}

                                </span>


                                {user.mfaEnabled && (

                                    <span
                                        className="status-active"
                                        title="Double authentification activée"
                                    >

                                        <FaShieldAlt /> MFA

                                    </span>

                                )}

                            </div>


                            {/* ACTIONS */}

                            {user.role !== "admin" && (

                                <div className="actions-utilisateur">


                                    <button
                                        className={
                                            user.isActive
                                                ? "btn-desactiver"
                                                : "btn-activer"
                                        }
                                        title={
                                            user.isActive
                                                ? "Désactiver"
                                                : "Activer"
                                        }
                                        onClick={() =>
                                            handleToggleStatus(user.id)
                                        }
                                    >

                                        {user.isActive
                                            ? <FaUserTimes />
                                            : <FaUserCheck />
                                        }

                                        <span>
                                            {user.isActive
                                                ? "Désactiver"
                                                : "Activer"}
                                        </span>

                                    </button>


                                    {user.mfaEnabled && (

                                        <button
                                            className="btn-activer"
                                            title="Réinitialiser la double authentification"
                                            onClick={() =>
                                                handleResetMfa(user.id)
                                            }
                                        >

                                            <FaShieldAlt />

                                            <span>
                                                Réinit. MFA
                                            </span>

                                        </button>

                                    )}


                                    <button
                                        className="btn-supprimer"
                                        title="Supprimer"
                                        onClick={() =>
                                            handleDelete(user.id)
                                        }
                                    >

                                        <FaTrash />

                                    </button>


                                </div>

                            )}

                        </div>

                    ))

                )}

            </div>

        </div>

    );

}

export default AdminUtilisateurs;
