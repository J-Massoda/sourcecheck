export const demoA = `id,name,email,status,updated_at
C-104,Amina Noor,amina@example.test,active,2026-10-12
C-105,Jonah Price,jonah@example.test,active,2026-09-03
C-106,Maya Chen,maya@example.test,pending,2026-10-08
C-107,Omar Diallo,omar@example.test,active,2026-10-11
C-108,Ellie Ward,ellie@example.test,active,2026-10-09`;
export const demoB = `id,name,email,status,updated_at
C-104,Amina Noor,amina@example.test,active,2026-10-13
C-105,Jonah Price,jonah@example.test,inactive,2026-10-10
C-106,Maya Chen,maya@example.test,pending,2026-10-09
C-106,Maya Chen,maya.duplicate@example.test,pending,2026-10-09
C-109,Omar Diallo,omar@example.test,active,2026-10-13
C-110,Elena Ward,ellie@example.test,active,2026-10-10`;
export const defaultMap = { id:'id', name:'name', email:'email', status:'status', updated:'updated_at' };
export function parseCSV(text) {
  if (text.length > 1_000_000) throw new Error('CSV exceeds the 1 MB demo limit.');
  const input = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) { if (c === '"' && input[i+1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') { if (cell) throw new Error('Malformed quote in CSV.'); quoted = true; }
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && input[i+1] === '\n') i++; row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quote.');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('CSV needs a header and at least one data row.');
  const headers = rows.shift().map(v => v.trim());
  if (new Set(headers).size !== headers.length || headers.some(v => !v)) throw new Error('CSV headers must be unique and nonempty.');
  if (rows.length > 500) throw new Error('CSV exceeds the 500-row demo limit.');
  if (rows.some(r => r.length !== headers.length)) throw new Error('CSV rows have different column counts.');
  return { headers, rows: rows.map((cells, index) => ({ line: index + 2, values: Object.fromEntries(headers.map((h, i) => [h, cells[i].trim()])) })) };
}
const norm = x => String(x || '').trim().toLowerCase();
export function mapRecords(parsed, mapping) {
  for (const field of ['id','name','email','status','updated']) if (!parsed.headers.includes(mapping[field])) throw new Error(`Choose a column for ${field}.`);
  return parsed.rows.map(row => ({ line:row.line, id:row.values[mapping.id], name:row.values[mapping.name], email:row.values[mapping.email], status:row.values[mapping.status], updated:row.values[mapping.updated] }));
}
const key = (kind, a, b, n = 0) => `${kind}:${a ?? '-'}:${b ?? '-'}:${n}`;
export function compare(left, right) {
  const issues = []; const matchedRight = new Set(); const leftIds = new Map(), rightIds = new Map();
  for (const r of left) if (norm(r.id)) leftIds.set(norm(r.id), [...(leftIds.get(norm(r.id)) || []), r]);
  for (const r of right) if (norm(r.id)) rightIds.set(norm(r.id), [...(rightIds.get(norm(r.id)) || []), r]);
  for (const [side, map] of [['Source A',leftIds], ['Source B',rightIds]]) for (const [id, entries] of map) if (entries.length > 1) issues.push({key:key('duplicate',side,id), type:'Duplicate ID', severity:'High', title:`${entries.length} rows share ${id}`, detail:`${side} has multiple records with the same identifier.`, a:side === 'Source A' ? entries[0] : null, b:side === 'Source B' ? entries[0] : null, basis:'Repeated ID in one source'});
  const uniqueRight = new Map([...rightIds].filter(([,entries]) => entries.length === 1).map(([id, entries]) => [id, entries[0]]));
  for (const a of left) {
    const id = norm(a.id); if (!id || (leftIds.get(id)?.length || 0) !== 1) continue;
    const b = uniqueRight.get(id);
    if (b) {
      matchedRight.add(b.line);
      if (norm(a.status) !== norm(b.status)) issues.push({key:key('status',a.line,b.line),type:'Status conflict',severity:'High',title:`${a.name || a.id}: status differs`,detail:`Source A says “${a.status || 'blank'}”; Source B says “${b.status || 'blank'}”.`,a,b,basis:'Same unique ID; different status'});
      if (norm(a.email) !== norm(b.email)) issues.push({key:key('email',a.line,b.line),type:'Contact conflict',severity:'Medium',title:`${a.name || a.id}: email differs`,detail:'The same ID has different contact information.',a,b,basis:'Same unique ID; different email'});
      continue;
    }
    const candidates = right.filter(r => !matchedRight.has(r.line) && (norm(r.email) && norm(r.email) === norm(a.email) || norm(r.name) && norm(r.name) === norm(a.name)));
    const candidate = candidates.length === 1 ? candidates[0] : null;
    issues.push({key:key('missing-a',a.line,candidate?.line),type:candidate ? 'Possible match' : 'Missing from B',severity:candidate ? 'Review' : 'Medium',title:candidate ? `${a.name}: identifier differs` : `${a.name || a.id}: not found in B`,detail:candidate ? 'Shared name or email suggests a possible match. Confirm identity manually; no records have been merged.' : 'No unique ID or single name/email candidate was found.',a,b:candidate,basis:candidate ? 'Name or email only; unconfirmed' : 'No unique ID match'});
    if (candidate) matchedRight.add(candidate.line);
  }
  for (const b of right) if (!matchedRight.has(b.line) && (rightIds.get(norm(b.id))?.length || 0) === 1) issues.push({key:key('missing-b',null,b.line),type:'Missing from A',severity:'Medium',title:`${b.name || b.id}: not found in A`,detail:'This record is present in Source B without a unique ID match in Source A.',a:null,b,basis:'No unique ID match'});
  return issues;
}
export function report(issues, decisions) { return { product:'SourceCheck', generatedAt:new Date().toISOString(), note:'Local, reviewer-assisted comparison. Possible matches are suggestions, not identity proof. No source record is modified.', count:issues.length, exceptions:issues.map(({key, type, severity, title, detail, basis, a, b}) => ({key,type,severity,title,detail,basis,sourceA:a,sourceB:b,review:decisions[key] || {state:'Open', note:''}})) }; }
