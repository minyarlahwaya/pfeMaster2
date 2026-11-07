# LANDOLSI TIRES — Plateforme web de vente de pneumatiques

Application web responsive réalisée dans le cadre du projet de fin d'études (PFE). Elle permet aux clients de consulter un catalogue de pneus, de rechercher des produits adaptés à leur véhicule, de gérer un panier et des commandes, puis de consulter les informations de facturation. Un espace d'administration permet de gérer les données commerciales. Le projet comprend également un chatbot et des notifications Telegram côté serveur.

> **Dépôt :** https://github.com/ngrassa/projet_Landolsi — nouvel historique Git, créé à partir de l'ancien dépôt `pfeMaster_minyar`. Les changements apportés sont résumés en [§0](#0-modifications-apportées-au-projet-initial).
>
> **Important — sécurité :** dans l'ancien dépôt, `backend/.env` était versionné. Ce nouveau dépôt ne contient ni ce fichier ni l'ancien historique, mais **les secrets qu'il contenait (mot de passe SMTP, clé Gemini, jeton Telegram, mots de passe base et administrateur) restent visibles dans l'ancien dépôt et doivent être révoqués et remplacés**. Le modèle `backend/.env.example` ne contient que des noms de variables ; `backend/.env` est ignoré par Git.

## Sommaire

