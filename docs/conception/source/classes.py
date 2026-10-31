"""Génère le diagramme de classes global (SVG) de LANDOLSI TIRES
à partir des modèles Sequelize (backend/models) et de associations.js."""
import html

LH = 17        # hauteur d'une ligne
PAD = 7
HEAD = 30
CW = 7.1       # largeur moyenne d'un caractère (13 px)

# nom, stéréotype, attributs, opérations, x, y, largeur
CLASSES = {}

def cls(cid, name, attrs, ops=(), x=0, y=0, w=300, stereo=None, abstract=False):
    CLASSES[cid] = dict(name=name, attrs=list(attrs), ops=list(ops), x=x, y=y, w=w, stereo=stereo)

COL = [30, 500, 950, 1400, 1850]

cls("user", "Utilisateur", [
    "- id : Integer {PK}",
    "- nom : String",
    "- prenom : String",
    "- email : String {unique}",
    "- password : String {haché bcrypt}",
    "- telephone : String",
    "- adresse : Text",
    "- ville : String",
    "- codePostal : String",
    "- pays : String",
    "- typeClient : TypeClient",
    "- raisonSociale : String [0..1]",
    "- activite : String [0..1]",
    "- identifiantEntreprise : String [0..1]",
    "- numeroTVA : String [0..1]",
    "- secteur : String [0..1]",
    "- role : Role",
    "- isActive : Boolean",
    "- resetPasswordCode : String [0..1]",
    "- resetPasswordExpires : Date [0..1]",
    "- mfaEnabled : Boolean",
    "- mfaSecret : String [0..1] {chiffré}",
    "- mfaTempSecret : String [0..1]",
    "- mfaLastUsedStep : BigInt [0..1]",
    "- mfaRecoveryCodes : JSONB [0..1]",
], [
    "+ sInscrire()",
    "+ seConnecter(email, motDePasse)",
    "+ validerCodeMfa(code) : Boolean",
    "+ modifierProfil()",
    "+ reinitialiserMotDePasse(code, nouveau)",
], x=COL[0], y=60, w=330)

cls("reclam", "Reclamation", [
    "- id : Integer {PK}",
    "- sujet : String",
    "- description : Text",
    "- statut : StatutReclamation",
    "- reponseAdmin : Text [0..1]",
], ["+ repondre(texte)"], x=COL[1], y=60, w=300)

cls("commande", "Commande", [
    "- id : Integer {PK}",
    "- nom : String",
    "- prenom : String",
    "- telephone : String",
    "- adresse : String",
    "- ville : String",
    "- codePostal : String",
    "- total : Float",
    "- statut : StatutCommande",
], ["+ calculerTotal() : Float", "+ changerStatut(s : StatutCommande)"], x=COL[1], y=330, w=300)

cls("avis", "Avis", [
    "- id : Integer {PK}",
    "- note : Integer {1..5}",
    "- commentaire : Text [0..1]",
], [], x=COL[1], y=720, w=300)

cls("facture", "Facture", [
    "- id : Integer {PK}",
    "- numeroFacture : String {unique}",
    "- dateFacture : Date",
    "- statut : String",
], ["+ genererPDF() : Buffer", "+ envoyerParEmail()"], x=COL[2], y=60, w=300)

cls("item", "CommandeItem", [
    "- id : Integer {PK}",
    "- quantite : Integer",
    "- prix : Float",
    "- prixOriginal : Float",
    "- pourcentagePromotion : Float",
], ["+ sousTotal() : Float"], x=COL[2], y=390, w=300)

cls("promo", "Promotion", [
    "- id : Integer {PK}",
    "- pourcentage : Float",
    "- dateDebut : Date",
    "- dateFin : Date",
    "- active : Boolean",
], ["+ estEnCours(date) : Boolean"], x=COL[3], y=60, w=300)

cls("pneu", "Pneu", [
    "- id : Integer {PK}",
    "- modele : String",
    "- dimension : String",
    "- largeur : Integer",
    "- hauteur : Integer",
    "- diametre : Integer",
    "- saison : String",
    "- prix : Float",
    "- stock : Integer",
    "- description : Text [0..1]",
    "- image : String",
], ["+ prixEffectif() : Float", "+ estDisponible() : Boolean"], x=COL[3], y=330, w=300)

