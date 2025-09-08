// ייבוא הספריות והרכיבים הנדרשים
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignUp from './screens/SignUp';
import LogIn from './screens/LogIn';
import Welcome from './screens/Welcome';
import MainScreen from './screens/MainScreen';
import Collections from './screens/Collections';
import CollectionFormat from './screens/CollectionFormat';
import CollectionScreen from './screens/CollectionScreen';
import ShareHandler from './screens/ShareHandler';
import Profile from './screens/Profile';
import { auth } from './FireBase/Config';
import { onAuthStateChanged } from 'firebase/auth';
import { ThemeProvider } from './ThemeContext';
import ShareIntentListener from './utils/ShareIntentListener';


// יצירת ניווט מסוג Stack
const Stack = createNativeStackNavigator();

// רכיב האפליקציה הראשי
export default function App() {
  // משתני מצב לניהול המשתמש והאתחול
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [sharedContent, setSharedContent] = useState(null);
  const [isVerificationInProgress, setIsVerificationInProgress] = useState(false);
  const navigationRef = useRef();

  // מעקב אחר מצב האימות של המשתמש
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle share intents
  useEffect(() => {
    if (!user) return; // Only listen when user is logged in

    const removeListener = ShareIntentListener.addListener((content) => {
      console.log('Received shared content:', content);
      setSharedContent(content);
      
      // Navigate to ShareHandler screen
      if (navigationRef.current) {
        navigationRef.current.navigate('ShareHandler', { sharedContent: content });
      }
    });

    return () => {
      removeListener();
      ShareIntentListener.stopListening();
    };
  }, [user]);

  // Start listening for share intents
  useEffect(() => {
    if (user) {
      ShareIntentListener.setupAndroidListener();
    }
  }, [user]);

  // הצגת מסך ריק בזמן אתחול
  if (initializing) return null;

  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={user && !isVerificationInProgress ? "MainScreen" : "Welcome"}>
          {!user || isVerificationInProgress ? (
            // מסכי אימות - מוצגים כאשר המשתמש לא מחובר או כאשר תהליך האימות מתבצע
            <>
              <Stack.Screen name="Welcome" component={Welcome} />
              <Stack.Screen name="SignUp" component={SignUp} initialParams={{ setIsVerificationInProgress }} />
              <Stack.Screen name="LogIn" component={LogIn} />
            </>
          ) : (
            // מסכי האפליקציה - מוצגים כאשר המשתמש מחובר
            <>
              <Stack.Screen name="MainScreen" component={MainScreen} />
              <Stack.Screen name="Collections" component={Collections} options={{ headerShown: false }} />
              <Stack.Screen name="CollectionFormat" component={CollectionFormat} options={{ headerShown: false }} />
              <Stack.Screen name="ShareHandler" component={ShareHandler} options={{ headerShown: false }} />
              <Stack.Screen name="Profile" component={Profile} options={{ headerShown: false }} />
              <Stack.Screen 
                name="CollectionScreen" 
                component={CollectionScreen}
                options={{
                  title: 'Image Collection',
                  headerStyle: {
                    backgroundColor: '#4a90e2',
                  },
                  headerTintColor: '#fff',
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
