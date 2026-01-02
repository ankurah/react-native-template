/**
 * Ankurah React Native UniFFI PoC
 * Room list with auto-fetch
 */

import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Import from src/index.tsx which handles native module initialization
import {
  initNode,
  isNodeInitialized,
  getNodeId,
  getDefaultStoragePath,
  setupLogging,
  LogCallback,
  getContext,
  RoomOps,
  RoomInput,
  type RoomViewInterface,
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

  // Ankurah node state
  const [nodeStatus, setNodeStatus] = useState<string>('Initializing...');
  const [nodeId, setNodeId] = useState<string | null>(null);

  // Room operations state
  const [rooms, setRooms] = useState<RoomViewInterface[]>([]);
  const [roomLog, setRoomLog] = useState<string[]>([]);
  const [isRoomLoading, setIsRoomLoading] = useState(false);

  // Fetch rooms - defined before useEffect so it can be called
  const fetchRooms = async () => {
    setIsRoomLoading(true);
    try {
      console.log('fetchRooms: getting context...');
      const ctx = getContext();
      console.log('fetchRooms: got context', ctx);

      const roomOps = new RoomOps();
      setRoomLog(prev => [...prev, 'Fetching rooms...']);

      console.log('fetchRooms: calling fetch...');
      const fetchedRooms = await roomOps.fetch(ctx, 'true ORDER BY name ASC', []);
      console.log('fetchRooms: got rooms', fetchedRooms);

      setRooms(fetchedRooms);
      setRoomLog(prev => [...prev, `✅ Found ${fetchedRooms.length} rooms`]);
    } catch (e: any) {
      const errStr = e?.message || e?.toString?.() || JSON.stringify(e) || String(e);
      setRoomLog(prev => [...prev, `❌ Fetch error: ${errStr}`]);
      console.error('Fetch rooms error:', e);
      console.error('Error constructor:', e?.constructor?.name);
      console.error('Error prototype:', Object.getPrototypeOf(e));
      console.error('Error JSON:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
      if (e?.stack) console.error('Stack:', e.stack);
    } finally {
      setIsRoomLoading(false);
    }
  };

  // Initialize Ankurah node on app startup
  useEffect(() => {
    const onNodeReady = (id: string) => {
      setNodeId(id);
      setNodeStatus('✅ Node initialized');
      console.log('Node ready, fetching rooms...');
      // Auto-fetch rooms once node is ready
      fetchRooms();
    };

    // Check if already initialized (e.g., after hot reload)
    if (isNodeInitialized()) {
      try {
        const id = getNodeId();
        console.log('Node already initialized with ID:', id);
        onNodeReady(id);
      } catch (e: any) {
        setNodeStatus(`❌ ${e?.message || 'Failed to get node ID'}`);
      }
      return;
    }

    // Start initialization (non-blocking - spawns background task)
    try {
      const storagePath = getDefaultStoragePath();
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
          onNodeReady(id);
        } catch (e: any) {
          setNodeStatus(`❌ ${e?.message || 'Failed to get node ID'}`);
        }
      }
    }, 100);

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, []);

  // Room operations
  const createRoom = async () => {
    setIsRoomLoading(true);
    try {
      console.log('createRoom: getting context...');
      const ctx = getContext();
      console.log('createRoom: got context', ctx);

      const roomOps = new RoomOps();
      const roomName = `Room ${Date.now() % 10000}`;
      setRoomLog(prev => [...prev, `Creating room: ${roomName}`]);

      console.log('createRoom: creating input...');
      const input = RoomInput.create({ name: roomName });
      console.log('createRoom: got input', input);

      console.log('createRoom: calling createOne...');
      const room = await roomOps.createOne(ctx, input);
      console.log('createRoom: got room', room);

      setRoomLog(prev => [...prev, `✅ Created: ${room.name()} (${room.id().toString().slice(0, 8)}...)`]);
      // Refresh the room list
      await fetchRooms();
    } catch (e: any) {
      const errMsg = e?.message || e?.toString?.() || JSON.stringify(e) || String(e);
      setRoomLog(prev => [...prev, `❌ Create error: ${errMsg}`]);
      console.error('Create room error:', e);
      if (e?.stack) console.error('Stack:', e.stack);
    } finally {
      setIsRoomLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, isDarkMode && styles.textLight]}>
            🦀 Ankurah Rooms
          </Text>

          {/* Node status */}
          <View style={styles.statusBar}>
            <Text style={[styles.statusText, isDarkMode && styles.textLight]}>
              {nodeStatus}
            </Text>
            {nodeId && (
              <Text style={[styles.nodeId, isDarkMode && styles.textLight]}>
                {nodeId.slice(0, 12)}...
              </Text>
            )}
          </View>

          {/* Room list */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
                Rooms ({rooms.length})
              </Text>
              <View style={styles.buttonRow}>
                <Button
                  title="Refresh"
                  onPress={fetchRooms}
                  disabled={!nodeId || isRoomLoading}
                />
                <Button
                  title="Create"
                  onPress={createRoom}
                  disabled={!nodeId || isRoomLoading}
                />
              </View>
            </View>

            {isRoomLoading && <ActivityIndicator size="small" style={{ marginVertical: 8 }} />}

            {rooms.length > 0 ? (
              <View style={styles.roomList}>
                {rooms.map((room, i) => (
                  <View key={i} style={styles.roomItem}>
                    <Text style={[styles.roomName, isDarkMode && styles.textLight]}>
                      {room.name()}
                    </Text>
                    <Text style={[styles.roomId, isDarkMode && styles.textLight]}>
                      {room.id().toString().slice(0, 8)}...
                    </Text>
                  </View>
                ))}
              </View>
            ) : !isRoomLoading && nodeId ? (
              <Text style={[styles.emptyText, isDarkMode && styles.textLight]}>
                No rooms yet
              </Text>
            ) : null}

            {/* Log */}
            {roomLog.length > 0 && (
              <View style={styles.logContainer}>
                {roomLog.slice(-5).map((log, i) => (
                  <Text key={i} style={[styles.logText, isDarkMode && styles.textLight]}>
                    {log}
                  </Text>
                ))}
              </View>
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
    padding: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#000',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
  nodeId: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'Courier',
  },
  section: {
    padding: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roomList: {
    marginTop: 8,
  },
  roomItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
    marginBottom: 4,
  },
  roomName: {
    fontSize: 14,
    color: '#333',
  },
  roomId: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Courier',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  logContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  logText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'Courier',
  },
  textLight: {
    color: '#fff',
  },
});

export default App;
