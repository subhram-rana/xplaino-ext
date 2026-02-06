// src/store/uiAtoms.ts
import { atom } from 'jotai';
import type { SubscriptionStatusDTO, PlanType } from '@/api-services/dto/SubscriptionDTO';
import { derivePlanType, getPlanName } from '@/api-services/dto/SubscriptionDTO';

// Types
export interface UserAuthInfo {
  isLoggedIn?: boolean;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
  userSessionPk?: string;
  user?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    picture?: string;
    role?: string;
  };
}

// ============================================
// UI STATE ATOMS
// ============================================

/** Loading state atom */
export const isLoadingAtom = atom<boolean>(false);

/** Error message atom */
export const errorMessageAtom = atom<string | null>(null);

/** Modal visibility atoms */
export const isModalOpenAtom = atom<boolean>(false);

/** Active tab atom */
export const activeTabAtom = atom<string>('text');

// ============================================
// LOGIN MODAL STATE
// ============================================

/** Login modal visibility */
export const showLoginModalAtom = atom<boolean>(false);

/** Login loading state */
export const isLoginLoadingAtom = atom<boolean>(false);

/** Login error message */
export const loginErrorAtom = atom<string | null>(null);

// ============================================
// SUBSCRIPTION MODAL STATE
// ============================================

/** Subscription modal visibility */
export const showSubscriptionModalAtom = atom<boolean>(false);

// ============================================
// FEATURE REQUEST MODAL STATE
// ============================================

/** Feature request modal visibility */
export const showFeatureRequestModalAtom = atom<boolean>(false);

/** Feature request loading state */
export const isFeatureRequestLoadingAtom = atom<boolean>(false);

/** Feature request error message */
export const featureRequestErrorAtom = atom<string | null>(null);

// ============================================
// USER AUTH STATE
// ============================================

/** User authentication info atom - synced with Chrome storage */
export const userAuthInfoAtom = atom<UserAuthInfo | null>(null);

/** Check if user is logged in */
export const isUserLoggedInAtom = atom((get) => {
  const authInfo = get(userAuthInfoAtom);
  if (!authInfo?.accessToken) {
    return false;
  }

  // Check if access token is expired
  if (authInfo.accessTokenExpiresAt) {
    const now = Math.floor(Date.now() / 1000);
    if (authInfo.accessTokenExpiresAt < now) {
      return false;
    }
  }

  return true;
});

// ============================================
// SUBSCRIPTION STATUS STATE
// ============================================

/** Subscription status atom - synced from GET /api/subscription/{userId} */
export const subscriptionStatusAtom = atom<SubscriptionStatusDTO | null>(null);

/** Derived plan type: 'free_trial' | 'plus' | 'ultra' */
export const userPlanTypeAtom = atom<PlanType>((get) => {
  const status = get(subscriptionStatusAtom);
  return derivePlanType(status);
});

/** Derived: plan display name (e.g., "Ultra Yearly", "Plus Monthly") */
export const userPlanNameAtom = atom<string | null>((get) => {
  const status = get(subscriptionStatusAtom);
  if (!status?.subscription) return null;
  return getPlanName(status.subscription);
});

/** Derived: whether user is on free trial (no active subscription) */
export const isFreeTrialAtom = atom<boolean>((get) => {
  return get(userPlanTypeAtom) === 'free_trial';
});

// ============================================
// THEME STATE
// ============================================

/** Current theme atom - 'light' or 'dark' */
export const currentThemeAtom = atom<'light' | 'dark'>('light');

