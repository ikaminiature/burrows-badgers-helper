// Existing character notes stay in `notes`. Only that property is synchronized.
export function originalCharacter(data, game, characterId) {
 const bands=game.sourceWarbandId ? data.warbands.filter(w=>w.id===game.sourceWarbandId) : data.warbands;
 const matches=bands.flatMap(w=>w.characters.filter(c=>c.id===characterId).map(c=>({band:w,character:c})));
 return matches.length===1 ? matches[0] : null;
}
export function setCharacterNotes(data, source, bandId, characterId, text) {
 if(typeof text!=='string'||text.length>20000)throw Error('メモは20000文字以内で入力してください');
 const game=data.game;
 const original=source==='battle'&&game ? originalCharacter(data,game,characterId) : null;
 const band=source==='roster'?data.warbands.find(w=>w.id===bandId):original?.band;
 const character=source==='roster'?band?.characters.find(c=>c.id===characterId):game?.characters.find(c=>c.id===characterId);
 if(!character)return false;
 const targets=new Set([character]);
 if(source==='battle'&&original)targets.add(original.character);
 if(source==='roster'&&game){const match=originalCharacter(data,game,characterId);if(match?.band===band){const copy=game.characters.find(c=>c.id===characterId);if(copy)targets.add(copy);}}
 let changed=false;for(const target of targets)if(target.notes!==text){target.notes=text;changed=true;}
 return changed;
}

export function setWarbandNotes(data, bandId, text) {
 if(typeof text!=='string'||text.length>20000)throw Error('メモは20000文字以内で入力してください');
 const w=data.warbands.find(w=>w.id===bandId);
 if(!w||w.status.notes===text)return false;
 w.status.notes=text;
 return true;
}
