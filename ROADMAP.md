# 🗺️ Roadmap Ibticar.AI MVP

## État Actuel (Phases 1-4 Terminées) ✅

- ✅ **Phase 1:** Infrastructure de base (Next.js, Prisma, Auth)
- ✅ **Phase 2:** Gestion de base (Users, Customers, Leads, Vehicles, Suppliers)
- ✅ **Phase 3:** Sécurité avancée (Refresh Tokens, 2FA, RBAC complet)
- ✅ **Phase 4:** Intelligence Artificielle (Recommandations, Rotation, Pricing)

**Taux de complétion:** ~30% (30/102 endpoints API)

---

## 🎯 Phase 5: Cycle de Vente Complet (PRIORITAIRE)

**Objectif:** Permettre la génération de revenus via le processus complet de vente

**Durée estimée:** 5-7 jours

### User Stories Phase 5

#### 5.1 - Quotes (Devis) 🔥 CRITIQUE
**Priorité:** P0 (Bloquant pour ventes)
```
US-5.1.1: En tant que commercial, je veux créer un devis pour un client
US-5.1.2: En tant que commercial, je veux ajouter des véhicules et services au devis
US-5.1.3: En tant que commercial, je veux appliquer des remises au devis
US-5.1.4: En tant que commercial, je veux convertir un devis approuvé en commande
US-5.1.5: En tant que client, je veux consulter mes devis
```

**Endpoints à créer:**
- POST /api/quotes (créer devis)
- GET /api/quotes (lister)
- GET /api/quotes/[id] (détails)
- PATCH /api/quotes/[id] (modifier)
- DELETE /api/quotes/[id] (supprimer)
- POST /api/quotes/[id]/items (ajouter items)
- DELETE /api/quotes/[id]/items/[itemId] (retirer items)
- POST /api/quotes/[id]/approve (approuver)
- POST /api/quotes/[id]/reject (rejeter)
- POST /api/quotes/[id]/convert (convertir en commande)

**Modèles Prisma existants:**
- ✅ Quote (id, customerId, vehicleId, status, validUntil, etc.)
- ✅ QuoteItem (id, quoteId, description, quantity, unitPrice, etc.)

#### 5.2 - Orders (Commandes) 🔥 CRITIQUE
**Priorité:** P0 (Dépend de Quotes)
```
US-5.2.1: En tant que commercial, je veux créer une commande depuis un devis
US-5.2.2: En tant que commercial, je veux suivre le statut de la commande
US-5.2.3: En tant que manager, je veux valider les commandes
US-5.2.4: En tant que client, je veux consulter mes commandes
```

**Endpoints à créer:**
- POST /api/orders (créer commande)
- GET /api/orders (lister)
- GET /api/orders/[id] (détails)
- PATCH /api/orders/[id] (modifier statut)
- POST /api/orders/[id]/cancel (annuler)
- POST /api/orders/[id]/validate (valider)

**Modèles Prisma existants:**
- ✅ Order (id, customerId, vehicleId, status, totalAmount, etc.)

#### 5.3 - Invoices (Factures) 🔥 CRITIQUE
**Priorité:** P0 (Dépend de Orders)
```
US-5.3.1: En tant que comptable, je veux générer une facture depuis une commande
US-5.3.2: En tant que comptable, je veux gérer les items de facture
US-5.3.3: En tant que comptable, je veux calculer les taxes automatiquement
US-5.3.4: En tant que comptable, je veux exporter les factures en PDF
US-5.3.5: En tant que client, je veux télécharger mes factures
```

**Endpoints à créer:**
- POST /api/invoices (créer facture)
- GET /api/invoices (lister)
- GET /api/invoices/[id] (détails)
- GET /api/invoices/[id]/pdf (télécharger PDF)
- PATCH /api/invoices/[id] (modifier)
- POST /api/invoices/[id]/send (envoyer par email)
- POST /api/invoices/[id]/items (ajouter items)

