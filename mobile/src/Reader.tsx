import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import EventSource from 'react-native-sse';
import { api, API } from './api';
import { buyTurns } from './purchases';
import { useStore } from './store';
import { useTheme } from './theme';

export default function Reader() {
  const c = useTheme();
  const { storyId, token, go } = useStore();
  const [v, setV] = useState<any>(null);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState('Iris');
  const [text, setText] = useState('');
  const [stream, setStream] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const es = useRef<EventSource<'token' | 'done' | 'fail'> | null>(null);

  useEffect(() => {
    api(`/play/${storyId}/state`).then(setV).catch(() => setNeedsName(true));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); es.current?.close(); };
  }, [storyId]);

  async function begin(restart = false) {
    setErr('');
    try { setV(await api(`/play/${storyId}/start`, { body: { name, restart } })); setNeedsName(false); } catch (e: any) { setErr(e.message); }
  }
  async function choose(choiceId: string) {
    setErr('');
    try { setV(await api(`/play/${storyId}/choose`, { body: { choiceId } })); } catch (e: any) { setErr(e.message); }
  }
  function act() {
    const t = text.trim();
    if (!t || stream !== null) return;
    setErr(''); setStream('');
    const src = new EventSource<'token' | 'done' | 'fail'>(`${API}/play/${storyId}/act`, {
      method: 'POST', pollingInterval: 0,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: t }),
    });
    es.current = src;
    src.addEventListener('token', (e: any) => setStream((s) => (s ?? '') + JSON.parse(e.data).t));
    src.addEventListener('done', (e: any) => { setV(JSON.parse(e.data)); setStream(null); setText(''); src.close(); });
    src.addEventListener('fail', (e: any) => { setErr(JSON.parse(e.data).error); setStream(null); src.close(); });
    src.addEventListener('error', (e: any) => { // non-200 responses (out of turns, moderation) arrive here with the JSON body as message
      let m = 'Connection lost. Try again.';
      try { m = JSON.parse(e.message).error || m; } catch {}
      setErr(m); setStream(null); src.close();
    });
  }
  async function buy() { try { await buyTurns(); } catch (e: any) { Alert.alert('Purchases unavailable', e.message ?? 'Use a development build with RevenueCat configured.'); } }

  const input = [s.input, { backgroundColor: c.panel, borderColor: c.line, color: c.ink }];
  if (needsName) return (
    <View style={s.pad}>
      <Text style={[s.h1, { color: c.ink }]}>Who are you in this story?</Text>
      <TextInput style={input} value={name} onChangeText={setName} maxLength={20} placeholder="Your character's name" placeholderTextColor={c.mute} />
      <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={() => begin()}><Text style={{ color: c.accentInk, fontWeight: '600' }}>Begin</Text></Pressable>
      {!!err && <Text style={{ color: c.err, marginTop: 8 }}>{err}</Text>}
    </View>
  );
  if (!v) return <View style={s.pad}><Text style={{ color: c.mute }}>Loading…</Text></View>;

  const t = v.turns;
  const secs = t.nextRefillAt ? Math.max(0, Math.ceil((t.nextRefillAt - now) / 1000)) : 0;
  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <View style={s.bar}>
        <Pressable onPress={() => go('library')}><Text style={{ color: c.mute }}>Library</Text></Pressable>
        <Pressable onPress={buy}>
          <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'flex-end' }}>
            {Array.from({ length: t.max }, (_, i) => <View key={i} style={{ width: 9, height: 14, borderRadius: 5, backgroundColor: i < t.free ? c.accent : c.line }} />)}
          </View>
          <Text style={{ color: c.mute, fontSize: 12, textAlign: 'right' }}>{t.nextRefillAt ? `Next turn ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : 'Turns full'}{t.purchased ? ` · ${t.purchased} extra` : ''}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(v.state.vars).map(([k, n]) => <Text key={k} style={[s.chip, { borderColor: c.line, color: c.teal }]}>{k} {String(n)}</Text>)}
        {v.state.flags.map((f: string) => <Text key={f} style={[s.chip, { borderColor: c.line, color: c.teal }]}>{f.replace(/_/g, ' ')}</Text>)}
      </View>
      {v.node.content.split('\n\n').map((p: string, i: number) => <Text key={i} style={[s.prose, { color: c.ink }]}>{p}</Text>)}
      {v.beats.map((b: string, i: number) => <Text key={i} style={[s.beat, { borderColor: c.accent, color: c.ink }]}>{b}</Text>)}
      {stream !== null && <Text style={[s.beat, { borderColor: c.accent, color: c.ink }]}>{stream || '…'}</Text>}

      {v.node.isEnding ? (
        <View style={[s.card, { backgroundColor: c.panel, borderColor: c.line }]}>
          <Text style={[s.h1, { color: c.ink, fontSize: 24 }]}>The end</Text>
          <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={() => begin(true)}><Text style={{ color: c.accentInk, fontWeight: '600' }}>Read again</Text></Pressable>
        </View>
      ) : (
        <>
          {v.choices.map((ch: any) => (
            <Pressable key={ch.id} disabled={ch.locked || stream !== null} onPress={() => choose(ch.id)}
              style={[s.choice, { backgroundColor: c.panel, borderColor: c.line, opacity: ch.locked ? 0.55 : 1 }]}>
              <Text style={{ color: c.ink, fontSize: 16 }}>{ch.text}</Text>
              {ch.locked && <Text style={{ color: c.mute, fontSize: 12 }}>Locked: {ch.lockReason}</Text>}
            </Pressable>
          ))}
          {v.node.allowCustom && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: c.mute, marginBottom: 6 }}>Or do something else (uses one turn)</Text>
              <TextInput style={input} value={text} onChangeText={setText} maxLength={255} placeholder="Type your own action" placeholderTextColor={c.mute} onSubmitEditing={act} returnKeyType="send" />
              <Pressable style={[s.btn, { backgroundColor: c.accent, opacity: stream !== null ? 0.5 : 1 }]} onPress={act} disabled={stream !== null}>
                <Text style={{ color: c.accentInk, fontWeight: '600' }}>Act</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {!!err && <Text style={{ color: c.err, marginTop: 12 }}>{err}</Text>}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  pad: { padding: 20, paddingTop: 56 }, bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  h1: { fontSize: 28, fontWeight: '600', marginBottom: 12 }, prose: { fontFamily: 'Georgia', fontSize: 18, lineHeight: 28, marginBottom: 14 },
  beat: { borderLeftWidth: 3, paddingLeft: 12, fontStyle: 'italic', fontSize: 16, lineHeight: 24, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, fontSize: 13 },
  choice: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 16 }, btn: { borderRadius: 10, padding: 14, alignItems: 'center' },
});
