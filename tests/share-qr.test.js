import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';import jsQR from 'jsqr';
test('静的QR画像を実際にデコードし公開URLと白い余白を確認',()=>{
 const png=PNG.sync.read(readFileSync('share-qr.png')),decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.equal(decoded?.data,'https://ikaminiature.github.io/burrows-badgers-helper/');assert.equal(png.width,png.height);
 // Generator uses 8px modules and a 4-module white quiet zone on every side.
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  const i=(y*png.width+x)*4,[r,g,b,a]=png.data.subarray(i,i+4);assert.equal(a,255);assert.ok((r===0||r===255)&&g===r&&b===r);
  if(x<32||y<32||x>=png.width-32||y>=png.height-32)assert.equal(r,255);
 }
});
