"""Génère le diagramme de cas d'utilisation global (SVG) de LANDOLSI TIRES."""
import math, html

W = 1440
RX, RY = 132, 26
ROW = 60
C1, C2 = 420, 820
AX = 85            # acteurs principaux
SX = 1300          # acteurs secondaires
SYS = (190, 1130)  # bord gauche / droit du système

E = {}   # cas d'utilisation : id -> (cx, cy, texte)
LINKS = []   # (type, a, b, label)
ACTORS = {}  # id -> (x, y, nom)
ZONES = []

def uc(i, col, y, text):
    E[i] = (C1 if col == 1 else C2, y, text)

def actor(i, x, y, name):
    ACTORS[i] = (x, y, name)

# ---------------- Espace public (Visiteur) ----------------
y0 = 150
r = lambda k: y0 + k * ROW
uc("catalogue", 1, r(0), "Consulter le catalogue et les fiches pneus")
uc("rechercher", 1, r(1), "Rechercher des pneus")
uc("promos", 1, r(2), "Consulter les promotions")
uc("avisc", 1, r(3), "Consulter les avis d'un pneu")
uc("panier", 1, r(4), "Gérer le panier")
uc("conseiller", 1, r(5), "Dialoguer avec le conseiller IA")
uc("inscrire", 1, r(6), "S'inscrire")
uc("auth", 1, r(7), "S'authentifier")
uc("rcrit", 2, r(0) - 10, "Rechercher par dimension, marque ou saison")
uc("rimmat", 2, r(1), "Rechercher par immatriculation")
uc("rphoto", 2, r(2) + 10, "Rechercher par photo du pneu")
uc("mfa", 2, r(7) - 18, "Saisir le code de double authentification")
uc("mdp", 2, r(8), "Réinitialiser le mot de passe")
ZONES.append(("Espace public", 85, r(8) + 45))
actor("visiteur", AX, r(3) + 10, "Visiteur")
actor("mistral1", SX, r(3) + 30, "Mistral AI")
actor("smtp1", SX, r(8) - 10, "Serveur SMTP")

for u in ["catalogue", "rechercher", "promos", "avisc", "panier", "conseiller", "inscrire", "auth"]:
    LINKS.append(("assoc", "visiteur", u, ""))
for u in ["rcrit", "rimmat", "rphoto"]:
    LINKS.append(("gen", u, "rechercher", ""))
LINKS.append(("ext", "mfa", "auth", "«extend»"))
LINKS.append(("ext", "mdp", "auth", "«extend»"))
LINKS.append(("assoc", "mistral1", "conseiller", ""))
LINKS.append(("assoc", "mistral1", "rphoto", ""))
LINKS.append(("assoc", "smtp1", "mdp", ""))

# ---------------- Espace client ----------------
y1 = r(8) + 160
r = lambda k: y1 + k * ROW
uc("commander", 1, r(0), "Passer une commande")
uc("suivre", 1, r(1), "Suivre ses commandes")
uc("facture", 1, r(2), "Télécharger sa facture PDF")
uc("donneravis", 1, r(3), "Donner un avis sur un pneu commandé")
uc("reclamer", 1, r(4), "Déposer et suivre une réclamation")
uc("sav", 1, r(5), "Contacter l'assistant après-vente")
uc("profil", 1, r(6), "Gérer son profil")
uc("gmfa", 1, r(7), "Gérer la double authentification")
uc("brouillon", 2, r(4) - 4, "Préparer un brouillon de réclamation")
uc("valider", 2, r(1) - 4, "Valider le panier (prix, promotions, stock)")
ZONES.append(("Espace client", y1 - 62, r(7) + 45))
actor("client", AX, r(3) + 30, "Client")
actor("telegram1", SX, r(0) + 6, "Telegram")
actor("mistral2", SX, r(5) + 20, "Mistral AI")

for u in ["commander", "suivre", "facture", "donneravis", "reclamer", "sav", "profil", "gmfa"]:
    LINKS.append(("assoc", "client", u, ""))
LINKS.append(("inc", "commander", "valider", "«include»"))
LINKS.append(("ext", "brouillon", "sav", "«extend»"))
LINKS.append(("assoc", "telegram1", "commander", ""))
LINKS.append(("assoc", "mistral2", "sav", ""))

