import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Linking,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserConsentModal = ({ visible, onConsent, onDecline }) => {
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = async () => {
    try {
      const consent = await AsyncStorage.getItem('userConsent');
      setHasConsented(consent === 'true');
    } catch (error) {
      console.log('Error checking consent status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsent = async () => {
    try {
      await AsyncStorage.setItem('userConsent', 'true');
      setHasConsented(true);
      onConsent();
    } catch (error) {
      console.log('Error saving consent:', error);
      Alert.alert('Error', 'Failed to save consent. Please try again.');
    }
  };

  const handleDecline = async () => {
    try {
      await AsyncStorage.setItem('userConsent', 'false');
      setHasConsented(false);
      onDecline();
    } catch (error) {
      console.log('Error saving decline:', error);
    }
  };

  const openPrivacyPolicy = () => {
    // You can replace this with your actual privacy policy URL
    Linking.openURL('https://your-privacy-policy-url.com');
  };

  const openTermsOfService = () => {
    // You can replace this with your actual terms of service URL
    Linking.openURL('https://your-terms-of-service-url.com');
  };

  if (isLoading) {
    return null;
  }

  // If user has already consented, don't show the modal
  if (hasConsented) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <MaterialIcons name="security" size={32} color="#4a90e2" />
            <Text style={styles.title}>Data Collection Consent</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              To provide you with beautiful link previews and thumbnails, SocialVault needs to collect some information from the websites you save.
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What We Collect:</Text>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Website titles and descriptions</Text>
              </View>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Thumbnail images for visual previews</Text>
              </View>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Basic website information (site name, etc.)</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How We Collect It:</Text>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Using legal APIs (like microlink.io)</Text>
              </View>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Respecting website rate limits</Text>
              </View>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Following robots.txt guidelines</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy:</Text>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>We never collect personal information</Text>
              </View>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>Data is stored securely on your device</Text>
              </View>
              <View style={styles.bulletPoint}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.bulletText}>You can revoke consent anytime</Text>
              </View>
            </View>

            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={openPrivacyPolicy} style={styles.legalLink}>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>•</Text>
              <TouchableOpacity onPress={openTermsOfService} style={styles.legalLink}>
                <Text style={styles.legalLinkText}>Terms of Service</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.declineButton]} 
              onPress={handleDecline}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.consentButton]} 
              onPress={handleConsent}
            >
              <Text style={styles.consentButtonText}>I Agree</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            By agreeing, you consent to the collection and use of website metadata to enhance your SocialVault experience.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    textAlign: 'center',
  },
  content: {
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    lineHeight: 20,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  legalLink: {
    padding: 8,
  },
  legalLinkText: {
    fontSize: 14,
    color: '#4a90e2',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 16,
    color: '#ccc',
    marginHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  consentButton: {
    backgroundColor: '#4a90e2',
  },
  consentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default UserConsentModal;
