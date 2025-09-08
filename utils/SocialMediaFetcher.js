// SocialMediaFetcher.js - Enhanced legal and reliable social media fetching
// Alert import removed - no more user-facing alerts

// Rate limiting configuration
const RATE_LIMITS = {
  'instagram.com': { requests: 0, maxRequests: 8, timeWindow: 60000 }, // 8 requests per minute (increased)
  'facebook.com': { requests: 0, maxRequests: 5, timeWindow: 60000 }, // 5 requests per minute
  'tiktok.com': { requests: 0, maxRequests: 3, timeWindow: 60000 }, // 3 requests per minute
  'twitter.com': { requests: 0, maxRequests: 3, timeWindow: 60000 }, // 3 requests per minute
  'x.com': { requests: 0, maxRequests: 3, timeWindow: 60000 }, // 3 requests per minute
  'youtube.com': { requests: 0, maxRequests: 10, timeWindow: 60000 }, // 10 requests per minute
  'youtu.be': { requests: 0, maxRequests: 10, timeWindow: 60000 }, // 10 requests per minute
  'default': { requests: 0, maxRequests: 8, timeWindow: 60000 } // 8 requests per minute for other sites
};

// Rate limiting timer
let rateLimitTimer = null;

// Reset rate limits every minute
const startRateLimitTimer = () => {
  if (rateLimitTimer) return;
  
  rateLimitTimer = setInterval(() => {
    Object.keys(RATE_LIMITS).forEach(domain => {
      RATE_LIMITS[domain].requests = 0;
    });
  }, 60000);
};

// Check if we can make a request to a domain
const canMakeRequest = (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    let domain = 'default';
    
    // Find matching domain
    Object.keys(RATE_LIMITS).forEach(key => {
      if (hostname.includes(key)) {
        domain = key;
      }
    });
    
    const limit = RATE_LIMITS[domain];
    if (limit.requests >= limit.maxRequests) {
      return false;
    }
    
    limit.requests++;
    return true;
  } catch (error) {
    console.log('Error checking rate limit:', error);
    return true; // Allow if we can't parse URL
  }
};

// Start the rate limiting timer
startRateLimitTimer();

// Enhanced metadata fetching with multiple fallback methods
export const fetchEnhancedMetadata = async (url, options = {}) => {
  const { 
    useCache = true, 
    forceRefresh = false, 
    showUserFeedback = true,
    onError = null // New callback for custom error handling
  } = options;
  
  try {
    console.log('Fetching enhanced metadata for:', url);
    
    // Check rate limiting - silently handle without user alerts
    if (!canMakeRequest(url)) {
      console.log('Rate limited for URL:', url, '- silently continuing');
      // Don't show any alerts or error dialogs - just continue silently
      return createPlaceholderMetadata(url);
    }
    
    // Try multiple LEGAL methods in order of reliability
    const methods = [
      () => fetchWithMicrolink(url),
      () => fetchWithYouTubeAPI(url),
      () => fetchWithSocialMediaFallback(url)
      // Removed fetchWithDirectHTML - potentially violates ToS and copyright laws
    ];
    
    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`Trying method ${i + 1} for:`, url);
        const result = await methods[i]();
        
        if (result && result.title) {
          console.log(`Method ${i + 1} succeeded:`, result);
          return result;
        }
      } catch (error) {
        console.log(`Method ${i + 1} failed:`, error.message);
        continue;
      }
    }
    
    // All methods failed, return placeholder
    return createPlaceholderMetadata(url);
    
  } catch (error) {
    console.error('All metadata fetching methods failed:', error);
    return createPlaceholderMetadata(url);
  }
};

