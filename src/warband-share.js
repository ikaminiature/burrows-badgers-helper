import qrcode from "./qrcode.js";

// A share link carries only public-facing lore and tiny portraits. No server upload.
const MAX_QR_URL = 2200;
const MAX_UNCOMPRESSED = 250000;
const validText = (s, limit) => typeof s === "string" && s.length <= limit;
const validPhoto = (s) => typeof s === "string" && (s === "" || /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]{1,5000}$/.test(s));
const base64url = (bytes) => btoa(Array.from(bytes, x=>String.fromCharCode(x)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const fromBase64url = (text) => Uint8Array.from(atob(text.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
async function bytesCompressed(text) {
  if(!("CompressionStream" in window)) return {prefix:"j",bytes:new TextEncoder().encode(text)};
  const stream=new Blob([text]).stream().pipeThrough(new CompressionStream("deflate"));
  return {prefix:"z",bytes:new Uint8Array(await new Response(stream).arrayBuffer())};
}
async function unpack(token) {
  if(typeof token!=="string" || token.length>15000 || !/^[zj][A-Za-z0-9_-]+$/.test(token))throw Error("共有リンクの形式が違います");
  const bytes=fromBase64url(token.slice(1));
  if(bytes.byteLength>MAX_UNCOMPRESSED)throw Error("共有データが大きすぎます");
  const stream=token[0]==="z"?new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")):new Blob([bytes]).stream();
  const text=await new Response(stream).text();
  if(text.length>MAX_UNCOMPRESSED)throw Error("共有データが大きすぎます");
  return JSON.parse(text);
}
async function tinyPortrait(source,size) {
  if(!source)return "";
  const img=new Image();
  img.src=source;
  await img.decode();
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,size,size);
  const ratio=Math.max(size/img.naturalWidth,size/img.naturalHeight);
  const width=img.naturalWidth*ratio,height=img.naturalHeight*ratio;
  ctx.drawImage(img,(size-width)/2,(size-height)/2,width,height);
  return canvas.toDataURL("image/webp",0.38);
}
function parsePacket(packet) {
  if(!packet || packet.v!==1 || !validText(packet.id,100) || !packet.id ||
     !validText(packet.n,200) || !packet.n.trim() || !validText(packet.l,20000) ||
     !Array.isArray(packet.c) || packet.c.length>100 ||
     !packet.c.every(c=>c && validText(c.n,200) && c.n.trim() && validText(c.l,20000) && validPhoto(c.p))) {
    throw Error("共有データが不正です");
  }
  return {sourceId:packet.id,name:packet.n,lore:packet.l,members:packet.c.map(c=>({name:c.n,lore:c.l,photo:c.p}))};
}
export async function makeShareUrl(w) {
  const origin=new URL("./",location.href).href.split("#")[0];
  for(const size of [32,24,16,12]) {
    const members=await Promise.all(w.characters.map(async c=>({n:c.name,l:c.lore||"",p:await tinyPortrait(c.photo,size)})));
    const packet={v:1,id:w.id,n:w.name,l:w.status.lore||"",c:members};
    const {prefix,bytes}=await bytesCompressed(JSON.stringify(packet));
    const url=origin+"#share="+prefix+base64url(bytes);
    if(url.length<=MAX_QR_URL) return {url,preview:parsePacket(packet),photoSize:size};
  }
  throw Error("ロアや写真の情報量がQRコード1枚の容量を超えています。共有JSONで送ってください。");
}
export async function readShareToken(token) {
  return parsePacket(await unpack(token));
}
export function makeShareSvg(url) {
  if(url.length>MAX_QR_URL)throw Error("QRコードが大きすぎます");
  const qr=qrcode(0,"L");
  qr.addData(url,"Byte");
  qr.make();
  return qr.createSvgTag({cellSize:2,margin:8,scalable:true});
}
export function exportShareJson(w) {
  return JSON.stringify({v:1,id:w.id,n:w.name,l:w.status.lore||"",c:w.characters.map(c=>({n:c.name,l:c.lore||"",p:c.photo||""}))},null,2);
}
export function readShareJson(text) {
  const raw=JSON.parse(text);
  // JSON export can contain original-resolution photos, unlike QR links.
  if(raw && Array.isArray(raw.c)) {
    for(const c of raw.c)if(typeof c.p==="string" && c.p.length>5000 && c.p.length<=2000000 && /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(c.p)){
      // The regular backup validator already accepts this format.
      continue;
    }
  }
  if(!raw || raw.v!==1 || typeof raw.id!=="string" || !raw.id || !validText(raw.n,200) || !raw.n.trim() || !validText(raw.l,20000) ||
     !Array.isArray(raw.c) || raw.c.length>100 ||
     !raw.c.every(c=>c && validText(c.n,200)&&c.n.trim()&&validText(c.l,20000)&&
       typeof c.p==="string" && (c.p==="" || (c.p.length<=2000000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.p))))) throw Error("共有JSONが不正です");
  return {sourceId:raw.id,name:raw.n,lore:raw.l,members:raw.c.map(c=>({name:c.n,lore:c.l,photo:c.p}))};
}
