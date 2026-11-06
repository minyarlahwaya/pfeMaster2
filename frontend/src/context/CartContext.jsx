
import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import { getAllPromotions } from "../services/promotionApi";

const CartContext = createContext();

// Appliquer la promotion à un pneu
const appliquerPromotion = (pneu, promotions) => {

    const prixOriginal = Number(
        pneu.prixOriginal ?? pneu.prix
    );

    const promotion = promotions.find(
        (promo) =>
            Number(promo.pneuId) === Number(pneu.id) &&
            promo.active === true
    );

    if (!promotion) {
        return {
            ...pneu,
            prixOriginal,
            prix: prixOriginal,
            pourcentagePromotion: 0,
            promotionId: null
        };
    }

    const pourcentage = Number(promotion.pourcentage);

    const prixPromotion = Number(
        (
            prixOriginal *
            (1 - pourcentage / 100)
        ).toFixed(2)
    );

    return {
        ...pneu,
        prixOriginal,
        prix: prixPromotion,
        pourcentagePromotion: pourcentage,
        promotionId: promotion.id
    };
};

export function CartProvider({ children }) {

    const [cartItems, setCartItems] = useState(() => {

        try {
            const savedCart = localStorage.getItem("cart");

            return savedCart ? JSON.parse(savedCart) : [];

        } catch (error) {
            console.error("Erreur lecture panier :", error);
            return [];
        }

    });

    const [promotions, setPromotions] = useState([]);

    const [notification, setNotification] = useState(null);

    // Récupérer les promotions actives
    useEffect(() => {

        let actif = true;

        const chargerPromotions = async () => {

            try {

                const response = await getAllPromotions();

                const promotionsRecues = Array.isArray(response.data)
                    ? response.data
                    : response.data?.promotions || [];

                if (!actif) return;

                setPromotions(promotionsRecues);

                // Actualiser les prix des articles déjà dans le panier
                setCartItems((currentItems) =>
                    currentItems.map((item) =>
                        appliquerPromotion(item, promotionsRecues)
                    )
                );

            } catch (error) {

                console.error(
                    "Erreur récupération promotions :",
                    error
                );

            }

        };

        chargerPromotions();

        return () => {
            actif = false;
        };

    }, []);

    // Sauvegarder le panier
    useEffect(() => {

        localStorage.setItem(
            "cart",
            JSON.stringify(cartItems)
        );

    }, [cartItems]);

    // Notification
    const showNotification = (message) => {

        setNotification({ message });

        setTimeout(() => {
            setNotification(null);
        }, 3000);

    };

    // Ajouter au panier
    const addToCart = (pneu, quantity = 1) => {

        const pneuAvecPromotion = appliquerPromotion(
            pneu,
            promotions
        );

        setCartItems((currentItems) => {

            const existingItem = currentItems.find(
                (item) => item.id === pneu.id
            );

            if (existingItem) {

                const nouvelleQuantite =
                    Number(existingItem.quantity) +
                    Number(quantity);

                const quantiteFinale = Math.min(
                    nouvelleQuantite,
                    Number(pneu.stock)
                );

                return currentItems.map((item) =>

                    item.id === pneu.id
                        ? {
                            ...pneuAvecPromotion,
                            quantity: quantiteFinale
                        }
                        : item

                );

            }

            const quantiteFinale = Math.min(
                Number(quantity),
                Number(pneu.stock)
            );

            return [
                ...currentItems,
                {
                    ...pneuAvecPromotion,
                    quantity: quantiteFinale
                }
            ];

        });

        showNotification(
            `${pneu.modele} a été ajouté au panier`
        );

    };

    // Augmenter quantité
    const increaseQuantity = (id) => {

        setCartItems((currentItems) =>

            currentItems.map((item) => {

                if (item.id !== id) return item;

                const nouvelleQuantite =
                    Number(item.quantity) + 1;

                if (nouvelleQuantite > Number(item.stock)) {
                    return item;
                }

                return {
                    ...item,
                    quantity: nouvelleQuantite
                };

            })

        );

    };

    // Diminuer quantité
    const decreaseQuantity = (id) => {

        setCartItems((currentItems) =>

            currentItems
                .map((item) => {

                    if (item.id !== id) return item;

                    return {
                        ...item,
                        quantity: Number(item.quantity) - 1
                    };

                })
                .filter((item) => Number(item.quantity) > 0)

        );

    };

    // Supprimer un article
    const removeFromCart = (id) => {

        setCartItems((currentItems) =>
            currentItems.filter((item) => item.id !== id)
        );

    };

    // Vider le panier
    const clearCart = () => {
        setCartItems([]);
    };

    // Nombre total d'articles
    const cartCount = cartItems.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    // Total avec les prix promotionnels
    const cartTotal = cartItems.reduce(
        (total, item) =>
            total +
            Number(item.prix) * Number(item.quantity),
        0
    );

    return (

        <CartContext.Provider
            value={{
                cartItems,
                addToCart,
                increaseQuantity,
                decreaseQuantity,
                removeFromCart,
                clearCart,
                cartCount,
                cartTotal,
                notification,
                setNotification
            }}
        >
            {children}
        </CartContext.Provider>

    );

}

export function useCart() {
    return useContext(CartContext);
}
