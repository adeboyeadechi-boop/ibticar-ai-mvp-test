# PRD-02 & PRD-03 Implementation Roadmap

## Quick Summary

**PRD-02 (Module Comptable):** 40% → 100% = ~70-95 dev days
**PRD-03 (Marketplace):** 15% → 100% = ~58-75 dev days
**Total Effort:** 128-170 developer days (5-7 months solo, 2-3 months with 3 devs)

---

## PRD-02: Module Comptable (12 User Stories)

### Current Status
- **In Progress:** US-012 (Dashboard Fiscal)
- **Partial:** US-011 (Beyn Integration)
- **Not Started:** 10 user stories

### Priority Breakdown

#### CRITICAL (Must Have)
1. **US-001:** Créer Devis Client - 5-7 days
2. **US-002:** Convertir Devis Facture - 4-6 days
3. **US-003:** Gérer Acomptes Paiements - 5-7 days
4. **US-007:** Gestion TVA Algérie - 5-7 days
5. **US-010:** Conformité Comptable SCF - 8-12 days

#### HIGH (Should Have)
6. **US-006:** Tableau Bord Financier - 6-8 days

#### MEDIUM (Nice to Have)
7. **US-004:** Gérer Avoirs - 4-5 days
8. **US-008:** Relances Automatiques - 4-6 days
9. **US-011:** Beyn Integration (Complete) - 6-8 days
10. **US-012:** Dashboard Fiscal (Complete) - 5-7 days

#### LOW (Future)
11. **US-005:** Factures Récurrentes - 5-6 days
12. **US-009:** Banques Algériennes - 8-10 days

---

## PRD-03: Marketplace (12 User Stories)

### Current Status
- **Not Started:** All 12 user stories

### Priority Breakdown

#### CRITICAL (Must Have)
1. **US-001:** Catalogue Véhicules - 5-7 days
2. **US-002:** Fiche Détaillée Véhicule - 5-6 days
3. **US-003:** Filtres Recherche Avancée - 4-5 days
4. **US-005:** Contacter Vendeur - 4-5 days

#### MEDIUM (Should Have)
5. **US-004:** Galerie Photos 360 - 6-8 days
6. **US-006:** Favoris Comparateur - 5-6 days
7. **US-008:** Simulation Financement - 4-5 days
8. **US-009:** Avis Évaluations - 5-6 days
9. **US-024:** Promotion Sociale - 6-8 days

#### LOW (Nice to Have)
10. **US-007:** Estimation Reprise - 6-8 days
11. **US-010:** Alertes Nouveautés - 5-7 days
12. **US-022:** Préparation Financement - 3-4 days

---

## Implementation Phases

### Phase 1: Core Financial (Weeks 1-8)
**Goal:** PRD-02 to 70% completion

| Week | Stories | Deliverables |
|------|---------|--------------|
| 1-2 | US-001, US-002 | Quotes, Invoices, PDF generation |
| 3-4 | US-003, US-007 | Payment tracking, VAT (19%) |
| 5-6 | US-010 | SCF chart of accounts, basic reports |
| 7-8 | US-006 | Financial dashboard |

**Key Milestones:**
- Quote-to-invoice workflow: Week 2
- Payment & VAT system: Week 4
- Accounting compliance: Week 6
- Dashboard launch: Week 8

### Phase 2: Marketplace Launch (Weeks 9-12)
**Goal:** PRD-03 to 50% completion

| Week | Stories | Deliverables |
|------|---------|--------------|
| 9-10 | US-001, US-002 | Public catalog, detail pages |
| 11-12 | US-003, US-005 | Search filters, contact forms |

**Key Milestones:**
- Public catalog live: Week 10
- Search functionality: Week 11
- Lead generation active: Week 12

### Phase 3: Advanced Features (Weeks 13-18)
**Goal:** Complete remaining critical features

| Week | Stories | Deliverables |
|------|---------|--------------|
| 13-14 | PRD-02: US-004, US-008 | Credit notes, reminders |
| 15-16 | PRD-02: US-011, US-012 | Beyn complete, fiscal dashboard |
| 17-18 | PRD-03: US-004, US-006, US-008 | 360 photos, favorites, financing |

### Phase 4: Polish & Nice-to-Have (Weeks 19+)
**Goal:** Complete remaining stories

- PRD-02: US-005, US-009
- PRD-03: US-007, US-009, US-010, US-024, US-022

---

## Resource Planning

### Option A: 1 Full-Stack Developer
- **Timeline:** 6-8 months
- **Cost:** Lower
- **Risk:** Medium (single point of failure)
- **Best For:** Bootstrapped MVP

### Option B: 2 Developers (Backend + Frontend)
- **Timeline:** 3-4 months
- **Cost:** Medium
- **Risk:** Low
- **Best For:** Balanced approach (RECOMMENDED)

### Option C: 3 Developers (2 Backend + 1 Frontend)
- **Timeline:** 2-3 months
- **Cost:** Higher
- **Risk:** Low
- **Best For:** Fast market entry

---

## Technical Stack Required

### Database
- Prisma migrations for:
  - Quote, Invoice, Payment, CreditNote
  - VehicleImage, ContactRequest, Favorite, Review
  - Accounting (ChartOfAccounts, JournalEntry)

### APIs
- Quote/Invoice management
- Payment processing
- VAT calculations
- Marketplace catalog (public)
- Lead management
- Favorites & reviews

### Integrations
- Beyn (fiscal payments) - OAuth2
- Email service (SendGrid/AWS SES)
- SMS service (Algeria provider)
- CDN (image hosting)

### Frontend
- Admin dashboard (quotes, invoices, analytics)
- Public marketplace (catalog, filters, detail pages)
- Mobile-responsive design
- French/Arabic i18n

---

## Success Criteria

### PRD-02
- [ ] Create quote in < 5 minutes
- [ ] Quote-to-invoice conversion: 1 click
- [ ] VAT calculation: 100% accurate
- [ ] Algeria accounting: SCF compliant
- [ ] Financial reports: Accessible
- [ ] Beyn integration: Functional

### PRD-03
- [ ] Catalog response time: < 500ms
- [ ] Image load time: < 2s
- [ ] Contact form success: 100%
- [ ] Search filter combinations: Working
- [ ] Lead response time: < 24h
- [ ] Mobile experience: Excellent

---

## Next Actions (Week 1)

1. **Review & Approve**
   - Stakeholder sign-off on priorities
   - Budget approval
   - Team assignment

2. **Technical Setup**
   - Database schema design
   - API specification
   - Development environment
   - CI/CD pipeline

3. **Design Phase**
   - UI/UX wireframes (Phase 1)
   - Component library setup
   - Design system (colors, typography)

4. **Sprint 1 Planning**
   - Break down US-001 into tasks
   - Assign story points
   - Set up project board (Jira/Linear)

5. **Development Kickoff**
   - Create Quote/Invoice Prisma models
   - Set up test database
   - Start US-001 development

---

## Key Documents

1. **PRD_COMPLETE_ANALYSIS.md** - Full detailed analysis
2. **PRD_ANALYSIS.txt** - Original extraction
3. **IMPLEMENTATION_ROADMAP.md** - This file (quick reference)

---

**Last Updated:** November 10, 2025
**Contact:** Development Team
