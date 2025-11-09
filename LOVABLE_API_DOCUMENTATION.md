# 📡 Ibticar.AI - Documentation API pour Lovable

**Version:** 1.0
**Date:** 2025-01-09
**Backend:** Next.js 16 API Routes
**Déploiement:** Vercel

---

## 🌐 Configuration de Base

### URL de Base (Production - Vercel)
```
Base URL: https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/api
```

### URL Locale (Développement)
```
Base URL: http://localhost:3000/api
```

### Headers Requis

**Pour toutes les requêtes :**
```http
Content-Type: application/json
```

**Pour les requêtes authentifiées :**
```http
Authorization: Bearer {access_token}
```

---

## 🔐 Authentication Flow

### 1. Connexion (Sign In)

**Endpoint:** `POST /auth/signin`

**Request:**
```json
{
  "email": "admin@ibticar.ai",
  "password": "Password123!"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@ibticar.ai",
      "name": "Admin User",
      "role": "ADMIN"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Response Error (401):**
```json
{
  "error": "Invalid credentials"
}
```

---

### 2. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 900
  }
}
```

**Utilisation dans Lovable:**
```typescript
// Store tokens
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);

// Auto-refresh avant expiration (15 min)
setInterval(() => {
  refreshAccessToken();
}, 14 * 60 * 1000); // Refresh à 14 min
```

---

### 3. Get Current User

**Endpoint:** `GET /auth/me`

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@ibticar.ai",
    "name": "Admin User",
    "role": "ADMIN",
    "permissions": ["*:*"]
  }
}
```

---

### 4. Two-Factor Authentication (2FA)

#### 4.1 Setup 2FA

**Endpoint:** `POST /auth/2fa/setup`

**Headers:** Authorization required

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "backupCodes": [
      "ABC123DEF456",
      "GHI789JKL012",
      // ... 8 more codes
    ]
  }
}
```

#### 4.2 Verify 2FA

**Endpoint:** `POST /auth/2fa/verify`

**Request:**
```json
{
  "token": "123456"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "2FA enabled successfully"
}
```

#### 4.3 Disable 2FA

**Endpoint:** `POST /auth/2fa/disable`

**Request:**
```json
{
  "token": "123456"
}
```

---

## 👥 Users Management

### 1. List Users

**Endpoint:** `GET /users?page=1&limit=10&search=john`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name or email

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "MANAGER",
      "status": "ACTIVE",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

### 2. Get User Details

**Endpoint:** `GET /users/{id}`

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+213555123456",
    "role": "MANAGER",
    "status": "ACTIVE",
    "teamId": "team-uuid",
    "twoFactorEnabled": false,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### 3. Create User

**Endpoint:** `POST /users`

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "password": "SecurePass123!",
  "phone": "+213555123456",
  "role": "USER",
  "teamId": "team-uuid"
}
```

**Response Success (201):**
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "email": "newuser@example.com",
    "name": "Jane Smith"
  }
}
```

---

### 4. Update User

**Endpoint:** `PATCH /users/{id}`

**Request:**
```json
{
  "name": "Jane Doe",
  "phone": "+213555999888"
}
```

---

### 5. Delete User

**Endpoint:** `DELETE /users/{id}`

**Response Success (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🔑 Roles & Permissions

### 1. List Roles

**Endpoint:** `GET /roles`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Super Admin",
      "description": "Full system access",
      "isSystem": true,
      "permissionsCount": 22,
      "usersCount": 1
    }
  ]
}
```

---

### 2. Get Role Details

**Endpoint:** `GET /roles/{id}`

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Manager",
    "description": "Team manager",
    "isSystem": true,
    "permissions": [
      {
        "id": "perm-uuid",
        "code": "vehicles:view",
        "name": "Voir véhicules"
      }
    ],
    "usersCount": 5
  }
}
```

---

### 3. Create Role

**Endpoint:** `POST /roles`

