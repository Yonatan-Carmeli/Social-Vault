import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

const { width } = Dimensions.get('window');

export default function ErrorDialog({ visible, error, onClose }) {
  const { isDarkMode } = useTheme();

  if (!error) return null;

  // Memoize computed values to prevent unnecessary recalculations
  const { errorIcon, errorColor, errorBackground, buttonText } = useMemo(() => {
    const getErrorIcon = () => {
      switch (error.type) {
        case 'rate_limited':
          return 'timer';
        case 'network_error':
          return 'wifi-off';
        case 'permission_denied':
          return 'block';
        case 'success':
          return 'check-circle';
        default:
          return 'error';
      }
    };

    const getErrorColor = () => {
      switch (error.type) {
        case 'rate_limited':
          return '#FF9800'; // Orange for rate limiting
        case 'network_error':
          return '#F44336'; // Red for network errors
        case 'permission_denied':
          return '#9C27B0'; // Purple for permission issues
        case 'success':
          return '#4CAF50'; // Green for success
        default:
          return '#F44336'; // Default red
      }
    };

    const getErrorBackground = () => {
      switch (error.type) {
        case 'rate_limited':
          return isDarkMode ? '#2D1B0E' : '#FFF3E0'; // Dark orange / Light orange
        case 'network_error':
          return isDarkMode ? '#2D0B0B' : '#FFEBEE'; // Dark red / Light red
        case 'permission_denied':
          return isDarkMode ? '#2D0B2D' : '#F3E5F5'; // Dark purple / Light purple
        case 'success':
          return isDarkMode ? '#0B2D0B' : '#E8F5E8'; // Dark green / Light green
        default:
          return isDarkMode ? '#2D0B0B' : '#FFEBEE'; // Default dark red / light red
      }
    };

    const getButtonText = () => {
      switch (error.type) {
        case 'success':
          return 'Great!';
        default:
          return 'Got it';
      }
    };

    return {
      errorIcon: getErrorIcon(),
      errorColor: getErrorColor(),
      errorBackground: getErrorBackground(),
      buttonText: getButtonText()
    };
  }, [error.type, isDarkMode]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.dialog,
          {
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            borderColor: errorColor + '30'
          }
        ]}>
          {/* Header with icon */}
          <View style={[
            styles.header,
            { backgroundColor: errorBackground }
          ]}>
            <View style={[
              styles.iconContainer,
              { backgroundColor: errorColor + '20' }
            ]}>
              <MaterialIcons 
                name={errorIcon} 
                size={32} 
                color={errorColor} 
              />
            </View>
            <Text style={[
              styles.title,
              { color: isDarkMode ? '#ffffff' : '#333333' }
            ]}>
              {error.title}
            </Text>
          </View>

          {/* Message */}
          <View style={styles.content}>
            <Text style={[
              styles.message,
              { color: isDarkMode ? '#cccccc' : '#666666' }
            ]}>
              {error.message}
            </Text>
            
            {error.url && (
              <View style={styles.urlContainer}>
                <MaterialIcons name="link" size={16} color="#4A90E2" />
                <Text style={[
                  styles.urlText,
                  { color: isDarkMode ? '#4A90E2' : '#4A90E2' }
                ]} numberOfLines={2}>
                  {error.url}
                </Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: errorColor }
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  content: {
    padding: 24,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.2)',
  },
  urlText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontFamily: 'monospace',
  },
  actions: {
    padding: 24,
    paddingTop: 0,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButton: {
    minWidth: 120,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
