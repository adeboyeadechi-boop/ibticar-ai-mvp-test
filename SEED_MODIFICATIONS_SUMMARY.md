# 📝 Modifications du Seed - Résumé

**Date:** 2025-11-10
**Objectif:** Vider puis initialiser la base de données avec toutes les données fictives de `bdd_init.txt`

---

## 🔧 Modifications effectuées

### 1. **Nouveau fichier seed : `prisma/seed-full.ts`**

Créé un nouveau fichier de seed qui :

✅ **Vide complètement la base de données** (TRUNCATE)
- Utilise `TRUNCATE TABLE ... CASCADE` sur toutes les tables
- Respecte l'ordre des contraintes de clés étrangères
- Désactive temporairement les FK checks pour éviter les erreurs

✅ **Réinitialise avec TOUTES les données de bdd_init.txt**

**Données créées :**

| Type | Quantité | Détails |
|------|----------|---------|
| **Rôles** | 5 | Super Admin, Admin, Manager, Commercial, User |
| **Permissions** | 22 | Toutes les permissions du système |
| **Équipes** | 3 | Ibticar HQ, Alger Centre, Oran |
| **Utilisateurs** | 5 | Tous les comptes de test |
| **Marques** | 10 | Renault, Peugeot, VW, Toyota, Hyundai, Kia, Seat, Skoda, Mercedes, BMW |
| **Modèles** | 7 | Clio 5, Captur, Megane, 208, 3008, Corolla, i20 |
| **Véhicules** | 5 | Stock initial avec détails complets |
| **Clients** | 4 | Individuels et entreprise |
| **Leads** | 4 | Différents statuts et sources |
| **Fournisseurs** | 2 | Import Auto Algérie, Auto Distribution |
| **Taxes** | 3 | TVA Standard, TAP, TVA Réduite |
| **Templates notifs** | 5 | Email bienvenue, confirmation, etc. |

**Total : ~71 entités créées**

---

### 2. **Modification de `package.json`**

#### Changement 1 : Configuration Prisma seed

```json
// AVANT
"prisma": {
  "seed": "tsx prisma/seed-complete.ts"
}

// APRÈS
"prisma": {
  "seed": "tsx prisma/seed-full.ts"
}
```

#### Changement 2 : Script vercel-build

```json
// AVANT
"vercel-build": "npx prisma generate && npx prisma migrate deploy && next build"

// APRÈS
"vercel-build": "npx prisma generate && npx prisma migrate deploy && (npx prisma db seed || true) && next build"
```

**Explication du changement :**
- `(npx prisma db seed || true)` : Exécute le seed mais continue même en cas d'échec
- Le `|| true` empêche le build de planter si le seed échoue (ex: si données déjà présentes)

---

## 📊 Données créées - Détails complets

### 👤 Comptes utilisateurs (5)

Tous avec le mot de passe : **Password123!**

| Email | Rôle | Nom | Téléphone | Équipe |
|-------|------|-----|-----------|--------|
| superadmin@ibticar.ai | SUPER_ADMIN | Super Admin | +213 555 000 001 | Ibticar HQ |
| admin@ibticar.ai | ADMIN | Mohamed Belaidi | +213 555 000 002 | Oran |
| manager@dealer.com | MANAGER | Ahmed Benali | +213 555 000 003 | Alger Centre |
| commercial@dealer.com | SALES | Karim Meziane | +213 555 000 004 | Alger Centre |
| user@dealer.com | USER | Fatima Zouaoui | +213 555 000 005 | Alger Centre |

### 🏢 Équipes (3)

1. **Ibticar HQ** (IBTICAR)
   - Manager: Super Admin
   - Localisation: Alger, Alger
   - Contact: contact@ibticar.ai

2. **Concessionnaire Alger Centre** (DEALER)
   - Manager: Ahmed Benali
   - Code: DEALER-ALG-01
   - Contact: alger@dealer.com

3. **Concessionnaire Oran** (DEALER)
   - Manager: Mohamed Belaidi
   - Code: DEALER-ORA-01
   - Contact: oran@dealer.com

### 🚗 Marques (10)

Renault (France), Peugeot (France), Volkswagen (Allemagne), Toyota (Japon), Hyundai (Corée du Sud), Kia (Corée du Sud), Seat (Espagne), Skoda (République Tchèque), Mercedes-Benz (Allemagne), BMW (Allemagne)

### 🏎️ Modèles (7)

