import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool, q } from './db';

const k = (n: string) => n; // readability
const SCENES: Record<string, { title: string; end?: boolean; text: string; choices?: [string, string, any?, any?][] }> = {
  start: { title: 'The door', text: 'The Archive door swings inward before {MC_Name} can knock. Inside, a thousand lanterns hang dark from the rafters, and a girl in a patched coat is already waiting.\n\n"You\'re late, {MC_Name}," says Wren. "The lights only answer to people who arrive on time."',
    choices: [['Follow Wren into the stacks', 'stacks', { trust: 1 }], ['Read the ledger by the door', 'ledger', { flags_add: ['saw_ledger'] }]] },
  stacks: { title: 'The stacks', text: 'Wren leads you between shelves that smell of candle smoke and rain. She lifts one cracked lantern from a hook.\n\n"It went out the night the vault door sealed. Nobody who touched it has come back the same."',
    choices: [['Take the lantern', 'vault', { courage: 2, flags_add: ['lantern'] }], ['Ask Wren what it costs', 'vault', { trust: 2 }]] },
  ledger: { title: 'The ledger', text: 'The ledger is open to today. Every apprentice is listed in ink except one name, scratched out so hard the paper has torn: Wren.\n\nBehind you, a floorboard creaks.',
    choices: [['Confront Wren about the name', 'vault', { courage: 1, trust: -1 }], ['Say nothing and keep watching', 'vault', { flags_add: ['watching'] }]] },
  vault: { title: 'The vault', text: 'The vault door is a slab of black glass, warm to the touch. Somewhere behind it, something hums a tune {MC_Name} almost recognises.\n\nWren stops a step behind you. "Decide now. The lanterns are listening."',
    choices: [['Open the door with the lantern', 'e_light', {}, { flags: ['lantern'] }], ['Knock three times, with Wren beside you', 'e_trust', {}, { trust: '>= 2' }], ['Force the door open', 'e_bold', {}, { courage: '>= 1' }], ['Turn back and leave', 'e_quiet', {}]] },
  e_light: { title: 'Ending: Light', end: true, text: 'The cracked lantern flares and every dark lantern answers at once. The glass dissolves into light. Inside is a single chair and a note in your own handwriting: you were always meant to arrive late.' },
  e_trust: { title: 'Ending: Name', end: true, text: 'The door opens on the third knock. Wren exhales like she has held that breath for years. "That was my name," she whispers. "You gave it back." The lanterns warm, one by one.' },
  e_bold: { title: 'Ending: Crack', end: true, text: 'The door gives with a crack like river ice. The lanterns flicker, wary. You have won a way in, and the Archive will remember how.' },
  e_quiet: { title: 'Ending: Rain', end: true, text: 'You step back into the rain. Behind you the door closes gently, as if it had expected this. Some stories wait. The lanterns keep your place.' },
};

(async () => {
  const hash = await bcrypt.hash('glimmer-demo-1', 12);
  const [u] = await q(`insert into users(email,password_hash,role,accepted_terms_at) values('author@glimmer.dev',$1,'author',now())
    on conflict (email) do update set role='author' returning id`, [hash]);
  const [s] = await q(`insert into stories(title, blurb, author_id, tags, variables, author_rules, is_published)
    values('The Lantern Archive','An original tale of a late apprentice, a sealed vault and a girl whose name was scratched from the ledger.',$1,$2,$3,$4,true) returning id`,
    [u.id, ['mystery', 'original'], ['courage', 'trust'], 'Tone: quiet, eerie, gentle. The Archive is a living library of dark lanterns. Wren is guarded but kind.']);
  const ids: Record<string, string> = {};
  let i = 0;
  for (const key of Object.keys(SCENES)) {
    ids[k(key)] = randomUUID();
    const sc = SCENES[key];
    await q('insert into story_nodes(id, story_id, title, content, is_ending, pos_x, pos_y) values($1,$2,$3,$4,$5,$6,$7)',
      [ids[key], s.id, sc.title, sc.text, !!sc.end, (i % 3) * 300, Math.floor(i / 3) * 200]);
    i++;
  }
  for (const key of Object.keys(SCENES)) {
    let sort = 0;
    for (const [text, to, fx, req] of SCENES[key].choices ?? [])
      await q('insert into node_choices(parent_node_id, next_node_id, choice_text, effects, required_state, sort) values($1,$2,$3,$4,$5,$6)',
        [ids[key], ids[to], text, fx ?? {}, req ?? {}, sort++]);
  }
  await q('update stories set start_node_id=$2 where id=$1', [s.id, ids.start]);
  console.log('Seeded. Author login: author@glimmer.dev / glimmer-demo-1');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
