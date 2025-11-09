# SCHEMA DE BASE DE DONNÉES COMPLET - IBTICAR.AI MVP

Généré à partir de l'analyse de tous les PRD et User Stories

================================================================================

## SECTION 1: LISTE DES ENTITÉS PAR MODULE

### PRD-01-Gestion-Stock

- Team
- Vehicle
- WorkflowValidation

### PRD-02-Module-Comptable

- BankAccount
- BankTransaction
- BeynPayment
- CreditNote
- FiscalReport
- Invoice
- InvoiceItem
- Payment
- PaymentReminder
- Quote
- QuoteItem
- RecurringInvoice
- TaxConfiguration

### PRD-03-Marketplace

- Comparison
- Favorite
- FinancingSimulation
- MarketplaceAlert
- Order
- Review
- SocialPromotion
- TradeInEstimate

### PRD-04-CRM

- AfterSalesService
- Appointment
- CampaignRecipient
- Complaint
- Customer
- Interaction
- Lead
- LoyaltyCard
- LoyaltyTransaction
- MarketingCampaign

### PRD-05-Module-IA

- AIPrediction
- AIRecommendation
- ChatbotConversation
- ChatbotMessage
- FraudDetection
- WorkflowValidation

### PRD-06-Catalogue-Vehicules

- Brand
- Vehicle
- VehicleConfiguration
- VehicleHistory
- VehicleMedia
- VehicleModel

### PRD-07-Gestion-Fournisseurs

- B2BFinancing
- Delivery
- PurchaseOrder
- PurchaseOrderItem
- Supplier
- SupplierInvoice
- SupplierPerformance
- Warranty

### PRD-08-Reporting-Analytics

- Dashboard
- Report
- ReportExecution

### PRD-09-Notifications

- Alert
- Notification
- NotificationPreference
- NotificationTemplate

### PRD-10-Retours-Annulations

- Dispute
- Order
- Return

### PRD-11-Gestion-Utilisateurs

- AuditLog
- Permission
- Role
- RolePermission
- Session
- Team
- User
- UserRole

### PRD-12-Module-Assurance

- Claim
- CommissionRecord
- InsuranceCompany
- InsurancePolicy
- InsuranceProduct
- InsuranceQuote


================================================================================

## SECTION 2: SCHÉMA DÉTAILLÉ DE CHAQUE ENTITÉ

### AIPrediction

**Description**: Prédictions IA

**Source**: PRD-05-Module-IA

**Champs**:

- `id`: String @id @default(cuid())
- `type`: PredictionType
- `entityType`: String
- `entityId`: String
- `prediction`: Json
- `confidence`: Decimal
- `features`: Json
- `actualValue`: Json?
- `accuracy`: Decimal?
- `period`: DateTime
- `createdAt`: DateTime @default(now())


### AIRecommendation

**Description**: Recommandations IA

**Source**: PRD-05-Module-IA

**Champs**:

- `id`: String @id @default(cuid())
- `type`: RecommendationType
- `entityType`: String
- `entityId`: String
- `score`: Decimal
- `reasoning`: Json
- `recommendation`: String
- `status`: RecommendationStatus @default(PENDING)
- `acceptedAt`: DateTime?
- `rejectedAt`: DateTime?
- `rejectionReason`: String?
- `createdAt`: DateTime @default(now())


### AfterSalesService

**Description**: Service après-vente

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `ticketNumber`: String @unique
- `orderId`: String
- `customerId`: String
- `vehicleId`: String
- `type`: ServiceType
- `status`: ServiceStatus @default(OPEN)
- `priority`: Priority
- `subject`: String
- `description`: String
- `assignedToId`: String?
- `scheduledAt`: DateTime?
- `completedAt`: DateTime?
- `resolution`: String?
- `cost`: Decimal?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Order
- Customer
- Vehicle
- User


### Alert

**Description**: Alertes configurables

**Source**: PRD-09-Notifications

**Champs**:

