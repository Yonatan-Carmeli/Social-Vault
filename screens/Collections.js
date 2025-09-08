import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, TextInput, Image, ScrollView, Dimensions, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { db, auth } from '../FireBase/Config.js';
import { collection, getDocs, addDoc, doc, setDoc, query, where, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Footer from '../components/Footer';
import { uploadImageAsync } from '../CloudInary/imageUpload.js';
import { useTheme } from '../ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

export default function Collections() {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [frame2Text, setFrame2Text] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [showCollectionWindow, setShowCollectionWindow] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [editTitleModalVisible, setEditTitleModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [editingCollectionId, setEditingCollectionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  // New state for sorting
  const [sortBy, setSortBy] = useState('dateCreated'); // dateCreated, newestFirst, oldestFirst, lastModified, nameAZ, nameZA, activity, leastActive, recentlyUpdated, largest, smallest
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [originalCollections, setOriginalCollections] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Success message state (same as CollectionFormat.js)
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState([]);
  
  // Animation for selection indicators
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Delete confirmation modal state
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState(null);
  


  const { isDarkMode } = useTheme();

  // Show success message (same as CollectionFormat.js)
  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    
    // Auto-hide after 3 seconds for error messages, 2 for success
    const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('cannot');
    setTimeout(() => {
      setShowSuccess(false);
      setSuccessMessage('');
    }, isError ? 3000 : 2000);
  };

  // קבלת המשתמש הנוכחי וטעינת האוספים שלו
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchCollections(user.uid);
      } else {
        setCurrentUser(null);
        setCollections([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Note: We no longer need to re-sort collections in useEffect since we're using getDisplayCollections()
  // which handles both filtering and sorting dynamically



  // הסרת הכותרת העליונה והגדרת אנימציית הופעה
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      header: () => null,
      gestureEnabled: false,
    });

    // אנימציית הופעה הדרגתית
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // שליפת האוספים מהדאטהבייס
  const fetchCollections = async (userId) => {
    try {
      console.log('Fetching collections for user:', userId);
      const collectionsRef = collection(db, 'albums');
      const q = query(collectionsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const collectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Fetched collections from Firebase:', collectionsData.length, 'collections');
      console.log('Current sort settings:', { sortBy, sortOrder });
      
      // Store original collections and apply sorting
      setOriginalCollections(collectionsData);
      
      const sortedCollections = sortCollections(collectionsData, sortBy, sortOrder);
      setCollections(sortedCollections);
      setLoading(false);
      
      console.log('State updated - Original:', collectionsData.length, 'Sorted:', sortedCollections.length);
      console.log('First collection:', collectionsData[0]?.title || 'None');
      console.log('Last collection:', collectionsData[collectionsData.length - 1]?.title || 'None');
    } catch (error) {
      console.error('Error fetching collections:', error);
      setLoading(false);
    }
  };

  // פתיחת חלון המודל ליצירת אוסף חדש
  const openModal = () => {
    setModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // סגירת חלון המודל
  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setCollectionName('');
      setFrame2Text('');
      setSelectedImage(null);
    });
  };

  // יצירת אוסף חדש בדאטהבייס
  const createCollection = async () => {
    if (!currentUser) {
      alert('Please log in to create a collection');
      return;
    }

    if (!collectionName || !selectedImage) {
      alert('Please select an image and enter a collection name.');
      return;
    }

    try {
      // בדיקת אתחול Firebase
      if (!db) {
        throw new Error('Firebase is not properly initialized');
      }

      console.log('Starting collection creation...');
      console.log('Collection data:', {
        title: collectionName,
        description: frame2Text,
        imageLink: selectedImage,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email.split('@')[0]
      });

      // Upload image to Cloudinary first
      console.log('Uploading image to Cloudinary...');
      const imageLink = await uploadImageAsync(selectedImage);
      console.log('Image uploaded successfully:', imageLink);

      // יצירת מסמך חדש עם מזהה ספציפי
      const newDocRef = doc(collection(db, 'albums'));
      await setDoc(newDocRef, {
        title: collectionName,
        description: frame2Text,
        imageLink,
        listLink: [],
        createdAt: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email.split('@')[0]
      });

      console.log('Document created with ID:', newDocRef.id);

      // עדכון המצב המקומי עם האוסף החדש
      const newCollection = {
        id: newDocRef.id,
        title: collectionName,
        description: frame2Text,
        imageLink,
        listLink: [],
        createdAt: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email.split('@')[0]
      };

      // Update both state variables to ensure the collection appears
      setCollections(prevCollections => [...prevCollections, newCollection]);
      setOriginalCollections(prevOriginalCollections => [...prevOriginalCollections, newCollection]);
      
      console.log('Local state updated with new collection:', newCollection);
      console.log('Collections count after update:', collections.length + 1);
      
      // Force a refresh of the collections display
      setTimeout(() => {
        console.log('Forcing collections refresh...');
        console.log('Current collections state before refresh:', {
          collections: collections.length,
          originalCollections: originalCollections.length,
          displayCollections: getDisplayCollections().length
        });
        fetchCollections(currentUser.uid);
      }, 500);
      
      setShowCollectionWindow(true);
      closeModal();
      
      showSuccessMessage('Collection created successfully!');
    } catch (error) {
      console.error('=== COLLECTION CREATION ERROR ===');
      console.error('Detailed error creating collection:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        uri: selectedImage,
        userAgent: navigator?.userAgent || 'React Native'
      });
      
      let errorMessage = 'Failed to create collection';
      
      if (error.message.includes('Upload failed') || error.message.includes('Failed to upload image')) {
        errorMessage = 'Failed to upload image. This might be due to:\n\n• Network connection issues\n• Image format not supported\n• Phone compatibility issues\n\nPlease try:\n• Using a different image\n• Checking your internet connection\n• Restarting the app';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('Firebase is not properly initialized')) {
        errorMessage = 'App initialization error. Please restart the app and try again.';
      } else if (error.message.includes('permission-denied')) {
        errorMessage = 'Permission denied. You may not have access to create collections.';
      }
      
      alert(`${errorMessage}\n\nTechnical details: ${error.message}`);
    }
  };

  // הגדרת אנימציית החלקה
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // בחירת תמונה מהגלריה
  const chooseImage = async () => {
    try {
      console.log('=== IMAGE PICKER DEBUG ===');
      console.log('Requesting media library permissions...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (!permissionResult.granted) {
        alert('Permission to access camera roll is required!');
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });
      
      console.log('Image picker result:', result);

      if (!result.canceled) {
        console.log('Image selected successfully');
        console.log('Selected image URI:', result.assets[0].uri);
        console.log('Selected image type:', result.assets[0].type);
        console.log('Selected image file size:', result.assets[0].fileSize);
        console.log('Selected image width:', result.assets[0].width);
        console.log('Selected image height:', result.assets[0].height);
        
        // Validate the URI
        if (!result.assets[0].uri) {
          throw new Error('No URI returned from image picker');
        }
        
        // Test if the URI is accessible
        console.log('Testing URI accessibility...');
        try {
          const testResponse = await fetch(result.assets[0].uri);
          console.log('URI test response status:', testResponse.status);
          console.log('URI test response ok:', testResponse.ok);
        } catch (uriTestError) {
          console.warn('URI accessibility test failed:', uriTestError.message);
        }
        
        setSelectedImage(result.assets[0].uri);
        setBackgroundImage(result.assets[0].uri);
        
        console.log('Image state updated successfully');
      } else {
        console.log('Image selection was cancelled');
      }
    } catch (error) {
      console.error('=== IMAGE PICKER ERROR ===');
      console.error('Error in chooseImage:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      let errorMessage = 'Error selecting image. Please try again.';
      
      if (error.message.includes('Permission')) {
        errorMessage = 'Camera roll permission denied. Please enable it in settings.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message.includes('No URI')) {
        errorMessage = 'Image selection failed. Please try again.';
      }
      
      alert(errorMessage);
    }
  };

  // הצגת תפריט האפשרויות לאוסף
  const showDropdown = (event, collection) => {
    const { pageY, pageX } = event.nativeEvent;
    // Adjust position to ensure dropdown is visible on screen
    const adjustedX = Math.max(10, Math.min(pageX, screenWidth - 220)); // 220 is dropdown width
    const adjustedY = Math.max(10, pageY);
    setDropdownPosition({ x: adjustedX, y: adjustedY });
    setSelectedCollection(collection);
    setDropdownVisible(true);
    console.log('Dropdown opened for collection:', collection.title, 'at position:', { x: adjustedX, y: adjustedY });
  };

  // הסתרת תפריט האפשרויות
  const hideDropdown = () => {
    setDropdownVisible(false);
    setSelectedCollection(null);
  };

  // שינוי תמונת האוסף
  const handleChangeImage = async () => {
    try {
      // Check permission first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        alert('Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && selectedCollection) {
        console.log('Image selected for change, uploading to Cloudinary...');
        
        // Upload the new image to Cloudinary first
        const newImageLink = await uploadImageAsync(result.assets[0].uri);
        console.log('New image uploaded successfully:', newImageLink);
        
        // Update Firebase with the new Cloudinary URL
        const docRef = doc(db, 'albums', selectedCollection.id);
        await updateDoc(docRef, {
          imageLink: newImageLink
        });
        
        // עדכון המצב המקומי
        setCollections(prevCollections => 
          prevCollections.map(col => 
            col.id === selectedCollection.id 
              ? { ...col, imageLink: newImageLink }
              : col
          )
        );
        hideDropdown();
        
        alert('Image updated successfully!');
      }
    } catch (error) {
      console.error('Error changing image:', error);
      let errorMessage = 'Failed to change image';
      if (error.message.includes('Upload failed')) {
        errorMessage = 'Failed to upload image. Please try again.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      alert(`${errorMessage}: ${error.message}`);
    }
  };

  // מחיקת תמונת האוסף
  const handleDeleteImage = async () => {
    try {
      if (selectedCollection) {
        const docRef = doc(db, 'albums', selectedCollection.id);
        await updateDoc(docRef, {
          imageLink: null
        });
        
        // עדכון המצב המקומי
        setCollections(prevCollections => 
          prevCollections.map(col => 
            col.id === selectedCollection.id 
              ? { ...col, imageLink: null }
              : col
          )
        );
        hideDropdown();
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

        // מחיקת אוסף
  const handleDeleteCollection = async () => {
    if (!selectedCollection || !currentUser || !db) {
      showSuccessMessage('Cannot delete collection. Please try again.');
      return;
    }

    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${selectedCollection.title}" and all its links?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Starting collection deletion process...');
              
              // Step 1: Delete the collection document
              const docRef = doc(db, 'albums', selectedCollection.id);
              await deleteDoc(docRef);
              console.log('Collection document deleted');
              
              // Step 2: Clean up associated link previews
              if (selectedCollection.listLink && selectedCollection.listLink.length > 0) {
                console.log(`Cleaning up ${selectedCollection.listLink.length} link previews...`);
                
                const deletePromises = selectedCollection.listLink.map(async (link) => {
                  try {
                    // Create the same safe document ID used for link previews
                    const normalizedUrl = link.url.trim();
                    const safeDocId = encodeURIComponent(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_');
                    const previewDocRef = doc(db, 'linkPreviews', safeDocId);
                    
                    // Try to delete the preview document (it might not exist)
                    await deleteDoc(previewDocRef);
                    console.log(`Deleted preview for: ${link.url}`);
                  } catch (previewError) {
                    // Preview document might not exist, which is fine
                    console.log(`Preview for ${link.url} not found or already deleted`);
                  }
                });
                
                // Wait for all preview deletions to complete
                await Promise.all(deletePromises);
                console.log('All link previews cleaned up');
              }
              
              // Step 3: Update local state
              setCollections(prev => prev.filter(col => col.id !== selectedCollection.id));
              setOriginalCollections(prev => prev.filter(col => col.id !== selectedCollection.id));
              
              hideDropdown();
              setSelectedCollection(null);
              
              console.log('Collection deletion completed successfully');
              showSuccessMessage('Collection and all links deleted successfully');
            } catch (error) {
              console.error('Error deleting collection:', error);
              showSuccessMessage('Failed to delete collection. Please try again.');
            }
          }
        }
      ]
    );
  };

  // עדכון כותרת האוסף
  const handleUpdateTitle = async (collectionId) => {
    try {
      if (editingTitle.trim()) {
        const docRef = doc(db, 'albums', collectionId);
        await updateDoc(docRef, {
          title: editingTitle.trim()
        });
        
        // עדכון המצב המקומי - עדכון גם collections וגם originalCollections
        const updatedTitle = editingTitle.trim();
        setCollections(prevCollections => 
          prevCollections.map(col => 
            col.id === collectionId 
              ? { ...col, title: updatedTitle }
              : col
          )
        );
        setOriginalCollections(prevOriginalCollections => 
          prevOriginalCollections.map(col => 
            col.id === collectionId 
              ? { ...col, title: updatedTitle }
              : col
          )
        );
        
        setEditingCollectionId(null);
        setEditingTitle('');
        
        showSuccessMessage('Title updated successfully!');
      }
    } catch (error) {
      console.error('Error updating title:', error);
      showSuccessMessage('Failed to update title. Please try again.');
    }
  };

  // פתיחת עריכת כותרת
  const startEditingTitle = (collection) => {
    setEditingCollectionId(collection.id);
    setEditingTitle(collection.title);
    hideDropdown();
  };

  // Smart sorting functions
  const smartSortName = (a, b, order) => {
    const cleanA = a.title.replace(/^(the|a|an)\s+/i, '').toLowerCase();
    const cleanB = b.title.replace(/^(the|a|an)\s+/i, '').toLowerCase();
    return order === 'asc' ? cleanA.localeCompare(cleanB) : cleanB.localeCompare(cleanA);
  };

  const sortCollections = (collections, sortBy, sortOrder) => {
    console.log('=== SORTING DEBUG ===');
    console.log('Sorting collections:', collections.length, 'with sortBy:', sortBy, 'sortOrder:', sortOrder);
    
    const sorted = [...collections];
    
    // Log first few collections for debugging
    if (sorted.length > 0) {
      console.log('First collection before sorting:', {
        id: sorted[0].id,
        title: sorted[0].title,
        createdAt: sorted[0].createdAt,
        date: new Date(sorted[0].createdAt || 0)
      });
    }
    
    switch (sortBy) {
      case 'nameAZ':
        return sorted.sort((a, b) => smartSortName(a, b, 'asc'));
      
      case 'nameZA':
        return sorted.sort((a, b) => smartSortName(a, b, 'desc'));
      
      case 'dateCreated':
        const dateSorted = sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          const result = sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          console.log(`Comparing ${a.title} (${dateA}) vs ${b.title} (${dateB}) = ${result}`);
          return result;
        });
        console.log('Date sorted result - First:', dateSorted[0]?.title, 'Last:', dateSorted[dateSorted.length - 1]?.title);
        return dateSorted;
      
      case 'newestFirst':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'oldestFirst':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'lastModified':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.lastModified || a.createdAt || 0);
          const dateB = new Date(b.lastModified || b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'activity':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      case 'recentlyUpdated':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.lastModified || a.createdAt || 0);
          const dateB = new Date(b.lastModified || b.createdAt || 0);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      
      case 'leastActive':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      case 'largest':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      case 'smallest':
        return sorted.sort((a, b) => {
          const countA = a.listLink ? a.listLink.length : 0;
          const countB = b.listLink ? b.listLink.length : 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      
      default:
        console.log('Using default sorting (no sort applied)');
        return sorted;
    }
  };

  // Handle sorting changes
  const handleSortChange = (newSortBy, newSortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    // Re-sort existing collections
    const sortedCollections = sortCollections(collections, newSortBy, newSortOrder);
    setCollections(sortedCollections);
  };





  const handleLongPress = (collection, index) => {
    console.log('Long press detected on collection:', collection.title, 'at index:', index);
    
    // Enter selection mode
    setIsSelectionMode(true);
    setSelectedCollections([collection.id]);
    
    console.log('Selection mode activated, selected collections:', [collection.id]);
    
    // Show visual feedback
    Alert.alert('Selection Mode', `Long pressed "${collection.title}". Now tap other collections to select them.`);
    
    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };



  const handleCollectionPress = (collection, index) => {
    if (isSelectionMode) {
      // Toggle selection
      setSelectedCollections(prev => 
        prev.includes(collection.id) 
          ? prev.filter(id => id !== collection.id)
          : [...prev, collection.id]
      );
      
      // If this was the last selected collection, exit selection mode
      if (selectedCollections.length === 1 && selectedCollections.includes(collection.id)) {
        exitSelectionMode();
      }
    } else {
      navigation.navigate('CollectionFormat', { collection });
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedCollections([]);
    
    // Stop pulse animation
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };
  
  const handleMultipleSelection = () => {
    if (selectedCollections.length > 1) {
      // If multiple collections are selected, show options
      Alert.alert(
        'Multiple Collections Selected',
        `You have ${selectedCollections.length} collections selected. What would you like to do?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Move to Top',
            onPress: () => {
              // Move selected collections to the top
              const selectedIds = new Set(selectedCollections);
              const selected = originalCollections.filter(c => selectedIds.has(c.id));
              const unselected = originalCollections.filter(c => !selectedIds.has(c.id));
              const newOrder = [...selected, ...unselected];
              setCollections(newOrder);
              exitSelectionMode();
            }
          },
          {
            text: 'Move to Bottom',
            onPress: () => {
              // Move selected collections to the bottom
              const selectedIds = new Set(selectedCollections);
              const selected = originalCollections.filter(c => selectedIds.has(c.id));
              const unselected = originalCollections.filter(c => !selectedIds.has(c.id));
              const newOrder = [...unselected, ...selected];
              setCollections(newOrder);
              exitSelectionMode();
            }
          }
        ]
      );
    }
  };

  // Get filtered and sorted collections
  const getDisplayCollections = () => {
    let filtered = originalCollections;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = originalCollections.filter(collection => 
        collection.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    return sortCollections(filtered, sortBy, sortOrder);
  };

  // Force refresh collections
  const refreshCollections = async () => {
    console.log('=== REFRESH COLLECTIONS DEBUG ===');
    console.log('Current user:', currentUser?.uid);
    console.log('Firebase db:', !!db);
    
    if (currentUser && db) {
      console.log('Force refreshing collections...');
      try {
        await fetchCollections(currentUser.uid);
        console.log('Collections refreshed successfully');
      } catch (error) {
        console.error('Error refreshing collections:', error);
      }
    } else {
      console.error('Cannot refresh collections - missing user or db');
    }
  };

  // הצגת מסך טעינה
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666' }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
             {/* Selection Mode Header */}
       {isSelectionMode && (
         <Animated.View style={[styles.selectionHeader, { opacity: fadeAnim }]}>
           <TouchableOpacity onPress={exitSelectionMode} style={styles.cancelButton}>
             <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Cancel</Text>
           </TouchableOpacity>
           <Text style={[styles.selectionTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
             Select Collections
           </Text>
                       <View style={styles.selectionInfo}>
              <Text style={[styles.selectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                {selectedCollections.length} selected
              </Text>
              {selectedCollections.length > 1 && (
                <TouchableOpacity 
                  style={[styles.selectAllButton, { marginRight: 8 }]}
                  onPress={handleMultipleSelection}
                >
                  <Text style={[styles.selectAllText, { color: '#FFC107' }]}>Actions</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.selectAllButton}
                onPress={() => {
                  if (selectedCollections.length === getDisplayCollections().length) {
                    // If all are selected, deselect all
                    setSelectedCollections([]);
                  } else {
                    // Select all
                    setSelectedCollections(getDisplayCollections().map(c => c.id));
                  }
                }}
              >
                <Text style={[styles.selectAllText, { color: '#4A90E2' }]}>
                  {selectedCollections.length === getDisplayCollections().length ? 'None' : 'All'}
                </Text>
              </TouchableOpacity>
            </View>
         </Animated.View>
       )}
       
       {/* כותרת המסך עם אנימציה */}
       <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
         <Text style={[styles.headerText, { color: isDarkMode ? '#ffffff' : '#333' }]}>My Collections</Text>
         <Text style={[styles.subtitle, { color: isDarkMode ? '#cccccc' : '#666' }]}>Organize your social media content</Text>
        
                 {/* Share Test Button */}
                   <TouchableOpacity 
            style={[styles.shareTestButton, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
            }]}
            onPress={() => {
              // Import and use ShareIntentListener for testing
              import('../utils/ShareIntentListener').then(module => {
                const ShareIntentListener = module.default;
                ShareIntentListener.simulateSharedContent(
                  'Check out this amazing Instagram post!\nhttps://www.instagram.com/p/example\nThis is some great content!'
                );
              });
            }}
          >
            <MaterialIcons name="share" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
            <Text style={[styles.shareTestButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Test Share
            </Text>
          </TouchableOpacity>
          
          
         

           

            
          
                     
           
                       
            
            
      </Animated.View>

      {/* רשימת האוספים */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sorting Header */}
        <Animated.View style={[styles.sortingHeader, { opacity: fadeAnim }]}>

           
                       {/* Selection Mode Indicator */}
            {isSelectionMode && (
              <View style={[styles.selectionModeIndicator, { 
                backgroundColor: isDarkMode ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255, 193, 7, 0.1)',
                borderColor: '#FFC107'
              }]}>
                <MaterialIcons name="touch-app" size={20} color="#FFC107" />
                <Text style={[styles.selectionModeText, { color: '#FFC107' }]}>
                  Selection Mode: Tap collections to select
                </Text>
              </View>
            )}
          
          {/* Search Input */}
          <View style={[styles.searchContainer, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
          }]}>
            <MaterialIcons name="search" size={20} color={isDarkMode ? '#cccccc' : '#666'} />
            <TextInput
              style={[styles.searchInput, { color: isDarkMode ? '#ffffff' : '#333' }]}
              placeholder="Search collections..."
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            {(searchQuery.length > 0 || isSearchFocused) && (
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                }}
              >
                <MaterialIcons name="close" size={20} color={isDarkMode ? '#cccccc' : '#666'} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.sortingControls}>
            <TouchableOpacity 
              style={[styles.sortButton, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
              }]}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <MaterialIcons name="sort" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
              <Text style={[styles.sortButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                Sort by {sortBy === 'dateCreated' ? 'Date Created' : sortBy === 'newestFirst' ? 'Newest First' : sortBy === 'oldestFirst' ? 'Oldest First' : sortBy === 'lastModified' ? 'Last Modified' : sortBy === 'nameAZ' ? 'Name A-Z' : sortBy === 'nameZA' ? 'Name Z-A' : sortBy === 'activity' ? 'Most Active' : sortBy === 'leastActive' ? 'Least Active' : sortBy === 'recentlyUpdated' ? 'Recently Updated' : sortBy === 'largest' ? 'Largest' : sortBy === 'smallest' ? 'Smallest' : 'Custom Order'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={isDarkMode ? '#ffffff' : '#333'} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.orderButton, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
              }]}
              onPress={() => handleSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              <MaterialIcons 
                name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} 
                size={20} 
                color={isDarkMode ? '#ffffff' : '#333'} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.viewToggleButton, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
              }]}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              <MaterialIcons 
                name={viewMode === 'grid' ? 'view-list' : 'grid-view'} 
                size={20} 
                color={isDarkMode ? '#ffffff' : '#333'} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Sort Menu */}
          {showSortMenu && (
            <View style={[styles.sortMenu, { 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'dateCreated' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('dateCreated', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="schedule" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Date Created</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'newestFirst' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('newestFirst', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="new-releases" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Newest First</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'oldestFirst' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('oldestFirst', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="history" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Oldest First</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'lastModified' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('lastModified', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="update" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Last Modified</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'nameAZ' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('nameAZ', 'asc');
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="sort-by-alpha" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Name A-Z</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'nameZA' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('nameZA', 'desc');
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="sort-by-alpha" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Name Z-A</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'activity' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('activity', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="trending-up" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Most Active</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'leastActive' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('leastActive', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="trending-down" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Least Active</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'recentlyUpdated' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('recentlyUpdated', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="access-time" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Recently Updated</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'largest' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('largest', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="expand-less" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Largest</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sortMenuItem, { 
                  backgroundColor: sortBy === 'smallest' ? (isDarkMode ? '#3a3a3a' : '#f0f5ff') : 'transparent',
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  handleSortChange('smallest', sortOrder);
                  setShowSortMenu(false);
                }}
              >
                <MaterialIcons name="expand-more" size={18} color={isDarkMode ? '#ffffff' : '#333'} />
                <Text style={[styles.sortMenuItemText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Smallest</Text>
              </TouchableOpacity>
              

            </View>
          )}
        </Animated.View>
        
        <Animated.View style={[
          viewMode === 'grid' ? styles.collectionsGrid : styles.collectionsList, 
          { opacity: fadeAnim }
        ]}>
          {getDisplayCollections().length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={[styles.welcomeBubble, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }]}>
                <MaterialIcons name="collections" size={50} color="#4A90E2" style={styles.welcomeIcon} />
                <Text style={[styles.welcomeTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  {searchQuery.trim() ? 'No collections found' : 'Welcome to Collections!'}
                </Text>
                <Text style={[styles.welcomeText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                  {searchQuery.trim() 
                    ? `No collections match "${searchQuery}". Try a different search term or create a new collection.`
                    : 'Collections help you organize and store your social media links in one place. Create your first collection by tapping the + button below!'
                  }
                </Text>
                <View style={styles.arrowContainer}>
                  <MaterialIcons name="arrow-downward" size={30} color="#4A90E2" />
                </View>
              </View>
            </View>
          ) : (
            getDisplayCollections().map((collection, index) => (
              <Animated.View
                key={collection.id}
                style={[
                  viewMode === 'grid' ? styles.collectionCard : styles.collectionCardList, 
                  { 
                    backgroundColor: isSelectionMode 
                      ? (isDarkMode ? '#3a3a3a' : '#f8f9fa') 
                      : (isDarkMode ? '#2a2a2a' : '#ffffff'),
                    shadowColor: isDarkMode ? '#000' : '#000',
                    borderWidth: 1,
                    borderColor: (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                    elevation: 8,
                    shadowRadius: 12,
                    zIndex: 1,
                  }
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onLongPress={() => handleLongPress(collection, index)}
                  onPress={() => handleCollectionPress(collection, index)}
                  activeOpacity={0.8}
                >
                  <TouchableOpacity
                    style={viewMode === 'grid' ? styles.imageContainer : styles.imageContainerList}
                    onPress={() => navigation.navigate('CollectionFormat', { collection })}
                    activeOpacity={0.8}
                  >
                    <Image 
                      source={{ uri: collection.imageLink }} 
                      style={styles.collectionImage}
                      resizeMode="cover"
                    />
                    <View style={styles.imageOverlay}>
                      {/* Selection indicator */}
                      {isSelectionMode && (
                        <Animated.View 
                          style={[
                            styles.selectionIndicator,
                            selectedCollections.includes(collection.id) && styles.selectionIndicatorSelected,
                            {
                              transform: selectedCollections.includes(collection.id) ? [{ scale: pulseAnim }] : []
                            }
                          ]}
                        >
                          {selectedCollections.includes(collection.id) && (
                            <MaterialIcons name="check" size={16} color="#ffffff" />
                          )}
                        </Animated.View>
                      )}
                      
                      {/* Three dots menu moved to image overlay */}
                      {viewMode === 'grid' && (
                        <TouchableOpacity
                          style={[styles.imageOptionsButton, { 
                            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)' 
                          }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            showDropdown(e, collection);
                          }}
                        >
                          <MaterialIcons 
                            name="more-vert" 
                            size={18} 
                            color={isDarkMode ? '#ffffff' : '#333'} 
                          />
                        </TouchableOpacity>
                      )}
                      
                      <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>
                          {collection.listLink ? collection.listLink.length : 0} פריטים
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={viewMode === 'grid' ? styles.cardContent : styles.cardContentList}>
                    <View style={[styles.titleSection, viewMode === 'list' && { flex: 1, marginLeft: 16 }]}>
                      {editingCollectionId === collection.id ? (
                        <View style={styles.titleEditContainer}>
                          <TextInput
                            style={[styles.titleInput, { 
                              backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
                              color: isDarkMode ? '#ffffff' : '#333',
                              borderColor: '#4A90E2'
                            }]}
                            value={editingTitle}
                            onChangeText={setEditingTitle}
                            onBlur={() => handleUpdateTitle(collection.id)}
                            onSubmitEditing={() => handleUpdateTitle(collection.id)}
                            autoFocus
                          />
                        </View>
                      ) : (
                        <Text style={[
                          viewMode === 'grid' ? styles.collectionName : styles.collectionNameList, 
                          { color: isDarkMode ? '#ffffff' : '#333' }
                        ]} numberOfLines={2}>
                          {collection.title}
                        </Text>
                      )}
                      
                      {/* Collection count for list view */}
                      {viewMode === 'list' && (
                        <Text style={[styles.collectionCount, { color: isDarkMode ? '#cccccc' : '#666' }]}>
                          {collection.listLink ? collection.listLink.length : 0} items
                        </Text>
                      )}
                    </View>
                  
                    {/* Keep the three dots menu for list view only */}
                    {viewMode === 'list' && (
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.optionsButton, { 
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
                          }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            showDropdown(e, collection);
                          }}
                        >
                          <MaterialIcons 
                            name="more-vert" 
                            size={24} 
                            color={isDarkMode ? '#cccccc' : '#666'} 
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* תפריט האפשרויות */}
      {dropdownVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={hideDropdown}
        >
          <View 
            style={[
              styles.dropdownContent,
              {
                top: dropdownPosition.y,
                left: dropdownPosition.x,
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }
            ]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => {}}
          >
            {/* כפתור שינוי תמונה */}
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => {
                hideDropdown();
                handleChangeImage();
              }}
            >
              <MaterialIcons name="photo-library" size={20} color="#4A90E2" />
              <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Change Image</Text>
            </TouchableOpacity>
            
            {/* כפתור מחיקת תמונה */}
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => {
                hideDropdown();
                handleDeleteImage();
              }}
            >
              <MaterialIcons name="delete" size={20} color="#FF4444" />
              <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Delete Image</Text>
            </TouchableOpacity>
            
            {/* כפתור שינוי כותרת */}
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => startEditingTitle(selectedCollection)}
            >
              <MaterialIcons name="edit" size={20} color="#4A90E2" />
              <Text style={[styles.dropdownText, { color: isDarkMode ? '#ffffff' : '#333' }]}>Change Title</Text>
            </TouchableOpacity>
            
                         {/* כפתור מחיקת אוסף */}
             <TouchableOpacity 
               style={[styles.dropdownItem, styles.deleteDropdownItem]} 
               onPress={async () => {
                 console.log('=== DELETE BUTTON CLICKED ===');
                 console.log('Delete collection button pressed for:', selectedCollection?.title);
                 console.log('Selected collection data:', selectedCollection);
                 console.log('Current user:', currentUser?.uid);
                 console.log('Firebase db:', !!db);
                 
                 if (!selectedCollection) {
                   console.error('No selectedCollection found');
                   alert('No collection selected for deletion');
                   return;
                 }
                 
                 if (!currentUser) {
                   console.error('No current user found');
                   alert('You must be logged in to delete collections');
                   return;
                 }
                 
                 if (!db) {
                   console.error('Firebase database not initialized');
                   alert('Database connection error. Please try again.');
                   return;
                 }

                 console.log('All checks passed, showing custom confirmation modal...');
                 
                 // Set the collection to delete and show the custom modal
                 setCollectionToDelete(selectedCollection);
                 setDeleteConfirmModalVisible(true);
               }}
             >
               <MaterialIcons name="delete-forever" size={20} color="#FF4444" />
               <Text style={[styles.dropdownText, { color: '#FF4444', fontWeight: '600' }]}>Delete Collection</Text>
             </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.modalContent, { 
            transform: [{ translateY }],
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff'
          }]}>
            <TouchableOpacity onPress={closeModal} style={[styles.closeButton, { 
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' 
            }]}>
              <MaterialIcons name="close" size={24} color={isDarkMode ? '#ffffff' : '#333'} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>Create New Collection</Text>

            <TouchableOpacity
              style={[styles.imagePickerButton, { 
                backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
                borderColor: '#4A90E2'
              }]}
              onPress={chooseImage}
            >
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <MaterialIcons name="add-photo-alternate" size={50} color="#4A90E2" />
                  <Text style={styles.placeholderText}>Choose Theme Image</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={[styles.inputContainer, { 
              backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="collections" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: isDarkMode ? '#ffffff' : '#333' }]}
                placeholder="Collection Name"
                placeholderTextColor={isDarkMode ? '#999' : '#999'}
                value={collectionName}
                onChangeText={setCollectionName}
              />
            </View>

            <View style={[styles.inputContainer, { 
              backgroundColor: isDarkMode ? '#3a3a3a' : '#f8f9fa',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }]}>
              <MaterialIcons name="description" size={24} color="#4A90E2" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: isDarkMode ? '#ffffff' : '#333' }]}
                placeholder="Add a Description..."
                placeholderTextColor={isDarkMode ? '#999' : '#999'}
                value={frame2Text}
                onChangeText={setFrame2Text}
                multiline
              />
            </View>

            <TouchableOpacity 
              style={styles.createButton}
              onPress={createCollection}
            >
              <MaterialIcons name="add" size={24} color="white" />
              <Text style={styles.createButtonText}>Create Collection</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <MaterialIcons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Delete Confirmation Modal */}
      <Modal
        transparent={true}
        visible={deleteConfirmModalVisible}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }]}>
            <MaterialIcons name="warning" size={50} color="#FF4444" style={styles.deleteWarningIcon} />
            <Text style={[styles.deleteModalTitle, { color: isDarkMode ? '#ffffff' : '#333' }]}>
              Delete Collection
            </Text>
            <Text style={[styles.deleteModalText, { color: isDarkMode ? '#cccccc' : '#666' }]}>
              Are you sure you want to delete "{collectionToDelete?.title}"? This action cannot be undone.
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.cancelDeleteButton, { 
                  backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
                }]}
                onPress={() => {
                  setDeleteConfirmModalVisible(false);
                  setCollectionToDelete(null);
                  hideDropdown();
                }}
              >
                <Text style={[styles.deleteModalButtonText, { color: isDarkMode ? '#ffffff' : '#333' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={async () => {
                  try {
                    console.log('User confirmed deletion, starting delete process...');
                    console.log('Creating document reference for:', collectionToDelete.id);
                    const docRef = doc(db, 'albums', collectionToDelete.id);
                    
                    console.log('Attempting to delete document...');
                    await deleteDoc(docRef);
                    
                    console.log('Collection deleted successfully from Firebase');
                    
                    // Update local state
                    setCollections(prev => prev.filter(col => col.id !== collectionToDelete.id));
                    setOriginalCollections(prev => prev.filter(col => col.id !== collectionToDelete.id));
                    
                    console.log('Local state updated, hiding modal...');
                    setDeleteConfirmModalVisible(false);
                    setCollectionToDelete(null);
                    hideDropdown();
                    setSelectedCollection(null);
                    
                    console.log('Showing success message...');
                    showSuccessMessage('Collection deleted successfully');
                    
                    console.log('Delete process completed successfully');
                  } catch (error) {
                    console.error('=== DELETE ERROR ===');
                    console.error('Error deleting collection:', error);
                    console.error('Error code:', error.code);
                    console.error('Error message:', error.message);
                    console.error('Error details:', error);
                    
                    let errorMessage = 'Failed to delete collection';
                    if (error.code === 'permission-denied') {
                      errorMessage = 'Permission denied. You may not have access to delete this collection.';
                    } else if (error.code === 'not-found') {
                      errorMessage = 'Collection not found. It may have been already deleted.';
                    } else if (error.code === 'unavailable') {
                      errorMessage = 'Database is currently unavailable. Please try again later.';
                    } else if (error.code === 'unauthenticated') {
                      errorMessage = 'You are not authenticated. Please log in again.';
                    }
                    
                    showSuccessMessage(errorMessage);
                  }
                }}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Footer />
      
      {/* Success Message Toast (same as CollectionFormat.js) */}
      {showSuccess && (
        <View style={[
          styles.successToast,
          {
            backgroundColor: successMessage.toLowerCase().includes('error') || successMessage.toLowerCase().includes('failed') || successMessage.toLowerCase().includes('cannot') 
              ? '#F44336' 
              : '#4CAF50'
          }
        ]}>
          <MaterialIcons 
            name={
              successMessage.toLowerCase().includes('error') || successMessage.toLowerCase().includes('failed') || successMessage.toLowerCase().includes('cannot')
                ? 'error' 
                : 'check-circle'
            } 
            size={24} 
            color="white" 
          />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}
    </View>
  );
}

// הגדרות העיצוב החדשות של המסך
const styles = StyleSheet.create({
  // מיכל ראשי
  container: {
    flex: 1,
  },
  // כותרת המסך
  header: {
    padding: 24,
    paddingTop: 50,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },


  // טקסט הכותרת
  headerText: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  // כותרת משנה
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
  // תוכן המסך
  content: {
    flex: 1,
    padding: 16,
  },
  // רשת האוספים
  collectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  // רשימת האוספים
  collectionsList: {
    paddingVertical: 8,
  },
  // כרטיס אוסף
  collectionCard: {
    width: '48%',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
  },
  // כרטיס אוסף ברשימה
  collectionCardList: {
    width: '100%',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  // מיכל התמונה
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  // מיכל התמונה ברשימה
  imageContainerList: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  // תמונת האוסף
  collectionImage: {
    width: '100%',
    height: '100%',
  },
  // שכבת כיסוי על התמונה
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
  },
  // כפתור אפשרויות על התמונה
  imageOptionsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  // תג מספר פריטים
  itemCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-end',
    marginTop: 'auto',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  // טקסט מספר פריטים
  itemCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  // תוכן הכרטיס
  cardContent: {
    padding: 14,
    paddingTop: 10,
    minHeight: 60,
    justifyContent: 'center',
  },
  // תוכן הכרטיס ברשימה
  cardContentList: {
    padding: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // אזור הכותרת
  titleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // שם האוסף
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  // שם האוסף ברשימה
  collectionNameList: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 22,
  },
  // מספר פריטים ברשימה
  collectionCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  // פעולות הכרטיס
  cardActions: {
    alignItems: 'center',
  },
  // כפתור האפשרויות
  optionsButton: {
    padding: 8,
    borderRadius: 20,
  },
  // כפתור יצירת אוסף חדש
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  // מיכל המודל
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  // תוכן המודל
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  // כפתור סגירה
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 1,
    borderRadius: 20,
    padding: 8,
  },
  // כותרת המודל
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 12,
  },
  // כפתור בחירת תמונה
  imagePickerButton: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  // תמונה נבחרת
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  // מיכל מציין מקום
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // טקסט מציין מקום
  placeholderText: {
    color: '#4A90E2',
    fontSize: 18,
    marginTop: 12,
    fontWeight: '600',
  },
  // מיכל קלט
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 18,
    padding: 16,
    width: '100%',
    borderWidth: 1,
  },
  // אייקון קלט
  inputIcon: {
    marginRight: 12,
  },
  // שדה קלט
  input: {
    flex: 1,
    fontSize: 16,
  },
  // כפתור יצירה
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 28,
    padding: 18,
    width: '100%',
    marginTop: 12,
  },
  // טקסט כפתור יצירה
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  // מיכל טעינה
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // טקסט טעינה
  loadingText: {
    fontSize: 18,
  },
  // שכבת כיסוי מודל
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // תוכן מודל עריכת כותרת
  editTitleModalContent: {
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    zIndex: 1000000,
  },
  // שדה קלט כותרת
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  // כפתור עדכון כותרת
  updateTitleButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  // טקסט כפתור עדכון כותרת
  updateTitleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // שכבת כיסוי תפריט נפתח
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  // תוכן תפריט נפתח
  dropdownContent: {
    position: 'absolute',
    borderRadius: 16,
    padding: 8,
    width: 220,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    zIndex: 1000,
  },
  // פריט תפריט נפתח
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  // טקסט פריט תפריט נפתח
  dropdownText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyStateContainer: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBubble: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  welcomeIcon: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  arrowContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderRadius: 50,
  },
  titleEditContainer: {
    width: '100%',
  },
  shareTestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  shareTestButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  // Sorting Header Styles
  sortingHeader: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  sortingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    marginRight: 12,
  },
  sortButtonText: {
    marginLeft: 8,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  orderButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sortMenu: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sortMenuItemText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },

  // Selection Mode Styles
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 100,
  },
  selectionModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectionModeText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 14,
    marginRight: 12,
  },
  selectAllButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Special styling for delete dropdown item
  deleteDropdownItem: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#FF4444',
    marginTop: 8,
    borderRadius: 8,
  },
  selectionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
     selectionIndicatorSelected: {
     backgroundColor: '#4A90E2',
     borderColor: '#4A90E2',
     transform: [{ scale: 1.1 }],
     shadowColor: '#4A90E2',
     shadowOffset: { width: 0, height: 0 },
     shadowOpacity: 0.8,
     shadowRadius: 8,
     elevation: 8,
   },
   
   // Delete Confirmation Modal Styles
   deleteModalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.7)',
     justifyContent: 'center',
     alignItems: 'center',
   },
   deleteModalContent: {
     borderRadius: 24,
     padding: 32,
     width: '90%',
     maxWidth: 400,
     alignItems: 'center',
     shadowOffset: {
       width: 0,
       height: 8,
     },
     shadowOpacity: 0.3,
     shadowRadius: 16,
     elevation: 12,
     borderWidth: 1,
   },
   deleteWarningIcon: {
     marginBottom: 20,
   },
   deleteModalTitle: {
     fontSize: 24,
     fontWeight: 'bold',
     marginBottom: 16,
     textAlign: 'center',
   },
   deleteModalText: {
     fontSize: 16,
     textAlign: 'center',
     lineHeight: 24,
     marginBottom: 32,
   },
   deleteModalButtons: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     width: '100%',
   },
   deleteModalButton: {
     flex: 1,
     paddingVertical: 16,
     paddingHorizontal: 24,
     borderRadius: 16,
     alignItems: 'center',
     justifyContent: 'center',
     marginHorizontal: 8,
   },
   cancelDeleteButton: {
     borderWidth: 1,
   },
   confirmDeleteButton: {
     backgroundColor: '#FF4444',
   },
   deleteModalButtonText: {
     fontSize: 16,
     fontWeight: '600',
   },
     confirmDeleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successToast: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  successText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
 });

