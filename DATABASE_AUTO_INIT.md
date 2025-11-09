# Guide d'Initialisation Automatique de la Base de Données

Ce document explique comment l'application initialise automatiquement la base de données au démarrage ou au déploiement.

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Développement Local](#développement-local)
3. [Déploiement Vercel](#déploiement-vercel)
4. [Endpoints d'Initialisation](#endpoints-dinitialisation)
5. [Dépannage](#dépannage)

---

## Vue d'Ensemble

L'application dispose de **3 mécanismes d'initialisation** de la base de données :

### 1. 🔄 Automatique au Démarrage (Local)

Scripts qui s'exécutent automatiquement avec `npm run dev` ou `npm start` :
- `scripts/start-with-db-check.mjs` - Lance l'app après vérification DB
- `scripts/init-db.mjs` - Vérifie et initialise la DB

### 2. 🏗️ Pendant le Build (Vercel)

Scripts qui s'exécutent pendant `npm run build` sur Vercel :
- `scripts/vercel-build.mjs` - Build intelligent avec init DB
- Applique les migrations automatiquement
- Seed la base de données si nécessaire

### 3. 🔧 Manuelle via API (Post-Déploiement)

Endpoints API pour initialisation/vérification manuelle :
- `GET /api/health` - Vérifier l'état de la DB
- `GET /api/setup` - Vérifier l'état d'initialisation
- `POST /api/setup` - Initialiser manuellement (sécurisé)

---

## Développement Local

### Démarrage Automatique

```bash
# Démarrage avec vérification automatique de la DB
npm run dev

# Que fait ce script ?
# 1. Charge les variables d'environnement (.env)
# 2. Vérifie DATABASE_URL
# 3. Génère le Prisma Client si nécessaire
# 4. Vérifie la connexion à la DB
# 5. Applique les migrations en attente
# 6. Lance le serveur Next.js
```

### Démarrage Sans Vérification

```bash
# Démarrage direct sans vérification DB (plus rapide)
npm run dev:unsafe
```

### Initialisation Manuelle de la DB

```bash
# Vérifier et initialiser la DB manuellement
npm run db:check

# Ou étape par étape :
npm run db:generate        # Générer le Prisma Client
npm run db:migrate         # Appliquer les migrations (dev)
npm run db:seed            # Seed la base de données
```

---

## Déploiement Vercel

### Configuration Requise

Dans **Vercel Dashboard → Settings → Environment Variables**, configurez :

```bash
# Base de données (CRITIQUE)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public&connection_limit=1&pool_timeout=10"

# NextAuth (CRITIQUE)
NEXTAUTH_SECRET="<générer avec: openssl rand -base64 32>"
NEXTAUTH_URL="https://votre-domaine.vercel.app"

# Setup Token (OPTIONNEL - pour endpoint POST /api/setup)
SETUP_TOKEN="<token secret pour initialisation manuelle>"

# AI Services (OPTIONNEL)
ANTHROPIC_API_KEY="sk-..."
OPENAI_API_KEY="sk-..."
```

### Build Command dans Vercel

Le build command par défaut est :

```bash
npm run build
```

Ce qui exécute :

```bash
# Dans package.json :
"build": "npm run db:deploy && next build"

# db:deploy exécute :
"db:deploy": "npx prisma migrate deploy && npx prisma db seed"
```

### Flux d'Initialisation Automatique

```
1. npm install
   ↓
2. postinstall → npx prisma generate
   ↓
3. npm run build
   ↓
4. db:deploy → migrations + seed
   ↓
5. next build → Compilation Next.js
   ↓
6. Déploiement ✅
```

### Script de Build Personnalisé (Optionnel)

Pour un contrôle plus fin, utilisez le script Vercel dédié :

Dans **Vercel Dashboard → Settings → Build & Development Settings** :

```bash
# Build Command
node scripts/vercel-build.mjs
```

Ce script :
- ✅ Gère les erreurs de connexion DB gracieusement
- ✅ Utilise `db push` en fallback si migrations échouent
- ✅ Continue même si seed échoue
- ✅ Fournit des logs détaillés

---

## Endpoints d'Initialisation

### 1. Health Check

**Vérifier l'état de l'application et de la DB**

```bash
# GET /api/health
curl https://votre-domaine.vercel.app/api/health
```

**Réponse si tout va bien (200)** :
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T19:00:00.000Z",
  "services": {
    "application": {
      "status": "up",
      "version": "0.1.0",
      "environment": "production"
    },
    "database": {
      "status": "connected",
      "responseTime": 45
    }
  },
  "uptime": 123456
}
```

**Réponse si DB inaccessible (503)** :
```json
{
  "status": "unhealthy",
  "services": {
    "database": {
      "status": "error",
      "error": "Connection timeout"
    }
  }
}
```

---

### 2. Setup Status

**Vérifier si la DB est initialisée**

```bash
# GET /api/setup
curl https://votre-domaine.vercel.app/api/setup
```

**Réponse si DB initialisée (200)** :
```json
{
  "status": "connected",
  "ready": true,
  "details": {
    "databaseConnected": true,
    "tablesExist": true,
    "userCount": 5
  },
  "timestamp": "2025-11-09T19:00:00.000Z"
}
```

**Réponse si DB non initialisée (503)** :
```json
{
  "status": "connected",
  "ready": false,
  "details": {
    "databaseConnected": true,
    "tablesExist": false,
    "error": "Tables do not exist"
  },
  "timestamp": "2025-11-09T19:00:00.000Z"
}
```

---

### 3. Initialisation Manuelle

**Initialiser la DB manuellement après déploiement**

```bash
# POST /api/setup
# Nécessite le SETUP_TOKEN (ou NEXTAUTH_SECRET en fallback)

curl -X POST \
  -H "Authorization: Bearer VOTRE_SETUP_TOKEN" \
  https://votre-domaine.vercel.app/api/setup
```

**Réponse si succès (200)** :
```json
{
  "success": true,
  "message": "Database initialized successfully",
  "details": {
    "migrations": true,
    "seed": true,
    "userCount": 5
  },
  "timestamp": "2025-11-09T19:00:00.000Z"
}
```

**Réponse si déjà initialisée (200)** :
```json
{
  "success": true,
  "message": "Database already initialized",
  "details": {
    "userCount": 5
  },
  "timestamp": "2025-11-09T19:00:00.000Z"
}
```

**Réponse si non autorisé (401)** :
```json
{
  "error": "Unauthorized",
  "message": "Valid setup token required"
}
```

---

## Dépannage

### Problème : DATABASE_URL non défini

**Symptôme** :
```
✗ DATABASE_URL n'est pas défini
```

**Solution** :
1. Créer fichier `.env` à la racine du projet :
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/ibticar_ai"
   ```

2. Ou définir la variable d'environnement :
   ```bash
   export DATABASE_URL="postgresql://..."
   ```

---

### Problème : Migrations échouent

**Symptôme** :
```
✗ Application des migrations - Échec
```

**Solution 1 : Vérifier la connexion DB**
```bash
# Tester la connexion PostgreSQL
psql $DATABASE_URL -c "SELECT 1"
```

**Solution 2 : Réinitialiser les migrations**
```bash
# Supprimer le dossier migrations
rm -rf prisma/migrations

# Créer une nouvelle migration initiale
npx prisma migrate dev --name init
```

**Solution 3 : Utiliser db push**
```bash
# Crée les tables sans système de migrations
npx prisma db push --accept-data-loss
```

---

### Problème : Seed échoue

**Symptôme** :
```
⚠ Seed de la base de données - Échec
```

**Solution 1 : Vérifier le script de seed**
```bash
# Tester le seed manuellement
npm run db:seed
```

**Solution 2 : Voir les erreurs détaillées**
```bash
# Exécuter directement
npx tsx prisma/seed.ts
```

**Solution 3 : Seed via endpoint API**
```bash
# Utiliser l'endpoint POST /api/setup
curl -X POST \
  -H "Authorization: Bearer $SETUP_TOKEN" \
  https://votre-domaine.vercel.app/api/setup
```

---

### Problème : Tables n'existent pas sur Vercel

**Symptôme** :
```json
{
  "error": "relation \"User\" does not exist"
}
```

**Solution 1 : Vérifier DATABASE_URL dans Vercel**
1. Aller sur Vercel Dashboard
2. Project → Settings → Environment Variables
3. Vérifier que `DATABASE_URL` est défini pour **tous les environnements** :
   - Production
   - Preview
   - Development

**Solution 2 : Redéployer avec nouveau build**
```bash
# Déclencher un nouveau déploiement
git commit --allow-empty -m "redeploy: trigger build"
git push
```

**Solution 3 : Initialiser manuellement via API**
```bash
# Une fois déployé, initialiser la DB :
curl -X POST \
  -H "Authorization: Bearer $NEXTAUTH_SECRET" \
  https://votre-domaine.vercel.app/api/setup
```

---

### Problème : Prisma Client non généré

**Symptôme** :
```
Error: @prisma/client did not initialize yet
```

**Solution** :
```bash
# Régénérer le client
npx prisma generate

# Ou via script
npm run db:generate
```

---

## Workflow Recommandé

### Pour le Développement Local

```bash
# 1. Cloner le projet
git clone <repo>
cd ibticar-ai-mvp

# 2. Installer les dépendances
npm install

# 3. Configurer .env
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Démarrer (init auto de la DB)
npm run dev
```

### Pour un Nouveau Déploiement Vercel

```bash
# 1. Créer la base de données PostgreSQL
# (Neon, Supabase, Railway, ou autre)

# 2. Configurer Vercel
# Dashboard → Settings → Environment Variables
# Ajouter DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Déployer
git push

# 4. Vérifier l'état
curl https://votre-domaine.vercel.app/api/health

# 5. Si nécessaire, initialiser manuellement
curl -X POST \
  -H "Authorization: Bearer $NEXTAUTH_SECRET" \
  https://votre-domaine.vercel.app/api/setup
```

---

## Scripts Disponibles

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Démarrage avec init auto DB | Développement |
| `npm run dev:unsafe` | Démarrage sans vérif DB | Développement rapide |
| `npm run build` | Build avec init DB | Vercel / Production |
| `npm run build:local` | Build sans init DB | Local |
| `npm run db:check` | Vérifier et init DB | Manuel |
| `npm run db:generate` | Générer Prisma Client | Manuel |
| `npm run db:migrate` | Migrations (dev) | Développement |
| `npm run db:migrate:deploy` | Migrations (prod) | Production |
| `npm run db:deploy` | Migrations + seed | Production |
| `npm run db:seed` | Seed la DB | Manuel |

---

## Sécurité

### Endpoint POST /api/setup

Cet endpoint nécessite un token d'authentification pour éviter les accès non autorisés.

**Variables d'environnement (par ordre de priorité)** :
1. `SETUP_TOKEN` - Token dédié pour l'initialisation
2. `NEXTAUTH_SECRET` - Utilisé en fallback

**Exemple d'appel sécurisé** :
```bash
curl -X POST \
  -H "Authorization: Bearer $(echo $NEXTAUTH_SECRET)" \
  https://votre-domaine.vercel.app/api/setup
```

### Endpoint GET /api/health

**Accessible publiquement** pour les load balancers et monitoring.

Ne retourne **aucune information sensible** :
- Pas de DATABASE_URL
- Pas de credentials
- Uniquement l'état de santé

---

## Monitoring

### Uptime Monitoring

Configurez un service de monitoring (UptimeRobot, Pingdom, etc.) pour vérifier :

```bash
GET https://votre-domaine.vercel.app/api/health
```

**Alertes si** :
- Status code ≠ 200
- Response time > 2000ms
- `status` ≠ "healthy"

### Logs Vercel

Pour voir les logs d'initialisation :

```bash
# Via CLI
vercel logs

# Ou Dashboard
https://vercel.com/<user>/<project>/deployments
→ Cliquer sur un déploiement
→ "View Function Logs"
```

---

## Ressources

- [Documentation Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Dernière mise à jour** : 2025-11-09
**Version** : 1.0.0
