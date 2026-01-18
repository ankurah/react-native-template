/**
 * React Native hook for creating reactive signals
 *
 * This hook creates signals that integrate with Ankurah's signal observation system.
 * When a signal is read inside a component using useObserve(), changes to that
 * signal will trigger re-renders.
 */
import { useState } from 'react';
import { JsSignal } from '../generated/ankurah_signals';

/**
 * A reactive signal that can be read and written.
 * When accessed during a tracked render (useObserve), changes trigger re-renders.
 */
export interface Signal<T> {
  /** Get the current value (registers with current observer if tracking) */
  get(): T;
  /** Set a new value (triggers re-renders in observing components) */
  set(value: T): void;
}

/**
 * A read-only view of a signal.
 */
export interface SignalRead<T> {
  /** Get the current value (registers with current observer if tracking) */
  get(): T;
}

interface SignalState<T> {
  rust: JsSignal;
  value: T;
}

/**
 * Create a Signal outside of React (for module-level reactive state)
 *
 * This signal integrates with Ankurah's observation system. When its value
 * is read inside a component that uses useObserve(), changes will trigger
 * re-renders of that component.
 *
 * @example
 * ```tsx
 * // At module level
 * const counter = createSignal(0);
 *
 * // In component using useObserve
 * function Counter() {
 *   const observer = useObserve();
 *   observer.beginTracking();
 *   try {
 *     // Reading during tracking automatically subscribes to changes
 *     return <Text>{counter.get()}</Text>;
 *   } finally {
 *     observer.finish();
 *   }
 * }
 *
 * // To update (from anywhere) - triggers re-render of Counter
 * counter.set(counter.get() + 1);
 * ```
 */
export function createSignal<T>(initialValue: T): Signal<T> {
  const state: SignalState<T> = {
    rust: new JsSignal(),
    value: initialValue,
  };

  return {
    get: () => {
      state.rust.track(); // Register with current observer (if any)
      return state.value;
    },
    set: (newValue: T) => {
      state.value = newValue;
      state.rust.notify(); // Trigger re-renders in observing components
    },
  };
}

/**
 * Hook to create a Signal within a component (persists across re-renders)
 *
 * This signal integrates with Ankurah's observation system. When its value
 * is read inside a component that uses useObserve(), changes will trigger
 * re-renders of that component.
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const observer = useObserve();
 *   const count = useSignal(0);
 *
 *   observer.beginTracking();
 *   try {
 *     return (
 *       <View>
 *         <Text>{count.get()}</Text>
 *         <Button
 *           title="Increment"
 *           onPress={() => count.set(count.get() + 1)}
 *         />
 *       </View>
 *     );
 *   } finally {
 *     observer.finish();
 *   }
 * }
 * ```
 */
export function useSignal<T>(initialValue: T): Signal<T> {
  const [signal] = useState(() => createSignal(initialValue));
  return signal;
}

export default useSignal;
