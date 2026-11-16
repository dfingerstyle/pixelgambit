const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const box = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function polygon(c, points, color) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.closePath(); c.fill();
}
function bottle(c, x, y, color, scale = 1) {
  box(c, x + 2 * scale, y, 3 * scale, 4 * scale, '#eed599'); box(c, x, y + 4 * scale, 7 * scale, 15 * scale, color);
  box(c, x + scale, y + 5 * scale, scale, 10 * scale, '#ffffff60'); box(c, x + scale, y + 11 * scale, 5 * scale, 4 * scale, '#eddbb0');
}
export function drawCasinoArchitecture(c, camera) {
  box(c, 0, 0, 900, 560, '#130f20'); box(c, 65, 65, 770, 433, '#59142a');
  c.save(); c.beginPath(); c.rect(73, 110, 754, 380); c.clip();
  for (let y = 100; y < 500; y += 30) for (let x = 70; x < 835; x += 30) {
    box(c, x, y, 30, 30, '#721a2c');
    polygon(c, [[x + 15, y + 2], [x + 28, y + 15], [x + 15, y + 28], [x + 2, y + 15]], '#aa542e');
    polygon(c, [[x + 15, y + 4], [x + 25, y + 15], [x + 15, y + 25], [x + 5, y + 15]], '#641c2b');
    box(c, x + 13, y + 13, 4, 4, '#ca8040'); box(c, x, y, 2, 30, '#3b1024');
  }
  box(c, 330, 300, 170, 190, '#661528'); box(c, 335, 302, 2, 185, '#c18a4a'); box(c, 493, 302, 2, 185, '#c18a4a');
  for (let y = 320; y < 490; y += 36) {
    polygon(c, [[415,y],[426,y+12],[415,y+24],[404,y+12]], '#ae613a'); box(c, 413, y + 9, 4, 5, '#e3b770');
  }
  c.restore();
  const wallH = camera === 'side' ? 205 : 45;
  box(c, 65, 65, 770, wallH, '#281c2d');
  for (let x = 78; x < 817; x += 42) { box(c, x, 70, 32, wallH - 12, '#4c2734'); box(c, x + 3, 73, 26, wallH - 18, '#321e30'); box(c, x, 70, 32, 2, '#a77948'); }
  box(c, 65, 65, 770, 4, '#e4c07e'); box(c, 65, 65 + wallH - 5, 770, 5, '#b3894d');
  for (const x of [68, 817]) { box(c, x, 65, 14, 433, '#362136'); box(c, x + 3, 69, 3, 425, '#bca16b'); box(c, x + 10, 110, 2, 360, '#61d5d4'); }
  const shelfY = camera === 'side' ? 145 : 115;
  box(c, 180, shelfY - 17, 540, 52, '#150f1d');
  for (let x = 185; x < 720; x += 44) { box(c, x, shelfY - 14, 40, 44, '#47282b'); box(c, x + 3, shelfY - 11, 34, 36, '#211522'); }
  for (let i = 0; i < 31; i++) bottle(c, 188 + i * 17, shelfY - 8, ['#7a935e', '#955775', '#50949e', '#b2834c'][i % 4]);
  box(c, 180, shelfY + 26, 540, 5, '#d1a15e'); box(c, 180, shelfY - 17, 540, 3, '#d1a15e');
  for (const x of [190, 630]) {
    box(c, x, shelfY + 32, 78, 37, '#182734'); box(c, x + 3, shelfY + 35, 72, 30, '#5b8790');
    for (let i = 0; i < 4; i++) { bottle(c, x + 8 + i * 17, shelfY + 39, '#b1d5d2', .8); box(c, x + 5 + i * 17, shelfY + 35, 1, 30, '#e4f2e53a'); }
    box(c, x + 37, shelfY + 35, 3, 30, '#dab76d'); box(c, x + 3, shelfY + 48, 72, 2, '#c1e6df');
  }
  for (const x of [115, 778]) {
    box(c, x, 120, 10, 85, '#2a1830'); box(c, x - 7, 113, 24, 8, '#e4c180'); box(c, x - 3, 127, 16, 24, '#f9d691'); box(c, x + 2, 130, 6, 17, '#fff3bd'); box(c, x - 6, 204, 22, 5, '#c49a5d');
  }
  box(c, 394, 76, 112, 25, '#130f21'); box(c, 394, 76, 112, 2, '#c79f69');
  c.fillStyle = '#f7d390'; c.font = 'bold 13px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.fillText('NEON GAMBIT', 450, 94);
  box(c, 414, 480, 72, 18, '#402434'); box(c, 419, 483, 62, 3, '#d6b879');
}
function wheel(c, x, y, radius, squash) {
  box(c, x - radius - 3, y + radius * squash, radius * 2 + 6, 8, '#382224');
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
    polygon(c, [[x,y],[x+Math.cos(a)*(radius+3),y+Math.sin(a)*(radius+3)*squash],[x+Math.cos(b)*(radius+3),y+Math.sin(b)*(radius+3)*squash]], '#d1b16d');
    polygon(c, [[x,y],[x+Math.cos(a)*radius,y+Math.sin(a)*radius*squash],[x+Math.cos(b)*radius,y+Math.sin(b)*radius*squash]], i === 0 ? '#3f8c67' : i % 2 ? '#b64d55' : '#252634');
  }
  box(c, x - 7, y - 5, 14, 10, '#d3a855'); box(c, x - 3, y - 8, 6, 14, '#f6deb3'); box(c, x + radius * .5, y - radius * .3, 3, 3, '#fff5d4');
}
export function drawCasinoFixture(c, o, camera, project, time) {
  const p = project(o.x, o.y), x = p.x, y = p.y, w = o.w;
  const h = camera === 'side' ? Math.max(24, o.h * .35) : o.h * (camera === 'three' ? .78 : 1);
  const top = y - (camera === 'top' ? 0 : 20);
  if (o.kind === 'bar') {
    polygon(c, [[x+9,top+12],[x+w-9,top+12],[x+w+7,top+h+17],[x-7,top+h+17]], '#0006');
    polygon(c, [[x+12,top],[x+w-12,top],[x+w,top+12],[x+w,top+h-8],[x+w-12,top+h+10],[x+12,top+h+10],[x,top+h-8],[x,top+12]], '#8a5f36');
    for (let i = 14; i < w - 14; i += 33) { box(c, x + i, top + h - 2, 29, 13, '#3a2026'); box(c, x + i + 3, top + h + 1, 23, 2, '#bd8b4d'); }
    polygon(c, [[x+12,top],[x+w-12,top],[x+w-3,top+10],[x+w-3,top+h-12],[x+w-14,top+h],[x+14,top+h],[x+3,top+h-12],[x+3,top+10]], '#f0cd7e');
    box(c, x + 17, top + 8, w - 34, h - 19, '#871e39'); box(c, x + 19, top + 9, w - 38, 3, '#ad3b4c'); box(c, x + 15, top + h - 8, w - 30, 3, '#fff0bc');
    for (let i = 0; i < 6; i++) { const xx=x+48+i*(w-96)/5; box(c, xx, top+h-19, 13, 9, '#d8ebe6'); box(c, xx+2, top+h-17, 9, 4, i%2 ? '#e790c5' : '#73d4c4'); }
    return;
  }
  if (o.kind === 'casino-stool') {
    box(c, x + 8, top + h - 4, w - 10, 7, '#0005'); box(c, x + w/2 - 3, top + 6, 6, h - 3, '#b78b4d'); box(c, x + 4, top + h - 2, w - 8, 4, '#e0c079');
    polygon(c, [[x+4,top],[x+w-4,top],[x+w,top+5],[x+w-4,top+13],[x+4,top+13],[x,top+5]], '#c9995d'); box(c, x+4,top+3,w-8,7,'#833344'); box(c,x+6,top+3,w-12,2,'#d0807b'); return;
  }
  if (o.game === 'slots') {
    const lift = camera === 'top' ? 18 : 58, yy = y - lift;
    box(c,x+7,yy+8,w+3,h+lift,'#0005'); polygon(c,[[x+w-6,yy],[x+w+7,yy+8],[x+w+7,yy+h+lift],[x+w-6,yy+h+lift-4]],'#393045');
    box(c,x,yy,w,h+lift,'#171b2c'); box(c,x+3,yy+3,w-6,13,'#d6b86d'); box(c,x+6,yy+6,w-12,7,'#804893');
    box(c,x+4,yy+19,w-8,34,'#56bfbb'); box(c,x+7,yy+22,w-14,28,'#171d35');
    for(let i=0;i<3;i++) { box(c,x+9+i*(w-18)/3,yy+25,(w-22)/3,20,'#e6e7c8'); for(let j=0;j<2;j++) box(c,x+12+i*(w-18)/3,yy+29+j*9,5,5,['#cf5e94','#dbac4f','#4b9693'][(i+j)%3]); }
    box(c,x+5,yy+55,w-10,11,'#796786'); box(c,x+9,yy+57,10,4,'#f2bf59'); box(c,x+w-19,yy+57,8,4,'#df7b9f'); box(c,x+7,yy+69,w-14,Math.max(10,h+lift-74),'#252438');
    const lit=reduced || Math.floor(time/450)%2===0; box(c,x+2,yy+18,2,48,lit?'#77e8da':'#428b8b'); box(c,x+w-4,yy+18,2,48,lit?'#ec8acf':'#844d7a');
    box(c,x+w/2-9,yy+h+lift-6,18,3,'#b3aaa3'); return;
  }
  box(c,x+5,top+8,w,h+7,'#0006'); box(c,x,top+6,w,h+7,'#3d2629');
  for(let i=7;i<w;i+=9) box(c,x+i,top+h-2,2,15,'#83603b');
  polygon(c,[[x+8,top],[x+w-8,top],[x+w,top+8],[x+w,top+h-8],[x+w-8,top+h],[x+8,top+h],[x,top+h-8],[x,top+8]],'#d3b576');
  box(c,x+5,top+5,w-10,h-10,'#237666'); box(c,x+7,top+7,w-14,2,'#6cb299');
  if(o.game==='roulette') {
    wheel(c,x+36,top+h/2,25,camera==='side'?.45:.85);
    const gx=x+77, gy=top+12, gw=(w-92)/12, gh=(h-29)/3;
    for(let row=0;row<3;row++) for(let col=0;col<12;col++) { box(c,gx+col*gw,gy+row*gh,gw-1,gh-1,(row+col)%2?'#b75b60':'#1c3434'); c.fillStyle='#e4efca'; c.font='5px monospace'; c.textAlign='center'; c.fillText(String(col*3+row+1),gx+col*gw+gw/2,gy+row*gh+gh*.75); }
    box(c,gx,top+h-15,w-92,5,'#acccab');
  } else if(o.game==='coinflip') {
    polygon(c, [[x+w/2-10,top+h/2-14],[x+w/2+10,top+h/2-14],[x+w/2+16,top+h/2-7],[x+w/2+16,top+h/2+7],[x+w/2+10,top+h/2+14],[x+w/2-10,top+h/2+14],[x+w/2-16,top+h/2+7],[x+w/2-16,top+h/2-7]], '#b47b3d');
    box(c,x+w/2-10,top+h/2-10,20,20,'#f4cf76'); box(c,x+w/2-6,top+h/2-7,12,14,'#d8a451'); box(c,x+w/2-3,top+h/2-5,6,10,'#fff1b9');
    for(const xx of [x+14,x+w-21]) { box(c,xx,top+h/2-4,8,8,'#e69fb5'); box(c,xx+2,top+h/2-3,4,2,'#fff4d8'); }
  } else if(o.game==='dice') {
    for(let i=0;i<2;i++) { const xx=x+22+i*32, yy=top+17; box(c,xx+3,yy+3,23,23,'#15463f'); box(c,xx,yy,23,23,'#e9d7b0'); box(c,xx+2,yy+2,19,3,'#fff4d3'); for(const [dx,dy] of (i ? [[5,5],[15,5],[5,15],[15,15]] : [[5,5],[10,10],[15,15]])) box(c,xx+dx,yy+dy,3,3,'#612939'); }
  } else {
    for(let i=0;i<3;i++) { const xx=x+16+i*22; box(c,xx+2,top+17,17,22,'#0003'); box(c,xx,top+14,17,22,'#f2e3c3'); box(c,xx+5,top+20,6,6,'#a44756'); }
    for(let i=0;i<3;i++) { box(c,x+w-20,top+h-18-i*3,10,4,'#c68d61'); box(c,x+w-17,top+h-18-i*3,3,1,'#ffdfaa'); }
  }
}
