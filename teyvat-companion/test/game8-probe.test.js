import test from 'node:test';
test('temporary Game8 text-reader proxy probe (remove after source audit)', async () => {
 const urls = [
  'https://r.jina.ai/https://game8.co/games/Genshin-Impact/archives/345514',
  'https://game8-co.translate.goog/games/Genshin-Impact/archives/345514?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
  'https://game8.co/games/Genshin-Impact/archives/345514?output=amp',
 ];
 for(const url of urls){
  try{
   const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
   const text=await r.text();
   console.log('GAME8_PROXY_RESULT '+JSON.stringify({url,status:r.status,finalUrl:r.url,chars:text.length,excerpt:text.slice(0,6000)}));
  }catch(e){console.log('GAME8_PROXY_ERROR '+JSON.stringify({url,error:String(e)}))}
 }
});