**Modèles Prisma existants:**
- ✅ Invoice (id, orderId, customerId, status, dueDate, etc.)
- ✅ InvoiceItem (id, invoiceId, description, quantity, etc.)
- ✅ TaxConfiguration (déjà utilisable)

#### 5.4 - Payments (Paiements) 🔥 CRITIQUE
**Priorité:** P0 (Dépend de Invoices)
```
US-5.4.1: En tant que comptable, je veux enregistrer un paiement
US-5.4.2: En tant que comptable, je veux suivre les paiements partiels
US-5.4.3: En tant que client, je veux payer une facture en ligne (Beyn)
US-5.4.4: En tant que comptable, je veux rapprocher les paiements
```

**Endpoints à créer:**
- POST /api/payments (créer paiement)
- GET /api/payments (lister)
- GET /api/payments/[id] (détails)
- POST /api/payments/beyn/initiate (initialiser paiement Beyn)
- POST /api/payments/beyn/webhook (callback Beyn)
- POST /api/payments/[id]/refund (rembourser)

**Modèles Prisma existants:**
- ✅ Payment (id, invoiceId, amount, method, status, etc.)
- ✅ BeynPayment (id, paymentId, transactionId, status, etc.)

**Permissions RBAC à ajouter:**
```typescript
// Phase 5 permissions
{ code: 'quotes:view', name: 'Voir devis', module: 'sales' },
{ code: 'quotes:create', name: 'Créer devis', module: 'sales' },
{ code: 'quotes:update', name: 'Modifier devis', module: 'sales' },
{ code: 'quotes:approve', name: 'Approuver devis', module: 'sales' },
{ code: 'orders:view', name: 'Voir commandes', module: 'sales' },
{ code: 'orders:create', name: 'Créer commandes', module: 'sales' },
{ code: 'orders:validate', name: 'Valider commandes', module: 'sales' },
{ code: 'invoices:view', name: 'Voir factures', module: 'finance' },
{ code: 'invoices:create', name: 'Créer factures', module: 'finance' },
{ code: 'invoices:send', name: 'Envoyer factures', module: 'finance' },
{ code: 'payments:view', name: 'Voir paiements', module: 'finance' },
{ code: 'payments:create', name: 'Créer paiements', module: 'finance' },
{ code: 'payments:refund', name: 'Rembourser paiements', module: 'finance' },
```

---

## 🚀 Phase 6: Expérience Client (HAUTE PRIORITÉ)

**Objectif:** Améliorer l'engagement et la satisfaction client

**Durée estimée:** 4-6 jours

### User Stories Phase 6

#### 6.1 - Appointments (Rendez-vous)
**Priorité:** P1 (Haute valeur business)
```
US-6.1.1: En tant que client, je veux réserver un essai routier
US-6.1.2: En tant que commercial, je veux gérer mon calendrier
US-6.1.3: En tant que client, je veux recevoir des rappels de RDV
US-6.1.4: En tant que commercial, je veux confirmer/annuler un RDV
```

**Endpoints:** CRUD + POST /api/appointments/[id]/confirm|cancel

#### 6.2 - Reviews & Ratings (Avis clients)
**Priorité:** P1 (Confiance + référencement)
```
US-6.2.1: En tant que client, je veux laisser un avis sur un véhicule
US-6.2.2: En tant que client, je veux laisser un avis sur le service
US-6.2.3: En tant que manager, je veux modérer les avis
US-6.2.4: En tant que visiteur, je veux voir les avis vérifiés
```

**Endpoints:** CRUD + POST /api/reviews/[id]/verify|report

#### 6.3 - Favorites & Wishlist (Favoris)
**Priorité:** P1 (Engagement)
```
US-6.3.1: En tant que client, je veux sauvegarder mes véhicules favoris
US-6.3.2: En tant que client, je veux créer des listes d'envies
US-6.3.3: En tant que client, je veux partager ma wishlist
US-6.3.4: En tant que commercial, je veux voir les véhicules populaires
```

**Endpoints:** CRUD pour Wishlist + POST /api/favorites

