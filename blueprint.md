# AgroConnect Blueprint

## Overview
AgroConnect is a React/Vite + Firebase application that connects agricultural companies with local talent. The platform includes public company discovery, worker and company portals, and a SuperAdmin dashboard for operational oversight.

## Current Features
- Public landing with worker/company access and a public companies directory.
- SuperAdmin dashboard for companies, workers, jobs, and lead (solicitud) management.
- Firestore-backed data model for companies, leads, jobs, and operational metrics.
- Cloud Functions for access sync, communication outbox processing, and email delivery.

## Plan (Current Request)
1. Surface lead validation errors directly in the public lead request modal.
2. Keep Firestore as the source of truth for lead submissions and status updates.
3. Verify UI feedback is visible for lead submission errors without altering branding.
