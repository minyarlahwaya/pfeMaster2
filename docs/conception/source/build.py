"""Assemble les pages web de conception UML (docs/conception/)."""
import sys, os, html
sys.path.insert(0, os.path.dirname(__file__))
import usecase, classes

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

CSS = """
:root{--red:#c8102e;--ink:#111827;--muted:#4b5563;--line:#e5e7eb;--bg:#f7f7f8}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.55}
header.top{background:#111;color:#fff;padding:14px 28px;display:flex;align-items:center;gap:24px;flex-wrap:wrap}
header.top strong{font-size:18px;letter-spacing:.5px}
header.top strong span{color:var(--red)}
header.top nav a{color:#d1d5db;text-decoration:none;margin-right:18px;font-size:14px}
header.top nav a.on,header.top nav a:hover{color:#fff;border-bottom:2px solid var(--red)}
main{max-width:1280px;margin:0 auto;padding:28px}
h1{font-size:28px;margin:0 0 6px}
h2{font-size:20px;margin:34px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--line)}
p.lead{color:var(--muted);margin:0 0 18px;max-width:900px}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}
.toolbar button{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:7px 14px;font-size:14px;cursor:pointer}
.toolbar button:hover{border-color:var(--red);color:var(--red)}
.toolbar span{color:var(--muted);font-size:13px;margin-left:6px}
.canvas{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:auto;max-height:82vh;padding:10px}
.canvas svg{display:block;height:auto;transition:width .15s}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px}
th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{background:#f3f4f6;font-weight:600}
td code,p code,li code{background:#f3f4f6;border-radius:4px;padding:1px 5px;font-size:12.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;text-decoration:none;color:inherit;transition:box-shadow .2s}
.card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08);border-color:var(--red)}
.card h3{margin:0 0 6px;color:var(--red)}
.legend li{margin:4px 0}
footer{color:var(--muted);font-size:12.5px;text-align:center;padding:30px}
@media print{header.top,.toolbar,footer{display:none}body{background:#fff}main{max-width:none;padding:0}
 .canvas{border:none;max-height:none;overflow:visible;padding:0}.canvas svg{width:100%!important}h2{break-after:avoid}table{break-inside:auto}}
"""

JS = """
<script>
(function(){
  const box=document.querySelector('.canvas'), svg=box.querySelector('svg');
  const natural=svg.viewBox.baseVal.width; let z=0;
  const label=document.getElementById('zoom');
  function fit(){svg.style.width=(box.clientWidth-22)+'px';z=0;label.textContent='Ajusté à la largeur';}
  function set(f){z=f;svg.style.width=(natural*f)+'px';label.textContent=Math.round(f*100)+' %';}
  document.getElementById('fit').onclick=fit;
  document.getElementById('in').onclick=()=>set(Math.min((z||((box.clientWidth-22)/natural))*1.25,3));
  document.getElementById('out').onclick=()=>set(Math.max((z||((box.clientWidth-22)/natural))/1.25,.2));
  document.getElementById('real').onclick=()=>set(1);
  document.getElementById('dl').onclick=function(){
    const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\\n'+svg.outerHTML],{type:'image/svg+xml'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=this.dataset.file;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  document.getElementById('print').onclick=()=>window.print();
  fit(); window.addEventListener('resize',()=>{if(!z)fit();});
})();
</script>"""

def page(fname, title, active, body):
    nav = "".join(
        f'<a href="{f}"{" class=on" if f == active else ""}>{t}</a>'
        for f, t in [("index.html", "Accueil conception"), ("cas-utilisation.html", "Cas d'utilisation"),
                     ("diagramme-classes.html", "Diagramme de classes")])
    doc = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} — LANDOLSI TIRES</title>
<style>{CSS}</style>
</head>
<body>
<header class="top"><strong>LANDOLSI <span>TIRES</span> · Conception UML</strong><nav>{nav}</nav></header>
<main>
{body}
</main>
<footer>Projet de fin d'études — LANDOLSI TIRES · Diagrammes établis à partir du code source (modèles Sequelize, routes Express, interface React) · octobre 2026</footer>
</body>
</html>
"""
    open(os.path.join(OUT, fname), "w", encoding="utf-8").write(doc)

def toolbar(file):
    return f"""<div class="toolbar">
