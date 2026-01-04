/**
 * Ankurah React Native Chat App
 * Matches the structure of the web (WASM) version
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, Text, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Generated bindings
import {
  initNode,
  isNodeInitialized,
  getNodeId,
  getDefaultStoragePath,
  setupLogging,
  LogCallback,
  getContext,
} from './src';
import { RoomOps, type RoomLiveQueryInterface } from './src/generated/ankurah_rn_model';

// Hooks and utilities
import { signalObserver, ensureUser, type UserReadHandle } from './src/utils';

// Components
import { Header, RoomList, Chat } from './src/components';

// Import types
import type { RoomViewInterface } from './src/generated/ankurah_rn_model';

// Set up Rust logging to forward to JS console
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

function AppContent(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Connection/node state
  const [nodeReady, setNodeReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // Rooms LiveQuery
  const [rooms, setRooms] = useState<RoomLiveQueryInterface | null>(null);

  // Selected room state (simple React state)
  const [selectedRoom, setSelectedRoom] = useState<RoomViewInterface | null>(null);

  // Current user (initialized after node is ready)
  const [currentUser, setCurrentUser] = useState<UserReadHandle | null>(null);

  // Initialize Ankurah node
  useEffect(() => {
    const initializeNode = async () => {
      // Check if already initialized (e.g., after hot reload)
      if (isNodeInitialized()) {
        console.log('Node already initialized');
        setNodeReady(true);
        setConnectionStatus('Connected');
        return;
      }

      try {
        const storagePath = getDefaultStoragePath();
        const serverUrl = 'ws://localhost:9797';
        console.log('Initializing node with storage path:', storagePath);
        console.log('Connecting to server:', serverUrl);
        initNode(storagePath, serverUrl);

        // Poll for initialization completion
        const pollInterval = setInterval(() => {
          if (isNodeInitialized()) {
            clearInterval(pollInterval);
            console.log('Node initialized with ID:', getNodeId());
            setNodeReady(true);
            setConnectionStatus('Connected');
          }
        }, 100);

        return () => clearInterval(pollInterval);
      } catch (e: any) {
        console.error('Failed to initialize node:', e);
        setConnectionStatus('Error');
      }
    };

    initializeNode();
  }, []);

  // Initialize user and rooms query once node is ready
  useEffect(() => {
    if (!nodeReady) return;

    const initialize = async () => {
      try {
        // Initialize current user
        const userRead = ensureUser();
        setCurrentUser(userRead);

        // Create rooms LiveQuery
        const ctx = getContext();
        const roomOps = new RoomOps();
        const roomsQuery = await roomOps.query(ctx, 'true ORDER BY name ASC', []);
        setRooms(roomsQuery);
      } catch (e) {
        console.error('Failed to initialize:', e);
      }
    };

    initialize();
  }, [nodeReady]);

  // Mobile navigation: show room list or chat, not both
  const showChat = selectedRoom !== null;

  const handleBack = () => {
    setSelectedRoom(null);
  };

  // Show loading state while node initializes
  if (!nodeReady || !rooms || !currentUser) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, isDarkMode && styles.textLight]}>
              {connectionStatus === 'Connecting...' ? 'Connecting to Ankurah...' : connectionStatus}
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <Header currentUser={currentUser} connectionStatus={connectionStatus} />

        <View style={styles.mainContent}>
          {showChat ? (
            <Chat
              room={selectedRoom}
              currentUser={currentUser}
              connectionStatus={connectionStatus}
              onBack={handleBack}
            />
          ) : (
            <RoomList onSelectRoom={setSelectedRoom} rooms={rooms} />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Wrap with signalObserver for reactive updates
const App = signalObserver(AppContent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  mainContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  textLight: {
    color: '#ccc',
  },
});

export default App;
