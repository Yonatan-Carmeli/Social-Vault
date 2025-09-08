import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../FireBase/Config';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { sendPasswordResetEmail } from '../utils/emailService';

const backgroundImage = require('../assets/social-bg.jpg');

const LogIn = ({ navigation }) => {
  const nav = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    nav.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });
  }, []);

  // פונקציה לטיפול בתהליך ההתחברות
  const handleLogin = async () => {
    // בדיקה שכל השדות מלאים
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      // ניסיון להתחבר עם Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
        
      
      console.log('User logged in successfully:', user.email);
      // מעבר למסך הראשי לאחר התחברות מוצלחת
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainScreen' }],
      });
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to log in. Please try again.';
      
      // טיפול בשגיאות ספציפיות
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      setError(errorMessage);
    }
  };

  // פונקציה לטיפול באיפוס סיסמה
  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setIsLoading(true);
      
      // Send password reset email via Cloud Function
      const result = await sendPasswordResetEmail(email, null, 'User');
      
      if (result.success) {
        Alert.alert(
          'Password Reset Email Sent!',
          `We've sent a 6-digit password reset code to ${email}.\n\nPlease check your email and use the code to reset your password.\n\nNote: Check your spam folder if you don't see the email.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setResetMessage('Password reset code sent! Please check your email for the 6-digit code.');
                setError('');
              }
            }
          ]
        );
      } else {
        setError('Failed to send reset email. Please try again.');
        setResetMessage('');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Failed to send reset email. Please try again.');
      setResetMessage('');
    } finally {
      setIsLoading(false);
    }
  };




  return (
    // תמונת רקע למסך
    <ImageBackground 
      source={backgroundImage}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        {/* התאמת המסך למקלדת */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            {/* שדה קלט לאימייל */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {email ? (
                <TouchableOpacity 
                  onPress={() => { 
                    setEmail(''); 
                    setTimeout(() => Keyboard.dismiss(), 150);
                  }}
                  style={styles.clearButton}
                >
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* שדה קלט לסיסמה */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
              />
              {password ? (
                <TouchableOpacity 
                  onPress={() => { 
                    setPassword(''); 
                    setTimeout(() => Keyboard.dismiss(), 150);
                  }}
                  style={styles.clearButton}
                >
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
              {/* כפתור להצגת/הסתרת סיסמה */}
              <TouchableOpacity 
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                style={styles.eyeIcon}
              >
                <MaterialIcons 
                  name={isPasswordVisible ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#4A90E2" 
                />
              </TouchableOpacity>
            </View>

            {/* הצגת הודעת שגיאה אם קיימת */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {resetMessage ? <Text style={styles.successText}>{resetMessage}</Text> : null}



            {/* כפתור התחברות */}
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleLogin}
            >
              <MaterialIcons name="login" size={24} color="white" />
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>

            {/* כפתור איפוס סיסמה */}
            <TouchableOpacity 
              style={styles.forgotPasswordButton} 
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* קישור להרשמה */}
            <TouchableOpacity 
              style={styles.signupLink} 
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  navigation.navigate('SignUp');
                }, 100);
              }}
            >
              <Text style={styles.signupLinkText}>
                Don't have an account? <Text style={styles.signupLinkTextBold}>Sign up!</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
};

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    width: '80%',
    alignSelf: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 25,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  signupLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  signupLinkText: {
    color: '#fff',
    fontSize: 14,
  },
  signupLinkTextBold: {
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 10,
    borderRadius: 10,
  },
  successText: {
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 10,
    borderRadius: 10,
  },
  forgotPasswordButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },

});

export default LogIn;

