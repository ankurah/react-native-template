/**
 * React Native hook for observing Ankurah signals
 *
 * This hook integrates with React's useSyncExternalStore to automatically
 * re-render components when observed signals change.
 */
import { useRef, useCallback, useSyncExternalStore } from 'react';
import {
  ReactObserver,
  type StoreChangeCallback,
} from '../generated/ankurah_signals';

/**
 * Hook that enables automatic re-rendering when observed signals change.
 *
 * @returns An observer object with beginTracking() and finish() methods
 *
 * @example
 * ```tsx
 * function RoomList() {
 *   const observer = useObserve();
 *
 *   // Start tracking signal access
 *   observer.beginTracking();
 *
 *   try {
 *     // Access signals during render - they'll be automatically tracked
 *     const rooms = liveQuery.items();
 *
 *     return (
 *       <View>
 *         {rooms.map(room => (
 *           <Text key={room.id().toString()}>{room.name()}</Text>
 *         ))}
 *       </View>
 *     );
 *   } finally {
 *     // Clean up tracking
 *     observer.finish();
 *   }
 * }
 * ```
 */
export function useObserve(): ReactObserver {
  // Create observer once per component instance
  const observerRef = useRef<ReactObserver | null>(null);
  if (!observerRef.current) {
    observerRef.current = new ReactObserver();
  }
  const observer = observerRef.current;

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Create callback that implements StoreChangeCallback interface
      const callback: StoreChangeCallback = {
        onChange: onStoreChange,
      };
      observer.subscribe(callback);

      // Return cleanup function
      return () => {
        observer.unsubscribe();
      };
    },
    [observer]
  );

  // Snapshot function for useSyncExternalStore
  const getSnapshot = useCallback(() => {
    return observer.getSnapshot();
  }, [observer]);

  // This hooks into React's concurrent rendering
  useSyncExternalStore(subscribe, getSnapshot);

  return observer;
}

export default useObserve;