- `id`: String @id @default(cuid())
- `userId`: String
- `type`: AlertType
- `name`: String
- `conditions`: Json
- `actions`: Json
- `isActive`: Boolean @default(true)
- `lastTriggeredAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User


### Appointment

**Description**: Rendez-vous clients

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `assignedToId`: String
- `type`: AppointmentType
- `status`: AppointmentStatus @default(SCHEDULED)
- `scheduledAt`: DateTime
- `duration`: Int
- `vehicleId`: String?
- `location`: String?
- `notes`: String?
- `reminderSent`: Boolean @default(false)
- `completedAt`: DateTime?
- `cancelledAt`: DateTime?
- `cancellationReason`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- User
- Vehicle


### AuditLog

**Description**: Journal d'audit

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `id`: String @id @default(cuid())
- `userId`: String?
- `action`: AuditAction
- `entityType`: String
- `entityId`: String?
- `changes`: Json?
- `ipAddress`: String?
- `userAgent`: String?
- `metadata`: Json?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- User


### B2BFinancing

**Description**: Financement de stock B2B

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `teamId`: String
- `supplierId`: String
- `purchaseOrderId`: String
- `amount`: Decimal
- `interestRate`: Decimal
- `term`: Int
- `status`: FinancingStatus @default(PENDING)
- `approvedAt`: DateTime?
- `disbursedAt`: DateTime?
- `repaymentSchedule`: Json
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Team
- Supplier
- PurchaseOrder


### BankAccount

**Description**: Comptes bancaires

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `teamId`: String
- `bankName`: String
- `accountNumber`: String
- `rib`: String
- `swift`: String?
- `currency`: Currency @default(DZD)
- `balance`: Decimal @default(0)
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Team
- BankTransaction


### BankTransaction

**Description**: Transactions bancaires

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `bankAccountId`: String
- `type`: TransactionType
- `amount`: Decimal
- `currency`: Currency @default(DZD)
- `reference`: String?
- `description`: String
- `date`: DateTime
- `paymentId`: String?
- `reconciled`: Boolean @default(false)
- `reconciledAt`: DateTime?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- BankAccount
- Payment


### BeynPayment

**Description**: Paiements via Beyn

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `paymentId`: String @unique
- `beynTransactionId`: String?
- `status`: BeynPaymentStatus
- `amount`: Decimal
- `currency`: Currency @default(DZD)
- `merchantId`: String
- `customerId`: String
- `metadata`: Json?
- `webhookData`: Json?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Payment
- Customer


### Brand

**Description**: Marques de véhicules

**Source**: PRD-06-Catalogue-Vehicules

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String @unique
- `slug`: String @unique
- `logo`: String?
- `country`: String?
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- VehicleModel


### CampaignRecipient

**Description**: Destinataires de campagnes

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `campaignId`: String
- `customerId`: String
- `status`: RecipientStatus
- `sentAt`: DateTime?
- `openedAt`: DateTime?
- `clickedAt`: DateTime?
- `convertedAt`: DateTime?
- `unsubscribedAt`: DateTime?

**Relations avec**:

- MarketingCampaign
- Customer


### ChatbotConversation

**Description**: Conversations chatbot

**Source**: PRD-05-Module-IA

**Champs**:

- `id`: String @id @default(cuid())
- `sessionId`: String
- `customerId`: String?
- `userId`: String?
- `channel`: CommunicationChannel
- `language`: Language
- `startedAt`: DateTime @default(now())
- `endedAt`: DateTime?
- `satisfaction`: Int?
- `handedOffToHuman`: Boolean @default(false)
- `handedOffAt`: DateTime?

**Relations avec**:

- Customer
- User
- ChatbotMessage


### ChatbotMessage

**Description**: Messages chatbot

**Source**: PRD-05-Module-IA

**Champs**:

- `id`: String @id @default(cuid())
- `conversationId`: String
- `role`: MessageRole
- `content`: String
- `intent`: String?
- `confidence`: Decimal?
- `entities`: Json?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- ChatbotConversation


### Claim

**Description**: Déclarations de sinistres

**Source**: PRD-12-Module-Assurance

**Champs**:

- `id`: String @id @default(cuid())
- `claimNumber`: String @unique
- `insurancePolicyId`: String
- `customerId`: String
- `vehicleId`: String
- `type`: ClaimType
- `status`: ClaimStatus @default(SUBMITTED)
- `incidentDate`: DateTime
- `description`: String
- `estimatedAmount`: Decimal?
- `approvedAmount`: Decimal?
- `documents`: Json?
- `submittedAt`: DateTime @default(now())
- `processedAt`: DateTime?
- `settledAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- InsurancePolicy
- Customer
- Vehicle


### CommissionRecord

**Description**: Enregistrements de commissions

**Source**: PRD-12-Module-Assurance

**Champs**:

- `id`: String @id @default(cuid())
- `insurancePolicyId`: String
- `teamId`: String
- `userId`: String
- `amount`: Decimal
- `rate`: Decimal
- `status`: CommissionStatus @default(PENDING)
- `paidAt`: DateTime?
- `period`: DateTime
- `createdAt`: DateTime @default(now())

**Relations avec**:

- InsurancePolicy
- Team
- User


### Comparison

**Description**: Comparaisons de véhicules

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `vehicles`: Json
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Customer


### Complaint

**Description**: Réclamations

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `complaintNumber`: String @unique
- `customerId`: String
- `orderId`: String?
- `type`: ComplaintType
- `status`: ComplaintStatus @default(NEW)
- `priority`: Priority
- `subject`: String
- `description`: String
- `assignedToId`: String?
- `resolution`: String?
- `resolvedAt`: DateTime?
- `satisfactionRating`: Int?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- Order
- User


### CreditNote

**Description**: Avoirs (remboursements)

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `creditNoteNumber`: String @unique
- `invoiceId`: String
- `customerId`: String
- `amount`: Decimal
- `currency`: Currency @default(DZD)
- `reason`: String
- `status`: CreditNoteStatus @default(DRAFT)
- `issueDate`: DateTime @default(now())
- `appliedAt`: DateTime?
- `notes`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Invoice
- Customer


### Customer