**Request:**
```json
{
  "name": "Custom Role",
  "description": "Custom role description"
}
```

---

### 4. Update Role

**Endpoint:** `PATCH /roles/{id}`

**Request:**
```json
{
  "name": "Updated Role Name",
  "description": "Updated description"
}
```

**Note:** Cannot update system roles (isSystem: true)

---

### 5. Delete Role

**Endpoint:** `DELETE /roles/{id}`

**Note:** Cannot delete system roles or roles with assigned users

---

### 6. Assign Permissions to Role

**Endpoint:** `POST /roles/{id}/permissions`

**Request:**
```json
{
  "permissionIds": [
    "perm-uuid-1",
    "perm-uuid-2"
  ]
}
```

---

### 7. Revoke Permissions from Role

**Endpoint:** `DELETE /roles/{id}/permissions`

**Request:**
```json
{
  "permissionIds": ["perm-uuid-1"]
}
```

---

### 8. List All Permissions

**Endpoint:** `GET /permissions`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "vehicles:view",
      "name": "Voir véhicules",
      "module": "stock",
      "action": "view",
      "resource": "vehicles"
    }
  ]
}
```

---

### 9. User Role Management

#### Assign Roles to User
**Endpoint:** `POST /users/{id}/roles`

**Request:**
```json
{
  "roleIds": ["role-uuid-1", "role-uuid-2"]
}
```

#### Get User Roles
**Endpoint:** `GET /users/{id}/roles`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role-uuid",
      "name": "Manager",
      "permissions": [...]
    }
  ]
}
```

#### Revoke Roles from User
**Endpoint:** `DELETE /users/{id}/roles`

**Request:**
```json
{
  "roleIds": ["role-uuid-1"]
}
```

---

## 🚗 Vehicles Management

### 1. List Vehicles

**Endpoint:** `GET /vehicles?status=AVAILABLE&page=1&limit=10`

**Query Parameters:**
- `status` (optional): AVAILABLE, RESERVED, SOLD, IN_TRANSIT
- `brandId` (optional): Filter by brand
- `modelId` (optional): Filter by model
- `minPrice` / `maxPrice` (optional): Price range
- `page`, `limit`: Pagination

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "vin": "1HGBH41JXMN109186",
      "year": 2023,
      "mileage": 15000,
      "condition": "EXCELLENT",
      "color": "Black",
      "purchasePrice": 2000000,
      "sellingPrice": 2500000,
      "status": "AVAILABLE",
      "model": {
        "id": "model-uuid",
        "name": "Corolla",
        "brand": {
          "id": "brand-uuid",
          "name": "Toyota"
        }
      },
      "features": ["GPS", "Leather Seats", "Sunroof"],
      "media": [
        {
          "id": "media-uuid",
          "url": "https://...",
          "type": "IMAGE",
          "isPrimary": true
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150
  }
}
```

---

### 2. Get Vehicle Details

**Endpoint:** `GET /vehicles/{id}`

**Response:** Same structure as list item but with full details

---

### 3. Create Vehicle

**Endpoint:** `POST /vehicles`

**Request:**
```json
{
  "vin": "1HGBH41JXMN109186",
  "modelId": "model-uuid",
  "year": 2023,
  "mileage": 15000,
  "condition": "EXCELLENT",
  "color": "Black",
  "purchasePrice": 2000000,
  "sellingPrice": 2500000,
  "status": "AVAILABLE",
  "features": ["GPS", "Leather Seats"],
  "description": "Excellent condition Toyota Corolla"
}
```

---

### 4. Update Vehicle

**Endpoint:** `PATCH /vehicles/{id}`

**Request:**
```json
{
  "sellingPrice": 2400000,
  "status": "RESERVED",
  "mileage": 15500
}
```

---

### 5. Delete Vehicle

**Endpoint:** `DELETE /vehicles/{id}`

---

## 👤 Customers Management

### 1. List Customers

**Endpoint:** `GET /customers?type=INDIVIDUAL&page=1`

**Query Parameters:**
- `type` (optional): INDIVIDUAL, COMPANY
- `search` (optional): Search by name, email, phone

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "customer@example.com",
      "phone": "+213555123456",
      "type": "INDIVIDUAL",
      "firstName": "Ahmed",
      "lastName": "Benali",
      "address": "Algiers, Algeria",
      "preferences": {
        "bodyType": "SUV",
        "budget": 3000000
      }
    }
  ]
}
```

