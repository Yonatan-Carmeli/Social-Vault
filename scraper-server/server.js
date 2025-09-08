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

// CORS configuration
app.use(cors({
  origin: ['http://localhost:19006', 'https://your-app-domain.com'], // Add your app domains
  credentials: true
}));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Legal OpenGraph scraper function
async function scrapeOpenGraph(url) {
  try {
    console.log(`Scraping OpenGraph for: ${url}`);
    
    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
    }

    // Set user agent to identify as a legitimate scraper
    const userAgent = 'SocialVault-LegalScraper/1.0 (+https://your-app-domain.com/bot)';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000, // 10 second timeout
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

    // Build preview data with fallbacks
    const previewData = {
      url: url,
      title: extractMetaContent('og:title') || 
             extractTwitterContent('title') || 
             extractStandardMeta('title') ||
             document.querySelector('title')?.textContent?.trim() ||
             'Untitled',
      
      description: extractMetaContent('og:description') || 
                   extractTwitterContent('description') || 
                   extractStandardMeta('description') ||
                   extractStandardMeta('summary') ||
                   '',
      
      image: extractMetaContent('og:image') || 
             extractTwitterContent('image') || 
             extractStandardMeta('image') ||
             null,
      
      siteName: extractMetaContent('og:site_name') || 
                extractTwitterContent('site') || 
                urlObj.hostname,
      
      type: extractMetaContent('og:type') || 'website',
      
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
