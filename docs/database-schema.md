# Database Schema - AgroConnect

## Collections Overview

### Companies Collection (`companies`)

Stores company information for businesses using the platform.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Company name |
| `subscriptionPlan` | string | Yes | One of: `Basic`, `Pro`, `Enterprise` |
| `status` | string | No | Company status (see normalization below) |
| `contactEmail` | string | Yes | Contact email |
| `adminEmail` | string | Yes | Administrator email |
| `rut` | string | No | Chilean tax ID (RUT) |
| `region` | string | No | Geographic region |
| `rubro` | string | No | Industry sector |
| `logoUrl` | string | No | Company logo URL |
| `isPublic` | boolean | No | Whether company profile is public |
| `hrName` | string | No | HR contact name |
| `hrPhone` | string | No | HR contact phone |
| `hrEmail` | string | No | HR contact email |
| `officialPhone` | string | No | Official company phone |
| `facebookLink` | string | No | Facebook profile link |
| `instagramLink` | string | No | Instagram profile link |
| `createdAt` | timestamp | No | Creation timestamp |
| `updatedAt` | timestamp | No | Last update timestamp |

#### Normalización de `status`

A partir de v1.1.0, todos los campos `status` usan **minúsculas**:
- `active` (antes: `Active`) - Empresa activa con pagos al día
- `pending` (antes: `Pending`) - Empresa pendiente de activación
- `suspended` (antes: `Suspended`) - Empresa suspendida
- `overdue` (antes: `Overdue`) - Empresa morosa
- `inactive` - Empresa inactiva

**Script de migración:** `scripts/migrate-status-lowercase.mjs`

**Uso del script:**
```bash
GOOGLE_APPLICATION_CREDENTIALS=./credentials/serviceAccountKey.json node scripts/migrate-status-lowercase.mjs
```

#### Índices

- `status` - Para consultas de filtrado por estado
- `subscriptionPlan` - Para consultas de filtrado por plan
- `region` - Para consultas de filtrado geográfico

### Jobs Subcollection (`companies/{companyId}/jobs`)

Stores job offers created by companies.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `title` | string | Yes | Job title |
| `description` | string | Yes | Job description |
| `workersNeeded` | number | Yes | Number of workers needed |
| `workersFilled` | number | Yes | Number of workers hired |
| `startDate` | string | Yes | Job start date (ISO format) |
| `location` | string | Yes | Job location |
| `coordinates` | object | Yes | Geographic coordinates (`lat`, `lng`) |
| `isActive` | boolean | Yes | Whether job is currently active |
| `jobStatus` | string | No | One of: `future`, `active`, `closed` |
| `category` | string | No | Job category |
| `paymentType` | string | No | Payment frequency |
| `publishPublic` | boolean | No | Whether job is publicly visible |
| `qrCodeUrl` | string | No | QR code for easy application |
| `createdAt` | timestamp | No | Creation timestamp |
| `updatedAt` | timestamp | No | Last update timestamp |

### Statistics Collections

#### Global Stats (`stats/global`)

Aggregated global statistics across the platform.

| Field | Type | Description |
|-------|------|-------------|
| `companiesTotal` | number | Total number of companies |
| `companiesActive` | number | Number of active companies |
| `companiesOverdue` | number | Number of overdue companies |
| `companiesSuspended` | number | Number of suspended companies |
| `companiesPending` | number | Number of pending companies |
| `updatedAt` | timestamp | Last update timestamp |

#### Monthly Stats (`stats_monthly/{YYYY-MM}`)

Monthly aggregated statistics.

#### Company Stats (`stats_companies/{companyId}`)

Per-company statistics.

## Migration History

### v1.1.0 - Status Field Normalization

**Date:** 2026-01-25

**Changes:**
- Normalized all `status` field values from capitalized to lowercase
- Updated TypeScript types in `src/types.ts`
- Updated Firebase Functions in `functions/src/index.ts`
- Updated React components in `src/components/`

**Migration:**
Run the migration script to update existing data:
```bash
GOOGLE_APPLICATION_CREDENTIALS=./credentials/serviceAccountKey.json node scripts/migrate-status-lowercase.mjs
```

**Benefits:**
- Simpler queries (no need for `in: ["active", "Active"]`)
- Reduced typo errors
- Consistent database state
- Cleaner TypeScript types
