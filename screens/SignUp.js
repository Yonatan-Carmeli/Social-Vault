import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../FireBase/Config';
import { doc, setDoc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { sendVerificationEmail, verifyCode } from '../utils/emailService';


const backgroundImage = require('../assets/social-bg.jpg');

export default function SignUp({ navigation, route }) {
  const nav = useNavigation();
  const { setIsVerificationInProgress } = route.params || {};
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showDayDropdown, setShowDayDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs for the verification code inputs
  const codeInputRefs = useRef([]);

  // Simple scrollbar state
  const [monthScrollY, setMonthScrollY] = useState(0);
  const [dayScrollY, setDayScrollY] = useState(0);
  const [yearScrollY, setYearScrollY] = useState(0);
  const [monthContentHeight, setMonthContentHeight] = useState(0);
  const [dayContentHeight, setDayContentHeight] = useState(0);
  const [yearContentHeight, setYearContentHeight] = useState(0);

  // Refs for ScrollView components
  const monthScrollViewRef = useRef(null);
  const dayScrollViewRef = useRef(null);
  const yearScrollViewRef = useRef(null);

  React.useEffect(() => {
    nav.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });
  }, []);

  // Debug modal state changes
  React.useEffect(() => {
    console.log('Modal state changed to:', showVerificationModal);
  }, [showVerificationModal]);

  // Send verification email with code
  const sendVerificationEmailWithCode = async (email, userName) => {
    try {
      setIsLoading(true);
      const result = await sendVerificationEmail(email, null, userName);
      
      if (result.success) {
        // Show verification modal and clear any previous errors
        console.log('Email sent successfully, showing modal...');
        setShowVerificationModal(true);
        setError('');
        console.log('Modal state set to true');
        console.log('User should now be signed out, modal should be visible');
      } else {
        Alert.alert(
          'Email Service Unavailable',
          'We couldn\'t send a verification email right now. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      Alert.alert(
        'Email Service Error',
        'We couldn\'t send a verification email right now. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Verify the entered code
  const handleVerifyCode = async () => {
    const codeString = verificationCode.join('');
    if (codeString.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      const result = await verifyCode(email, codeString);
      
      if (result.success) {
        // Code is correct, activate the account
        try {
          // Sign the user back in with the stored credentials
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          if (user) {
            // Update user data with verified status
            const userData = {
              fullName: fullName,
              email: email,
              birthMonth: parseInt(birthMonth),
              birthDay: parseInt(birthDay),
              birthYear: parseInt(birthYear),
              gender: gender,
              createdAt: new Date().toISOString(),
              userId: user.uid,
              emailVerified: true,
              verificationSentAt: new Date().toISOString(),
              verifiedAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'users', user.uid), userData);
            
            // Close modal and clear verification state
            setShowVerificationModal(false);
            setVerificationCode(['', '', '', '', '', '']);
            setIsVerificationInProgress(false);
            
            // The App.js navigation logic will handle the navigation automatically
            // when isVerificationInProgress becomes false and user is authenticated
          }
        } catch (error) {
          console.error('Error updating user data:', error);
          setError('Failed to verify account. Please try again.');
        }
      } else {
        setError(result.message || 'Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // פונקציה לטיפול בתהליך ההרשמה
  const handleSignup = async () => {
    try {
      // Set loading state immediately for better UX
      setIsLoading(true);
      setError('');
      
      // בדיקה שכל השדות מלאים
      if (!fullName || !email || !password || !birthMonth || !birthDay || !birthYear || !gender) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      // Validate email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      // Check if email actually exists
      const isEmailValid = await validateEmailExists(email);
      if (!isEmailValid) {
        setError('Please enter a valid email address that actually exists');
        setIsLoading(false);
        return;
      }

      // Validate age (must be at least 13 years old)
      const birthDate = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
      const today = new Date();
      
      // Check if the date is valid
      if (isNaN(birthDate.getTime())) {
        setError('Please enter a valid date of birth');
        return;
      }
      
      // Check if birth date is in the future
      if (birthDate > today) {
        setError('Birth date cannot be in the future');
        return;
      }
      
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13) {
        setError('You must be at least 13 years old to use this app');
        setIsLoading(false);
        return;
      }

      // יצירת משתמש חדש ב-Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('User registered successfully:', user.email);
      
      // Set verification in progress flag
      setIsVerificationInProgress(true);
      console.log('Verification in progress flag set to true - App should stay on SignUp screen');
      
      // Generate and send verification code
      await sendVerificationEmailWithCode(email, fullName);
      
      // Clear loading state after email is sent
      setIsLoading(false);
      
      // Update user profile with display name
      await updateProfile(user, {
        displayName: fullName
      });
      
      // Store additional user data in Firestore (not verified yet)
      const userData = {
        fullName: fullName,
        email: email,
        birthMonth: parseInt(birthMonth),
        birthDay: parseInt(birthDay),
        birthYear: parseInt(birthYear),
        gender: gender,
        createdAt: new Date().toISOString(),
        userId: user.uid,
        emailVerified: false,
        verificationSentAt: new Date().toISOString(),
        verificationCode: null, // No longer storing code here
        verificationCodeExpiresAt: null // No longer storing expiry here
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
      console.log('User data saved to Firestore, modal should be visible now');
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      
      // טיפול בשגיאות ספציפיות
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // Function to validate if email actually exists
  const validateEmailExists = async (email) => {
    try {
      // Extract domain from email
      const domain = email.split('@')[1];
      
      // Check if domain has valid MX records (mail exchange records)
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
      const data = await response.json();
      
      // If MX records exist, the domain can receive emails
      if (data.Answer && data.Answer.length > 0) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Email validation error:', error);
      // If validation fails, allow the email (fail-safe approach)
      return true;
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const toggleMonthDropdown = () => {
    const newState = !showMonthDropdown;
    setShowMonthDropdown(newState);
    setShowDayDropdown(false);
    setShowYearDropdown(false);
  };

  const toggleDayDropdown = () => {
    const newState = !showDayDropdown;
    setShowDayDropdown(newState);
    setShowMonthDropdown(false);
    setShowYearDropdown(false);
  };

  const toggleYearDropdown = () => {
    const newState = !showYearDropdown;
    setShowYearDropdown(newState);
    setShowMonthDropdown(false);
    setShowDayDropdown(false);
  };

  const selectMonth = (monthIndex) => {
    setBirthMonth((monthIndex + 1).toString().padStart(2, '0'));
    setShowMonthDropdown(false);
  };

  const selectDay = (day) => {
    setBirthDay(day.toString().padStart(2, '0'));
    setShowDayDropdown(false);
  };

  const selectYear = (year) => {
    setBirthYear(year.toString());
    setShowYearDropdown(false);
  };



  // Fixed scrollbar calculation - thumb reaches edges perfectly
  const calculateThumbPosition = (scrollY, contentHeight, dropdownHeight = 200) => {
    if (!contentHeight || contentHeight <= dropdownHeight) return 0;
    
    // Calculate available scroll range
    const maxScrollY = contentHeight - dropdownHeight;
    if (maxScrollY <= 0) return 0;
    
    // Calculate scrollbar dimensions
    const scrollbarHeight = dropdownHeight;
    const thumbHeight = calculateThumbHeight(contentHeight, dropdownHeight);
    const availableScrollbarSpace = scrollbarHeight - thumbHeight;
    
    // Calculate thumb position based on scroll percentage
    const scrollPercentage = scrollY / maxScrollY;
    const thumbPosition = scrollPercentage * availableScrollbarSpace;
    
    // Return position with exact bounds - thumb will reach edges perfectly
    return Math.max(0, Math.min(availableScrollbarSpace, thumbPosition));
  };

  // Calculate thumb height for better scrollbar coverage
  const calculateThumbHeight = (contentHeight, dropdownHeight = 200) => {
    if (!contentHeight || contentHeight <= dropdownHeight) return dropdownHeight;
    
    // Calculate thumb height based on content ratio - ensure it covers the full scrollbar
    const contentRatio = dropdownHeight / contentHeight;
    const thumbHeight = Math.max(20, Math.min(40, dropdownHeight * contentRatio));
    
    return thumbHeight;
  };

  // Simple scroll event handlers
  const handleMonthScroll = (event) => {
    const { contentOffset, contentSize } = event.nativeEvent;
    setMonthScrollY(contentOffset.y);
    setMonthContentHeight(contentSize.height);
  };

  const handleDayScroll = (event) => {
    const { contentOffset, contentSize } = event.nativeEvent;
    setDayScrollY(contentOffset.y);
    setDayContentHeight(contentSize.height);
  };

  const handleYearScroll = (event) => {
    const { contentOffset, contentSize } = event.nativeEvent;
    setYearScrollY(contentOffset.y);
    setYearContentHeight(contentSize.height);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* תמונת רקע למסך */}
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
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.content}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Social-Vault today</Text>

                {/* שדה קלט לשם מלא */}
                <View style={styles.inputContainer}>
                  <MaterialIcons name="person" size={24} color="#4A90E2" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#999"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                  {fullName ? (
                    <TouchableOpacity 
                      onPress={() => { 
                        setFullName(''); 
                        setTimeout(() => Keyboard.dismiss(), 150);
                      }}
                      style={styles.clearButton}
                    >
                      <MaterialIcons name="close" size={20} color="#999" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* שדה קלט לאימייל */}
                <View style={styles.inputContainer}>
                  <MaterialIcons name="email" size={24} color="#4A90E2" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
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
                    autoCapitalize="none"
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

                {/* Date of Birth Section */}
                <Text style={styles.sectionTitle}>Date of Birth</Text>
                <View style={styles.dateContainer}>
                  {/* Month Selection */}
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>Month</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerButton, birthMonth && styles.datePickerButtonSelected]}
                      onPress={toggleMonthDropdown}
                    >
                      <Text style={[styles.datePickerText, birthMonth && styles.datePickerTextSelected]}>
                        {birthMonth ? months[parseInt(birthMonth) - 1] : 'Month'}
                      </Text>
                      <MaterialIcons 
                        name={showMonthDropdown ? "arrow-drop-up" : "arrow-drop-down"} 
                        size={20} 
                        color={birthMonth ? "#4A90E2" : "#999"} 
                      />
                    </TouchableOpacity>
                    
                    {/* Month Dropdown */}
                    {showMonthDropdown && (
                      <View style={styles.dropdownContainer}>
                        <ScrollView 
                          ref={monthScrollViewRef}
                          style={styles.dropdownScrollView} 
                          showsVerticalScrollIndicator={Platform.OS === 'web'}
                          onScroll={handleMonthScroll}
                          scrollEventThrottle={16}
                          nestedScrollEnabled={true}
                        >
                          {months.map((month, index) => (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.dropdownOption,
                                parseInt(birthMonth) === (index + 1) && styles.dropdownOptionSelected
                              ]}
                              onPress={() => selectMonth(index)}
                            >
                              <Text style={[
                                styles.dropdownOptionText,
                                parseInt(birthMonth) === (index + 1) && styles.dropdownOptionTextSelected
                              ]}>
                                {month}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        
                        {/* Visual Scrollbar - Only on Mobile */}
                        {Platform.OS !== 'web' && (
                          <View style={styles.scrollbarContainer}>
                            <View style={styles.scrollbarTrack} />
                            <View 
                              style={[
                                styles.scrollbarThumb,
                                {
                                  top: calculateThumbPosition(monthScrollY, monthContentHeight),
                                  height: calculateThumbHeight(monthContentHeight)
                                }
                              ]} 
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Day Selection */}
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>Day</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerButton, birthDay && styles.datePickerButtonSelected]}
                      onPress={toggleDayDropdown}
                    >
                      <Text style={[styles.datePickerText, birthDay && styles.datePickerTextSelected]}>
                        {birthDay || 'Day'}
                      </Text>
                      <MaterialIcons 
                        name={showDayDropdown ? "arrow-drop-up" : "arrow-drop-down"} 
                        size={20} 
                        color={birthDay ? "#4A90E2" : "#999"} 
                      />
                    </TouchableOpacity>
                    
                    {/* Day Dropdown */}
                    {showDayDropdown && (
                      <View style={styles.dropdownContainer}>
                        <ScrollView 
                          ref={dayScrollViewRef}
                          style={styles.dropdownScrollView} 
                          showsVerticalScrollIndicator={Platform.OS === 'web'}
                          onScroll={handleDayScroll}
                          scrollEventThrottle={16}
                          nestedScrollEnabled={true}
                        >
                          {days.map((day) => (
                            <TouchableOpacity
                              key={day}
                              style={[
                                styles.dropdownOption,
                                parseInt(birthDay) === day && styles.dropdownOptionSelected
                              ]}
                              onPress={() => selectDay(day)}
                            >
                              <Text style={[
                                styles.dropdownOptionText,
                                parseInt(birthDay) === day && styles.dropdownOptionTextSelected
                              ]}>
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        
                        {/* Visual Scrollbar - Only on Mobile */}
                        {Platform.OS !== 'web' && (
                          <View style={styles.scrollbarContainer}>
                            <View style={styles.scrollbarTrack} />
                            <View 
                              style={[
                                styles.scrollbarThumb,
                                {
                                  top: calculateThumbPosition(dayScrollY, dayContentHeight),
                                  height: calculateThumbHeight(dayContentHeight)
                                }
                              ]} 
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Year Selection */}
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>Year</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerButton, birthYear && styles.datePickerButtonSelected]}
                      onPress={toggleYearDropdown}
                    >
                      <Text style={[styles.datePickerText, birthYear && styles.datePickerTextSelected]}>
                        {birthYear || 'Year'}
                      </Text>
                      <MaterialIcons 
                        name={showYearDropdown ? "arrow-drop-up" : "arrow-drop-down"} 
                        size={20} 
                        color={birthYear ? "#4A90E2" : "#999"} 
                      />
                    </TouchableOpacity>
                    
                    {/* Year Dropdown */}
                    {showYearDropdown && (
                      <View style={styles.dropdownContainer}>
                        <ScrollView 
                          ref={yearScrollViewRef}
                          style={styles.dropdownScrollView} 
                          showsVerticalScrollIndicator={Platform.OS === 'web'}
                          onScroll={handleYearScroll}
                          scrollEventThrottle={16}
                          nestedScrollEnabled={true}
                        >
                          {years.map((year) => (
                            <TouchableOpacity
                              key={year}
                              style={[
                                styles.dropdownOption,
                                parseInt(birthYear) === year && styles.dropdownOptionSelected
                              ]}
                              onPress={() => selectYear(year)}
                            >
                              <Text style={[
                                styles.dropdownOptionText,
                                parseInt(birthYear) === year && styles.dropdownOptionTextSelected
                              ]}>
                                {year}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        
                        {/* Visual Scrollbar - Only on Mobile */}
                        {Platform.OS !== 'web' && (
                          <View style={styles.scrollbarContainer}>
                            <View style={styles.scrollbarTrack} />
                            <View 
                              style={[
                                styles.scrollbarThumb,
                                {
                                  top: calculateThumbPosition(yearScrollY, yearContentHeight),
                                  height: calculateThumbHeight(yearContentHeight)
                                }
                              ]} 
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Gender Selection */}
                <Text style={styles.sectionTitle}>Gender</Text>
                <View style={styles.genderContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.genderButton, 
                      gender === 'male' && styles.genderButtonSelected
                    ]}
                    onPress={() => setGender('male')}
                  >
                    <MaterialIcons 
                      name="male" 
                      size={32} 
                      color={gender === 'male' ? '#4A90E2' : '#999'} 
                    />
                    <Text style={[
                      styles.genderText, 
                      gender === 'male' && styles.genderTextSelected
                    ]}>
                      Male
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      styles.genderButton, 
                      gender === 'female' && styles.genderButtonSelected
                    ]}
                    onPress={() => setGender('female')}
                  >
                    <MaterialIcons 
                      name="female" 
                      size={32} 
                      color={gender === 'female' ? '#4A90E2' : '#999'} 
                    />
                    <Text style={[
                      styles.genderText, 
                      gender === 'female' && styles.genderTextSelected
                    ]}>
                      Female
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* הצגת הודעת שגיאה אם קיימת */}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* כפתור הרשמה */}
                <TouchableOpacity 
                  style={[styles.button, isLoading && styles.buttonDisabled]} 
                  onPress={handleSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.buttonText}>Signing Up...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="person-add" size={24} color="white" />
                      <Text style={styles.buttonText}>Sign Up</Text>
                    </>
                  )}
                </TouchableOpacity>



                {/* קישור להתחברות */}
                <TouchableOpacity 
                  style={styles.loginLink} 
                  onPress={() => navigation.navigate('LogIn')}
                >
                  <Text style={styles.loginLinkText}>
                    Already have an account? <Text style={styles.loginLinkTextBold}>Log in!</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>

      {/* Verification Modal */}
      <Modal
        visible={showVerificationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVerificationModal(false)}
        onShow={() => console.log('Modal is now visible')}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="email" size={28} color="#4A90E2" />
              <Text style={styles.modalTitle}>Email Verification</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>
              We've sent a 6-digit verification code to:
            </Text>
            <Text style={styles.modalEmail}>{email}</Text>
            
            <Text style={styles.modalInstruction}>
              Please check your email and enter the code below
            </Text>
            
            {/* Individual input boxes for each digit */}
            <View style={styles.modalCodeInputContainer}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (codeInputRefs.current[index] = ref)}
                  style={styles.modalCodeInput}
                  value={verificationCode[index]}
                  onChangeText={(text) => {
                    if (text.length <= 1 && /^[0-9]*$/.test(text)) {
                      const newCode = [...verificationCode];
                      newCode[index] = text;
                      setVerificationCode(newCode);
                      
                      // Auto-focus next input if a digit was entered
                      if (text && index < 5) {
                        setTimeout(() => {
                          codeInputRefs.current[index + 1]?.focus();
                        }, 50);
                      }
                      
                      // Auto-focus previous input if digit was deleted
                      if (!text && index > 0) {
                        setTimeout(() => {
                          codeInputRefs.current[index - 1]?.focus();
                        }, 50);
                      }
                    }
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    // Handle backspace to go to previous input
                    if (nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
                      setTimeout(() => {
                        codeInputRefs.current[index - 1]?.focus();
                      }, 50);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={index === 0}
                />
              ))}
            </View>
            
            {/* Error message */}
            {error ? <Text style={styles.modalErrorText}>{error}</Text> : null}
            
            <TouchableOpacity 
              style={[
                styles.modalVerifyButton,
                verificationCode.join('').length === 6 && styles.modalVerifyButtonActive
              ]} 
              onPress={handleVerifyCode}
              disabled={verificationCode.join('').length !== 6 || isLoading}
            >
              <MaterialIcons name="check-circle" size={24} color="white" />
              <Text style={styles.modalVerifyButtonText}>
                {isLoading ? 'VERIFYING...' : 'VERIFY CODE'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalResendButton}
              onPress={async () => {
                try {
                  await sendVerificationEmailWithCode(email, fullName);
                } catch (error) {
                  console.error('Error resending code:', error);
                  Alert.alert(
                    'Error',
                    'Failed to resend the code. Please try again.',
                    [{ text: 'OK' }]
                  );
                }
              }}
              disabled={isLoading}
            >
              <Text style={styles.modalResendButtonText}>Resend Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setShowVerificationModal(false);
                setVerificationCode(['', '', '', '', '', '']);
                setError('');
              }}
            >
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  content: {
    width: '85%',
    alignSelf: 'center',
    paddingVertical: 15,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 3,
    textAlign: 'center',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    marginBottom: 12,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 45,
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
    padding: 12,
    borderRadius: 20,
    marginTop: 15,
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
  buttonDisabled: {
    backgroundColor: '#6BA3D6',
    opacity: 0.8,
  },
  loginLink: {
    marginTop: 15,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#fff',
    fontSize: 14,
  },
  loginLinkTextBold: {
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
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 15,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateInputContainer: {
    flex: 1,
    marginHorizontal: 3,
    position: 'relative',
  },
  dateLabel: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 4,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#999',
    minHeight: 40,
  },
  datePickerButtonSelected: {
    borderColor: '#4A90E2',
    borderWidth: 2,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  datePickerText: {
    color: '#999',
    fontSize: 14,
  },
  datePickerTextSelected: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  // Dropdown styles
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#999',
    maxHeight: 200,
    zIndex: 1000,
    marginTop: 2,
  },
  dropdownScrollView: {
    maxHeight: 200,
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  // Enhanced scrollbar styles
  scrollbarContainer: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 4,
    zIndex: 1001,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },

  scrollbarTrack: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 4,
  },
  scrollbarThumb: {
    position: 'absolute',
    right: 0,
    width: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.8)',
    borderRadius: 4,
    minHeight: 20,
    maxHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
  },
  dropdownOptionText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  dropdownOptionTextSelected: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  // Gender button background styles
  genderButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 90,
  },
  genderButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderWidth: 2,
  },
  genderText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  genderTextSelected: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  verificationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 25,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  verificationTitle: {
    color: '#4A90E2',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(74, 144, 226, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verificationSubtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  verificationEmail: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  codeInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  verifyButtonActive: {
    backgroundColor: '#28a745', // A different color for active state
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  resendButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: 'transparent',
  },
  resendButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    width: Dimensions.get('window').width - 40,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  modalEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInstruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  modalCodeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  modalCodeInput: {
    width: 45,
    height: 45,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#ffffff',
  },
  modalErrorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  modalVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 25,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalVerifyButtonActive: {
    backgroundColor: '#28a745',
  },
  modalVerifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  modalResendButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: 'transparent',
  },
  modalResendButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
});