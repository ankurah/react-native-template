// Re-export hooks from @ankurah/react-hooks bound to our bindings
import React from 'react';
import { createAnkurahReactHooks } from '@ankurah/react-hooks';
import { ReactObserver } from '../generated/ankurah_signals';

const { useObserve, signalObserver } = createAnkurahReactHooks({ React, ReactObserver });
export { useObserve, signalObserver };

// Local hooks
export {
  useSharedValue,
  useSharedValueRead,
  createSharedValue,
  type SharedValue,
  type SharedValueRead,
} from './useSharedValue';
export {
  useSignal,
  createSignal,
  type Signal,
  type SignalRead,
} from './useSignal';
export { useDebugMode } from './useDebugMode';


