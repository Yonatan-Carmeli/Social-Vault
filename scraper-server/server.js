const express = require('express');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration - Allow all origins for development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins and common development ports
    const allowedOrigins = [
      'http://localhost:19006', 
      'http://localhost:19000',
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:8080',
      'https://your-app-domain.com',
      /^http:\/\/localhost:\d+$/,  // Allow any localhost port
      /^https:\/\/.*\.railway\.app$/,  // Allow Railway deployments
      /^https:\/\/.*\.vercel\.app$/,   // Allow Vercel deployments
      /^https:\/\/.*\.netlify\.app$/   // Allow Netlify deployments
    ];
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow for now, but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Rate limiting - More generous for development
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
  max: 200, // limit each IP to 200 requests per windowMs (increased from 100)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/';
  }
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Legal OpenGraph scraper function with enhanced social media support
async function scrapeOpenGraph(url) {
  try {
    console.log(`Scraping OpenGraph for: ${url}`);
    
    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
    }

    // Enhanced user agent for better compatibility
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // Enhanced headers for better social media compatibility
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };

    // Add platform-specific headers
    if (url.includes('instagram.com')) {
      headers['Referer'] = 'https://www.instagram.com/';
    } else if (url.includes('facebook.com')) {
      headers['Referer'] = 'https://www.facebook.com/';
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      timeout: 15000, // Increased timeout to 15 seconds
      follow: 5, // Follow up to 5 redirects
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract OpenGraph meta tags
    const extractMetaContent = (property) => {
      const meta = document.querySelector(`meta[property="${property}"]`) || 
                   document.querySelector(`meta[name="${property}"]`);
      return meta ? meta.getAttribute('content') : null;
    };

    // Extract Twitter Card meta tags as fallback
    const extractTwitterContent = (name) => {
      const meta = document.querySelector(`meta[name="twitter:${name}"]`);
      return meta ? meta.getAttribute('content') : null;
    };

    // Extract standard meta tags
    const extractStandardMeta = (name) => {
      const meta = document.querySelector(`meta[name="${name}"]`);
      return meta ? meta.getAttribute('content') : null;
    };

    // Enhanced platform-specific extraction
    const isInstagram = url.includes('instagram.com');
    const isFacebook = url.includes('facebook.com');
    const isTikTok = url.includes('tiktok.com');
    
    // Build preview data with enhanced fallbacks
    const previewData = {
      url: url,
      title: extractMetaContent('og:title') || 
             extractTwitterContent('title') || 
             extractStandardMeta('title') ||
             document.querySelector('title')?.textContent?.trim() ||
             (isInstagram ? 'Instagram Post' : 
              isFacebook ? 'Facebook Post' : 
              isTikTok ? 'TikTok Video' : 'Untitled'),
      
      description: extractMetaContent('og:description') || 
                   extractTwitterContent('description') || 
                   extractStandardMeta('description') ||
                   extractStandardMeta('summary') ||
                   (isInstagram ? 'View this post on Instagram' : 
                    isFacebook ? 'View this post on Facebook' : 
                    isTikTok ? 'View this video on TikTok' : ''),
      
      image: extractMetaContent('og:image') || 
             extractTwitterContent('image') || 
             extractStandardMeta('image') ||
             null,
      
      siteName: extractMetaContent('og:site_name') || 
                extractTwitterContent('site') || 
                (isInstagram ? 'Instagram' : 
                 isFacebook ? 'Facebook' : 
                 isTikTok ? 'TikTok' : urlObj.hostname),
      
      type: extractMetaContent('og:type') || 
            (isInstagram ? 'video.other' : 
             isFacebook ? 'article' : 
             isTikTok ? 'video.other' : 'website'),
      
      // Additional metadata
      author: extractMetaContent('article:author') || 
              extractStandardMeta('author') ||
              null,
      
      publishedTime: extractMetaContent('article:published_time') || 
                     extractStandardMeta('date') ||
                     null,
      
      // Video specific
      video: extractMetaContent('og:video') || 
             extractMetaContent('og:video:url') ||
             null,
      
      videoType: extractMetaContent('og:video:type') || null,
      
      // Audio specific
      audio: extractMetaContent('og:audio') || null,
      
      // Platform-specific data
      platform: isInstagram ? 'instagram' : 
                isFacebook ? 'facebook' : 
                isTikTok ? 'tiktok' : 'unknown',
      
      // Clean and validate image URL
      imageUrl: null
    };

    // Validate and clean image URL
    if (previewData.image) {
      try {
        const imageUrl = new URL(previewData.image, url);
        previewData.imageUrl = imageUrl.toString();
      } catch (e) {
        console.log('Invalid image URL:', previewData.image);
        previewData.imageUrl = null;
      }
    }

    // Clean title and description
    previewData.title = previewData.title.replace(/\s+/g, ' ').trim();
    previewData.description = previewData.description.replace(/\s+/g, ' ').trim();

    // If no meaningful data was extracted, try to extract from page content
    if (!previewData.title || previewData.title === 'Untitled' || previewData.title.includes('Instagram Post')) {
      // Try to extract from JSON-LD structured data
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const jsonData = JSON.parse(script.textContent);
          if (jsonData.name && previewData.title === 'Untitled') {
            previewData.title = jsonData.name;
          }
          if (jsonData.description && !previewData.description) {
            previewData.description = jsonData.description;
          }
          if (jsonData.image && !previewData.image) {
            previewData.image = jsonData.image;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    }

    // Final fallback for social media platforms
    if (isInstagram && (!previewData.title || previewData.title.includes('Instagram'))) {
      // Try to extract Instagram post ID for better title
      const postIdMatch = url.match(/\/p\/([^\/]+)/) || url.match(/\/reel\/([^\/]+)/);
      if (postIdMatch) {
        previewData.title = `Instagram ${url.includes('/reel/') ? 'Reel' : 'Post'} - ${postIdMatch[1]}`;
        previewData.description = `View this ${url.includes('/reel/') ? 'reel' : 'post'} on Instagram`;
      }
    }

    if (isFacebook && (!previewData.title || previewData.title.includes('Facebook'))) {
      previewData.title = 'Facebook Post';
      previewData.description = 'View this post on Facebook';
    }

    console.log(`Successfully scraped: ${previewData.title}`);
    return {
      success: true,
      data: previewData,
      source: 'opengraph',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    };
  }
}

// API endpoint for scraping
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const result = await scrapeOpenGraph(url);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SocialVault Legal Scraper Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Batch scraping endpoint for multiple URLs
app.post('/api/scrape/batch', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 URLs per batch request'
      });
    }

    const results = await Promise.allSettled(
      urls.map(url => scrapeOpenGraph(url))
    );

    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason.message,
          url: urls[index],
          timestamp: new Date().toISOString()
        };
      }
    });

    res.json({
      success: true,
      results: processedResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legal Scraper Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Scrape endpoint: http://localhost:${PORT}/api/scrape`);
});

module.exports = app;