#### 6.4 - Notifications & Alerts
**Priorité:** P1 (Rétention)
```
US-6.4.1: En tant que client, je veux recevoir des alertes de prix
US-6.4.2: En tant que client, je veux être notifié des nouveaux stocks
US-6.4.3: En tant que client, je veux gérer mes préférences de notification
US-6.4.4: En tant que système, je veux envoyer des notifications multi-canal
```

**Endpoints:** CRUD Alerts + GET/PUT /api/users/me/notification-preferences

---

## 📦 Phase 7: Opérations & Logistique (MOYENNE PRIORITÉ)

**Objectif:** Optimiser les opérations internes

**Durée estimée:** 5-7 jours

### User Stories Phase 7

#### 7.1 - Deliveries (Livraisons)
```
US-7.1.1: En tant que logisticien, je veux planifier une livraison
US-7.1.2: En tant que client, je veux suivre ma livraison
US-7.1.3: En tant que chauffeur, je veux confirmer la livraison
```

#### 7.2 - Returns (Retours)
```
US-7.2.1: En tant que client, je veux initier un retour
US-7.2.2: En tant que manager, je veux approuver/rejeter un retour
US-7.2.3: En tant que comptable, je veux créer un avoir
```

#### 7.3 - After-Sales Service (SAV)
```
US-7.3.1: En tant que client, je veux créer une demande SAV
US-7.3.2: En tant que technicien, je veux suivre les interventions
US-7.3.3: En tant que client, je veux suivre l'état de ma demande
```

#### 7.4 - Warranties (Garanties)
```
US-7.4.1: En tant que commercial, je veux activer une garantie
US-7.4.2: En tant que client, je veux consulter ma garantie
US-7.4.3: En tant que SAV, je veux vérifier la validité d'une garantie
```

---

## 💼 Phase 8: Assurance & Financement (MOYENNE PRIORITÉ)

**Objectif:** Revenus additionnels via partenariats

**Durée estimée:** 6-8 jours

### User Stories Phase 8

#### 8.1 - Insurance Quotes (Devis assurance)
```
US-8.1.1: En tant que client, je veux obtenir un devis d'assurance
US-8.1.2: En tant que commercial, je veux comparer plusieurs assureurs
US-8.1.3: En tant que client, je veux souscrire une assurance
```

#### 8.2 - Insurance Claims (Sinistres)
```
US-8.2.1: En tant que client, je veux déclarer un sinistre
US-8.2.2: En tant qu'assureur, je veux traiter les déclarations
US-8.2.3: En tant que client, je veux suivre mon sinistre
```

#### 8.3 - Financing Simulations
```
US-8.3.1: En tant que client, je veux simuler un crédit auto
US-8.3.2: En tant que client, je veux comparer plusieurs offres
US-8.3.3: En tant que commercial, je veux soumettre une demande de crédit
```

---

## 📊 Phase 9: Analytics & Reporting (MOYENNE PRIORITÉ)

**Objectif:** Insights business pour décisions stratégiques

**Durée estimée:** 4-5 jours

### User Stories Phase 9

#### 9.1 - Reports (Rapports avancés)
```
US-9.1.1: En tant que manager, je veux des rapports de ventes
US-9.1.2: En tant que directeur, je veux des rapports de performance
US-9.1.3: En tant que comptable, je veux des rapports fiscaux
US-9.1.4: En tant que RH, je veux des rapports de commissions
```

#### 9.2 - Dashboards avancés
```
US-9.2.1: En tant que commercial, je veux mon tableau de bord personnel
US-9.2.2: En tant que manager, je veux superviser mon équipe
US-9.2.3: En tant que directeur, je veux une vue consolidée
```

#### 9.3 - Audit Logs (Traçabilité)
```
US-9.3.1: En tant qu'admin, je veux consulter l'historique des actions
US-9.3.2: En tant qu'auditeur, je veux exporter les logs
US-9.3.3: En tant que système, je veux logger automatiquement les actions critiques
```

---

## 🎨 Phase 10: Marketing & Engagement (BASSE PRIORITÉ)