---

### 2. Get Customer Details

**Endpoint:** `GET /customers/{id}`

---

### 3. Create Customer

**Endpoint:** `POST /customers`

**Request:**
```json
{
  "email": "customer@example.com",
  "phone": "+213555123456",
  "type": "INDIVIDUAL",
  "firstName": "Ahmed",
  "lastName": "Benali",
  "address": "Algiers, Algeria",
  "preferences": {
    "bodyType": "SUV",
    "budget": 3000000
  }
}
```

---

### 4. Update Customer

**Endpoint:** `PATCH /customers/{id}`

---

### 5. Delete Customer

**Endpoint:** `DELETE /customers/{id}`

---

## 🎯 Leads Management

### 1. List Leads

**Endpoint:** `GET /leads?status=NEW&source=WEBSITE`

**Query Parameters:**
- `status`: NEW, CONTACTED, QUALIFIED, CONVERTED, LOST
- `source`: WEBSITE, PHONE, EMAIL, SOCIAL, REFERRAL, WALK_IN

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "firstName": "Fatima",
      "lastName": "Kaddour",
      "email": "fatima@example.com",
      "phone": "+213555999888",
      "source": "WEBSITE",
      "status": "NEW",
      "interestedIn": "SUV under 3M DZD",
      "assignedToId": "user-uuid",
      "createdAt": "2025-01-09T10:00:00Z"
    }
  ]
}
```

---

### 2. Get Lead Details

**Endpoint:** `GET /leads/{id}`

---

### 3. Create Lead

**Endpoint:** `POST /leads`

**Request:**
```json
{
  "firstName": "Fatima",
  "lastName": "Kaddour",
  "email": "fatima@example.com",
  "phone": "+213555999888",
  "source": "WEBSITE",
  "interestedIn": "SUV under 3M DZD"
}
```

---

### 4. Update Lead

**Endpoint:** `PATCH /leads/{id}`

**Request:**
```json
{
  "status": "CONTACTED",
  "assignedToId": "user-uuid",
  "notes": "Called customer, interested in test drive"
}
```

---

### 5. Delete Lead

**Endpoint:** `DELETE /leads/{id}`

---

## 🏢 Brands & Models

### 1. List Brands

**Endpoint:** `GET /brands`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Toyota",
      "country": "Japan",
      "logo": "https://...",
      "modelsCount": 15
    }
  ]
}
```

---

### 2. List Models

**Endpoint:** `GET /models?brandId=brand-uuid`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Corolla",
      "brandId": "brand-uuid",
      "bodyType": "SEDAN",
      "fuelType": "Gasoline",
      "transmission": "Automatic",
      "seatingCapacity": 5,
      "engineSize": 1.8
    }
  ]
}
```

---

## 🏭 Suppliers Management

### 1. List Suppliers

**Endpoint:** `GET /suppliers`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Import Auto Algeria",
      "email": "contact@importauto.dz",
      "phone": "+213555111222",
      "country": "Algeria",
      "status": "ACTIVE",
      "rating": 4.5
    }
  ]
}
```

---

### 2. Get Supplier Details

**Endpoint:** `GET /suppliers/{id}`

---

### 3. Create Supplier

**Endpoint:** `POST /suppliers`

