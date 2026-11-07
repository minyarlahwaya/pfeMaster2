# Pipeline CI/CD GitHub Actions — LANDOLSI TIRES

> **Base Supabase (7 novembre 2026)** — Le pipeline ne restaure plus aucune sauvegarde :
> la VM n'a plus de PostgreSQL local. `install.sh --external-db` puis `scripts/configure-db.sh`
> écrivent la connexion Supabase (session pooler IPv4, TLS vérifié avec
> `backend/certs/prod-ca-2021.crt`) dans `/etc/landolsi/backend.env` ; `deploy.sh` applique
> les migrations directement sur Supabase. Le job **1.2b** contrôle la base en lecture seule à
> chaque exécution. Les tests (1.2) et le DAST (3.5) gardent une base **jetable** : ils écrivent
> des données ou lancent des attaques et ne doivent jamais viser la production.
> Le workflow **Destroy** n'archive plus que les images téléversées (S3 chiffré), réinjectées
> au déploiement suivant ; la base Supabase n'est jamais touchée.
> Secrets supplémentaires : `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`,
> `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`.


Deux workflows automatisent tout le cycle de vie du site, du commit jusqu'à la
machine virtuelle AWS, puis le chemin inverse :

| Workflow | Fichier | Déclenchement |
|---|---|---|
| **CI/CD — LANDOLSI TIRES** | `.github/workflows/cicd.yml` | push dont le titre de commit contient `[deploy]` (phases 1, 2, 3) ou `[ci]` (phases 1 et 3) ; bouton **Run workflow** |
| **Destroy — infrastructure AWS** | `.github/workflows/destroy.yml` | bouton **Run workflow** + saisie `DESTROY` |

Fichiers associés :

| Fichier | Rôle |
|---|---|
| `.github/actions/terraform-init/action.yml` | identifiants AWS, bucket d'état, `terraform init` sur S3 (partagé par les deux workflows) |
| `.github/scripts/sg-ssh.sh` | ouverture/fermeture « juste-à-temps » du port 22 pour l'IP du runner |
| `.github/scripts/ssh-setup.sh` | clé SSH, vérification de l'empreinte d'hôte via la console AWS, alias `ssh ec2` |
| `.zap/rules.tsv` | réglage des règles OWASP ZAP (faux positifs justifiés) |
| `infra/aws/.checkov.yaml` | exceptions Checkov justifiées (contexte AWS Academy) |

## 0. Déclenchement : uniquement sur demande dans le titre du commit

Un `push` ne lance **rien**, sauf si le **titre** (première ligne) d'un des
commits poussés contient un marqueur :

| Marqueur dans le titre | Exécution |
|---|---|
| `[deploy]` | pipeline complet : CI → VM AWS → déploiement + restauration de la base → analyses de sécurité |
| `[ci]` | CI + analyses de sécurité, **sans** ressource AWS |
| aucun | push sans pipeline : seul le job « 0. Déclenchement » lit le message (quelques secondes), les 15 autres sont ignorés |

```bash
git commit -m "Correction du calcul des promotions [deploy]" && git push   # déploie
git commit -m "Refonte du panier [ci]" && git push                          # teste sans déployer
git commit -m "Coquilles dans le README" && git push                        # aucune action
```

Le marqueur n'est lu que dans le titre : une description qui cite `[deploy]`
ne déclenche rien. Le bouton **Run workflow** reste disponible (case `deploy`).
Les pull requests ne déclenchent plus le pipeline, et `db-restore.yml` n'est plus
lancé par un push (bouton seulement). GitHub affiche quand même une ligne pour
chaque push, avec le seul job 0 exécuté : un workflow ne peut pas filtrer sur le
message de commit avant de démarrer.

## 1. Vue d'ensemble

Priorité : **la VM AWS et le site en ligne d'abord**, les analyses de sécurité
longues ensuite. Durées mesurées sur GitHub : phase 1 ≈ 1 min ; ZAP actif ≈ 4 min 30.