**Description**: Clients (CRM)

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `userId`: String? @unique
- `type`: CustomerType
- `firstName`: String
- `lastName`: String
- `email`: String @unique
- `phone`: String
- `address`: String?
- `city`: String?
- `wilaya`: String?
- `postalCode`: String?
- `dateOfBirth`: DateTime?
- `idType`: IdType?
- `idNumber`: String?
- `profession`: String?
- `companyName`: String?
- `taxId`: String?
- `status`: CustomerStatus @default(PROSPECT)
- `source`: String?
- `tags`: Json?
- `preferences`: Json?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User
- Lead
- Appointment
- Quote
- Order
- Interaction
- LoyaltyCard


### Dashboard

**Description**: Tableaux de bord personnalisés

**Source**: PRD-08-Reporting-Analytics

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `type`: DashboardType
- `layout`: Json
- `widgets`: Json
- `filters`: Json?
- `createdById`: String
- `isPublic`: Boolean @default(false)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User


### Delivery

**Description**: Réceptions de livraisons

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `deliveryNumber`: String @unique
- `purchaseOrderId`: String
- `supplierId`: String
- `status`: DeliveryStatus @default(SCHEDULED)
- `scheduledDate`: DateTime
- `actualDate`: DateTime?
- `receivedById`: String?
- `notes`: String?
- `documents`: Json?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- PurchaseOrder
- Supplier
- User


### Dispute

**Description**: Litiges

**Source**: PRD-10-Retours-Annulations

**Champs**:

- `id`: String @id @default(cuid())
- `disputeNumber`: String @unique
- `returnId`: String?
- `orderId`: String?
- `customerId`: String
- `type`: DisputeType
- `status`: DisputeStatus @default(OPEN)
- `priority`: Priority
- `subject`: String
- `description`: String
- `assignedToId`: String?
- `resolution`: String?
- `resolvedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Return
- Order
- Customer
- User


### Favorite

**Description**: Véhicules favoris

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `vehicleId`: String
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Customer
- Vehicle


### FinancingSimulation

**Description**: Simulations de financement

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `vehicleId`: String
- `vehiclePrice`: Decimal
- `downPayment`: Decimal
- `loanAmount`: Decimal
- `interestRate`: Decimal
- `term`: Int
- `monthlyPayment`: Decimal
- `totalPayment`: Decimal
- `status`: SimulationStatus @default(DRAFT)
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Customer
- Vehicle


### FiscalReport

**Description**: Rapports fiscaux

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `teamId`: String
- `type`: FiscalReportType
- `period`: DateTime
- `data`: Json
- `generatedAt`: DateTime @default(now())
- `submittedAt`: DateTime?

**Relations avec**:

- Team


### FraudDetection

**Description**: Détection de fraudes

**Source**: PRD-05-Module-IA

**Champs**:

- `id`: String @id @default(cuid())
- `entityType`: String
- `entityId`: String
- `riskScore`: Decimal
- `riskLevel`: RiskLevel
- `indicators`: Json
- `status`: FraudStatus @default(FLAGGED)
- `reviewedAt`: DateTime?
- `reviewedById`: String?
- `resolution`: String?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- User


### InsuranceCompany

**Description**: Compagnies d'assurance

**Source**: PRD-12-Module-Assurance

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `code`: String @unique
- `type`: InsuranceType
- `status`: CompanyStatus @default(ACTIVE)
- `email`: String
- `phone`: String
- `address`: String?
- `city`: String?
- `wilaya`: String?
- `licenseNumber`: String
- `apiEndpoint`: String?
- `apiKey`: String?
- `commissionRate`: Decimal
- `rating`: Decimal?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- InsuranceProduct
- InsuranceQuote
- InsurancePolicy


### InsurancePolicy

**Description**: Polices d'assurance actives

**Source**: PRD-12-Module-Assurance

**Champs**:

- `id`: String @id @default(cuid())
- `policyNumber`: String @unique
- `insuranceQuoteId`: String
- `customerId`: String
- `vehicleId`: String
- `insuranceCompanyId`: String
- `status`: PolicyStatus @default(ACTIVE)
- `startDate`: DateTime
- `endDate`: DateTime
- `premium`: Decimal
- `paymentFrequency`: PaymentFrequency
- `coverage`: Json
- `documents`: Json?
- `cancelledAt`: DateTime?
- `cancellationReason`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- InsuranceQuote
- Customer
- Vehicle
- InsuranceCompany
- Claim


### InsuranceProduct

**Description**: Produits d'assurance

**Source**: PRD-12-Module-Assurance

**Champs**:

- `id`: String @id @default(cuid())
- `insuranceCompanyId`: String
- `name`: String
- `type`: InsuranceProductType
- `coverage`: Json
- `basePrice`: Decimal
- `pricing`: Json
- `terms`: String?
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- InsuranceCompany


### InsuranceQuote

**Description**: Devis d'assurance

**Source**: PRD-12-Module-Assurance

**Champs**:

- `id`: String @id @default(cuid())
- `quoteNumber`: String @unique
- `customerId`: String
- `vehicleId`: String
- `insuranceCompanyId`: String
- `insuranceProductId`: String
- `status`: QuoteStatus @default(DRAFT)
- `riskScore`: Decimal?
- `premium`: Decimal
- `coverage`: Json
- `validUntil`: DateTime
- `acceptedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- Vehicle
- InsuranceCompany
- InsuranceProduct
- InsurancePolicy


### Interaction