**Request:**
```json
{
  "name": "Import Auto Algeria",
  "email": "contact@importauto.dz",
  "phone": "+213555111222",
  "country": "Algeria",
  "address": "Algiers, Algeria"
}
```

---

### 4. Update Supplier

**Endpoint:** `PATCH /suppliers/{id}`

---

### 5. Delete Supplier

**Endpoint:** `DELETE /suppliers/{id}`

---

## 📦 Stock Transfers

### 1. List Transfers

**Endpoint:** `GET /stock/transfers?status=PENDING`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "vehicleId": "vehicle-uuid",
      "fromLocationId": "location-uuid-1",
      "toLocationId": "location-uuid-2",
      "status": "PENDING",
      "initiatedById": "user-uuid",
      "scheduledDate": "2025-01-15T00:00:00Z",
      "notes": "Transfer to showroom"
    }
  ]
}
```

---

### 2. Get Transfer Details

**Endpoint:** `GET /stock/transfers/{id}`

---

### 3. Create Transfer

**Endpoint:** `POST /stock/transfers`

**Request:**
```json
{
  "vehicleId": "vehicle-uuid",
  "fromLocationId": "location-uuid-1",
  "toLocationId": "location-uuid-2",
  "scheduledDate": "2025-01-15",
  "notes": "Transfer to showroom"
}
```

---

### 4. Update Transfer Status

**Endpoint:** `PATCH /stock/transfers/{id}`

**Request:**
```json
{
  "status": "IN_TRANSIT"
}
```

---

### 5. Cancel Transfer

**Endpoint:** `DELETE /stock/transfers/{id}`

---

## 🤖 AI Features

### 1. Vehicle Recommendations

**Endpoint:** `POST /ai/recommendations`

**Request:**
```json
{
  "customerId": "customer-uuid",
  "budget": 3000000,
  "preferences": {
    "bodyType": "SUV",
    "fuelType": "Diesel",
    "transmission": "Automatic",
    "minSeats": 5,
    "maxMileage": 100000
  }
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "vehicleId": "vehicle-uuid",
        "score": 95,
        "reasoning": "Perfect match: SUV, Diesel, within budget...",
        "matchedPreferences": [
          "bodyType",
          "fuelType",
          "budget"
        ],
        "potentialConcerns": [
          "Mileage slightly higher than preferred"
        ]
      }
    ],
    "explanation": "Based on your preferences, we found 3 excellent matches...",
    "generatedAt": "2025-01-09T10:00:00Z"
  }
}
```

---

### 2. Get Stored Recommendations

**Endpoint:** `GET /ai/recommendations?customerId=uuid&limit=10`

---

### 3. Rotation Prediction

**Endpoint:** `POST /ai/rotation`

**Request:**
```json
{
  "vehicleId": "vehicle-uuid",
  "includeMarketAnalysis": true
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "vehicleId": "vehicle-uuid",
    "predictedDays": 30,
    "confidence": 0.85,
    "riskLevel": "medium",
    "reasoning": "Based on similar vehicles, this should sell in 30 days...",
    "influencingFactors": {
      "positive": [
        "Popular brand",
        "Competitive pricing",
        "Low mileage"
      ],
      "negative": [
        "Peak season passed",
        "High inventory of similar models"
      ]
    },
    "recommendations": [
      "Consider 5% price reduction to accelerate sale",
      "Highlight fuel efficiency in marketing"
    ],
    "priceAdjustmentSuggestion": {
      "currentPrice": 2500000,
      "suggestedPrice": 2375000,
      "expectedImpact": "Could reduce sale time by 10-15 days"
    },
    "comparisonToMarket": "Slightly above market average",
    "generatedAt": "2025-01-09T10:00:00Z"
  }
}
```

---

### 4. Get Stored Predictions

**Endpoint:** `GET /ai/rotation?vehicleId=uuid&limit=5`

---

### 5. Dynamic Pricing

**Endpoint:** `POST /ai/pricing`

**Request:**
```json
{
  "vehicleId": "vehicle-uuid",
  "includeMarketAnalysis": true,
  "businessObjectives": {
    "targetMargin": 15,
    "urgencyLevel": "medium",
    "targetRotationDays": 30
  }
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "vehicleId": "vehicle-uuid",
    "currentPrice": 2500000,
    "recommendations": {
      "optimal": {
        "price": 2450000,
        "reasoning": "Balanced approach for best margin with reasonable rotation",
        "expectedDaysToSell": 30,
        "profitMargin": 15.5,
        "confidence": 0.8
      },
      "quick_sale": {
        "price": 2300000,
        "reasoning": "Aggressive pricing to sell within 2 weeks",
        "expectedDaysToSell": 14,
        "profitMargin": 10.2,
        "confidence": 0.9
      },
      "maximum_profit": {
        "price": 2700000,
        "reasoning": "Premium positioning for patient seller",
        "expectedDaysToSell": 60,
        "profitMargin": 22.0,
        "confidence": 0.6
      }
    },
    "marketPosition": {
      "currentPosition": "Slightly above market average",
      "competitiveAdvantage": ["Lower mileage", "Premium features"],
      "competitiveDisadvantage": ["Older model year"],
      "pricePercentile": 65
    },
    "adjustmentRecommendation": {
      "action": "reduce",
      "amount": -50000,
      "percentage": -2.0,
      "urgency": "medium",
      "reasoning": "Vehicle priced above market with increasing inventory time"
    },
    "pricingStrategy": {
      "primary": "Value-based pricing recommended",
      "tactics": [
        "Highlight fuel efficiency",
        "Bundle extended warranty"
      ],
      "timing": "Consider adjustment within 7 days"
    },
    "riskAnalysis": {
      "overpricing": {
        "risk": "medium",
        "impact": "May remain in inventory 30+ additional days"
      },
      "underpricing": {
        "risk": "low",
        "impact": "Potential 100,000 DZD profit loss"
      }
    },
    "generatedAt": "2025-01-09T10:00:00Z"
  }
}
```

---

### 6. Apply Pricing Recommendation

**Endpoint:** `PATCH /ai/pricing`

**Request:**
```json
{
  "vehicleId": "vehicle-uuid",
  "recommendationId": "recommendation-uuid",
  "scenario": "optimal"
}
```

**Note:** Requires both `ai:pricing` AND `vehicles:update` permissions

---

### 7. Get Stored Pricing Recommendations

**Endpoint:** `GET /ai/pricing?vehicleId=uuid&limit=5`

---

## 📊 Analytics

### Dashboard Summary

**Endpoint:** `GET /analytics/dashboard`

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "totalVehicles": 150,
    "availableVehicles": 120,
    "soldThisMonth": 15,
    "totalRevenue": 45000000,
    "activeLeads": 45,
    "convertedLeads": 12,
    "averageRotationDays": 32,
    "topSellingBrand": "Toyota"
  }
}
```