- [0. Modifications apportées au projet initial](#0-modifications-apportées-au-projet-initial)
- [1. Présentation](#1-présentation)
- [2. Fonctionnalités](#2-fonctionnalités)
- [3. Technologies](#3-technologies)
- [4. Architecture du dépôt](#4-architecture-du-dépôt)
- [5. Prérequis](#5-prérequis)
- [6. Récupérer le projet depuis une URL Git](#6-récupérer-le-projet-depuis-une-url-git)
- [7. Base de données Supabase](#7-base-de-données-supabase)
- [8. Configurer le backend](#8-configurer-le-backend)
- [9. Configurer le frontend](#9-configurer-le-frontend)
- [10. Démarrer l'application](#10-démarrer-lapplication)
- [11. URLs locales](#11-urls-locales)
- [12. Principaux modules et API](#12-principaux-modules-et-api)
- [13. Parcours utilisateur](#13-parcours-utilisateur)
- [14. Parcours administrateur](#14-parcours-administrateur)
- [15. Chatbot et Telegram](#15-chatbot-et-telegram)
- [15 bis. Assistants IA Mistral](#15-bis-assistants-ia-mistral)
- [16. Vérifications et tests](#16-vérifications-et-tests)
- [17. Problèmes fréquents](#17-problèmes-fréquents)
- [18. Préparer la livraison finale](#18-préparer-la-livraison-finale)
- [19. Limites et améliorations](#19-limites-et-améliorations)
- [20. Déploiement en production (AWS EC2 Ubuntu)](#20-déploiement-en-production-aws-ec2-ubuntu)

## 0. Modifications apportées au projet initial

### Base de données Supabase (7 novembre 2026)

- PostgreSQL local et procédure sauvegarde/restauration abandonnés : l'application et le pipeline CI/CD se connectent directement au PostgreSQL managé **Supabase** (session pooler, port 5432, TLS vérifié avec `backend/certs/prod-ca-2021.crt`).
- `backend/db/ssl.js` : options TLS communes à l'API et à `sequelize-cli` (les migrations utilisent désormais aussi le certificat CA). `DB_SSL_CA_PATH` relatif est résolu depuis `backend/`.
- Nouveau workflow `.github/workflows/ci-cd.yml` (tests, build frontend, migrations sur Supabase, contrôle des données et de `/health`). L'ancien `db-restore.yml` est supprimé.

Travail de préparation au déploiement cloud (octobre 2026). Le fonctionnement métier (catalogue, panier, commandes, factures, avis, réclamations, chatbot, Telegram) est inchangé ; les modifications portent sur la compatibilité Linux, la sécurité, la configuration, la base de données et le déploiement. Détail et justification : [`docs/deployment/readme-recommendations.md`](docs/deployment/readme-recommendations.md) et [`docs/deployment/readiness-report.md`](docs/deployment/readiness-report.md).

### Corrections bloquantes

| Problème dans l'ancien projet | Conséquence | Correction |
|---|---|---|
| 11 imports frontend avec une casse incorrecte (`components/Pneus/...`, `AdminDashboard.css`, `bridgestone.png`, `pirelli.png`) | `npm run build` échouait sous Linux (fonctionnait uniquement sous Windows) | Chemins corrigés ; contrôle automatique `tests/deployment/check-import-case.cjs` |
| `backend/routes/vehicule.js` importait `vehiculeController` au lieu de `VehiculeController` | L'API plantait au démarrage sous Linux | Chemin corrigé |
| 26 URL `http://localhost:5001` codées en dur dans 22 fichiers React | Frontend inutilisable ailleurs que sur le poste de développement | `frontend/src/config.js` + variable `VITE_API_URL` (`/api` en production) |

### Sécurité

| Avant | Après |
|---|---|
| `POST/PUT/DELETE` sur `/pneus`, `/marques`, `/compatibilites` **sans authentification** | Réservés aux administrateurs (`requireAdmin`) ; appels marques envoyés avec le cookie de session |
| Webhook `/telegram/webhook` public (envoi de messages par le bot à n'importe quel chat) | Désactivé tant que `TELEGRAM_WEBHOOK_SECRET` n'est pas défini |
| Secret JWT codé en dur (`"net pneus secret"`) | `JWT_SECRET` obligatoire en production (≥ 32 caractères) ; ancien secret conservé seulement en développement |
| Cookie de session `secure: false` codé en dur | `COOKIE_SECURE` (vrai par défaut en production) ; `clearCookie` avec les mêmes options |
| CORS limité à `localhost` codé en dur | `CORS_ORIGINS` configurable |
| Erreurs 500 renvoyant l'objet d'erreur complet au navigateur | Message générique en production |
| `backend/.env` versionné ; `.env` commenté dans `.gitignore` | Fichier exclu, `.gitignore` racine et backend corrigés, modèle `.env.example` |
| `bcrypt` utilisé sans import dans `middleware/inscription.js` | Import ajouté |

### Configuration et exécution du backend

- Nouveau module `backend/config/index.js` : lecture centralisée et **validation** des variables d'environnement (arrêt explicite si une variable obligatoire manque) ; tous les fichiers passent par lui (`dotenv` n'est plus appelé ailleurs).
- `backend/db/db.js` : pool de connexions configurable, option TLS `DB_SSL` pour une base managée (Supabase, RDS).
- `backend/app.js` : route **`GET /health`** (vérifie la base), démarrage uniquement après connexion à PostgreSQL, **arrêt propre** sur `SIGTERM`/`SIGINT` (fermeture du serveur, arrêt du polling Telegram, fermeture du pool), journaux `combined` en production, `trust proxy` derrière Nginx, `HOST`/`PORT` configurables, export de l'application pour les tests.
- Images téléversées : répertoire configurable `UPLOAD_DIR` (défaut inchangé `backend/public/uploadPneu`), persistant en production.
- Polling Telegram désactivable (`TELEGRAM_POLLING_ENABLED`) pour éviter deux instances concurrentes.
- Suppression d'un `console.log` de débogage dans `UserModel.js`.

### Base de données

- `sync({ alter: true })` à chaque démarrage remplacé par `DB_SYNC` (`alter` en développement comme avant, `none` en production où `alter` est refusé).
- **Migrations versionnées** avec `sequelize-cli` (`npm run db:migrate`) ; migration de référence non destructive.
- Scripts `scripts/backup-db.sh` et `scripts/restore-db.sh` (sauvegarde `pg_dump` + SHA-256 + métadonnées, restauration transactionnelle, refus d'écraser une base non vide) ; sauvegarde quotidienne et avant chaque déploiement.

### Tests ajoutés

- 12 tests backend (`npm test`) : validation de la configuration, `/health`, refus 401/403 des routes d'administration, inscription/connexion par cookie.
- `tests/deployment/backup-restore.test.sh` : restauration vérifiée (comptages, séquences, schéma).
- `tests/deployment/run-local-checks.sh` : exécute toutes les vérifications (casse des imports, build, scripts shell, Terraform, migrations, sauvegarde).

### Déploiement (nouveau)

- `scripts/install.sh`, `deploy.sh`, `rollback.sh`, `health-check.sh` ; unités `systemd/` ; site `nginx/landolsi.conf`.
- Terraform `infra/aws/` + `infra/cloud-init/` pour une instance EC2 Ubuntu 24.04, adapté aux restrictions AWS Academy (Security Group existant, clé SSH injectée par cloud-init).
- Documentation `docs/deployment/` : architecture, stratégie de base, sauvegarde/restauration, AWS Academy, dépannage, retour arrière.

### Non modifié (à traiter par l'équipe)

- 17 erreurs `npm run lint` existantes, dont `setAvis` non défini dans `frontend/src/pages/CommandeDetails/CommandeDetails.jsx:148` (erreur à l'exécution sur ce chemin).
- Pas de limitation des tentatives de connexion ; dépendances anciennes (Express 4.16, `jade`).
- Données de développement **importées le 30 octobre 2026** depuis le dump SQL `LANDOLSI_TIRES.sql` (PostgreSQL 17.10) : 12 utilisateurs, 8 marques, 9 pneus, 38 commandes, 10 factures, 13 avis. Lors de l'import : 385 contraintes `UNIQUE` en double (créées par les anciens `sync({ alter: true })`) ont été supprimées, les tables `avis_likes` et `reponses_avis` (absentes du code de ce dépôt) ont été conservées, et les colonnes `users.activite` et `users.identifiantEntreprise` (attendues par `UserModel.js`, absentes du dump) ont été ajoutées. Le compte administrateur est désormais celui du dump (mot de passe du poste de développement). Sauvegarde avant import : `/var/backups/landolsi/landolsi_tires_20261030T161213Z.dump` ; sauvegarde après import chiffrée, conservée hors dépôt ([§20](#sauvegarde-chiffrée-et-restauration-cicd)).

### Double authentification MFA (31 octobre 2026)

Ajout d'une double authentification facultative par **application Authenticator** (TOTP, RFC 6238 : Google Authenticator, Microsoft Authenticator, FreeOTP, Authy...) pour les clients et les administrateurs. Détail : [§12 — Double authentification](#double-authentification-mfa).

| Élément | Fichiers |
|---|---|
| Service TOTP, QR code, chiffrement AES-256-GCM du secret, codes de secours | `backend/services/mfaService.js` (paquets `otplib`, `qrcode`) |
| Connexion en deux étapes, enrôlement, désactivation, réinitialisation admin | `backend/controllers/UserControllers.js`, `backend/routes/users.js` |
| Refus du jeton intermédiaire comme session | `backend/middleware/requireAuth.js` |
| Colonnes `mfaEnabled`, `mfaSecret`, `mfaTempSecret`, `mfaLastUsedStep`, `mfaRecoveryCodes` | `backend/models/UserModel.js`, migration `backend/migrations/20261031000000-add-user-mfa.js` |
| Écran du code à la connexion, réglages MFA (profil client, menu admin « Sécurité (MFA) »), badge et réinitialisation dans la gestion des utilisateurs | `frontend/src/components/Auth/Login.jsx`, `MfaSettings.jsx`, `components/admin/AdminSecurite.jsx`, `AdminUtilisateurs.jsx`, `pages/Profile.jsx` |
| Tests | `backend/test/mfa.test.js` (unitaires), `backend/test/api.test.js` (parcours complet) |

### Facture envoyée par e-mail à la confirmation (31 octobre 2026)

Lorsque l'administrateur passe une commande au statut **« confirmée »** (après l'avoir vérifiée avec le client, page *Admin > Commandes*) :

1. une fenêtre lui rappelle que la facture va partir par e-mail et lui demande de confirmer ;
2. la facture est créée (comme avant), le PDF est généré en mémoire et envoyé à l'adresse e-mail du **compte client** ;
3. l'e-mail (« Votre commande n°… est prête à être récupérée — LANDOLSI TIRES ») indique que la commande est prête au retrait chez LANDOLSI TIRES (Msaken, lien vers le plan d'accès) et joint la facture ;
4. l'administrateur voit le résultat : « Facture FAC-… envoyée à … » ou la raison de l'échec (SMTP non configuré, client sans e-mail, erreur d'envoi). **Un échec d'envoi n'annule jamais la confirmation.**

L'e-mail n'est envoyé qu'au **passage** à « confirmée » (pas de renvoi si le statut est réenregistré). Fichiers : `backend/services/factureEmailService.js`, `backend/services/emailService.js` (`sendFactureCommandePreteEmail`), `backend/controllers/FactureController.js` (PDF réutilisable : `genererFacturePdfBuffer`), `frontend/src/components/admin/AdminCommandes.jsx`. Tests : `backend/test/facture-email.test.js`.

Configuration : `EMAIL_USER` (adresse Gmail) et `EMAIL_PASS` (**mot de passe d'application** Google, compte avec validation en deux étapes). En production : `scripts/configure-email.sh` (identifiants lus sur l'entrée standard, connexion SMTP vérifiée). Facultatif : `STORE_CITY`, `STORE_MAPS_URL`, `STORE_CONTACT_EMAIL` pour personnaliser le lieu de retrait.

**Correction de sécurité associée :** `GET /factures/commande/:id` et `/factures/commande/:id/pdf` ne vérifiaient que la connexion ; tout client connecté pouvait télécharger la facture d'un autre (nom, adresse, téléphone). Seuls le client propriétaire de la commande et les administrateurs y ont désormais accès (sinon 404).

### Assistants IA Mistral (31 octobre 2026)

Trois assistants (conseiller pneus, service après-vente, analyse commerciale administrateur) reposant sur l'API Mistral avec appel d'outils métier : voir [§15 bis](#15-bis-assistants-ia-mistral). La clé `MISTRAL_API_KEY` reste exclusivement côté serveur ; au redéploiement, elle est injectée par `scripts/configure-ai.sh` (voir [§20](#redéploiement-complet-sur-aws-depuis-github-procédure-de-référence)).

### Recherche de pneus par photo (31 octobre 2026)

Le client photographie (ou importe une photo de) **son pneu usé** ; le site lit les inscriptions du flanc (marque, modèle, dimension, indices de charge et de vitesse, code DOT) et propose les **pneus neufs correspondants du catalogue**. Accès : fenêtre « Rechercher mes pneus » > **Par photo du pneu**, lien sous le formulaire de recherche de l'accueil, ou directement `/recherche/photo`. Détail : [§15 bis — Recherche par photo](#recherche-de-pneus-par-photo).

| Élément | Fichiers |
|---|---|
| Lecture de la photo (Mistral vision), validation des valeurs lues, rapprochement avec le catalogue | `backend/services/ai/tirePhoto.js` |
| Routes `POST /ai/tire-photo/analyze` et `POST /ai/tire-photo/match` | `backend/controllers/TirePhotoController.js`, `backend/routes/aiRoutes.js` |
| Téléversement en mémoire (aucune écriture disque) | `backend/middleware/uploadPhotoMemory.js` |
| Modèle et réponse JSON paramétrables | `backend/services/ai/mistralClient.js`, `backend/config/index.js` |
| Page (appareil photo / import, lecture, correction, résultats, ajout au panier) | `frontend/src/pages/SearchResults/SearchResultsPhoto.jsx`, `.css`, `frontend/src/utils/prepareTirePhoto.js`, `frontend/src/services/aiApi.js` |
| Points d'entrée | `frontend/src/components/Search/SearchModal.jsx`, `components/TireSearch/TireSearch.jsx`, `App.jsx` |
| Tests | `backend/test/tire-photo.test.js` (23 tests, Mistral et base simulés) |

Aucune migration, aucune nouvelle dépendance, aucune nouvelle clé : la clé `MISTRAL_API_KEY` existante suffit (`ministral-14b-latest` lit les images).

### Déploiement AWS réalisé (30 et 31 octobre 2026, redéployé le 31/10 à 16 h 26 UTC)

| Élément | Valeur |
|---|---|
| URL publique | **https://landolsi-tires-54-146-95-182.sslip.io** (l'IP `54.146.95.182` redirige vers cette adresse) |
| Instance | EC2 `t3.small`, Ubuntu 24.04, `us-east-1`, provisionnée par Terraform, installée par cloud-init |
| IP | IP élastique `54.146.95.182` (`eipalloc-09a864995fee440c0`), réservée hors Terraform : **conservée entre les déploiements**, URL inchangée pour les clients |
| HTTPS | Certificat Let's Encrypt, renouvellement automatique (`certbot.timer`) |
| Données | Redéploiement du 31/10 (instance `i-006a6bd2a8ccdf41f`, commit `7163577`) : sauvegarde du 31/10 10 h 59 restaurée. Sauvegarde finale chiffrée, prise juste avant `terraform destroy` : **31/10/2026 17 h 44 UTC** (`20261031T174440Z`) : 14 utilisateurs, 9 pneus, 43 commandes, 13 factures, 14 avis, 4 réclamations, 36 images. **Instance détruite le 31/10 vers 17 h 46 UTC** ; IP élastique conservée |
| Contrôles | `/api/health` → `{"status":"ok","database":"up"}` ; assistants IA testés en production |

Le 29 octobre, `ec2:RunInstances` était refusé sur le compte AWS Academy ; il est autorisé depuis le 30 octobre. Corrections intégrées à `scripts/install.sh` à la suite de ce déploiement : `--email` facultatif avec `--domain`, mise à jour de `COOKIE_SECURE`/`CORS_ORIGINS` lorsque HTTPS est activé après la première installation, redirection de l'accès par IP vers le nom de domaine (Certbot répondait 404).

### Conception UML (31 octobre 2026)

Dossier [`docs/conception/`](docs/conception/) : pages web autonomes (sans connexion Internet), à ouvrir dans un navigateur.

| Page | Contenu |
|---|---|
| [`index.html`](docs/conception/index.html) | Accueil du dossier de conception |
| [`cas-utilisation.html`](docs/conception/cas-utilisation.html) | Diagramme de cas d'utilisation global : 3 acteurs principaux, 3 systèmes externes (Mistral AI, SMTP, Telegram), 36 cas en espaces public / client / administrateur, avec la correspondance de chaque cas vers les routes de l'API |
| [`diagramme-classes.html`](docs/conception/diagramme-classes.html) | Diagramme de classes global : 11 classes (modèles Sequelize), 4 énumérations, associations et multiplicités, dictionnaire des classes |

Chaque page permet de zoomer, de télécharger le diagramme en SVG (insertion sans perte dans le rapport) et d'imprimer en PDF. Les SVG sont aussi fournis à part (`landolsi-*.svg`). Après une évolution des modèles, régénérer avec `python3 docs/conception/source/build.py docs/conception` (Python 3, sans dépendance).

## 1. Présentation

**LANDOLSI TIRES** est une application web de vente de pneumatiques, accessible depuis un navigateur sur ordinateur ou téléphone. Elle vise à faciliter la recherche de pneus, la préparation d'une commande et le suivi des opérations par l'administrateur.

Le modèle opérationnel retenu est le **retrait de la commande par le client chez LANDOLSI TIRES** : la plateforme ne prévoit pas de livraison à domicile. La facture est créée au moment où l'administrateur confirme la commande, selon la logique métier implémentée.

## 2. Fonctionnalités

### Espace client

- Inscription, connexion et gestion de session.
- Double authentification facultative avec une application Authenticator (QR code, codes de secours).
- Récupération de mot de passe par e-mail (si les paramètres SMTP sont configurés).
- Consultation du catalogue et des fiches détaillées des pneus.
- Recherche de pneus par critères disponibles dans l'interface : marque, dimension, saison et immatriculation/compatibilité véhicule.
- Consultation des promotions.
- Ajout de pneus au panier et ajustement des quantités.
- Création d'une commande et consultation de ses détails/statut.
- Consultation des factures associées à ses propres commandes (un client ne peut pas ouvrir la facture d'un autre client) ; réception de la facture par e-mail à la confirmation de la commande.
- Dépôt et consultation d'avis et de réclamations.
- Recherche de pneus **à partir d'une photo** du pneu usé (appareil photo du téléphone ou image importée) : lecture de la marque, du modèle et de la dimension, puis proposition des pneus neufs équivalents du catalogue ; lecture modifiable avant une nouvelle recherche.
- Utilisation du chatbot d'assistance : conseiller IA pour choisir ses pneus (fiches, comparaison, ajout au panier) et assistant après-vente (suivi de commande, politiques publiées, brouillon de réclamation).

### Espace administrateur

- Tableau de bord d'administration.
- Gestion des pneus, de leurs images, de leur stock et de leurs informations.
- Gestion des marques.
- Gestion des promotions.
- Consultation et gestion des commandes et de leur statut.
- Gestion des utilisateurs (dont la réinitialisation de la double authentification d'un client).
- Double authentification du compte administrateur (menu « Sécurité (MFA) »).
- Assistant IA commercial (menu « Assistant IA ») : indicateurs, ventes, stock, réapprovisionnement, questions en langage naturel.
- Gestion des réclamations et des avis selon les écrans disponibles.
- Génération/gestion des factures selon le cycle de confirmation des commandes.
- Confirmation d'une commande après vérification avec le client : la facture PDF est **envoyée automatiquement par e-mail** au client, avec un message lui indiquant que sa commande est prête à être récupérée chez LANDOLSI TIRES.

Les accès aux opérations administrateur doivent être protégés par les contrôles d'authentification et de rôle côté serveur. Ne vous fiez pas uniquement au masquage des pages dans le frontend.

## 3. Technologies

| Partie | Technologies |
|---|---|
| Frontend | React, Vite, React Router, Axios, Bootstrap, React Icons |
| Backend | Node.js, Express.js |
| Base de données | PostgreSQL |
| ORM | Sequelize |
| Authentification | Cookies, JWT et bcrypt (selon les modules du backend) ; MFA TOTP avec `otplib` et `qrcode` |
| Images | Multer et répertoire public du backend |
| E-mail | Nodemailer, avec compte SMTP configuré dans l'environnement |
| Chatbot | Intégration Google Gemini via `@google/genai` |
| Notifications | Bot Telegram avec mécanisme de polling côté serveur |
| Factures | Contrôleur de facturation et génération PDF avec PDFKit (selon les routes prévues) |

## 4. Architecture du dépôt

```text
projet_Landolsi/
├── backend/
│   ├── app.js                  # Configuration Express, routes, /health, démarrage et arrêt propre
│   ├── config/index.js         # Lecture et validation des variables d'environnement
│   ├── db/db.js                # Connexion Sequelize/PostgreSQL
│   ├── migrations/             # Migrations versionnées (sequelize-cli)
│   ├── test/                   # Tests backend (node --test)
│   ├── models/                 # Modèles et associations Sequelize
│   ├── controllers/            # Logique métier des modules
│   ├── routes/                 # Endpoints HTTP
│   ├── middleware/             # Authentification, rôles, téléversement
│   ├── services/               # Services tels que le polling Telegram
│   ├── public/uploadPneu/      # Images de pneus téléversées
│   ├── package.json
│   ├── .env.example            # Modèle de configuration
│   └── .env                    # À créer localement; ne pas versionner
├── frontend/
│   ├── src/
│   │   ├── config.js           # URL de l'API (VITE_API_URL)
│   │   ├── components/         # Composants et écrans, dont administration
│   │   ├── context/            # Contexte du panier
│   │   ├── pages/              # Pages principales
│   │   └── services/           # Appels API depuis React
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── scripts/                    # install, deploy, rollback, health-check, backup-db, restore-db
├── systemd/                    # Unités systemd (API, sauvegarde quotidienne)
├── nginx/                      # Site Nginx (frontend + reverse proxy /api)
├── infra/aws/                  # Terraform EC2 (AWS Academy)
├── infra/cloud-init/           # Amorçage EC2
├── tests/deployment/           # Contrôles de déploiement et test sauvegarde/restauration
├── docs/conception/            # Conception UML : cas d'utilisation et diagramme de classes (pages web)
└── docs/deployment/            # Architecture, base de données, AWS, dépannage, retour arrière
```

## 5. Prérequis

Installer et vérifier :

- **Node.js 22 LTS** (minimum 20.19, requis par Vite 8).
- **npm** (installé avec Node.js).
- **PostgreSQL** et un serveur de base de données accessible.
- **Git**, si le dépôt est récupéré depuis une URL Git.
- Un navigateur récent (Chrome, Edge ou Firefox).

Commandes de vérification :

```bash
node --version
npm --version
 git --version
```

Supprimez l'espace placé avant `git` si vous copiez la troisième commande dans un terminal qui ne l'accepte pas.

## 6. Récupérer le projet depuis une URL Git

```bash
git clone https://github.com/ngrassa/projet_Landolsi.git
cd projet_Landolsi
```

Si le nom du dossier créé est différent, entrez dans ce dossier à la place. Si le projet est fourni en ZIP, décompressez-le puis ouvrez un terminal dans le dossier racine contenant `backend/` et `frontend/`.

Pour récupérer les changements d'une branche existante :

```bash
git status
git pull
```

Ne partagez pas votre URL si elle contient un jeton d'accès. Pour envoyer vos changements, créez une branche, validez les fichiers non sensibles et ouvrez une pull request ou fusionnez selon les règles du dépôt.

## 7. Base de données Supabase

La base est hébergée sur Supabase : aucun PostgreSQL local, aucune sauvegarde à restaurer.

1. Supabase > *Project Settings* > *Database* > *Connection string* > **Session pooler** : relevez l'hôte (`aws-0-<région>.pooler.supabase.com`), le port `5432`, la base `postgres`, l'utilisateur `postgres.<project-ref>` et le mot de passe.
2. Renseignez-les dans `backend/.env` (modèle : `backend/.env.example`) avec `DB_SSL=true` et `DB_SSL_CA_PATH=./certs/prod-ca-2021.crt` (certificat racine Supabase, versionné).
3. Appliquez les migrations : `cd backend && npm run db:migrate` (idempotentes, sans effet sur les tables existantes).
4. Pipeline : déposez les secrets `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` dans le dépôt GitHub ; le workflow `CI/CD Supabase` migre et contrôle la base à chaque push.
5. Serveur EC2 : `scripts/install.sh --external-db`, puis mêmes variables `DB_*` dans `/etc/landolsi/backend.env` (`DB_SSL_CA_PATH=/opt/landolsi/current/backend/certs/prod-ca-2021.crt`).

Le comportement au démarrage dépend de `DB_SYNC` :

| `DB_SYNC` | Effet | Défaut |
|---|---|---|
| `alter` | `sequelize.sync({ alter: true })` : modifie le schéma (ancien comportement) | Développement |
| `safe` | Crée uniquement les tables manquantes | — |
| `none` | Aucune synchronisation : schéma géré par les migrations | Production (`alter` y est refusé) |

Migrations versionnées :

```bash
cd backend
npm run db:migrate          # applique les migrations en attente
npm run db:migrate:status   # état
```

La première migration (`migrations/20261029000000-baseline-schema.js`) crée les tables manquantes sans modifier une base existante. Supabase conserve des sauvegardes automatiques de la base (Dashboard > Database > Backups).

Les tables sont définies par les modèles présents dans `backend/models/` et leurs associations dans `backend/models/associations.js`. Selon la version et l'état de la base, il peut être nécessaire de créer un compte administrateur et de charger les données initiales séparément.

## 8. Configurer le backend

Ouvrez un terminal dans `backend/` :

```bash
cd backend
npm install
```

Créez le fichier `.env` à partir du modèle :

```bash
cp .env.example .env
```

Variables principales (liste complète et commentée dans `backend/.env.example`) :

| Variable | Rôle | Défaut développement |
|---|---|---|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | PostgreSQL (obligatoires : nom, utilisateur, mot de passe) | `localhost:5432` |
| `DB_SSL` | `true` pour une base managée (Supabase, RDS) | `false` |
| `DB_SYNC` | `alter`, `safe` ou `none` (voir §7) | `alter` |
| `JWT_SECRET` | Secret de signature des sessions (obligatoire en production, ≥ 32 caractères : `openssl rand -hex 32`) | ancien secret de développement |
| `PORT`, `HOST` | Écoute du serveur | `5001`, toutes interfaces |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules | `http://localhost:5173,http://127.0.0.1:5173` |
| `COOKIE_SECURE` | Cookie de session réservé à HTTPS | `false` (`true` en production) |
| `MFA_ISSUER` | Nom affiché dans l'application Authenticator | `LANDOLSI TIRES` |
| `MFA_ENCRYPTION_KEY` | Clé de chiffrement des secrets MFA en base (`openssl rand -hex 32`, générée par `install.sh` sur un fichier neuf). **Ne plus la modifier une fois des comptes enrôlés** | dérivée de `JWT_SECRET` |
| `UPLOAD_DIR` | Répertoire des images téléversées | `backend/public/uploadPneu` |
| `EMAIL_USER`, `EMAIL_PASS` | SMTP (récupération du mot de passe) | — |
| `GEMINI_API_KEY` | Chatbot | — |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_POLLING_ENABLED` | Assistant Telegram | polling activé |
| `VEHICULE_API_USERNAME` | Recherche par immatriculation | — |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Utilisées uniquement par `npm run create-admin` | — |

Renseignez uniquement les variables réellement utilisées par les services activés. N'utilisez pas le mot de passe administrateur comme mot de passe de base de données.

Démarrez le serveur :

```bash
npm run dev
```

ou, sans rechargement automatique :

```bash
npm start
```

Le serveur écoute sur le port **5001** (`PORT`). Il ne démarre qu'après une connexion réussie à PostgreSQL ; sinon il s'arrête avec un message explicite. `http://localhost:5001/health` répond `{"status":"ok","database":"up",...}` lorsque l'API et la base fonctionnent (503 si la base est indisponible).

### Sécurité de configuration

- Vérifiez que `.env` est ignoré par Git dans **les deux dossiers** si nécessaire.
- Ne mettez jamais de clés API, de mots de passe, de jetons ou de données clients dans le README.
- Si un secret a été commité, l'ajouter au `.gitignore` ne suffit pas : révoquez-le et remplacez-le.
- N'utilisez pas les paramètres de développement en production.

## 9. Configurer le frontend

Ouvrez un **deuxième terminal** à la racine du projet, puis :

```bash
cd frontend
npm install
npm run dev
```

Vite affiche l'URL locale, normalement `http://localhost:5173/`. L'URL de l'API est définie dans `frontend/src/config.js` à partir de `VITE_API_URL` (défaut : `http://localhost:5001`) ; les requêtes utilisent les cookies (`withCredentials: true`). Le backend autorise par défaut les origines `localhost:5173` et `127.0.0.1:5173` (`CORS_ORIGINS`). En production, le frontend est construit avec `VITE_API_URL=/api` et servi par le même Nginx que l'API.

Pour éviter les problèmes de session/CORS, utilisez de préférence `http://localhost:5173` pour le frontend et `http://localhost:5001` pour l'API, conformément à la configuration actuelle. Si vous changez de port ou d'hôte, adaptez à la fois l'URL API, la configuration CORS et les paramètres des cookies.

Vérifiez que le frontend n'embarque aucun secret serveur. Une clé Gemini, un jeton Telegram ou un mot de passe SMTP doit rester dans le backend.

## 10. Démarrer l'application

L'application nécessite généralement **deux terminaux** ouverts en même temps :

**Terminal 1 — backend**

```bash
cd backend
npm run dev
```

Attendez les messages confirmant le démarrage du serveur et la connexion à PostgreSQL.

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Ouvrez ensuite `http://localhost:5173/` dans le navigateur. Gardez les deux terminaux ouverts pendant les tests.

## 11. URLs locales

| Ressource | URL de développement |
|---|---|
| Application React | `http://localhost:5173/` |
| API backend | `http://localhost:5001/` |
| Santé API + base | `http://localhost:5001/health` |
| Route utilisateurs | `http://localhost:5001/users` |
| Pneus | `http://localhost:5001/pneus` |
| Marques | `http://localhost:5001/marques` |
| Véhicules | `http://localhost:5001/vehicules` |
| Compatibilités | `http://localhost:5001/compatibilites` |
| Commandes | `http://localhost:5001/commandes` |
| Promotions | `http://localhost:5001/promotions` |
| Administration API | `http://localhost:5001/admin` |
| Chatbot | `http://localhost:5001/chatbot` |
| Factures | `http://localhost:5001/factures` |
| Avis | `http://localhost:5001/avis` |
| Réclamations | `http://localhost:5001/reclamations` |
| Telegram | `http://localhost:5001/telegram` |

Ces URLs indiquent les **préfixes** des routeurs Express. Les chemins exacts, méthodes HTTP, paramètres et droits requis sont définis dans les fichiers de `backend/routes/`. Ouvrir un préfixe directement dans le navigateur ne garantit pas qu'une route GET existe à cet emplacement.

## 12. Principaux modules et API

Les préfixes de routes sont montés dans `backend/app.js` :

| Module | Préfixe | Rôle |
|---|---|---|
| Utilisateurs | `/users` | Inscription, connexion, profil et fonctions de compte |
| Pneus | `/pneus` | Catalogue, détails, recherche et gestion des pneus |
| Marques | `/marques` | Gestion des marques |
| Véhicules | `/vehicules` | Données des véhicules |
| Compatibilités | `/compatibilites` | Correspondance pneus/véhicules |
| Commandes | `/commandes` | Création, consultation et gestion du statut des commandes |
| Promotions | `/promotions` | Création et consultation des promotions |
| Administration | `/admin` | Fonctions dédiées à l'administration |
| Chatbot | `/chatbot` | Échanges avec l'assistant |
| Factures | `/factures` | Opérations liées aux factures |
| Avis | `/avis` | Avis des clients |
| Réclamations | `/reclamations` | Dépôt et gestion des réclamations |
| Telegram | `/telegram` | Fonctions liées à l'intégration Telegram |

Les écritures du catalogue (`POST/PUT/DELETE` sur `/pneus`, `/marques`, `/compatibilites`) exigent une session administrateur. Le webhook `/telegram/webhook` est désactivé tant que `TELEGRAM_WEBHOOK_SECRET` n'est pas défini (l'application utilise le polling).

### Double authentification (MFA)

**Activation (client : page Profil ; administrateur : menu « Sécurité (MFA) ») :**

1. « Activer la double authentification » → le serveur génère un secret TOTP et renvoie un QR code (`otpauth://totp/LANDOLSI TIRES:<email>?secret=...`).
2. L'utilisateur le scanne avec Google Authenticator, Microsoft Authenticator, etc. (ou saisit la clé affichée).
3. Il saisit le code à 6 chiffres affiché : la MFA n'est activée qu'après ce code correct.
4. 8 **codes de secours** à usage unique sont affichés **une seule fois** (téléphone perdu).

**Connexion :** après un mot de passe correct, un compte protégé ne reçoit pas de session mais un cookie `mfa_pending` valable 5 minutes ; `jwt_token` n'est créé qu'après un code TOTP ou un code de secours valide (5 essais au plus par tentative de connexion).

| Méthode et chemin | Accès | Rôle |
|---|---|---|
| `POST /users/login` | public | Renvoie `mfaRequired: true` si la MFA est active |
| `POST /users/login/mfa` | cookie `mfa_pending` | `{ code }` ou `{ recoveryCode }` → ouvre la session |
| `GET /users/mfa/status` | connecté | État et nombre de codes de secours restants |
| `POST /users/mfa/setup` | connecté | QR code et clé (secret en attente) |
| `POST /users/mfa/enable` | connecté | `{ code }` → active et renvoie les codes de secours |
| `POST /users/mfa/recovery-codes` | connecté | `{ code }` → nouveaux codes de secours (les anciens sont invalidés) |
| `POST /users/mfa/disable` | connecté | `{ password, code }` ou `{ password, recoveryCode }` |
| `PUT /users/admin/:id/mfa/reset` | administrateur | Supprime la MFA d'un utilisateur (après vérification de son identité) |

**Sécurité :** secret chiffré en base (AES-256-GCM) ; codes de secours stockés sous forme d'empreinte SHA-256 ; tolérance de ±30 s pour l'horloge du téléphone ; un même code TOTP ne peut pas être réutilisé ; le jeton intermédiaire est refusé par `requireAuth`. Le compteur d'essais est en mémoire (une seule instance de l'API, cas actuel).

**Téléphone perdu :** se connecter avec un code de secours puis réactiver la MFA ; sans code de secours, un administrateur réinitialise la MFA depuis « Utilisateurs ». Pour un administrateur sans code de secours, sur le serveur : `sudo -u postgres psql landolsi_tires -c "UPDATE users SET \"mfaEnabled\"=false, \"mfaSecret\"=NULL, \"mfaRecoveryCodes\"=NULL WHERE email='admin@...';"`.

L'heure du serveur doit être juste (NTP, actif par défaut sur Ubuntu/EC2) : un décalage de plus de 30 s fait refuser les codes.

Pour documenter chaque endpoint avec précision, consulter les fichiers correspondants dans `backend/routes/` et les contrôleurs dans `backend/controllers/`. Utilisez Postman ou Insomnia pour tester les requêtes protégées avec une session valide. Les routes protégées peuvent renvoyer `401` si l'utilisateur n'est pas connecté ou `403` si son rôle ne permet pas l'action.

## 13. Parcours utilisateur

1. Le visiteur ouvre le site et consulte le catalogue.
2. Il recherche un pneu selon les critères proposés et consulte la fiche du produit.
3. Il crée un compte ou se connecte si l'action le nécessite.
4. Il ajoute les produits au panier et vérifie les quantités/prix.
5. Il renseigne les informations demandées et confirme la création de commande.
6. Le backend valide la demande, calcule/enregistre les données de commande et les articles associés.
7. Le client consulte ses commandes et leur état depuis son espace.
8. Lorsque l'administrateur confirme la commande, le système crée la facture selon le fonctionnement implémenté.
9. Le client récupère les pneus directement chez LANDOLSI TIRES. Il n'y a pas de livraison à domicile dans le périmètre retenu.

Le statut précis d'une commande et les conditions de création/téléchargement d'une facture dépendent de la logique dans `CommandeController.js`, `FactureController.js` et des routes associées.

## 14. Parcours administrateur

1. Se connecter avec un compte disposant du rôle administrateur.
2. Ajouter ou modifier les marques et les pneus, y compris les images et les stocks.
3. Créer et gérer les promotions disponibles.
4. Consulter les commandes entrantes et leurs informations.
5. Mettre à jour le statut de la commande selon son traitement.
6. Vérifier la facture associée lorsqu'une commande est confirmée.
7. Gérer les comptes, avis et réclamations depuis les écrans d'administration disponibles.

Un compte administrateur doit être créé de manière contrôlée : renseignez `ADMIN_EMAIL` et `ADMIN_PASSWORD` puis `cd backend && npm run create-admin`. **Si le compte existe déjà, le script réinitialise son mot de passe** : ne le relancez pas aveuglément sur une base de production, et retirez `ADMIN_PASSWORD` de la configuration après usage.

## 15. Chatbot et Telegram

### Chatbot

Le backend contient un contrôleur et des routes de chatbot et utilise le paquet `@google/genai`. Pour activer le service, configurez une clé API valide dans `GEMINI_API_KEY`, puis testez la route et l'interface. Une erreur `503 UNAVAILABLE` peut indiquer une indisponibilité temporaire ou une saturation du service externe; elle ne signifie pas nécessairement que la clé a expiré. Prévoir une gestion des erreurs et un message de repli côté interface.

### Notifications Telegram

Le démarrage du serveur appelle `demarrerTelegramPolling()` depuis le service Telegram. Cela correspond à une logique de **polling** : le service interroge Telegram périodiquement pour récupérer les mises à jour, au lieu d'attendre un webhook entrant. Le fonctionnement nécessite les variables Telegram configurées et un accès réseau. Un déploiement cloud devra maintenir le processus backend en fonctionnement et vérifier les contraintes de polling, les journaux et les droits du bot.

Ne mettez jamais le jeton du bot dans React, dans le README ou dans Git. Si un webhook est adopté ultérieurement, il faudra disposer d'une URL HTTPS publique et configurer le webhook côté Telegram; ne mélangez pas simultanément les modes sans vérifier la configuration.

## 15 bis. Assistants IA Mistral

Trois assistants s'appuient sur l'API Mistral (appel d'outils). **Le LLM ne fait que choisir une fonction métier et rédiger** : prix, stocks, compatibilités, indicateurs et droits d'accès sont calculés par le backend à partir de PostgreSQL. Aucun SQL ni code n'est généré par le modèle ; ses arguments sont validés contre un schéma strict. La **recherche par photo** applique le même principe : le modèle de vision lit le flanc du pneu, le serveur valide la lecture et choisit les produits.

| Assistant | Route | Accès | Interface |
|---|---|---|---|
| Conseiller pneus | `POST /ai/tire-advisor/chat` | public | widget, onglet « Conseiller pneus » |
| Service après-vente | `POST /ai/support/chat` | public ; commandes si connecté | widget, onglet « Service après-vente » |
| Analyse commerciale | `POST /ai/admin/analytics/chat` | `requireAdmin` | `/admin/assistant-ia` |
| Indicateurs (sans LLM) | `GET /ai/admin/analytics/kpis` | `requireAdmin` | `/admin/assistant-ia` |
| Recherche par photo | `POST /ai/tire-photo/analyze` (multipart, champ `photo`) | public | `/recherche/photo` |
| Recherche corrigée (sans LLM) | `POST /ai/tire-photo/match` | public | `/recherche/photo` |

Corps des requêtes de chat : `{ "message": "...", "history": [{ "role": "user"|"assistant", "content": "..." }] }` (1 000 caractères max, 12 messages d'historique max ; les rôles `system`/`tool` envoyés par le navigateur sont ignorés).

### Architecture

```
backend/services/ai/
  mistralClient.js    client unique : clé serveur, délai, nouvelle tentative 429/5xx
  agent.js            boucle LLM <-> outils, tours bornés, validation des arguments
  repository.js       requêtes Sequelize paramétrées (seul accès aux données)
  tireTools.js        search_tires, get_tire_details, compare_tires, check_vehicle_compatibility, list_catalog_options
  analyticsTools.js   sales_summary, top_products, sales_by_brand_and_season, stock_alerts, restock_suggestions, margin_analysis, conversion_analysis
  supportTools.js     search_support_docs (RAG lexical), get_my_orders, get_order_status, prepare_support_ticket
  tirePhoto.js        recherche par photo : consigne de vision, validation de la lecture, pneus correspondants
backend/data/support-docs/   documents officiels cités par l'assistant SAV
backend/controllers/AiController.js, TirePhotoController.js, backend/routes/aiRoutes.js
backend/middleware/uploadPhotoMemory.js            photo du client en mémoire uniquement
frontend/src/pages/SearchResults/SearchResultsPhoto.jsx  page /recherche/photo
backend/middleware/rateLimit.js, optionalAuth.js
frontend/src/components/chatbot/Chatbot.jsx       widget (2 onglets, fiches, comparaison, panier, brouillon de réclamation)
frontend/src/components/admin/AdminAssistantIA.jsx tableau de bord + chat admin
frontend/src/components/ai/MarkdownLite.jsx        rendu Markdown sans innerHTML
frontend/src/services/aiApi.js
```

### Configuration

Dans `backend/.env` (ou `/etc/landolsi/backend.env` en production) :

```bash
MISTRAL_API_KEY=...            # jamais dans le frontend ni dans Git
MISTRAL_MODEL=ministral-14b-latest   # défaut si absent
MISTRAL_TIMEOUT_MS=30000
AI_MAX_TOOL_ROUNDS=5
AI_RATE_LIMIT_PER_MINUTE=15
```

Le modèle doit supporter l'appel d'outils **et** être ouvert sur votre abonnement : certaines offres ont un quota nul (HTTP 429 permanent) sur `mistral-small-latest` / `mistral-medium-latest`. Vérification rapide :

```bash
curl -s -H "Authorization: Bearer $MISTRAL_API_KEY" https://api.mistral.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"ministral-14b-latest","messages":[{"role":"user","content":"ok"}],"max_tokens":5}'
```

Sans clé (ou avec les valeurs d'exemple `replace_with_...` de `.env.example`), les routes IA répondent 503 et le reste du site fonctionne. Aucune migration n'est nécessaire. En production, utiliser `scripts/configure-ai.sh` (clé lue sur l'entrée standard).

### Règles métier et garde-fous

- **Produits** : le modèle cite les pneus sous la forme `[#ID]` ; seules les références renvoyées par un outil pendant la requête deviennent des fiches (prix, promotion, stock réels). Un identifiant inventé est retiré et un avertissement s'affiche.
- **Compatibilité** : « Compatible » uniquement si l'immatriculation existe en base avec des pneus associés (`vehicule_pneus`). Sinon : « même dimension, à vérifier » ou « non vérifiée ».
- **Chiffre d'affaires** : prix payé × quantité des commandes `confirmée`, `en préparation`, `expédiée`, `livrée`. Les commandes `en attente` sont comptées à part (CA potentiel), les `annulée` sont exclues. Les remboursements ne sont pas enregistrés par le site. Panier moyen = CA / commandes validées.
- **Marges / conversions** : non calculées (aucun coût d'achat ni suivi des consultations). L'assistant l'explique.
- **Réapprovisionnement** : rythme moyen observé × jours de couverture − stock ; simple recommandation, aucune commande fournisseur.
- **SAV** : une commande n'est lue que si elle appartient au client connecté (`where: { id, userId }`). L'assistant prépare un **brouillon** de réclamation ; c'est le client qui l'envoie (route existante `POST /reclamations`). Aucun remboursement, retour ou changement de statut n'est jamais effectué par l'IA.
- **Politiques** : l'assistant ne répond qu'à partir de `backend/data/support-docs/`. Le site ne publie aujourd'hui **aucune politique de retour, garantie, livraison ou montage** : ajoutez les textes officiels (format décrit dans `LISEZMOI.md` du dossier) puis redémarrez le backend.
- **Données personnelles** : aucun nom, e-mail, téléphone ni adresse n'est envoyé à Mistral ; les conversations ne sont pas stockées côté serveur ni journalisées.
- **Coûts** : 15 requêtes/min/IP, 5 tours d'outils max, 900 jetons max par réponse, délai de 30 s.

### Recherche de pneus par photo

**Parcours :** le client prend la photo (`capture="environment"` ouvre l'appareil photo arrière sur mobile) ou importe une image → le navigateur la réduit à 1 600 px et la réencode en JPEG (envoi rapide, **métadonnées EXIF et position GPS supprimées**) → le serveur la transmet au modèle de vision → les informations reconnues s'affichent avec leur niveau de confiance → les pneus neufs correspondants s'affichent avec prix, promotion, stock, lien vers la fiche et ajout au panier. Le client peut **corriger** la dimension, la marque ou le modèle et relancer la recherche ; cette relance (`/ai/tire-photo/match`) n'utilise pas l'IA. Le même formulaire permet une recherche manuelle sans photo.

**Répartition des rôles (le modèle ne fait que lire) :**

| Étape | Réalisée par | Garde-fou |
|---|---|---|
| Lecture des inscriptions du flanc | Mistral vision (`temperature 0`, réponse JSON imposée) | consigne : valeur illisible = `null`, ne jamais compléter un chiffre |
| Validation de la dimension | serveur | largeur 125–355 (pas de 5), série 25–85 (pas de 5), jante 12–24 : sinon rejetée et signalée |
| Indices, DOT | serveur | charge 60–130, vitesse dans la liste ETRTO ; DOT `SSAA` non futur → âge calculé, alerte au-delà de 6 ans |
| Marque | serveur | rapprochée des marques **réelles** de la table `Marques` ; une marque absente est signalée, jamais inventée |
| Choix des pneus | serveur (requête Sequelize paramétrée) | même dimension exacte ; fiches incohérentes (étiquette ≠ colonnes) exclues |

**Classement des propositions :** même marque et même modèle → même marque → même dimension (autres marques) ; à rang égal, en stock d'abord puis prix effectif (promotion incluse). Si la dimension n'est pas lisible mais la marque l'est, les pneus de cette marque sont proposés avec le badge **« Dimension à vérifier »**. Sans dimension ni marque, aucun produit n'est proposé et le client est invité à reprendre la photo ou à saisir la dimension.

**Sécurité et confidentialité :**
- photo reçue **en mémoire** (Multer `memoryStorage`), jamais écrite sur le disque, ni en base, ni dans les journaux ; 5 Mo maximum, une seule image ;
- type vérifié sur la **signature binaire** (JPEG, PNG, WEBP), pas sur l'extension ni sur le type déclaré ;
- 5 analyses par minute et par IP (`AI_PHOTO_RATE_LIMIT_PER_MINUTE`), limite appliquée **avant** la réception du fichier ; 30/min pour la recherche corrigée ;
- texte lu nettoyé (balises retirées, longueur bornée) et affiché par React sans `innerHTML` ;
- la page informe le client que la photo est analysée par Mistral AI puis supprimée.

**Limites :** la lecture dépend de la qualité de la photo. Sur un pneu très usé, sale ou photographié de loin, la dimension (petits caractères en relief) peut être illisible : le modèle renvoie alors `null` plutôt que de deviner. Essais réels (31/10/2026, `ministral-14b-latest`, ~2 à 4 s par photo) : gros plans de flanc lus correctement (marque, gamme, dimension, indices, DOT) ; photos du catalogue (500 px, pneu entier) : marque et gamme lues, dimension non lue ; logos et photo floue rejetés. La compatibilité avec le véhicule n'est pas vérifiée par cette fonction : la page rappelle de contrôler la dimension préconisée (carnet, étiquette de portière) et de conserver des indices au moins égaux.

**Configuration (facultative) :** `MISTRAL_VISION_MODEL` (défaut : `MISTRAL_MODEL`, sinon `ministral-14b-latest`), `AI_PHOTO_RATE_LIMIT_PER_MINUTE` (défaut 5). Le modèle choisi doit accepter les images (`capabilities.vision` dans `GET https://api.mistral.ai/v1/models`). Nginx accepte déjà des requêtes de 6 Mo (`client_max_body_size 6m`).

### Tests

```bash
cd backend
node --test test/ai.test.js        # tests des assistants, Mistral et base simulés, sans crédit
node --test test/tire-photo.test.js  # recherche par photo, Mistral et base simulés, sans crédit
node test/ai.live.js               # test réel (consomme quelques crédits), données simulées
```

## 16. Vérifications et tests

### Vérification de base

- [ ] PostgreSQL est démarré et la base est accessible.
- [ ] Le fichier `backend/.env` est renseigné avec des valeurs locales valides.
- [ ] Le backend démarre sur le port `5001` sans erreur de connexion.
- [ ] `http://localhost:5001/health` renvoie `"status":"ok"`.
- [ ] Le frontend démarre sur le port `5173`.
- [ ] Le catalogue s'affiche et les images de pneus sont accessibles.
- [ ] L'inscription et la connexion fonctionnent.
- [ ] La double authentification s'active (QR code scanné), est demandée à la connexion et accepte un code de secours.
- [ ] Les routes protégées refusent l'accès non autorisé.
- [ ] Le panier et la création de commande fonctionnent.
- [ ] L'administrateur peut traiter une commande et le cycle de facture est vérifié.
- [ ] Les promotions et le calcul des prix sont testés.
- [ ] Les e-mails, le chatbot et Telegram sont testés séparément si ces intégrations sont activées.
- [ ] Les affichages sur téléphone et ordinateur sont vérifiés.

### Build frontend

Dans `frontend/` :

```bash
npm run build
```

Le build de production doit se terminer sans erreur. Pour vérifier le résultat localement :

```bash
npm run preview
```

Le script `npm run lint` est également disponible; traitez les erreurs pertinentes avant la livraison (17 erreurs existantes sont recensées dans `docs/deployment/readiness-report.md`).

### Tests automatisés

```bash
# Backend : tests de configuration (sans base) + tests HTTP (avec une base de TEST migrée)
cd backend
npm test                                   # utilise backend/.env : uniquement une base de test !
ENV_FILE=/chemin/test.env npm test         # fichier dédié recommandé

# Toutes les vérifications de déploiement (casse des imports, build, scripts, Terraform,
# migrations, sauvegarde/restauration si une base de test est fournie)
tests/deployment/run-local-checks.sh [/chemin/test.env]
```

Les tests HTTP créent un compte client : ne les exécutez jamais sur la base de production.

Sous Linux, les chemins d'import sont sensibles à la casse (contrairement à Windows) : `node tests/deployment/check-import-case.cjs frontend/src backend` détecte les imports qui fonctionneraient sous Windows mais casseraient le build sur le serveur.

## 17. Problèmes fréquents

### `ECONNREFUSED` ou erreur Sequelize

Vérifiez que PostgreSQL est démarré, que le nom de base, l'utilisateur, le mot de passe, l'hôte et le port dans `.env` sont corrects, et que la base existe.

### `EADDRINUSE :::5001`

Un autre processus utilise déjà le port 5001. Arrêtez l'ancien serveur avec `Ctrl+C` dans son terminal ou identifiez le processus qui occupe le port avant de redémarrer.

### Erreur CORS ou session non conservée

Utilisez les hôtes prévus (`localhost`) et le port frontend `5173`. Vérifiez `credentials: true` côté Express et `withCredentials: true` côté Axios. Si les ports changent, adaptez la configuration des deux côtés.

### Réponse `401`

La session a peut-être expiré ou le cookie n'est pas envoyé. Reconnectez-vous et vérifiez les paramètres de cookies, CORS et l'URL utilisée.

### Images manquantes

Vérifiez que les fichiers sont présents dans `backend/public/uploadPneu/` et que les chemins stockés en base correspondent aux noms de fichiers. Les fichiers d'images locaux doivent être sauvegardés lors d'une migration.

### E-mail non envoyé

Vérifiez les identifiants SMTP, les paramètres de sécurité du fournisseur et les journaux du backend. N'inscrivez pas le mot de passe de messagerie dans le code source.

### Gemini indisponible

Vérifiez la variable de clé côté backend, les quotas et la disponibilité du service. Gérez les réponses d'erreur temporaires et évitez de renvoyer les secrets ou les détails internes au navigateur.

### Telegram ne reçoit pas les mises à jour

Vérifiez le jeton, l'identifiant de conversation, les droits du bot, l'accès réseau et les journaux du service de polling. Vérifiez également qu'un autre processus n'effectue pas déjà le polling avec le même bot.

## 18. Préparer la livraison finale

La livraison finale doit inclure le code source, les instructions d'installation, le rapport et les éléments nécessaires à la démonstration. Avant de remettre le projet :

1. **Nettoyer le dépôt** : exclure `node_modules/`, les fichiers `.env`, les journaux, les caches et les secrets.
2. **Préparer un `.env.example`** : conserver uniquement les noms des variables et des valeurs vides ou fictives.
3. **Vérifier les accès** : remplacer les secrets de développement, sécuriser le compte administrateur et tester les rôles.
4. **Préparer la base** : fournir un schéma/migrations et, si nécessaire, un jeu de données de démonstration non personnel. Ne pas livrer de données clients réelles.
5. **Sauvegarder les images** : décider comment les fichiers de `backend/public/uploadPneu/` seront transférés ou stockés en production.
6. **Tester les scénarios principaux** : inscription/connexion, recherche, panier, commande, confirmation, facture, promotion et administration.
7. **Tester le responsive** : vérifier les pages principales sur ordinateur et téléphone.
8. **Tester le build** : exécuter `npm run build` dans `frontend/` et corriger les erreurs bloquantes.
9. **Préparer le rapport PFE** : contexte, problématique, étude de l'existant, solution, besoins, conception UML, architecture, choix techniques, réalisation, tests, limites et perspectives.
10. **Préparer la soutenance** : démonstration courte d'un parcours client puis d'un parcours administrateur; prévoir une solution de secours si les services externes sont indisponibles.
11. **Documenter le déploiement** : URLs publiques, variables d'environnement configurées sur l'hébergeur, base de données, stockage des images, HTTPS, logs et sauvegardes.
12. **Vérifier le dépôt final** : le README doit correspondre aux fonctionnalités réellement présentes et les liens doivent être valides.

### Déploiement cloud — points à prévoir

Le projet est configuré par défaut pour le développement local. Pour le publier, il faudra notamment :

- héberger le frontend et le backend (ou utiliser une plateforme qui prend en charge les deux);
- configurer une base PostgreSQL distante, sauvegardée et protégée;
- remplacer les URLs `localhost` par l'URL publique du backend dans le frontend;
- adapter CORS et les cookies à vos domaines de production, avec HTTPS;
- définir les variables d'environnement dans le tableau de bord de l'hébergeur, pas dans Git;
- choisir un stockage persistant pour les images téléversées;
- vérifier que le processus de polling Telegram reste actif;
- appliquer des migrations contrôlées et tester le déploiement sur une base de test avant la production.

Ces points sont désormais traités : voir [§20](#20-déploiement-en-production-aws-ec2-ubuntu) et `docs/deployment/`. Aucune URL de production n'est indiquée ici, car elle dépend du déploiement réellement effectué.

## 19. Limites et améliorations

Pistes d'évolution possibles :

Réalisé : migrations versionnées, tests backend, stockage persistant des images (disque), journaux journald et `/health`, sauvegarde/restauration PostgreSQL, protection des routes d'administration (détail : `docs/deployment/readme-recommendations.md`).

Pistes restantes :

- ajouter des tests frontend et corriger les 17 erreurs de lint React;
- limiter les tentatives de connexion et de réinitialisation de mot de passe (`express-rate-limit`);
- rendre la double authentification obligatoire pour les comptes administrateurs;
- externaliser les images dans un stockage objet (S3 ou équivalent) pour permettre plusieurs instances;
- ajouter une surveillance de disponibilité externe et la copie automatique des sauvegardes hors de l'instance;
- mettre à jour les dépendances anciennes du backend (Express 4.16, `jade`);
- documenter automatiquement tous les endpoints (par exemple avec OpenAPI/Swagger).
- recherche par photo : mesurer le taux de lecture correcte sur de vraies photos clients (journal anonyme des seuls résultats, avec accord) et proposer, si besoin, un modèle de vision plus grand via `MISTRAL_VISION_MODEL`.

## 20. Déploiement en production (AWS EC2 Ubuntu)

### Architecture

Une instance **Ubuntu 24.04** (EC2 `t3.small` recommandée), installation native sans Docker :

- **Nginx** sert le frontend construit (`frontend/dist`) et relaie `/api/*` vers l'API ;
- **API Node.js** gérée par **systemd** (`landolsi-backend.service`), écoute sur `127.0.0.1:5001` ;
- **PostgreSQL 16** local, non exposé ; sauvegarde quotidienne (`landolsi-backup.timer`) ;
- images téléversées dans `/var/lib/landolsi/uploads`, secrets dans `/etc/landolsi/backend.env`.

Justification, alternatives (Supabase, RDS, 2ᵉ instance) et limites : [`docs/deployment/architecture.md`](docs/deployment/architecture.md), [`docs/deployment/database-strategy.md`](docs/deployment/database-strategy.md).

### Contraintes AWS Academy

Session limitée (instances arrêtées en fin de session), IP publique changeante, création de rôles IAM interdite (`LabInstanceProfile`), clé `vockey`, budget limité, identifiants temporaires à ne jamais committer. Sans nom de domaine, le site est en HTTP. Détails : [`docs/deployment/aws-academy-deployment.md`](docs/deployment/aws-academy-deployment.md).

### Étapes

```bash
# 1. Provisionner l'instance (poste local, identifiants du lab configurés)
cd infra/aws
cp terraform.tfvars.example terraform.tfvars    # renseigner ssh_allowed_cidr = "<votre IP>/32"
terraform init && terraform plan -out tfplan     # relire : aucune destruction
terraform apply tfplan
terraform output ssh_command

# 2. Sur l'instance
ssh -i ~/.ssh/labsuser.pem ubuntu@<IP>
sudo git clone https://github.com/ngrassa/projet_Landolsi.git /opt/landolsi-src
sudo /opt/landolsi-src/scripts/install.sh
sudo nano /etc/landolsi/backend.env              # SMTP, Telegram, ADMIN_* (nouveaux secrets)
# Clé Mistral : scripts/configure-ai.sh (voir « Redéploiement complet » ci-dessous)
sudo /opt/landolsi-src/scripts/deploy.sh --source /opt/landolsi-src

# 3. Compte administrateur (base neuve uniquement)
cd /opt/landolsi/current/backend
sudo -u landolsi env NODE_ENV=production ENV_FILE=/etc/landolsi/backend.env node createAdmin.js

# 4. Vérifier
/opt/landolsi/current/scripts/health-check.sh
```

Ouvrir ensuite `http://<IP>/`.

**AWS Academy :** le lab interdit la création de Security Group par Terraform et l'import de clés SSH ; créez le groupe avec l'AWS CLI et renseignez `security_group_id` et `ssh_public_key` dans `terraform.tfvars` (procédure : [`docs/deployment/aws-academy-deployment.md`](docs/deployment/aws-academy-deployment.md) §2). Vérifiez aussi que votre compte peut lancer une instance (`aws ec2 run-instances --dry-run ...` doit répondre `DryRunOperation`) : refusé le 2026-10-29, autorisé le 2026-10-30 sur le même compte.

**Nouvelle session du lab :** recopiez les identifiants dans `~/.aws/credentials`, puis vérifiez que le Security Group de `terraform.tfvars` existe encore (`aws ec2 describe-security-groups --group-ids sg-...`). Une réinitialisation du lab peut le supprimer : recréez-le, retirez les anciennes règles de l'état (`terraform state rm aws_vpc_security_group_ingress_rule.ssh ...`) et relancez `terraform plan`. Mettez aussi à jour `ssh_allowed_cidr` si votre IP a changé.

Avec `git_repo_url = "https://github.com/ngrassa/projet_Landolsi.git"` dans `terraform.tfvars`, cloud-init exécute automatiquement l'étape 2 (environ 2 minutes, journal : `/var/log/cloud-init-output.log`).

Sans Terraform, créer l'instance dans la console (Ubuntu 24.04, SSH limité à votre IP, HTTP ouvert, IMDSv2) puis reprendre à l'étape 2.

### Redéploiement complet sur AWS depuis GitHub (procédure de référence)

Procédure à suivre à chaque nouvelle session du lab (ou après `terraform destroy`). Elle part de ce dépôt public : cloud-init clone la branche `master`, installe et déploie automatiquement le code, **assistants IA compris**. Les seuls éléments qui ne sont pas dans Git, par sécurité, sont fournis aux étapes 5, 5 bis et 6 : la clé Mistral, les identifiants SMTP et les données.

**Pré-requis sur le poste d'administration :** Terraform ≥ 1.5, AWS CLI, la clé SSH `~/.ssh/landolsi_ec2_ed25519`, la clé Mistral dans `backend/.env` (`MISTRAL_API_KEY=...`), les sauvegardes chiffrées et leur phrase secrète (voir [`lisezmoi.txt`](lisezmoi.txt)).

```bash
# 1. Identifiants du lab : AWS Academy > AWS Details > AWS CLI, à copier dans ~/.aws/credentials
aws sts get-caller-identity                        # doit afficher le compte du lab

# 2. Vérifier terraform.tfvars (infra/aws/, jamais versionné)
cd infra/aws
grep -E 'security_group_id|ssh_allowed_cidr|git_repo_url|eip' terraform.tfvars
#   git_repo_url      = "https://github.com/ngrassa/projet_Landolsi.git"
#   eip_allocation_id = "eipalloc-09a864995fee440c0"   # IP 54.146.95.182 conservée => même URL
#   allocate_eip      = false
#   ssh_allowed_cidr  = "<votre IP>/32"     -> curl -s https://checkip.amazonaws.com
aws ec2 describe-addresses --allocation-ids eipalloc-09a864995fee440c0   # l'IP est-elle toujours réservée ?
aws ec2 describe-security-groups --group-ids <sg-...>     # le groupe existe-t-il encore ?
#   S'il a disparu (réinitialisation du lab) : le recréer (docs/deployment/aws-academy-deployment.md §2),
#   puis : terraform state rm aws_vpc_security_group_ingress_rule.ssh aws_vpc_security_group_ingress_rule.http 'aws_vpc_security_group_ingress_rule.https[0]'

# 3. Provisionner
terraform init
terraform plan -out tfplan                         # relire : uniquement des créations
terraform apply tfplan
terraform output                                   # public_ip, sslip_domain, https_setup_command
IP=$(terraform output -raw public_ip)

# 4. Attendre la fin de cloud-init (2 à 3 minutes) puis activer HTTPS
until curl -fs http://$IP/api/health; do sleep 10; done; echo
eval "$(terraform output -raw https_setup_command)"     # install.sh --domain landolsi-tires-<ip>.sslip.io
cd ../..

# 5. Clé Mistral : lue sur l'entrée standard (absente de Terraform, de Git et de la ligne de commande)
grep '^MISTRAL_API_KEY=' backend/.env | cut -d= -f2- | \
  ssh -i ~/.ssh/landolsi_ec2_ed25519 ubuntu@$IP 'sudo /opt/landolsi-src/scripts/configure-ai.sh'
#   -> "Assistant IA opérationnel (test SAV : HTTP 200)". Autre modèle : configure-ai.sh --model <nom>

# 5 bis. E-mail (factures envoyées à la confirmation, mot de passe oublié) : mêmes principes
grep -E '^EMAIL_(USER|PASS)=' backend/.env | \
  ssh -i ~/.ssh/landolsi_ec2_ed25519 ubuntu@$IP 'sudo /opt/landolsi-src/scripts/configure-email.sh'
#   -> "Connexion SMTP vérifiée."

# 6. Données : restaurer la dernière sauvegarde chiffrée (base neuve = vide, sans compte admin)
B=~/.local/share/landolsi/backups; P=~/.config/landolsi/db-backup.passphrase
# Sauvegarde la plus récente (31/10/2026 17:44 UTC, avant terraform destroy) : 14 utilisateurs, 9 pneus, 43 commandes, 13 factures, 36 images
gpg --batch --pinentry-mode loopback --passphrase-file $P -o /tmp/landolsi.dump -d $B/landolsi_tires_20261031T174440Z.dump.gpg
gpg --batch --pinentry-mode loopback --passphrase-file $P -o /tmp/uploads.tar.gz -d $B/uploads_20261031T174440Z.tar.gz.gpg
sha256sum /tmp/landolsi.dump; cat $B/landolsi_tires_20261031T174440Z.dump.sha256.txt   # sommes identiques
scp -i ~/.ssh/landolsi_ec2_ed25519 /tmp/landolsi.dump /tmp/uploads.tar.gz ubuntu@$IP:/tmp/
ssh -i ~/.ssh/landolsi_ec2_ed25519 ubuntu@$IP '
  sudo chmod 644 /tmp/landolsi.dump
  sudo /opt/landolsi/current/scripts/restore-db.sh --file /tmp/landolsi.dump \
       --target-db landolsi_tires --env-file /etc/landolsi/backend.env --allow-nonempty
  T=$(mktemp -d); sudo tar xzf /tmp/uploads.tar.gz -C $T
  sudo rsync -a $T/uploads/ /var/lib/landolsi/uploads/; sudo chown -R landolsi:landolsi /var/lib/landolsi/uploads
  sudo /opt/landolsi-src/scripts/deploy.sh --source /opt/landolsi-src   # réapplique les migrations récentes
  sudo rm -rf $T /tmp/landolsi.dump /tmp/uploads.tar.gz'
rm -f /tmp/landolsi.dump /tmp/uploads.tar.gz

# 7. Vérifier
ssh -i ~/.ssh/landolsi_ec2_ed25519 ubuntu@$IP 'sudo /opt/landolsi/current/scripts/health-check.sh'
cd infra/aws && echo "https://$(terraform output -raw sslip_domain)/"
```

Sans données à restaurer (étape 6 sautée), créer le compte administrateur : voir « Compte administrateur sans écrire le mot de passe sur le disque » ci-dessous.

**Mettre à jour le serveur après un `git push`** (sans recréer l'instance) :

```bash
ssh -i ~/.ssh/landolsi_ec2_ed25519 ubuntu@<IP> \
  'cd /opt/landolsi-src && sudo git pull --ff-only && sudo scripts/deploy.sh --source /opt/landolsi-src'
```

La clé Mistral, les identifiants SMTP, le HTTPS et les données sont conservés : ils sont stockés sur le serveur, hors du répertoire de code.

**Fin de session :** sauvegarder d'abord (`sudo -u landolsi /opt/landolsi/current/scripts/backup-db.sh`, puis rapatrier et chiffrer l'archive comme décrit dans `lisezmoi.txt`), puis `terraform destroy` si l'instance ne doit pas être conservée.

**Même URL à chaque redéploiement :** l'IP élastique `54.146.95.182` (`eipalloc-09a864995fee440c0`) est réservée **en dehors de Terraform** et seulement *associée* à l'instance (`eip_allocation_id`). `terraform destroy` supprime l'instance et l'association mais **conserve l'IP** : le site revient à l'adresse **https://landolsi-tires-54-146-95-182.sslip.io** après `terraform apply` et l'étape 4 (nouveau certificat pour le même nom). Coût d'une IP réservée non associée : environ 0,005 $/h (≈ 3,6 $/mois) sur le budget du lab. Elle disparaît seulement si on la libère (`aws ec2 release-address --allocation-id eipalloc-09a864995fee440c0`) ou si le compte AWS Academy est réinitialisé (« Reset » du lab) : réserver alors une nouvelle IP (`aws ec2 allocate-address --domain vpc`), mettre son identifiant dans `eip_allocation_id` et communiquer la nouvelle URL.

**Points de vigilance**

- `health-check.sh` vérifie le site en `https://<domaine>` (résolu vers `127.0.0.1`) dès que Certbot est actif. L'ancien contrôle par `http://127.0.0.1` recevait un 301 et faisait annuler chaque déploiement.
- Relancer `install.sh` **sans** `--domain` remet Nginx en HTTP : passer toujours `--domain` une fois HTTPS activé.
- Les identifiants AWS Academy expirent à la fin de la session du lab : les recopier avant toute commande Terraform.
- Sur certaines offres Mistral, `mistral-small-latest` et `mistral-medium-latest` ont un quota nul (HTTP 429 permanent) ; le défaut `ministral-14b-latest` est utilisable.

### IP fixe et HTTPS

1. **IP fixe :** de préférence `eip_allocation_id = "eipalloc-..."` (IP réservée une fois, conservée par `terraform destroy`, voir ci-dessus). Avec `allocate_eip = true`, Terraform crée l'IP lui-même mais la **libère** au `destroy`. Dans les deux cas l'IP élastique remplace l'IP publique temporaire de l'instance et reste identique après arrêt/démarrage. Coût : environ 0,005 $/h, y compris instance arrêtée.
2. **Nom de domaine :** sans domaine acheté, utilisez [sslip.io](https://sslip.io), qui résout `<nom>-<IP avec des tirets>.sslip.io` vers l'IP (aucun compte nécessaire), par exemple `landolsi-tires-18-213-152-8.sslip.io`. Avec un domaine acheté, créez un enregistrement `A` vers l'IP élastique.
3. **Certificat :**
   ```bash
   sudo /opt/landolsi-src/scripts/install.sh --domain landolsi-tires-18-213-152-8.sslip.io   # --email facultatif
   ```
   Le script obtient le certificat Let's Encrypt, redirige HTTP et l'accès par IP vers `https://<domaine>`, passe `COOKIE_SECURE=true` et `CORS_ORIGINS=https://<domaine>`, puis redémarre l'API.

Relancer `install.sh` **sans** `--domain` remet la configuration Nginx HTTP d'origine (HTTPS désactivé). Si l'IP élastique est perdue (`terraform destroy`, réinitialisation du lab), le nom sslip.io change : refaire l'étape 3 avec le nouveau nom.

### Compte administrateur sans écrire le mot de passe sur le disque

```bash
cd /opt/landolsi/current/backend
sudo -u landolsi env NODE_ENV=production ENV_FILE=/etc/landolsi/backend.env \
    ADMIN_EMAIL=admin@landolsi.com ADMIN_PASSWORD='<mot de passe robuste>' node createAdmin.js
```

Le site étant public, n'utilisez pas de mot de passe faible ; relancer la commande réinitialise le mot de passe.

### Reprise des données de développement

Procédure complète (export de `pneus_db` depuis le poste, transfert, restauration, images) : [`docs/deployment/database-backup-restore.md`](docs/deployment/database-backup-restore.md) §3.

`scripts/restore-db.sh` a besoin d'une **sauvegarde de la base source** : le dépôt Git ne contient que le code. La sauvegarde présente sur le serveur (`/var/backups/landolsi/landolsi_tires_*.dump`, créée automatiquement avant la première migration) est celle d'une base vide. Sur le poste qui héberge `pneus_db` :

```powershell
pg_dump -h localhost -U postgres --format=custom -f pneus_db.dump pneus_db
```

La base du serveur contient déjà les tables et le compte administrateur : `restore-db.sh` refuse alors de restaurer (code 3). Après une sauvegarde (`sudo -u landolsi /opt/landolsi/current/scripts/backup-db.sh`), ajoutez `--allow-nonempty` (opération destructive : les tables présentes dans l'archive sont recréées, le compte administrateur de la sauvegarde remplace celui du serveur), puis copiez les images dans `/var/lib/landolsi/uploads`.

### Sauvegarde chiffrée et restauration CI/CD

La base de production du 30 octobre 2026 est sauvegardée **chiffrée** (GPG AES-256) **hors de ce dépôt public** ; seules ses sommes SHA-256 de référence sont versionnées dans `db/backup/`. Le workflow `.github/workflows/db-restore.yml` télécharge l'archive depuis un stockage privé (`DB_BACKUP_URL`), vérifie sa somme et la restaure dans un PostgreSQL éphémère (`verify`) ou, sur déclenchement manuel confirmé, sur l'EC2 (`restore-ec2`). Restauration manuelle : `DB_BACKUP_PASSPHRASE=… scripts/restore-encrypted-backup.sh --archive <archive.gpg> -- --target-db <base> --create`. Consignes : [`lisezmoi.txt`](lisezmoi.txt) ; détails : [`docs/deployment/database-backup-restore.md`](docs/deployment/database-backup-restore.md) §6.

### Exploitation

| Action | Commande |
|---|---|
| État des services | `systemctl status landolsi-backend nginx postgresql` |
| Journaux API | `journalctl -u landolsi-backend -f` |
| Santé | `/opt/landolsi/current/scripts/health-check.sh` |
| Mise à jour | `cd /opt/landolsi-src && sudo git pull --ff-only && sudo scripts/deploy.sh --source /opt/landolsi-src` |
| Identifiants SMTP (e-mails) | `grep -E '^EMAIL_(USER\|PASS)=' backend/.env \| ssh … 'sudo /opt/landolsi-src/scripts/configure-email.sh'` |
| Clé / modèle Mistral | `… \| sudo /opt/landolsi-src/scripts/configure-ai.sh [--model <nom>]` (clé sur l'entrée standard) |
| Journaux des assistants IA | `journalctl -u landolsi-backend \| grep -E 'Assistant\|Mistral\|Outil IA'` |
| Retour arrière | `sudo /opt/landolsi/current/scripts/rollback.sh` |
| Sauvegarde manuelle | `sudo -u landolsi /opt/landolsi/current/scripts/backup-db.sh` |
| Restauration (nouvelle base) | `scripts/restore-db.sh --file <archive.dump> --target-db <base>` |

`deploy.sh` sauvegarde la base, applique les migrations, bascule atomiquement vers la nouvelle version et revient automatiquement à la précédente si le contrôle de santé échoue. Le redémarrage coupe l'API quelques secondes. Les migrations ne sont pas annulées par un retour arrière : voir [`docs/deployment/rollback.md`](docs/deployment/rollback.md). Dépannage : [`docs/deployment/troubleshooting.md`](docs/deployment/troubleshooting.md).

### Portabilité

Seul `infra/aws/` est spécifique à AWS. `scripts/`, `systemd/` et `nginx/` fonctionnent sur toute VM Ubuntu 22.04/24.04 ; la base peut être remplacée par un PostgreSQL managé (`DB_HOST`, `DB_SSL=true`, `install.sh --external-db`). Limite : les images sont stockées sur le disque local, ce qui impose une seule instance applicative.

---

**Projet :** LANDOLSI TIRES — plateforme web de vente de pneumatiques  
**Cadre :** Projet de fin d'études (PFE)  
**Langue de documentation :** français