**Description**: Historique des interactions clients

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `userId`: String
- `type`: InteractionType
- `channel`: CommunicationChannel
- `subject`: String?
- `content`: String
- `direction`: Direction
- `duration`: Int?
- `attachments`: Json?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Customer
- User


### Invoice

**Description**: Factures

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `invoiceNumber`: String @unique
- `quoteId`: String?
- `customerId`: String
- `teamId`: String
- `createdById`: String
- `status`: InvoiceStatus @default(DRAFT)
- `type`: InvoiceType @default(STANDARD)
- `issueDate`: DateTime @default(now())
- `dueDate`: DateTime
- `subtotal`: Decimal
- `taxAmount`: Decimal
- `discountAmount`: Decimal @default(0)
- `total`: Decimal
- `amountPaid`: Decimal @default(0)
- `amountDue`: Decimal
- `currency`: Currency @default(DZD)
- `terms`: String?
- `notes`: String?
- `sentAt`: DateTime?
- `paidAt`: DateTime?
- `cancelledAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Quote
- Customer
- Team
- User
- InvoiceItem
- Payment
- CreditNote


### InvoiceItem

**Description**: Lignes de facture

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `invoiceId`: String
- `description`: String
- `quantity`: Int @default(1)
- `unitPrice`: Decimal
- `taxRate`: Decimal
- `discountRate`: Decimal @default(0)
- `total`: Decimal
- `vehicleId`: String?
- `order`: Int @default(0)

**Relations avec**:

- Invoice
- Vehicle


### Lead

**Description**: Prospects en cours de prospection

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `assignedToId`: String
- `source`: LeadSource
- `status`: LeadStatus @default(NEW)
- `score`: Int?
- `interestedVehicleId`: String?
- `budget`: Decimal?
- `timeline`: String?
- `notes`: String?
- `lastContactDate`: DateTime?
- `nextFollowUpDate`: DateTime?
- `convertedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- User
- Vehicle


### LoyaltyCard

**Description**: Cartes de fidélité

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String @unique
- `cardNumber`: String @unique
- `tier`: LoyaltyTier @default(BRONZE)
- `points`: Int @default(0)
- `pointsEarned`: Int @default(0)
- `pointsRedeemed`: Int @default(0)
- `status`: LoyaltyStatus @default(ACTIVE)
- `issuedAt`: DateTime @default(now())
- `expiresAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- LoyaltyTransaction


### LoyaltyTransaction

**Description**: Transactions de fidélité

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `loyaltyCardId`: String
- `type`: TransactionType
- `points`: Int
- `description`: String
- `referenceId`: String?
- `referenceType`: String?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- LoyaltyCard


### MarketingCampaign

**Description**: Campagnes marketing

**Source**: PRD-04-CRM

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `type`: CampaignType
- `status`: CampaignStatus @default(DRAFT)
- `channel`: CommunicationChannel
- `startDate`: DateTime
- `endDate`: DateTime?
- `targetAudience`: Json?
- `message`: String
- `budget`: Decimal?
- `sent`: Int @default(0)
- `opened`: Int @default(0)
- `clicked`: Int @default(0)
- `converted`: Int @default(0)
- `createdById`: String
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User
- CampaignRecipient


### MarketplaceAlert

**Description**: Alertes nouveautés marketplace

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `name`: String
- `criteria`: Json
- `frequency`: AlertFrequency
- `isActive`: Boolean @default(true)
- `lastSentAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer


### Notification

**Description**: Notifications

**Source**: PRD-09-Notifications

**Champs**:

- `id`: String @id @default(cuid())
- `userId`: String
- `type`: NotificationType
- `channel`: NotificationChannel
- `priority`: Priority @default(MEDIUM)
- `title`: String
- `message`: String
- `data`: Json?
- `status`: NotificationStatus @default(PENDING)
- `readAt`: DateTime?
- `sentAt`: DateTime?
- `failedAt`: DateTime?
- `failureReason`: String?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- User


### NotificationPreference

**Description**: Préférences de notifications

**Source**: PRD-09-Notifications

**Champs**:

- `id`: String @id @default(cuid())
- `userId`: String
- `type`: NotificationType
- `email`: Boolean @default(true)
- `sms`: Boolean @default(true)
- `push`: Boolean @default(true)
- `inApp`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User


### NotificationTemplate

**Description**: Modèles de notifications

**Source**: PRD-09-Notifications

**Champs**:

- `id`: String @id @default(cuid())
- `code`: String @unique
- `name`: String
- `type`: NotificationType
- `channel`: NotificationChannel
- `language`: Language
- `subject`: String?
- `template`: String
- `variables`: Json?
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt


### Order

**Description**: Commandes de véhicules

**Source**: PRD-03-Marketplace, PRD-10-Retours-Annulations

**Champs**:

- `id`: String @id @default(cuid())
- `orderNumber`: String @unique
- `customerId`: String
- `vehicleId`: String
- `invoiceId`: String?
- `status`: OrderStatus @default(PENDING)
- `orderDate`: DateTime @default(now())
- `deliveryDate`: DateTime?
- `totalAmount`: Decimal
- `currency`: Currency @default(DZD)
- `notes`: String?
- `completedAt`: DateTime?
- `cancelledAt`: DateTime?
- `cancellationReason`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- Vehicle
- Invoice
- Return
- AfterSalesService


