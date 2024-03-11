import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite';


const db = SQLite.openDatabase('recordings.db');

// pre defined sounds
const soundEffectFiles = {
    Music1: require('./assets/sfx/music.mp3'), 
    Music2: require('./assets/sfx/music1.mp3'),
    Music3: require('./assets/sfx/music2.mp3'),
};

export default function App() {
    const [recordings, setRecordings] = useState(new Array(3).fill(null));
    const [soundEffects, setSoundEffects] = useState({});
    const [currentRecording, setCurrentRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [nextRecordingIndex, setNextRecordingIndex] = useState(0);
    const [permissionsResponse, requestPermission] = Audio.usePermissions();
    const [playingSound, setPlayingSound] = useState(null);
    const [soundStatus, setSoundStatus] = useState({});
    const [playingRecordingIndex, setPlayingRecordingIndex] = useState(null);

    const toggleSoundEffect = async (key) => {
        // Check if there is a sound object and if it's playing
        const soundObject = soundStatus[key]?.sound;
        const isPlaying = soundStatus[key]?.isPlaying;

        if (soundObject && isPlaying) {
            // Stop the sound if it's playing
            await soundObject.stopAsync();
            // Update the status in the state
            setSoundStatus(prevStatus => ({
                ...prevStatus,
                [key]: { ...prevStatus[key], isPlaying: false },
            }));
        } else {
            // If the sound is not playing, start it
            if (!soundObject) {
                // Load the sound if it has not been loaded yet
                const { sound } = await Audio.Sound.createAsync(soundEffectFiles[key]);
                sound.setOnPlaybackStatusUpdate(status => {
                    if (status.didJustFinish) {
                        // When the sound finishes playing, reset its state
                        setSoundStatus(prevStatus => ({
                            ...prevStatus,
                            [key]: { ...prevStatus[key], isPlaying: false, sound: null },
                        }));
                        sound.unloadAsync();
                    }
                });
                setSoundStatus(prevStatus => ({
                    ...prevStatus,
                    [key]: { sound, isPlaying: true },
                }));
                // Start playing
                await sound.playAsync();
            } else {
                // If the sound is already loaded, just start playing
                setSoundStatus(prevStatus => ({
                    ...prevStatus,
                    [key]: { ...prevStatus[key], isPlaying: true },
                }));
                await soundObject.playAsync();
            }
        }
    };

    useEffect(() => {
        db.transaction(tx => {
            tx.executeSql(
                "create table if not exists recordings (id integer primary key not null, uri text);",
                [],
                () => console.log('Table created successfully'),
                (t, error) => console.log('Error creating table', error)
            );
        });

        // Load sound effects
        const loadSoundEffects = async () => {
            try {
                const loadedEffects = {};
                await Promise.all(Object.keys(soundEffectFiles).map(async key => {
                    const { sound } = await Audio.Sound.createAsync(soundEffectFiles[key]);
                    loadedEffects[key] = sound;
                }));
                setSoundEffects(loadedEffects);
            } catch (error) {
                console.log('Error loading sound effects:', error);
            }
        };

        loadSoundEffects();

        return () => {
            // Unload sound effects
            Object.values(soundEffects).forEach(sound => {
                sound.unloadAsync();
            });
        };
    }, []);

    // start record
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
    // stop record
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

    const playRecording = async (index) => {
        if (playingRecordingIndex !== index) {
            // If another recording is playing, stop it first
            if (playingRecordingIndex !== null) {
                // Stop the currently playing recording
              
            }

            // Start playing the selected recording
            const uri = recordings[index];
            const { sound } = await Audio.Sound.createAsync({ uri });

            setPlayingRecordingIndex(index); // Mark this recording as playing

            await sound.playAsync();

            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.didJustFinish) {
                    setPlayingRecordingIndex(null); // Reset playing state
                    await sound.unloadAsync();
                }
            });
        } else {
            
            setPlayingRecordingIndex(null); // Reset playing state
        }
    };


    const renderSoundEffectButton = (key) => {
        const isPlaying = soundStatus[key]?.isPlaying;
        const buttonStyle = isPlaying
            ? [styles.button, styles.playingButton]
            : styles.button;

        return (
            <TouchableOpacity
                key={key}
                style={buttonStyle}
                onPress={() => toggleSoundEffect(key)}
            >
                <Text style={styles.buttonText}>{key}</Text>
            </TouchableOpacity>
        );
    };

    const renderPlaybackButton = (uri, index) => {
        const isPlaying = uri && playingSound === uri;
        const buttonStyle = isPlaying
            ? [styles.button, styles.playingButton]
            : styles.button;

        return (
            <TouchableOpacity
                key={index}
                style={buttonStyle}
                onPress={() => playRecording(uri)}
                disabled={!uri}
            >
                <Text style={styles.buttonText}>{uri ? 'Stop Recording' : 'Empty'}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Sound Board</Text>
            </View>

                <View style={styles.content}>
                    {/* Predefined sound effect buttons */}
                        <View style={styles.buttonRow}>
                            {Object.keys(soundEffectFiles).map((key) =>
                                renderSoundEffectButton(key)
                            )}
                        </View>

                        {/* Playback buttons */}
                        <View style={styles.buttonRow}>
                            {recordings.map((uri, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.button,
                                        playingRecordingIndex === index ? styles.playingButton : (uri ? styles.recorded : {})
                                    ]}
                                    onPress={() => playRecording(index)}
                                    disabled={!uri}
                                >
                                    <Text style={[
                                        styles.buttonText,
                                        playingRecordingIndex === index || uri ? styles.whiteText : {}
                                    ]}>
                                        Record {index + 1}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {/* Record button */}
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.button, isRecording ? styles.recordingButton : {}]}
                                onPress={handleRecordPress}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    isRecording ? styles.whiteText : {}
                                ]}>
                                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 30,
      
    },
    header: {
        width: '100%',
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1, 
        borderBottomColor: '#ddd', 
    },
    headerTitle: {
        fontSize: 20,
        color: 'black',
        fontWeight: 'bold',
    },

    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
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
    recorded: {
        backgroundColor: 'lightgreen',
        
    },
    playingButton: {
    backgroundColor: 'gold',
  },
    buttonText: {
        fontSize: 18,
        textAlign: 'center',
    },

    whiteText: {
        color: 'white',
    }
});