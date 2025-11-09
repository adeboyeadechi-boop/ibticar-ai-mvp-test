# Script de test des APIs Vercel (PowerShell)
# Usage: .\test-vercel-api.ps1

# Configuration
$BASE_URL = "https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/api"
$ADMIN_EMAIL = "admin@ibticar.ai"
$ADMIN_PASSWORD = "Password123!"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "🧪 Tests API Backend Vercel" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Test 1: Page d'accueil
Write-Host "Test 1: Page d'accueil" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ SUCCÈS - Code: $($response.StatusCode)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ ÉCHEC - Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
Write-Host ""

# Test 2: GET /api/auth/me (sans token)
Write-Host "Test 2: GET /api/auth/me (sans token)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/auth/me" -Method GET -Headers @{"Content-Type"="application/json"} -UseBasicParsing
    Write-Host "⚠️  INATTENDU - Code: $($response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Réponse: $($response.Content)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "✅ SUCCÈS - Code: 401 (Unauthorized attendu)" -ForegroundColor Green
    } elseif ($statusCode -eq 404) {
        Write-Host "❌ ÉCHEC - Code: 404 (Route non trouvée)" -ForegroundColor Red
        Write-Host "Problème: L'endpoint n'existe pas sur Vercel"
    } else {
        Write-Host "❌ ÉCHEC - Code: $statusCode" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: POST /api/auth/signin
Write-Host "Test 3: POST /api/auth/signin" -ForegroundColor Yellow
$body = @{
    email = $ADMIN_EMAIL
    password = $ADMIN_PASSWORD
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/auth/signin" -Method POST -Body $body -Headers @{"Content-Type"="application/json"} -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ SUCCÈS - Code: $($response.StatusCode)" -ForegroundColor Green
        $jsonResponse = $response.Content | ConvertFrom-Json
        Write-Host "Réponse: $($response.Content)"

        $ACCESS_TOKEN = $jsonResponse.data.accessToken
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "❌ ÉCHEC - Code: 401 (Credentials invalides)" -ForegroundColor Red
    } elseif ($statusCode -eq 404) {
        Write-Host "❌ ÉCHEC - Code: 404 (Route non trouvée)" -ForegroundColor Red
        Write-Host "Problème: L'endpoint n'existe pas sur Vercel"
    } elseif ($statusCode -eq 405) {
        Write-Host "❌ ÉCHEC - Code: 405 (Method Not Allowed)" -ForegroundColor Red
        Write-Host "Problème: La méthode POST n'est pas supportée"
    } else {
        Write-Host "❌ ÉCHEC - Code: $statusCode" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: GET /api/auth/me (avec token)
if ($ACCESS_TOKEN) {
    Write-Host "Test 4: GET /api/auth/me (avec token)" -ForegroundColor Yellow
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $ACCESS_TOKEN"
        }
        $response = Invoke-WebRequest -Uri "$BASE_URL/auth/me" -Method GET -Headers $headers -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ SUCCÈS - Code: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Réponse: $($response.Content)"
        }
    } catch {
        Write-Host "❌ ÉCHEC - Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
    Write-Host ""

    # Test 5: GET /api/users (endpoint protégé)
    Write-Host "Test 5: GET /api/users (avec token)" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/users?limit=5" -Method GET -Headers $headers -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ SUCCÈS - Code: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Réponse: $($response.Content)"
        }
    } catch {
        Write-Host "❌ ÉCHEC - Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
    Write-Host ""

    # Test 6: GET /api/vehicles
    Write-Host "Test 6: GET /api/vehicles (avec token)" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/vehicles?limit=5" -Method GET -Headers $headers -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ SUCCÈS - Code: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Réponse: $($response.Content)"
        }
    } catch {
        Write-Host "❌ ÉCHEC - Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
    Write-Host ""
} else {
    Write-Host "⚠️  Tests avec authentification ignorés (pas de token)" -ForegroundColor Yellow
    Write-Host ""
}

# Résumé
Write-Host "========================================" -ForegroundColor Blue
Write-Host "📊 Résumé des Tests" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "✅ Si tous les tests passent, le backend est opérationnel"
Write-Host "❌ Si certains tests échouent avec 404/405, vérifier:"
Write-Host "   - Variables d'environnement sur Vercel"
Write-Host "   - Base de données configurée"
Write-Host "   - Logs de build Vercel"
Write-Host ""
Write-Host "📄 Rapport détaillé: VERCEL_TEST_REPORT.md"