<button id="fit">Ajuster</button><button id="out">− Zoom</button><button id="in">+ Zoom</button><button id="real">100 %</button>
<button id="dl" data-file="{file}">Télécharger le SVG</button><button id="print">Imprimer / PDF</button><span id="zoom"></span>
</div>"""

def table(head, rows):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>"

# ------------------------------------------------------------------
# Cas d'utilisation
# ------------------------------------------------------------------
acteurs = [
    ("Visiteur", "Principal", "Internaute non connecté : consulte et recherche dans le catalogue, gère son panier, crée un compte."),
    ("Client", "Principal (hérite du Visiteur)", "Utilisateur authentifié de rôle <code>client</code> (particulier ou professionnel) : commande, suit, évalue, réclame."),
    ("Administrateur", "Principal", "Utilisateur de rôle <code>admin</code> : gère le catalogue, les commandes, les comptes et le suivi commercial."),
    ("Mistral AI", "Secondaire (système externe)", "API d'IA : conseiller pneus, assistant après-vente, analyse commerciale, lecture de la photo d'un pneu."),
    ("Serveur SMTP", "Secondaire (système externe)", "Gmail via Nodemailer : code de réinitialisation du mot de passe, envoi de la facture PDF à la confirmation."),
    ("Telegram", "Secondaire (système externe)", "Bot de notification de l'administrateur : nouvelle commande, changement de statut."),
]
cas = [
    ("Espace public", "Consulter le catalogue et les fiches pneus", "Visiteur", "<code>GET /pneus/getallpneus</code>, <code>GET /pneus/:id</code>"),
    ("Espace public", "Rechercher des pneus (dimension, marque, saison, immatriculation, photo)", "Visiteur, Mistral AI (photo)", "<code>/pneus/search/…</code>, <code>/vehicules/immatriculation/:immat</code>, <code>/ai/tire-photo/*</code>"),
    ("Espace public", "Consulter les promotions / les avis", "Visiteur", "<code>GET /promotions</code>, <code>GET /avis/pneu/:id</code>"),
    ("Espace public", "Gérer le panier", "Visiteur", "Panier côté navigateur (<code>CartContext</code>, localStorage)"),
    ("Espace public", "Dialoguer avec le conseiller IA", "Visiteur, Mistral AI", "<code>POST /ai/tire-advisor/chat</code>"),
    ("Espace public", "S'inscrire / S'authentifier", "Visiteur", "<code>POST /users/register</code>, <code>/users/login</code>, <code>/users/login/mfa</code>"),
    ("Espace public", "Réinitialiser le mot de passe («extend» S'authentifier)", "Visiteur, Serveur SMTP", "<code>/users/forgot-password</code>, <code>/verify-reset-code</code>, <code>/reset-password</code>"),
    ("Espace client", "Passer une commande («include» Valider le panier)", "Client, Telegram", "<code>POST /commandes</code> : prix et promotions recalculés, stock vérifié"),
    ("Espace client", "Suivre ses commandes / Télécharger sa facture", "Client", "<code>GET /commandes/mes-commandes</code>, <code>/factures/commande/:id/pdf</code>"),
    ("Espace client", "Donner un avis sur un pneu commandé", "Client", "<code>POST /avis</code>"),
    ("Espace client", "Déposer et suivre une réclamation", "Client", "<code>POST /reclamations</code>, <code>GET /reclamations/mes-reclamations</code>"),
    ("Espace client", "Contacter l'assistant après-vente («extend» brouillon de réclamation)", "Client, Mistral AI", "<code>POST /ai/support/chat</code>"),
    ("Espace client", "Gérer son profil / la double authentification", "Client", "<code>PUT /users/updateprofile</code>, <code>/users/mfa/*</code>"),
    ("Espace administrateur", "Gérer les pneus, marques, promotions, compatibilités", "Administrateur", "<code>POST/PUT/DELETE</code> sur <code>/pneus</code>, <code>/marques</code>, <code>/promotions</code>, <code>/compatibilites</code>"),
    ("Espace administrateur", "Gérer les commandes («extend» Confirmer une commande)", "Administrateur, Telegram", "<code>GET /commandes/admin</code>, <code>PUT /commandes/:id/statut</code>"),
    ("Espace administrateur", "Confirmer une commande («include» Générer et envoyer la facture)", "Administrateur, Serveur SMTP", "Passage au statut « confirmée » : facture + PDF par e-mail"),
    ("Espace administrateur", "Gérer les utilisateurs («extend» Réinitialiser la MFA)", "Administrateur", "<code>/users/admin</code>, <code>/users/admin/:id/status</code>, <code>/users/admin/:id/mfa/reset</code>"),
    ("Espace administrateur", "Traiter les réclamations / Modérer les avis", "Administrateur", "<code>PUT /reclamations/:id</code>, <code>DELETE /avis/:id</code>"),
    ("Espace administrateur", "Consulter le tableau de bord / Analyser les ventes avec l'IA", "Administrateur, Mistral AI", "<code>GET /ai/admin/analytics/kpis</code>, <code>POST /ai/admin/analytics/chat</code>"),
]
body = f"""<h1>Diagramme de cas d'utilisation global</h1>
<p class="lead">Vue d'ensemble des fonctionnalités offertes par la plateforme à chaque acteur. Les cas sont regroupés par espace
(public, client, administrateur) ; les relations «include», «extend» et la généralisation précisent les dépendances entre cas.</p>
{toolbar("landolsi-cas-utilisation.svg")}
<div class="canvas">{usecase.SVG}</div>

