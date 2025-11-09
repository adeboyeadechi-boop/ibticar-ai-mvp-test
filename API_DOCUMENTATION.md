# Ibticar.AI MVP - API Documentation

## Table des matières

1. [Authentication](#authentication)
2. [Refresh Tokens](#refresh-tokens)
3. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
4. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
   - [Roles Management](#roles-management)
   - [Permissions Management](#permissions-management)
   - [User Roles Assignment](#user-roles-assignment)

---

## Authentication

### POST `/api/auth/signin`

Authentifie un utilisateur et retourne des tokens d'accès et de rafraîchissement.

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "YourPassword123!",
  "twoFactorCode": "123456"  // Optionnel, requis si 2FA activé
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "USER",
    "firstName": "John",
    "lastName": "Doe",
    "twoFactorEnabled": false
  }
}
```

**2FA Required Response (200 OK):**
```json
{
  "requires2FA": true,
  "message": "Two-factor authentication code required"
}
```

**Error Responses:**
- `400 Bad Request`: Credentials manquantes
- `401 Unauthorized`: Email, mot de passe ou code 2FA invalide

---

## Refresh Tokens

### POST `/api/auth/refresh`

Rafraîchit les tokens d'accès et de rafraîchissement (rotation automatique).

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request`: Refresh token manquant
- `401 Unauthorized`: Token invalide, révoqué ou expiré

---

## Two-Factor Authentication (2FA)

### POST `/api/auth/2fa/setup`

Configure le 2FA pour l'utilisateur connecté. Génère un secret TOTP et un QR code.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200 OK):**
```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KG..."
}
```

**Error Responses:**
- `401 Unauthorized`: Token manquant ou invalide
- `409 Conflict`: 2FA déjà activé

**Notes:**
- Le QR code doit être scanné avec une application d'authentification (Google Authenticator, Authy, etc.)
- Le secret est stocké mais le 2FA n'est pas encore activé jusqu'à vérification

---

### POST `/api/auth/2fa/verify`

Vérifie le code 2FA et active définitivement le 2FA. Génère des codes de récupération.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "code": "123456"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "backupCodes": [
    "ABCD1234",
    "EFGH5678",
    "..."
  ],
  "warning": "Save these backup codes in a safe place. You won't see them again."
}
```

**Error Responses:**
- `400 Bad Request`: Code manquant
- `401 Unauthorized`: Code invalide
- `404 Not Found`: 2FA non configuré (pas de secret)

**Notes:**
- Les codes de récupération sont hashés avec bcrypt avant stockage
- Chaque code de récupération ne peut être utilisé qu'une seule fois
- **Conservez les codes de récupération en lieu sûr**

---

### POST `/api/auth/2fa/disable`

Désactive le 2FA pour l'utilisateur. Nécessite le mot de passe et un code 2FA valide.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "password": "YourPassword123!",
  "code": "123456"  // Code TOTP ou code de récupération
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Champs manquants
- `401 Unauthorized`: Mot de passe ou code invalide
- `404 Not Found`: 2FA non activé

---

## Role-Based Access Control (RBAC)

### Roles Management

#### GET `/api/roles`

Liste tous les rôles avec statistiques.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Required Permission:** `roles:read`

**Success Response (200 OK):**
```json
{
  "roles": [
    {
      "id": "role-id",
      "name": "ADMIN",
      "description": "Administrator role",
      "isSystem": true,
      "createdAt": "2025-01-09T10:00:00.000Z",
      "updatedAt": "2025-01-09T10:00:00.000Z",
      "_count": {
        "users": 5,
        "permissions": 31
      }
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Token manquant ou invalide
- `403 Forbidden`: Permission insuffisante

---

#### POST `/api/roles`

Crée un nouveau rôle.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `roles:create`

**Body:**
```json
{
  "name": "CUSTOM_MANAGER",
  "description": "Custom manager role for specific operations",
  "isSystem": false  // Optionnel, défaut: false
}
```

**Success Response (201 Created):**
```json
{
  "role": {
    "id": "new-role-id",
    "name": "CUSTOM_MANAGER",
    "description": "Custom manager role for specific operations",
    "isSystem": false,
    "createdAt": "2025-01-09T10:00:00.000Z",
    "updatedAt": "2025-01-09T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Nom du rôle manquant
- `403 Forbidden`: Permission insuffisante
- `409 Conflict`: Un rôle avec ce nom existe déjà

---

#### GET `/api/roles/[id]`

Récupère les détails d'un rôle spécifique avec ses permissions.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Required Permission:** `roles:read`

**Success Response (200 OK):**
```json
{
  "role": {
    "id": "role-id",
    "name": "MANAGER",
    "description": "Manager role",
    "isSystem": true,
    "createdAt": "2025-01-09T10:00:00.000Z",
    "updatedAt": "2025-01-09T10:00:00.000Z",
    "permissions": [
      {
        "id": "perm-id",
        "code": "vehicles:read",
        "name": "Read Vehicle",
        "description": "Can read vehicle information",
        "module": "vehicles",
        "action": "read",
        "resource": "vehicle"
      }
    ],
    "_count": {
      "users": 10
    }
  }
}
```

**Error Responses:**
- `403 Forbidden`: Permission insuffisante
- `404 Not Found`: Rôle introuvable

---

#### PATCH `/api/roles/[id]`

Met à jour un rôle (nom et/ou description uniquement).

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `roles:update`

**Body:**
```json
{
  "name": "SENIOR_MANAGER",  // Optionnel
  "description": "Senior manager with extended privileges"  // Optionnel
}
```

**Success Response (200 OK):**
```json
{
  "role": {
    "id": "role-id",
    "name": "SENIOR_MANAGER",
    "description": "Senior manager with extended privileges",
    "isSystem": false,
    "createdAt": "2025-01-09T10:00:00.000Z",
    "updatedAt": "2025-01-09T10:30:00.000Z",
    "_count": {
      "users": 10,
      "permissions": 15
    }
  }
}
```

**Error Responses:**
- `403 Forbidden`: Permission insuffisante ou tentative de modification d'un rôle système
- `404 Not Found`: Rôle introuvable
- `409 Conflict`: Le nouveau nom existe déjà

**Notes:**
- Les rôles système (`isSystem: true`) ne peuvent pas être modifiés
- SUPER_ADMIN, ADMIN, MANAGER, SALES, USER sont des rôles système

---

#### DELETE `/api/roles/[id]`

Supprime un rôle.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Required Permission:** `roles:delete`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

**Error Responses:**
- `403 Forbidden`: Permission insuffisante ou tentative de suppression d'un rôle système
- `404 Not Found`: Rôle introuvable
- `409 Conflict`: Le rôle est assigné à des utilisateurs

**Notes:**
- Un rôle ne peut pas être supprimé s'il est assigné à au moins un utilisateur
- Les rôles système ne peuvent pas être supprimés

---

### Role Permissions Management

#### POST `/api/roles/[id]/permissions`

Assigne des permissions à un rôle.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `roles:update`

**Body:**
```json
{
  "permissionIds": [
    "permission-id-1",
    "permission-id-2",
    "permission-id-3"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "3 permission(s) assigned to role",
  "role": {
    "id": "role-id",
    "name": "CUSTOM_MANAGER",
    "description": "Custom manager role",
    "isSystem": false,
    "permissions": [
      {
        "id": "permission-id-1",
        "code": "vehicles:read",
        "name": "Read Vehicle",
        "..."
      }
    ],
    "_count": {
      "permissions": 3
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: `permissionIds` manquant ou vide
- `403 Forbidden`: Permission insuffisante ou rôle système
- `404 Not Found`: Rôle ou une ou plusieurs permissions introuvables

**Notes:**
- Les permissions déjà assignées sont ignorées (upsert)
- Le cache des permissions est vidé pour tous les utilisateurs ayant ce rôle

---

#### DELETE `/api/roles/[id]/permissions`

Révoque des permissions d'un rôle.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `roles:update`

**Body:**
```json
{
  "permissionIds": [
    "permission-id-1",
    "permission-id-2"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "2 permission(s) revoked from role",
  "role": {
    "id": "role-id",
    "name": "CUSTOM_MANAGER",
    "permissions": [
      "..."
    ],
    "_count": {
      "permissions": 1
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: `permissionIds` manquant ou vide
- `403 Forbidden`: Permission insuffisante ou rôle système
- `404 Not Found`: Rôle introuvable

---

### Permissions Management

#### GET `/api/permissions`

Liste toutes les permissions disponibles.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Required Permission:** `permissions:read`

**Query Parameters:**
- `module` (optionnel): Filtrer par module (ex: `vehicles`, `customers`)

**Success Response (200 OK):**
```json
{
  "permissions": [
    {
      "id": "perm-id",
      "code": "vehicles:create",
      "name": "Create Vehicle",
      "description": "Can create new vehicles",
      "module": "vehicles",
      "action": "create",
      "resource": "vehicle",
      "createdAt": "2025-01-09T10:00:00.000Z",
      "updatedAt": "2025-01-09T10:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `403 Forbidden`: Permission insuffisante

---

#### POST `/api/permissions`

Crée une nouvelle permission.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `permissions:create`

**Body:**
```json
{
  "code": "invoices:export",
  "name": "Export Invoices",
  "description": "Can export invoices to PDF/Excel",
  "module": "invoices",
  "action": "export",
  "resource": "invoice"
}
```

**Success Response (201 Created):**
```json
{
  "permission": {
    "id": "new-perm-id",
    "code": "invoices:export",
    "name": "Export Invoices",
    "description": "Can export invoices to PDF/Excel",
    "module": "invoices",
    "action": "export",
    "resource": "invoice",
    "createdAt": "2025-01-09T10:00:00.000Z",
    "updatedAt": "2025-01-09T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Champs requis manquants
- `403 Forbidden`: Permission insuffisante
- `409 Conflict`: Une permission avec ce code existe déjà

**Notes:**
- Le `code` doit être unique et suivre le format `module:action`
- Les champs `module`, `action`, et `resource` sont requis

---

### User Roles Assignment

#### GET `/api/users/[id]/roles`

Récupère tous les rôles assignés à un utilisateur.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Required Permission:** `users:read` (sauf pour consulter ses propres rôles)

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "roles": [
    {
      "id": "role-id",
      "name": "MANAGER",
      "description": "Manager role",
      "isSystem": true,
      "assignedAt": "2025-01-09T10:00:00.000Z",
      "permissions": [
        {
          "id": "perm-id",
          "code": "vehicles:read",
          "..."
        }
      ],
      "_count": {
        "permissions": 15
      }
    }
  ]
}
```

**Error Responses:**
- `403 Forbidden`: Permission insuffisante
- `404 Not Found`: Utilisateur introuvable

---

#### POST `/api/users/[id]/roles`

Assigne des rôles à un utilisateur.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `users:update`

**Body:**
```json
{
  "roleIds": [
    "role-id-1",
    "role-id-2"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "2 role(s) assigned to user",
  "roles": [
    {
      "id": "role-id-1",
      "name": "MANAGER",
      "description": "Manager role",
      "isSystem": true,
      "assignedAt": "2025-01-09T10:00:00.000Z",
      "_count": {
        "permissions": 15
      }
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: `roleIds` manquant ou vide
- `403 Forbidden`: Permission insuffisante
- `404 Not Found`: Utilisateur ou un ou plusieurs rôles introuvables

**Notes:**
- Les rôles déjà assignés sont mis à jour avec la nouvelle date d'assignation
- Le cache des permissions est vidé pour cet utilisateur

---

#### DELETE `/api/users/[id]/roles`

Révoque des rôles d'un utilisateur.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Required Permission:** `users:update`

**Body:**
```json
{
  "roleIds": [
    "role-id-1"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "1 role(s) revoked from user",
  "roles": [
    "..."
  ]
}
```

**Error Responses:**
- `400 Bad Request`: `roleIds` manquant ou vide
- `403 Forbidden`: Permission insuffisante ou tentative de retirer ses propres rôles
- `404 Not Found`: Utilisateur introuvable

**Notes:**
- Un utilisateur ne peut pas retirer ses propres rôles
- Le cache des permissions est vidé pour cet utilisateur

---

## Permissions par défaut

### Modules disponibles

| Module | Permissions | Description |
|--------|------------|-------------|
| `vehicles` | create, read, update, delete, publish | Gestion des véhicules |
| `customers` | create, read, update, delete | Gestion des clients |
| `leads` | create, read, update, delete, convert | Gestion des prospects |
| `suppliers` | create, read, update, delete | Gestion des fournisseurs |
| `users` | create, read, update, delete | Gestion des utilisateurs |
| `roles` | create, read, update, delete | Gestion des rôles |
| `permissions` | create, read | Gestion des permissions |
| `reports` | read, export | Rapports et exports |
| `*` | * | Super Admin (toutes permissions) |

### Rôles par défaut

| Rôle | Permissions |
|------|------------|
| `SUPER_ADMIN` | `*:*` (toutes les permissions) |
| `ADMIN` | Toutes sauf création/suppression d'utilisateurs |
| `MANAGER` | Lecture/modification véhicules, gestion clients/leads |
| `SALES` | Lecture véhicules, gestion clients/leads |
| `USER` | Lecture seulement (véhicules, clients, leads) |

---

## Codes d'erreur

| Code | Signification |
|------|--------------|
| 200 | Succès |
| 201 | Créé avec succès |
| 400 | Requête invalide (données manquantes ou incorrectes) |
| 401 | Non authentifié (token manquant ou invalide) |
| 403 | Accès interdit (permissions insuffisantes) |
| 404 | Ressource introuvable |
| 409 | Conflit (ressource existe déjà ou assignée) |
| 500 | Erreur serveur interne |

---

## Notes de sécurité

1. **Tokens JWT**: Expiration de 15 minutes pour l'access token
2. **Refresh Tokens**: Expiration de 30 jours avec rotation automatique
3. **2FA**: Codes TOTP avec fenêtre de tolérance de 2 intervalles (±60s)
4. **Codes de récupération**: Hashés avec bcrypt, usage unique
5. **Permissions Cache**: TTL de 5 minutes, invalidation lors de modifications
6. **Rôles système**: Protection contre modification/suppression
7. **Auto-assignation**: Impossibilité de modifier ses propres rôles

---

## Exemples d'utilisation

### Workflow complet d'authentification avec 2FA

```bash
# 1. Connexion initiale
curl -X POST http://localhost:3000/api/auth/signin \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@ibticar.ai","password":"Password123!"}'

# Réponse: { "requires2FA": true, "message": "..." }

# 2. Connexion avec code 2FA
curl -X POST http://localhost:3000/api/auth/signin \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@ibticar.ai","password":"Password123!","twoFactorCode":"123456"}'

# Réponse: { "token": "...", "refreshToken": "..." }
```

### Gestion des rôles

```bash
# 1. Créer un rôle personnalisé
curl -X POST http://localhost:3000/api/roles \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"FLEET_MANAGER","description":"Gestionnaire de flotte"}'

# 2. Assigner des permissions au rôle
curl -X POST http://localhost:3000/api/roles/<role-id>/permissions \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"permissionIds":["perm-1","perm-2"]}'

# 3. Assigner le rôle à un utilisateur
curl -X POST http://localhost:3000/api/users/<user-id>/roles \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"roleIds":["<role-id>"]}'
```

---

## Support

Pour toute question ou problème, consultez:
- La documentation technique dans `CLAUDE.md`
- Les tests dans `src/__tests__/`
- Le script de test Phase 3: `test-phase3-auth.mjs`
