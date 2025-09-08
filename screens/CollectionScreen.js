import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../FireBase/Config';

export default function CollectionScreen() {
  // משתני מצב: רשימת האלבומים, טעינה, שגיאה
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // טעינת האלבומים כאשר המסך נטען
  useEffect(() => {
    fetchAlbums();
  }, []);

  // שליפת האלבומים מהדאטהבייס
  const fetchAlbums = async () => {
    try {
      setLoading(true); // התחלת טעינה
      const albumsCollection = collection(db, 'albums'); // הפנייה לאוסף האלבומים
      const snapshot = await getDocs(albumsCollection); // שליפת כל האלבומים
      
      if (snapshot.empty) { // בדיקה אם אין אלבומים
        console.log('No albums found');
        setAlbums([]);
        return;
      }

      // המרת המסמכים למערך נתונים
      const albumsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAlbums(albumsData); // עדכון המצב עם האלבומים
      setError(null); // איפוס שגיאה
      console.log(albumsData);
    } catch (err) {
      // טיפול בשגיאה בשליפת האלבומים
      console.error('Error fetching albums:', err);
      setError('Failed to load albums. Please try again later.');
    } finally {
      setLoading(false); // סיום טעינה
    }
  };

  // הצגת מסך טעינה אם הנתונים עדיין נטענים
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading albums...</Text>
      </View>
    );
  }

  // הצגת מסך שגיאה אם יש שגיאה
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // הצגת האלבומים במסך
  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageGrid}>
        {/* הצגת כל האלבומים */}
        {albums.map((album) => (
          <View key={album.id} style={styles.imageCard}>
            {/* תמונת האלבום */}
            <Image
              source={{ uri: album.imageLink }}
              style={styles.image}
              resizeMode="cover"
            />
            {/* כותרת האלבום (אם קיימת) */}
            {album.title && (
              <Text style={styles.imageTitle}>{album.title}</Text>
            )}
            {/* תיאור האלבום (אם קיים) */}
            {album.description && (
              <Text style={styles.imageDescription}>{album.description}</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// הגדרות העיצוב של המסך
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  imageCard: {
    width: '48%',
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#e1e1e1',
  },
  imageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 10,
    color: '#333',
  },
  imageDescription: {
    fontSize: 14,
    color: '#666',
    padding: 10,
    paddingTop: 0,
  },
});