---

## ⚠️ Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional details (optional)",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., email) |
| 500 | Server Error | Internal server error |

### Common Error Scenarios

**Token Expired (401):**
```json
{
  "error": "Token expired",
  "code": "TOKEN_EXPIRED"
}
```
➡️ **Action:** Refresh token using `/auth/refresh`

**Insufficient Permissions (403):**
```json
{
  "error": "Forbidden",
  "details": "You don't have permission to perform this action"
}
```
➡️ **Action:** Check user roles/permissions

**Validation Error (400):**
```json
{
  "error": "Validation failed",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  }
}
```

---

## 🔗 Intégration Lovable - Exemples de Code

### 1. Configuration API Client

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(authenticated: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authenticated) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authenticated: boolean = true
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: this.getHeaders(authenticated),
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Handle token expiration
      if (response.status === 401 && data.code === 'TOKEN_EXPIRED') {
        await this.refreshToken();
        // Retry request
        return this.request<T>(endpoint, options, authenticated);
      }

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string, authenticated: boolean = true) {
    return this.request<T>(endpoint, { method: 'GET' }, authenticated);
  }

  async post<T>(endpoint: string, body: any, authenticated: boolean = true) {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      authenticated
    );
  }

  async patch<T>(endpoint: string, body: any, authenticated: boolean = true) {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
      authenticated
    );
  }

  async delete<T>(endpoint: string, authenticated: boolean = true) {
    return this.request<T>(endpoint, { method: 'DELETE' }, authenticated);
  }

  async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken },
      false
    );

    if (response.success) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
  }
}