**Objectif:** Acquisition et fidélisation

**Durée estimée:** 5-6 jours

### User Stories Phase 10

#### 10.1 - Marketing Campaigns
```
US-10.1.1: En tant que marketeur, je veux créer une campagne email
US-10.1.2: En tant que marketeur, je veux segmenter ma cible
US-10.1.3: En tant que marketeur, je veux suivre les performances
```

#### 10.2 - Loyalty Program
```
US-10.2.1: En tant que client, je veux cumuler des points
US-10.2.2: En tant que client, je veux échanger mes points
US-10.2.3: En tant que commercial, je veux consulter le solde client
```

#### 10.3 - Promotions & Discounts
```
US-10.3.1: En tant que marketeur, je veux créer des codes promo
US-10.3.2: En tant que client, je veux appliquer un code promo
US-10.3.3: En tant que système, je veux gérer les promotions automatiques
```

---

## 🔧 Phase 11: Système & Intégrations (BASSE PRIORITÉ)

**Objectif:** Automatisation et intégrations tierces

**Durée estimée:** 4-5 jours

### User Stories Phase 11

#### 11.1 - Webhooks
```
US-11.1.1: En tant que développeur, je veux configurer des webhooks
US-11.1.2: En tant que système, je veux notifier les événements
US-11.1.3: En tant qu'admin, je veux consulter les logs webhooks
```

#### 11.2 - API Keys Management
```
US-11.2.1: En tant que développeur, je veux générer une API key
US-11.2.2: En tant que développeur, je veux révoquer une clé
US-11.2.3: En tant qu'admin, je veux monitorer l'usage API
```

#### 11.3 - Import/Export
```
US-11.3.1: En tant qu'admin, je veux importer des véhicules en masse
US-11.3.2: En tant qu'admin, je veux exporter des données
US-11.3.3: En tant que système, je veux traiter les imports en arrière-plan
```

---

## 📅 Timeline Estimée

| Phase | Nom | Durée | Priorité | Dépendances |
|-------|-----|-------|----------|-------------|
| ✅ 1-4 | Base + Sécurité + IA | FAIT | - | - |
| 🔥 5 | Cycle de Vente | 5-7j | P0 CRITIQUE | Phases 1-4 |
| 🚀 6 | Expérience Client | 4-6j | P1 HAUTE | Phase 5 |
| 📦 7 | Opérations | 5-7j | P2 MOYENNE | Phase 5 |
| 💼 8 | Assurance/Finance | 6-8j | P2 MOYENNE | Phase 5 |
| 📊 9 | Analytics | 4-5j | P2 MOYENNE | Phases 5-8 |
| 🎨 10 | Marketing | 5-6j | P3 BASSE | Phase 5 |
| 🔧 11 | Système | 4-5j | P3 BASSE | - |

**Total estimé:** 33-44 jours de développement

---

## 🎯 Prochaine Étape Immédiate

**COMMENCER LA PHASE 5 - Cycle de Vente**

**Ordre d'implémentation recommandé:**
1. ✅ Quotes (devis) - 2j
2. ✅ Orders (commandes) - 1.5j
3. ✅ Invoices (factures) - 2j
4. ✅ Payments (paiements) - 2j
5. ✅ Tests d'intégration du flow complet - 0.5j

**Validation de fin de Phase 5:**
- [ ] Un client peut recevoir un devis
- [ ] Le devis peut être converti en commande
- [ ] Une facture est générée automatiquement
- [ ] Le paiement peut être enregistré (manuel + Beyn)
- [ ] Le véhicule change de statut (AVAILABLE → SOLD)
- [ ] Tous les tests passent
- [ ] Documentation API à jour

---

## 📝 Notes

- Cette roadmap est flexible et peut être ajustée selon les priorités business
- Chaque phase peut être développée en parallèle par plusieurs développeurs
- Les tests et la documentation doivent être créés en même temps que le code
- L'intégration Beyn Payment nécessitera des credentials de sandbox
