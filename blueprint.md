# AgroConnect Blueprint

## Overview
AgroConnect is a React/Vite + Firebase application that connects agricultural companies with local talent. The platform includes public company discovery, worker and company portals, and a SuperAdmin dashboard for operational oversight.

## Current Features
- Public landing with worker/company access and a public companies directory.
- SuperAdmin dashboard for companies, workers, jobs, and lead (solicitud) management.
- Firestore-backed data model for companies, leads, jobs, and operational metrics.
- Cloud Functions for access sync, communication outbox processing, and email delivery.
- **Automatic token refresh**: After Cloud Functions update custom claims, the frontend automatically refreshes tokens to get the latest permissions without manual intervention.

## Recent Changes

### SuperAdmin Login: signInWithPopup Implementation (Latest)
Fixed SuperAdmin authentication to use popup instead of redirect for more reliable login flow:

1. **Updated `LoginScreen.tsx` imports**:
   - Added `signInWithPopup` to Firebase Auth imports
   - Kept `signInWithRedirect` and `getRedirectResult` for company admin flow

2. **Rewrote `handleAdminUnlock` function**:
   - Changed from `signInWithRedirect` to `signInWithPopup` for SuperAdmin authentication
   - Handles authentication entirely in the popup callback
   - Includes proper error handling for popup-closed and popup-blocked scenarios
   - Validates email, syncs superadmin claims, and checks permissions before navigation
   - Provides clear user feedback for all error conditions

3. **Simplified `useEffect` redirect handling**:
   - Removed admin branch from `consumeRedirect` logic
   - Admin login now handled completely in popup callback
   - Company admin redirect flow remains unchanged

**Benefits**:
- ✅ More reliable authentication across different environments
- ✅ Works in development servers and Firebase Hosting
- ✅ Better user experience with immediate feedback
- ✅ Proper error handling for popup-closed and popup-blocked scenarios
- ✅ No more stuck redirect flows with Firebase auth iframes

### Token Refresh After Claims Update
Enhanced authentication flow to automatically refresh Firebase Auth tokens after custom claims are updated by Cloud Functions:

1. **Updated `syncUserAccess()` function**:
   - Now automatically refreshes token after successful claims update
   - Added comprehensive JSDoc documentation
   - Includes console logging for debugging
   - Extended return type to include optional `claimsUpdated` field

2. **Updated `syncSuperadminClaims()` function**:
   - Automatically refreshes token after successful claims update
   - Added JSDoc documentation explaining behavior
   - Includes console logging for debugging

3. **Updated `setSuperadminByEmail()` function**:
   - Replaced `as any` with proper TypeScript typing
   - Added JSDoc documentation explaining that target user needs manual refresh

4. **Added `forceTokenRefresh()` utility function**:
   - New exported utility for manual token refresh
   - Returns updated claims or null if no authenticated user
   - Includes comprehensive error handling and logging
   - Useful for edge cases where manual refresh is needed

**Benefits**:
- Developers no longer need to manually call `getIdToken(true)` after claim updates
- Consistent behavior across all sync functions
- Better debugging with console logs
- Improved developer experience

## Plan (Previous Request)
1. Surface lead validation errors directly in the public lead request modal.
2. Keep Firestore as the source of truth for lead submissions and status updates.
3. Verify UI feedback is visible for lead submission errors without altering branding.