cls("marque", "Marque", [
    "- id : Integer {PK}",
    "- nom : String {unique}",
    "- logo : String [0..1]",
], [], x=COL[4], y=420, w=230)

cls("vehicule", "Vehicule", [
    "- id : Integer {PK}",
    "- immatriculation : String {unique}",
    "- marque : String",
    "- modele : String",
    "- annee : Integer",
    "- dateImmatriculation : Date",
    "- carburant : String",
    "- variante : String",
    "- moteur : String",
    "- type : String",
    "- puissanceFiscale : String",
    "- description : String",
    "- image : String",
], ["+ rechercherParImmatriculation(immat)"], x=COL[3], y=800, w=300)

cls("vp", "VehiculePneu", ["- id : Integer {PK}"], [], x=COL[4], y=660, w=230)

# Énumérations
cls("role", "Role", ["admin", "client"], x=COL[0], y=720, w=150, stereo="enumeration")
cls("type", "TypeClient", ["particulier", "professionnel"], x=COL[0] + 175, y=720, w=155, stereo="enumeration")
cls("statc", "StatutCommande", ["en attente", "confirmée", "en préparation", "expédiée", "livrée", "annulée"],
    x=COL[0], y=870, w=170, stereo="enumeration")
cls("statr", "StatutReclamation", ["En attente", "En cours", "Résolue"], x=COL[0] + 185, y=870, w=170, stereo="enumeration")

def geom(c):
    head = HEAD + (14 if c["stereo"] else 0)
    ha = len(c["attrs"]) * LH + 2 * PAD
    ho = (len(c["ops"]) * LH + 2 * PAD) if (c["ops"] or not c["stereo"]) else 0
    if not c["ops"] and not c["stereo"]:
        ho = 12
    c["head"], c["ha"], c["ho"] = head, ha, ho
    c["h"] = head + ha + ho
for c in CLASSES.values():
    geom(c)
    longest = max([len(c["name"]) + 4] + [len(t) for t in c["attrs"] + c["ops"]])
    c["w"] = max(c["w"], int(longest * CW + 24))

def side(cid, s, f=0.5):
    """Point sur un côté de la boîte : s in N,S,E,W ; f = position relative."""
    c = CLASSES[cid]
    x, y, w, h = c["x"], c["y"], c["w"], c["h"]
    return {"N": (x + w * f, y), "S": (x + w * f, y + h), "W": (x, y + h * f), "E": (x + w, y + h * f)}[s]

# ---------------------------------------------------------------
# Associations : (a, côté, f, b, côté, f, multA, multB, nom, type, waypoints)
#   type : assoc | compo (losange plein côté a) | assoc-class
# ---------------------------------------------------------------
REL = []
def rel(a, sa, fa, b, sb, fb, ma, mb, name, kind="assoc", via=None, name_pos=0.5):
    REL.append(dict(a=a, sa=sa, fa=fa, b=b, sb=sb, fb=fb, ma=ma, mb=mb, name=name, kind=kind, via=via or [], np=name_pos))

def ycen(cid, f):
    c = CLASSES[cid]; return c["y"] + c["h"] * f

rel("user", "E", 0.14, "reclam", "W", None, "1", "0..*", "dépose ▸")
rel("user", "E", 0.70, "commande", "W", None, "1", "0..*", "passe ▸")
rel("user", "E", 0.96, "avis", "W", 0.5, "1", "0..*", "rédige ▾")
rel("commande", "E", 0.18, "facture", "W", 0.5, "1", "0..1", "génère ▴", kind="compo")
rel("commande", "E", 0.55, "item", "W", None, "1", "1..*", "contient ▸", kind="compo")
rel("commande", "S", 0.5, "avis", "N", 0.5, "0..1", "0..*", "concerne ▴")
rel("item", "E", 0.5, "pneu", "W", None, "0..*", "1", "porte sur ▸")
rel("pneu", "N", 0.5, "promo", "S", 0.5, "1", "0..*", "s'applique à ▾")
rel("marque", "W", 0.5, "pneu", "E", None, "1", "0..*", "◂ fabrique")
rel("avis", "E", 0.6, "pneu", "S", 0.2, "0..*", "1", "évalue ▴", via="avis-pneu")
rel("pneu", "S", 0.75, "vehicule", "N", 0.75, "0..*", "0..*", "équipe ▾", kind="mn")

