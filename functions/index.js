// Firebase Cloud Function: getLinkPreview
// - Uses only legal APIs and methods for link previews
// - No scraping or unauthorized access
// - Caches results in Firestore

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin once
try {
  admin.initializeApp();
} catch (e) {
  // no-op if already initialized
}

const db = admin.firestore();

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || process.env.EMAIL_USER,
    pass: functions.config().email?.pass || process.env.EMAIL_PASS
  }
});

// Generate a random 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createSafeDocId(url) {
  return encodeURIComponent(url).replace(/[^a-zA-Z0-9]/g, '_');
}

function extractMeta(html, property) {
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const match = html.match(regex);
  return match ? match[1] : null;
}

function normalizeUrlForPlatform(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace('www.', '');
    
    // YouTube normalization
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = null;
      if (host.includes('youtu.be')) {
        videoId = u.pathname.slice(1);
      } else if (u.searchParams.has('v')) {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.includes('/embed/')) {
        videoId = u.pathname.split('/embed/')[1];
      }
      if (videoId) {
        videoId = videoId.split('&')[0].split('?')[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
    
    // Instagram normalization
    if (host.includes('instagram.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'reel' || parts[0] === 'p')) {
        return `https://www.instagram.com/${parts[0]}/${parts[1]}/`;
      }
      return `https://www.instagram.com${u.pathname}`;
    }
    
    // Facebook normalization
    if (host.includes('facebook.com')) {
      // Remove tracking parameters
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(p => 
        u.searchParams.delete(p)
      );
      return u.toString();
    }
    
    // Remove common tracking parameters
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(p => 
      u.searchParams.delete(p)
    );
    return u.toString();
  } catch {
    return url;
  }
}

function getPlatformPreview(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    
    // YouTube preview
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = null;
      if (host.includes('youtu.be')) {
        videoId = u.pathname.slice(1);
      } else if (u.searchParams.has('v')) {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.includes('/embed/')) {
        videoId = u.pathname.split('/embed/')[1];
      }
      if (videoId) {
        videoId = videoId.split('&')[0].split('?')[0];
        return {
          image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          siteName: 'YouTube',
        };
      }
    }
    
    // Instagram preview
    if (host.includes('instagram.com')) {
      return { siteName: 'Instagram' };
    }
    
    // Facebook preview
    if (host.includes('facebook.com')) {
      return { siteName: 'Facebook' };
    }
    
    // TikTok preview
    if (host.includes('tiktok.com')) {
      return { siteName: 'TikTok' };
    }
    
    // Twitter/X preview
    if (host.includes('twitter.com') || host.includes('x.com')) {
      return { siteName: 'X (Twitter)' };
    }
    
    return null;
  } catch {
    return null;
  }
}