# ---------------- Espace administrateur ----------------
y2 = r(7) + 160
r = lambda k: y2 + k * ROW
uc("gpneus", 1, r(0), "Gérer les pneus (stock, images)")
uc("gmarques", 1, r(1), "Gérer les marques")
uc("gpromos", 1, r(2), "Gérer les promotions")
uc("gcompat", 1, r(3), "Gérer les compatibilités véhicule-pneu")
uc("gcommandes", 1, r(4), "Gérer les commandes")
uc("greclam", 1, r(5), "Traiter les réclamations")
uc("gusers", 1, r(6), "Gérer les utilisateurs")
uc("gavis", 1, r(7), "Modérer les avis")
uc("dashboard", 1, r(8), "Consulter le tableau de bord")
uc("analyse", 1, r(9), "Analyser les ventes avec l'assistant IA")
uc("confirmer", 2, r(5) + 4, "Confirmer une commande")
uc("envoyerfact", 2, r(6) + 24, "Générer et envoyer la facture par e-mail")
uc("resetmfa", 2, r(8) + 4, "Réinitialiser la MFA d'un utilisateur")
ZONES.append(("Espace administrateur", y2 - 62, r(9) + 45))
actor("admin", AX, r(4) + 30, "Administrateur")
actor("telegram2", SX, r(3) + 10, "Telegram")
actor("smtp2", SX, r(6) + 10, "Serveur SMTP")
actor("mistral3", SX, r(9), "Mistral AI")

for u in ["gpneus", "gmarques", "gpromos", "gcompat", "gcommandes", "gusers", "greclam", "gavis", "dashboard", "analyse"]:
    LINKS.append(("assoc", "admin", u, ""))
LINKS.append(("ext", "confirmer", "gcommandes", "«extend»"))
LINKS.append(("inc", "confirmer", "envoyerfact", "«include»"))
LINKS.append(("ext", "resetmfa", "gusers", "«extend»"))
LINKS.append(("assoc", "telegram2", "gcommandes", ""))
LINKS.append(("assoc", "smtp2", "envoyerfact", ""))
LINKS.append(("assoc", "mistral3", "analyse", ""))

# Client hérite de Visiteur
LINKS.append(("agen", "client", "visiteur", ""))

H = r(9) + 130

def arc(actor_id, ids, k=0.55):
    ay = ACTORS[actor_id][1]
    dmax = max(abs(E[i][1] - ay) for i in ids)
    for i in ids:
        cx, cy, t = E[i]
        E[i] = (C1 - 40 + k * (dmax - abs(cy - ay)), cy, t)

arc("visiteur", ["catalogue", "rechercher", "promos", "avisc", "panier", "conseiller", "inscrire", "auth"])
arc("client", ["commander", "suivre", "facture", "donneravis", "reclamer", "sav", "profil", "gmfa"])
arc("admin", ["gpneus", "gmarques", "gpromos", "gcompat", "gcommandes", "gusers", "greclam", "gavis", "dashboard", "analyse"])

# ---------------- géométrie ----------------
def ell_point(cx, cy, tx, ty):
    dx, dy = tx - cx, ty - cy
    t = 1 / math.sqrt((dx / RX) ** 2 + (dy / RY) ** 2)
    return cx + dx * t, cy + dy * t

def anchor(i, tx, ty):
    if i in E:
        cx, cy, _ = E[i]
        return ell_point(cx, cy, tx, ty)
    x, y, _ = ACTORS[i]
    # acteur : point de départ au niveau des mains, côté de la cible
    return (x + (28 if tx > x else -28), y + 2)

def center(i):
    return E[i][:2] if i in E else ACTORS[i][:2]

def seg_hits_ellipse(p, q, cx, cy, margin=6):
    # échantillonnage : le segment entre-t-il dans l'ellipse (élargie) ?
    for k in range(1, 200):
        t = k / 200
        x, y = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
        if ((x - cx) / (RX + margin)) ** 2 + ((y - cy) / (RY + margin)) ** 2 < 1:
            return True
    return False

PROBLEMS = []
SEGS = []
for kind, a, b, label in LINKS:
    ca, cb = center(a), center(b)
    if kind == "agen":
        xa, ya, _ = ACTORS[a]; xb, yb, _ = ACTORS[b]
        p, q = (xa, ya - 42), (xb, yb + 62)
    elif kind == "assoc" and a in ACTORS and b in E:
        # vise le flanc de l'ellipse du côté de l'acteur : premier point de contact
        cx, cy, _ = E[b]
        p = anchor(a, cx, cy)
        side = -1 if p[0] < cx else 1
        aim = (cx + side * RX * 0.8, cy)
        q = aim
        for k in range(0, 1001):
            t = k / 1000
            x, y = p[0] + (aim[0] - p[0]) * t, p[1] + (aim[1] - p[1]) * t
            if ((x - cx) / RX) ** 2 + ((y - cy) / RY) ** 2 <= 1:
                q = (x, y); break
    else:
        p = anchor(a, *cb)
        q = anchor(b, *ca)
    SEGS.append((kind, a, b, label, p, q))
    for i, (cx, cy, _) in E.items():
        if i in (a, b):
            continue
        if seg_hits_ellipse(p, q, cx, cy):
            PROBLEMS.append(f"{a} -> {b} traverse {i}")

# ---------------- rendu SVG ----------------
def wrap(text, n=26):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    return lines

