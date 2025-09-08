import { getFunctions } from 'firebase/functions';
import { auth } from '../FireBase/Config';

// Initialize Firebase Functions
const functions = getFunctions();

// Get the function URLs
const baseUrl = 'https://us-central1-social-vault.cloudfunctions.net';

/**
 * Send verification email with 6-digit code via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} verificationCode - The 6-digit verification code (not used, generated on server)
 * @param {string} userName - The user's full name
 * @returns {Promise} - Email sending result
 */
export const sendVerificationEmail = async (userEmail, verificationCode, userName) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(`${baseUrl}/sendVerificationEmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        userName: userName
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Verification email sent successfully via Cloud Function');
      return { 
        success: true, 
        message: 'Verification email sent successfully' 
      };
    } else {
      throw new Error(result.error || 'Failed to send verification email');
    }
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, message: 'Failed to send verification email' };
  }
};

/**
 * Send password reset email via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} resetCode - The password reset code (not used, generated on server)
 * @param {string} userName - The user's full name
 * @returns {Promise} - Email sending result
 */
export const sendPasswordResetEmail = async (userEmail, resetCode, userName) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(`${baseUrl}/sendPasswordResetEmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        userName: userName
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Password reset email sent successfully via Cloud Function');
      return { 
        success: true, 
        message: 'Password reset email sent successfully' 
      };
    } else {
      throw new Error(result.error || 'Failed to send password reset email');
    }
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, message: 'Failed to send password reset email' };
  }
};

/**
 * Verify the entered code via Firebase Cloud Functions
 * @param {string} userEmail - The user's email address
 * @param {string} code - The verification code entered by the user
 * @returns {Promise} - Verification result
 */
export const verifyCode = async (userEmail, code) => {
  try {
    // Call the Firebase Cloud Function via HTTP
    const response = await fetch(`${baseUrl}/verifyCode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        code: code
      })
    });
    
    const result = await response.json();
    
    console.log('Code verification result:', result);
    return result;
  } catch (error) {
    console.error('Failed to verify code:', error);
    return { success: false, message: 'Failed to verify code' };
  }
};
