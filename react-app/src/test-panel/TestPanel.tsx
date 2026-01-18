import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { scrollTest } from './scrollTestIntegration';
import type { RoomViewInterface } from '../generated/ankurah_rn_model';

interface TestPanelProps {
    currentUserId: string;
    onNavigateToRoom: (room: RoomViewInterface) => void;
    onClose: () => void;
}

export function TestPanel({ currentUserId, onNavigateToRoom, onClose }: TestPanelProps) {
    const [testStatus, setTestStatus] = useState<string>('idle');
    const [progressLog, setProgressLog] = useState<string[]>([]);

    // Set up scroll test with current user and navigation callback
    useEffect(() => {
        scrollTest.setCurrentUserId(currentUserId);
        scrollTest.setNavigationCallback(onNavigateToRoom);
    }, [currentUserId, onNavigateToRoom]);

    // Poll for test status and progress when running
    useEffect(() => {
        if (testStatus !== 'running') return;
        const interval = setInterval(() => {
            const status = scrollTest.getStatus();
            setProgressLog([...status.log]);
            if (!status.running) {
                setTestStatus(status.result?.pass ? 'pass' : 'fail');
            }
        }, 100);
        return () => clearInterval(interval);
    }, [testStatus]);

    const handleRunScrollTest = async () => {
        setTestStatus('running');
        setProgressLog([]);
        scrollTest.clearLog();
        try {
            await scrollTest.run(); // Uses DEFAULT_CONFIG (30 messages)
        } catch (e) {
            console.error('[TestPanel] Error:', e);
        }
    };

    const getStatusText = () => {
        switch (testStatus) {
            case 'running': return 'Running...';
            case 'pass': return 'PASS';
            case 'fail': return 'FAIL';
            default: return '';
        }
    };

    const getStatusColor = () => {
        switch (testStatus) {
            case 'running': return '#007AFF';
            case 'pass': return '#0f0';
            case 'fail': return '#f00';
            default: return '#888';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, testStatus === 'running' && styles.buttonDisabled]}
                    onPress={handleRunScrollTest}
                    disabled={testStatus === 'running'}
                    accessibilityLabel="Scroll Test"
                >
                    <Text style={styles.buttonText}>Scroll Test</Text>
                </Pressable>
                {testStatus !== 'idle' && (
                    <Text style={[styles.statusText, { color: getStatusColor() }]}>
                        {getStatusText()}
                    </Text>
                )}
                <View style={styles.spacer} />
                <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close Test Panel">
                    <Text style={styles.closeButtonText}>X</Text>
                </Pressable>
            </View>

            <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
                {progressLog.length === 0 ? (
                    <Text style={styles.logPlaceholder}>Output will appear here...</Text>
                ) : (
                    <Text selectable style={styles.logLine}>
                        {progressLog.join('\n')}
                    </Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,  // Below the header (which is ~50pts tall within safe area)
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 12,
        zIndex: 1000,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    buttonDisabled: {
        backgroundColor: '#555',
    },
    buttonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    spacer: {
        flex: 1,
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    logContainer: {
        maxHeight: 150,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 6,
    },
    logContent: {
        padding: 8,
    },
    logPlaceholder: {
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#666',
    },
    logLine: {
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#0f0',
        lineHeight: 14,
    },
});
