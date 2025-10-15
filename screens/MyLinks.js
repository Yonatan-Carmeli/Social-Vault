import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Dimensions, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import Footer from '../components/Footer';

const { width: screenWidth } = Dimensions.get('window');

export default function MyLinks() {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { isDarkMode } = useTheme();

  // Sample links data - replace with your actual data source
  const [links, setLinks] = useState([
    {
      id: '1',
      title: 'Instagram Post',
      url: 'https://instagram.com/p/example1',
      platform: 'Instagram',
      dateAdded: '2024-01-15',
      description: 'Amazing sunset photo from my vacation'
    },
    {
      id: '2',
      title: 'YouTube Video',
      url: 'https://youtube.com/watch?v=example2',
      platform: 'YouTube',
      dateAdded: '2024-01-14',
      description: 'Tutorial on React Native development'
    },
    {
      id: '3',
      title: 'TikTok Video',
      url: 'https://tiktok.com/@user/video/example3',
      platform: 'TikTok',
      dateAdded: '2024-01-13',
      description: 'Fun dance challenge video'
    }
  ]);

  // Animation on mount
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle link press
  const handleLinkPress = (link) => {
    Alert.alert(
      'Open Link',
      `Would you like to open "${link.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open', 
          onPress: () => {
            // Here you would implement actual link opening
            console.log('Opening link:', link.url);
          }
        }
      ]
    );
  };

  // Get platform icon
  const getPlatformIcon = (platform) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'photo-camera';
      case 'youtube':
        return 'play-circle-filled';
      case 'tiktok':
        return 'music-note';
      case 'twitter':
        return 'chat';
      case 'facebook':
        return 'people';
      default:
        return 'link';
    }
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return '#E4405F';
      case 'youtube':
        return '#FF0000';
      case 'tiktok':
        return '#000000';
      case 'twitter':
        return '#1DA1F2';
      case 'facebook':
        return '#1877F2';
      default:
        return '#4A90E2';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        {/* Top Left Controls */}
        <View style={styles.topLeftControls}>
          <TouchableOpacity 
            style={[styles.backButton, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
            }]}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons 
              name="arrow-back" 
              size={24} 
              color={isDarkMode ? '#ffffff' : '#333'} 
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.headerText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          My Links
        </Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? '#cccccc' : '#666' }]}>
          All your saved social media links
        </Text>
      </Animated.View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {links.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyState, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="link-off" size={50} color="#4A90E2" style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                No Links Yet
              </Text>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                Your saved social media links will appear here
              </Text>
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.linksList, { opacity: fadeAnim }]}>
            {links.map((link, index) => (
              <TouchableOpacity
                key={link.id}
                style={[styles.linkCard, { 
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => handleLinkPress(link)}
                activeOpacity={0.8}
              >
                <View style={styles.linkHeader}>
                  <View style={[styles.platformIcon, { backgroundColor: getPlatformColor(link.platform) }]}>
                    <MaterialIcons 
                      name={getPlatformIcon(link.platform)} 
                      size={20} 
                      color="#ffffff" 
                    />
                  </View>
                  <View style={styles.linkInfo}>
                    <Text style={[styles.linkTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                      {link.title}
                    </Text>
                    <Text style={[styles.linkPlatform, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                      {link.platform}
                    </Text>
                  </View>
                  <MaterialIcons 
                    name="open-in-new" 
                    size={20} 
                    color={isDarkMode ? '#cccccc' : '#666'} 
                  />
                </View>
                
                <Text style={[styles.linkUrl, { color: isDarkMode ? '#cccccc' : '#666' }]} numberOfLines={1}>
                  {link.url}
                </Text>
                
                {link.description && (
                  <Text style={[styles.linkDescription, { color: isDarkMode ? '#cccccc' : '#666' }]} numberOfLines={2}>
                    {link.description}
                  </Text>
                )}
                
                <Text style={[styles.linkDate, { color: isDarkMode ? '#999' : '#999' }]}>
                  Added {new Date(link.dateAdded).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 50,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  topLeftControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyState: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  linksList: {
    paddingVertical: 8,
  },
  linkCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkPlatform: {
    fontSize: 14,
    opacity: 0.8,
  },
  linkUrl: {
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  linkDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  linkDate: {
    fontSize: 12,
    opacity: 0.7,
  },
});