```
push / PR / bouton
        │
 PHASE 1 (≈1 min, bloquante)        PHASE 2 ([deploy] ou bouton)             PHASE 3 (à la fin)
        ├── 1.1 Qualité ───┐
        ├── 1.2 Tests ─────┤
        ├── 1.3 Build ─────┼──► 1.5 Porte CI ──► 2.1 AWS prérequis
        └── 1.4 Gitleaks ──┘                          ▼
                                               2.2 Terraform (création VM)
                                                      ▼
                                               2.3 Déploiement (cloud-init, HTTPS)
                                                      ▼
                                               2.4 Tests de fumée ──────────► 3.1 CodeQL
                                               2.5 Observabilité CloudWatch
                                                                              3.2 Semgrep
                                                                              3.3 SCA + SBOM
                                                                              3.4 IaC (Checkov, Trivy)
                                                                              3.5 DAST (ZAP actif, préprod)
                                                                                      ▼
                                                                              3.6 Rapport final
                                                                                      ▼
                                                                              4. Notification e-mail (succès)
```

Sans déploiement (marqueur `[ci]`), la phase 3 démarre dès la porte CI.
Le DAST production (ZAP passif, Nuclei, testssl, > 2 min 40) a été retiré : trop long
pour un apport faible, l'OWASP ZAP **actif** de la préproduction couvre l'application.
Les analyses de la phase 3 s'exécutent même si une étape précédente a échoué
(rapports toujours produits) ; un constat bloquant y rend le run **rouge** et
apparaît dans le rapport final, sans retirer le site déjà en ligne.

Chaque job écrit un **résumé** (onglet *Summary* du run) : tableaux de résultats,
plan Terraform, sorties, URL. Les constats SAST/IaC/SCA sont aussi publiés au
format SARIF dans **Security > Code scanning**.

## 2. Phase 1 — Intégration continue rapide (bloquante)

| Job | Ce qui est vérifié | Bloquant |
|---|---|---|
| **1.1 Qualité** | ESLint (React) ; `node --check` sur tout le backend ; casse des imports (Windows → Linux) ; ShellCheck des scripts d'exploitation ; **actionlint** des workflows ; `terraform fmt` + `validate` | oui |
| **1.2 Tests** | PostgreSQL 16 éphémère (service Docker) ; migrations Sequelize **deux fois** (idempotence) ; 93 tests `node:test` (configuration, API HTTP, MFA, IA, facture, photo) avec **couverture de code** et rapport JUnit ; test sauvegarde → restauration → comparaison schéma/comptages/séquences | oui |
| **1.3 Build** | `npm ci` + build Vite avec `VITE_API_URL=/api` ; aucune URL `localhost:5001` dans le bundle ; artefact `frontend-dist` réutilisé par le DAST | oui |
| **1.4 Secrets** | **Gitleaks** sur tout l'historique Git (clés AWS, jetons, mots de passe) | oui |
| **1.5 Porte CI** | tableau des contrôles ; décide du lancement de la phase 2 | — |

ESLint : la règle `react-hooks/set-state-in-effect` (12 composants, dette
recensée dans `readiness-report.md`) est signalée en avertissement ; toute autre
erreur bloque. Le premier passage a révélé un vrai bug (`setAvis` non défini
dans `CommandeDetails.jsx`), corrigé.

## 3. Phase 3 — Analyses de sécurité statiques (après le déploiement)

| Job | Outil | Cible | Politique |
|---|---|---|---|
| **3.1** | **CodeQL** (`security-extended`) | JavaScript/React/Node et workflows GitHub Actions (injections, XSS, SSRF, chemins, ReDoS, injection de commandes dans les workflows...) | alertes dans Code scanning |
| **3.2** | **Semgrep** | règles OWASP Top 10, JavaScript, Node.js, nodejsscan, React, secrets, Terraform, GitHub Actions | **bloque** sur sévérité ERROR (règle MongoDB `node_nosqli_injection` exclue : faux positif avec Sequelize) |
| **3.3** | **npm audit** | dépendances backend et frontend | **bloque** sur vulnérabilité haute/critique en production |
| 3.3 | **Trivy fs** | vulnérabilités + secrets du dépôt | rapport SARIF |
| 3.3 | **SBOM CycloneDX** | inventaire des composants | artefact `sbom-cyclonedx` |
| **3.4** | **Checkov** | Terraform + workflows | **bloquant** (7 exceptions justifiées une à une dans `infra/aws/.checkov.yaml`) |
| 3.4 | **Trivy config** | Terraform | rapport SARIF |

