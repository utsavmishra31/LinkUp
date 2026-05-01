import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — same as Instagram's feed refresh window

// ─── Filter Settings (persisted forever until user changes them) ─────────────
export interface FilterState {
  ageRange: { low: number; high: number };
  distance: number;
  interestedIn: string[];
  selectedAvailability: string | null; // ISO date string e.g. "2026-05-06"
  filterByAvailability: boolean;
}

// ─── Minimal Profile (store IDs + display only, NOT full JSON blobs) ──────────
// Fix #3: Memory bloat. We store ONLY what's needed to render the card.
// Full fresh data is always re-fetched from backend after TTL expires.
export interface CachedProfile {
  id: string;
  displayName: string;
  age?: number;
  gender?: string;
  bio?: string;
  photos?: string[];
  viewerQuestion?: string;
  viewerPollOptions?: string[];
  viewerPollAnswer?: number;
  height?: string;
  interestedIn?: string[];
  prompts?: { id: string; question: string; answer: string; }[] | null;
}

// ─── Minimal Match (same principle — IDs + display name + one photo) ─────────
export interface CachedMatch {
  id: string;
  created_at: string;
  matchedUser: {
    id: string;
    displayName: string;
    primaryPhotoUrl?: string;
  };
}

export interface UserCache {
  // Fix #1: TTL — track when profiles were last fetched
  profilesLastFetchedAt: number | null;
  matchesLastFetchedAt: number | null;

  filters: FilterState | null;
  // Fix #3: Only minimal profile data, NOT full any[] blobs
  profiles: CachedProfile[];
  matches: CachedMatch[];
}

export interface AppState {
  userCaches: Record<string, UserCache>;
  updateUserCache: (userId: string, data: Partial<UserCache>) => void;
  // Fix #4: On logout → wipe only that user's cache (or all if preferred)
  clearUserCache: (userId: string) => void;
  clearAllCaches: () => void;
  // Fix #1: Helper to check if cache is stale
  isProfilesCacheStale: (userId: string) => boolean;
  isMatchesCacheStale: (userId: string) => boolean;
}

const emptyUserCache = (): UserCache => ({
  profilesLastFetchedAt: null,
  matchesLastFetchedAt: null,
  filters: null,
  profiles: [],
  matches: [],
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userCaches: {},

      updateUserCache: (userId, data) =>
        set((state) => {
          const existing = state.userCaches[userId] ?? emptyUserCache();
          return {
            userCaches: {
              ...state.userCaches,
              [userId]: { ...existing, ...data },
            },
          };
        }),

      // Fix #4: Logout → clear only this user's cache to prevent leaks
      clearUserCache: (userId) =>
        set((state) => {
          const newCaches = { ...state.userCaches };
          delete newCaches[userId];
          return { userCaches: newCaches };
        }),

      // Full reset (e.g. app uninstall-like reset)
      clearAllCaches: () => set({ userCaches: {} }),

      // Fix #1: TTL check — is cached profiles list older than 5 minutes?
      isProfilesCacheStale: (userId) => {
        const cache = get().userCaches[userId];
        if (!cache?.profilesLastFetchedAt || cache.profiles.length === 0) return true;
        return Date.now() - cache.profilesLastFetchedAt > CACHE_TTL_MS;
      },

      // Fix #1: TTL check for matches list
      isMatchesCacheStale: (userId) => {
        const cache = get().userCaches[userId];
        if (!cache?.matchesLastFetchedAt || cache.matches.length === 0) return true;
        return Date.now() - cache.matchesLastFetchedAt > CACHE_TTL_MS;
      },
    }),
    {
      name: 'linkup-app-storage-v2', // v2 key → clears any old bloated v1 cache automatically
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
