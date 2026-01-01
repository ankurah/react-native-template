/**
 * Ankurah React Native UniFFI PoC
 * Step 3: Sync + Async + Callbacks
 */

import React, { useState, useRef } from 'react';
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
import { greet, greetAsync, Counter, CounterCallback } from './src';

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
  textLight: {
    color: '#fff',
  },
});

export default App;