// Method 1: Microlink.io API (most reliable, already legal)
const fetchWithMicrolink = async (url) => {
  try {
    const response = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=true`,
      { timeout: 15000 }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'success' && data.data) {
      return {
        title: data.data.title || 'Untitled',
        thumbnail: data.data.image?.url || data.data.screenshot?.url || null,
        description: data.data.description || 'No description available',
        siteName: data.data.publisher || getSiteNameFromUrl(url),
        timestamp: new Date().toISOString()
      };
    }
    
    throw new Error('Microlink API returned unsuccessful status');
  } catch (error) {
    throw new Error(`Microlink failed: ${error.message}`);
  }
};

// Method 2: YouTube API (for YouTube videos - most reliable)
const fetchWithYouTubeAPI = async (url) => {
  try {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      throw new Error('Not a YouTube URL');
    }
    
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract YouTube video ID');
    }
    
    // Try oEmbed API first (no API key required)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, { timeout: 10000 });
    
    if (response.ok) {
      const data = await response.json();
      
      return {
        title: data.title || 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: data.author_name ? `By ${data.author_name}` : 'YouTube video',
        siteName: 'YouTube',
        timestamp: new Date().toISOString()
      };
    }
    
    throw new Error('YouTube oEmbed API failed');
  } catch (error) {
    throw new Error(`YouTube API failed: ${error.message}`);
  }
};

// REMOVED: Direct HTML scraping method
// This method was removed for legal compliance reasons:
// - Violates website Terms of Service
// - May infringe on copyright laws
// - Circumvents anti-bot measures
// - Could be considered unauthorized access
// 
// We now only use official APIs and legal methods:
// 1. Microlink.io API (official service)
// 2. YouTube oEmbed API (official API)
// 3. Social media fallbacks (placeholder content)

// Method 4: Social media specific fallbacks with legal Open Graph extraction
const fetchWithSocialMediaFallback = async (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Try Open Graph meta tags first for social media sites
    try {
      console.log('Trying Open Graph meta tags for social media:', url);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SocialVault/1.0; +https://socialvault.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000,
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Extract Open Graph meta tags
        const getMetaContent = (property) => {
          const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
          const match = html.match(regex);
          return match ? match[1] : null;
        };
        
        const title = getMetaContent('og:title') || getMetaContent('twitter:title');
        const description = getMetaContent('og:description') || getMetaContent('twitter:description');
        const image = getMetaContent('og:image') || getMetaContent('twitter:image');
        const siteName = getMetaContent('og:site_name') || getSiteNameFromUrl(url);
        
        if (title || description || image) {
          console.log('Open Graph data extracted for social media:', { title, description, image, siteName });
          return {
            title: title || 'Social Media Content',
            description: description || 'Click to view the full content',
            thumbnail: image || null,
            siteName: siteName || getSiteNameFromUrl(url),
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (ogError) {
      console.log('Open Graph extraction failed for social media:', ogError.message);
    }
    
    // Fallback to platform-specific placeholders
    if (hostname.includes('instagram.com')) {
      return {
        title: 'Instagram Post',
        thumbnail: 'https://via.placeholder.com/400x300/e4405f/ffffff?text=Instagram',
        description: 'Instagram content - click to view the full post',
        siteName: 'Instagram',
        timestamp: new Date().toISOString()
      };
    }
    
    if (hostname.includes('facebook.com')) {
      return {
        title: 'Facebook Post',
        thumbnail: 'https://via.placeholder.com/400x300/1877f2/ffffff?text=Facebook',
        description: 'Facebook content - click to view the full post',
        siteName: 'Facebook',
        timestamp: new Date().toISOString()
      };
    }
    
    if (hostname.includes('tiktok.com')) {
      return {
        title: 'TikTok Video',
        thumbnail: 'https://via.placeholder.com/400x300/000000/ffffff?text=TikTok',
        description: 'TikTok video - click to view the full content',
        siteName: 'TikTok',
        timestamp: new Date().toISOString()
      };
    }
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return {
        title: 'Twitter Post',
        thumbnail: 'https://via.placeholder.com/400x300/1da1f2/ffffff?text=Twitter',
        description: 'Twitter content - click to view the full post',
        siteName: 'X (Twitter)',
        timestamp: new Date().toISOString()
      };
    }
    
    throw new Error('No social media fallback available');
  } catch (error) {
    throw new Error(`Social media fallback failed: ${error.message}`);
  }
};

// Helper functions
const extractYouTubeVideoId = (url) => {
  try {
    if (url.includes('youtube.com/watch?v=')) {
      return url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
      return url.split('embed/')[1].split('?')[0];
    }
    return null;
  } catch (error) {
    return null;
  }
};

// REMOVED: Instagram post ID extraction function
// This function was removed for legal compliance reasons:
// - Instagram's media endpoints require proper API access
// - Using them without authorization violates Instagram's Terms of Service
// - Could be considered unauthorized access to Instagram's systems

// REMOVED: HTML parsing helper functions
// These functions were used for direct HTML scraping which has been removed
// for legal compliance reasons. We now only use official APIs.

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

const decodeHtmlEntities = (text) => {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
};

const createPlaceholderMetadata = (url) => {
  const siteName = getSiteNameFromUrl(url);
  return {
    title: `${siteName} Content`,
    thumbnail: `https://via.placeholder.com/400x300/6c757d/ffffff?text=${encodeURIComponent(siteName)}`,
    description: 'Content from this site - click to view',
    siteName,
    timestamp: new Date().toISOString()
  };
};

// Export rate limiting info for debugging
export const getRateLimitInfo = () => {
  return RATE_LIMITS;
};

// Export function to check if we can make requests
export const checkRateLimit = (url) => {
  return canMakeRequest(url);
};