<h2>Acteurs</h2>
{table(["Acteur", "Type", "Rôle dans le système"], acteurs)}

<h2>Cas d'utilisation et correspondance avec l'application</h2>
{table(["Espace", "Cas d'utilisation", "Acteurs", "Réalisation (API / interface)"], cas)}

<h2>Conventions</h2>
<ul class="legend">
<li><b>Trait plein</b> : association entre un acteur et un cas d'utilisation.</li>
<li><b>Flèche à triangle creux</b> : généralisation (le Client hérite du Visiteur ; les recherches spécialisées héritent de « Rechercher des pneus »).</li>
<li><b>«include»</b> : le cas de base exécute toujours le cas inclus (une commande valide toujours le panier ; une confirmation génère toujours la facture).</li>
<li><b>«extend»</b> : comportement optionnel déclenché sous condition (code MFA si activé, mot de passe oublié, brouillon de réclamation proposé par l'assistant…).</li>
<li>Toutes les actions des espaces client et administrateur exigent une session valide (<code>requireAuth</code> / <code>requireAdmin</code> côté serveur).</li>
</ul>
{JS}"""
page("cas-utilisation.html", "Diagramme de cas d'utilisation", "cas-utilisation.html", body)

# ------------------------------------------------------------------
# Classes
# ------------------------------------------------------------------
dico = [
    ("Utilisateur", "<code>users</code>", "Compte client ou administrateur (rôle), profil particulier / professionnel, double authentification TOTP (secret chiffré AES-256-GCM, codes de secours hachés)."),
    ("Marque", "<code>Marques</code>", "Fabricant de pneus (Michelin, Pirelli…), nom unique et logo."),
    ("Pneu", "<code>Pneus</code>", "Produit du catalogue : dimension (largeur/hauteur/diamètre), saison, prix unitaire en DT, stock, image."),
    ("Promotion", "<code>Promotions</code>", "Remise en pourcentage sur un pneu, active entre <code>dateDebut</code> et <code>dateFin</code>."),
    ("Vehicule", "<code>Vehicules</code>", "Véhicule identifié par son immatriculation, utilisé pour la recherche de pneus compatibles."),
    ("VehiculePneu", "<code>vehicule_pneus</code>", "Classe d'association : compatibilité vérifiée entre un véhicule et un pneu."),
    ("Commande", "<code>commandes</code>", "Commande d'un client (coordonnées de retrait, total, statut) ; retrait en magasin, pas de livraison."),
    ("CommandeItem", "<code>commande_items</code>", "Ligne de commande : quantité, prix payé, prix d'origine et promotion appliquée au moment de l'achat."),
    ("Facture", "<code>factures</code>", "Facture unique créée à la confirmation de la commande, PDF envoyé par e-mail."),
    ("Avis", "<code>avis</code>", "Note (1 à 5) et commentaire d'un client sur un pneu, éventuellement rattachés à une commande."),
    ("Reclamation", "<code>Reclamations</code>", "Demande d'un client (sujet, description), statut de traitement et réponse de l'administrateur."),
]
assoc = [
    ("Utilisateur — Reclamation", "1 — 0..*", "Un utilisateur dépose des réclamations (suppression en cascade)."),
    ("Utilisateur — Commande", "1 — 0..*", "Un client passe des commandes."),
    ("Utilisateur — Avis", "1 — 0..*", "Un client rédige des avis."),
    ("Commande ◆— Facture", "1 — 0..1", "Composition : la facture n'existe que par sa commande (<code>onDelete: CASCADE</code>)."),
    ("Commande ◆— CommandeItem", "1 — 1..*", "Composition : une commande contient au moins une ligne."),
    ("Commande — Avis", "0..1 — 0..*", "Un avis peut être rattaché à la commande d'origine (<code>commandeId</code> facultatif)."),
    ("CommandeItem — Pneu", "0..* — 1", "Chaque ligne porte sur un pneu."),
    ("Pneu — Promotion", "1 — 0..*", "Un pneu peut bénéficier de plusieurs promotions (la plus forte active s'applique)."),
    ("Marque — Pneu", "1 — 0..*", "Une marque fabrique plusieurs pneus ; un pneu a une seule marque."),
    ("Avis — Pneu", "0..* — 1", "Un avis évalue un pneu."),
    ("Pneu — Vehicule (VehiculePneu)", "0..* — 0..*", "Plusieurs-à-plusieurs via la classe d'association <code>VehiculePneu</code>."),
]
body = f"""<h1>Diagramme de classes global</h1>
<p class="lead">Modèle du domaine de la plateforme, établi à partir des modèles Sequelize (<code>backend/models/</code>) et de leurs
associations (<code>backend/models/associations.js</code>). Chaque classe correspond à une table PostgreSQL.</p>
{toolbar("landolsi-diagramme-classes.svg")}
<div class="canvas">{classes.SVG}</div>

<h2>Dictionnaire des classes</h2>
{table(["Classe", "Table", "Description"], dico)}

<h2>Associations et multiplicités</h2>
{table(["Association", "Multiplicités", "Signification"], assoc)}

<h2>Énumérations</h2>
{table(["Énumération", "Valeurs", "Utilisée par"], [
    ("Role", "admin, client", "Utilisateur.role (contrôle d'accès <code>requireAdmin</code>)"),
    ("TypeClient", "particulier, professionnel", "Utilisateur.typeClient (champs entreprise facultatifs)"),
    ("StatutCommande", "en attente → confirmée → en préparation → expédiée → livrée ; annulée", "Commande.statut (la facture est créée au passage à « confirmée »)"),
    ("StatutReclamation", "En attente, En cours, Résolue", "Reclamation.statut"),
])}

<h2>Choix de modélisation</h2>
<ul class="legend">
<li>Les <b>clés étrangères</b> (<code>userId</code>, <code>commandeId</code>, <code>pneuId</code>, <code>marqueId</code>, <code>vehiculeId</code>) ne sont pas répétées comme attributs : elles sont représentées par les associations.</li>
<li>Les attributs techniques <code>createdAt</code> / <code>updatedAt</code>, présents sur toutes les tables (Sequelize), sont omis.</li>
<li>Les <b>opérations</b> correspondent aux traitements métier réalisés par les contrôleurs et services (<code>CommandeController</code>, <code>FactureController</code>, <code>mfaService</code>…) ; elles décrivent la responsabilité de chaque classe, pas des méthodes JavaScript du modèle.</li>
<li><b>Losange plein</b> : composition (cycle de vie lié). <b>Pointillés</b> : classe d'association. Multiplicités en rouge à chaque extrémité.</li>
<li>Les services d'IA (Mistral), d'e-mail et Telegram ne sont pas des classes du domaine : ils apparaissent comme acteurs externes dans le diagramme de cas d'utilisation.</li>
</ul>
{JS}"""
page("diagramme-classes.html", "Diagramme de classes", "diagramme-classes.html", body)

# ------------------------------------------------------------------
# Accueil
# ------------------------------------------------------------------
NUC = len(usecase.E)
body = """<h1>Conception UML — LANDOLSI TIRES</h1>
<p class="lead">Dossier de conception de la plateforme web de vente de pneumatiques. Les diagrammes sont réalisés à partir du code
de l'application (backend Express/Sequelize, frontend React) et reflètent son état réel au 31 octobre 2026, recherche de pneus par photo incluse.</p>
<div class="grid">
<a class="card" href="cas-utilisation.html"><h3>Diagramme de cas d'utilisation global</h3>
<p>3 acteurs principaux (Visiteur, Client, Administrateur), 3 systèmes externes (Mistral AI, SMTP, Telegram), """ + str(NUC) + """ cas d'utilisation répartis en espaces public, client et administrateur.</p></a>
<a class="card" href="diagramme-classes.html"><h3>Diagramme de classes global</h3>
<p>11 classes du domaine (dont une classe d'association), 4 énumérations, 11 associations avec multiplicités, compositions Commande–Facture et Commande–CommandeItem.</p></a>
</div>
<h2>Utilisation</h2>
<ul class="legend">
<li>Pages autonomes : elles s'ouvrent directement dans un navigateur, sans connexion Internet ni serveur.</li>
<li>« Télécharger le SVG » exporte le diagramme en image vectorielle (insertion sans perte dans le rapport Word ou LaTeX).</li>
<li>« Imprimer / PDF » produit une version imprimable (diagramme pleine largeur et tableaux explicatifs).</li>
</ul>
"""
page("index.html", "Conception UML", "index.html", body)

# images vectorielles autonomes
open(os.path.join(OUT, "landolsi-cas-utilisation.svg"), "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n' + usecase.SVG)
open(os.path.join(OUT, "landolsi-diagramme-classes.svg"), "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n' + classes.SVG)
print("pages générées dans", OUT, "| croisements :", usecase.PROBLEMS or "aucun", "/", classes.PROBLEMS or "aucun")
