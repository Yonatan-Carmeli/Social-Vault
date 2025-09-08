import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Switch, StatusBar, Platform, TextInput, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../FireBase/Config.js';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Footer from '../components/Footer';

export default function Profile() {
  const navigation = useNavigation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  
  // API Token Management State
  const [apiTokens, setApiTokens] = useState({
    instagram: '',
    tiktok: '',
    youtube: '',
    twitter: '',
    facebook: ''
  });
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState('');
  const [tempToken, setTempToken] = useState('');

  useEffect(() => {
    setCurrentUser(auth.currentUser);
  }, []);

  // Fetch additional user data from Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserData(userData);
          
          // Load API tokens if they exist
          if (userData.apiTokens) {
            setApiTokens(userData.apiTokens);
          }
        } else {
          // User document doesn't exist, create it
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              apiTokens: {
                instagram: '',
                tiktok: '',
                youtube: '',
                twitter: '',
                facebook: ''
              }
            });
          } catch (error) {
            console.error('Error creating user document:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [currentUser?.uid]);

  // Save API tokens to Firestore
  const saveApiTokens = async (newTokens) => {
    if (!currentUser?.uid) return;
    
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        apiTokens: newTokens,
        lastUpdated: new Date().toISOString()
      });
      setApiTokens(newTokens);
      Alert.alert('Success', 'API tokens saved successfully!');
    } catch (error) {
      console.error('Error saving API tokens:', error);
      Alert.alert('Error', 'Failed to save API tokens. Please try again.');
    }
  };

  // Open token editing modal
  const openTokenModal = (platform) => {
    setEditingPlatform(platform);
    setTempToken(apiTokens[platform] || '');
    setTokenModalVisible(true);
  };

  // Save token from modal
  const saveToken = () => {
    if (!editingPlatform) return;
    
    const newTokens = { ...apiTokens };
    newTokens[editingPlatform] = tempToken.trim();
    
    saveApiTokens(newTokens);
    setTokenModalVisible(false);
    setTempToken('');
    setEditingPlatform('');
  };

  // Clear token
  const clearToken = (platform) => {
    Alert.alert(
      'Clear Token',
      `Are you sure you want to clear your ${platform} API token?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const newTokens = { ...apiTokens };
            newTokens[platform] = '';
            saveApiTokens(newTokens);
          }
        }
      ]
    );
  };

  // Get platform display info
  const getPlatformInfo = (platform) => {
    const platforms = {
      instagram: {
        name: 'Instagram',
        icon: 'camera-alt',
        description: 'Access your Instagram saved posts and media',
        apiUrl: 'https://developers.facebook.com/docs/instagram-api/',
        color: '#E4405F'
      },
      tiktok: {
        name: 'TikTok',
        icon: 'video-library',
        description: 'Access your TikTok favorites and videos',
        apiUrl: 'https://developers.tiktok.com/',
        color: '#000000'
      },
      youtube: {
        name: 'YouTube',
        icon: 'play-circle-filled',
        description: 'Access your YouTube playlists and saved videos',
        apiUrl: 'https://developers.google.com/youtube/v3',
        color: '#FF0000'
      },
      twitter: {
        name: 'Twitter/X',
        icon: 'chat',
        description: 'Access your Twitter bookmarks and tweets',
        apiUrl: 'https://developer.twitter.com/en/docs',
        color: '#1DA1F2'
      },
      facebook: {
        name: 'Facebook',
        icon: 'facebook',
        description: 'Access your Facebook saved posts',
        apiUrl: 'https://developers.facebook.com/docs/graph-api/',
        color: '#1877F2'
      }
    };
    return platforms[platform] || {};
  };

  // Helper function for cross-platform alerts
  const showAlert = (title, message, buttons = [{ text: 'OK' }]) => {
    if (Platform.OS === 'web') {
      if (buttons.length === 1) {
        window.alert(`${title}: ${message}`);
      } else {
        // For confirmations, use confirm dialog
        const confirmed = window.confirm(message);
        if (confirmed && buttons.length > 1) {
          // Find the non-cancel button and execute its onPress
          const confirmButton = buttons.find(btn => btn.text !== 'Cancel');
          if (confirmButton && confirmButton.onPress) {
            confirmButton.onPress();
          }
        }
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleSignOut = async () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              // Don't navigate manually - let the auth state change handle navigation
              // The App.js will automatically redirect to Welcome screen when user becomes null
            } catch (error) {
              console.error('Error signing out:', error);
              showAlert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    showAlert(
      'Export Data',
      'This feature will be available soon!',
      [{ text: 'OK' }]
    );
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            showAlert(
              'Confirm Deletion',
              'Are you absolutely sure? This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Yes, Delete My Account', 
                  style: 'destructive',
                  onPress: () => {
                    showAlert('Feature Coming Soon', 'Account deletion will be available in a future update.');
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };


  const ProfileSection = ({ title, children, icon, iconColor }) => (
    <View style={styles.modernSection}>
      <View style={styles.modernSectionHeader}>
        <View style={[styles.modernSectionIcon, { backgroundColor: iconColor + '15' }]}>
          <MaterialIcons name={icon} size={22} color={iconColor} />
        </View>
        <Text style={[styles.modernSectionTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );

  const ProfileItem = ({ icon, title, subtitle, onPress, rightComponent, showArrow = true, iconColor = '#4A90E2' }) => (
    <TouchableOpacity 
      style={[styles.modernProfileItem, { 
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
      }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
    >
      <View style={styles.modernProfileItemLeft}>
        <View style={[styles.modernIconContainer, { backgroundColor: iconColor + '15' }]}>
          <MaterialIcons name={icon} size={26} color={iconColor} />
        </View>
        <View style={styles.modernProfileItemText}>
          <Text style={[styles.modernProfileItemTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.modernProfileItemSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.modernProfileItemRight}>
        {rightComponent}
        {showArrow && onPress && (
          <MaterialIcons 
            name="chevron-right" 
            size={24} 
            color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(26, 26, 26, 0.3)'} 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc' }]}>
      {/* Modern Status Bar */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Modern Gradient Header */}
      <View style={styles.headerContainer}>
        <View style={[styles.header, { 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        }]}>
          {/* Header Background Pattern */}
          <View style={styles.headerBackground}>
            <View style={[styles.headerCircle1, { backgroundColor: isDarkMode ? '#4A90E2' : '#4A90E2' }]} />
            <View style={[styles.headerCircle2, { backgroundColor: isDarkMode ? '#6C5CE7' : '#6C5CE7' }]} />
            <View style={[styles.headerCircle3, { backgroundColor: isDarkMode ? '#00B894' : '#00B894' }]} />
          </View>
          
          {/* Header Content */}
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
              Profile & Settings
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
              Manage your account and preferences
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Modern User Info Section */}
        <ProfileSection title="Account" icon="account-circle" iconColor="#4A90E2">
          <View style={[styles.modernUserCard, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
          }]}>
            <View style={styles.modernUserInfo}>
              <View style={[styles.modernAvatar, { 
                backgroundColor: isDarkMode ? '#4A90E2' : '#4A90E2',
                shadowColor: isDarkMode ? '#4A90E2' : '#4A90E2',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDarkMode ? 0.4 : 0.3,
                shadowRadius: 16,
                elevation: 12,
              }]}>
                <MaterialIcons name="person" size={48} color="white" />
              </View>
              <View style={styles.modernUserDetails}>
                <Text style={[styles.modernUserName, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                  {(currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User').split(' ')[0]}
                </Text>
                <Text style={[styles.modernUserEmail, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                  {currentUser?.email || 'No email'}
                </Text>
                <View style={styles.userStatus}>
                  <View style={[styles.statusDot, { backgroundColor: '#00B894' }]} />
                  <Text style={[styles.statusText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
                    Active Account
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ProfileSection>

        {/* Modern Personal Information Section */}
        {userData && (
          <ProfileSection title="Personal Information" icon="person" iconColor="#4A90E2">
            <View style={[styles.modernInfoCard, { 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
            }]}>
              <View style={styles.modernPersonalInfo}>
                {userData.birthMonth && userData.birthDay && userData.birthYear && (
                  <View style={styles.modernInfoRow}>
                    <View style={[styles.modernInfoIcon, { backgroundColor: '#FF6B6B' + '15' }]}>
                      <MaterialIcons name="cake" size={22} color="#FF6B6B" />
                    </View>
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Birthday: {userData.birthMonth}/{userData.birthDay}/{userData.birthYear}
                    </Text>
                  </View>
                )}
                {userData.gender && (
                  <View style={styles.modernInfoRow}>
                    <View style={[styles.modernInfoIcon, { backgroundColor: '#4ECDC4' + '15' }]}>
                      <MaterialIcons 
                        name={userData.gender === 'male' ? 'male' : 'female'} 
                        size={22} 
                        color="#4ECDC4" 
                      />
                    </View>
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Gender: {userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1)}
                    </Text>
                  </View>
                )}
                {userData.createdAt && (
                  <View style={styles.modernInfoRow}>
                    <View style={[styles.modernInfoIcon, { backgroundColor: '#45B7D1' + '15' }]}>
                      <MaterialIcons name="schedule" size={22} color="#45B7D1" />
                    </View>
                    <Text style={[styles.modernInfoText, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                      Member since: {new Date(userData.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ProfileSection>
        )}

        {/* Preferences Section */}
        <ProfileSection title="Preferences" icon="tune" iconColor="#4A90E2">
          <ProfileItem
            icon={isDarkMode ? "light-mode" : "dark-mode"}
            title="Dark Mode"
            subtitle="Toggle between light and dark themes"
            iconColor={isDarkMode ? "#FFD93D" : "#6C5CE7"}
            rightComponent={
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                thumbColor={isDarkMode ? '#ffffff' : '#ffffff'}
                ios_backgroundColor="#E0E0E0"
                style={styles.modernSwitch}
              />
            }
            showArrow={false}
          />
          
          <ProfileItem
            icon="notifications"
            title="Notifications"
            subtitle="Receive updates about your collections"
            iconColor="#FF6B6B"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                thumbColor={notificationsEnabled ? '#ffffff' : '#ffffff'}
                ios_backgroundColor="#E0E0E0"
                style={styles.modernSwitch}
              />
            }
            showArrow={false}
          />
          
          <ProfileItem
            icon="backup"
            title="Auto Backup"
            subtitle="Automatically backup your data to cloud"
            iconColor="#4ECDC4"
            rightComponent={
              <Switch
                value={autoBackupEnabled}
                onValueChange={setAutoBackupEnabled}
                trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                thumbColor={autoBackupEnabled ? '#ffffff' : '#ffffff'}
                ios_backgroundColor="#E0E0E0"
                style={styles.modernSwitch}
              />
            }
            showArrow={false}
          />

        </ProfileSection>

        {/* Data Management Section */}
        <ProfileSection title="Data Management" icon="storage" iconColor="#4A90E2">
          <ProfileItem
            icon="cloud-download"
            title="Export Data"
            subtitle="Download all your collections and data"
            iconColor="#A8E6CF"
            onPress={handleExportData}
          />
          
          <ProfileItem
            icon="storage"
            title="Storage Usage"
            subtitle="Manage your app storage and cache"
            iconColor="#FFB6C1"
            onPress={() => showAlert('Coming Soon', 'Storage management will be available soon!')}
          />
        </ProfileSection>

        {/* API Tokens Section */}
        <ProfileSection title="API Tokens" icon="api" iconColor="#4A90E2">
          <View style={styles.apiTokensContainer}>
            <Text style={[styles.apiTokensDescription, { color: isDarkMode ? '#B0B0B0' : '#666' }]}>
              Add your API tokens to access private content and get better previews from social media platforms.
            </Text>
            
            {Object.keys(apiTokens).map((platform) => {
              const platformInfo = getPlatformInfo(platform);
              const hasToken = apiTokens[platform] && apiTokens[platform].length > 0;
              
              return (
                <View key={platform} style={[styles.apiTokenItem, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
                  <View style={styles.apiTokenHeader}>
                    <View style={styles.apiTokenInfo}>
                      <MaterialIcons 
                        name={platformInfo.icon} 
                        size={24} 
                        color={platformInfo.color} 
                        style={styles.apiTokenIcon}
                      />
                      <View style={styles.apiTokenDetails}>
                        <Text style={[styles.apiTokenName, { color: isDarkMode ? '#ffffff' : '#000000' }]}>
                          {platformInfo.name}
                        </Text>
                        <Text style={[styles.apiTokenDesc, { color: isDarkMode ? '#B0B0B0' : '#666' }]}>
                          {platformInfo.description}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.apiTokenActions}>
                      {hasToken && (
                        <TouchableOpacity
                          style={[styles.tokenStatus, { backgroundColor: '#4CAF50' }]}
                          onPress={() => openTokenModal(platform)}
                        >
                          <MaterialIcons name="check" size={16} color="#ffffff" />
                          <Text style={styles.tokenStatusText}>Connected</Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        style={[styles.tokenButton, { backgroundColor: hasToken ? '#FF6B6B' : '#4A90E2' }]}
                        onPress={() => hasToken ? clearToken(platform) : openTokenModal(platform)}
                      >
                        <MaterialIcons 
                          name={hasToken ? 'delete' : 'add'} 
                          size={20} 
                          color="#ffffff" 
                        />
                        <Text style={styles.tokenButtonText}>
                          {hasToken ? 'Remove' : 'Add Token'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {hasToken && (
                    <View style={styles.tokenPreview}>
                      <Text style={[styles.tokenPreviewText, { color: isDarkMode ? '#B0B0B0' : '#666' }]}>
                        Token: {apiTokens[platform].substring(0, 20)}...
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ProfileSection>

        {/* Support Section */}
        <ProfileSection title="Support" icon="support-agent" iconColor="#4A90E2">
          <ProfileItem
            icon="help"
            title="Help & FAQ"
            subtitle="Get help and find answers"
            iconColor="#FF8E53"
            onPress={() => showAlert('Coming Soon', 'Help section will be available soon!')}
          />
          
          <ProfileItem
            icon="feedback"
            title="Send Feedback"
            subtitle="Help us improve the app"
            iconColor="#9B59B6"
            onPress={() => showAlert('Coming Soon', 'Feedback system will be available soon!')}
          />
          
          <ProfileItem
            icon="star"
            title="Rate App"
            subtitle="Rate us on the Play Store"
            iconColor="#F1C40F"
            onPress={() => showAlert('Coming Soon', 'App rating will be available soon!')}
          />
        </ProfileSection>

        {/* Account Actions Section */}
        <ProfileSection title="Account" icon="security" iconColor="#4A90E2">
          <ProfileItem
            icon="logout"
            title="Sign Out"
            subtitle="Sign out of your account"
            iconColor="#E74C3C"
            onPress={handleSignOut}
          />
          
          <ProfileItem
            icon="delete-forever"
            title="Delete Account"
            subtitle="Permanently delete your account and data"
            iconColor="#E74C3C"
            onPress={handleDeleteAccount}
          />
        </ProfileSection>

        {/* Terms of Service & App Features Section */}
        <ProfileSection title="Terms of Service & App Features" icon="description" iconColor="#4A90E2">
          <View style={[styles.modernInfoCard, { 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
          }]}>
            <View style={styles.termsContent}>
              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                  <MaterialIcons name="link" size={24} color="#4A90E2" />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Link Preview System
                  </Text>
                </View>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  Our preview system fetches metadata from links to enhance your browsing experience. 
                  Please note that previews may sometimes be limited or unavailable due to:
                </Text>
                <View style={styles.termsList}>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Website restrictions or privacy settings
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Network connectivity issues
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Some sites may only provide title and description
                  </Text>
                  <Text style={[styles.termsListItem, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                    • Preview quality may vary from the actual content
                  </Text>
                </View>
                <Text style={[styles.termsNote, { color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 26, 26, 0.5)' }]}>
                  We continuously work to improve preview accuracy and availability for the best user experience.
                </Text>
              </View>

              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                  <MaterialIcons name="star" size={24} color="#FFD93D" />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Unique App Features
                  </Text>
                </View>
                <View style={styles.featureList}>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="edit" size={20} color="#4A90E2" />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Custom Link Titles
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Edit any link title to make it more descriptive and personal. Perfect when previews aren't available!
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                    <MaterialIcons name="dashboard" size={20} color="#00B894" />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Universal Social Media Hub
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Organize content from ALL social platforms in one beautifully designed, personal space.
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                    <MaterialIcons name="palette" size={20} color="#6C5CE7" />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Multiple Design Themes
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Choose from Modern, Classic, Minimal, and Grid layouts to match your style.
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.featureItem}>
                    <MaterialIcons name="security" size={20} color="#E74C3C" />
                    <View style={styles.featureText}>
                      <Text style={[styles.featureTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                        Privacy-First Approach
                      </Text>
                      <Text style={[styles.featureDescription, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 26, 0.6)' }]}>
                        Your data is protected with secure cloud storage and privacy-first design.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.termsSection}>
                <View style={styles.termsHeader}>
                  <MaterialIcons name="favorite" size={24} color="#FF6B6B" />
                  <Text style={[styles.termsTitle, { color: isDarkMode ? '#ffffff' : '#1a1a1a' }]}>
                    Why SocialVault?
                  </Text>
                </View>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  SocialVault is the only app that lets you organize ALL your social media content in one 
                  beautifully designed, personal space. Unlike other apps that focus on single platforms, 
                  we bring everything together with unique features like custom link titles, multiple design 
                  themes, and a privacy-first approach.
                </Text>
                <Text style={[styles.termsText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 26, 26, 0.7)' }]}>
                  Whether you're saving Instagram posts, YouTube videos, TikTok content, or any other 
                  social media links, SocialVault provides a unified, organized, and personalized experience 
                  that no other app offers.
                </Text>
              </View>
            </View>
          </View>
        </ProfileSection>

        {/* App Info Section */}
        <ProfileSection title="App Information" icon="info" iconColor="#4A90E2">
          <ProfileItem
            icon="info"
            title="Version"
            subtitle="1.0.0"
            iconColor="#3498DB"
            showArrow={false}
          />
          
          <ProfileItem
            icon="code"
            title="Build"
            subtitle="2024.1.0"
            iconColor="#2ECC71"
            showArrow={false}
          />
        </ProfileSection>
      </ScrollView>

      {/* API Token Editing Modal */}
      <Modal
        visible={tokenModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTokenModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#000000' }]}>
                {editingPlatform ? getPlatformInfo(editingPlatform).name : ''} API Token
              </Text>
              <TouchableOpacity
                onPress={() => setTokenModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#ffffff' : '#000000'} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: isDarkMode ? '#B0B0B0' : '#666' }]}>
                Enter your {editingPlatform ? getPlatformInfo(editingPlatform).name : ''} API token to access private content and get better previews.
              </Text>
              
              <TextInput
                style={[styles.tokenInput, { 
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                  color: isDarkMode ? '#ffffff' : '#000000',
                  borderColor: isDarkMode ? '#444' : '#ddd'
                }]}
                value={tempToken}
                onChangeText={setTempToken}
                placeholder="Paste your API token here..."
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                multiline={true}
                numberOfLines={3}
                secureTextEntry={true}
              />
              
              <TouchableOpacity
                style={[styles.helpButton, { backgroundColor: '#4A90E2' }]}
                onPress={() => {
                  const platformInfo = getPlatformInfo(editingPlatform);
                  if (platformInfo.apiUrl) {
                    // Open API documentation URL
                    Alert.alert(
                      'API Documentation',
                      `Visit ${platformInfo.apiUrl} to learn how to get your API token.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Link', onPress: () => {
                          // In a real app, you'd use Linking.openURL(platformInfo.apiUrl)
                          console.log('Open URL:', platformInfo.apiUrl);
                        }}
                      ]
                    );
                  }
                }}
              >
                <MaterialIcons name="help" size={20} color="#ffffff" />
                <Text style={styles.helpButtonText}>How to get API token?</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#f5f5f5' }]}
                onPress={() => setTokenModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#666' }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: '#4A90E2' }]}
                onPress={saveToken}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save Token</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    padding: 32,
    paddingTop: 60,
    alignItems: 'center',
    borderBottomWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBackground: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
  },
  headerCircle1: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.1,
  },
  headerCircle2: {
    position: 'absolute',
    top: 60,
    right: 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.08,
  },
  headerCircle3: {
    position: 'absolute',
    top: 100,
    right: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.06,
  },
  headerContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
  },
  headerSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
  },
  modernSection: {
    marginBottom: 32,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modernSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modernSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modernUserCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modernUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  modernUserDetails: {
    flex: 1,
  },
  modernUserName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  modernUserEmail: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modernProfileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modernProfileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  modernProfileItemText: {
    flex: 1,
  },
  modernProfileItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  modernProfileItemSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  modernProfileItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernInfoCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  modernPersonalInfo: {
    padding: 8,
  },
  modernInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernInfoText: {
    fontSize: 16,
    flex: 1,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modernSwitch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  termsContent: {
    padding: 8,
  },
  termsSection: {
    marginBottom: 32,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  termsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  termsText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  termsList: {
    marginLeft: 8,
    marginBottom: 16,
  },
  termsListItem: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  termsNote: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  
  // API Tokens Styles
  apiTokensContainer: {
    padding: 16,
  },
  apiTokensDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  apiTokenItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  apiTokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  apiTokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  apiTokenIcon: {
    marginRight: 12,
  },
  apiTokenDetails: {
    flex: 1,
  },
  apiTokenName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  apiTokenDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  apiTokenActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  tokenStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  tokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tokenButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  tokenPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  tokenPreviewText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  tokenInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  helpButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
  },
  saveButton: {
    marginLeft: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingRight: 8,
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
});
