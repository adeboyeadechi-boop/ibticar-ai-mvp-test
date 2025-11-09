# 🚀 Guide de Déploiement Vercel - Ibticar.AI Backend

Ce guide vous explique comment déployer correctement le backend Ibticar.AI sur Vercel.

---

## 📋 Prérequis

- [ ] Compte Vercel (https://vercel.com)
- [ ] Code source sur GitHub/GitLab/Bitbucket
- [ ] Accès à une base de données PostgreSQL externe

---

## 🎯 Étapes de Déploiement

### Étape 1: Préparer la Base de Données

Vous avez plusieurs options pour la base de données :

#### Option A: Vercel Postgres (Recommandé) ⭐

**Avantages:** Intégration native, configuration automatique
**Prix:** 5$ USD/mois (plan Hobby)

1. Dashboard Vercel → **Storage** → **Create Database**
2. Sélectionner **Postgres**
3. Nommer la base: `ibticar-ai-db`
4. Cliquer sur **Create**
5. ✅ `DATABASE_URL` est automatiquement ajouté aux variables d'environnement

#### Option B: Supabase (Gratuit)

1. Créer un compte sur https://supabase.com
2. **New Project** → Nommer `ibticar-ai`
3. Choisir une région proche (ex: Frankfurt, Germany)
4. Copier la **Connection String** dans **Settings → Database**
5. Format: `postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`

#### Option C: Neon (Gratuit)

1. Créer un compte sur https://neon.tech
2. **Create Project** → Nommer `ibticar-ai`
3. Choisir une région
4. Copier la **Connection String**
5. Format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`

---

### Étape 2: Déployer sur Vercel

#### 2.1 Importer le Projet

1. Dashboard Vercel → **Add New** → **Project**
2. **Import Git Repository** → Sélectionner votre repo `ibticar-ai-mvp`
3. Sélectionner le framework: **Next.js**
4. Root Directory: `.` (racine)
5. **Ne pas déployer encore !** (cliquer sur **Configure Project**)

#### 2.2 Configurer les Variables d'Environnement

Dans **Environment Variables**, ajouter :

```env
# Base de données (OBLIGATOIRE)
DATABASE_URL=postgresql://[copier depuis votre fournisseur]

# NextAuth (OBLIGATOIRE)
NEXTAUTH_URL=https://[votre-projet].vercel.app
NEXTAUTH_SECRET=[générer avec: openssl rand -base64 32]

# AI - Anthropic Claude (Optionnel)
ANTHROPIC_API_KEY=sk-ant-api03-...
AI_PROVIDER=claude
AI_MODEL=claude-3-5-sonnet-20241022
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=4096
```

**Important:**
- Ajouter ces variables pour **Production**, **Preview** et **Development**
- Pour `NEXTAUTH_SECRET`, générer avec:
  ```bash
  openssl rand -base64 32
  ```

#### 2.3 Configurer le Build

Dans **Build & Development Settings**:

**Build Command:**
```bash
prisma generate && next build
```

**Output Directory:**
```
.next
```

**Install Command:**
```bash
npm install
```

#### 2.4 Déployer

1. Cliquer sur **Deploy**
2. Attendre la fin du build (2-5 minutes)
3. ✅ Le site sera accessible à `https://[votre-projet].vercel.app`

---

### Étape 3: Initialiser la Base de Données

Une fois déployé, il faut appliquer les migrations Prisma :

#### 3.1 En Local (Recommandé)

Créer un fichier `.env.production` :

```env
DATABASE_URL="postgresql://[URL depuis Vercel]"
```

Appliquer les migrations :

```bash
# Charger les variables de production
export $(cat .env.production | xargs)

# Appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate
```

#### 3.2 Seed la Base de Données (Optionnel)

Pour créer l'utilisateur admin et les données de test :

```bash
npm run db:seed
```

---

### Étape 4: Vérifier le Déploiement

#### 4.1 Vérifier les Logs de Build

1. Dashboard Vercel → **Deployments** → Dernier déploiement
2. Cliquer sur **Building** → Vérifier qu'il n'y a pas d'erreurs
3. Chercher: `✓ Generating Prisma Client` (doit être présent)

#### 4.2 Tester les Endpoints

**Utiliser le script PowerShell:**
```powershell
.\test-vercel-api.ps1
```

**Ou manuellement:**
```bash
# Test endpoint auth/me (doit retourner 401)
curl https://[votre-projet].vercel.app/api/auth/me

# Test signin
curl -X POST https://[votre-projet].vercel.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ibticar.ai","password":"Password123!"}'
```

**Résultats attendus:**
- `/api/auth/me` → **401** Unauthorized (✅ OK)
- `/api/auth/signin` → **200** avec token (✅ OK)
- Si **404** : Routes API non déployées (❌ problème)
- Si **405** : Méthode non supportée (❌ problème)

---

## 🔧 Dépannage

### Problème 1: Routes API retournent 404

**Causes:**
- Variables d'environnement manquantes
- Build échoué
- Prisma Client non généré

**Solutions:**
1. Vérifier les variables d'environnement (Étape 2.2)
2. Vérifier les logs de build
3. Redéployer avec:
   ```bash
   vercel --prod
   ```

---

### Problème 2: Erreurs Prisma dans les Logs

**Erreur:** `Cannot find module '@prisma/client'`

**Solution:**
Ajouter un script `postinstall` dans `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

Puis redéployer.

---

### Problème 3: Database Connection Errors

**Erreur:** `Can't reach database server`

**Solutions:**
1. Vérifier que `DATABASE_URL` est correct
2. Vérifier que la base de données est accessible publiquement
3. Pour Supabase/Neon, utiliser le **Pooler** (pas le direct connection)
4. Ajouter `?sslmode=require` à la fin de l'URL

---

### Problème 4: NextAuth Errors

**Erreur:** `[next-auth][error][SIGNIN_EMAIL_ERROR]`

**Solutions:**
1. Vérifier `NEXTAUTH_URL` (doit être l'URL Vercel)
2. Vérifier `NEXTAUTH_SECRET` (doit être défini)
3. Vérifier que la base de données contient les tables NextAuth

---

## 📊 Checklist Post-Déploiement

Vérifier que tout fonctionne :

- [ ] ✅ Le site est accessible sur Vercel
- [ ] ✅ Les variables d'environnement sont configurées
- [ ] ✅ Le build se termine sans erreurs
- [ ] ✅ Prisma génère le client (visible dans les logs)
- [ ] ✅ Les migrations sont appliquées
- [ ] ✅ `/api/auth/me` retourne 401 (pas 404)
- [ ] ✅ `/api/auth/signin` accepte les requêtes POST
- [ ] ✅ L'authentification fonctionne
- [ ] ✅ Les utilisateurs de test existent dans la BDD
- [ ] ✅ Les endpoints protégés sont accessibles avec token
- [ ] ✅ CORS est configuré (headers dans next.config.ts)

---

## 🔄 Redéploiement / Mise à Jour

Pour redéployer après des modifications :

### Via Dashboard Vercel

1. Dashboard → **Deployments**
2. Cliquer sur les **trois points** → **Redeploy**
3. Cocher **Use existing Build Cache** pour aller plus vite

### Via Git

1. Faire un commit et push
2. Vercel détecte automatiquement et redéploie

### Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

---

## 📈 Optimisations de Production

### 1. Activer le Caching

Dans `vercel.json` (créer à la racine):
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

### 2. Configurer les Timeouts

Pour les fonctions serverless (Prisma peut être lent) :

Dans `vercel.json`:
```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### 3. Monitoring

Activer les **Analytics** dans Vercel Dashboard pour suivre :
- Temps de réponse
- Erreurs
- Requêtes par seconde

---

## 🚨 Sécurité

### Variables Sensibles

**Ne JAMAIS commiter:**
- `.env`
- `.env.production`
- Fichiers contenant des secrets

**Toujours utiliser:**
- Variables d'environnement Vercel
- Secrets GitHub pour les CI/CD

### CORS

Le backend est configuré avec CORS ouvert (`*`). En production, restreindre :

Dans `next.config.ts`:
```typescript
headers: [
  {
    key: 'Access-Control-Allow-Origin',
    value: 'https://votre-frontend.vercel.app', // Spécifique !
  }
]
```

---

## 📚 Ressources

- [Vercel Documentation](https://vercel.com/docs)
- [Prisma + Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [NextAuth + Vercel](https://next-auth.js.org/deployment)
- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)

---

## 📧 Support

Si vous rencontrez des problèmes :

1. Consulter `VERCEL_TEST_REPORT.md` pour diagnostics
2. Vérifier les logs Vercel
3. Tester localement avec `npm run build`
4. Vérifier la documentation Prisma/NextAuth

---

**Guide créé le:** 2025-01-09
**Prochaine mise à jour:** Après le premier déploiement réussi
