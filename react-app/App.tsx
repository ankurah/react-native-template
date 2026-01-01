/**
 * Ankurah React Native UniFFI PoC
 * Step 2: Sync + Async function tests
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
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
import { greet, greetAsync } from './src';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Sync function result
  const syncGreeting = greet('React Native');

  // Async function state
  const [asyncGreeting, setAsyncGreeting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.content}>
          <Text style={[styles.title, isDarkMode && styles.textLight]}>
            🦀 UniFFI + React Native
          </Text>

          {/* Sync test */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
              Sync Function
            </Text>
            <Text style={[styles.result, isDarkMode && styles.textLight]}>
              {syncGreeting}
            </Text>
          </View>

          {/* Async test */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
              Async Function (500ms delay)
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
              <Button title="Call Async Greet" onPress={callAsyncGreet} disabled={isLoading} />
            </View>
          </View>
        </View>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    color: '#000',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 12,
    width: '100%',
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
  textLight: {
    color: '#fff',
  },
});

export default App;