### Payment

**Description**: Paiements et acomptes

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `paymentNumber`: String @unique
- `invoiceId`: String
- `customerId`: String
- `amount`: Decimal
- `currency`: Currency @default(DZD)
- `method`: PaymentMethod
- `status`: PaymentStatus @default(PENDING)
- `transactionId`: String?
- `reference`: String?
- `paymentDate`: DateTime @default(now())
- `notes`: String?
- `processedAt`: DateTime?
- `failedAt`: DateTime?
- `failureReason`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Invoice
- Customer


### PaymentReminder

**Description**: Relances automatiques

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `invoiceId`: String
- `customerId`: String
- `type`: ReminderType
- `status`: ReminderStatus
- `scheduledAt`: DateTime
- `sentAt`: DateTime?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Invoice
- Customer


### Permission

**Description**: Permissions granulaires

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `id`: String @id @default(cuid())
- `code`: String @unique
- `name`: String
- `description`: String?
- `module`: String
- `action`: String
- `resource`: String
- `createdAt`: DateTime @default(now())

**Relations avec**:

- RolePermission


### PurchaseOrder

**Description**: Commandes fournisseurs

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `orderNumber`: String @unique
- `supplierId`: String
- `teamId`: String
- `createdById`: String
- `status`: PurchaseOrderStatus @default(DRAFT)
- `orderDate`: DateTime @default(now())
- `expectedDeliveryDate`: DateTime?
- `actualDeliveryDate`: DateTime?
- `subtotal`: Decimal
- `taxAmount`: Decimal
- `total`: Decimal
- `currency`: Currency @default(DZD)
- `terms`: String?
- `notes`: String?
- `receivedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Supplier
- Team
- User
- PurchaseOrderItem
- Delivery


### PurchaseOrderItem

**Description**: Lignes de commande fournisseur

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `purchaseOrderId`: String
- `description`: String
- `quantity`: Int
- `unitPrice`: Decimal
- `taxRate`: Decimal
- `total`: Decimal
- `receivedQuantity`: Int @default(0)
- `vehicleModelId`: String?
- `order`: Int @default(0)

**Relations avec**:

- PurchaseOrder
- VehicleModel


### Quote

**Description**: Devis clients

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `quoteNumber`: String @unique
- `customerId`: String
- `teamId`: String
- `createdById`: String
- `status`: QuoteStatus @default(DRAFT)
- `validUntil`: DateTime
- `vehicleId`: String?
- `subtotal`: Decimal
- `taxAmount`: Decimal
- `discountAmount`: Decimal @default(0)
- `total`: Decimal
- `currency`: Currency @default(DZD)
- `terms`: String?
- `notes`: String?
- `convertedToInvoiceId`: String? @unique
- `convertedAt`: DateTime?
- `sentAt`: DateTime?
- `viewedAt`: DateTime?
- `acceptedAt`: DateTime?
- `rejectedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- Team
- User
- Vehicle
- QuoteItem
- Invoice


### QuoteItem

**Description**: Lignes de devis

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `quoteId`: String
- `description`: String
- `quantity`: Int @default(1)
- `unitPrice`: Decimal
- `taxRate`: Decimal
- `discountRate`: Decimal @default(0)
- `total`: Decimal
- `vehicleId`: String?
- `order`: Int @default(0)

**Relations avec**:

- Quote
- Vehicle


### RecurringInvoice

**Description**: Factures récurrentes

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `teamId`: String
- `frequency`: RecurringFrequency
- `nextInvoiceDate`: DateTime
- `lastInvoiceDate`: DateTime?
- `endDate`: DateTime?
- `template`: Json
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- Team


### Report

**Description**: Rapports personnalisés

**Source**: PRD-08-Reporting-Analytics

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `type`: ReportType
- `description`: String?
- `parameters`: Json
- `schedule`: Json?
- `format`: ReportFormat
- `createdById`: String
- `isPublic`: Boolean @default(false)
- `lastRunAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User
- ReportExecution


### ReportExecution

**Description**: Exécutions de rapports

**Source**: PRD-08-Reporting-Analytics

**Champs**:

- `id`: String @id @default(cuid())
- `reportId`: String
- `status`: ExecutionStatus
- `parameters`: Json
- `resultUrl`: String?
- `startedAt`: DateTime @default(now())
- `completedAt`: DateTime?
- `error`: String?

**Relations avec**:

- Report


### Return

**Description**: Retours et annulations

**Source**: PRD-10-Retours-Annulations

**Champs**:

- `id`: String @id @default(cuid())
- `returnNumber`: String @unique
- `orderId`: String
- `customerId`: String
- `vehicleId`: String
- `type`: ReturnType
- `status`: ReturnStatus @default(REQUESTED)
- `reason`: String
- `description`: String?
- `requestDate`: DateTime @default(now())
- `approvedAt`: DateTime?
- `completedAt`: DateTime?
- `refundAmount`: Decimal?
- `refundMethod`: PaymentMethod?
- `inspectionNotes`: String?
- `resolutionNotes`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Order
- Customer
- Vehicle
- Dispute


### Review

**Description**: Avis et évaluations clients

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `vehicleId`: String?
- `orderId`: String?
- `rating`: Int
- `title`: String?
- `comment`: String?
- `pros`: String?
- `cons`: String?
- `status`: ReviewStatus @default(PENDING)
- `isVerified`: Boolean @default(false)
- `publishedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Customer
- Vehicle
- Order


