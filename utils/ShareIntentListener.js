import { AppState, Linking, Platform } from 'react-native';

class ShareIntentListener {
  constructor() {
    this.listeners = [];
    this.isListening = false;
    this.lastAppState = AppState.currentState;
    this.sharedContent = null;
    this.appStateSubscription = null;
  }

  setupAndroidListener() {
    try {
      // Listen for app state changes to detect when app comes to foreground
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      this.startListening();
    } catch (error) {
      console.log('Share intent listener not available:', error);
    }
  }

  startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    console.log('Share intent listener started');
    
    // Check if we have any stored shared content
    this.checkForStoredContent();
  }

  stopListening() {
    this.isListening = false;
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  handleAppStateChange = (nextAppState) => {
    if (this.lastAppState.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - check for shared content
      this.checkForStoredContent();
    }
    this.lastAppState = nextAppState;
  };

  checkForStoredContent() {
    // For now, we'll use a simple approach
    // In a real implementation, you'd check the intent extras
    if (this.sharedContent) {
      this.notifyListeners(this.sharedContent);
      this.sharedContent = null;
    }
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  notifyListeners(content) {
    this.listeners.forEach(callback => {
      callback(content);
    });
  }

  // Process shared content and extract useful information
  processSharedContent(sharedText) {
    if (!sharedText) return null;

    // Try to extract URL from shared text
    const urlMatch = sharedText.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;

    // Try to extract title (first line without URL)
    const lines = sharedText.split('\n').filter(line => line.trim());
    const title = lines.length > 0 ? lines[0].replace(url || '', '').trim() : 'Shared Content';

    // Try to extract description (remaining lines)
    const description = lines.slice(1).join('\n').trim();

    return {
      url: url || sharedText,
      title: title || 'Shared Content',
      description: description || '',
      originalText: sharedText,
      sourceApp: this.detectSourceApp(sharedText)
    };
  }

  detectSourceApp(sharedText) {
    // This is a simplified detection - in reality you'd get this from the intent
    if (sharedText.includes('instagram.com')) return 'Instagram';
    if (sharedText.includes('facebook.com')) return 'Facebook';
    if (sharedText.includes('twitter.com') || sharedText.includes('x.com')) return 'X (Twitter)';
    if (sharedText.includes('youtube.com')) return 'YouTube';
    if (sharedText.includes('tiktok.com')) return 'TikTok';
    if (sharedText.includes('reddit.com')) return 'Reddit';
    if (sharedText.includes('snapchat.com')) return 'Snapchat';
    if (sharedText.includes('linkedin.com')) return 'LinkedIn';
    if (sharedText.includes('pinterest.com')) return 'Pinterest';
    return 'Unknown';
  }

  // Simulate receiving shared content (for testing)
  simulateSharedContent(text) {
    const processedContent = this.processSharedContent(text);
    this.sharedContent = processedContent;
    this.notifyListeners(processedContent);
  }

  // Store shared content from external source (would be called by native side)
  storeSharedContent(text) {
    this.sharedContent = this.processSharedContent(text);
  }
}

export default new ShareIntentListener();