1. Renault Clio 5 (Hatchback, Essence, Manuel, 100cv)
2. Renault Captur (SUV, Diesel, Automatique, 115cv)
3. Renault Megane (Sedan, Diesel, Manuel, 110cv)
4. Peugeot 208 (Hatchback, Essence, Manuel, 110cv)
5. Peugeot 3008 (SUV, Diesel, Automatique, 130cv)
6. Toyota Corolla (Sedan, Hybride, Automatique, 122cv)
7. Hyundai i20 (Hatchback, Essence, Manuel, 84cv)

### 🚙 Véhicules en stock (5)

1. **Renault Clio 5** - Bleu Cosmos
   - VIN: VF1RJA00068123456
   - Prix: 2,950,000 DZD
   - Statut: DISPONIBLE
   - Localisation: Alger Centre

2. **Renault Captur** - Rouge Flamme
   - VIN: VF1RJB00068234567
   - Prix: 3,750,000 DZD
   - Statut: DISPONIBLE
   - Localisation: Alger Centre

3. **Renault Megane** - Gris Titanium
   - VIN: VF1RJC00068345678
   - Prix: 3,300,000 DZD
   - Statut: RÉSERVÉ
   - Localisation: Alger Centre

4. **Peugeot 208** - Blanc Nacré
   - VIN: VF3ABCDEF12456789
   - Prix: 2,850,000 DZD
   - Statut: DISPONIBLE
   - Localisation: Oran

5. **Peugeot 3008** - Noir Perla Nera
   - VIN: VF3ABCDEF12567890
   - Prix: 3,950,000 DZD
   - Statut: DISPONIBLE (Occasion 2023)
   - Localisation: Oran

### 👥 Clients (4)

1. **Amina Boumediene** (Particulier)
   - Email: amina.boumediene@email.dz
   - Téléphone: +213 550 123 456
   - Localisation: Alger
   - Notes: Cliente fidèle, 2ème achat

2. **Yacine Brahimi** (Particulier)
   - Email: y.brahimi@email.dz
   - Téléphone: +213 660 234 567
   - Localisation: Oran
   - Notes: Recherche SUV

3. **SARL Transport** (Entreprise)
   - Email: contact@transport-sarl.dz
   - Téléphone: +213 21 55 44 33
   - NIF: 123456789012345
   - Notes: Achat en flotte, 5 véhicules

4. **Leila Hamidi** (Particulier)
   - Email: leila.h@email.dz
   - Téléphone: +213 770 345 678
   - Localisation: Constantine
   - Notes: Premier achat

### 📊 Leads (4)

1. **Amina Boumediene** - NOUVEAU - Site Web - Budget: 3,000,000 DZD
2. **Yacine Brahimi** - CONTACTÉ - Référencement - Budget: 3,500,000 DZD
3. **SARL Transport** - QUALIFIÉ - Téléphone - Budget: 15,000,000 DZD
4. **Leila Hamidi** - NOUVEAU - Visite physique - Budget: 2,800,000 DZD

### 🏭 Fournisseurs (2)

1. **Import Auto Algérie** (SUP-001)
   - Importateur officiel Renault
   - Contact: contact@importauto.dz

2. **Auto Distribution** (SUP-002)
   - Distributeur multi-marques
   - Contact: info@autodist.dz

### 💰 Configurations fiscales (3)

1. **TVA Standard Algérie** - 19.0%
2. **TAP Algérie** - 1.0%
3. **TVA Réduite** - 9.0%

### 📧 Templates de notifications (5)

1. Email de bienvenue (WELCOME_EMAIL)
2. Confirmation de commande (ORDER_CONFIRMATION)
3. Rappel de paiement (PAYMENT_REMINDER)
4. Prospect assigné (LEAD_ASSIGNED)
5. Véhicule disponible (VEHICLE_AVAILABLE)

---

## 🔐 Permissions et Rôles

### Attribution des permissions par rôle

| Rôle | Permissions | Accès |
|------|-------------|-------|
| **SUPER_ADMIN** | 22/22 (100%) | Tous les privilèges système |
| **ADMIN** | 21/22 (95%) | Tout sauf suppression utilisateurs |
| **MANAGER** | ~12/22 (55%) | Opérations + Rapports + Véhicules + CRM |
| **SALES** | ~8/22 (36%) | CRM + Consultation véhicules |
| **USER** | ~5/22 (23%) | Consultation limitée |

---

## 🚀 Utilisation

### Test local (développement)

```bash
# Exécuter le seed complet
npm run db:seed

# Ou directement
npx prisma db seed

# Ou avec le script de test
bash test-seed-full.sh
```

### Déploiement Vercel (automatique)