### Role

**Description**: Rôles avec permissions

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String @unique
- `description`: String?
- `isSystem`: Boolean @default(false)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- RolePermission
- UserRole


### RolePermission

**Description**: Association rôles-permissions

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `roleId`: String
- `permissionId`: String

**Relations avec**:

- Role
- Permission


### Session

**Description**: Sessions utilisateurs

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `id`: String @id @default(cuid())
- `userId`: String
- `token`: String @unique
- `ipAddress`: String
- `userAgent`: String
- `expiresAt`: DateTime
- `createdAt`: DateTime @default(now())

**Relations avec**:

- User


### SocialPromotion

**Description**: Promotions réseaux sociaux

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `vehicleId`: String
- `platform`: SocialPlatform
- `status`: PromotionStatus
- `scheduledAt`: DateTime?
- `publishedAt`: DateTime?
- `postUrl`: String?
- `content`: String
- `mediaUrls`: Json
- `reach`: Int?
- `engagement`: Int?
- `clicks`: Int?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Vehicle


### Supplier

**Description**: Fournisseurs

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `code`: String @unique
- `type`: SupplierType
- `status`: SupplierStatus @default(ACTIVE)
- `email`: String
- `phone`: String
- `address`: String?
- `city`: String?
- `country`: String?
- `taxId`: String?
- `contactPerson`: String?
- `paymentTerms`: String?
- `rating`: Decimal?
- `notes`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- PurchaseOrder
- SupplierInvoice
- SupplierPerformance


### SupplierInvoice

**Description**: Factures fournisseurs

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `invoiceNumber`: String @unique
- `supplierId`: String
- `purchaseOrderId`: String?
- `status`: InvoiceStatus @default(PENDING)
- `issueDate`: DateTime
- `dueDate`: DateTime
- `subtotal`: Decimal
- `taxAmount`: Decimal
- `total`: Decimal
- `amountPaid`: Decimal @default(0)
- `currency`: Currency @default(DZD)
- `paidAt`: DateTime?
- `notes`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Supplier
- PurchaseOrder


### SupplierPerformance

**Description**: Performance des fournisseurs

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `supplierId`: String
- `period`: DateTime
- `deliveryScore`: Decimal
- `qualityScore`: Decimal
- `priceScore`: Decimal
- `overallScore`: Decimal
- `totalOrders`: Int
- `onTimeDeliveries`: Int
- `defectRate`: Decimal
- `notes`: String?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Supplier


### TaxConfiguration

**Description**: Configuration TVA Algérie

**Source**: PRD-02-Module-Comptable

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `rate`: Decimal
- `type`: TaxType
- `applicableTo`: String
- `startDate`: DateTime
- `endDate`: DateTime?
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())


### Team

**Description**: Équipes/concessions

**Source**: PRD-11-Gestion-Utilisateurs, PRD-01-Gestion-Stock

**Champs**:

- `id`: String @id @default(cuid())
- `name`: String
- `type`: TeamType
- `managerId`: String
- `status`: TeamStatus @default(ACTIVE)
- `code`: String @unique
- `address`: String?
- `city`: String?
- `wilaya`: String?
- `phone`: String?
- `email`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- User
- Vehicle
- Quote
- Invoice


### TradeInEstimate

**Description**: Estimations de reprise

**Source**: PRD-03-Marketplace

**Champs**:

- `id`: String @id @default(cuid())
- `customerId`: String
- `vehicleModelId`: String
- `year`: Int
- `mileage`: Int
- `condition`: VehicleCondition
- `estimatedValue`: Decimal
- `validUntil`: DateTime
- `status`: EstimateStatus @default(PENDING)
- `notes`: String?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Customer
- VehicleModel


### User

**Description**: Utilisateurs de la plateforme

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `id`: String @id @default(cuid())
- `email`: String @unique
- `passwordHash`: String
- `role`: UserRole @default(USER)
- `firstName`: String
- `lastName`: String
- `phone`: String?
- `preferredLanguage`: Language @default(FR)
- `isActive`: Boolean @default(true)
- `lastLoginAt`: DateTime?
- `emailVerifiedAt`: DateTime?
- `phoneVerifiedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Team
- AuditLog
- Session
- Notification


### UserRole

**Description**: Rôles des utilisateurs

**Source**: PRD-11-Gestion-Utilisateurs

**Champs**:

- `userId`: String
- `roleId`: String
- `assignedAt`: DateTime @default(now())

**Relations avec**:

- User
- Role


### Vehicle

**Description**: Véhicules en stock

**Source**: PRD-01-Gestion-Stock, PRD-06-Catalogue-Vehicules

**Champs**:

- `id`: String @id @default(cuid())
- `vin`: String @unique
- `vehicleModelId`: String
- `teamId`: String
- `status`: VehicleStatus @default(AVAILABLE)
- `condition`: VehicleCondition
- `mileage`: Int?
- `year`: Int
- `color`: String
- `interiorColor`: String?
- `purchasePrice`: Decimal
- `sellingPrice`: Decimal
- `currency`: Currency @default(DZD)
- `purchaseDate`: DateTime?
- `location`: String?
- `features`: Json?
- `notes`: String?
- `publishedAt`: DateTime?
- `soldAt`: DateTime?
- `archivedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- VehicleModel
- Team
- VehicleMedia
- VehicleHistory
- Quote
- Order


