import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import { api } from './src/api';
import Library from './src/Library';
import Login from './src/Login';
import { initPurchases } from './src/purchases';
import Reader from './src/Reader';
import { useStore } from './src/store';
import { useTheme } from './src/theme';

export default function App() {
  const c = useTheme();
  const { ready, token, screen, hydrate } = useStore();
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (token) api('/auth/me').then((me) => initPurchases(me.id)).catch(() => {}); }, [token]);
  if (!ready) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="auto" />
      {screen === 'login' ? <Login /> : screen === 'reader' && token ? <Reader /> : <Library />}
    </SafeAreaView>
  );
}