Le premier passage de la SCA a trouvé **4 vulnérabilités critiques** et 9 hautes
dans le backend : `jade` (moteur de vues inutilisé) supprimé, `express` 4.16 → 4.22
et `morgan` mis à jour, `npm audit fix` appliqué au frontend. Résultat : 0 vulnérabilité
haute ou critique dans les dépendances de production.

### Corrections apportées grâce aux analyses (1er novembre 2026)

| Outil | Constat | Correction |
|---|---|---|
| ESLint | `setAvis` non défini (`CommandeDetails.jsx`) : exception à chaque affichage d'avis | état restauré |
| npm audit | 4 critiques + 9 hautes (jade, proxy-addr, express 4.16...) | jade supprimé (inutilisé), express 4.22, morgan 1.12, `npm audit fix` |
| Semgrep | AES-GCM sans longueur de tag imposée (`mfaService.js`) : tag tronqué accepté | `authTagLength: 16` + contrôle explicite (secrets existants compatibles) |
| CodeQL | aucune limitation de débit sur connexion, MFA, mot de passe oublié (force brute d'un code à 6 chiffres) | `rateLimit` : 10/min (connexion, MFA, inscription), 5/min (réinitialisation) + tests |
| OWASP ZAP | X-Powered-By, CSP, Permissions-Policy, CORP absents | `app.disable("x-powered-by")`, `nginx/security-headers.conf` (CSP stricte, HSTS, COOP/CORP) |
| Checkov | sortie SARIF mal écrite | corrigée ; Checkov devient bloquant |

Faux positifs analysés et documentés : `node_nosqli_injection` (MongoDB, 13), `node_secret`
(secret de développement refusé en production, nom de paramètre), alertes CodeQL sur les
cookies (`httpOnly` et `secure` sont fixés par `cookieOptions()`).

## 4. Phase 3 — DAST préproduction (3.5)

**3.5 DAST préproduction** reconstruit l'architecture de production **dans le
runner** : PostgreSQL 16, API Node en `NODE_ENV=production`, Nginx avec le
fichier réel `nginx/landolsi.conf`, frontend issu du job Build. OWASP ZAP lance
ensuite un **scan complet actif** (spider, AJAX spider pour la SPA React,
injections SQL, XSS, traversée de chemins, etc.). Les attaques actives sont
faites ici, sur une base jetable, jamais sur la production.
Porte : **aucune alerte de risque élevé**. Rapports HTML/JSON/Markdown dans
l'artefact `zap-preproduction`.

Il s'exécute à la fin (après la mise en ligne) car c'est l'analyse la plus longue.

## 5. Phase 2 — Création de la VM et déploiement (prioritaire)

### 2.1 Prérequis AWS (AWS CLI)
1. `sts get-caller-identity` : message explicite si la session AWS Academy a expiré.
2. `run-instances --dry-run` : le compte peut-il lancer une instance ?
3. **Bucket S3 de l'état Terraform** `landolsi-tires-tfstate-<compte>-<région>` :
   créé si absent, versionné, chiffré, accès public bloqué. Indispensable :
   un runner est éphémère, le workflow Destroy doit retrouver l'état.
4. **Security Group** `landolsi-tires-app` : retrouvé ou créé par l'AWS CLI
   (AWS Academy interdit à Terraform de le créer, voir `main.tf`). Les règles
   SSH temporaires d'un run interrompu sont purgées.
5. **IP élastique** : variable `EIP_ALLOCATION_ID` (`eipalloc-09a864995fee440c0`,
   IP 54.146.95.182), sinon recherche par tag, sinon réservation. Hors Terraform :
   **même URL** à chaque déploiement.
6. **Clé SSH** : la clé publique est dérivée du secret `SSH_PRIVATE_KEY` et
   injectée par cloud-init (`ImportKeyPair` est interdit dans le lab).
7. Écriture de `ci.auto.tfvars.json` dans le bucket (réutilisé par Destroy).

### 2.2 Terraform
`init` (backend S3, verrou `use_lockfile`) → `validate` → import des règles
déjà présentes dans le Security Group → `plan` (affiché dans le résumé) →
**garde-fou** : échec si le plan détruit ou remplace l'instance (sa base
PostgreSQL serait perdue) → `apply` → sorties (instance, IP, domaine sslip.io,
volume racine) → attente de l'état `running`.

Ressources créées : instance EC2 Ubuntu 24.04 (IMDSv2 obligatoire, volume gp3
chiffré), règles HTTP/HTTPS/SSH du Security Group, association de l'IP élastique.