### VehicleConfiguration

**Description**: Configurations de véhicules neufs

**Source**: PRD-06-Catalogue-Vehicules

**Champs**:

- `id`: String @id @default(cuid())
- `vehicleModelId`: String
- `name`: String
- `trim`: String
- `basePrice`: Decimal
- `options`: Json
- `totalPrice`: Decimal
- `availability`: String?
- `deliveryTime`: Int?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- VehicleModel


### VehicleHistory

**Description**: Historique des véhicules

**Source**: PRD-06-Catalogue-Vehicules

**Champs**:

- `id`: String @id @default(cuid())
- `vehicleId`: String
- `eventType`: VehicleEventType
- `eventDate`: DateTime
- `description`: String
- `performedBy`: String?
- `documents`: Json?
- `cost`: Decimal?
- `mileage`: Int?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- Vehicle


### VehicleMedia

**Description**: Photos et vidéos des véhicules

**Source**: PRD-06-Catalogue-Vehicules

**Champs**:

- `id`: String @id @default(cuid())
- `vehicleId`: String
- `type`: MediaType
- `url`: String
- `thumbnailUrl`: String?
- `order`: Int @default(0)
- `is360`: Boolean @default(false)
- `caption`: String?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Vehicle


### VehicleModel

**Description**: Modèles de véhicules (référentiel constructeurs)

**Source**: PRD-06-Catalogue-Vehicules

**Champs**:

- `id`: String @id @default(cuid())
- `brandId`: String
- `name`: String
- `slug`: String @unique
- `category`: VehicleCategory
- `bodyType`: BodyType
- `fuelType`: FuelType
- `transmission`: TransmissionType
- `engineCapacity`: Int?
- `horsePower`: Int?
- `co2Emission`: Int?
- `energyLabel`: EnergyLabel?
- `seats`: Int?
- `doors`: Int?
- `specifications`: Json?
- `translations`: Json?
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Brand
- Vehicle
- VehicleConfiguration


### Warranty

**Description**: Garanties

**Source**: PRD-07-Gestion-Fournisseurs

**Champs**:

- `id`: String @id @default(cuid())
- `vehicleId`: String
- `supplierId`: String?
- `type`: WarrantyType
- `startDate`: DateTime
- `endDate`: DateTime
- `coverage`: String
- `terms`: String?
- `documents`: Json?
- `isActive`: Boolean @default(true)
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**Relations avec**:

- Vehicle
- Supplier


### WorkflowValidation

**Description**: Validations workflow

**Source**: PRD-01-Gestion-Stock, PRD-05-Module-IA

**Champs**:

- `id`: String @id @default(cuid())
- `entityType`: String
- `entityId`: String
- `workflowStage`: WorkflowStage
- `status`: ValidationStatus
- `validatedById`: String?
- `validatedAt`: DateTime?
- `comments`: String?
- `aiScore`: Decimal?
- `aiRecommendation`: String?
- `createdAt`: DateTime @default(now())

**Relations avec**:

- User



================================================================================

## SECTION 3: RÉSUMÉ DES RELATIONS ENTRE ENTITÉS

