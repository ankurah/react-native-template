/**
 * Ankurah React Native UniFFI PoC
 * Phase 2: Ankurah Integration
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import from src/index.tsx which handles native module initialization
import {
  greet,
  greetAsync,
  Counter,
  CounterCallback,
  initNode,
  isNodeInitialized,
  getNodeId,
  getDefaultStoragePath,
  setupLogging,
  LogCallback,
} from './src';

// Set up Rust logging to forward to JS console (do this once at module load)
const rustLogCallback: LogCallback = {
  onLog: (level: string, target: string, message: string) => {
    const prefix = `[Rust:${target}]`;
    switch (level) {
      case 'ERROR':
        console.error(prefix, message);
        break;
      case 'WARN':
        console.warn(prefix, message);
        break;
      case 'INFO':
        console.info(prefix, message);
        break;
      case 'DEBUG':
        console.debug(prefix, message);
        break;
      default:
        console.log(prefix, `[${level}]`, message);
    }
  },
};

// Initialize logging before anything else
try {
  setupLogging(rustLogCallback);
  console.log('Rust logging initialized');
} catch (e) {
  console.warn('Failed to set up Rust logging:', e);
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Sync function result
  const syncGreeting = greet('React Native');

  // Async function state
  const [asyncGreeting, setAsyncGreeting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Callback test state
  const [callbackCount, setCallbackCount] = useState(0);
  const [callbackLog, setCallbackLog] = useState<string[]>([]);
  const counterRef = useRef<Counter | null>(null);

  // Ankurah node state
  const [nodeStatus, setNodeStatus] = useState<string>('Initializing...');
  const [nodeId, setNodeId] = useState<string | null>(null);

  // Initialize Ankurah node on app startup
  useEffect(() => {
    // Start initialization (non-blocking - spawns background task)
    try {
      const storagePath = getDefaultStoragePath();
      // For iOS simulator, localhost maps to the host machine
      const serverUrl = 'ws://localhost:9797';
      console.log('Initializing node with storage path:', storagePath);
      console.log('Connecting to server:', serverUrl);
      initNode(storagePath, serverUrl);
    } catch (e: any) {
      console.error('Failed to start node initialization:', e);
      setNodeStatus(`❌ ${e?.message || 'Failed to start'}`);
      return;
    }

    // Poll for initialization completion
    const pollInterval = setInterval(() => {
      if (isNodeInitialized()) {
        clearInterval(pollInterval);
        try {
          const id = getNodeId();
          setNodeId(id);
          setNodeStatus('✅ Node initialized');
          console.log('Node initialized with ID:', id);
        } catch (e: any) {
          setNodeStatus(`❌ ${e?.message || 'Failed to get node ID'}`);
        }
      }
    }, 100);

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, []);

  const callAsyncGreet = async () => {
    setIsLoading(true);
    setAsyncGreeting(null);
    try {
      const result = await greetAsync('React Native', BigInt(500));
      setAsyncGreeting(result);
    } catch (e: any) {
      setAsyncGreeting(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize counter with callback
  const initCounter = () => {
    const callback: CounterCallback = {
      onUpdate: (count: number) => {
        setCallbackCount(count);
        setCallbackLog(prev => [...prev, `Callback: count=${count}`]);
      },
    };
    const counter = new Counter();
    counter.setCallback(callback);
    counterRef.current = counter;
    setCallbackLog(['Counter initialized with callback']);
    setCallbackCount(0);
  };

  const incrementCounter = () => {
    if (counterRef.current) {
      counterRef.current.increment();
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, isDarkMode && styles.textLight]}>
            🦀 UniFFI + React Native
          </Text>

          {/* Sync test */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
              1. Sync Function
            </Text>
            <Text style={[styles.result, isDarkMode && styles.textLight]}>
              {syncGreeting}
            </Text>
          </View>

          {/* Async test */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
              2. Async Function (500ms delay)
            </Text>
            {isLoading ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#fff' : '#000'} />
            ) : asyncGreeting ? (
              <Text style={[styles.result, isDarkMode && styles.textLight]}>
                {asyncGreeting}
              </Text>
            ) : (
              <Text style={[styles.placeholder, isDarkMode && styles.textLight]}>
                Not called yet
              </Text>
            )}
            <View style={styles.buttonContainer}>
              <Button title="Call Async" onPress={callAsyncGreet} disabled={isLoading} />
            </View>
          </View>

          {/* Callback test */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
              3. Callback Interface
            </Text>
            <Text style={[styles.result, isDarkMode && styles.textLight]}>
              Count: {callbackCount}
            </Text>
            <View style={styles.buttonRow}>
              <Button title="Init Counter" onPress={initCounter} />
              <Button
                title="Increment"
                onPress={incrementCounter}
                disabled={!counterRef.current}
              />
            </View>
            <View style={styles.logContainer}>
              {callbackLog.slice(-5).map((log, i) => (
                <Text key={i} style={[styles.logText, isDarkMode && styles.textLight]}>
                  {log}
                </Text>
              ))}
            </View>
          </View>

          {/* Ankurah Node status (auto-initialized on startup) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
              4. Ankurah Node
            </Text>
            <Text style={[styles.result, isDarkMode && styles.textLight]}>
              {nodeStatus}
            </Text>
            {nodeId && (
              <Text style={[styles.nodeId, isDarkMode && styles.textLight]}>
                ID: {nodeId}
              </Text>
            )}
            {nodeStatus === 'Initializing...' && (
              <ActivityIndicator size="small" style={{ marginTop: 8 }} />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#000',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  result: {
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  logContainer: {
    marginTop: 12,
    width: '100%',
  },
  logText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Courier',
  },
  nodeId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Courier',
    marginTop: 4,
  },
  textLight: {
    color: '#fff',
  },
});

export default App;
