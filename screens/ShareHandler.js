import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { db, auth } from '../FireBase/Config.js';
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Footer from '../components/Footer';

const { width: screenWidth } = Dimensions.get('window');

export default function ShareHandler() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDarkMode } = useTheme();
  
  const [sharedContent, setSharedContent] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Get shared content from route params
  useEffect(() => {
    if (route.params?.sharedContent) {
      setSharedContent(route.params.sharedContent);
    }
  }, [route.params]);

  // Get current user and collections
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchCollections(user.uid);
      } else {
        setCurrentUser(null);
        setCollections([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch user's collections
  const fetchCollections = async (userId) => {
    try {
      const collectionsRef = collection(db, 'albums');
      const q = query(collectionsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const collectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCollections(collectionsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching collections:', error);
      setLoading(false);
    }
  };

  // Process shared content and add to collection
  const addToCollection = async () => {
    if (!selectedCollection || !sharedContent) return;

    setProcessing(true);
    try {
      const docRef = doc(db, 'albums', selectedCollection.id);
      
      // Create link object with metadata
      const linkData = {
        url: sharedContent.url,
        title: sharedContent.title || 'Shared Link',
        description: sharedContent.description || '',
        platform: detectPlatform(sharedContent.url),
        sharedAt: new Date().toISOString(),
        originalApp: sharedContent.sourceApp || 'Unknown'
      };

      await updateDoc(docRef, {
        listLink: arrayUnion(linkData)
      });

      Alert.alert(
        'Success!',
        `Link added to "${selectedCollection.title}" collection`,
        [
          {
            text: 'View Collection',
            onPress: () => navigation.navigate('CollectionFormat', { 
              collection: { ...selectedCollection, listLink: [...(selectedCollection.listLink || []), linkData] }
            })
          },
          {
            text: 'Share Another',
            onPress: () => {
              setSelectedCollection(null);
              setSharedContent(null);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error adding link to collection:', error);
      Alert.alert('Error', 'Failed to add link to collection. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Detect social media platform from URL
  const detectPlatform = (url) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('instagram.com')) return 'Instagram';
    if (lowerUrl.includes('facebook.com')) return 'Facebook';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'X (Twitter)';
    if (lowerUrl.includes('youtube.com')) return 'YouTube';
    if (lowerUrl.includes('tiktok.com')) return 'TikTok';
    if (lowerUrl.includes('reddit.com')) return 'Reddit';
    if (lowerUrl.includes('snapchat.com')) return 'Snapchat';
    if (lowerUrl.includes('linkedin.com')) return 'LinkedIn';
    if (lowerUrl.includes('pinterest.com')) return 'Pinterest';
    return 'Other';
  };

  // Get platform icon
  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'Instagram': return 'camera-alt';
      case 'Facebook': return 'facebook';
      case 'X (Twitter)': return 'flutter-dash';
      case 'YouTube': return 'play-circle-outline';
      case 'TikTok': return 'music-note';
      case 'Reddit': return 'forum';
      case 'Snapchat': return 'camera';
      case 'LinkedIn': return 'business';
      case 'Pinterest': return 'photo';
      default: return 'link';
    }
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'Instagram': return '#E4405F';
      case 'Facebook': return '#1877F2';
      case 'X (Twitter)': return '#000000';
      case 'YouTube': return '#FF0000';
      case 'TikTok': return '#000000';
      case 'Reddit': return '#FF4500';
      case 'Snapchat': return '#FFFC00';
      case 'LinkedIn': return '#0A66C2';
      case 'Pinterest': return '#BD081C';
      default: return '#4A90E2';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="hourglass-empty" size={50} color="#4A90E2" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666' }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={50} color="#FF4444" />
          <Text style={[styles.errorText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Please log in to use this feature</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('LogIn')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!sharedContent) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="share" size={50} color="#4A90E2" />
          <Text style={[styles.errorText, { color: isDarkMode ? '#ffffff' : '#333' }]}>No content to share</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (collections.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        <View style={styles.noCollectionsContainer}>
          <MaterialIcons name="collections" size={80} color="#4A90E2" />
          <Text style={[styles.noCollectionsTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            No Collections Found
          </Text>
          <Text style={[styles.noCollectionsText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
            You need to create a collection first before you can save shared links.
          </Text>
          <TouchableOpacity 
            style={styles.createCollectionButton}
            onPress={() => navigation.navigate('Collections')}
          >
            <MaterialIcons name="add" size={24} color="white" />
            <Text style={styles.createCollectionButtonText}>Create Your First Collection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const platform = detectPlatform(sharedContent.url);
  const platformIcon = getPlatformIcon(platform);
  const platformColor = getPlatformColor(platform);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          Save to Collection
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Shared Content Preview */}
      <View style={[styles.contentPreview, { 
        backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }]}>
        <View style={styles.platformInfo}>
          <View style={[styles.platformIcon, { backgroundColor: platformColor }]}>
            <MaterialIcons name={platformIcon} size={24} color="white" />
          </View>
          <View style={styles.platformDetails}>
            <Text style={[styles.platformName, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              {platform}
            </Text>
            <Text style={[styles.platformUrl, { color: isDarkMode ? '#cccccc' : '#666' }]}>
              {sharedContent.url}
            </Text>
          </View>
        </View>
        
        {sharedContent.title && (
          <Text style={[styles.contentTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
            {sharedContent.title}
          </Text>
        )}
        
        {sharedContent.description && (
          <Text style={[styles.contentDescription, { color: isDarkMode ? '#cccccc' : '#666' }]}>
            {sharedContent.description}
          </Text>
        )}
      </View>

      {/* Collection Selection */}
      <View style={styles.selectionSection}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
          Choose Collection
        </Text>
        <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#cccccc' : '#666' }]}>
          Select where you want to save this link
        </Text>
      </View>

      <ScrollView style={styles.collectionsList} showsVerticalScrollIndicator={false}>
        {collections.map((collection) => (
          <TouchableOpacity
            key={collection.id}
            style={[
              styles.collectionItem,
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: selectedCollection?.id === collection.id ? '#4A90E2' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                borderWidth: selectedCollection?.id === collection.id ? 2 : 1
              }
            ]}
            onPress={() => setSelectedCollection(collection)}
          >
            <Image 
              source={{ uri: collection.imageLink }} 
              style={styles.collectionThumbnail}
              resizeMode="cover"
            />
            <View style={styles.collectionInfo}>
              <Text style={[styles.collectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                {collection.title}
              </Text>
              <Text style={[styles.collectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                {collection.listLink ? collection.listLink.length : 0} links
              </Text>
            </View>
            {selectedCollection?.id === collection.id && (
              <View style={styles.selectedIndicator}>
                <MaterialIcons name="check-circle" size={24} color="#4A90E2" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!selectedCollection || processing) && styles.saveButtonDisabled
          ]}
          onPress={addToCollection}
          disabled={!selectedCollection || processing}
        >
          {processing ? (
            <MaterialIcons name="hourglass-empty" size={24} color="white" />
          ) : (
            <MaterialIcons name="save" size={24} color="white" />
          )}
          <Text style={styles.saveButtonText}>
            {processing ? 'Saving...' : 'Save to Collection'}
          </Text>
        </TouchableOpacity>
      </View>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  contentPreview: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  platformDetails: {
    flex: 1,
  },
  platformName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  platformUrl: {
    fontSize: 14,
    opacity: 0.8,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  contentDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  selectionSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  collectionsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  collectionThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  collectionCount: {
    fontSize: 14,
    opacity: 0.8,
  },
  selectedIndicator: {
    marginLeft: 16,
  },
  actionContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 28,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noCollectionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noCollectionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  noCollectionsText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.8,
  },
  createCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 28,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createCollectionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
});