- AfterSalesService ↔ Customer
- AfterSalesService ↔ Order
- AfterSalesService ↔ User
- AfterSalesService ↔ Vehicle
- Alert ↔ User
- Appointment ↔ Customer
- Appointment ↔ User
- Appointment ↔ Vehicle
- AuditLog ↔ User
- B2BFinancing ↔ PurchaseOrder
- B2BFinancing ↔ Supplier
- B2BFinancing ↔ Team
- BankAccount ↔ BankTransaction
- BankAccount ↔ Team
- BankTransaction ↔ BankAccount
- BankTransaction ↔ Payment
- BeynPayment ↔ Customer
- BeynPayment ↔ Payment
- Brand ↔ VehicleModel
- CampaignRecipient ↔ Customer
- CampaignRecipient ↔ MarketingCampaign
- ChatbotConversation ↔ ChatbotMessage
- ChatbotConversation ↔ Customer
- ChatbotConversation ↔ User
- ChatbotMessage ↔ ChatbotConversation
- Claim ↔ Customer
- Claim ↔ InsurancePolicy
- Claim ↔ Vehicle
- CommissionRecord ↔ InsurancePolicy
- CommissionRecord ↔ Team
- CommissionRecord ↔ User
- Comparison ↔ Customer
- Complaint ↔ Customer
- Complaint ↔ Order
- Complaint ↔ User
- CreditNote ↔ Customer
- CreditNote ↔ Invoice
- Customer ↔ Appointment
- Customer ↔ Interaction
- Customer ↔ Lead
- Customer ↔ LoyaltyCard
- Customer ↔ Order
- Customer ↔ Quote
- Customer ↔ User
- Dashboard ↔ User
- Delivery ↔ PurchaseOrder
- Delivery ↔ Supplier
- Delivery ↔ User
- Dispute ↔ Customer
- Dispute ↔ Order
- Dispute ↔ Return
- Dispute ↔ User
- Favorite ↔ Customer
- Favorite ↔ Vehicle
- FinancingSimulation ↔ Customer
- FinancingSimulation ↔ Vehicle
- FiscalReport ↔ Team
- FraudDetection ↔ User
- InsuranceCompany ↔ InsurancePolicy
- InsuranceCompany ↔ InsuranceProduct
- InsuranceCompany ↔ InsuranceQuote
- InsurancePolicy ↔ Claim
- InsurancePolicy ↔ Customer
- InsurancePolicy ↔ InsuranceCompany
- InsurancePolicy ↔ InsuranceQuote
- InsurancePolicy ↔ Vehicle
- InsuranceProduct ↔ InsuranceCompany
- InsuranceQuote ↔ Customer
- InsuranceQuote ↔ InsuranceCompany
- InsuranceQuote ↔ InsurancePolicy
- InsuranceQuote ↔ InsuranceProduct
- InsuranceQuote ↔ Vehicle
- Interaction ↔ Customer
- Interaction ↔ User
- Invoice ↔ CreditNote
- Invoice ↔ Customer
- Invoice ↔ InvoiceItem
- Invoice ↔ Payment
- Invoice ↔ Quote
- Invoice ↔ Team
- Invoice ↔ User
- InvoiceItem ↔ Invoice
- InvoiceItem ↔ Vehicle
- Lead ↔ Customer
- Lead ↔ User
- Lead ↔ Vehicle
- LoyaltyCard ↔ Customer
- LoyaltyCard ↔ LoyaltyTransaction
- LoyaltyTransaction ↔ LoyaltyCard
- MarketingCampaign ↔ CampaignRecipient
- MarketingCampaign ↔ User
- MarketplaceAlert ↔ Customer
- Notification ↔ User
- NotificationPreference ↔ User
- Order ↔ AfterSalesService
- Order ↔ Customer
- Order ↔ Invoice
- Order ↔ Return
- Order ↔ Vehicle
- Payment ↔ Customer
- Payment ↔ Invoice
- PaymentReminder ↔ Customer
- PaymentReminder ↔ Invoice
- Permission ↔ RolePermission
- PurchaseOrder ↔ Delivery
- PurchaseOrder ↔ PurchaseOrderItem
- PurchaseOrder ↔ Supplier
- PurchaseOrder ↔ Team
- PurchaseOrder ↔ User
- PurchaseOrderItem ↔ PurchaseOrder
- PurchaseOrderItem ↔ VehicleModel
- Quote ↔ Customer
- Quote ↔ Invoice
- Quote ↔ QuoteItem
- Quote ↔ Team
- Quote ↔ User
- Quote ↔ Vehicle
- QuoteItem ↔ Quote
- QuoteItem ↔ Vehicle
- RecurringInvoice ↔ Customer
- RecurringInvoice ↔ Team
- Report ↔ ReportExecution
- Report ↔ User
- ReportExecution ↔ Report
- Return ↔ Customer
- Return ↔ Dispute
- Return ↔ Order
- Return ↔ Vehicle
- Review ↔ Customer
- Review ↔ Order
- Review ↔ Vehicle
- Role ↔ RolePermission
- Role ↔ UserRole
- RolePermission ↔ Permission
- RolePermission ↔ Role
- Session ↔ User
- SocialPromotion ↔ Vehicle
- Supplier ↔ PurchaseOrder
- Supplier ↔ SupplierInvoice
- Supplier ↔ SupplierPerformance
- SupplierInvoice ↔ PurchaseOrder
- SupplierInvoice ↔ Supplier
- SupplierPerformance ↔ Supplier
- Team ↔ Invoice
- Team ↔ Quote
- Team ↔ User
- Team ↔ Vehicle
- TradeInEstimate ↔ Customer
- TradeInEstimate ↔ VehicleModel
- User ↔ AuditLog
- User ↔ Notification
- User ↔ Session
- User ↔ Team
- UserRole ↔ Role
- UserRole ↔ User
- Vehicle ↔ Order
- Vehicle ↔ Quote
- Vehicle ↔ Team
- Vehicle ↔ VehicleHistory
- Vehicle ↔ VehicleMedia
- Vehicle ↔ VehicleModel
- VehicleConfiguration ↔ VehicleModel
- VehicleHistory ↔ Vehicle
- VehicleMedia ↔ Vehicle
- VehicleModel ↔ Brand
- VehicleModel ↔ Vehicle
- VehicleModel ↔ VehicleConfiguration
- Warranty ↔ Supplier
- Warranty ↔ Vehicle
- WorkflowValidation ↔ User


================================================================================

## SECTION 4: SCHÉMA PRISMA COMPLET

Le schéma Prisma complet a été généré dans le fichier `database_schema_complete.prisma`

**Nombre total d'entités**: 74
**Nombre total de relations**: 170


================================================================================

## STATISTIQUES

- Entités analysées: 74
- Modules couverts: 12
- Relations identifiées: 170
