import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Footer from '../components/Footer';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

export default function MainScreen() {
  const navigation = useNavigation();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const { isDarkMode } = useTheme();

  React.useEffect(() => {
    // הסרת הכותרת העליונה ומניעת חזרה אחורה
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });

    // הפעלת אנימציית הופעה הדרגתית
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // פונקציה לטיפול בלחיצה על אייקון רשת חברתית
  const handleSocialPress = (url) => {
    Linking.openURL(url)
      .catch(err => console.error('An error occurred', err));
  };

  const socialIcons = [
    {
      name: 'YouTube',
      icon: require('../assets/YoutubeIcon.png'),
      url: 'https://www.youtube.com/',
      color: '#FF0000',
    },
    {
      name: 'Instagram',
      icon: require('../assets/InstagramIcon.png'),
      url: 'https://www.instagram.com/',
      color: '#E1306C',
    },
    {
      name: 'Facebook',
      icon: require('../assets/FacebookIcon.png'),
      url: 'https://www.facebook.com/',
      color: '#4267B2',
    },
    {
      name: 'TikTok',
      icon: require('../assets/TikTokIcon.png'),
      url: 'https://www.tiktok.com/',
      color: '#000000',
    },
    {
      name: 'Twitter',
      icon: require('../assets/XIcon.png'),
      url: 'https://twitter.com/',
      color: '#1DA1F2',
    },
    {
      name: 'Snapchat',
      icon: require('../assets/SnapchatIcon.png'),
      url: 'https://www.snapchat.com/',
      color: '#FFFC00',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
      {/* כותרת המסך עם אנימציה */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={[styles.headerText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Social Networks</Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? '#cccccc' : '#666' }]}>Connect with your favorite platforms</Text>
      </Animated.View>

      {/* רשימת הרשתות החברתיות */}
      <ScrollView style={styles.content}>
        <Animated.View style={[styles.grid, { opacity: fadeAnim }]}>
          {/* הצגת כל אייקון רשת חברתית */}
          {socialIcons.map((social, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.square, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : social.color + '08', // Very light brand color tint (8% opacity)
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }]}
              onPress={() => handleSocialPress(social.url)}
              activeOpacity={0.7}
            >
              {/* מיכל האייקון עם צבע רקע */}
              <View style={[styles.iconContainer, { backgroundColor: social.color + '20' }]}>
                <Image
                  source={social.icon}
                  style={[
                    styles.image,
                    // Individual icon size adjustments for visual consistency
                    social.name === 'Instagram' && { width: 50, height: 50 }, // Instagram glyph - make it bigger
                    social.name === 'TikTok' && { width: 52, height: 52 }, // TikTok note - make it bigger
                    social.name === 'Facebook' && { width: 48, height: 48 }, // Facebook 'f' - make it bigger
                    social.name === 'Twitter' && { width: 40, height: 40 }, // Twitter 'X' - make it smaller
                    social.name === 'Snapchat' && { width: 46, height: 46 }, // Snapchat ghost - make it bigger
                    social.name === 'YouTube' && { width: 70, height: 70 }, // YouTube play button - make it bigger to fill container
                  ]}
                  resizeMode="contain"
                />
              </View>
              {/* שם הרשת החברתית */}
              <Text style={[styles.socialName, { color: isDarkMode ? '#ffffff' : '#333' }]}>{social.name}</Text>
              {/* אייקון חץ */}
              <MaterialIcons 
                name="arrow-forward" 
                size={24} 
                color={social.color} 
                style={styles.arrowIcon}
              />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* כותרת תחתונה */}
      <Footer />
    </View>
  );
}

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerText: {
    color: '#333',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  square: {
    width: '48%',
    height: 160,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Removed shadow and border for consistent background
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    // Brand compliance: Clear space padding
    padding: 15,
  },
  image: {
    width: 50,
    height: 50,
    // Brand compliance: All icons meet minimum size requirements
    // Instagram: 29x29px ✅ (50px > 29px)
    // TikTok: 16px ✅ (50px > 16px) 
    // Twitter: 32px ✅ (50px > 32px)
    // Snapchat: 18px ✅ (50px > 18px)
    // Facebook: Equal size ✅
  },
  socialName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  arrowIcon: {
    position: 'absolute',
    right: 15,
    bottom: 15,
  },
}); 