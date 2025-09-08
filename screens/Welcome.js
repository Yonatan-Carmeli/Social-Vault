import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// ייבוא תמונת הרקע
const backgroundImage = require('../assets/social-bg.jpg');

const Welcome = ({ navigation }) => {
    // הגדרת משתני ניווט
    const nav = useNavigation();

    // הסרת הכותרת העליונה ומניעת חזרה אחורה
    React.useEffect(() => {
        nav.setOptions({
            headerShown: false,
            header: () => null,
            gestureEnabled: false,
        });
    }, []);

    return (
        // תמונת רקע למסך
        <ImageBackground 
            source={backgroundImage}
            style={styles.background}
            resizeMode="cover"
        >
            {/* שכבת כיסוי כהה */}
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* טקסטים ראשיים */}
                    <Text style={styles.welcomeText}>Welcome to</Text>
                    <Text style={styles.appName}>Social-Vault</Text>
                    <Text style={styles.subtitle}>Your Personal Social Media Manager</Text>
                    
                    {/* מיכל הכפתורים */}
                    <View style={styles.buttonContainer}>
                        {/* כפתור הרשמה */}
                        <TouchableOpacity 
                            style={[styles.button, styles.signUpButton]}
                            onPress={() => navigation.navigate('SignUp')}
                        >
                            <MaterialIcons name="person-add" size={24} color="white" />
                            <Text style={styles.buttonText}>Sign Up</Text>
                        </TouchableOpacity>

                        {/* כפתור התחברות */}
                        <TouchableOpacity 
                            style={[styles.button, styles.loginButton]}
                            onPress={() => navigation.navigate('LogIn')}
                        >
                            <MaterialIcons name="login" size={24} color="white" />
                            <Text style={styles.buttonText}>Log In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ImageBackground>
    );
};

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
    // עיצוב תמונת הרקע
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    // שכבת הכיסוי הכהה
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // מיכל התוכן הראשי
    content: {
        width: '80%',
        alignItems: 'center',
    },
    // עיצוב טקסט הברוכים הבאים
    welcomeText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '300',
        marginBottom: 5,
    },
    // עיצוב שם האפליקציה
    appName: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    // עיצוב כותרת המשנה
    subtitle: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 40,
        textAlign: 'center',
    },
    // מיכל הכפתורים
    buttonContainer: {
        width: '100%',
        gap: 15,
    },
    // עיצוב בסיסי לכפתורים
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 25,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    // עיצוב כפתור ההרשמה
    signUpButton: {
        backgroundColor: '#4A90E2',
    },
    // עיצוב כפתור ההתחברות
    loginButton: {
        backgroundColor: '#2C3E50',
    },
    // עיצוב טקסט הכפתורים
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
    },
});

export default Welcome;
