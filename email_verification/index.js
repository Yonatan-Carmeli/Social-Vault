/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onCall, onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({origin: true});

// Initialize Firebase Admin
admin.initializeApp();

// Create email transporter (you'll configure this with your email service)
const transporter = nodemailer.createTransport({
  service: "gmail", // You can change this to 'outlook', 'yahoo', etc.
  auth: {
    user: "noreply.socialvault.app@gmail.com", // Replace with your actual email
    pass: "ezbs pzli uqnc iymt", // Replace with your Gmail app password
  },
});

/**
 * Cloud Function to send verification email
 */
exports.sendVerificationEmail = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, userName} = req.body;

      // Validate input
      if (!email || !userName) {
        res.status(400).json({ error: "Email and userName are required" });
        return;
      }

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Create simple email content
      const mailOptions = {
        from: "noreply.socialvault.app@gmail.com", // Replace with your actual email
        to: email,
        subject: "Verify Your Social-Vault Account",
        html: "<h1>Hello " + userName + "!</h1><p>Your verification code is: <strong>" + verificationCode + "</strong></p><p>This code will expire in 10 minutes.</p>",
      };

      // Send the email
      await transporter.sendMail(mailOptions);

      // Store verification code securely in Firestore
      const db = admin.firestore();
      const verificationData = {
        email: email,
        code: verificationCode,
        userName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 10 * 60 * 1000),
        ), // 10 minutes
        used: false,
      };

      // Store in a separate collection for verification codes
      await db.collection("verificationCodes").add(verificationData);

      console.log(`Verification email sent successfully to ${email}`);

      res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  });
});

/**
 * Cloud Function to verify the entered code
 */
exports.verifyCode = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, code} = req.body;

      // Validate input
      if (!email || !code) {
        res.status(400).json({ error: "Email and code are required" });
        return;
      }

      const db = admin.firestore();

      // Find the verification code for this email
      const verificationQuery = await db.collection("verificationCodes")
          .where("email", "==", email)
          .where("code", "==", code)
          .where("used", "==", false)
          .where("expiresAt", ">", admin.firestore.Timestamp.now())
          .limit(1)
          .get();

      if (verificationQuery.empty) {
        res.status(200).json({
          success: false,
          message: "Invalid or expired verification code",
        });
        return;
      }

      const verificationDoc = verificationQuery.docs[0];

      // Mark the code as used
      await verificationDoc.ref.update({used: true});

      console.log(`Code verified successfully for ${email}`);

      res.status(200).json({
        success: true,
        message: "Code verified successfully",
      });
    } catch (error) {
      console.error("Error verifying code:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });
});

/**
 * Cloud Function to send password reset email
 */
exports.sendPasswordResetEmail = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send();
        return;
      }

      const {email, userName} = req.body;

      // Validate input
      if (!email || !userName) {
        res.status(400).json({ error: "Email and userName are required" });
        return;
      }

      // Generate 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Create simple email content
      const mailOptions = {
        from: "noreply.socialvault.app@gmail.com", // Replace with your actual email
        to: email,
        subject: "Reset Your Social-Vault Password",
        html: "<h1>Hello " + userName + "!</h1><p>Your password reset code is: <strong>" + resetCode + "</strong></p><p>This code will expire in 10 minutes.</p>",
      };

      // Send the email
      await transporter.sendMail(mailOptions);

      // Store reset code securely in Firestore
      const db = admin.firestore();
      const resetData = {
        email: email,
        code: resetCode,
        userName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 10 * 60 * 1000),
        ), // 10 minutes
        used: false,
        type: "password_reset",
      };

      await db.collection("resetCodes").add(resetData);

      console.log(`Password reset email sent successfully to ${email}`);

      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      res.status(500).json({ error: "Failed to send password reset email" });
    }
  });
});
