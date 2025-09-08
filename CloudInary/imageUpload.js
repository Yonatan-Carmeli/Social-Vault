// ייבוא הגדרות Cloudinary
import { CLOUDINARY_CONFIG } from './Config';

// Fallback upload method for phones using React Native compatible approach
const fallbackUpload = async (uri) => {
    console.log('Trying fallback upload method...');
    
    try {
        // Method 1: Try to upload the URI directly as a file
        console.log('Fallback method 1: Direct file upload...');
        
        const formData = new FormData();
        formData.append('file', {
            uri: uri,
            type: 'image/jpeg',
            name: 'image.jpg'
        });
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        
        if (response.ok) {
            const responseData = await response.json();
            if (responseData.secure_url) {
                console.log('Fallback method 1 successful');
                return responseData.secure_url;
            }
        }
        
        // Method 2: Try with different content type
        console.log('Fallback method 2: Alternative content type...');
        
        const formData2 = new FormData();
        formData2.append('file', {
            uri: uri,
            type: 'image/*',
            name: 'image.jpg'
        });
        formData2.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData2.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        const response2 = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData2,
            }
        );
        
        if (response2.ok) {
            const responseData2 = await response2.json();
            if (responseData2.secure_url) {
                console.log('Fallback method 2 successful');
                return responseData2.secure_url;
            }
        }
        
        throw new Error('All fallback methods failed');
        
    } catch (error) {
        console.log('Fallback method failed:', error);
        throw error;
    }
};

// פונקציה להעלאת תמונה ל-Cloudinary
// מקבלת URI של התמונה ומחזירה את כתובת ה-URL של התמונה שהועלתה
export const uploadImageAsync = async (uri) => {
    try {
        console.log('=== CLOUDINARY UPLOAD START ===');
        console.log('Uploading image with URI:', uri);
        console.log('Cloudinary config:', CLOUDINARY_CONFIG);
        
        // Check if URI is valid
        if (!uri) {
            throw new Error('No image URI provided');
        }

        // Handle different URI types for better phone compatibility
        let fileData;
        let fileName = 'image.jpg';
        
        if (uri.startsWith('file://') || uri.startsWith('content://')) {
            // Phone file URI - use base64 approach for better compatibility
            console.log('Phone URI detected, converting to base64...');
            
            try {
                // Method 1: Try to convert to base64
                const response = await fetch(uri);
                const blob = await response.blob();
                
                // Convert blob to base64
                const reader = new FileReader();
                const base64Promise = new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                });
                reader.readAsDataURL(blob);
                
                const base64Data = await base64Promise;
                console.log('Successfully converted to base64');
                
                // Extract the base64 data (remove data:image/jpeg;base64, prefix)
                const base64String = base64Data.split(',')[1];
                fileData = base64String;
                
            } catch (base64Error) {
                console.log('Base64 conversion failed, trying direct upload...');
                // Fallback: try direct upload
                fileData = uri;
            }
        } else if (uri.startsWith('data:')) {
            // Base64 URI - extract the data
            console.log('Base64 URI detected, extracting data...');
            const base64String = uri.split(',')[1];
            fileData = base64String;
        } else {
            // Web URI or other - use as is
            console.log('Web URI detected, using directly...');
            fileData = uri;
        }

        console.log('File data prepared, creating upload request...');

        // Create FormData for upload
        const formData = new FormData();
        
        if (typeof fileData === 'string' && !fileData.startsWith('http')) {
            // Base64 data
            formData.append('file', `data:image/jpeg;base64,${fileData}`);
        } else {
            // File URI or URL
            formData.append('file', fileData, fileName);
        }
        
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        console.log('FormData created, uploading to Cloudinary...');
        console.log('Upload URL:', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`);

        // Send POST request to Cloudinary API
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                },
            }
        );
        
        console.log('Response received, status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload failed with status:', response.status);
            console.error('Error response:', errorText);
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('Upload successful, response data:', responseData);
        
        if (!responseData.secure_url) {
            throw new Error('No secure URL returned from Cloudinary');
        }
        
        console.log('=== CLOUDINARY UPLOAD SUCCESS ===');
        console.log('Final image URL:', responseData.secure_url);
        
        return responseData.secure_url;
        
    } catch (error) {
        console.error('=== CLOUDINARY UPLOAD ERROR ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Try fallback method if this is a phone and the main method failed
        if ((uri.startsWith('file://') || uri.startsWith('content://')) && 
            (error.message.includes('Network request failed') || error.message.includes('Upload failed'))) {
            console.log('Main upload failed, trying fallback method...');
            
            try {
                const fallbackResult = await fallbackUpload(uri);
                console.log('Fallback upload successful');
                return fallbackResult;
            } catch (fallbackError) {
                console.error('Fallback upload also failed:', fallbackError);
            }
        }
        
        // Provide more specific error messages
        let errorMessage = 'Failed to upload image';
        
        if (error.message.includes('Network request failed')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('Upload failed')) {
            errorMessage = 'Upload failed. Please try again or use a different image.';
        } else if (error.message.includes('No image URI')) {
            errorMessage = 'No image selected. Please choose an image first.';
        }
        
        throw new Error(`${errorMessage} (${error.message})`);
    }
};