# ---------------------------------------------------------------
# Rendu
# ---------------------------------------------------------------
W = max(c["x"] + c["w"] for c in CLASSES.values()) + 40
H = max(c["y"] + c["h"] for c in CLASSES.values()) + 60
out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Segoe UI, DejaVu Sans, Arial, sans-serif" role="img" aria-labelledby="cd-title">',
       '<title id="cd-title">Diagramme de classes global — LANDOLSI TIRES</title>',
       '<defs><marker id="dia" viewBox="0 0 20 12" refX="1" refY="6" markerWidth="20" markerHeight="12" orient="auto-start-reverse"><path d="M1,6 L10,1 L19,6 L10,11 Z" fill="#1f2937" stroke="#1f2937"/></marker></defs>',
       f'<rect width="{W}" height="{H}" fill="#fff"/>']

PROBLEMS = []
def box_hit(p, q, skip):
    for cid, c in CLASSES.items():
        if cid in skip: continue
        for k in range(1, 100):
            t = k / 100
            x, y = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
            if c["x"] - 4 < x < c["x"] + c["w"] + 4 and c["y"] - 4 < y < c["y"] + c["h"] + 4:
                return cid
    return None

def mult_label(pt, s, text, offset_side=1):
    x, y = pt
    dx, dy = {"E": (10, 16), "W": (-8, 16), "N": (8, -6), "S": (8, 16)}[s]
    anchor = "end" if s == "W" else "start"
    return f'<text x="{x+dx:.1f}" y="{y+dy:.1f}" font-size="12.5" font-weight="700" fill="#b91c1c" text-anchor="{anchor}">{html.escape(text)}</text>'

