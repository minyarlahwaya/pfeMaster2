import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import Hero from "../components/Hero/Hero";
import TireSearch from "../components/TireSearch/TireSearch";
import Features from "../components/Features/Feature";
import Brands from "../components/Brands/Brands";
import Products from "../components/Products/Products";
import AvisList from "../components/Avis/AvisList";

function Home() {
  const location = useLocation();

  // Aller à la section demandée après la navigation
  useEffect(() => {
    const sectionId = location.state?.scrollTo;

    if (sectionId) {
      const timer = setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.state]);

  return (
    <>

    <div id="acuille">
     <Hero />

    </div>
     

      <TireSearch />

      <Features />

      <div id="marques">
        <Brands />
      </div>

      <Products />

      <div id="avis">
        <AvisList />
      </div>

      
    </>
  );
}

export default Home;