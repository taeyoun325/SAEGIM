import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Persistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// firebase(npm 래퍼 패키지)의 './auth' export map은 react-native 조건을 노출하지 않아
// getReactNativePersistence 타입을 정적으로 가져올 수 없다. Metro는 런타임에
// @firebase/auth의 react-native 빌드로 정확히 해석하므로 require + 타입 단언으로 우회한다.
const getReactNativePersistence = (
  require('@firebase/auth') as { getReactNativePersistence: (storage: unknown) => Persistence }
).getReactNativePersistence;

export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : (() => {
        try {
          return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } catch {
          return getAuth(app);
        }
      })();

// 웹은 IndexedDB 영속 캐시를 켜서 오프라인에서도 이미 읽은 피드/캘린더를 볼 수 있고,
// 새 글도 로컬에 큐로 쌓였다가 연결이 돌아오면 자동으로 전송된다(지하철 등 저신호 환경
// 대응 — 저널링 앱의 "낮은 마찰"이 리텐션의 핵심이라는 조사 결과를 반영했다).
// 네이티브(RN JS SDK)는 이 캐시가 실험적이라 실기기 검증 없이는 켜지 않는다.
export const db =
  Platform.OS === 'web'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    : getFirestore(app);
export const storage = getStorage(app);