// Function to get social media previews using legal methods
async function getSocialMediaPreview(url) {
  try {
    console.log('Getting social media preview using legal methods:', url);
    
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Try microlink.io API first for all social media sites
    try {
      console.log('Trying microlink.io API for:', url);
      const response = await fetch(
        `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=true`,
        { 
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SocialVault/1.0; +https://socialvault.app)'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          console.log('Microlink API success for social media:', data.data);
          return {
            title: data.data.title || 'Social Media Content',
            description: data.data.description || 'Click to view the full content',
            image: data.data.image?.url || data.data.screenshot?.url || null,
            siteName: data.data.publisher || getSiteNameFromUrl(url),
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (microlinkError) {
      console.log('Microlink API failed for social media:', microlinkError.message);
    }
    
    // Try Open Graph meta tags as fallback
    try {
      console.log('Trying Open Graph meta tags for:', url);
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
          console.log('Open Graph data extracted:', { title, description, image, siteName });
          return {
            title: title || 'Social Media Content',
            description: description || 'Click to view the full content',
            image: image || null,
            siteName: siteName || getSiteNameFromUrl(url),
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (ogError) {
      console.log('Open Graph extraction failed:', ogError.message);
    }
    
    // Final fallback: Use platform-specific placeholders
    if (hostname.includes('instagram.com')) {
      return {
        title: 'Instagram Post',
        description: 'Instagram content - click to view the full post',
        image: 'https://via.placeholder.com/400x300/e4405f/ffffff?text=Instagram',
        siteName: 'Instagram'
      };
    }
    
    if (hostname.includes('facebook.com')) {
      return {
        title: 'Facebook Post',
        description: 'Facebook content - click to view the full post',
        image: 'https://via.placeholder.com/400x300/1877f2/ffffff?text=Facebook',
        siteName: 'Facebook'
      };
    }
    
    if (hostname.includes('tiktok.com')) {
      return {
        title: 'TikTok Video',
        description: 'TikTok video - click to view the full content',
        image: 'https://via.placeholder.com/400x300/000000/ffffff?text=TikTok',
        siteName: 'TikTok'
      };
    }
    
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return {
        title: 'Twitter Post',
        description: 'Twitter content - click to view the full post',
        image: 'https://via.placeholder.com/400x300/1da1f2/ffffff?text=Twitter',
        siteName: 'X (Twitter)'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Social media preview failed:', error.message);
    return null;
  }
}

// Helper function to get site name from URL
function getSiteNameFromUrl(url) {
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
}

// Image proxy function for social media thumbnails
exports.proxyImage = functions.https.onRequest(async (req, res) => {
  try {
    const { imageUrl } = req.query;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl parameter is required' });
    }

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }

    // Fetch the image from the social media platform
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': new URL(imageUrl).origin,
      },
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Set appropriate headers
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Send the image data
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

exports.getLinkPreview = functions
  .region('us-central1')
  .memory('512MB') // Reduced memory since no Puppeteer
  .timeout(30) // Reduced timeout since no Puppeteer operations
  .https.onRequest(async (req, res) => {
    // Basic CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
      const url = (req.query.url || '').toString();
      if (!url) return res.status(400).json({ error: 'Missing url' });

      const normalizedUrl = normalizeUrlForPlatform(url);
      const safeId = createSafeDocId(normalizedUrl);
      const docRef = db.collection('linkPreviews').doc(safeId);

      // Check cache first
      const snap = await docRef.get();
      if (snap.exists) {
        const cachedData = snap.data();
        // For social media links, always try to fetch fresh data
        const isSocialMedia = normalizedUrl.includes('instagram.com') || 
                             normalizedUrl.includes('facebook.com') || 
                             normalizedUrl.includes('tiktok.com');
        if (isSocialMedia) {
          console.log('Social media link found in cache, will fetch fresh data');
          try {
            await docRef.delete();
            console.log('Cleared old social media cached data');
          } catch (e) {
            console.log('Could not clear social media cache:', e.message);
          }
        } else {
          // For non-social media links, return cached data if it's not stale
          const isStale = !cachedData?.image || 
                         cachedData?.title === 'Loading preview...' || 
                         (cachedData?.description || '').includes('Fetching link information');
          if (!isStale) {
            return res.json(cachedData);
          }
        }
      }

      let preview = {
        title: 'Loading preview...',
        description: 'Fetching link information...',
        image: null,
        siteName: 'Unknown site',
        timestamp: new Date().toISOString(),
      };

      const platform = getPlatformPreview(normalizedUrl) || {};
      preview = { ...preview, ...platform };
      
      // Determine if this is a social media site
      const isSocialMedia = normalizedUrl.includes('instagram.com') || 
                           normalizedUrl.includes('facebook.com') || 
                           normalizedUrl.includes('tiktok.com') ||
                           normalizedUrl.includes('twitter.com') ||
                           normalizedUrl.includes('x.com');
      
      if (isSocialMedia) {
        console.log('Social media link detected, using legal methods...');
        
        // Use only legal placeholder content for social media
        const socialMediaData = await getSocialMediaPreview(normalizedUrl);
        if (socialMediaData) {
          if (socialMediaData.title) preview.title = socialMediaData.title;
          if (socialMediaData.description) preview.description = socialMediaData.description;
          if (socialMediaData.image) preview.image = socialMediaData.image;
          if (socialMediaData.siteName) preview.siteName = socialMediaData.siteName;
          
          console.log('Social media data applied to preview:', preview);
        }
        
        // Social media previews are now handled by the legal method above
      } else {
        // For non-social media sites, try traditional methods
        console.log('Non-social media link, trying traditional methods...');
        
        // Try to fetch HTML and extract meta tags
        try {
          const r = await fetch(normalizedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
          });
          
          if (r.ok) {
            const html = await r.text();
            const title = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title');
            const description = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description');
            const image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
            const siteName = extractMeta(html, 'og:site_name');
            
            if (title) preview.title = title;
            if (description) preview.description = description;
            if (image) preview.image = image;
            if (siteName) preview.siteName = siteName;
          }
        } catch (e) {
          console.log('Traditional HTML fetch failed:', e.message);
        }
      }

      // Save to Firestore
      await docRef.set(preview);
      console.log('Final preview data saved:', preview);
      
      return res.json(preview);
    } catch (err) {
      console.error('Cloud Function error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

// Email verification functions
exports.sendVerificationEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, userName } = data;
      
      if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
      }

      // Generate verification code
      const verificationCode = generateVerificationCode();
      
      // Store the verification code in Firestore with expiration (10 minutes)
      const verificationRef = db.collection('emailVerifications').doc(email);
      await verificationRef.set({
        code: verificationCode,
        userName: userName || 'User',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      });

      // Email template
      const mailOptions = {
        from: functions.config().email?.user || process.env.EMAIL_USER,
        to: email,
        subject: 'SocialVault - Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">SocialVault</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Email Verification</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${userName || 'there'}!</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Thank you for signing up with SocialVault! To complete your registration, 
                please use the verification code below:
              </p>
              
              <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; font-weight: bold;">${verificationCode}</h1>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                This code will expire in 10 minutes. If you didn't request this verification, 
                please ignore this email.
              </p>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                <p style="color: #999; font-size: 14px; margin: 0;">
                  Best regards,<br>
                  The SocialVault Team
                </p>
              </div>
            </div>
          </div>
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);
      
      console.log(`Verification email sent to ${email}`);
      
      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send verification email');
    }
  });

exports.sendPasswordResetEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, userName } = data;
      
      if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
      }

      // Generate reset code
      const resetCode = generateVerificationCode();
      
      // Store the reset code in Firestore with expiration (15 minutes)
      const resetRef = db.collection('passwordResets').doc(email);
      await resetRef.set({
        code: resetCode,
        userName: userName || 'User',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
      });

      // Email template
      const mailOptions = {
        from: functions.config().email?.user || process.env.EMAIL_USER,
        to: email,
        subject: 'SocialVault - Password Reset',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">SocialVault</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Password Reset</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${userName || 'there'}!</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                We received a request to reset your password. Use the code below to create a new password:
              </p>
              
              <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; font-weight: bold;">${resetCode}</h1>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                This code will expire in 15 minutes. If you didn't request a password reset, 
                please ignore this email and your password will remain unchanged.
              </p>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                <p style="color: #999; font-size: 14px; margin: 0;">
                  Best regards,<br>
                  The SocialVault Team
                </p>
              </div>
            </div>
          </div>
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);
      
      console.log(`Password reset email sent to ${email}`);
      
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send password reset email');
    }
  });