out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Segoe UI, DejaVu Sans, Arial, sans-serif" role="img" aria-labelledby="uc-title">',
       '<title id="uc-title">Diagramme de cas d\'utilisation global — LANDOLSI TIRES</title>',
       '<defs>',
       '<marker id="open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M1,1 L11,6 L1,11" fill="none" stroke="#333" stroke-width="1.4"/></marker>',
       '<marker id="tri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="15" markerHeight="15" orient="auto-start-reverse"><path d="M1,1 L13,7 L1,13 Z" fill="#fff" stroke="#333" stroke-width="1.3"/></marker>',
       '</defs>',
       f'<rect width="{W}" height="{H}" fill="#ffffff"/>']

# système
top, bottom = 40, H - 40
out.append(f'<rect x="{SYS[0]}" y="{top}" width="{SYS[1]-SYS[0]}" height="{bottom-top}" rx="6" fill="#fbfbfd" stroke="#1f2937" stroke-width="1.6"/>')
out.append(f'<text x="{(SYS[0]+SYS[1])/2}" y="{top+30}" text-anchor="middle" font-size="20" font-weight="700" fill="#111">Plateforme web LANDOLSI TIRES</text>')
colors = {"Espace public": "#eef6ff", "Espace client": "#f0fbf3", "Espace administrateur": "#fff5f0"}
for name, za, zb in ZONES:
    out.append(f'<rect x="{SYS[0]+18}" y="{za}" width="{SYS[1]-SYS[0]-36}" height="{zb-za}" rx="10" fill="{colors[name]}" stroke="#9ca3af" stroke-dasharray="6 4"/>')
    out.append(f'<text x="{SYS[0]+34}" y="{za+22}" font-size="14" font-weight="700" fill="#4b5563">{html.escape(name)}</text>')

# liens (sous les ellipses)
for kind, a, b, label, p, q in SEGS:
    dash = ' stroke-dasharray="7 5"' if kind in ("inc", "ext") else ""
    marker = ""
    if kind in ("inc", "ext"): marker = ' marker-end="url(#open)"'
    if kind in ("gen", "agen"): marker = ' marker-end="url(#tri)"'
    out.append(f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="#374151" stroke-width="1.3"{dash}{marker}/>')
    if label:
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        out.append(f'<rect x="{mx-30:.1f}" y="{my-17:.1f}" width="60" height="15" rx="3" fill="#ffffff" opacity="0.9"/>')
        out.append(f'<text x="{mx:.1f}" y="{my-5.5:.1f}" font-size="11.5" font-style="italic" fill="#4b5563" text-anchor="middle">{html.escape(label)}</text>')

# cas d'utilisation
for i, (cx, cy, text) in E.items():
    out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{RX}" ry="{RY}" fill="#fffbe6" stroke="#a16207" stroke-width="1.4"/>')
    lines = wrap(text)
    for k, line in enumerate(lines):
        dy = (k - (len(lines) - 1) / 2) * 15 + 4.5
        out.append(f'<text x="{cx}" y="{cy+dy:.1f}" text-anchor="middle" font-size="13" fill="#111">{html.escape(line)}</text>')

# acteurs
for i, (x, y, name) in ACTORS.items():
    secondary = x > SYS[1]
    col = "#7c3aed" if secondary else "#111"
    out.append(f'<g stroke="{col}" stroke-width="2" fill="none"><circle cx="{x}" cy="{y-30}" r="11" fill="#fff"/>'
               f'<line x1="{x}" y1="{y-19}" x2="{x}" y2="{y+14}"/><line x1="{x-22}" y1="{y-6}" x2="{x+22}" y2="{y-6}"/>'
               f'<line x1="{x}" y1="{y+14}" x2="{x-16}" y2="{y+38}"/><line x1="{x}" y1="{y+14}" x2="{x+16}" y2="{y+38}"/></g>')
    out.append(f'<text x="{x}" y="{y+56}" text-anchor="middle" font-size="14" font-weight="700" fill="{col}">{html.escape(name)}</text>')
    if secondary:
        out.append(f'<text x="{x}" y="{y+71}" text-anchor="middle" font-size="11" fill="#6b7280">«système externe»</text>')

# note (hors du système, en haut à droite)
nx, ny = SYS[1] + 22, 40
note = ["Les cas des espaces client et", "administrateur incluent", "«S'authentifier» (session,", "code MFA si activée).", "", "Le Client hérite de tous", "les cas du Visiteur.", "", "Les acteurs externes sont", "répétés dans chaque espace", "pour la lisibilité."]
out.append(f'<path d="M{nx},{ny} h240 v{len(note)*16+4} l-14,14 h-226 z" fill="#fffde7" stroke="#a3a3a3"/>')
for k, line in enumerate(note):
    out.append(f'<text x="{nx+10}" y="{ny+20+k*16}" font-size="12" fill="#374151">{html.escape(line)}</text>')
out.append('</svg>')

SVG = "\n".join(out)
if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w").write(SVG)
    print("hauteur", H, "| problèmes :", PROBLEMS or "aucun")