LABELS = []
MN_MID = None
for r in REL:
    a, b = CLASSES[r["a"]], CLASSES[r["b"]]
    p = side(r["a"], r["sa"], r["fa"])
    if r["fb"] is None:  # aligné horizontalement sur p
        q = (b["x"] + b["w"] if r["sb"] == "E" else b["x"], p[1])
    else:
        q = side(r["b"], r["sb"], r["fb"])
    pts = [p]
    if r["via"] == "avis-pneu":
        pts += [(q[0], p[1])]
    elif r["sa"] in "EW" and r["sb"] in "EW" and abs(p[1] - q[1]) > 1:
        mx = (p[0] + q[0]) / 2
        pts += [(mx, p[1]), (mx, q[1])]
    elif r["sa"] in "NS" and r["sb"] in "NS" and abs(p[0] - q[0]) > 1:
        my = (p[1] + q[1]) / 2
        pts += [(p[0], my), (q[0], my)]
    pts.append(q)
    for i in range(len(pts) - 1):
        hit = box_hit(pts[i], pts[i + 1], {r["a"], r["b"]})
        if hit: PROBLEMS.append(f'{r["a"]}-{r["b"]} traverse {hit}')
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    marker = ""
    out.append(f'<path d="{d}" fill="none" stroke="#1f2937" stroke-width="1.5"{marker}/>')
    LABELS.append(mult_label(p, r["sa"], r["ma"]))
    LABELS.append(mult_label(q, r["sb"], r["mb"]))
    # nom de l'association
    segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    verts = [sg for sg in segs if abs(sg[0][0] - sg[1][0]) < 1 and abs(sg[0][1] - sg[1][1]) > 1]
    if len(segs) == 1 and abs(p[1] - q[1]) < 1:          # droit horizontal
        mx, my = (p[0] + q[0]) / 2, p[1]
        tx, ty, anchor = mx, my - 8, "middle"
    elif verts:                                          # coude ou vertical
        s0, s1 = max(verts, key=lambda sg: abs(sg[0][1] - sg[1][1]))
        mx, my = s0[0], (s0[1] + s1[1]) / 2
        tx, ty, anchor = mx + 8, my + 4, "start"
    else:
        s0, s1 = max(segs, key=lambda sg: abs(sg[0][0] - sg[1][0]))
        mx, my = (s0[0] + s1[0]) / 2, s0[1]
        tx, ty, anchor = mx, my - 8, "middle"
    if r["kind"] == "mn":
        MN_MID = (mx, my)
        tx, anchor = mx - 8, "end"   # à gauche : la classe d'association part à droite
    LABELS.append(f'<text x="{tx:.1f}" y="{ty:.1f}" font-size="12" font-style="italic" fill="#374151" text-anchor="{anchor}">{html.escape(r["name"])}</text>')
    # losange de composition, dessiné côté composite (a)
    if r["kind"] == "compo":
        nx_, ny_ = pts[1][0] - p[0], pts[1][1] - p[1]
        ln = (nx_ ** 2 + ny_ ** 2) ** 0.5 or 1
        ux, uy = nx_ / ln, ny_ / ln
        vx, vy = -uy, ux
        pa = p; pb = (p[0] + ux * 10 + vx * 6, p[1] + uy * 10 + vy * 6)
        pc = (p[0] + ux * 20, p[1] + uy * 20); pd = (p[0] + ux * 10 - vx * 6, p[1] + uy * 10 - vy * 6)
        LABELS.append('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in (pa, pb, pc, pd)) + '" fill="#1f2937" stroke="#1f2937"/>')

# classe d'association VehiculePneu reliée en pointillés au lien Pneu–Vehicule
if MN_MID:
    vp = CLASSES["vp"]
    tgt = (vp["x"], vp["y"] + vp["h"] / 2)
    out.append(f'<path d="M{MN_MID[0]:.1f},{MN_MID[1]:.1f} L{tgt[0]:.1f},{MN_MID[1]:.1f} L{tgt[0]:.1f},{tgt[1]:.1f}" fill="none" stroke="#1f2937" stroke-width="1.3" stroke-dasharray="6 4"/>' if abs(MN_MID[1]-tgt[1]) > 1 else
               f'<line x1="{MN_MID[0]:.1f}" y1="{MN_MID[1]:.1f}" x2="{tgt[0]:.1f}" y2="{tgt[1]:.1f}" stroke="#1f2937" stroke-width="1.3" stroke-dasharray="6 4"/>')

# boîtes
for cid, c in CLASSES.items():
    x, y, w = c["x"], c["y"], c["w"]
    enum = c["stereo"] == "enumeration"
    fill = "#eef2ff" if enum else ("#f1f5f9" if cid == "vp" else "#fffbeb")
    head_fill = "#c7d2fe" if enum else ("#cbd5e1" if cid == "vp" else "#fde68a")
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{c["h"]}" fill="{fill}" stroke="#1f2937" stroke-width="1.4"/>')
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{c["head"]}" fill="{head_fill}" stroke="#1f2937" stroke-width="1.4"/>')
    ty = y + 20
    if c["stereo"]:
        out.append(f'<text x="{x+w/2}" y="{ty-2}" text-anchor="middle" font-size="11.5" fill="#374151">«{c["stereo"]}»</text>')
        ty += 14
    out.append(f'<text x="{x+w/2}" y="{ty}" text-anchor="middle" font-size="15" font-weight="700" fill="#111">{html.escape(c["name"])}</text>')
    yy = y + c["head"]
    out.append(f'<line x1="{x}" y1="{yy}" x2="{x+w}" y2="{yy}" stroke="#1f2937"/>')
    for k, a in enumerate(c["attrs"]):
        out.append(f'<text x="{x+10}" y="{yy+PAD+13+k*LH}" font-size="13" fill="#111">{html.escape(a)}</text>')
    if c["ho"]:
        yy += c["ha"]
        out.append(f'<line x1="{x}" y1="{yy}" x2="{x+w}" y2="{yy}" stroke="#1f2937"/>')
        for k, o in enumerate(c["ops"]):
            out.append(f'<text x="{x+10}" y="{yy+PAD+13+k*LH}" font-size="13" fill="#111">{html.escape(o)}</text>')

out += LABELS
out.append("</svg>")
SVG = "\n".join(out)

if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w").write(SVG)
    print("taille", W, "x", H, "| problèmes :", PROBLEMS or "aucun")
    for cid, c in CLASSES.items():
        print(f"  {cid:9s} x={c['x']:5} y={c['y']:4} w={c['w']:4} h={c['h']:4} bas={c['y']+c['h']}")
