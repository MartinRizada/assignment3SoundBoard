import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('recordings.db');

export default function App() {
    const [recordings, setRecordings] = useState(new Array(3).fill(null));
    const [currentRecording, setCurrentRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [nextRecordingIndex, setNextRecordingIndex] = useState(0);
    const [permissionsResponse, requestPermission] = Audio.usePermissions();

    useEffect(() => {
        db.transaction(tx => {
            tx.executeSql(
                "create table if not exists recordings (id integer primary key not null, uri text);",
                [],
                () => console.log('Table created successfully'),
                (t, error) => console.log('Error creating table', error)
            );
        });
    }, []);

    const startRecording = async () => {
        try {
            if (permissionsResponse.status !== 'granted') {
                await requestPermission();
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
            await recording.startAsync();
            setIsRecording(true);
            setCurrentRecording(recording);
        } catch (error) {
            console.error("Failed to start recording:", error);
            Alert.alert("Recording Error", "Failed to start recording.");
        }
    };

    const stopRecording = async () => {
        try {
            await currentRecording.stopAndUnloadAsync();
            const uri = currentRecording.getURI();
            setRecordings(prevRecordings => {
                const newRecordings = [...prevRecordings];
                newRecordings[nextRecordingIndex] = uri;
                return newRecordings;
            });
            setCurrentRecording(null);
            setIsRecording(false);
            setNextRecordingIndex((prevIndex) => (prevIndex + 1) % 3);
            db.transaction(tx => {
                tx.executeSql("insert into recordings (uri) values (?)", [uri]);
            });
        } catch (error) {
            console.error("Failed to stop recording:", error);
            Alert.alert("Recording Error", "Failed to stop recording.");
            setIsRecording(false);
        }
    };

    const handleRecordPress = async () => {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    };

    const playRecording = async (uri) => {
        const { sound } = await Audio.Sound.createAsync({ uri });
        await sound.playAsync();
    };

    const renderPlaybackButton = (index) => {
        return (
            <TouchableOpacity
                key={index}
                style={styles.button}
                onPress={() => playRecording(recordings[index])}
                disabled={!recordings[index]}
            >
                <Text style={styles.buttonText}>
                    {recordings[index] ? 'Play' : 'Empty'}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {recordings.map((_, index) => renderPlaybackButton(index))}
            <TouchableOpacity
                style={[styles.button, isRecording ? styles.recordingButton : {}]}
                onPress={handleRecordPress}
            >
                <Text style={styles.buttonText}>
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 20,
    },
    button: {
        width: 90,
        height: 90,
        margin: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ddd',
        borderRadius: 10,
    },
    recordingButton: {
        backgroundColor: 'red',
    },
    buttonText: {
        fontSize: 18,
    },
});
