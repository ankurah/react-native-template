/**
 * Ankurah React Native Chat App
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, useColorScheme, Text, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Initialize Ankurah at module load (before React renders)
import { initAnkurah } from './src/ankurah';

import { getContext, getLastPanic } from './src';
import { RoomOps, type RoomLiveQueryInterface, type RoomViewInterface } from './src/generated/ankurah_rn_model';
import { ensureUser, type UserReadHandle } from './src/utils';
import { Header, RoomList, Chat } from './src/components';
// @test-panel-start
import { TestPanel } from './src/test-panel';
// @test-panel-end

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const [nodeReady, setNodeReady] = useState(false);
  const [rooms, setRooms] = useState<RoomLiveQueryInterface | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomViewInterface | null>(null);
  // @test-panel-start
  const [showTestPanel, setShowTestPanel] = useState(false);
  // @test-panel-end
  const [currentUser, setCurrentUser] = useState<UserReadHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wait for Ankurah init (already started at module load)
  useEffect(() => {
    if (nodeReady) return;
    initAnkurah()
      .then(() => setNodeReady(true))
      .catch(e => setError(e?.message || String(e)));
  }, [nodeReady]);

  // Initialize user and rooms when node is ready
  const initialized = useRef(false);
  useEffect(() => {
    if (!nodeReady || initialized.current) return;
    initialized.current = true;

    setCurrentUser(ensureUser());

    (async () => {
      try {
        const ctx = getContext();
        const roomsQuery = await new RoomOps().query(ctx, 'true', []);
        setRooms(roomsQuery);
      } catch (e: any) {
        console.error('Rooms query failed:', e);
        const panic = getLastPanic();
        setError(panic ? `Rust panic: ${panic.substring(0, 100)}...` : e?.message || String(e));
      }
    })();
  }, [nodeReady]);

  // Loading state
  if (!nodeReady || !currentUser) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, isDarkMode && styles.textLight]}>
              {error ? error : 'Connecting to Ankurah...'}
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const userId = currentUser.get()?.id().toString() ?? '';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <Header
          currentUser={currentUser}
          connectionStatus={nodeReady ? 'Connected' : 'Connecting...'}
          // @test-panel-props
          showTestPanel={showTestPanel}
          onToggleTestPanel={() => setShowTestPanel(p => !p)}
        />

        {/* @test-panel-start */}
        {__DEV__ && showTestPanel && userId && (
          <TestPanel
            currentUserId={userId}
            onNavigateToRoom={setSelectedRoom}
            onClose={() => setShowTestPanel(false)}
          />
        )}
        {/* @test-panel-end */}

        <View style={styles.mainContent}>
          {selectedRoom ? (
            <Chat
              room={selectedRoom}
              currentUser={currentUser}
              connectionStatus={nodeReady ? 'Connected' : 'Connecting...'}
              onBack={() => setSelectedRoom(null)}
            />
          ) : rooms ? (
            <RoomList onSelectRoom={setSelectedRoom} rooms={rooms} />
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, isDarkMode && styles.textLight]}>
                Loading rooms...
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerDark: { backgroundColor: '#1a1a1a' },
  mainContent: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  textLight: { color: '#ccc' },
});

export default App;
