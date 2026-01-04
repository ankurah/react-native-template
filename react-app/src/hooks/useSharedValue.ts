/**
 * React Native hook for shared mutable state
 *
 * This provides a similar API to WASM's JsValueMut for sharing mutable state
 * between components with reactive updates.
 */
import { useRef, useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

/**
 * A mutable value container that can be shared between components.
 * Similar to WASM's JsValueMut pattern.
 */
export interface SharedValue<T> {
  /** Get the current value */
  get(): T;
  /** Set a new value (triggers re-renders in subscribed components) */
  set(value: T): void;
  /** Subscribe to value changes */
  subscribe(listener: Listener): () => void;
}

/**
 * A read-only view of a SharedValue.
 * Similar to WASM's JsValueRead pattern.
 */
export interface SharedValueRead<T> {
  /** Get the current value */
  get(): T;
  /** Subscribe to value changes */
  subscribe(listener: Listener): () => void;
}

/**
 * Create a SharedValue outside of React (for module-level state)
 *
 * @example
 * ```tsx
 * // At module level
 * const [selectedRoom, selectedRoomRead] = createSharedValue<RoomViewInterface | null>(null);
 *
 * // In component
 * function RoomList() {
 *   const room = useSharedValueRead(selectedRoomRead);
 *   return <Text>{room?.name() ?? 'No room selected'}</Text>;
 * }
 *
 * // To update (from anywhere)
 * selectedRoom.set(newRoom);
 * ```
 */
export function createSharedValue<T>(initialValue: T): [SharedValue<T>, SharedValueRead<T>] {
  let value = initialValue;
  const listeners = new Set<Listener>();

  const notify = () => {
    listeners.forEach(listener => listener());
  };

  const sharedValue: SharedValue<T> = {
    get: () => value,
    set: (newValue: T) => {
      console.log('SharedValue.set called:', newValue, 'listeners:', listeners.size);
      value = newValue;
      notify();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      console.log('SharedValue.subscribe, total listeners:', listeners.size);
      return () => {
        listeners.delete(listener);
        console.log('SharedValue.unsubscribe, remaining listeners:', listeners.size);
      };
    },
  };

  // Read-only view is the same object (just typed differently)
  const sharedValueRead: SharedValueRead<T> = sharedValue;

  return [sharedValue, sharedValueRead];
}

/**
 * Hook to subscribe to a SharedValueRead and re-render on changes
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const room = useSharedValueRead(selectedRoomRead);
 *   return <Text>{room?.name()}</Text>;
 * }
 * ```
 */
export function useSharedValueRead<T>(sharedValue: SharedValueRead<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => sharedValue.subscribe(onStoreChange),
    [sharedValue]
  );

  const getSnapshot = useCallback(() => sharedValue.get(), [sharedValue]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Hook to create a SharedValue within a component (persists across re-renders)
 *
 * @example
 * ```tsx
 * function ParentComponent() {
 *   const [selectedRoom, selectedRoomRead] = useSharedValue<RoomViewInterface | null>(null);
 *
 *   return (
 *     <>
 *       <RoomList selectedRoom={selectedRoom} />
 *       <Chat selectedRoomRead={selectedRoomRead} />
 *     </>
 *   );
 * }
 * ```
 */
export function useSharedValue<T>(initialValue: T): [SharedValue<T>, SharedValueRead<T>] {
  const ref = useRef<[SharedValue<T>, SharedValueRead<T>] | null>(null);
  if (!ref.current) {
    ref.current = createSharedValue(initialValue);
  }
  return ref.current;
}

export default useSharedValue;
