import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import PneuDetail from "../components/pneus/PneuDetail";

import { getPneuById } from "../services/pneuApi";


function PneuDetails() {

    const { id } = useParams();

    const [pneu, setPneu] = useState(null);

    const [loading, setLoading] = useState(true);


    useEffect(() => {

        const fetchPneu = async () => {

            try {

                const response = await getPneuById(id);

                console.log("Pneu reçu :", response.data);

                setPneu(response.data.pneu);

            } catch (error) {

                console.error("Erreur :", error);

            } finally {

                setLoading(false);

            }

        };

        fetchPneu();

    }, [id]);


    if (loading) {
        return <h2>Chargement...</h2>;
    }


    if (!pneu) {
        return <h2>Pneu introuvable</h2>;
    }


    return (
        <>
            <PneuDetail pneu={pneu} />

           
        </>
    );
}


export default PneuDetails;