# 🚀 GUIDE DE DÉPLOIEMENT - IBTICAR.AI MVP

**Date:** 2025-01-10
**Version:** v1.1.0

---

## 📋 PRÉ-REQUIS

### Comptes requis:

- ✅ Compte Vercel (https://vercel.com)
- ✅ Base de données PostgreSQL (Vercel Postgres, Supabase, ou Neon)
- ✅ Compte Google Cloud Platform (pour OAuth)
- ✅ Vercel Blob Storage (inclus avec Vercel)

### Optionnels:

- ⚪ Redis (Upstash) - Cache et queues
- ⚪ SendGrid/Resend - Emails
- ⚪ Twilio - SMS
- ⚪ Sentry - Monitoring erreurs

---

## 🔧 ÉTAPE 1: CONFIGURATION GOOGLE OAUTH

### 1.1 Créer le projet Google Cloud:

1. Aller sur https://console.cloud.google.com
2. Créer un nouveau projet: "Ibticar AI MVP"
3. Activer l'API Google+ :
   - Menu APIs & Services → Library
   - Rechercher "Google+ API"
   - Cliquer "Enable"

### 1.2 Configurer OAuth Consent Screen:

1. APIs & Services → OAuth consent screen
2. Choisir "External" (pour utilisateurs hors organisation)
3. Remplir les informations:
   - **App name:** Ibticar.AI
   - **User support email:** votre-email@ibticar.ai
   - **Developer contact:** votre-email@ibticar.ai
4. Ajouter scopes:
   - `userinfo.email`
   - `userinfo.profile`
5. Sauvegarder

### 1.3 Créer les credentials OAuth:

1. APIs & Services → Credentials
2. Create Credentials → OAuth 2.0 Client ID
3. Application type: **Web application**
4. Name: "Ibticar AI Web Client"
5. Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   https://ibticar-ai-mvp.vercel.app/api/auth/callback/google
   https://your-custom-domain.com/api/auth/callback/google
   ```
6. Créer → Copier **Client ID** et **Client Secret**

### 1.4 Tester en local:

```bash
# .env.local
GOOGLE_CLIENT_ID="123456789-abcdefghijk.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 🗄️ ÉTAPE 2: CONFIGURATION BASE DE DONNÉES

### Option A: Vercel Postgres (Recommandé)

1. Dans votre projet Vercel:
   - Storage tab → Create Database
   - Choose: Postgres
   - Copier `DATABASE_URL` automatiquement injecté

### Option B: Supabase

1. Créer projet sur https://supabase.com
2. Database → Connection pooling
3. Mode: Transaction
4. Copier connection string:
   ```
   postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true
   ```

### Option C: Neon

1. Créer projet sur https://neon.tech
2. Copier connection string avec pooling activé

### 2.1 Appliquer les migrations:

```bash
# En local d'abord
export DATABASE_URL="postgresql://..."
npx prisma migrate dev

# Puis en production (via Vercel CLI ou dashboard)
npx prisma migrate deploy
npx prisma generate
```

---

## 📦 ÉTAPE 3: CONFIGURATION VERCEL

### 3.1 Créer le projet Vercel:

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
vercel
```

**Ou via Dashboard:**
1. New Project → Import Git Repository
2. Sélectionner votre repo GitHub/GitLab
3. Framework Preset: Next.js
4. Root Directory: `./`
5. Build Command: `npm run build`
6. Output Directory: `.next`

### 3.2 Configurer les variables d'environnement:

**Dans Vercel Dashboard → Settings → Environment Variables:**

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<générer avec: openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# JWT Custom Auth
JWT_SECRET=<générer avec: openssl rand -base64 32>

# Vercel Blob (auto-configuré)
BLOB_READ_WRITE_TOKEN=<généré automatiquement par Vercel>

# Optionnel: AI
GEMINI_API_KEY=<votre clé Gemini>
```

**Environnements:**
- ✅ Production
- ✅ Preview
- ✅ Development (optionnel)

### 3.3 Activer Vercel Blob Storage:

1. Storage tab → Create Store
2. Type: **Blob**
3. Name: `ibticar-media`
4. Region: Choisir le plus proche (Europe ou US)
5. Token créé automatiquement dans `BLOB_READ_WRITE_TOKEN`

---

## 🔐 ÉTAPE 4: GÉNÉRER LES SECRETS

### 4.1 NEXTAUTH_SECRET:

```bash
openssl rand -base64 32
# Output: dXR0Ck2FHVGjK8YtL9qZ3pWnN5mB7cA1=
```

### 4.2 JWT_SECRET:

```bash
openssl rand -base64 32
# Output: Xz9Kp3Lm6Nn5Bb8Vv2Cc4Ff1Gg7Hh0Jj=
```

### 4.3 Ajouter dans Vercel:

```bash
# Via CLI
vercel env add NEXTAUTH_SECRET
vercel env add JWT_SECRET

# Ou via Dashboard
```

---

## 🚀 ÉTAPE 5: DÉPLOIEMENT

### 5.1 Premier déploiement:

```bash
# Push sur main/master déclenche auto-deploy
git add .
git commit -m "feat: add media upload, energy labeling, export, OAuth"
git push origin main

# Ou manuel
vercel --prod
```

### 5.2 Vérifier le déploiement:

1. Ouvrir l'URL Vercel fournie
2. Tester endpoints:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

### 5.3 Appliquer les migrations Prisma:

**Via Vercel CLI:**
```bash
vercel env pull .env.production
export $(cat .env.production | xargs)
npx prisma migrate deploy
```

**Ou via build command dans vercel.json:**
```json
{
  "buildCommand": "npm run build && npx prisma migrate deploy"
}
```

---

## 🧪 ÉTAPE 6: TESTS POST-DÉPLOIEMENT

### 6.1 Test authentification:

```bash
# Test Google OAuth
# Ouvrir: https://your-app.vercel.app/api/auth/signin
# Cliquer "Sign in with Google"
# Vérifier redirection et création user

# Test JWT signin
curl -X POST https://your-app.vercel.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@ibticar.ai",
    "password": "Password123!"
  }'
```

### 6.2 Test upload média:

```bash
# Obtenir token
TOKEN="eyJhbGc..."

# Upload photo
curl -X POST https://your-app.vercel.app/api/vehicles/VEHICLE_ID/media \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@photo.jpg" \
  -F "type=PHOTO" \
  -F "captions=Photo avant"
```

### 6.3 Test export inventaire:

```bash
curl -X GET "https://your-app.vercel.app/api/vehicles/export?format=xlsx" \
  -H "Authorization: Bearer $TOKEN" \
  --output inventaire.xlsx
```

### 6.4 Test calculateur énergétique:

```typescript
// Dans votre code frontend
import { calculateEnergyClass } from '@/lib/energy-label-calculator'

const energyClass = calculateEnergyClass({
  co2Emissions: 120,
  fuelType: 'GASOLINE'
})
// Attendu: 'A'
```

---

## 📊 ÉTAPE 7: MONITORING

### 7.1 Vercel Analytics:

- Activer dans Settings → Analytics
- Gratuit jusqu'à 100k requests/mois

### 7.2 Logs:

```bash
# Temps réel
vercel logs --follow

# Par fonction
vercel logs --function=api/vehicles
```

### 7.3 Optionnel - Sentry:

```bash
npm install @sentry/nextjs

# Configurer dans next.config.js
npx @sentry/wizard@latest -i nextjs
```

---

## 🔄 ÉTAPE 8: INITIALISER LA BASE DE DONNÉES

### 8.1 Seed avec données de test:

```bash
# Créer fichier prisma/seed-production.ts
npm run prisma:seed

# Ou manuellement via Prisma Studio
npx prisma studio
```

### 8.2 Créer le compte superadmin:

```typescript
// Script one-time
import bcrypt from 'bcrypt'
import prisma from './src/prisma/client'

const passwordHash = await bcrypt.hash('VotreMotDePasseSecure!', 10)

await prisma.user.create({
  data: {
    email: 'admin@ibticar.ai',
    firstName: 'Admin',
    lastName: 'Ibticar',
    passwordHash,
    role: 'SUPER_ADMIN',
    isActive: true,
    emailVerifiedAt: new Date()
  }
})
```

---

## ⚠️ TROUBLESHOOTING

### Problème: "Prisma Client not initialized"

**Solution:**
```bash
vercel env pull
npx prisma generate
git add -f src/generated/prisma
git commit -m "chore: add generated prisma client"
git push
```

### Problème: "Google OAuth redirect mismatch"

**Solution:**
1. Vérifier les redirect URIs dans Google Cloud Console
2. Ajouter TOUS les domaines (localhost, vercel preview, prod)
3. Format exact: `https://domain.com/api/auth/callback/google`

### Problème: "Blob upload timeout"

**Solution:**
1. Augmenter timeout Vercel (max 60s hobby, 300s pro)
2. Ou compresser images côté client avant upload
3. Ou utiliser upload progressif en chunks

### Problème: "Database connection pool exhausted"

**Solution:**
```typescript
// Ajuster dans prisma/client.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10'
    }
  }
})
```

---

## 📝 CHECKLIST DÉPLOIEMENT FINAL

### Avant Production:

- [ ] Variables env configurées Vercel
- [ ] Google OAuth credentials créés
- [ ] Database migrations appliquées
- [ ] Vercel Blob Storage activé
- [ ] Compte superadmin créé
- [ ] Tests E2E passants
- [ ] Monitoring activé
- [ ] SSL certificat vérifié (auto Vercel)
- [ ] CORS policy définie
- [ ] Rate limiting configuré (optionnel)

### Après Production:

- [ ] Tester Google signin en prod
- [ ] Uploader photo test véhicule
- [ ] Télécharger export inventaire
- [ ] Vérifier étiquetage énergétique
- [ ] Check logs Vercel
- [ ] Backup database configuré
- [ ] Documentation API partagée équipe

---

## 🔗 RESSOURCES UTILES

- **Vercel Docs:** https://vercel.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **NextAuth Docs:** https://next-auth.js.org
- **Vercel Blob:** https://vercel.com/docs/storage/vercel-blob
- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2

---

## 📞 SUPPORT

En cas de problème:

1. **Logs Vercel:** Dashboard → Logs tab
2. **Prisma Studio:** `npx prisma studio` pour inspecter DB
3. **GitHub Issues:** Créer issue avec logs d'erreur
4. **Discord communauté:** Next.js, Prisma

---

**Document maintenu par:** Équipe Tech Ibticar.AI
**Dernière mise à jour:** 2025-01-10
**Version backend:** v1.1.0