### 2.3 Déploiement applicatif
1. **SSH juste-à-temps** : le port 22 n'est ouvert qu'à l'IP `/32` du runner,
   le temps du job, puis refermé (`if: always()`). Par défaut, SSH est fermé
   à Internet (`ADMIN_SSH_CIDR` absent = `127.0.0.1/32`).
2. **Empreinte d'hôte vérifiée** : la clé ED25519 du serveur est comparée à
   celle que cloud-init publie dans la console série AWS (protection MITM).
3. Attente de **cloud-init** (mises à jour, `install.sh`, premier `deploy.sh`) ;
   affichage de la fin de son journal.
4. Positionnement du code serveur sur **le commit du pipeline**, `install.sh`
   (idempotent) avec `--domain landolsi-tires-<ip>.sslip.io` : certificat
   **Let's Encrypt**. En cas d'échec (limite de 5 certificats par semaine pour
   un même nom), retour automatique en HTTP et avertissement.
5. `deploy.sh` si la version active n'est pas celle du commit : build, sauvegarde,
   migrations, bascule atomique, **rollback automatique** si le contrôle de
   santé échoue.
6. Secrets facultatifs, transmis sur l'entrée standard (jamais en ligne de
   commande, jamais dans Terraform) : `MISTRAL_API_KEY`, `EMAIL_USER`/`EMAIL_PASS`,
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seulement si aucun administrateur),
   `DB_BACKUP_*` (voir ci-dessous).