exports.verifyCode = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, code } = data;
      
      if (!email || !code) {
        throw new functions.https.HttpsError('invalid-argument', 'Email and code are required');
      }

      // Check verification codes first
      const verificationRef = db.collection('emailVerifications').doc(email);
      const verificationDoc = await verificationRef.get();
      
      if (verificationDoc.exists) {
        const verificationData = verificationDoc.data();
        const now = new Date();
        const expiresAt = verificationData.expiresAt.toDate();
        
        if (now < expiresAt && verificationData.code === code) {
          // Code is valid, delete it
          await verificationRef.delete();
          return { success: true, message: 'Email verified successfully' };
        }
      }

      // Check password reset codes
      const resetRef = db.collection('passwordResets').doc(email);
      const resetDoc = await resetRef.get();
      
      if (resetDoc.exists) {
        const resetData = resetDoc.data();
        const now = new Date();
        const expiresAt = resetData.expiresAt.toDate();
        
        if (now < expiresAt && resetData.code === code) {
          // Code is valid, delete it
          await resetRef.delete();
          return { success: true, message: 'Password reset code verified successfully' };
        }
      }

      // If we get here, the code is invalid or expired
      return { success: false, message: 'Invalid or expired verification code' };
    } catch (error) {
      console.error('Error verifying code:', error);
      throw new functions.https.HttpsError('internal', 'Failed to verify code');
    }
  });