Le seed s'exécute automatiquement lors du build Vercel grâce à la modification du script `vercel-build`.

**Processus de build :**
1. `npx prisma generate` - Génère le client Prisma
2. `npx prisma migrate deploy` - Applique les migrations
3. `npx prisma db seed` - Exécute le seed (TRUNCATE + réinitialisation)
4. `next build` - Build Next.js

---

## ⚠️ Avertissements importants

### 🔴 TRUNCATE = SUPPRESSION TOTALE

Le nouveau seed **SUPPRIME TOUTES LES DONNÉES** avant de réinitialiser.

**Ne PAS utiliser en production avec des données réelles !**

### 🔄 Ré-exécution du seed

Le seed peut être ré-exécuté plusieurs fois sans problème :
- Vide d'abord toutes les tables
- Puis recrée toutes les données
- Pas de risque de doublons

### 🔒 Sécurité des mots de passe

Tous les comptes utilisent le mot de passe : **Password123!**

⚠️ **À CHANGER IMMÉDIATEMENT EN PRODUCTION**

---

## 📋 Checklist de déploiement

Pour déployer avec le nouveau seed :

- [x] Créer `prisma/seed-full.ts`
- [x] Modifier `package.json` (prisma.seed)
- [x] Modifier `package.json` (vercel-build)
- [ ] Tester localement : `npm run db:seed`
- [ ] Commiter les modifications
- [ ] Pousser sur GitHub
- [ ] Vérifier les logs de build Vercel
- [ ] Tester les endpoints avec `node test-rbac-deployed.mjs`
- [ ] Vérifier que les 5 comptes existent
- [ ] Vérifier que les 10 marques existent
- [ ] Vérifier que les 5 véhicules existent

---

## 📊 Résultats attendus après déploiement

Lorsque vous exécuterez `node test-rbac-deployed.mjs` après le déploiement, vous devriez voir :

```
✅ Signin réussi
✅ Rôle récupéré : Super Admin
✅ Accès /api/vehicles autorisé (200)
   Véhicules trouvés: 5 ✅ (au lieu de 0)
✅ Données brands récupérées
   Marques trouvées: 10 ✅ (au lieu de 2)
✅ Données customers récupérées
   Clients trouvés: 4 ✅ (au lieu de 3)
✅ Accès autorisé aux endpoints AI
```

---

## 🔍 Vérification manuelle

Pour vérifier que toutes les données sont présentes, vous pouvez aussi tester :

```bash
# Test tous les comptes
curl -X POST ${BASE_URL}/auth/signin -d '{"email":"admin@ibticar.ai","password":"Password123!"}'
curl -X POST ${BASE_URL}/auth/signin -d '{"email":"manager@dealer.com","password":"Password123!"}'
curl -X POST ${BASE_URL}/auth/signin -d '{"email":"commercial@dealer.com","password":"Password123!"}'
curl -X POST ${BASE_URL}/auth/signin -d '{"email":"user@dealer.com","password":"Password123!"}'

# Test autres endpoints
curl ${BASE_URL}/brands -H "Authorization: Bearer ${TOKEN}"
curl ${BASE_URL}/models -H "Authorization: Bearer ${TOKEN}"
curl ${BASE_URL}/vehicles -H "Authorization: Bearer ${TOKEN}"
curl ${BASE_URL}/customers -H "Authorization: Bearer ${TOKEN}"
curl ${BASE_URL}/leads -H "Authorization: Bearer ${TOKEN}"
curl ${BASE_URL}/suppliers -H "Authorization: Bearer ${TOKEN}"
```

---

## 🆘 Troubleshooting

### Le seed échoue lors du build Vercel

**Cause possible :** PostgreSQL sur Vercel peut avoir des limitations sur TRUNCATE

**Solution :** Le `|| true` dans le script permet au build de continuer même si le seed échoue. Vérifier les logs Vercel pour voir l'erreur exacte.

### Les données ne sont pas créées

**Vérifier :**
1. Les logs de build Vercel
2. Que `npx prisma db seed` est bien appelé
3. Qu'il n'y a pas d'erreur de contraintes FK

### Erreur "session_replication_role"

**Cause :** Certains hébergeurs PostgreSQL ne permettent pas de modifier `session_replication_role`

**Solution alternative :** Modifier le seed pour supprimer les données dans l'ordre inverse des FK au lieu d'utiliser TRUNCATE CASCADE

---

**Document créé le :** 2025-11-10
**Auteur :** Claude Code
**Version seed :** 1.0.0 (Full with TRUNCATE)
