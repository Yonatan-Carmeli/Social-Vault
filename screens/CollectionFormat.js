import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Linking, Dimensions, Modal, ActivityIndicator, Alert, StatusBar, Keyboard, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../FireBase/Config';
import { doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { fetchEnhancedMetadata } from '../utils/SocialMediaFetcher';
import { auth } from '../FireBase/Config';

// Enhanced Legal Link Preview Configuration
const PREVIEW_CONFIG = {
  // Legal scraping server (your own server)
  scraper: {
    enabled: true,
    baseUrl: 'https://social-vault-production.up.railway.app/api', // Your deployed Railway server
    endpoints: {
      scrape: '/scrape',
      batch: '/scrape/batch',
      health: '/health'
    }
  },
  
  // Third-party API services (in order of preference)
  apis: {
    // 1. Microlink.io - Free tier, no API key needed
    microlink: {
      enabled: true,
      baseUrl: 'https://api.microlink.io',
      params: '&screenshot=true&meta=true&video=true&audio=true',
      priority: 1
    },
    // 2. LinkPreview.net - Free tier: 60 requests/day
    linkpreview: {
      enabled: false, // Enable when you get API key
      baseUrl: 'https://api.linkpreview.net',
      apiKey: 'YOUR_LINKPREVIEW_API_KEY', // Get from: https://www.linkpreview.net/
      priority: 2
    },
    // 3. OpenGraph.io - Free tier: 100 requests/month
    opengraph: {
      enabled: false, // Disabled - needs API key
      baseUrl: 'https://opengraph.io/api/1.1/site',
      appId: 'YOUR_OPENGRAPH_APP_ID', // Get from: https://www.opengraph.io/
      priority: 3
    },
    // 4. Iframely - Free tier: 1000 requests/month
    iframely: {
      enabled: false, // Enable when you get API key
      baseUrl: 'https://iframe.ly/api/oembed',
      apiKey: 'YOUR_IFRAMELY_API_KEY', // Get from: https://iframely.com/
      priority: 4
    }
  },
  
  // Rate limiting and retry configuration
  rateLimit: {
    maxRetries: 2,
    retryDelay: 2000, // 2 seconds
    timeout: 10000, // 10 seconds
    requestCooldown: 3000, // 3 seconds between requests for same URL
    maxConcurrentRequests: 3
  },
  
  // Cache configuration
  cache: {
    enabled: true,
    socialMediaCacheHours: 1, // Cache social media for 1 hour
    regularCacheHours: 24, // Cache regular links for 24 hours
    maxCacheSize: 1000 // Maximum cached items
  }
};

// Global request tracking to prevent duplicate requests
const requestTracker = {
  pendingRequests: new Map(),
  lastRequestTime: new Map(),
  requestCount: 0,
  lastResetTime: Date.now()
};

// Function to decode HTML entities (like &#x5d3; to ד)
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

// Request deduplication and rate limiting helper
const requestManager = {
  // Check if we can make a request for this URL
  canMakeRequest(url) {
    const now = Date.now();
    const lastRequest = requestTracker.lastRequestTime.get(url);
    
    // Reset counter every hour
    if (now - requestTracker.lastResetTime > 3600000) {
      requestTracker.requestCount = 0;
      requestTracker.lastResetTime = now;
    }
    
    // Check cooldown period
    if (lastRequest && (now - lastRequest) < PREVIEW_CONFIG.rateLimit.requestCooldown) {
      console.log(`Request for ${url} is in cooldown period`);
      return false;
    }
    
    // Check if request is already pending
    if (requestTracker.pendingRequests.has(url)) {
      console.log(`Request for ${url} is already pending`);
      return false;
    }
    
    // Check concurrent request limit
    if (requestTracker.pendingRequests.size >= PREVIEW_CONFIG.rateLimit.maxConcurrentRequests) {
      console.log(`Too many concurrent requests (${requestTracker.pendingRequests.size})`);
      return false;
    }
    
    return true;
  },
  
  // Mark request as started
  startRequest(url) {
    requestTracker.pendingRequests.set(url, Date.now());
    requestTracker.lastRequestTime.set(url, Date.now());
    requestTracker.requestCount++;
  },
  
  // Mark request as completed
  endRequest(url) {
    requestTracker.pendingRequests.delete(url);
  },
  
  // Wait for cooldown period
  async waitForCooldown(url) {
    const lastRequest = requestTracker.lastRequestTime.get(url);
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      const remainingCooldown = PREVIEW_CONFIG.rateLimit.requestCooldown - timeSinceLastRequest;
      if (remainingCooldown > 0) {
        console.log(`Waiting ${remainingCooldown}ms for cooldown period`);
        await new Promise(resolve => setTimeout(resolve, remainingCooldown));
      }
    }
  }
};

