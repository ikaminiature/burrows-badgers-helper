// Synchronize only the edited memo field; leave the rest of the battle snapshot intact.
export function originalCharacter(data, game, characterId) {
 const bands=game.sourceWarbandId ? data.warbands.filter(w=>w.id===game.sourceWarbandId) : data.warbands;
 const matches=bands.flatMap(w=>w.characters.filter(c=>c.id===characterId).map(c=>({band:w,character:c})));
 return matches.length===1 ? matches[0] : null;
}
export function setCharacterNotes(data, source, bandId, characterId, text) {
 return setCharacterMemo(data, source, bandId, characterId, 'notes', text);
}
export function setCharacterNotes2(data, source, bandId, characterId, text) {
 return setCharacterMemo(data, source, bandId, characterId, 'notes2', text);
}
function setCharacterMemo(data, source, bandId, characterId, field, text) {
 if(typeof text!=='string'||text.length>20000)throw Error('メモは20000文字以内で入力してください');
 const game=data.game;
 const original=source==='battle'&&game ? originalCharacter(data,game,characterId) : null;
 const band=source==='roster'?data.warbands.find(w=>w.id===bandId):original?.band;
 const character=source==='roster'?band?.characters.find(c=>c.id===characterId):game?.characters.find(c=>c.id===characterId);
 if(!character)return false;
 const targets=new Set([character]);
 if(source==='battle'&&original)targets.add(original.character);
 if(source==='roster'&&game){const match=originalCharacter(data,game,characterId);if(match?.band===band){const copy=game.characters.find(c=>c.id===characterId);if(copy)targets.add(copy);}}
 let changed=false;for(const target of targets)if((target[field]??'')!==text){target[field]=text;changed=true;}
 return changed;
}

export function setWarbandNotes(data, bandId, text) {
 if(typeof text!=='string'||text.length>20000)throw Error('メモは20000文字以内で入力してください');
 const w=data.warbands.find(w=>w.id===bandId);
 if(!w||w.status.notes===text)return false;
 w.status.notes=text;
 return true;
}

// B&B 第2版 p.157「重傷表」。日本語名と出目は表の記載に合わせる。
export const majorInjuries = [
 ['1','dead','死亡'],
 ['2','multiple-injuries','複数の負傷'],
 ['3','upper-leg-trauma','大腿部外傷'],
 ['4','brain-trauma','脳外傷'],
 ['5','nerve-damage','神経障害'],
 ['6','chest-wound','胸部負傷'],
 ['7','one-eye','片目失明'],
 ['8','psychological-trauma','心的外傷'],
 ['9','enfeebled','衰弱'],
 ['10','shoulder-injury','肩の負傷'],
 ['11','horrific-appearance','醜悪な容貌'],
 ['12','ear-nose-injury','耳鼻損傷'],
 ['13','severe-arm-injury','重度の腕の負傷'],
 ['14','lower-leg-trauma','下腿部外傷'],
 ['15','head-injury','頭部負傷'],
 ['16','recurring-injury','ぶり返す負傷'],
 ['17','persistent-injury','しつこい傷'],
 ['18','deep-lacerations','深い裂傷'],
 ['19–20','not-as-bad','見た目ほどひどくはない'],
].map(([roll,id,label])=>({roll,id,label}));
