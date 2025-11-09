# Configuration Automatique de la Base de Données

Ce document explique le système de vérification et d'initialisation automatique de la base de données mis en place dans le projet Ibticar.AI MVP.

## Vue d'ensemble

Le projet inclut maintenant un système qui vérifie et initialise automatiquement la base de données PostgreSQL au démarrage de l'application. Cela garantit que :

- La base de données est accessible
- Le client Prisma est généré
- Les migrations sont à jour
- L'application peut démarrer sans erreurs de configuration

## Scripts disponibles

### Commandes de démarrage

```bash
# Démarrage en développement avec vérification automatique de la BDD
npm run dev

# Démarrage en production avec vérification automatique de la BDD
npm start

# Démarrage SANS vérification (plus rapide, pour les développeurs expérimentés)
npm run dev:unsafe
npm run start:unsafe
```

### Commandes de gestion de base de données

```bash
# Vérifier et initialiser manuellement la base de données
npm run db:check

# Créer et appliquer une nouvelle migration (développement)
npm run db:migrate

# Appliquer les migrations en attente (production)
npm run db:migrate:deploy

# Générer le client Prisma
npm run db:generate

# Ouvrir Prisma Studio (interface graphique pour la BDD)
npm run db:studio

# Remplir la base de données avec des données initiales
npm run db:seed
```

## Comment ça fonctionne ?

### Au démarrage (`npm run dev` ou `npm start`)

Lorsque vous exécutez `npm run dev` ou `npm start`, le processus suivant se déroule automatiquement :

1. **Chargement des variables d'environnement**
   - Le script charge automatiquement les variables depuis `.env`
   - Vérifie que `DATABASE_URL` est défini

2. **Vérification du Client Prisma**
   - Vérifie si le client Prisma existe dans `src/generated/prisma/`
   - Si absent, génère automatiquement le client avec `prisma generate`

3. **Test de connexion**
   - Tente de se connecter à la base de données PostgreSQL
   - Affiche une erreur claire si la connexion échoue

4. **Vérification des migrations**
   - Vérifie si des migrations sont en attente
   - En développement : applique les migrations avec `prisma migrate dev`
   - En production : applique les migrations avec `prisma migrate deploy`

5. **Démarrage de l'application**
   - Si toutes les vérifications passent, démarre le serveur Next.js
   - Sinon, affiche une erreur et arrête le processus

### Vérification manuelle (`npm run db:check`)

Vous pouvez exécuter manuellement le script de vérification pour diagnostiquer des problèmes :

```bash
npm run db:check
```

Ce script effectue toutes les vérifications sans démarrer le serveur Next.js.

## Structure des scripts

```
scripts/
├── init-db.mjs                 # Script de vérification et initialisation de la BDD
└── start-with-db-check.mjs     # Wrapper de démarrage avec vérification
```

### `init-db.mjs`

Script principal qui :
- Charge les variables d'environnement depuis `.env`
- Vérifie la configuration de la base de données
- Génère le client Prisma si nécessaire
- Applique les migrations en attente
- Retourne un code de sortie 0 si succès, 1 si échec

### `start-with-db-check.mjs`

Wrapper qui :
- Exécute `init-db.mjs` pour vérifier la BDD
- Si succès : démarre le serveur Next.js
- Si échec : affiche l'erreur et arrête le processus

## Configuration requise

### Variables d'environnement (.env)

```env
# Obligatoire
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# Optionnel pour NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Optionnel pour l'IA
ANTHROPIC_API_KEY=your-api-key-here
AI_PROVIDER=claude
AI_MODEL=claude-3-5-sonnet-20241022
```

### Prérequis

- **PostgreSQL en cours d'exécution**
  - Local : Docker Compose ou installation native
  - Production : Service géré (Vercel Postgres, Supabase, etc.)

- **Node.js 20+** installé

- **Fichier `.env`** configuré avec `DATABASE_URL`

## Gestion des erreurs

### Erreur : "DATABASE_URL n'est pas défini"

**Cause** : Le fichier `.env` n'existe pas ou ne contient pas `DATABASE_URL`