7. **Restauration de la base, dans la foulée** (uniquement sur base vide : une base
   peuplée n'est jamais écrasée). Source la plus récente disponible, toujours
   chiffrée GPG AES-256 : sauvegarde déposée dans S3 par le pipeline Destroy, sinon
   secret `DB_BACKUP_GPG_B64`, sinon `DB_BACKUP_URL`. Déchiffrement sur le runner
   (`DB_BACKUP_PASSPHRASE`, sinon **clé dérivée de `SSH_PRIVATE_KEY`** : voir
   ci-dessous ; intégrité vérifiée par GPG), `restore-db.sh`, puis
   migrations récentes réappliquées ; comptages publiés dans le résumé. Les images
   du catalogue sont déjà dans le dépôt.
8. `health-check.sh` (API, Nginx, frontend, certificat) et état des services.

### 2.4 Tests de fumée (depuis Internet)
Page d'accueil, `/api/health` (base up), catalogue, route admin → 401, 404 sans
pile d'erreur, en-têtes de sécurité, version Nginx masquée, **ports 5001 et 5432
fermés**, SSH fermé après le job, certificat valide, redirection HTTP → HTTPS, HSTS
(avertissement).

### 2.5 Observabilité CloudWatch

| Brique | Où | Contenu |
|---|---|---|
| Métriques EC2 de base | AWS, sans agent | CPU, réseau, contrôles de santé (`StatusCheckFailed`) |
| **Agent CloudWatch** | `scripts/configure-cloudwatch.sh`, lancé par SSH | mémoire, swap, disque `/`, processus `node`/`postgres`/`nginx` (espace de noms `LandolsiTires`, dimension `InstanceId`) |
| **Journaux** | groupes `/landolsi-tires/{nginx-access,nginx-error,backend,backup,cloud-init}` | rétention `LOG_RETENTION_DAYS` (14 j) ; créés **hors Terraform** : consultables après Destroy |
| **Filtres de métriques** | job 2.5 (AWS CLI) | `HttpRequests`, `Http4xx`, `Http5xx` (journal d'accès Nginx), `ApiErrors` (journal de l'API) |
| **Alarmes** | Terraform, `infra/aws/observability.tf` | CPU > 80 % (10 min), contrôle de santé EC2, mémoire > 85 %, disque > 85 %, > 5 réponses 5xx / 5 min, > 10 erreurs API / 5 min |
| **Tableau de bord** | Terraform, `aws_cloudwatch_dashboard` | CloudWatch > Dashboards > `landolsi-tires` : graphiques, état des alarmes, dernières erreurs de l'API (Logs Insights) |
| **Notifications** | rubrique SNS `landolsi-tires-notifications` (job 2.1, hors Terraform) | alarmes (passage en ALARME et retour à OK) et « pipeline réussi » |

L'agent a besoin d'un profil d'instance : AWS Academy interdit la création de rôles,
le pipeline utilise donc `LabInstanceProfile` (variable `IAM_INSTANCE_PROFILE`,
`none` pour s'en passer : seules les métriques EC2 de base restent). Les alarmes et
le tableau de bord sont supprimés par Destroy avec la VM ; la rubrique SNS, ses
abonnements et les journaux sont conservés.

### 3.6 Rapport final
URL du site, instance, IP, résultat de chaque étape des trois phases.

### 4. Notification e-mail « pipeline réussi »

Job `notify`, exécuté seulement si le rapport final est vert (aucune étape en
échec ni annulée), en mode `[deploy]` comme en mode `[ci]`. Le message contient le
commit, l'auteur, l'URL du site, l'instance, le lien du tableau de bord et du run.

| Canal | Condition | Remarque |
|---|---|---|
| **Amazon SNS** (principal) | identifiants AWS valides, abonnement confirmé | au 1er déploiement, chaque destinataire reçoit « AWS Notification - Subscription Confirmation » : cliquer **Confirm subscription** une fois |
| **SMTP** (complément) | secrets `EMAIL_USER` / `EMAIL_PASS` (Gmail : mot de passe d'application) | envoi direct, sans confirmation ; `SMTP_HOST`/`SMTP_PORT` modifiables |

Destinataires : variable (ou secret) `NOTIFICATION_EMAILS`, adresses séparées par
des virgules. Le dépôt et ses journaux sont **publics** : les adresses ne sont écrites
ni dans le code ni dans la documentation, et sont masquées (`::add-mask::`) dans les
journaux. Si aucun canal n'aboutit, le job affiche un avertissement sans rendre le run rouge.

## 6. Pipeline Destroy (chemin inverse)

**Actions > Destroy — infrastructure AWS > Run workflow**, saisir `DESTROY`.

| Job | Action |
|---|---|
| D1 Vérifications | confirmation, identifiants, état S3, liste des ressources |
| D2 Sauvegarde | `backup-db.sh` sur le serveur, **instantané EBS** du volume racine ; si `DB_BACKUP_PASSPHRASE` existe : archive **chiffrée GPG** téléchargeable et copie dans le bucket S3 privé (`backups/landolsi_tires_latest.dump.gpg`), **restaurée automatiquement au prochain déploiement** (le dépôt est public : jamais de données en clair) |
| D3 Destruction | `terraform plan -destroy` affiché, puis destroy ; vérification `instance-terminated` et état vide. Ne s'exécute **pas** si la sauvegarde a échoué |
| D4 Nettoyage | règles SSH temporaires ; volume racine supprimé **sur option** (refusé sans instantané ni archive) ; IP élastique libérée **sur option** |
| D5 Rapport | ce qui est supprimé / conservé |

Options : `backup` (défaut oui), `delete_root_volume` (défaut non),
`release_eip` (défaut non : même URL au prochain déploiement).

## 7. Configuration

**Secrets** (Settings > Secrets and variables > Actions > Secrets)

| Secret | Obligatoire | Usage |
|---|---|---|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | oui | AWS Academy > AWS Details > AWS CLI. **Expirent avec la session du lab (~4 h)** : les recopier à chaque session |
| `SSH_PRIVATE_KEY` | oui | clé privée sans phrase secrète (ex. `~/.ssh/landolsi_ec2_ed25519`) |
| `MISTRAL_API_KEY` | non | assistants IA |
| `EMAIL_USER`, `EMAIL_PASS` | non | factures par e-mail ; aussi canal SMTP de la notification « pipeline réussi » |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | non | compte administrateur sur une base neuve |
| `DB_BACKUP_PASSPHRASE` | pour restaurer | phrase secrète GPG des sauvegardes (`~/.config/landolsi/db-backup.passphrase`) |
| `DB_BACKUP_GPG_B64` | non | sauvegarde chiffrée de référence en base64 (archive < 36 Ko) |
| `DB_BACKUP_URL`, `DB_BACKUP_TOKEN` | non | sauvegarde chiffrée sur un stockage privé externe |

**Variables** (onglet Variables)

| Variable | Défaut | Usage |
|---|---|---|
| `EIP_ALLOCATION_ID` | `eipalloc-09a864995fee440c0` | IP élastique conservée |
| `AWS_REGION` | `us-east-1` | région |
| `INSTANCE_TYPE` | `t3.small` | type d'instance (push) |
| `ADMIN_SSH_CIDR` | fermé | votre IP `/32` pour SSH manuel |
| `ADMIN_SSH_PUBLIC_KEY` | aucune | clé SSH **publique** de l'administrateur, ajoutée sur la VM |
| `SECURITY_GROUP_ID` | recherche par nom | groupe imposé |
| `MISTRAL_MODEL` | `ministral-14b-latest` | modèle Mistral |
| `LETSENCRYPT_EMAIL` | aucun | e-mail du compte Let's Encrypt |
| `ENABLE_HTTPS` | `true` | HTTPS lors des déploiements automatiques |
| `NOTIFICATION_EMAILS` | aucune | destinataires des notifications (pipeline réussi, alarmes), séparés par des virgules |
| `IAM_INSTANCE_PROFILE` | `LabInstanceProfile` | profil de l'instance pour l'agent CloudWatch (`none` = sans agent) |
| `LOG_RETENTION_DAYS` | `14` | rétention des journaux CloudWatch |
| `SMTP_HOST`, `SMTP_PORT` | `smtp.gmail.com`, `465` | serveur SMTP de la notification (si `EMAIL_USER`/`EMAIL_PASS`) |

### Sauvegardes sans secret supplémentaire : clé dérivée de la clé SSH

Les sauvegardes manipulées par le pipeline sont chiffrées (GPG AES-256) avec
`DB_BACKUP_PASSPHRASE` s'il existe, sinon avec une phrase secrète **dérivée de
`SSH_PRIVATE_KEY`** (`.github/scripts/backup-key.sh` : SHA-256 de la signature
`ssh-keygen -Y sign` d'un message fixe ; les signatures Ed25519/RSA sont
déterministes). Aucun secret à ajouter, rien n'est publié : les archives vont dans
le bucket S3 privé et dans des artefacts chiffrés. Quiconque possède la clé SSH
du serveur peut les déchiffrer (même niveau de confiance que l'accès au serveur) :

```bash
aws s3 cp s3://landolsi-tires-tfstate-<compte>-us-east-1/landolsi-tires/backups/landolsi_tires_latest.dump.gpg .
.github/scripts/backup-key.sh <clé privée de SSH_PRIVATE_KEY> | gpg --batch --pinentry-mode loopback \
    --passphrase-fd 0 -o landolsi.dump -d landolsi_tires_latest.dump.gpg
```

Si le secret `SSH_PRIVATE_KEY` change, les anciennes archives S3 restent
déchiffrables avec l'ancienne clé uniquement : le conserver.

**Cycle des données** : Destroy (pg_dump → chiffrement → S3) → déploiement suivant
(S3 → déchiffrement → `restore-db.sh` → migrations). Une base vide n'écrase jamais
la dernière sauvegarde S3.

**Injecter une sauvegarde du poste d'administration** (une fois) : variables
`ADMIN_SSH_PUBLIC_KEY` (clé publique) et `ADMIN_SSH_CIDR` (votre IP/32), lancer le
pipeline, restaurer par SSH (README §20, étape 6), puis Destroy la dépose dans S3.

## 8. Utilisation

```bash
# Déployer : marqueur [deploy] dans le titre du commit...
git commit -m "Ma modification [deploy]" && git push
# ... ou bouton Run workflow
gh workflow run cicd.yml --repo ngrassa/projet_Landolsi -f deploy=true
gh run watch --repo ngrassa/projet_Landolsi

# Détruire
gh workflow run destroy.yml --repo ngrassa/projet_Landolsi -f confirm=DESTROY
```

**Nouvelle session AWS Academy** : mettre à jour les 3 secrets AWS, puis relancer.

```bash
gh secret set AWS_ACCESS_KEY_ID     --repo ngrassa/projet_Landolsi
gh secret set AWS_SECRET_ACCESS_KEY --repo ngrassa/projet_Landolsi
gh secret set AWS_SESSION_TOKEN     --repo ngrassa/projet_Landolsi
```

## 9. Coexistence avec le déploiement manuel

Le pipeline utilise un **état Terraform distant (S3)** ; le poste local garde
son état local (`infra/aws/terraform.tfstate`). Ne pas gérer la même instance
des deux façons : utiliser le pipeline (ou, localement, `terraform init
-backend-config=...` avec le même bucket, voir l'action `terraform-init`).
