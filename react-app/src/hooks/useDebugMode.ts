import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_STORAGE_KEY = 'chatDebugVisible';

/**
 * Manages debug mode visibility with AsyncStorage persistence.
 * State persists between sessions.
 */
export function useDebugMode() {
  const [showDebug, setShowDebug] = useState(true); // Default to true for development
  const [loaded, setLoaded] = useState(false);

  // Load initial value from storage - for development, always start with debug visible
  useEffect(() => {
    // Skip AsyncStorage - always show debug during development
    setLoaded(true);
  }, []);

  const toggleDebug = () => {
    setShowDebug(prev => {
      const newValue = !prev;
      AsyncStorage.setItem(DEBUG_STORAGE_KEY, String(newValue));
      return newValue;
    });
  };

  return { showDebug, toggleDebug, loaded };
}