**Solution** :
1. Créez un fichier `.env` à la racine du projet
2. Ajoutez `DATABASE_URL="postgresql://..."`

### Erreur : "Impossible de se connecter à la base de données"

**Cause** : PostgreSQL n'est pas démarré ou inaccessible

**Solutions** :

Pour Docker :
```bash
docker-compose up -d
```

Pour vérifier que PostgreSQL écoute :
```bash
# Windows
netstat -an | findstr :5432

# Linux/Mac
lsof -i :5432
```

### Erreur : "Client Prisma non trouvé"

**Cause** : Le client Prisma n'a pas été généré

**Solution** : Le script le génère automatiquement, mais vous pouvez forcer la génération :
```bash
npm run db:generate
```

### Erreur : "Des migrations sont en attente"

**Cause** : Le schéma Prisma a été modifié mais les migrations n'ont pas été appliquées

**Solution** : Le script applique automatiquement les migrations, mais vous pouvez les appliquer manuellement :

En développement :
```bash
npm run db:migrate
```

En production :
```bash
npm run db:migrate:deploy
```

## Déploiement sur Vercel

### Configuration automatique

Lors du déploiement sur Vercel, le processus de build inclut automatiquement la génération du client Prisma :

```json
{
  "scripts": {
    "build": "npx prisma generate && next build"
  }
}
```

### Variables d'environnement Vercel

Dans les paramètres de votre projet Vercel, configurez :

1. **DATABASE_URL** : URL de votre base de données externe (Vercel Postgres, Supabase, etc.)
   - Exemple : `postgresql://user:password@host.region.provider.com:5432/db?sslmode=require`

2. **NEXTAUTH_SECRET** : Secret pour JWT (généré avec `openssl rand -base64 32`)

3. **NEXTAUTH_URL** : URL de votre application (automatique sur Vercel, mais peut être surchargé)

4. **ANTHROPIC_API_KEY** : Clé API pour les fonctionnalités IA

### Migration lors du déploiement

Les migrations sont appliquées automatiquement lors du premier démarrage du conteneur grâce au script `start-with-db-check.mjs`.

Pour forcer l'application des migrations en production :

```bash
# Localement (avec DATABASE_URL pointant vers la prod)
npm run db:migrate:deploy
```

## Désactivation de la vérification automatique

Si vous souhaitez désactiver la vérification automatique (par exemple, pour des tests ou un débogage) :

```bash
# Utiliser les commandes "unsafe"
npm run dev:unsafe
npm run start:unsafe
```

**Attention** : Cela suppose que votre base de données est déjà correctement configurée.

## Avantages de ce système

✅ **Expérience développeur améliorée** : Plus besoin de se souvenir de lancer les migrations

✅ **Prévention d'erreurs** : Détecte les problèmes de configuration avant le démarrage

✅ **Onboarding simplifié** : Les nouveaux développeurs peuvent démarrer immédiatement

✅ **Production sécurisée** : Garantit que les migrations sont appliquées avant le démarrage

✅ **Messages d'erreur clairs** : Diagnostics détaillés en cas de problème

## Résumé des fichiers modifiés

### Nouveaux fichiers
- `scripts/init-db.mjs` : Script de vérification de la BDD
- `scripts/start-with-db-check.mjs` : Wrapper de démarrage
- `DATABASE_SETUP.md` : Cette documentation

### Fichiers modifiés
- `package.json` : Nouveaux scripts npm
- `CLAUDE.md` : Documentation mise à jour
- `.env` : Variables d'environnement complétées

## Support et dépannage

Si vous rencontrez des problèmes :

1. **Vérifiez les logs** : Le script affiche des messages détaillés
2. **Testez manuellement** : `npm run db:check`
3. **Vérifiez PostgreSQL** : Assurez-vous qu'il est démarré
4. **Vérifiez .env** : Assurez-vous que DATABASE_URL est correct
5. **Régénérez le client** : `npm run db:generate`

Pour plus d'aide, consultez la [documentation Prisma](https://www.prisma.io/docs) ou la [documentation Next.js](https://nextjs.org/docs).
