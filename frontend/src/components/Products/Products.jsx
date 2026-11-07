
import { useEffect, useState } from "react";
import "./Products.css";
import ProductCard from "./ProductCard";
import { getAllPneus } from "../../services/pneuApi";

function Products() {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const chargerPneus = async () => {
      try {
        const response = await getAllPneus();

        if (response.data.success) {
          const pneusDisponibles = (response.data.pneus || [])
            .filter((pneu) => pneu.stock > 0)
            .slice(0, 4);

          setProducts(pneusDisponibles);
        } else {
          setError("Impossible de charger les pneus.");
        }
      } catch (err) {
        console.error("Erreur chargement des pneus :", err);
        setError("Impossible de charger les pneus. Vérifiez le serveur.");
      } finally {
        setLoading(false);
      }
    };

    chargerPneus();
  }, []);

  return (
    <section className="products" id="pneus-populaires">
      <h2>Nos pneus populaires</h2>

      {loading ? (
        <p className="products-message">Chargement des pneus...</p>
      ) : error ? (
        <p className="products-message">{error}</p>
      ) : products.length === 0 ? (
        <p className="products-message">
          Aucun pneu disponible pour le moment.
        </p>
      ) : (
        <div className="products-container">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="products-animation" aria-hidden="true">
  <span></span>
</div>
    </section>
  );
}

export default Products;
