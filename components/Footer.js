// ייבוא הספריות והרכיבים הנדרשים
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

// רכיב תפריט הניווט התחתון
const Footer = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDarkMode } = useTheme();

  // בדיקה האם הנתיב הנוכחי פעיל
  const isActive = (routeName) => {
    return route.name === routeName;
  };

  return (
    <View style={[styles.footer, { 
      backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
      borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e1e1e1'
    }]}>
      {/* כפתור אוספים */}
      <TouchableOpacity 
        style={[styles.button, isActive('Collections') && { 
          backgroundColor: isDarkMode ? '#4a4a4a' : '#f0f5ff',
          ...(isDarkMode ? {} : {
            shadowColor: '#4A90E2',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          })
        }]}
        onPress={() => navigation.navigate('Collections')}
      >
        <MaterialIcons 
          name="collections" 
          size={24} 
          color={isActive('Collections') ? '#2A6BB0' : '#4A90E2'} 
        />
        <Text style={[styles.buttonText, { 
          color: isActive('Collections') ? '#2A6BB0' : '#4A90E2'
        }, isActive('Collections') && styles.activeText]}>Collections</Text>
        {isActive('Collections') && <View style={styles.underline} />}
      </TouchableOpacity>

      {/* כפתור רשתות חברתיות */}
      <TouchableOpacity 
        style={[styles.button, isActive('MainScreen') && { 
          backgroundColor: isDarkMode ? '#4a4a4a' : '#f0f5ff',
          ...(isDarkMode ? {} : {
            shadowColor: '#4A90E2',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          })
        }]}
                  onPress={() => navigation.navigate('MainScreen')}
      >
        <MaterialIcons 
          name="people" 
          size={24} 
                      color={isActive('MainScreen') ? '#2A6BB0' : '#4A90E2'} 
        />
        <Text style={[styles.buttonText, { 
                      color: isActive('MainScreen') ? '#2A6BB0' : '#4A90E2'
                  }, isActive('MainScreen') && styles.activeText]}>Social</Text>
        {isActive('MainScreen') && <View style={styles.underline} />}
      </TouchableOpacity>

      {/* כפתור פרופיל/הגדרות */}
      <TouchableOpacity 
        style={[styles.button, isActive('Profile') && { 
          backgroundColor: isDarkMode ? '#4a4a4a' : '#f0f5ff',
          ...(isDarkMode ? {} : {
            shadowColor: '#4A90E2',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          })
        }]}
        onPress={() => navigation.navigate('Profile')}
      >
        <MaterialIcons 
          name="person" 
          size={24} 
          color={isActive('Profile') ? '#2A6BB0' : '#4A90E2'} 
        />
        <Text style={[styles.buttonText, { 
          color: isActive('Profile') ? '#2A6BB0' : '#4A90E2'
        }, isActive('Profile') && styles.activeText]}>Profile</Text>
        {isActive('Profile') && <View style={styles.underline} />}
      </TouchableOpacity>
    </View>
  );
};

// הגדרות העיצוב של התפריט התחתון
const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    width: 80,
    height: 60,
    position: 'relative',
  },
  buttonText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  activeText: {
    color: '#2A6BB0',
    fontWeight: '600',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#2A6BB0',
    borderRadius: 2,
  },
});

export default Footer; 