export default function CollectionFormat({ route, navigation }) {
  const { collection } = route.params;
  const [linkInput, setLinkInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [currentCollection, setCurrentCollection] = useState(collection);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [loadingPreviews, setLoadingPreviews] = useState({});
  const [processedLinks, setProcessedLinks] = useState(new Set()); // Track which links have been processed
  const [currentError, setCurrentError] = useState(null);
  const [isErrorDialogVisible, setIsErrorDialogVisible] = useState(false);
  
  console.log('Collection data received:', collection);
  console.log('Collection listLink:', collection.listLink);
  console.log('Collection ID:', collection.id);
  
  // Refresh collection data from Firebase
  useEffect(() => {
    const refreshCollectionData = async () => {
      try {
        if (!collection || !collection.id) {
          console.error('Collection or collection.id is undefined:', collection);
          return;
        }
        
        const docRef = doc(db, 'albums', collection.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const freshData = docSnap.data();
          console.log('Fresh data from Firebase:', freshData);
          setCurrentCollection({ ...freshData, id: collection.id }); // Ensure ID is preserved
          
          // Load design preference after getting fresh data
          if (freshData.preferredDesign && designs[freshData.preferredDesign]) {
            setCurrentDesign(freshData.preferredDesign);
            console.log('Loaded design preference from fresh data:', freshData.preferredDesign);
          }
        } else {
          console.log('Document does not exist in Firebase');
        }
      } catch (error) {
        console.error('Error refreshing collection data:', error);
      }
    };
    
    refreshCollectionData();
  }, [collection.id]);
  
  // Handle both old and new data formats with deduplication
  const initializeLinks = (listLink) => {
    console.log('Initializing links with:', listLink);
    if (!listLink || listLink.length === 0) {
      console.log('No links found, returning empty array');
      return [];
    }
    
    const processedLinks = listLink.map((link, index) => {
      console.log(`Processing link ${index}:`, link, 'Type:', typeof link);
      // If link is a string (old format), convert to new format
      if (typeof link === 'string') {
        const newLink = {
          url: link,
          title: link,
          timestamp: new Date().toISOString() // Add current timestamp for old links
        };
        console.log(`Converted string link to object:`, newLink);
        return newLink;
      }
      // If link is already an object (new format), use as is
      const processedLink = {
        url: link.url || link,
        title: link.title || link.url || link,
        timestamp: link.timestamp || new Date().toISOString()
      };
      console.log(`Processed object link:`, processedLink);
      return processedLink;
    });
    
    // Deduplicate links by URL to prevent multiple API calls for same URL
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of processedLinks) {
      const normalizedUrl = link.url.trim().toLowerCase();
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueLinks.push(link);
      } else {
        console.log('Duplicate link removed:', link.url);
      }
    }
    
    console.log('Final processed links (deduplicated):', uniqueLinks);
    return uniqueLinks;
  };

  const [links, setLinks] = useState(initializeLinks(currentCollection.listLink));
  const [isTitleModalVisible, setIsTitleModalVisible] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [sortType, setSortType] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [currentDesign, setCurrentDesign] = useState('modern'); // 'modern', 'classic', 'minimal'
  const [designs, setDesigns] = useState({
    modern: {
      name: 'Modern',
      description: 'Current mobile-optimized design'
    },
    classic: {
      name: 'Classic',
      description: 'Traditional horizontal layout'
    },
    minimal: {
      name: 'Minimal',
      description: 'Clean and simple design'
    },
    grid: {
      name: 'Grid',
      description: 'Two cards side by side'
    }
  });
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const linkInputRef = useRef(null);
  const [isDesignSelectorVisible, setIsDesignSelectorVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [failedPreviews, setFailedPreviews] = useState(new Set()); // Track failed previews
  const [isCustomPreviewModalVisible, setIsCustomPreviewModalVisible] = useState(false);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);
  const [customPreviewData, setCustomPreviewData] = useState({
    title: '',
    description: '',
    image: null
  });

  // Update links when currentCollection changes
  useEffect(() => {
    console.log('Current collection updated:', currentCollection);
    if (currentCollection && currentCollection.listLink) {
      setLinks(initializeLinks(currentCollection.listLink));
    }
  }, [currentCollection]);
  
  
  // Single, reliable preview fetching system
  useEffect(() => {
    if (links.length === 0) return;
    
    console.log('Setting up preview fetching for', links.length, 'links');
    
    // Process all links systematically
    const processLinks = async () => {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        if (!link.url) continue;
        
        // Check if we already have a preview for this URL
        if (linkPreviews[link.url]) {
          console.log(`Preview already exists for: ${link.url}`);
          setProcessedLinks(prev => new Set([...prev, link.url]));
          continue;
        }
        
        // Check if we're already loading this preview
        if (loadingPreviews[i]) {
          console.log(`Already loading preview for: ${link.url}`);
          continue;
        }
        
        // Check if we've already processed this link
        if (processedLinks.has(link.url)) {
          console.log(`Link already processed: ${link.url}`);
          continue;
        }
        
        // Set up initial preview state for links with custom titles
        if (link.title !== link.url) {
          const initialPreview = {
            title: link.title,
            description: 'Loading description...',
            image: null,
            siteName: getSiteNameFromUrl(link.url),
            timestamp: new Date().toISOString()
          };
          setLinkPreviews(prev => ({
            ...prev,
            [link.url]: initialPreview
          }));
        }
        
        // Fetch preview with a small delay to prevent overwhelming the system
        setTimeout(() => {
          console.log(`Fetching preview for link ${i}: ${link.url}`);
          setProcessedLinks(prev => new Set([...prev, link.url]));
          fetchLinkPreview(link.url, i);
        }, i * 200); // Stagger requests by 200ms
      }
    };
    
    processLinks();
  }, [links.length]); // Only depend on link count, not the entire links array
  
  console.log('Initial links state:', links);

  // פונקציה למיון הקישורים
  const sortLinks = (linksToSort, type) => {
    const sortedLinks = [...linksToSort];
    switch (type) {
      case 'newest':
        return sortedLinks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      case 'oldest':
        return sortedLinks.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      case 'alphabetical':
        return sortedLinks.sort((a, b) => a.title.localeCompare(b.title));
      case 'reverse-alphabetical':
        return sortedLinks.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return sortedLinks;
    }
  };

  // Update filtered links whenever search query or links change
  useEffect(() => {
    console.log('Search query changed:', searchQuery);
    console.log('Current links:', links);
    
    if (!searchQuery.trim()) {
      console.log('Empty search query, showing all links');
      setFilteredLinks(links);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = links.filter(link => {
      const titleMatch = link.title.toLowerCase().includes(query);
      const urlMatch = link.url.toLowerCase().includes(query);
      console.log(`Link "${link.title}" - Title match: ${titleMatch}, URL match: ${urlMatch}`);
      return titleMatch || urlMatch;
    });
    
    console.log('Filtered links:', filtered);
    setFilteredLinks(filtered);
  }, [searchQuery, links]);

  // קבלת הקישורים המסוננים והממוינים
  const getDisplayedLinks = () => {
    console.log('Getting displayed links');
    const sortedLinks = sortLinks(filteredLinks);
    console.log('After sorting:', sortedLinks);
    return sortedLinks;
  };

  // הוספת קישור חדש לאוסף
  const addLink = async () => {
    if (linkInput.trim()) {
      try {
        // Safety check for currentCollection
        if (!currentCollection || !currentCollection.id) {
          console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
          showSuccessMessage('Error: Collection data missing');
          return;
        }

        let formattedLink = linkInput.trim();
        if (!formattedLink.startsWith('http://') && !formattedLink.startsWith('https://')) {
          formattedLink = 'https://' + formattedLink;
        }

        const newLink = {
          url: formattedLink,
          title: formattedLink,
          timestamp: new Date().toISOString()
        };

        console.log('Adding new link:', newLink);
        console.log('Current links:', links);
        console.log('Current collection ID:', currentCollection.id);

        const newLinks = [...links, newLink];
        const sortedLinks = sortLinks(newLinks, sortType);
        
        console.log('Sorted links to save:', sortedLinks);
        
        // עדכון הדאטהבייס - שמירה בפורמט החדש
        const docRef = doc(db, 'albums', currentCollection.id);
        const dataToSave = {
          listLink: sortedLinks.map(link => ({
            url: link.url,
            title: link.title,
            timestamp: link.timestamp
          }))
        };
        
        console.log('Data to save to Firebase:', dataToSave);
        console.log('Document reference:', docRef);
        
        await updateDoc(docRef, dataToSave);

        // עדכון המצב המקומי
        setLinks(sortedLinks);
        setLinkInput('');
        
        console.log('Link added successfully');
        
        // Fetch preview for the new link
        setTimeout(() => {
          fetchLinkPreview(newLink.url, sortedLinks.length - 1);
        }, 300); // Reduced delay for better performance
        
        // Show subtle success feedback
        showSuccessMessage('Link added successfully!');
        
        // Refresh the collection data after adding - reduced to improve performance
        setTimeout(async () => {
          try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setCurrentCollection({ ...docSnap.data(), id: currentCollection.id });
            }
          } catch (error) {
            console.error('Error refreshing collection data:', error);
          }
        }, 200);
              } catch (error) {
          console.error('Error adding link:', error);
          console.error('Error details:', error.message, error.code);
          console.error('Error stack:', error.stack);
          showSuccessMessage('Failed to add link. Please try again.');
        }
    }
  };

  // עדכון כותרת הקישור
  const updateLinkTitle = async (index) => {
    if (editingTitle.trim()) {
      try {
        setIsUpdatingTitle(true);
        
        if (!currentCollection || !currentCollection.id) {
          console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
          showSuccessMessage('Error: Collection data missing');
          return;
        }

        const newLinks = [...links];
        const updatedLink = {
          ...newLinks[index],
          title: editingTitle.trim()
        };
        newLinks[index] = updatedLink;

        // Update the linkPreviews state to reflect the new title
        const updatedPreview = {
          ...linkPreviews[updatedLink.url],
          title: editingTitle.trim()
        };
        setLinkPreviews(prev => ({
          ...prev,
          [updatedLink.url]: updatedPreview
        }));

        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          listLink: newLinks.map(link => ({
            url: link.url,
            title: link.title,
            timestamp: link.timestamp
          }))
        });

        setLinks(newLinks);
        setEditingLinkIndex(null);
        setEditingTitle('');
        
        // Show success feedback
        console.log('Title updated successfully');
        showSuccessMessage('Title updated successfully!');
        
        // Show brief success state
        setTimeout(async () => {
          try {
            // Refresh the collection data after updating
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setCurrentCollection({ ...docSnap.data(), id: currentCollection.id });
            }
          } catch (error) {
            console.error('Error refreshing collection data:', error);
          }
        }, 500);
              } catch (error) {
          console.error('Error updating link title:', error);
          showSuccessMessage('Failed to update link title. Please try again.');
        } finally {
        setIsUpdatingTitle(false);
      }
    }
  };

  // מחיקת קישור
  const deleteLink = async (index) => {
    try {
      if (!currentCollection || !currentCollection.id) {
        console.error('currentCollection or currentCollection.id is undefined:', currentCollection);
        alert('Collection data is missing. Please try again.');
        return;
      }

      const newLinks = links.filter((_, i) => i !== index);
      
      const docRef = doc(db, 'albums', currentCollection.id);
      await updateDoc(docRef, {
        listLink: newLinks.map(link => ({
          url: link.url,
          title: link.title,
          timestamp: link.timestamp
        }))
      });

      setLinks(newLinks);
      showSuccessMessage('Link deleted successfully!');
      
      // Refresh the collection data after deleting
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCurrentCollection({ ...docSnap.data(), id: currentCollection.id });
      }
            } catch (error) {
          console.error('Error deleting link:', error);
          showSuccessMessage('Failed to delete link. Please try again.');
        }
  };

  // טיפול בלחיצה על קישור - פתיחת הקישור בדפדפן
  const handleLinkPress = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showSuccessMessage(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error('Error opening link:', error);
      showSuccessMessage('Error opening link');
    }
  };

  // טיפול בשיתוף קישור - פתיחת חלון השיתוף
  const handleShareLink = async (url, title) => {
    try {
      const shareTitle = title || 'Check out this link';
      const shareMessage = `${shareTitle}\n\n${url}`;
      
      await Share.share({
        message: shareMessage,
        url: url,
        title: shareTitle,
      });

      // No success notification - we can't reliably know if user actually shared
      console.log('Share sheet opened');
    } catch (error) {
      console.error('Error opening share sheet:', error);
      showSuccessMessage('Error opening share sheet');
    }
  };

  // Remove old complex functions that are no longer needed
  // The simple fetchLinkMetadata approach handles everything now

  // Fetch only the title for a link (used by refresh button)
  const fetchLinkTitleOnly = async (url) => {
    try {
      console.log('Fetching title only for URL:', url);
      const normalizedUrl = url.trim();
      
      // Special handling for Instagram links
      if (normalizedUrl.includes('instagram.com')) {
        console.log('Using Instagram-specific title extraction');
        const instagramTitle = await extractInstagramTitle(normalizedUrl);
        if (instagramTitle) {
          console.log('Successfully fetched Instagram title:', instagramTitle);
          return instagramTitle;
        }
      }
      
      // Use the enhanced metadata fetching approach to get just the title for other links
      const metadata = await fetchEnhancedMetadata(normalizedUrl, {
        showUserFeedback: false, // Don't show error dialogs for metadata failures
        onError: null // Don't call error handler for metadata failures
      });
      
      if (metadata && metadata.title) {
        console.log('Successfully fetched title:', metadata.title);
        return metadata.title;
      } else {
        console.log('No title found in metadata');
        return null;
      }
    } catch (error) {
      console.error('Error fetching title only:', error);
      return null;
    }
  };

  // Helper function to clean Instagram titles by removing unwanted parts
  const cleanInstagramTitle = (title) => {
    if (!title) return title;
    
    console.log('Original title:', JSON.stringify(title));
    
    let cleaned = title
      .replace(/on Instagram:?\s*/gi, '') // Remove "on Instagram:" or "on Instagram"
      .replace(/^[^:]*:\s*/, '') // Remove everything before the first colon and colon itself
      .replace(/\s*-\s*(@\w+|Instagram|on Instagram).*$/gi, '') // Remove channel name after dash
      .replace(/\s*•\s*(likes?|comments?|@\w+|Instagram|on Instagram).*$/gi, '') // Remove metadata after bullet point
      .replace(/\s*on\s+Instagram\s*$/gi, '') // Remove "on Instagram" at the end
      .replace(/\s*-\s*[^:]*on\s+Instagram\s*$/gi, '') // Remove channel name and "on Instagram" at the end
      .replace(/^["'`«»\u201C\u201D\u2018\u2019\u201A\u201B\u201E\u201F\u2039\u203A\u00AB\u00BB]+/, '') // Remove leading quotation marks of all types
      .replace(/["'`«»\u201C\u201D\u2018\u2019\u201A\u201B\u201E\u201F\u2039\u203A\u00AB\u00BB]+$/, '') // Remove trailing quotation marks of all types
      .replace(/^["']+/, '') // Additional fallback for basic quotes
      .replace(/["']+$/, '') // Additional fallback for basic quotes
      .replace(/^@\w+\s*/, '') // Remove leading @username
      .replace(/\s*@\w+$/, '') // Remove trailing @username
      .replace(/\s*@\w+\s*/g, ' ') // Remove @username from anywhere in the text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log('After regex cleaning:', JSON.stringify(cleaned));
    
    // Final cleanup for quotation marks at start and end only
    // Remove leading quotation marks (only basic ones to avoid removing content)
    while (cleaned.length > 0 && (cleaned.startsWith('"') || cleaned.startsWith("'") || cleaned.startsWith('`'))) {
      cleaned = cleaned.substring(1);
    }
    
    // Remove trailing quotation marks (only basic ones to avoid removing content)
    while (cleaned.length > 0 && (cleaned.endsWith('"') || cleaned.endsWith("'") || cleaned.endsWith('`'))) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    
    console.log('After while loop cleaning:', JSON.stringify(cleaned));
    
    // Additional aggressive cleanup for any remaining quotation marks at the end
    cleaned = cleaned.replace(/["'`]+$/, '');
    
    // Handle multiple consecutive quotation marks at the end
    while (cleaned.endsWith('"') || cleaned.endsWith("'") || cleaned.endsWith('`')) {
      cleaned = cleaned.slice(0, -1);
    }
    
    // ULTRA AGGRESSIVE cleanup - remove ALL possible quotation marks at the end
    cleaned = cleaned.replace(/["'`«»\u201C\u201D\u2018\u2019\u201A\u201B\u201E\u201F\u2039\u203A\u00AB\u00BB]+$/, '');
    
    // Remove any remaining quotation marks character by character
    while (cleaned.length > 0) {
      const lastChar = cleaned[cleaned.length - 1];
      if (lastChar === '"' || lastChar === "'" || lastChar === '`' || 
          lastChar === '«' || lastChar === '»' || lastChar === '\u201C' || 
          lastChar === '\u201D' || lastChar === '\u2018' || lastChar === '\u2019' ||
          lastChar === '\u201A' || lastChar === '\u201B' || lastChar === '\u201E' ||
          lastChar === '\u201F' || lastChar === '\u2039' || lastChar === '\u203A' ||
          lastChar === '\u00AB' || lastChar === '\u00BB') {
        cleaned = cleaned.slice(0, -1);
      } else {
        break;
      }
    }
    
    // Final trim to remove any whitespace
    cleaned = cleaned.trim();
    
    console.log('Final cleaned title:', JSON.stringify(cleaned));
    
    return cleaned.trim();
  };

  // Enhanced legal preview fetching system
  const fetchLegalPreview = async (url, userApiTokens = {}) => {
    try {
      console.log('Fetching legal preview for:', url);
      
      // Check if we can make a request for this URL
      if (!requestManager.canMakeRequest(url)) {
        console.log('Request blocked due to rate limiting or cooldown');
        return null;
      }
      
      // Wait for cooldown if needed
      await requestManager.waitForCooldown(url);
      
      // Mark request as started
      requestManager.startRequest(url);
      
      try {
        // 1. Try legal scraping server first (most reliable)
        if (PREVIEW_CONFIG.scraper.enabled) {
          try {
            console.log('Trying legal scraper server...');
            const response = await fetch(`${PREVIEW_CONFIG.scraper.baseUrl}${PREVIEW_CONFIG.scraper.endpoints.scrape}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url }),
              timeout: PREVIEW_CONFIG.rateLimit.timeout
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                console.log('Legal scraper success:', result.data.title);
                return {
                  source: 'legal-scraper',
                  data: result.data,
                  success: true
                };
              }
            }
          } catch (error) {
            console.log('Legal scraper failed:', error.message);
          }
        }
        
        // 2. Try third-party APIs
        const enabledApis = Object.entries(PREVIEW_CONFIG.apis)
          .filter(([_, config]) => config.enabled)
          .sort(([_, a], [__, b]) => a.priority - b.priority);
        
        for (const [apiName, config] of enabledApis) {
          try {
            console.log(`Trying ${apiName} API...`);
            let apiUrl = '';
            
            switch (apiName) {
              case 'microlink':
                apiUrl = `${config.baseUrl}?url=${encodeURIComponent(url)}${config.params}`;
                break;
              case 'linkpreview':
                apiUrl = `${config.baseUrl}/?key=${config.apiKey}&q=${encodeURIComponent(url)}`;
                break;
              case 'opengraph':
                apiUrl = `${config.baseUrl}/${encodeURIComponent(url)}?app_id=${config.appId}`;
                break;
              case 'iframely':
                apiUrl = `${config.baseUrl}?url=${encodeURIComponent(url)}&api_key=${config.apiKey}`;
                break;
            }
            
            const response = await fetch(apiUrl, {
              timeout: PREVIEW_CONFIG.rateLimit.timeout
            });
            
            // Handle 429 rate limit errors
            if (response.status === 429) {
              console.log(`${apiName} rate limit hit (429), skipping`);
              continue;
            }
            
            const data = await response.json();
            
            // Parse response based on API
            let parsedData = null;
            switch (apiName) {
              case 'microlink':
                if (data.status === 'success' && data.data) {
                  parsedData = data.data;
                }
                break;
              case 'linkpreview':
                if (data.title || data.description) {
                  parsedData = data;
                }
                break;
              case 'opengraph':
                if (data.hybridGraph) {
                  parsedData = data.hybridGraph;
                }
                break;
              case 'iframely':
                if (data.title || data.description) {
                  parsedData = data;
                }
                break;
            }
            
            if (parsedData) {
              console.log(`${apiName} API success:`, parsedData.title || 'No title');
              return {
                source: apiName,
                data: parsedData,
                success: true
              };
            }
          } catch (error) {
            console.log(`${apiName} API failed:`, error.message);
          }
        }
        
        // 3. Try user's API tokens for specific platforms
        const platform = detectPlatform(url);
        if (platform && userApiTokens[platform]) {
          try {
            console.log(`Trying user's ${platform} API token...`);
            const apiResult = await fetchWithUserToken(url, platform, userApiTokens[platform]);
            if (apiResult && apiResult.success) {
              return apiResult;
            }
          } catch (error) {
            console.log(`User ${platform} API failed:`, error.message);
          }
        }
        
        throw new Error('All legal data sources failed');
        
      } finally {
        // Always mark request as completed
        requestManager.endRequest(url);
      }
      
    } catch (error) {
      console.log('Legal preview fetching failed:', error.message);
      return null;
    }
  };

  // Detect platform from URL
  const detectPlatform = (url) => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('facebook.com')) return 'facebook';
    return null;
  };

  // Fetch with user's API token
  const fetchWithUserToken = async (url, platform, token) => {
    try {
      switch (platform) {
        case 'instagram':
          return await fetchInstagramWithToken(url, token);
        case 'tiktok':
          return await fetchTikTokWithToken(url, token);
        case 'youtube':
          return await fetchYouTubeWithToken(url, token);
        case 'twitter':
          return await fetchTwitterWithToken(url, token);
        case 'facebook':
          return await fetchFacebookWithToken(url, token);
        default:
          return null;
      }
    } catch (error) {
      console.log(`User token fetch failed for ${platform}:`, error.message);
      return null;
    }
  };

  // Platform-specific API fetchers
  const fetchInstagramWithToken = async (url, token) => {
    // Instagram Graph API implementation
    // This would use the user's token to fetch Instagram data
    // Implementation depends on Instagram's API structure
    return null; // Placeholder
  };

  const fetchTikTokWithToken = async (url, token) => {
    // TikTok API implementation
    return null; // Placeholder
  };

  const fetchYouTubeWithToken = async (url, token) => {
    // YouTube Data API implementation
    return null; // Placeholder
  };

  const fetchTwitterWithToken = async (url, token) => {
    // Twitter API implementation
    return null; // Placeholder
  };

  const fetchFacebookWithToken = async (url, token) => {
    // Facebook Graph API implementation
    return null; // Placeholder
  };

  // Enhanced Instagram title extraction function with better error handling and legal compliance
  const extractInstagramTitle = async (url) => {
    try {
      console.log('Extracting Instagram title for:', url);
      
      // First, try using multiple legal data sources
      const instagramData = await extractInstagramData(url);
      
      if (instagramData && instagramData.success) {
        const data = instagramData.data;
        console.log(`Using data from ${instagramData.source}:`, data);
        
        // Try to extract meaningful title from various fields
        let extractedTitle = null;
        
        // Check title field first
        if (data.title && !data.title.includes('Instagram') && data.title.length > 10) {
          extractedTitle = cleanInstagramTitle(data.title);
        }
        
        // Check description field
        if (!extractedTitle && data.description && !data.description.includes('Instagram') && data.description.length > 10) {
          extractedTitle = cleanInstagramTitle(data.description);
        }
        
        // Check for alternative title fields
        if (!extractedTitle && data.site_name && !data.site_name.includes('Instagram') && data.site_name.length > 10) {
          extractedTitle = cleanInstagramTitle(data.site_name);
        }
        
        // Check for video title or content title
        if (!extractedTitle && data.video && data.video.title && data.video.title.length > 10) {
          extractedTitle = cleanInstagramTitle(data.video.title);
        }
        
        // Check author field for context
        if (data.author && extractedTitle) {
          // If we have a title, add author context
          extractedTitle = `${data.author}: ${extractedTitle}`;
        }
        
        if (extractedTitle) {
          console.log('Found Instagram title via legal API:', extractedTitle);
          return extractedTitle;
        }
      }
      
      // Fallback to direct legal Open Graph extraction
      try {
        console.log('Trying direct Open Graph extraction as fallback');
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
          },
          timeout: 10000,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log('Instagram HTML fetched, length:', html.length);
        
        // Enhanced meta tag extraction with better filtering
        const extractMetaContent = (property) => {
          const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
          const match = html.match(regex);
          return match ? decodeHtmlEntities(match[1]) : null;
        };
        
        // Try multiple meta tag properties
        const metaProperties = [
          'og:title',
          'twitter:title', 
          'og:description',
          'twitter:description',
          'description'
        ];
        
        for (const property of metaProperties) {
          const content = extractMetaContent(property);
          if (content) {
            console.log(`Found ${property}:`, content);
            
            // Clean and validate the content
            let cleanedContent = cleanInstagramTitle(content);
            
            // Check if this looks like a meaningful caption/title
            if (cleanedContent && 
                cleanedContent.length > 10 && 
                !cleanedContent.includes('Instagram') && 
                !cleanedContent.includes('•') &&
                !cleanedContent.includes('likes') &&
                !cleanedContent.includes('comments') &&
                !cleanedContent.includes('followers')) {
              console.log('Using cleaned meta content as title:', cleanedContent);
              return cleanedContent;
            }
          }
        }
        
        // Try to extract from structured data (JSON-LD)
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gi);
        if (jsonLdMatches) {
          for (const script of jsonLdMatches) {
            try {
              const jsonContent = script.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/, '').replace(/<\/script>/, '');
              const data = JSON.parse(jsonContent);
              
              // Look for meaningful content in structured data
              const possibleFields = ['caption', 'text', 'description', 'name', 'headline'];
              for (const field of possibleFields) {
                if (data[field] && typeof data[field] === 'string' && data[field].length > 10) {
                  const cleaned = cleanInstagramTitle(data[field]);
                  if (cleaned && !cleaned.includes('Instagram') && !cleaned.includes('•')) {
                    console.log(`Found structured data ${field}:`, cleaned);
                    return cleaned;
                  }
                }
              }
            } catch (parseError) {
              console.log('Failed to parse JSON-LD:', parseError.message);
              continue;
            }
          }
        }
        
      } catch (fallbackError) {
        console.log('Fallback extraction also failed:', fallbackError.message);
      }
      
      console.log('No meaningful Instagram title found');
      return null;
      
    } catch (error) {
      console.log('Error extracting Instagram title:', error.message);
      return null;
    }
  };

  // Fetch link preview metadata using the enhanced, legal approach
  const fetchLinkPreview = async (url, index) => {

    // Don't fetch if we already have a preview for this URL
    if (linkPreviews[url]) {
      console.log('Preview already exists for URL, skipping fetch:', url);
      return;
    }

    // Don't fetch if we're already loading this preview
    if (loadingPreviews[index]) {
      console.log('Already loading preview for index:', index, 'URL:', url);
      return;
    }

    // Check if this link has failed before and add retry delay
    const hasFailedBefore = failedPreviews.has(url);
    if (hasFailedBefore) {
      console.log('Link has failed before, adding retry delay:', url);
      // Add a longer delay for retries
      setTimeout(() => {
        fetchLinkPreview(url, index);
      }, 5000); // 5 second delay for retries
      return;
    }

    try {
      console.log('Fetching preview for URL:', url, 'Index:', index);
      setLoadingPreviews(prev => ({ ...prev, [index]: true }));
      
      const normalizedUrl = url.trim();
      const safeDocId = encodeURIComponent(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_');
      const docRef = doc(db, 'linkPreviews', safeDocId);
      
      // Check Firebase cache first
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const previewData = docSnap.data();
          console.log('Found cached preview:', previewData);
          
          // For social media links, check if we should use cached data
          const isSocialMedia = normalizedUrl.includes('instagram.com') || 
                               normalizedUrl.includes('facebook.com') || 
                               normalizedUrl.includes('tiktok.com');
          
          if (isSocialMedia) {
            // For social media, use cached data if it's recent (less than 1 hour old)
            const cacheAge = Date.now() - (previewData.timestamp ? new Date(previewData.timestamp).getTime() : 0);
            const isRecent = cacheAge < 3600000; // 1 hour
            
            // Skip cache if it's a fallback preview (force fresh fetch for better data)
            const isFallbackPreview = previewData.source === 'fallback' || 
                                     previewData.title.includes('Link') ||
                                     previewData.description === 'Click to view the full content' ||
                                     !previewData.image;
            
            if (isRecent && previewData.title && previewData.title !== 'Loading preview...' && !isFallbackPreview) {
              console.log('Using recent cached social media data for:', url);
              setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
              setLoadingPreviews(prev => ({ ...prev, [index]: false }));
              return;
            } else {
              console.log('Social media cache is stale, incomplete, or fallback - fetching fresh data');
            }
          } else {
            // For non-social media links, return cached data if it's not stale
            const isStale = !previewData?.image || 
                           previewData?.title === 'Loading preview...' || 
                           (previewData?.description || '').includes('Fetching link information');
            if (!isStale) {
              console.log('Using cached preview data for:', url);
              setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
              setLoadingPreviews(prev => ({ ...prev, [index]: false }));
              return;
            }
          }
        }
      } catch (cacheError) {
        console.log('Cache check failed:', cacheError.message);
      }
      
      // Set initial loading state
      let previewData = {
        title: 'Loading preview...',
        description: 'Fetching link information...',
        image: null,
        siteName: 'Unknown site',
        timestamp: new Date().toISOString()
      };
      
      // Update UI immediately with loading state
      setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
      
      // Enhanced preview fetching for all links
      try {
        console.log('Processing link with enhanced legal extraction:', normalizedUrl);
        
        // Get user's API tokens from Firebase
        let userApiTokens = {};
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser?.uid));
          if (userDoc.exists() && userDoc.data().apiTokens) {
            userApiTokens = userDoc.data().apiTokens;
          }
        } catch (error) {
          console.log('Could not fetch user API tokens:', error.message);
        }
        
        // Use the enhanced legal preview fetching system
        const previewResult = await fetchLegalPreview(normalizedUrl, userApiTokens);
        
        if (previewResult && previewResult.success) {
          console.log(`Preview fetched successfully from ${previewResult.source}:`, previewResult.data.title);
          
          // Build enhanced preview data
          const data = previewResult.data;
          previewData = {
            title: data.title || 'Untitled',
            description: data.description || '',
            image: data.image || data.imageUrl || null,
            siteName: data.siteName || getSiteNameFromUrl(normalizedUrl),
            timestamp: new Date().toISOString(),
            source: previewResult.source,
            // Additional metadata
            author: data.author || null,
            publishedTime: data.publishedTime || null,
            video: data.video || null,
            audio: data.audio || null
          };
        } else {
          console.log('All legal preview sources failed, trying YouTube oEmbed fallback');
          
          // Try platform-specific oEmbed APIs
          if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be')) {
            try {
              const videoId = extractYouTubeVideoId(normalizedUrl);
              if (videoId) {
                const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
                const oembedResponse = await fetch(oembedUrl);
                if (oembedResponse.ok) {
                  const oembedData = await oembedResponse.json();
                  previewData = {
                    title: oembedData.title || 'YouTube Video',
                    description: oembedData.author_name ? `by ${oembedData.author_name}` : 'YouTube video',
                    image: oembedData.thumbnail_url || null,
                    siteName: 'YouTube',
                    timestamp: new Date().toISOString(),
                    source: 'youtube_oembed'
                  };
                  console.log('YouTube oEmbed success:', oembedData.title);
                } else {
                  throw new Error('YouTube oEmbed failed');
                }
              } else {
                throw new Error('Could not extract YouTube video ID');
              }
            } catch (oembedError) {
              console.log('YouTube oEmbed fallback failed:', oembedError.message);
              previewData = {
                title: 'YouTube Link',
                description: 'Click to view the full content',
                image: null,
                siteName: 'YouTube',
                timestamp: new Date().toISOString(),
                source: 'fallback'
              };
            }
          } else if (normalizedUrl.includes('facebook.com')) {
            try {
              // Try Facebook oEmbed (limited but sometimes works)
              const oembedUrl = `https://graph.facebook.com/v18.0/oembed_post?url=${encodeURIComponent(normalizedUrl)}&access_token=YOUR_FACEBOOK_ACCESS_TOKEN`;
              // For now, skip Facebook oEmbed as it requires access token
              throw new Error('Facebook oEmbed requires access token');
            } catch (oembedError) {
              console.log('Facebook oEmbed fallback failed:', oembedError.message);
              previewData = {
                title: 'Facebook Post',
                description: 'Click to view the full content',
                image: null,
                siteName: 'Facebook',
                timestamp: new Date().toISOString(),
                source: 'fallback'
              };
            }
          } else if (normalizedUrl.includes('instagram.com')) {
            try {
              // Instagram doesn't have public oEmbed, but we can try to extract basic info
              const postId = extractInstagramPostId(normalizedUrl);
              if (postId) {
                previewData = {
                  title: 'Instagram Post',
                  description: 'Instagram content - click to view the full post',
                  image: null, // Instagram requires authentication for images
                  siteName: 'Instagram',
                  timestamp: new Date().toISOString(),
                  source: 'instagram_basic'
                };
                console.log('Instagram basic info extracted for post:', postId);
              } else {
                throw new Error('Could not extract Instagram post ID');
              }
            } catch (oembedError) {
              console.log('Instagram basic extraction failed:', oembedError.message);
              previewData = {
                title: 'Instagram Post',
                description: 'Click to view the full content',
                image: null,
                siteName: 'Instagram',
                timestamp: new Date().toISOString(),
                source: 'fallback'
              };
            }
          } else {
            console.log('All legal preview sources failed, using generic fallback');
            previewData = {
              title: getSiteNameFromUrl(normalizedUrl) + ' Link',
              description: 'Click to view the full content',
              image: null,
              siteName: getSiteNameFromUrl(normalizedUrl),
              timestamp: new Date().toISOString(),
              source: 'fallback'
            };
          }
        }
      } catch (previewError) {
        console.log('Enhanced preview fetching failed:', previewError.message);
        previewData = {
          title: getSiteNameFromUrl(normalizedUrl) + ' Link',
          description: 'Click to view the full content',
          image: null,
          siteName: getSiteNameFromUrl(normalizedUrl),
          timestamp: new Date().toISOString(),
          source: 'fallback'
        };
      }
      
      // Save to Firebase for future use
      try {
        await setDoc(docRef, previewData);
        console.log('Preview saved to Firebase successfully');
      } catch (error) {
        console.error('Error saving preview to Firebase:', error);
      }
      
      console.log('Final preview data:', previewData);
      setLinkPreviews(prev => ({ ...prev, [url]: previewData }));
      
    } catch (error) {
      console.error('Error fetching link preview:', error);
      console.error('Error details:', {
        url,
        index,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Check if user has set a custom title for this link
      const linkWithCustomTitle = links.find(link => link.url === url);
      const titleToUse = linkWithCustomTitle && linkWithCustomTitle.title !== linkWithCustomTitle.url 
        ? linkWithCustomTitle.title 
        : 'Preview unavailable';
      
      // Set default preview data with more detailed error info
      setLinkPreviews(prev => ({ 
        ...prev, 
        [url]: {
          title: titleToUse,
          description: `Could not load preview (${error.message})`,
          image: null,
          siteName: 'Unknown',
          timestamp: new Date().toISOString(),
          error: error.message // Store error for debugging
        }
      }));
      
      // Mark this preview as failed for retry functionality
      setFailedPreviews(prev => new Set([...prev, url]));
      
      // Show user-friendly error message
      showSuccessMessage(`Preview failed for ${getSiteNameFromUrl(url)} - will retry later`);
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [index]: false }));
    }
  };

  // Helper function to extract YouTube video ID
  const extractYouTubeVideoId = (url) => {
    try {
      const urlObj = new URL(url);
      
      // Handle youtu.be format
      if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.substring(1).split('?')[0];
      }
      
      // Handle youtube.com format
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      }
      
      return null;
    } catch (error) {
      console.log('Error extracting YouTube video ID:', error.message);
      return null;
    }
  };

  // Helper function to extract Instagram post ID
  const extractInstagramPostId = (url) => {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname.includes('instagram.com')) {
        // Extract post ID from path like /p/ABC123/ or /reel/ABC123/
        const pathMatch = urlObj.pathname.match(/\/(?:p|reel)\/([^\/]+)/);
        return pathMatch ? pathMatch[1] : null;
      }
      
      return null;
    } catch (error) {
      console.log('Error extracting Instagram post ID:', error.message);
      return null;
    }
  };

  // Helper function to get site name from URL
  const getSiteNameFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname.includes('instagram.com')) return 'Instagram';
      if (hostname.includes('facebook.com')) return 'Facebook';
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube';
      if (hostname.includes('tiktok.com')) return 'TikTok';
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'X (Twitter)';
      if (hostname.includes('linkedin.com')) return 'LinkedIn';
      if (hostname.includes('reddit.com')) return 'Reddit';
      
      return hostname.replace('www.', '');
    } catch (error) {
      return 'Unknown site';
    }
  };

  // Retry failed previews with exponential backoff
  const retryFailedPreview = (url, index) => {
    console.log('Retrying failed preview for:', url);
    setFailedPreviews(prev => {
      const newSet = new Set(prev);
      newSet.delete(url);
      return newSet;
    });
    
    // Add a delay before retrying
    setTimeout(() => {
      fetchLinkPreview(url, index);
    }, 2000); // 2 second delay for manual retries
  };

  // Auto-retry failed previews after a delay
  useEffect(() => {
    if (failedPreviews.size > 0) {
      console.log('Auto-retrying failed previews:', Array.from(failedPreviews));
      
      const retryTimer = setTimeout(() => {
        failedPreviews.forEach((url) => {
          const linkIndex = links.findIndex(link => link.url === url);
          if (linkIndex !== -1) {
            console.log('Auto-retrying preview for:', url);
            retryFailedPreview(url, linkIndex);
          }
        });
      }, 10000); // Retry after 10 seconds
      
      return () => clearTimeout(retryTimer);
    }
  }, [failedPreviews.size]); // Only retry when new failures occur

  // This useEffect is now handled by the main preview fetching system above
  // Removed to prevent conflicts and duplicate fetching

  const openTitleModal = (index) => {
    setEditingLinkIndex(index);
    setTitleInput(links[index].title);
    setIsTitleModalVisible(true);
  };

  // שינוי סוג המיון
  const changeSortType = (type) => {
    setSortType(type);
    const sortedLinks = sortLinks(links, type);
    setLinks(sortedLinks);
  };

  const changeDesign = (designKey) => {
    // Only show notification if actually switching to a different design
    if (currentDesign !== designKey) {
      setCurrentDesign(designKey);
      setIsDesignSelectorVisible(false);
      showSuccessMessage(`Switched to ${designs[designKey].name} design!`);
      // Save design preference to Firebase
      saveDesignPreference(designKey);
    } else {
      // Show a friendly message that this design is already active
      setIsDesignSelectorVisible(false);
      showSuccessMessage(`${designs[designKey].name} design is already active! ✨`);
    }
  };

  const saveDesignPreference = async (designKey) => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          preferredDesign: designKey,
          lastUpdated: new Date().toISOString()
        });
        console.log('Design preference saved:', designKey);
      }
    } catch (error) {
      console.error('Error saving design preference:', error);
    }
  };

  const loadDesignPreference = async () => {
    try {
      if (currentCollection && currentCollection.id) {
        const docRef = doc(db, 'albums', currentCollection.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.preferredDesign && designs[data.preferredDesign]) {
            setCurrentDesign(data.preferredDesign);
            console.log('Loaded design preference:', data.preferredDesign);
          }
        }
      }
    } catch (error) {
      console.error('Error loading design preference:', error);
    }
  };

  const showDesignSelector = (event) => {
    const { pageY, pageX } = event.nativeEvent;
    setDropdownPosition({ x: pageX, y: pageY });
    setIsDesignSelectorVisible(true);
  };

  const toggleMenu = (index) => {
    setActiveMenuIndex(activeMenuIndex === index ? null : index);
  };

  const closeMenu = () => {
    setActiveMenuIndex(null);
  };


  // Get dynamic styles based on current design
  const getDesignStyles = () => {
    switch (currentDesign) {
      case 'classic':
        return {
          linkItem: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
            borderWidth: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          },
          previewContainer: {
            width: 120,
            height: 68,
            borderRadius: 8,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          },
          linkContent: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            paddingTop: 2,
          },
          linkActions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingTop: 2,
            paddingLeft: 8,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            minHeight: 32,
          },
          editButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          deleteButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          openButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          linkTitle: {
            fontSize: 16,
            fontWeight: '500',
            color: '#0f0f0f',
            marginBottom: 4,
            lineHeight: 20,
          },
          linkUrl: {
            fontSize: 14,
            color: '#606060',
            marginBottom: 2,
            lineHeight: 18,
          },
          linkDescription: {
            display: 'none', // Hide description in classic design
          }
        };
      case 'minimal':
        return {
          linkItem: {
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 8,
            marginVertical: 6,
            borderWidth: 1,
            borderColor: '#f0f0f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          },
          previewContainer: {
            width: '100%',
            height: 120,
            borderRadius: 8,
            backgroundColor: '#f8f8f8',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          },
          linkContent: {
            marginTop: 8,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingTop: 6,
            borderTopWidth: 0.5,
            borderTopColor: '#f0f0f0',
          },
          editButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          deleteButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          openButton: {
            padding: 6,
            marginRight: 6,
            backgroundColor: 'transparent',
            borderRadius: 4,
          },
          linkTitle: {
            fontSize: 16,
            fontWeight: '500',
            color: '#333',
            marginBottom: 4,
            lineHeight: 20,
          },
          linkUrl: {
            fontSize: 13,
            color: '#666',
            marginBottom: 6,
            lineHeight: 18,
          },
          linkDescription: {
            fontSize: 13,
            color: '#666',
            lineHeight: 18,
          }
        };
      case 'grid':
        return {
          linkItem: {
            backgroundColor: '#f8f9fa',
            padding: 12,
            borderRadius: 12,
            marginVertical: 6,
            borderWidth: 1,
            borderColor: '#e0e0e0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 1,
            flex: 1,
            minWidth: '48%',
            maxWidth: '48%',
          },
          previewContainer: {
            width: '100%',
            height: 120,
            borderRadius: 8,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          },
          linkContent: {
            marginTop: 8,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 6,
            borderTopWidth: 0.5,
            borderTopColor: '#e0e0e0',
          },
          editButton: {
            padding: 6,
            marginRight: 4,
            backgroundColor: 'transparent',
            borderRadius: 6,
          },
          deleteButton: {
            padding: 6,
            marginRight: 4,
            backgroundColor: 'transparent',
            borderRadius: 6,
          },
          openButton: {
            padding: 6,
            backgroundColor: 'transparent',
            borderRadius: 6,
          },
          linkTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: '#333',
            marginBottom: 4,
            lineHeight: 18,
          },
          linkUrl: {
            fontSize: 12,
            color: '#666',
            marginBottom: 6,
            lineHeight: 16,
          },
          linkDescription: {
            fontSize: 12,
            color: '#666',
            lineHeight: 16,
          }
        };
      default: // modern
        return {
          linkItem: {
            backgroundColor: '#f8f9fa',
            padding: 16,
            borderRadius: 16,
            marginVertical: 12,
            borderWidth: 1,
            borderColor: '#e0e0e0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          },
          previewContainer: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: '#e0e0e0',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          },
          linkContent: {
            marginTop: 12,
          },
          linkActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
          },
          editButton: {
            padding: 8,
            marginRight: 8,
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
          },
          deleteButton: {
            padding: 8,
            marginRight: 8,
            backgroundColor: '#ffe6e6',
            borderRadius: 8,
          },
          openButton: {
            padding: 8,
            marginRight: 8,
            backgroundColor: '#e6f3ff',
            borderRadius: 8,
          },
          linkTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: '#333',
            marginBottom: 6,
            lineHeight: 24,
          },
          linkUrl: {
            fontSize: 14,
            color: '#666',
            marginBottom: 8,
            lineHeight: 18,
          },
          linkDescription: {
            fontSize: 14,
            color: '#666',
            lineHeight: 20,
          }
        };
    }
  };

  const renderLinkPreview = (link) => {
    if (!link.preview) return null;

    const { title, description, image, siteName } = link.preview;
    
    // Check if this is a social media link that needs proxying
    const isSocialMedia = link.url && (
      link.url.includes('instagram.com') ||
      link.url.includes('facebook.com') ||
      link.url.includes('tiktok.com') ||
      link.url.includes('twitter.com') ||
      link.url.includes('x.com')
    );

    // Use image proxy for social media thumbnails
    const imageSource = isSocialMedia && image ? 
      { uri: `https://us-central1-socialvault-4c0c0.cloudfunctions.net/proxyImage?imageUrl=${encodeURIComponent(image)}` } : 
      { uri: image };

    return (
      <View style={styles.previewContainer}>
        {image && (
          <Image
            source={imageSource}
            style={styles.previewImage}
            resizeMode="cover"
            onError={(error) => {
              console.log('Image load error:', error.nativeEvent);
              if (link.preview.fallbackThumbnails && link.preview.fallbackThumbnails.length > 0) {
                tryFallbackThumbnail(link);
              }
            }}
          />
        )}
        <View style={styles.previewText}>
          {siteName && (
            <Text style={styles.siteName}>{siteName}</Text>
          )}
          {title && (
            <Text style={styles.previewTitle} numberOfLines={2}>
              {title}
            </Text>
          )}
          {description && (
            <Text style={styles.previewDescription} numberOfLines={3}>
              {description}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Simple and reliable metadata fetching using microlink.io API
  const fetchLinkMetadata = async (url) => {
    try {
      console.log('Fetching metadata for:', url);
      
      // First try: Use microlink.io API (works reliably for Facebook and Instagram)
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=true`);
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log('Microlink API success:', data.data);
        return {
          title: data.data.title || 'Untitled',
          thumbnail: data.data.image?.url || data.data.screenshot?.url || 'https://via.placeholder.com/150x100/cccccc/ffffff?text=No+Image',
          description: data.data.description || 'No description available'
        };
      } else {
        console.log('Microlink API failed, trying fallback methods');
        throw new Error('Failed to fetch metadata from microlink.io');
      }
    } catch (error) {
      console.log('Error fetching metadata from microlink.io:', error);
      // Fallback to basic metadata extraction
      return await fetchBasicMetadata(url);
    }
  };

  const fetchBasicMetadata = async (url) => {
    try {
      console.log('Trying basic HTML metadata extraction for:', url);
      
      // Try to fetch the HTML content and extract basic metadata
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : 'Untitled';
      
      // Extract description from meta tags
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : 'No description available';
      
      // Try to find any image for thumbnail
      const imgMatch = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
      const thumbnail = imgMatch ? imgMatch[1] : 'https://via.placeholder.com/150x100/cccccc/ffffff?text=No+Image';
      
      console.log('Basic metadata extracted:', { title, thumbnail, description });
      return { title, thumbnail, description };
    } catch (error) {
      console.log('Error fetching basic metadata:', error);
      // Try alternative methods for social media sites
      return await fetchSocialMediaMetadata(url);
    }
  };

  const fetchSocialMediaMetadata = async (url) => {
    try {
      console.log('Trying social media specific metadata for:', url);
      
      // Handle Facebook URLs specifically
      if (url.includes('facebook.com')) {
        return {
          title: 'Facebook Post',
          thumbnail: 'https://via.placeholder.com/150x100/1877f2/ffffff?text=Facebook',
          description: 'Facebook content - click to view the full post'
        };
      }
      
      // Handle Instagram URLs
      if (url.includes('instagram.com')) {
        return {
          title: 'Instagram Post',
          thumbnail: 'https://via.placeholder.com/150x100/e4405f/ffffff?text=Instagram',
          description: 'Instagram content - click to view the full post'
        };
      }
      
      // Handle YouTube URLs with proper metadata fetching
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return await fetchYouTubeMetadata(url);
      }
      
      // Handle TikTok URLs
      if (url.includes('tiktok.com')) {
        return {
          title: 'TikTok Video',
          thumbnail: 'https://via.placeholder.com/150x100/000000/ffffff?text=TikTok',
          description: 'TikTok video - click to view the full content'
        };
      }
      
      // Handle Twitter/X URLs
      if (url.includes('twitter.com') || url.includes('x.com')) {
        return {
          title: 'Twitter Post',
          thumbnail: 'https://via.placeholder.com/150x100/1da1f2/ffffff?text=Twitter',
          description: 'Twitter content - click to view the full post'
        };
      }
      
      // Handle LinkedIn URLs
      if (url.includes('linkedin.com')) {
        return {
          title: 'LinkedIn Post',
          thumbnail: 'https://via.placeholder.com/150x100/0077b5/ffffff?text=LinkedIn',
          description: 'LinkedIn content - click to view the full post'
        };
      }
      
      // Generic fallback for other social media
      return {
        title: 'Social Media Content',
        thumbnail: 'https://via.placeholder.com/150x100/6c757d/ffffff?text=Social+Media',
        description: 'Social media content - click to view the full post'
      };
    } catch (error) {
      console.log('Error fetching social media metadata:', error);
      return {
        title: 'Untitled',
        thumbnail: 'https://via.placeholder.com/150x100/cccccc/ffffff?text=Error',
        description: 'Failed to fetch metadata'
      };
    }
  };

  const fetchYouTubeMetadata = async (url) => {
    try {
      console.log('Fetching YouTube metadata for:', url);
      
      // Extract video ID from YouTube URL
      let videoId = '';
      
      if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('embed/')[1].split('?')[0];
      }
      
      if (!videoId) {
        throw new Error('Could not extract YouTube video ID');
      }
      
      console.log('YouTube video ID extracted:', videoId);
      
      // Try YouTube oEmbed API first (no API key required)
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        
        if (response.ok) {
          const data = await response.json();
          console.log('YouTube oEmbed data:', data);
          
          // Get thumbnail from video ID (YouTube provides multiple thumbnail sizes)
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          
          return {
            title: data.title || 'YouTube Video',
            thumbnail: thumbnailUrl,
            description: data.author_name ? `By ${data.author_name}` : 'YouTube video - click to view the full content'
          };
        }
      } catch (oembedError) {
        console.log('YouTube oEmbed failed, trying alternative method:', oembedError);
      }
      
      // Fallback: Use YouTube Data API v3 (requires API key, but we'll use a public endpoint)
      try {
        // Try to get basic info from the video page
        const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetch(videoPageUrl);
        const html = await response.text();
        
        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        let title = 'YouTube Video';
        if (titleMatch) {
          title = titleMatch[1].replace(' - YouTube', '').trim();
        }
        
        // Extract description from meta tags
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        let description = 'YouTube video - click to view the full content';
        if (descMatch) {
          description = descMatch[1].trim();
          // Limit description length
          if (description.length > 100) {
            description = description.substring(0, 100) + '...';
          }
        }
        
        // Use high-quality thumbnail
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        return {
          title: title,
          thumbnail: thumbnailUrl,
          description: description
        };
      } catch (pageError) {
        console.log('YouTube video page fetch failed:', pageError);
      }
      
      // Final fallback with video ID-based thumbnail
      return {
        title: 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: 'YouTube video - click to view the full content'
      };
      
    } catch (error) {
      console.log('Error fetching YouTube metadata:', error);
      // Return a basic YouTube placeholder if all methods fail
      return {
        title: 'YouTube Video',
        thumbnail: 'https://via.placeholder.com/150x100/ff0000/ffffff?text=YouTube',
        description: 'YouTube video - click to view the full content'
      };
    }
  };

  // Show subtle message (success or error)
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

  // Open custom preview editor
  const openCustomPreviewEditor = (index) => {
    const link = links[index];
    const currentPreview = linkPreviews[link.url];
    
    setEditingPreviewIndex(index);
    setCustomPreviewData({
      title: currentPreview?.title || link.title || '',
      description: currentPreview?.description || '',
      image: currentPreview?.image || null
    });
    setIsCustomPreviewModalVisible(true);
  };

  // Save custom preview
  const saveCustomPreview = async () => {
    if (editingPreviewIndex === null) return;
    
    try {
      const link = links[editingPreviewIndex];
      const updatedPreview = {
        ...linkPreviews[link.url],
        title: customPreviewData.title || link.title,
        description: customPreviewData.description || 'No description available',
        image: customPreviewData.image,
        siteName: linkPreviews[link.url]?.siteName || getSiteNameFromUrl(link.url),
        timestamp: new Date().toISOString(),
        isCustom: true // Mark as custom preview
      };

      // Update the preview in state
      setLinkPreviews(prev => ({
        ...prev,
        [link.url]: updatedPreview
      }));

      // Update the link title if it was changed
      if (customPreviewData.title && customPreviewData.title !== link.title) {
        const newLinks = [...links];
        newLinks[editingPreviewIndex] = {
          ...newLinks[editingPreviewIndex],
          title: customPreviewData.title
        };
        setLinks(newLinks);

        // Update Firebase
        const docRef = doc(db, 'albums', currentCollection.id);
        await updateDoc(docRef, {
          listLink: newLinks.map(link => ({
            url: link.url,
            title: link.title,
            timestamp: link.timestamp
          }))
        });
      }

      // Save custom preview to Firebase
      const safeDocId = encodeURIComponent(link.url).replace(/[^a-zA-Z0-9]/g, '_');
      const previewDocRef = doc(db, 'linkPreviews', safeDocId);
      await setDoc(previewDocRef, updatedPreview);

      setIsCustomPreviewModalVisible(false);
      setEditingPreviewIndex(null);
      setCustomPreviewData({ title: '', description: '', image: null });
      
      showSuccessMessage('Custom preview saved successfully!');
    } catch (error) {
      console.error('Error saving custom preview:', error);
      showSuccessMessage('Failed to save custom preview');
    }
  };

  // Handle image selection for custom preview
  const handleImageSelection = () => {
    // This would integrate with image picker library
    // For now, we'll show a placeholder
    Alert.alert(
      'Image Selection',
      'Image picker integration needed. For now, you can manually enter an image URL.',
      [
        {
          text: 'Enter URL',
          onPress: () => {
            Alert.prompt(
              'Image URL',
              'Enter the URL of your custom image:',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'OK', 
                  onPress: (url) => {
                    if (url) {
                      setCustomPreviewData(prev => ({ ...prev, image: url }));
                    }
                  }
                }
              ],
              'plain-text'
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Configure Status Bar for better visibility */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent"
        translucent={true}
      />
      
      {/* Message Toast (Success or Error) */}
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
                ? "error"
                : "check-circle"
            } 
            size={20} 
            color="#ffffff" 
          />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}
      
      <ScrollView>
        {/* תמונת האוסף */}
        <View style={styles.imageContainer}>
          {/* Status bar area with dark background */}
          <View style={styles.statusBarArea} />
          
          {/* Header with back arrow - same as original */}
          <View style={styles.headerLine}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Image 
            source={{ uri: currentCollection.imageLink }}
            style={styles.collectionImage}
            resizeMode="cover"
          />
          <View style={styles.overlay}>
            <Text style={styles.collectionTitle}>{currentCollection.title}</Text>
            {currentCollection.description && (
              <Text style={styles.description}>{currentCollection.description}</Text>
            )}
          </View>
        </View>

        {/* אזור הקישורים */}
        <View style={styles.contentContainer}>
          {/* כותרת אזור הקישורים */}
          <View style={styles.sectionHeader}>
            <View style={styles.leftSection}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="link" size={24} color="#4a90e2" />
              </View>
              <Text style={styles.sectionTitle}>Links</Text>
              <TouchableOpacity 
                style={styles.designChangeButton}
                onPress={(e) => showDesignSelector(e)}
              >
                <MaterialIcons name="palette" size={22} color="#4a90e2" />
                <Text style={styles.designChangeText}>{designs[currentDesign]?.name}</Text>
                <MaterialIcons name="expand-more" size={18} color="#4a90e2" />
              </TouchableOpacity>
              
            </View>
            
            <View style={styles.rightSection}>
              {/* שדה חיפוש */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search links..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#666"
                  selectionColor="#4a90e2"
                  cursorColor="#4a90e2"
                />
                {searchQuery ? (
                  <TouchableOpacity 
                    onPress={() => setSearchQuery('')}
                    style={styles.clearSearchButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>
              
              {/* כפתורי מיון */}
              <View style={styles.sortButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'newest' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('newest')}
                >
                  <MaterialIcons name="access-time" size={20} color={sortType === 'newest' ? '#fff' : '#4a90e2'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'oldest' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('oldest')}
                >
                  <MaterialIcons name="history" size={20} color={sortType === 'oldest' ? '#fff' : '#4a90e2'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'alphabetical' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('alphabetical')}
                >
                  <MaterialIcons name="sort-by-alpha" size={20} color={sortType === 'alphabetical' ? '#fff' : '#4a90e2'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortButton, sortType === 'reverse-alphabetical' && styles.sortButtonActive]} 
                  onPress={() => changeSortType('reverse-alphabetical')}
                >
                  <MaterialIcons name="sort-by-alpha" size={20} color={sortType === 'reverse-alphabetical' ? '#fff' : '#4a90e2'} style={styles.reverseIcon} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* אזור הזנת קישור חדש */}
          <View style={styles.linkInputContainer}>
            <View style={styles.inputFieldsContainer}>
              <TextInput
                ref={linkInputRef}
                style={styles.linkInput}
                placeholder="Add a new link..."
                value={linkInput}
                onChangeText={setLinkInput}
                placeholderTextColor="#a9a9a9"
                autoCapitalize="none"
                keyboardType="url"
                textAlign="left"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (linkInput.trim()) {
                    addLink();
                  }
                }}
              />
            </View>
            <TouchableOpacity 
              style={[styles.addButton, !linkInput.trim() && styles.addButtonDisabled]} 
              onPressIn={() => {
                console.log('Add button pressed!');
                // Add link immediately on press in - before keyboard dismissal
                if (linkInput.trim()) {
                  addLink();
                }
              }}
              disabled={!linkInput.trim()}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* רשימת הקישורים */}
          <View style={[
            styles.linksContainer,
            currentDesign === 'grid' && styles.gridLinksContainer
          ]}>
            {getDisplayedLinks().map((link, index) => {
              const designStyles = getDesignStyles();
              return (
                <View
                  key={index}
                  style={[
                    styles.linkItem,
                    designStyles.linkItem,
                    editingLinkIndex === index && styles.linkItemEditing
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.linkMainContent}
                    onPress={() => {
                      console.log('Link main content pressed, editing:', editingLinkIndex === index);
                      if (editingLinkIndex !== index) {
                        handleLinkPress(link.url);
                      }
                    }}
                    disabled={editingLinkIndex === index}
                    activeOpacity={editingLinkIndex === index ? 1 : 0.7}
                    pointerEvents={editingLinkIndex === index ? "none" : "auto"}
                  >
                    {/* Link Preview Image - Now larger and positioned above text */}
                    <View style={[styles.previewContainer, designStyles.previewContainer]}>
                      {loadingPreviews[index] ? (
                        <View style={styles.previewLoading}>
                          <ActivityIndicator size="small" color="#4a90e2" />
                        </View>
                      ) : linkPreviews[link.url]?.image ? (
                        <Image
                          source={{ uri: linkPreviews[link.url].image }}
                          style={styles.previewImage}
                          resizeMode="cover"
                          onError={() => {
                            console.log('Image failed to load, removing it');
                            // If image fails to load, remove it
                            setLinkPreviews(prev => ({
                              ...prev,
                              [link.url]: {
                                ...prev[link.url],
                                image: null
                              }
                            }));
                          }}
                        />
                      ) : linkPreviews[link.url] ? (
                        <View style={styles.previewPlaceholder}>
                          {failedPreviews.has(link.url) ? (
                            <TouchableOpacity 
                              style={styles.retryButton}
                              onPress={() => retryFailedPreview(link.url, index)}
                            >
                              <MaterialIcons name="refresh" size={24} color="#4a90e2" />
                              <Text style={styles.retryText}>Retry</Text>
                            </TouchableOpacity>
                          ) : (
                            <MaterialIcons name="link" size={32} color="#ccc" />
                          )}
                        </View>
                      ) : (
                        <View style={styles.previewLoading}>
                          <ActivityIndicator size="small" color="#4a90e2" />
                        </View>
                      )}
                      {linkPreviews[link.url]?.siteName && (
                        <View style={styles.siteNameBadge}>
                          <Text style={styles.siteNameText}>
                            {linkPreviews[link.url].siteName}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Text content now positioned below the thumbnail */}
                    <View style={[styles.linkContent, designStyles.linkContent]}>
                      <View style={styles.linkTextContainer}>
                        {editingLinkIndex === index ? (
                          <View style={styles.editingContainer}>
                            <TextInput
                              style={styles.linkTitleInput}
                              value={editingTitle}
                              onChangeText={setEditingTitle}
                              onBlur={() => {
                                // Don't auto-save on blur - only save when user explicitly clicks check button
                                // setEditingLinkIndex(null);
                              }}
                              onSubmitEditing={() => {
                                if (editingTitle.trim() && editingTitle !== link.title) {
                                  updateLinkTitle(index);
                                }
                                setEditingLinkIndex(null);
                              }}
                              autoFocus
                              placeholder="Enter title"
                              placeholderTextColor="#666"
                              returnKeyType="done"
                            />
                            <Text style={styles.editingHint}>
                              {isUpdatingTitle ? 'Saving...' : 'Press ✓ to save or ✕ to cancel'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={designStyles.linkTitle} numberOfLines={2}>
                            {linkPreviews[link.url]?.title || link.title}
                          </Text>
                        )}
                        <Text style={designStyles.linkUrl} numberOfLines={1}>{link.url}</Text>
                        {currentDesign !== 'classic' && linkPreviews[link.url]?.description && (
                          <Text style={[styles.linkDescription, designStyles.linkDescription]} numberOfLines={3}>
                            {linkPreviews[link.url].description}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Action buttons now positioned at the bottom right */}
                  <View style={[styles.linkActions, designStyles.linkActions]} pointerEvents={editingLinkIndex === index ? "auto" : "auto"}>
                    {currentDesign === 'classic' ? (
                      // Classic design: Three-dot menu
                      <View style={styles.classicMenuContainer}>
                        <TouchableOpacity 
                          style={styles.threeDotButton}
                          onPress={() => toggleMenu(index)}
                        >
                          <MaterialIcons name="more-vert" size={20} color="#000000" />
                        </TouchableOpacity>
                        
                        {/* Dropdown menu */}
                        {activeMenuIndex === index && (
                          <View style={styles.classicDropdownMenu}>
                            <TouchableOpacity 
                              style={styles.menuItem}
                              onPress={() => {
                                if (editingLinkIndex === index) {
                                  setEditingLinkIndex(null);
                                  setEditingTitle('');
                                } else {
                                  setEditingLinkIndex(index);
                                  // Use the same logic as display: fetched title OR URL as fallback
                                  setEditingTitle(linkPreviews[link.url]?.title || link.title);
                                }
                                closeMenu();
                              }}
                            >
                              <MaterialIcons name="edit" size={18} color="#4a90e2" />
                              <Text style={styles.menuItemText}>Edit</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.menuItem}
                              onPress={() => {
                                deleteLink(index);
                                closeMenu();
                              }}
                            >
                              <MaterialIcons name="delete" size={18} color="#FF4444" />
                              <Text style={styles.menuItemText}>Delete</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.menuItem}
                              onPress={() => {
                                handleShareLink(link.url, linkPreviews[link.url]?.title || link.title);
                                closeMenu();
                              }}
                            >
                              <MaterialIcons name="share" size={18} color="#4a90e2" />
                              <Text style={styles.menuItemText}>Share</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.menuItem}
                              onPress={() => {
                                openCustomPreviewEditor(index);
                                closeMenu();
                              }}
                            >
                              <MaterialIcons name="image" size={18} color="#9C27B0" />
                              <Text style={styles.menuItemText}>Customize Preview</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.menuItem}
                              onPress={() => {
                                handleLinkPress(link.url);
                                closeMenu();
                              }}
                            >
                              <MaterialIcons name="open-in-new" size={18} color="#4a90e2" />
                              <Text style={styles.menuItemText}>Open</Text>
                            </TouchableOpacity>
                            
                            <View style={styles.menuDivider} />
                            
                            <TouchableOpacity 
                              style={styles.menuItem}
                              onPress={closeMenu}
                            >
                              <MaterialIcons name="close" size={18} color="#666" />
                              <Text style={styles.menuItemText}>Close</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      // Modern and Minimal designs: Individual buttons
                      <>
                        <TouchableOpacity 
                          style={[styles.editButton, designStyles.editButton]}
                          onPress={() => {
                            if (editingLinkIndex === index) {
                              // Save the changes
                              updateLinkTitle(index);
                            } else {
                              // Start editing
                              setEditingLinkIndex(index);
                              // Use the same logic as display: fetched title OR URL as fallback
                              setEditingTitle(linkPreviews[link.url]?.title || link.title);
                            }
                          }}
                          disabled={isUpdatingTitle}
                        >
                          {isUpdatingTitle && editingLinkIndex === index ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                          ) : (
                            <MaterialIcons 
                              name={editingLinkIndex === index ? "check" : "edit"} 
                              size={20} 
                              color={editingLinkIndex === index ? "#4CAF50" : "#4a90e2"} 
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.deleteButton, designStyles.deleteButton]}
                          onPress={() => deleteLink(index)}
                        >
                          <MaterialIcons name="delete" size={20} color="#FF4444" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.customPreviewButton, designStyles.editButton]}
                          onPress={() => openCustomPreviewEditor(index)}
                        >
                          <MaterialIcons name="image" size={20} color="#9C27B0" />
                        </TouchableOpacity>
                        {editingLinkIndex !== index ? (
                          <>
                            <TouchableOpacity 
                              onPress={() => handleShareLink(link.url, linkPreviews[link.url]?.title || link.title)}
                              style={[styles.openButton, designStyles.openButton]}
                            >
                              <MaterialIcons name="share" size={20} color="#4a90e2" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          // Show editing buttons: Refresh, Cancel
                          <>
                            <TouchableOpacity 
                              style={[styles.refreshEditButton, designStyles.editButton]}
                              onPress={async () => {
                                console.log('Refresh button pressed!');
                                try {
                                  showSuccessMessage('Re-fetching original title...');
                                  
                                  // Fetch only the title from the web
                                  const freshTitle = await fetchLinkTitleOnly(link.url);
                                  
                                  if (freshTitle) {
                                    // Update the edit field with the fresh title
                                    setEditingTitle(freshTitle);
                                    showSuccessMessage('Original title restored!');
                                  } else {
                                    // If we couldn't fetch a fresh title, restore the cached one
                                    const cachedTitle = linkPreviews[link.url]?.title || link.title;
                                    setEditingTitle(cachedTitle);
                                    showSuccessMessage('Using cached title');
                                  }
                                  
                                } catch (error) {
                                  console.error('Error re-fetching title:', error);
                                  // Fallback to cached title
                                  const cachedTitle = linkPreviews[link.url]?.title || link.title;
                                  setEditingTitle(cachedTitle);
                                  showSuccessMessage('Failed to re-fetch, using cached title');
                                }
                              }}
                              activeOpacity={0.7}
                              pointerEvents="auto"
                            >
                              <MaterialIcons name="refresh" size={20} color="#4a90e2" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={[styles.cancelEditButton, designStyles.editButton]}
                              onPress={() => {
                                console.log('Cancel button pressed!');
                                setEditingLinkIndex(null);
                                setEditingTitle('');
                              }}
                              activeOpacity={0.7}
                              pointerEvents="auto"
                            >
                              <MaterialIcons name="close" size={20} color="#FF4444" />
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isTitleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTitleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Title</Text>
            <TextInput
              style={styles.modalInput}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Enter new title"
              placeholderTextColor="#a9a9a9"
              textAlign="left"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setIsTitleModalVisible(false);
                  setTitleInput('');
                  setEditingLinkIndex(null);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={updateLinkTitle}
              >
                <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Design Selector Dropdown */}
      {isDesignSelectorVisible && (
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setIsDesignSelectorVisible(false)}
        >
          <View 
            style={[
              styles.designDropdownContent,
              {
                top: dropdownPosition.y + 40,
                left: Math.max(10, dropdownPosition.x - 110),
              }
            ]}
          >
            {Object.entries(designs).map(([designKey, design]) => (
              <TouchableOpacity
                key={designKey}
                style={[
                  styles.designDropdownItem,
                  currentDesign === designKey && styles.designDropdownItemActive
                ]}
                onPress={() => changeDesign(designKey)}
              >
                <View style={styles.designDropdownItemHeader}>
                  <MaterialIcons 
                    name="palette" 
                    size={18} 
                    color={currentDesign === designKey ? "#4a90e2" : "#666"} 
                  />
                  <Text style={[
                    styles.designDropdownItemTitle,
                    currentDesign === designKey && styles.designDropdownItemTitleActive
                  ]}>
                    {design.name}
                  </Text>
                  {currentDesign === designKey && (
                    <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                  )}
                </View>
                <Text style={[
                  styles.designDropdownItemDescription,
                  currentDesign === designKey && styles.designDropdownItemDescriptionActive
                ]}>
                  {design.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* Custom Preview Editor Modal */}
      <Modal
        visible={isCustomPreviewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCustomPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customPreviewModal}>
            <View style={styles.customPreviewHeader}>
              <Text style={styles.customPreviewTitle}>Customize Preview</Text>
              <TouchableOpacity 
                onPress={() => setIsCustomPreviewModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.customPreviewContent}>
              {/* Image Section */}
              <View style={styles.customPreviewSection}>
                <Text style={styles.customPreviewSectionTitle}>Preview Image</Text>
                <TouchableOpacity 
                  style={styles.imageSelectorButton}
                  onPress={handleImageSelection}
                >
                  {customPreviewData.image ? (
                    <Image 
                      source={{ uri: customPreviewData.image }} 
                      style={styles.previewImageThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <MaterialIcons name="add-photo-alternate" size={48} color="#ccc" />
                      <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.imageHintText}>
                  Take a screenshot of the content or upload your own image
                </Text>
              </View>

              {/* Title Section */}
              <View style={styles.customPreviewSection}>
                <Text style={styles.customPreviewSectionTitle}>Title</Text>
                <TextInput
                  style={styles.customPreviewInput}
                  value={customPreviewData.title}
                  onChangeText={(text) => setCustomPreviewData(prev => ({ ...prev, title: text }))}
                  placeholder="Enter custom title"
                  placeholderTextColor="#999"
                  multiline
                />
              </View>

              {/* Description Section */}
              <View style={styles.customPreviewSection}>
                <Text style={styles.customPreviewSectionTitle}>Description</Text>
                <TextInput
                  style={[styles.customPreviewInput, styles.descriptionInput]}
                  value={customPreviewData.description}
                  onChangeText={(text) => setCustomPreviewData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter custom description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.customPreviewActions}>
              <TouchableOpacity 
                style={[styles.customPreviewButton, styles.cancelButton]}
                onPress={() => setIsCustomPreviewModalVisible(false)}
              >
                <Text style={styles.customPreviewButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.customPreviewButton, styles.saveButton]}
                onPress={saveCustomPreview}
              >
                <Text style={[styles.customPreviewButtonText, styles.saveButtonText]}>Save Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Dialog removed - not needed for normal operations */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    position: 'relative',
    height: 280, // Increased height to accommodate status bar area
  },
  collectionImage: {
    width: '100%',
    height: '100%',
  },
  statusBarArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 25, // Cover the Android system status bar area
    backgroundColor: 'rgba(0,0,0,0.9)', // Black background for status bar
    zIndex: 15,
  },
  headerLine: {
    position: 'absolute',
    top: 25, // Start just below the Android system status bar
    left: 0,
    right: 0,
    height: 50, // Normal height for navigation header
    backgroundColor: 'rgba(0,0,0,0.7)', // Darker background for better system icon visibility
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  collectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    textAlign: 'center',
  },
  contentContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'column',
    marginBottom: 20,
    gap: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'column',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 4,
    flexShrink: 1,
    lineHeight: 24,
    textAlignVertical: 'center',
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputFieldsContainer: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
  },
  linkInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
  },
  addButtonContainer: {
    // Container to prevent keyboard dismissal interference
  },
  addButton: {
    width: 56,
    height: 56,
    backgroundColor: '#4a90e2',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0.1,
  },
  linksContainer: {
    marginTop: 10,
  },
  gridLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  linkItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  linkItemEditing: {
    backgroundColor: '#f0f0f0',
    borderColor: '#4a90e2',
    borderWidth: 2,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  linkMainContent: {
    flex: 1,
    marginBottom: 12,
  },
  linkContent: {
    marginTop: 12,
  },
  linkIcon: {
    marginRight: 10,
  },
  linkTextContainer: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 24,
  },
  linkUrl: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  linkDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  editButton: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  deleteButton: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    marginHorizontal: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'left',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    fontSize: 16,
    textAlign: 'left',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#4a90e2',
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButtonText: {
    color: 'white',
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 6,
    justifyContent: 'space-between',
    width: '100%',
  },
  sortButton: {
    padding: 12,
    marginHorizontal: 2,
    borderRadius: 18,
    backgroundColor: 'transparent',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#4a90e2',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 0,
    margin: 0,
    outlineStyle: 'none',
    borderWidth: 0,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 4,
  },
  reverseIcon: {
    transform: [{ rotate: '180deg' }],
  },
  linkTitleInput: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    textAlign: 'left',
  },
  editingContainer: {
    flex: 1,
  },
  editingHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  openButton: {
    padding: 6,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  cancelEditButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshEditButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  previewLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  siteNameBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  siteNameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewText: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  siteName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewDescription: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  designChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 8,
    borderWidth: 0.5,
    borderColor: '#4a90e2',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    height: 44,
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 80,
  },
  designChangeText: {
    marginLeft: 8,
    marginRight: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#4a90e2',
    flexShrink: 1,
  },

  classicMenuContainer: {
    position: 'relative',
    zIndex: 10,
  },
  threeDotButton: {
    padding: 4,
    backgroundColor: 'transparent',
    borderRadius: 6,
    borderWidth: 0,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classicDropdownMenu: {
    position: 'absolute',
    top: 35,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 2,
    minWidth: 140,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  menuItemText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  designDropdownContent: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    width: 220,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  designDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  designDropdownItemActive: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  designDropdownItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  designDropdownItemTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  designDropdownItemTitleActive: {
    color: '#4a90e2',
  },
  designDropdownItemDescription: {
    fontSize: 12,
    color: '#666',
    marginLeft: 26,
    lineHeight: 16,
  },
  designDropdownItemDescriptionActive: {
    color: '#4a90e2',
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
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  retryText: {
    color: '#4a90e2',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  customPreviewButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customPreviewModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  customPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  customPreviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  customPreviewContent: {
    padding: 20,
    maxHeight: 400,
  },
  customPreviewSection: {
    marginBottom: 24,
  },
  customPreviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  imageSelectorButton: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  previewImageThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  imageHintText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  customPreviewInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  customPreviewActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  customPreviewButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#9C27B0',
  },
  customPreviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
}); 