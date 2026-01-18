import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getContext } from './generated/ankurah_rn_bindings';
import { EntityId } from './generated/ankurah_proto';
import {
  UserOps,
  UserInput,
  type UserViewInterface,
} from './generated/ankurah_rn_model';

// Re-export signalObserver from hooks for backwards compatibility
export { signalObserver } from './hooks';

// Type for user read handle (async initialization)
export type UserReadHandle = {
  get: () => UserViewInterface | null;
  subscribe: (listener: () => void) => () => void;
};

/**
 * Hook for async operations with automatic state management.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList
): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    fn().then(setValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

// AsyncStorage keys
const STORAGE_KEY_USER_ID = 'ankurah_template_user_id';

/**
 * Ensures a user exists, creating one if necessary.
 * Returns a handle that will be populated with the user.
 */
export function ensureUser(): UserReadHandle {
  let user: UserViewInterface | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach(l => l());
  };

  const createNewUser = async () => {
    const ctx = getContext();
    const userOps = new UserOps();
    const input = UserInput.create({
      displayName: `User-${Math.floor(Math.random() * 10000)}`,
    });
    // Use create_one which handles transaction internally
    // (Manual create + commit doesn't work due to UniFFI Arc ownership limitations)
    const userView = await userOps.createOne(ctx, input);
    await AsyncStorage.setItem(STORAGE_KEY_USER_ID, userView.id().toString());
    return userView;
  };

  // WORKAROUND: ankurah get_entity creates empty entities for non-existent IDs
  // instead of returning EntityNotFound. See https://github.com/ankurah/ankurah/issues/196
  const isValidUser = (u: UserViewInterface): boolean => {
    try {
      u.displayName(); // Throws if entity is empty
      return true;
    } catch {
      return false;
    }
  };

  const initUser = async () => {
    try {
      const ctx = getContext();
      const storedUserId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);

      if (storedUserId) {
        try {
          const userOps = new UserOps();
          const entityId = EntityId.fromBase64(storedUserId);
          const fetchedUser = await userOps.get(ctx, entityId);
          if (isValidUser(fetchedUser)) {
            user = fetchedUser;
            notify();
            return;
          }
          // User exists but is empty/invalid - clear and recreate
          console.warn('Stored user is invalid, creating new user');
        } catch (e) {
          console.warn('Failed to fetch stored user, creating new user:', e);
        }
        await AsyncStorage.removeItem(STORAGE_KEY_USER_ID);
      }

      user = await createNewUser();
      notify();
    } catch (error) {
      console.error('Failed to initialize user:', error);
    }
  };

  initUser();

  return {
    get: () => user,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      // If user is already set, notify immediately to handle race condition
      if (user) {
        // Use setTimeout to ensure React has finished its current render cycle
        setTimeout(() => listener(), 0);
      }
      return () => listeners.delete(listener);
    },
  };
}
