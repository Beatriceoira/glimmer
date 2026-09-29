import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, WEB } from './api';
import { useStore } from './store';
import { useTheme } from './theme';

export default function Library() {
  const c = useTheme();
  const { token, go, signOut } = useStore();
  const [stories, setStories] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    try { setStories(await api('/stories')); setErr(''); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = () => Alert.alert('Delete account', 'This permanently deletes your account, progress and any stories you wrote.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api('/auth/me', { method: 'DELETE' }); await signOut(); } },
  ]);
  return (
    <FlatList
      contentContainerStyle={{ padding: 20 }} data={stories} keyExtractor={(x) => x.id} refreshing={busy} onRefresh={load}
      ListHeaderComponent={<View>
        <Text style={[s.h1, { color: c.ink }]}>Glimmer</Text>
        <Text style={{ color: c.mute, marginBottom: 12 }}>Interactive fanfiction where your choices, and your own words, steer the story.</Text>
        {!!err && <Text style={{ color: c.err }}>{err}</Text>}
      </View>}
      renderItem={({ item }) => (
        <Pressable style={[s.card, { backgroundColor: c.panel, borderColor: c.line }]} onPress={() => (token ? go('reader', item.id) : go('login'))}>
          <Text style={[s.h2, { color: c.ink }]}>{item.title}</Text>
          <Text style={{ color: c.mute }}>{item.blurb}</Text>
        </Pressable>
      )}
      ListFooterComponent={<View style={{ marginTop: 24, gap: 10 }}>
        {token ? <>
          <Pressable onPress={signOut}><Text style={{ color: c.mute, textDecorationLine: 'underline' }}>Sign out</Text></Pressable>
          <Pressable onPress={del}><Text style={{ color: c.mute, textDecorationLine: 'underline' }}>Delete account</Text></Pressable>
        </> : <Pressable onPress={() => go('login')}><Text style={{ color: c.ink, fontWeight: '600' }}>Sign in to read</Text></Pressable>}
        <Pressable onPress={() => Linking.openURL(`${WEB}/terms`)}><Text style={{ color: c.mute, textDecorationLine: 'underline' }}>Terms and conditions</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(`${WEB}/privacy`)}><Text style={{ color: c.mute, textDecorationLine: 'underline' }}>Privacy policy</Text></Pressable>
      </View>}
    />
  );
}
const s = StyleSheet.create({ h1: { fontSize: 34, fontWeight: '600', marginTop: 24 }, h2: { fontSize: 20, fontWeight: '600', marginBottom: 6 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 } });
