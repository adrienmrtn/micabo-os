var le=/(?<![\p{L}\p{N}_])micabo(?![\p{L}\p{N}_])/iu;function A(e){return!!e&&le.test(e)}function J(e){let t=[...new Set(e)].sort((r,p)=>r-p);if(t.length<2)return[];let n=t[0],o=t.slice(Math.floor(t.length/2)),i=t.filter(r=>r!==n).slice(-3),s=new Set([...o,...i]);return t.filter(r=>r!==n&&s.has(r))}function V(e){let t=e.filter(n=>A(n.texte_overlay)).map(n=>n.position);return t.length>0?Math.max(...t):null}var D=[{nom:"Wilgo",motif:"\\mwilgo\\M"},{nom:"Astra AI",motif:"\\mastra(\\s?ai)?\\M"},{nom:"Knowunity",motif:"\\mknowunity\\M"},{nom:"Quizlet",motif:"\\mquizlet\\M"},{nom:"Anki",motif:"\\manki\\M"},{nom:"StudySmarter",motif:"\\mstudy\\s?smarter\\M"},{nom:"Studocu",motif:"\\mstudocu\\M"},{nom:"Brainly",motif:"\\mbrainly\\M"},{nom:"Gauth",motif:"\\mgauth(math)?\\M"},{nom:"Photomath",motif:"\\mphotomath\\M"},{nom:"Turbo AI",motif:"\\mturbo\\s?ai\\M"},{nom:"StudyFetch",motif:"\\mstudy\\s?fetch\\M"},{nom:"Revisely",motif:"\\mrevisely\\M"},{nom:"Mindgrasp",motif:"\\mmindgrasp\\M"},{nom:"PeECH",motif:"\\mpeech\\M",versMicabo:!1}],ue="(?<![\\p{L}\\p{N}_])",ce="(?![\\p{L}\\p{N}_])";function pe(e){return new RegExp(e.replace(/\\m/g,ue).replace(/\\M/g,ce),"iu")}function z(e,t){return e?t.filter(n=>pe(n.motif).test(e)).map(n=>n.nom):[]}function j(e,t){return e.filter(n=>n.texte_overlay&&n.concurrent_laisse!==n.texte_overlay).map(n=>({position:n.position,cites:z(n.texte_overlay,t)})).filter(n=>n.cites.length>0)}var K=e=>e.split(`
`).length;function me(e,t,n){return!t||!t.trim()||z(t,n).length>0||/[—–]/.test(t)||K(t)>K(e)+1?!1:t.length<=e.length*1.5+30}function H(e,t){let n=new Map(D.map(i=>[i.nom,i.versMicabo!==!1])),o=t?new Set(t.map(i=>i.nom)):null;return e.map(i=>({nom:i.nom,motif:i.motif,versMicabo:o?!o.has(i.nom):n.get(i.nom)??!0}))}function F(e){return e.filter(t=>t.versMicabo===!1).map(t=>t.nom)}function X(e,t,n,o,i=s=>s){let s=new Set(t.map(l=>l.position)),r=new Map(n.filter(l=>s.has(l.position)).map(l=>[l.position,l])),p=new Map(e.map(l=>[l.position,l.texte_overlay])),m=new Set(F(o)),a=new Map(t.map(l=>[l.position,l.cites])),u=new Map;for(let l of r.values()){let c=p.get(l.position);if(l.decision!=="remplacer"||!c)continue;let h=l.texte==null?null:i(l.texte);h==null||!me(c,h,o)||(a.get(l.position)??[]).some(v=>m.has(v))&&A(h)&&!A(c)||u.set(l.position,h)}let f=e.some(l=>!s.has(l.position)&&A(l.texte_overlay)),d=[...u].filter(([,l])=>A(l)).map(([l])=>l),x=f||d.length===0?null:Math.max(...d),b=[],y=[],w=[],$=e.map(l=>{let c=r.get(l.position);if(!c||!l.texte_overlay)return l;if(c.decision==="laisser")return y.push(l.position),{...l,concurrent_laisse:l.texte_overlay};let h=u.get(l.position);return h==null||A(h)&&l.position!==x?(w.push(l.position),l):(b.push(l.position),{...l,texte_overlay:h,concurrent_laisse:null})});for(let l of s)r.has(l)||w.push(l);return{slides:$,remplacees:b,laissees:y,refusees:w}}function de(e,t){if(!(!Array.isArray(t)||t.length<=400))throw new Error(`in("${e}", \u2026) re\xE7oit ${t.length} valeurs (max ${400}) : l'URL PostgREST d\xE9borderait et la requ\xEAte \xE9chouerait en 400. Passe par lireParLots() de _shared/lots.ts.`)}function G(e){return new Proxy(e,{get(t,n,o){let i=Reflect.get(t,n,o);return typeof i!="function"?i:n==="then"||n==="catch"||n==="finally"?i.bind(t):(...s)=>{n==="in"&&de(String(s[0]),s[1]);let r=i.apply(t,s);return r&&typeof r=="object"&&r!==t?G(r):r}}})}function B(){let e=Deno.env.get("SUPABASE_URL"),t=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!e||!t)throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");let n=Q(e,t,{auth:{persistSession:!1,autoRefreshToken:!1}});return new Proxy(n,{get(o,i,s){let r=Reflect.get(o,i,s);return i!=="from"||typeof r!="function"?r:(...p)=>G(r.apply(o,p))}})}async function Z(e){if(e.method==="OPTIONS")return new Response(null,{status:204,headers:W});let t=Deno.env.get("CRON_SECRET");if(!t)return S({error:"CRON_SECRET non configur\xE9"},500);if(e.headers.get("x-cron-secret")===t)return null;let n=Deno.env.get("TEST_SECRET");if(n&&e.headers.get("x-cron-secret")===n)return null;let i=(e.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");if(!i)return S({error:"unauthorized"},401);let s=await fe(i);return s?s.roles.includes("admin")?null:S({error:"forbidden"},403):S({error:"unauthorized"},401)}function ge(e){try{let t=e.split(".")[1];return JSON.parse(atob(t.replace(/-/g,"+").replace(/_/g,"/"))).sub??null}catch{return null}}async function fe(e){let t=ge(e);if(!t)return null;let n=Deno.env.get("SUPABASE_URL"),o=Deno.env.get("SUPABASE_ANON_KEY");if(!n||!o)return null;let i=Q(n,o,{global:{headers:{Authorization:`Bearer ${e}`}},auth:{persistSession:!1,autoRefreshToken:!1}}),{data:s,error:r}=await i.from("user_roles").select("role").eq("user_id",t);return r?null:{userId:t,roles:(s??[]).map(p=>p.role)}}async function N(e,t){let{data:n}=await e.from("prompts").select("contenu").eq("cle",t).maybeSingle();return n?.contenu?.trim()||void 0}function O(e){if(e instanceof Error)return e.message;if(e&&typeof e=="object"){let t=e,n=[t.message,t.details,t.hint,t.code].filter(Boolean);if(n.length>0)return n.join(" \xB7 ");try{return JSON.stringify(e).slice(0,400)}catch{}}return String(e)}var W={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type, accept, x-cron-secret","access-control-allow-methods":"POST, OPTIONS"};function S(e,t=200){return new Response(JSON.stringify(e),{status:t,headers:{"content-type":"application/json",...W}})}var Xe=(()=>{let e=new Uint32Array(256);for(let t=0;t<256;t+=1){let n=t;for(let o=0;o<8;o+=1)n=n&1?3988292384^n>>>1:n>>>1;e[t]=n>>>0}return e})();function L(){return Deno.env.get("FAL_KEY")??Deno.env.get("FAL_API_KEY")??null}function M(e){return{Authorization:`Key ${e}`,"Content-Type":"application/json"}}async function ee(e,t,n){let o=L();if(!o)throw new Error("FAL_KEY manquant");let i=`https://queue.fal.run/${e}`;await n?.({phase:"submit",detail:`mod\xE8le=${e}`});let s=await fetch(i,{method:"POST",headers:M(o),body:JSON.stringify(t)});if(!s.ok)throw new Error(`Fal ${e} submit ${s.status}: ${(await s.text()).slice(0,400)}`);return await s.json()}async function te(e,t,n,o=6e5){let i=L();if(!i)throw new Error("FAL_KEY manquant");let s=`https://queue.fal.run/${e}`,r=t.request_id,p=t.status_url??(r?`${s}/requests/${r}/status`:null),m=t.response_url??(r?`${s}/requests/${r}`:null);if(!p||!m)throw new Error(`Fal ${e}: queue invalide ${JSON.stringify(t).slice(0,200)}`);let a=Date.now(),u=t.status,f=0;for(;Date.now()-a<o;){f+=1;let b=await fetch(`${p}?logs=0`,{headers:M(i)});if(!b.ok)throw new Error(`Fal ${e} status ${b.status}: ${(await b.text()).slice(0,250)}`);let y=await b.json();if(u=y.status,await n?.({phase:"poll",requestId:r,polls:f,statut:u,detail:`poll #${f} \u2192 ${u}`}),u==="COMPLETED")break;if(u==="FAILED"||u==="CANCELLED")throw new Error(`Fal ${e} ${u}: ${JSON.stringify(y.error??y).slice(0,300)}`);await new Promise(w=>setTimeout(w,2500))}if(u!=="COMPLETED")throw new Error(`Fal ${e}: timeout (${Math.round(o/1e3)}s), dernier=${u}, polls=${f}`);await n?.({phase:"result",requestId:r,polls:f,statut:u});let d=await fetch(m,{headers:M(i)}),x=await d.text();if(!d.ok)throw new Error(`Fal ${e} result ${d.status}: ${x.slice(0,300)}`);try{return JSON.parse(x)}catch{throw new Error(`Fal ${e}: JSON invalide ${x.slice(0,200)}`)}}var he="openrouter/router",we="openrouter/router/vision";function be(e){let t=e.trim();return t?t.includes("/")?t:`google/${t}`:"google/gemini-2.5-flash"}function ne(e){if(typeof e=="string")return e.trim();if(!e||typeof e!="object")return"";let t=e;if(typeof t.output=="string")return t.output.trim();if(typeof t.text=="string")return t.text.trim();if(typeof t.error=="string"&&t.error)throw new Error(`Fal LLM: ${t.error}`);let n=t.data;if(n&&typeof n=="object"){let o=n;if(typeof o.output=="string")return o.output.trim();if(typeof o.text=="string")return o.text.trim()}return""}async function re(e){let t=L();if(!t)throw new Error("FAL_KEY manquant");let n=(e.imageUrls??[]).filter(Boolean),o=n.length?we:he,i={prompt:e.prompt,model:be(e.model),reasoning:!1};typeof e.temperature=="number"&&(i.temperature=e.temperature),n.length&&(i.image_urls=n);let s=await fetch(`https://fal.run/${o}`,{method:"POST",headers:M(t),body:JSON.stringify(i)}),r=await s.text();if(s.ok)try{let u=ne(JSON.parse(r));if(u)return u}catch{if(r.trim())return r.trim()}if(s.status===404||s.status===422)throw new Error(`Fal LLM MODEL_REJECTED:${s.status}:${r.slice(0,180)}`);let p=await ee(o,i),m=await te(o,p,void 0,18e4),a=ne(m);if(!a)throw new Error(`Fal LLM vide: ${JSON.stringify(m).slice(0,200)}`);return a}var xe="fal-ai/image-editing/text-removal",We=`https://queue.fal.run/${xe}`;var ye="flux-kontext-apps/text-removal",tt=`https://api.replicate.com/v1/models/${ye}/predictions`;var Ee="fal-ai/seedvr/upscale/image",rt=`https://queue.fal.run/${Ee}`,it=12*1024*1024;var P=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash"];function Se(e){let t=[];for(let n of e){let o=n.inlineData?.data??n.inline_data?.data;if(!o)continue;let i=n.inlineData?.mimeType??n.inline_data?.mime_type??"image/jpeg";t.push(`data:${i};base64,${o}`)}return t}async function ve(e,t,n){let o=U(t),i=Se(t);return[{text:await re({prompt:o||" ",model:e,temperature:n?.temperature,imageUrls:i.length?i:void 0})}]}function U(e){return e.map(t=>t.text??"").join("").trim()}function Ae(e){return/overload|unavailable|rate.?limit|resource.?exhaust|deadline|timeout|try again|429|500|502|503|504/i.test(e)}async function R(e,t){return(await Te(e,t)).parts}async function Te(e,t){let o=[];for(let i=0;i<4;i+=1){i>0&&await new Promise(s=>setTimeout(s,1500*i+Math.floor(Math.random()*1200))),o=[];for(let s of e)try{return{parts:await ve(s,t),model:s}}catch(r){o.push(`${s}: ${O(r)}`)}if(!o.some(Ae))break}throw new Error(o.join(" | "))}var $e=`R\xE8gles de traduction imp\xE9ratives :
- Adresse-toi au lecteur de fa\xE7on directe et famili\xE8re, jamais avec la forme de
  politesse formelle de la langue cible.
- \xC9cris comme un humain parle, pas comme un site de marketing.
- Phrases courtes. On lit au pouce, en une seconde.
- INTERDIT : le tiret long (\u2014) et le tiret demi-cadratin (\u2013). Utilise une
  virgule, un point ou deux-points. Ces tirets trahissent un texte d'IA.
- INTERDIT : le vocabulaire creux de la publicit\xE9 (\xE9quivalents locaux de
  "lib\xE8re ton potentiel", "r\xE9volutionne", "incontournable", "booste",
  "transforme ta vie").
- Pas de point d'exclamation en rafale, pas d'emoji ajout\xE9.
- Voix coh\xE9rente d'une slide \xE0 l'autre, genre fix\xE9 une fois pour toutes.
- Aucune mention d'un produit tiers : ni application, ni site, ni logiciel, ni
  "outil d'IA", ni marque. R\xE9\xE9cris le conseil comme une action pure. Le seul
  produit qui a le droit d'exister dans ce slideshow est l'appli Sophia, et ce
  n'est pas ton r\xF4le de l'ajouter ici.
- Conserve les URLs et les sources cit\xE9es telles quelles.`;var _={fr:"fran\xE7ais",en:"anglais",es:"espagnol",it:"italien",de:"allemand",pt:"portugais",cs:"tch\xE8que",nl:"n\xE9erlandais",el:"grec",hu:"hongrois",pl:"polonais",ro:"roumain",sv:"su\xE9dois",tr:"turc"};function Ue(e){return e.split(/\s+/).map(n=>n.trim()).filter(Boolean).map(n=>n.startsWith("#")?n:`#${n}`).map(n=>n.replace(/[^\p{L}\p{N}_#]/gu,"")).filter(n=>n.length>1).slice(0,3).join(" ")}var Ce={fr:"\xAB l'appli micabo \xBB (\xAB la m\xE9thode X \xBB \u2192 \xAB l'appli micabo \xBB, \xAB avec X \xBB \u2192 \xAB avec l'appli micabo \xBB)",en:"\xAB the micabo app \xBB",es:"\xAB la app micabo \xBB (\xAB con X \xBB \u2192 \xAB con la app micabo \xBB, \xAB el m\xE9todo X \xBB \u2192 \xAB la app micabo \xBB)",de:"\xAB die micabo-App \xBB, nom D'ABORD, avec l'article que la phrase impose (\xAB mit der micabo-App \xBB, \xAB nutzen die micabo-App \xBB pour \xAB die X-Methode \xBB)",tr:"\xAB micabo uygulamas\u0131 \xBB, le suffixe de cas sur \xAB uygulamas\u0131 \xBB : X'dan \u2192 micabo uygulamas\u0131ndan, X'da \u2192 micabo uygulamas\u0131nda, X'yu / X'yi \u2192 micabo uygulamas\u0131n\u0131, X'ya \u2192 micabo uygulamas\u0131na ; jamais \xAB micabo'yu \xBB, jamais \xAB sitesi \xBB"};async function ie(e){if(e.aJuger.length===0)return[];let t=e.langue,n=_[t]??t,o=e.slides.map(r=>`Slide ${r.position} : ${JSON.stringify(r.texte)}`).join(`
`),i=e.aJuger.map(r=>`- slide ${r.position} (cite : ${r.cites.join(", ")})`).join(`
`),s=`LANGUE DU TEXTE : ${n.toUpperCase()}. Ne traduis rien.

micabo est une appli mobile de r\xE9vision. Ce slideshow TikTok a \xE9t\xE9 import\xE9 d'un
autre compte, parfois celui d'un concurrent : certaines slides font encore sa
publicit\xE9. Pour chaque slide list\xE9e plus bas, d\xE9cide :

- "laisser" : le concurrent est un \xE9l\xE9ment d'un classement, d'un comparatif ou
  d'un test d'applis ou de m\xE9thodes (\xAB j'ai utilis\xE9 quizlet \xBB, \xAB Anki 6/10 \u2026 \xBB),
  not\xE9 ou critiqu\xE9, pas une consigne \xE0 suivre. Dans le doute : "laisser".
- "remplacer" : le concurrent est recommand\xE9, prescrit, ou pr\xE9sent\xE9 comme ce que
  font ceux qui r\xE9ussissent (\xAB utilise X \xBB, \xAB la m\xE9thode X \xBB, \xAB fais des quiz
  avec X \xBB, \xAB j'utilise X \xBB hors comparatif), ou c'est un reste de fiche produit.

Pour "remplacer", \xE9cris le texte COMPLET de la slide o\xF9 seul le nom du
concurrent, avec le mot qui le porte (\xAB app \xBB, \xAB m\xE9thode \xBB, l'article), devient
${Ce[t]??"\xAB l'appli micabo \xBB, traduit dans la langue du texte"}.
Tout le reste MOT POUR MOT : m\xEAmes retours \xE0 la ligne, m\xEAme ponctuation, m\xEAmes
emojis, m\xEAme num\xE9rotation. micabo toujours en minuscules, m\xEAme dans une ligne
en capitales. Si la slide contient d\xE9j\xE0 \xAB micabo \xBB, ne le double pas : retire
le fragment du concurrent. Un reste de fiche produit se retire. Aucun tiret
long (\u2014, \u2013), jamais \xAB micabo.app \xBB, ni \xAB site \xBB, ni \xAB plateforme \xBB.

UNE SEULE slide du slideshow peut nommer micabo. ${e.micaboDejaCite?`Une autre slide le cite d\xE9j\xE0 : AUCUNE slide \xE0 remplacer ne le nomme. Le
nom du concurrent et le mot qui le porte deviennent une formulation sans marque,
dans la langue du texte (\xAB une appli \xBB, \xAB une appli de quiz \xBB, \xAB une m\xE9thode \xBB).`:`La slide \xE0 remplacer la plus loin dans le slideshow devient micabo (s'il n'y
en a qu'une, c'est elle). Dans les autres, le nom du concurrent et le mot qui le
porte deviennent une formulation sans marque, dans la langue du texte (\xAB une
appli \xBB, \xAB une appli de quiz \xBB, \xAB une m\xE9thode \xBB).`}${e.sansMarque&&e.sansMarque.length>0?`

${e.sansMarque.join(", ")} : ces applis font ce que micabo ne fait pas (micabo ne
lit pas les notes \xE0 voix haute, n'a ni audio ni podcast). Une slide qui les
recommande ne devient JAMAIS micabo et ne compte pas dans la r\xE8gle ci-dessus :
leur nom et le mot qui le porte deviennent une formulation sans marque, dans la
langue du texte (\xAB une appli audio \xBB, \xAB une appli \xBB).`:""}

Le slideshow entier :
${o}

Slides \xE0 juger :
${i}

R\xE9ponds uniquement en JSON, sans bloc de code :
{"slides":[{"position":<n>,"decision":"laisser"|"remplacer","texte":"<texte complet si remplacer, sinon null>"}]}`;try{let r=await R(P,[{text:s}]),p=U(r).replace(/^```(?:json)?|```$/g,"").trim(),m=JSON.parse(p).slides;return Array.isArray(m)?m.map(a=>({position:Number(a.position),decision:a.decision==="laisser"?"laisser":"remplacer",texte:typeof a.texte=="string"?a.texte:null})).filter(a=>Number.isInteger(a.position)):null}catch{return null}}async function se(e){let t=e.slides.map(p=>`Slide ${p.position} : "${p.original||"(aucun texte)"}"`).join(`
`),n=e.langue??"fr",o=_[n]??n,i=`LANGUE DE SORTIE : ${o.toUpperCase()}.
Tout le texte que tu produis doit \xEAtre en ${o}, sans exception, quelle que
soit la langue dans laquelle les consignes ci-dessous sont r\xE9dig\xE9es.

${e.rules??$e}

Titre / l\xE9gende de la vid\xE9o source (souvent des hashtags) : ${e.sourceTitle||"(aucun)"}

Voici toutes les slides du slideshow, dans l'ordre (slide 1 = couverture) :
${t}

Traduis chaque slide en ${o}. Une slide sans texte reste vide.${e.ctaManuel?`

APPEL \xC0 L'ACTION \u2014 \xC0 PR\xC9SERVER TEL QUEL :
Ce slideshow contient d\xE9j\xE0 un appel \xE0 l'action micabo, \xE9crit \xE0 la main${e.ctaManuel.slide?` (slide ${e.ctaManuel.slide})`:""}.
- Traduis la phrase qui le porte comme le reste, naturellement en ${o}.
- Mais garde \xAB micabo \xBB **exactement** ainsi : jamais traduit, jamais
  transcrit dans un autre alphabet, jamais coup\xE9, et jamais suivi de \xAB .app \xBB.
- PR\xC9CISE que c'est une application, dans la langue cible : \xAB l'appli micabo \xBB,
  \xAB the micabo app \xBB, \xAB la app micabo \xBB, \xAB micabo uygulamas\u0131 \xBB\u2026 Jamais le nom nu.
  En turc, le suffixe de cas se pose sur le possessif (micabo uygulamas\u0131n\u0131), pas
  sur le nom. Si la phrase source dit d\xE9j\xE0 \xAB une appli comme micabo \xBB, n'ajoute
  rien : la cat\xE9gorie y est d\xE9j\xE0.
- Ne le d\xE9place pas sur une autre slide, n'en ajoute pas un deuxi\xE8me, et n'en
  invente pas un l\xE0 o\xF9 il n'y en a pas.`:""}

Hashtags (l\xE9gende TikTok \xE0 coller) :
- Produis EXACTEMENT 3 hashtags en ${o}, s\xE9par\xE9s par des espaces.
- Ils doivent coller au sujet des slides (pas une liste g\xE9n\xE9rique).
- Si la l\xE9gende source contient des hashtags, adapte-les naturellement en
  ${o} (\xE9quivalents locaux, pas de calque mot-\xE0-mot). Sinon invente-en
  3 pertinents pour ce slideshow.
- Style TikTok natif : un seul mot par tag, pr\xE9fixe #, pas d'emoji, pas de
  phrase. Exemple de forme : "#apprendre #culturegenerale #fyp"${e.variation?`

Ce slideshow a d\xE9j\xE0 \xE9t\xE9 publi\xE9 sous une autre formulation. Reformule-le
enti\xE8rement : m\xEAmes id\xE9es et m\xEAme ordre, mais tournures, rythme et exemples
diff\xE9rents. Un lecteur qui aurait vu les deux ne doit pas avoir l'impression de
relire le m\xEAme texte.`:""}

Rappel : la sortie est en ${o}.

R\xE9ponds uniquement en JSON, sans bloc de code :
{"slides":[{"position":1,"translated":"..."}, ...],"hashtags":"#tag1 #tag2 #tag3"}`,s=await R(P,[{text:i}]),r=U(s).replace(/^```(?:json)?|```$/g,"").trim();try{let p=JSON.parse(r);return{slides:(p.slides??[]).map(m=>({position:Number(m.position),translated:String(m.translated??"")})),hashtags:Ue(String(p.hashtags??""))}}catch{return{slides:[],hashtags:""}}}var Ne={fr:"\xAB l'appli micabo \xBB ou \xAB l'application micabo \xBB",en:"\xAB the micabo app \xBB",es:"\xAB la app micabo \xBB",de:"\xAB die micabo-App \xBB, le nom D'ABORD (jamais \xAB die App micabo \xBB), l'article suivant la phrase : \xAB mit der micabo-App \xBB"};async function oe(e){let t=e.slides.map(a=>a.position).sort((a,u)=>a-u),n=J(t),o=n.join(", "),i=e.corrections.slice(0,40).map(a=>a.original_text?`- Au lieu de : "${a.original_text}"
  \xC9cris plut\xF4t : "${a.corrected_text}"`:`- Bon exemple : "${a.corrected_text}"`).join(`
`),s=e.slides.map(a=>`Slide ${a.position} : "${a.text||"(vide)"}"`).join(`
`),r=e.langue??"fr",p=_[r]??r,m=`LANGUE DE SORTIE : ${p.toUpperCase()}.
Les variantes que tu \xE9cris doivent \xEAtre en ${p}, quelle que soit la langue
des consignes ci-dessous.

${e.masterPrompt}

--- DONN\xC9ES ---
L\xE9gende de la vid\xE9o : ${e.caption||"(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${s}
${i?`
Corrections pass\xE9es \xE0 respecter :
${i}
`:""}
--- SORTIE ---
Ne remplace jamais la slide 1 (couverture). Le placement de ${e.marque==="micabo"?"micabo":"Sophia"} tombe dans la
SECONDE MOITI\xC9 du slideshow : choisis UNE slide parmi ces positions
UNIQUEMENT : ${o}. \xC9cris 3 variantes qui remplacent son texte.
Chaque variante DOIT :
${e.marque==="micabo"?`- MENTION DE micabo (toujours en minuscules), une seule fois, selon le TON des slides, sans formule publicitaire. micabo est une APPLICATION MOBILE, et il faut TOUJOURS le pr\xE9ciser avec son mot de cat\xE9gorie : ${Ne[r]??"\xAB l'appli micabo \xBB, dans la langue des slides"}. Jamais le nom nu : une slide se lit en une seconde et ne dit pas ce qu'est micabo, c'est le mot de cat\xE9gorie qui fait ce travail. INTERDIT : \xAB micabo.app \xBB, \xAB site \xBB, \xAB plateforme \xBB.${r==="tr"?`
- TURC : \xAB micabo uygulamas\u0131 \xBB (izafet), jamais le nom nu. Le suffixe de cas se pose sur le POSSESSIF, pas sur le nom : micabo uygulamas\u0131n\u0131, micabo uygulamas\u0131na, micabo uygulamas\u0131nda, micabo uygulamas\u0131ndan, ou \xAB micabo uygulamas\u0131 ile \xBB. Jamais \xAB micabo'yu \xBB seul, et jamais \xAB micabo uygulamas\u0131'yu \xBB, qui n'existe pas. INTERDIT : \xAB micabo.app \xBB, le mot \xAB site \xBB / \xAB sitesi \xBB sous toutes ses formes, et \xAB indir / App Store \xBB en formule publicitaire.`:""}`:`- MENTION DE SOPHIA selon le TON des slides : si elles TUTOIENT (2e personne du
  singulier, \xAB tu / ton / tes / tes... \xBB), la mention doit \xEAtre INDIRECTE \u2014 n'\xE9cris
  JAMAIS \xAB utilise l'appli Sophia \xBB ni \xAB t\xE9l\xE9charge Sophia \xBB ; \xE9cris plut\xF4t une
  formule du type \xAB utilise une appli de micro-apprentissage comme Sophia \xBB. Si les
  slides sont \xE0 la 1re personne (\xAB je / j'ai / mon \xBB), une mention directe de Sophia
  est parfaitement acceptable (\xAB j'utilise l'appli Sophia\u2026 \xBB).`}
- reprendre EXACTEMENT le pr\xE9fixe de la slide remplac\xE9e : si son texte commence
  par un num\xE9ro ("5.", "3)"), une puce ou un emoji, la variante commence par le
  M\xCAME. Ne change jamais le num\xE9ro, ne saute pas de num\xE9ro.
- faire une longueur comparable \xE0 ce texte (\xE0 \xB120 % du nombre de caract\xE8res) :
  ni beaucoup plus courte, ni plus longue \u2014 elle occupe la m\xEAme place \xE0 l'\xE9cran.
- COPIER la mise en forme des slides voisines : la M\xCAME casse (si elles sont
  tout en minuscules, reste tout en minuscules ; pas de majuscule d'emphase ni
  de Title Case qu'elles n'ont pas), la m\xEAme ponctuation, les m\xEAmes emojis ou
  retours \xE0 la ligne \xE9ventuels. La slide Sophia doit \xEAtre indistinguable des
  autres au premier coup d'\u0153il.
- rester dans le m\xEAme mode grammatical et le m\xEAme ton que les slides voisines,
  pour s'encha\xEEner sans rupture.
- garder le GABARIT des slides voisines : les m\xEAmes parties, dans le m\xEAme
  ordre (titre, note, citation, mati\xE8re\u2026). Dans un classement, un vrai \xE9l\xE9ment
  avec son nom et sa note. Ne recopie jamais le texte d'une autre slide.

Puis d\xE9signe la MEILLEURE des trois. \xC9carte d'abord celles qui cassent une r\xE8gle
(gabarit et num\xE9ro, longueur, marque, tiret, formule publicitaire). Parmi les
autres, garde celle qu'un \xE9l\xE8ve de ce compte aurait vraiment \xE9crite, et qui
donne le plus envie de demander ce qu'est ${e.marque==="micabo"?"micabo":"Sophia"}. La plus correcte n'est
pas forc\xE9ment la meilleure. Indique son index (0, 1 ou 2) dans "best".

Rappel : les trois variantes sont en ${p}.

R\xE9ponds UNIQUEMENT en JSON, sans bloc de code ni commentaire :
{"chosen_position": <num\xE9ro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;for(let a=0;a<4;a+=1){a>0&&await new Promise(u=>setTimeout(u,1500*a+Math.random()*1e3));try{let u=await R(P,[{text:m}]),f=U(u).replace(/^```(?:json)?|```$/g,"").trim(),d=JSON.parse(f),x=Number(d.chosen_position),b=(d.variants??[]).map(l=>String(l??"").trim()).filter(Boolean),y=n.includes(x)?x:n[n.length-1];if(!y||b.length===0)continue;let w=Number(d.best),$=Number.isInteger(w)&&w>=0&&w<b.length?w:0;return{chosenPosition:y,mode:String(d.mode??""),variants:b,bestIndex:$}}catch{}}return null}var Me={fr:"l'appli micabo",en:"the micabo app",es:"la app micabo",de:"die micabo-App",it:"l'app micabo",pt:"a app micabo",nl:"de micabo-app",pl:"aplikacja micabo",ro:"aplica\u021Bia micabo",cs:"aplikace micabo",sv:"micabo-appen",hu:"a micabo alkalmaz\xE1s",el:"\u03B7 \u03B5\u03C6\u03B1\u03C1\u03BC\u03BF\u03B3\u03AE micabo"},Pe=[[/[Mm]icabo['’]ya/g,"micabo uygulamas\u0131na"],[/[Mm]icabo['’]yu/g,"micabo uygulamas\u0131n\u0131"],[/[Mm]icabo['’]dan/g,"micabo uygulamas\u0131ndan"],[/[Mm]icabo['’]da/g,"micabo uygulamas\u0131nda"]],Re=/[Mm][Ii][Cc][Aa][Bb][Oo]/g;function _e(e,t){return t==="tr"?/uygulama/i.test(e):t==="es"?/\b(app|aplicaci[oó]n)\b/i.test(e):t==="en"?/\bapps?\b/i.test(e):t==="de"?/\b(App(likation)?|Anwendung|appli)\b/i.test(e):/\bapp(li|lication)?s?\b/i.test(e)}function Ie(e,t){return t!=="de"?e:e.replace(/\b(?:App(?:likation)?|Anwendung|appli(?:cation)?)[ \t]+micabo\b/gi,"micabo-App").replace(/\bmicabo[ \t]+(?:App(?:likation)?|Anwendung)\b/gi,"micabo-App")}function ke(e,t){if(!e||!/[Mm][Ii][Cc][Aa][Bb][Oo]/.test(e))return e;let n=Ie(e.replace(Re,"micabo"),t);if(_e(n,t))return n;if(t==="tr"){let i=n;for(let[s,r]of Pe)i=i.replace(s,r);return i=i.replace(/micabo(?!['’]|\s*uygulama)(?=(\s+\S+){0,2}\s+kullan)/g,"micabo uygulamas\u0131n\u0131"),i.replace(/micabo(?!['’]|\s*uygulama)/g,"micabo uygulamas\u0131")}let o=Me[t];return o?t==="en"?n.replace(/(^|\n)(\s*\d+[.)]\s*)?micabo/g,"$1$2micabo app").replace(/micabo(?! app)/g,o):n.replace(/micabo/g,o):n}function Oe(e){return e&&e.replace(/(\d)\s*[—–]\s*(\d)/g,"$1-$2").replace(/\s+[—–]\s+/g,", ").replace(/[—–]/g,", ").replace(/ ,/g,",").replace(/,\s*,/g,",")}var Le=["hustly"],qe=/((l'|une |la |una |the )?app(li|lication)?s?|uygulama(sını|yla)?|comme)\s*$/i;function De(e,t=Le){if(!e)return e;let n=s=>t.some(r=>s.toLowerCase().includes(r));if(!n(e))return e;let o=e.split(`
`).map(s=>{if(!n(s))return s;let r=s.split(/(?<=[.!?])\s+/);return r.length>1?r.filter(p=>!n(p)).join(" ").trim():s});if(!n(o.join(`
`)))return o.join(`
`).trim();let i="";for(let s of[!0,!1]){let r=o,p=r.map(()=>!0);for(let a=0;a<r.length;a+=1){if(!n(r[a]))continue;let u=a;if(s)for(;u>0&&r[u-1].trim()!==""&&!/[.!?:)»"]$/.test(r[u-1].trim())&&!r[u-1].includes("=");)u-=1;let f=a;for(;f<r.length-1&&!/[.!?]$/.test(r[f].trim())&&r[f+1].trim()!=="";)f+=1;for(let d=u;d<=f;d+=1)p[d]=!1}let m=[];for(let a=0;a<r.length;a+=1)p[a]&&(r[a].trim()===""&&m.length>0&&m[m.length-1].trim()===""||m.push(r[a]));if(i=m.join(`
`).trim(),i!=="")break}for(;qe.test(i);){let s=i.lastIndexOf(`
`);if(i=s===-1?"":i.slice(0,s).trim(),i==="")break}return i}function I(e,t){return ke(Oe(De(e)),t)}async function ae(e){let n=e.slides.map(a=>a.position).sort((a,u)=>a-u).filter(a=>a>=2).slice(-3),o=n.join(", "),i=e.corrections.slice(0,40).map(a=>a.original_text?`- Au lieu de : "${a.original_text}"
  \xC9cris plut\xF4t : "${a.corrected_text}"`:`- Bon exemple : "${a.corrected_text}"`).join(`
`),s=e.slides.map(a=>`Slide ${a.position} : "${a.text||"(vide)"}"`).join(`
`),r=e.langue??"fr",p=_[r]??r,m=`LANGUE DE SORTIE : ${p.toUpperCase()}.
Les variantes que tu \xE9cris doivent \xEAtre en ${p}, quelle que soit la langue
des consignes ci-dessous.

${e.masterPrompt}

--- DONN\xC9ES ---
L\xE9gende de la vid\xE9o : ${e.caption||"(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${s}
${i?`
Corrections pass\xE9es \xE0 respecter :
${i}
`:""}
--- SORTIE ---
Ne remplace jamais la slide 1 (couverture). Le placement de ${e.marque==="micabo"?"micabo":"Sophia"} doit toujours tomber dans les
2-3 DERNI\xC8RES slides, jamais avant : choisis UNE slide parmi ces positions
UNIQUEMENT : ${o}. \xC9cris 3 variantes qui remplacent son texte.
Chaque variante DOIT :
${e.marque==="micabo"?`- MENTION DE micabo (toujours en minuscules) selon le TON des slides, sans formule publicitaire. micabo est une APPLICATION MOBILE, et il faut TOUJOURS le pr\xE9ciser : \xE9cris \xAB l'appli micabo \xBB ou \xAB l'application micabo \xBB, jamais le nom nu \u2014 une slide se lit en une seconde et ne dit pas ce qu'est micabo, c'est le mot de cat\xE9gorie qui fait ce travail. INTERDIT : \xAB micabo.app \xBB, \xAB le site micabo \xBB, \xAB la plateforme micabo \xBB.${r==="tr"?`
- TURC : \xAB micabo uygulamas\u0131 \xBB (izafet), jamais le nom nu. Le suffixe de cas se pose sur le POSSESSIF, pas sur le nom : micabo uygulamas\u0131n\u0131, micabo uygulamas\u0131na, micabo uygulamas\u0131nda, micabo uygulamas\u0131ndan, ou \xAB micabo uygulamas\u0131 ile \xBB. Jamais \xAB micabo'yu \xBB seul, et jamais \xAB micabo uygulamas\u0131'yu \xBB, qui n'existe pas. INTERDIT : \xAB micabo.app \xBB, le mot \xAB site \xBB / \xAB sitesi \xBB sous toutes ses formes, et \xAB indir / App Store \xBB en formule publicitaire.`:""}`:`- MENTION DE SOPHIA selon le TON des slides : si elles TUTOIENT (2e personne du
  singulier, \xAB tu / ton / tes / tes... \xBB), la mention doit \xEAtre INDIRECTE \u2014 n'\xE9cris
  JAMAIS \xAB utilise l'appli Sophia \xBB ni \xAB t\xE9l\xE9charge Sophia \xBB ; \xE9cris plut\xF4t une
  formule du type \xAB utilise une appli de micro-apprentissage comme Sophia \xBB. Si les
  slides sont \xE0 la 1re personne (\xAB je / j'ai / mon \xBB), une mention directe de Sophia
  est parfaitement acceptable (\xAB j'utilise l'appli Sophia\u2026 \xBB).`}
- reprendre EXACTEMENT le pr\xE9fixe de la slide remplac\xE9e : si son texte commence
  par un num\xE9ro ("5.", "3)"), une puce ou un emoji, la variante commence par le
  M\xCAME. Ne change jamais le num\xE9ro, ne saute pas de num\xE9ro.
- faire une longueur comparable \xE0 ce texte (\xE0 \xB120 % du nombre de caract\xE8res) :
  ni beaucoup plus courte, ni plus longue \u2014 elle occupe la m\xEAme place \xE0 l'\xE9cran.
- COPIER la mise en forme des slides voisines : la M\xCAME casse (si elles sont
  tout en minuscules, reste tout en minuscules ; pas de majuscule d'emphase ni
  de Title Case qu'elles n'ont pas), la m\xEAme ponctuation, les m\xEAmes emojis ou
  retours \xE0 la ligne \xE9ventuels. La slide Sophia doit \xEAtre indistinguable des
  autres au premier coup d'\u0153il.
- rester dans le m\xEAme mode grammatical et le m\xEAme ton que les slides voisines,
  pour s'encha\xEEner sans rupture.

Puis applique l'autocontr\xF4le et d\xE9signe la MEILLEURE des trois (mode, longueur,
pr\xE9fixe conserv\xE9, z\xE9ro tiret, z\xE9ro jargon). Indique son index (0, 1 ou 2) dans "best".

Rappel : les trois variantes sont en ${p}.

R\xE9ponds UNIQUEMENT en JSON, sans bloc de code ni commentaire :
{"chosen_position": <num\xE9ro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;for(let a=0;a<4;a+=1){a>0&&await new Promise(u=>setTimeout(u,1500*a+Math.random()*1e3));try{let u=await R(P,[{text:m}]),f=U(u).replace(/^```(?:json)?|```$/g,"").trim(),d=JSON.parse(f),x=Number(d.chosen_position),b=(d.variants??[]).map(l=>String(l??"").trim()).filter(Boolean),y=n.includes(x)?x:n[n.length-1];if(!y||b.length===0)continue;let w=Number(d.best),$=Number.isInteger(w)&&w>=0&&w<b.length?w:0;return{chosenPosition:y,mode:String(d.mode??""),variants:b,bestIndex:$}}catch{}}return null}Deno.serve(async e=>{let t=await Z(e);if(t)return t;let n=B();try{let o=await e.json().catch(()=>({})),i=String(o?.contenuId??"").trim(),s=String(o?.langue??"fr").trim().toLowerCase();if(!i)return S({ok:!1,error:"contenuId manquant"},400);let{data:r}=await n.from("contenus").select("id, titre, langue_source, compte_reference_id").eq("id",i).single();if(!r)return S({ok:!1,error:"contenu introuvable"},404);let p=r.langue_source??"fr",{data:m}=await n.from("contenu_langues").select("slides").eq("contenu_id",i).eq("langue",p).maybeSingle(),a=(m?.slides??[]).filter(c=>c.position!=null);if(!a.some(c=>c.texte_overlay))return S({ok:!1,error:"deck source vide"},400);let u;if(s===p)u=a.map(c=>({position:c.position,texte_overlay:I(c.texte_overlay??"",s)}));else{let{data:c}=r.compte_reference_id?await n.from("comptes_reference").select("style_profile").eq("id",r.compte_reference_id).maybeSingle():{data:null},E=await N(n,`traduction_${s}`)??(s==="fr"?await N(n,"traduction"):void 0),v=c?.style_profile??null,T=[E,v?`Voix propre \xE0 cette source :
${v}`:null].filter(Boolean).join(`

`),C=await se({slides:a.map(g=>({position:g.position,original:g.texte_overlay??""})),sourceTitle:r.titre??"",rules:T||void 0,langue:s,variation:!1}),k=new Map(C.slides.map(g=>[g.position,g.translated]));u=a.map(g=>({position:g.position,texte_overlay:I(k.get(g.position)??"",s)}))}let[{data:f},d]=await Promise.all([n.from("concurrents").select("nom, motif").eq("actif",!0),n.from("concurrents_sans_marque").select("nom")]),x=f?H(f,d.error?null:d.data):D,b=await N(n,"placement_micabo")??"",y=await N(n,"placement_micabo_v2")??"",w=c=>c.map(h=>({position:h.position,text:h.texte_overlay??""})),[$,l]=await Promise.all([(async()=>{let c=await ae({masterPrompt:b,corrections:[],slides:w(u),caption:r.titre??"",langue:s,marque:"micabo"});if(!c)return{position:null,texte:null,motif:"\xE9chec du mod\xE8le"};let h=j(u,x).filter(E=>E.position!==c.chosenPosition);return{position:c.chosenPosition,texte:c.variants[c.bestIndex]??null,variantes:c.variants,mode:c.mode,motif:"prompt actuel",concurrentsRestants:h}})(),(async()=>{let c=u,h=j(c,x),E=[];if(h.length>0){let C=new Set(h.map(g=>g.position)),k=await ie({langue:s,slides:c.map(g=>({position:g.position,texte:g.texte_overlay??""})),aJuger:h,micaboDejaCite:c.some(g=>!C.has(g.position)&&A(g.texte_overlay)),sansMarque:F(x).filter(g=>h.some(q=>q.cites.includes(g)))});if(k){let g=X(c,h,k,x,q=>I(q,s));c=g.slides,E=g.remplacees}}let v=V(c);if(v!=null)return{position:v,texte:c.find(C=>C.position===v)?.texte_overlay??null,motif:E.includes(v)?"concurrent remplac\xE9":"micabo d\xE9j\xE0 cit\xE9",concurrentsRemplaces:E,deck:c};let T=await oe({masterPrompt:y,corrections:[],slides:w(c),caption:r.titre??"",langue:s,marque:"micabo"});return T?{position:T.chosenPosition,texte:I(T.variants[T.bestIndex]??"",s),variantes:T.variants,mode:T.mode,motif:"prompt v2",concurrentsRemplaces:E,deck:c}:{position:null,texte:null,motif:"\xE9chec du mod\xE8le",concurrentsRemplaces:E,deck:c}})()]);return S({ok:!0,contenuId:i,langue:s,titre:r.titre??null,deck:u,avant:$,apres:l})}catch(o){return S({ok:!1,error:O(o)},500)}});
