/**
 * Ankurah React Native UniFFI PoC
 * Step 1: Sync function test
 */

import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import from src/index.tsx which handles native module initialization
import { greet } from './src';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Call the Rust function
  const greeting = greet('React Native');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.content}>
          <Text style={[styles.title, isDarkMode && styles.textLight]}>
            🦀 UniFFI + React Native
          </Text>
          <Text style={[styles.result, isDarkMode && styles.textLight]}>
            {greeting}
          </Text>
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
    marginBottom: 24,
    color: '#000',
  },
  result: {
    fontSize: 20,
    color: '#000',
  },
  textLight: {
    color: '#fff',
  },
});

export default App;
