import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, WEB } from './api';
import { useStore } from './store';
import { useTheme } from './theme';

export default function Login() {
  const c = useTheme();
  const { signIn, go } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [age, setAge] = useState(false); const [terms, setTerms] = useState(false); const [author, setAuthor] = useState(false);
  const [err, setErr] = useState('');
  async function submit() {
    setErr('');
    try {
      const d = mode === 'login'
        ? await api('/auth/login', { body: { email, password } })
        : await api('/auth/register', { body: { email, password, acceptTerms: terms, confirmAge13: age, wantsToWrite: author } });
      await signIn(d.token, d.role);
    } catch (e: any) { setErr(e.message); }
  }
  const input = [s.input, { backgroundColor: c.panel, borderColor: c.line, color: c.ink }];
  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => go('library')}><Text style={{ color: c.mute }}>Back to library</Text></Pressable>
      <Text style={[s.h1, { color: c.ink }]}>{mode === 'login' ? 'Sign in' : 'Create your account'}</Text>
      <TextInput style={input} placeholder="Email" placeholderTextColor={c.mute} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={input} placeholder="Password (8+ characters)" placeholderTextColor={c.mute} secureTextEntry value={password} onChangeText={setPassword} />
      {mode === 'register' && (
        <>
          <Row c={c} label="I am 13 or older" v={age} on={setAge} />
          <Row c={c} label="I agree to the terms and privacy policy" v={terms} on={setTerms} />
          <Row c={c} label="I want to write stories" v={author} on={setAuthor} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => Linking.openURL(`${WEB}/terms`)}><Text style={{ color: c.mute, textDecorationLine: 'underline' }}>Terms</Text></Pressable>
            <Pressable onPress={() => Linking.openURL(`${WEB}/privacy`)}><Text style={{ color: c.mute, textDecorationLine: 'underline' }}>Privacy policy</Text></Pressable>
          </View>
        </>
      )}
      {!!err && <Text style={{ color: c.err, marginVertical: 8 }}>{err}</Text>}
      <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={submit}><Text style={{ color: c.accentInk, fontWeight: '600' }}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text></Pressable>
      <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}><Text style={{ color: c.mute, marginTop: 16 }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text></Pressable>
    </ScrollView>
  );
}
const Row = ({ c, label, v, on }: any) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }}>
    <Text style={{ color: c.ink, flex: 1, paddingRight: 12 }}>{label}</Text><Switch value={v} onValueChange={on} />
  </View>
);
const s = StyleSheet.create({
  pad: { padding: 20 }, h1: { fontSize: 30, fontWeight: '600', marginVertical: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 16 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
});