export const api = new ApiClient(API_BASE_URL);
```

---

### 2. Auth Hook

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.get<User>('/auth/me');
      if (response.success) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }

  async function signin(email: string, password: string) {
    const response = await api.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/signin', { email, password }, false);

    if (response.success) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      setUser(response.data.user);
      return response.data;
    }

    throw new Error('Signin failed');
  }

  function signout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signin,
    signout,
  };
}
```

---

### 3. Vehicles API Hook

```typescript
// hooks/useVehicles.ts
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Vehicle {
  id: string;
  vin: string;
  year: number;
  sellingPrice: number;
  status: string;
  model: {
    name: string;
    brand: {
      name: string;
    };
  };
}

export function useVehicles(filters?: {
  status?: string;
  brandId?: string;
  page?: number;
  limit?: number;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    fetchVehicles();
  }, [filters]);

  async function fetchVehicles() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.brandId) params.append('brandId', filters.brandId);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await api.get<Vehicle[]>(
        `/vehicles?${params.toString()}`
      );

      if (response.success) {
        setVehicles(response.data);
        // @ts-ignore
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    } finally {
      setLoading(false);
    }
  }

  return {
    vehicles,
    loading,
    pagination,
    refetch: fetchVehicles,
  };
}
```

---

## 🧪 Test Users

**Super Admin:**
```
Email: admin@ibticar.ai
Password: Password123!
Permissions: *:* (all)
```

**Manager:**
```
Email: manager@dealer.com
Password: Password123!
Permissions: Limited to team management
```

**Sales:**
```
Email: commercial@dealer.com
Password: Password123!
Permissions: Basic sales operations
```

---

## 📝 Notes Importantes

1. **Token Refresh:**
   Les access tokens expirent après 15 minutes. Implémentez un auto-refresh ou rafraîchissez lors des erreurs 401.

2. **CORS:**
   Le CORS est configuré pour accepter les requêtes depuis n'importe quelle origine en développement.

3. **Environment Variables:**
   Configurez `NEXT_PUBLIC_API_URL` dans votre projet Lovable pour pointer vers votre déploiement Vercel.

4. **Rate Limiting:**
   Aucune limite actuellement implémentée. À considérer pour production.

5. **Permissions:**
   Vérifiez les permissions requises pour chaque endpoint dans la réponse 403.

6. **Pagination:**
   Tous les endpoints de liste supportent `page` et `limit` query params.

---

## 🚀 Quick Start pour Lovable

**1. Configurer l'URL API:**
```typescript
// .env.local dans Lovable
NEXT_PUBLIC_API_URL=https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/api
```

**2. Installer le client API:**
Copier le code du client API fourni ci-dessus dans `lib/api.ts`

**3. Tester l'authentification:**
```typescript
const response = await api.post('/auth/signin', {
  email: 'admin@ibticar.ai',
  password: 'Password123!'
});
```

**4. Utiliser les hooks:**
```typescript
import { useAuth } from '@/hooks/useAuth';

function App() {
  const { user, isAuthenticated, signin } = useAuth();
  // ...
}
```

---

**Support:** Pour toute question, consultez ROADMAP.md ou créez un ticket GitHub.

**Version:** 1.0 - Dernière mise à jour: 2025-01-09
