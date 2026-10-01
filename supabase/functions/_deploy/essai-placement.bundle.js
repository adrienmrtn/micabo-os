var fe=/(?<![\p{L}\p{N}_])micabo(?![\p{L}\p{N}_])/iu;function v(e){return!!e&&fe.test(e)}function H(e){let t=[...new Set(e)].sort((r,u)=>r-u);if(t.length<2)return[];let n=t[0],s=t.slice(Math.floor(t.length/2)),i=t.filter(r=>r!==n).slice(-3),o=new Set([...s,...i]);return t.filter(r=>r!==n&&o.has(r))}function X(e){let t=e.filter(n=>v(n.texte_overlay)).map(n=>n.position);return t.length>0?Math.max(...t):null}var Y=/^\s*(?:\p{L}{2,12}\s*)?(?:n°|nº|nr\.?|#)?\s*\d+(?:\s*[.):-])?/iu,J=/^\s*\d+\s*[.)-]\s+/u,V=/(?<![\p{N}])\d+(?:[.,]\d+)?\s*\/\s*10(?![\p{N}])/u;function K(e){let t=(e??"").match(Y);return t?t[0]:null}var Q=e=>(e??"").split(`
`)[0].trim().toLowerCase();function z(e,t){let n=K(e),s=K(t);if(n&&s)return s.trim()===n.trim()?t:n.trimEnd()+t.slice(s.trimEnd().length);if(n&&!s){let i=Q(e)===n.trim().toLowerCase();return n.trim()+(i?`
`:" ")+t.trimStart()}return!n&&J.test(t)?t.replace(J,""):t}function he(e,t,n,s){let i=m=>Q((m??"").replace(Y,"")).replace(/^[\s.):-]+/u,""),o=i(t),r=o.length>0&&n.some(m=>m.position!==s&&i(m.texte_overlay)===o),u=V.test(e)&&!V.test(t);return r||u}function G(e,t,n,s,i){let o=[n,...t.map((r,u)=>u).filter(r=>r!==n)];for(let r of o){let u=t[r];if(!u)continue;let m=z(e,u);if(!he(e,m,s,i))return{texte:m,index:r}}return{texte:z(e,t[n]??t[0]??""),index:n}}var D=[{nom:"Wilgo",motif:"\\mwilgo\\M"},{nom:"Astra AI",motif:"\\mastra(\\s?ai)?\\M"},{nom:"Knowunity",motif:"\\mknowunity\\M"},{nom:"Quizlet",motif:"\\mquizlet\\M"},{nom:"Anki",motif:"\\manki\\M"},{nom:"StudySmarter",motif:"\\mstudy\\s?smarter\\M"},{nom:"Studocu",motif:"\\mstudocu\\M"},{nom:"Brainly",motif:"\\mbrainly\\M"},{nom:"Gauth",motif:"\\mgauth(math)?\\M"},{nom:"Photomath",motif:"\\mphotomath\\M"},{nom:"Turbo AI",motif:"\\mturbo\\s?ai\\M"},{nom:"StudyFetch",motif:"\\mstudy\\s?fetch\\M"},{nom:"Revisely",motif:"\\mrevisely\\M"},{nom:"Mindgrasp",motif:"\\mmindgrasp\\M"},{nom:"PeECH",motif:"\\mpeech\\M",versMicabo:!1}],we="(?<![\\p{L}\\p{N}_])",be="(?![\\p{L}\\p{N}_])";function xe(e){return new RegExp(e.replace(/\\m/g,we).replace(/\\M/g,be),"iu")}function W(e,t){return e?t.filter(n=>xe(n.motif).test(e)).map(n=>n.nom):[]}function j(e,t){return e.filter(n=>n.texte_overlay&&n.concurrent_laisse!==n.texte_overlay).map(n=>({position:n.position,cites:W(n.texte_overlay,t)})).filter(n=>n.cites.length>0)}var Z=e=>e.split(`
`).length;function ye(e,t,n){return!t||!t.trim()||W(t,n).length>0||/[—–]/.test(t)||Z(t)>Z(e)+1?!1:t.length<=e.length*1.5+30}function ee(e,t){let n=new Map(D.map(i=>[i.nom,i.versMicabo!==!1])),s=t?new Set(t.map(i=>i.nom)):null;return e.map(i=>({nom:i.nom,motif:i.motif,versMicabo:s?!s.has(i.nom):n.get(i.nom)??!0}))}function F(e){return e.filter(t=>t.versMicabo===!1).map(t=>t.nom)}function te(e,t,n,s,i=o=>o){let o=new Set(t.map(l=>l.position)),r=new Map(n.filter(l=>o.has(l.position)).map(l=>[l.position,l])),u=new Map(e.map(l=>[l.position,l.texte_overlay])),m=new Set(F(s)),a=new Map(t.map(l=>[l.position,l.cites])),c=new Map;for(let l of r.values()){let p=u.get(l.position);if(l.decision!=="remplacer"||!p)continue;let g=l.texte==null?null:i(l.texte);g==null||!ye(p,g,s)||(a.get(l.position)??[]).some(A=>m.has(A))&&v(g)&&!v(p)||c.set(l.position,g)}let h=e.some(l=>!o.has(l.position)&&v(l.texte_overlay)),d=[...c].filter(([,l])=>v(l)).map(([l])=>l),y=h||d.length===0?null:Math.max(...d),w=[],E=[],b=[],$=e.map(l=>{let p=r.get(l.position);if(!p||!l.texte_overlay)return l;if(p.decision==="laisser")return E.push(l.position),{...l,concurrent_laisse:l.texte_overlay};let g=c.get(l.position);return g==null||v(g)&&l.position!==y?(b.push(l.position),l):(w.push(l.position),{...l,texte_overlay:g,concurrent_laisse:null})});for(let l of o)r.has(l)||b.push(l);return{slides:$,remplacees:w,laissees:E,refusees:b}}function Ee(e,t){if(!(!Array.isArray(t)||t.length<=400))throw new Error(`in("${e}", \u2026) re\xE7oit ${t.length} valeurs (max ${400}) : l'URL PostgREST d\xE9borderait et la requ\xEAte \xE9chouerait en 400. Passe par lireParLots() de _shared/lots.ts.`)}function ie(e){return new Proxy(e,{get(t,n,s){let i=Reflect.get(t,n,s);return typeof i!="function"?i:n==="then"||n==="catch"||n==="finally"?i.bind(t):(...o)=>{n==="in"&&Ee(String(o[0]),o[1]);let r=i.apply(t,o);return r&&typeof r=="object"&&r!==t?ie(r):r}}})}function B(){let e=Deno.env.get("SUPABASE_URL"),t=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!e||!t)throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");let n=re(e,t,{auth:{persistSession:!1,autoRefreshToken:!1}});return new Proxy(n,{get(s,i,o){let r=Reflect.get(s,i,o);return i!=="from"||typeof r!="function"?r:(...u)=>ie(r.apply(s,u))}})}async function se(e){if(e.method==="OPTIONS")return new Response(null,{status:204,headers:oe});let t=Deno.env.get("CRON_SECRET");if(!t)return S({error:"CRON_SECRET non configur\xE9"},500);if(e.headers.get("x-cron-secret")===t)return null;let n=Deno.env.get("TEST_SECRET");if(n&&e.headers.get("x-cron-secret")===n)return null;let i=(e.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");if(!i)return S({error:"unauthorized"},401);let o=await Ae(i);return o?o.roles.includes("admin")?null:S({error:"forbidden"},403):S({error:"unauthorized"},401)}function Se(e){try{let t=e.split(".")[1];return JSON.parse(atob(t.replace(/-/g,"+").replace(/_/g,"/"))).sub??null}catch{return null}}async function Ae(e){let t=Se(e);if(!t)return null;let n=Deno.env.get("SUPABASE_URL"),s=Deno.env.get("SUPABASE_ANON_KEY");if(!n||!s)return null;let i=re(n,s,{global:{headers:{Authorization:`Bearer ${e}`}},auth:{persistSession:!1,autoRefreshToken:!1}}),{data:o,error:r}=await i.from("user_roles").select("role").eq("user_id",t);return r?null:{userId:t,roles:(o??[]).map(u=>u.role)}}async function N(e,t){let{data:n}=await e.from("prompts").select("contenu").eq("cle",t).maybeSingle();return n?.contenu?.trim()||void 0}function O(e){if(e instanceof Error)return e.message;if(e&&typeof e=="object"){let t=e,n=[t.message,t.details,t.hint,t.code].filter(Boolean);if(n.length>0)return n.join(" \xB7 ");try{return JSON.stringify(e).slice(0,400)}catch{}}return String(e)}var oe={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type, accept, x-cron-secret","access-control-allow-methods":"POST, OPTIONS"};function S(e,t=200){return new Response(JSON.stringify(e),{status:t,headers:{"content-type":"application/json",...oe}})}var nt=(()=>{let e=new Uint32Array(256);for(let t=0;t<256;t+=1){let n=t;for(let s=0;s<8;s+=1)n=n&1?3988292384^n>>>1:n>>>1;e[t]=n>>>0}return e})();function L(){return Deno.env.get("FAL_KEY")??Deno.env.get("FAL_API_KEY")??null}function M(e){return{Authorization:`Key ${e}`,"Content-Type":"application/json"}}async function ae(e,t,n){let s=L();if(!s)throw new Error("FAL_KEY manquant");let i=`https://queue.fal.run/${e}`;await n?.({phase:"submit",detail:`mod\xE8le=${e}`});let o=await fetch(i,{method:"POST",headers:M(s),body:JSON.stringify(t)});if(!o.ok)throw new Error(`Fal ${e} submit ${o.status}: ${(await o.text()).slice(0,400)}`);return await o.json()}async function le(e,t,n,s=6e5){let i=L();if(!i)throw new Error("FAL_KEY manquant");let o=`https://queue.fal.run/${e}`,r=t.request_id,u=t.status_url??(r?`${o}/requests/${r}/status`:null),m=t.response_url??(r?`${o}/requests/${r}`:null);if(!u||!m)throw new Error(`Fal ${e}: queue invalide ${JSON.stringify(t).slice(0,200)}`);let a=Date.now(),c=t.status,h=0;for(;Date.now()-a<s;){h+=1;let w=await fetch(`${u}?logs=0`,{headers:M(i)});if(!w.ok)throw new Error(`Fal ${e} status ${w.status}: ${(await w.text()).slice(0,250)}`);let E=await w.json();if(c=E.status,await n?.({phase:"poll",requestId:r,polls:h,statut:c,detail:`poll #${h} \u2192 ${c}`}),c==="COMPLETED")break;if(c==="FAILED"||c==="CANCELLED")throw new Error(`Fal ${e} ${c}: ${JSON.stringify(E.error??E).slice(0,300)}`);await new Promise(b=>setTimeout(b,2500))}if(c!=="COMPLETED")throw new Error(`Fal ${e}: timeout (${Math.round(s/1e3)}s), dernier=${c}, polls=${h}`);await n?.({phase:"result",requestId:r,polls:h,statut:c});let d=await fetch(m,{headers:M(i)}),y=await d.text();if(!d.ok)throw new Error(`Fal ${e} result ${d.status}: ${y.slice(0,300)}`);try{return JSON.parse(y)}catch{throw new Error(`Fal ${e}: JSON invalide ${y.slice(0,200)}`)}}var ve="openrouter/router",Te="openrouter/router/vision";function $e(e){let t=e.trim();return t?t.includes("/")?t:`google/${t}`:"google/gemini-2.5-flash"}function ue(e){if(typeof e=="string")return e.trim();if(!e||typeof e!="object")return"";let t=e;if(typeof t.output=="string")return t.output.trim();if(typeof t.text=="string")return t.text.trim();if(typeof t.error=="string"&&t.error)throw new Error(`Fal LLM: ${t.error}`);let n=t.data;if(n&&typeof n=="object"){let s=n;if(typeof s.output=="string")return s.output.trim();if(typeof s.text=="string")return s.text.trim()}return""}async function ce(e){let t=L();if(!t)throw new Error("FAL_KEY manquant");let n=(e.imageUrls??[]).filter(Boolean),s=n.length?Te:ve,i={prompt:e.prompt,model:$e(e.model),reasoning:!1};typeof e.temperature=="number"&&(i.temperature=e.temperature),n.length&&(i.image_urls=n);let o=await fetch(`https://fal.run/${s}`,{method:"POST",headers:M(t),body:JSON.stringify(i)}),r=await o.text();if(o.ok)try{let c=ue(JSON.parse(r));if(c)return c}catch{if(r.trim())return r.trim()}if(o.status===404||o.status===422)throw new Error(`Fal LLM MODEL_REJECTED:${o.status}:${r.slice(0,180)}`);let u=await ae(s,i),m=await le(s,u,void 0,18e4),a=ue(m);if(!a)throw new Error(`Fal LLM vide: ${JSON.stringify(m).slice(0,200)}`);return a}var Ue="fal-ai/image-editing/text-removal",at=`https://queue.fal.run/${Ue}`;var Ce="flux-kontext-apps/text-removal",ut=`https://api.replicate.com/v1/models/${Ce}/predictions`;var Ne="fal-ai/seedvr/upscale/image",pt=`https://queue.fal.run/${Ne}`,mt=12*1024*1024;var P=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash"];function Me(e){let t=[];for(let n of e){let s=n.inlineData?.data??n.inline_data?.data;if(!s)continue;let i=n.inlineData?.mimeType??n.inline_data?.mime_type??"image/jpeg";t.push(`data:${i};base64,${s}`)}return t}async function Pe(e,t,n){let s=U(t),i=Me(t);return[{text:await ce({prompt:s||" ",model:e,temperature:n?.temperature,imageUrls:i.length?i:void 0})}]}function U(e){return e.map(t=>t.text??"").join("").trim()}function _e(e){return/overload|unavailable|rate.?limit|resource.?exhaust|deadline|timeout|try again|429|500|502|503|504/i.test(e)}async function _(e,t){return(await Re(e,t)).parts}async function Re(e,t){let s=[];for(let i=0;i<4;i+=1){i>0&&await new Promise(o=>setTimeout(o,1500*i+Math.floor(Math.random()*1200))),s=[];for(let o of e)try{return{parts:await Pe(o,t),model:o}}catch(r){s.push(`${o}: ${O(r)}`)}if(!s.some(_e))break}throw new Error(s.join(" | "))}var Ie=`R\xE8gles de traduction imp\xE9ratives :
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
- Conserve les URLs et les sources cit\xE9es telles quelles.`;var R={fr:"fran\xE7ais",en:"anglais",es:"espagnol",it:"italien",de:"allemand",pt:"portugais",cs:"tch\xE8que",nl:"n\xE9erlandais",el:"grec",hu:"hongrois",pl:"polonais",ro:"roumain",sv:"su\xE9dois",tr:"turc"};function ke(e){return e.split(/\s+/).map(n=>n.trim()).filter(Boolean).map(n=>n.startsWith("#")?n:`#${n}`).map(n=>n.replace(/[^\p{L}\p{N}_#]/gu,"")).filter(n=>n.length>1).slice(0,3).join(" ")}var Oe={fr:"\xAB l'appli micabo \xBB (\xAB la m\xE9thode X \xBB \u2192 \xAB l'appli micabo \xBB, \xAB avec X \xBB \u2192 \xAB avec l'appli micabo \xBB)",en:"\xAB the micabo app \xBB",es:"\xAB la app micabo \xBB (\xAB con X \xBB \u2192 \xAB con la app micabo \xBB, \xAB el m\xE9todo X \xBB \u2192 \xAB la app micabo \xBB)",de:"\xAB die micabo-App \xBB, nom D'ABORD, avec l'article que la phrase impose (\xAB mit der micabo-App \xBB, \xAB nutzen die micabo-App \xBB pour \xAB die X-Methode \xBB)",tr:"\xAB micabo uygulamas\u0131 \xBB, le suffixe de cas sur \xAB uygulamas\u0131 \xBB : X'dan \u2192 micabo uygulamas\u0131ndan, X'da \u2192 micabo uygulamas\u0131nda, X'yu / X'yi \u2192 micabo uygulamas\u0131n\u0131, X'ya \u2192 micabo uygulamas\u0131na ; jamais \xAB micabo'yu \xBB, jamais \xAB sitesi \xBB"};async function pe(e){if(e.aJuger.length===0)return[];let t=e.langue,n=R[t]??t,s=e.slides.map(r=>`Slide ${r.position} : ${JSON.stringify(r.texte)}`).join(`
`),i=e.aJuger.map(r=>`- slide ${r.position} (cite : ${r.cites.join(", ")})`).join(`
`),o=`LANGUE DU TEXTE : ${n.toUpperCase()}. Ne traduis rien.

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
${Oe[t]??"\xAB l'appli micabo \xBB, traduit dans la langue du texte"}.
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
${s}

Slides \xE0 juger :
${i}

R\xE9ponds uniquement en JSON, sans bloc de code :
{"slides":[{"position":<n>,"decision":"laisser"|"remplacer","texte":"<texte complet si remplacer, sinon null>"}]}`;try{let r=await _(P,[{text:o}]),u=U(r).replace(/^```(?:json)?|```$/g,"").trim(),m=JSON.parse(u).slides;return Array.isArray(m)?m.map(a=>({position:Number(a.position),decision:a.decision==="laisser"?"laisser":"remplacer",texte:typeof a.texte=="string"?a.texte:null})).filter(a=>Number.isInteger(a.position)):null}catch{return null}}async function me(e){let t=e.slides.map(u=>`Slide ${u.position} : "${u.original||"(aucun texte)"}"`).join(`
`),n=e.langue??"fr",s=R[n]??n,i=`LANGUE DE SORTIE : ${s.toUpperCase()}.
Tout le texte que tu produis doit \xEAtre en ${s}, sans exception, quelle que
soit la langue dans laquelle les consignes ci-dessous sont r\xE9dig\xE9es.

${e.rules??Ie}

Titre / l\xE9gende de la vid\xE9o source (souvent des hashtags) : ${e.sourceTitle||"(aucun)"}

Voici toutes les slides du slideshow, dans l'ordre (slide 1 = couverture) :
${t}

Traduis chaque slide en ${s}. Une slide sans texte reste vide.${e.ctaManuel?`

APPEL \xC0 L'ACTION \u2014 \xC0 PR\xC9SERVER TEL QUEL :
Ce slideshow contient d\xE9j\xE0 un appel \xE0 l'action micabo, \xE9crit \xE0 la main${e.ctaManuel.slide?` (slide ${e.ctaManuel.slide})`:""}.
- Traduis la phrase qui le porte comme le reste, naturellement en ${s}.
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
- Produis EXACTEMENT 3 hashtags en ${s}, s\xE9par\xE9s par des espaces.
- Ils doivent coller au sujet des slides (pas une liste g\xE9n\xE9rique).
- Si la l\xE9gende source contient des hashtags, adapte-les naturellement en
  ${s} (\xE9quivalents locaux, pas de calque mot-\xE0-mot). Sinon invente-en
  3 pertinents pour ce slideshow.
- Style TikTok natif : un seul mot par tag, pr\xE9fixe #, pas d'emoji, pas de
  phrase. Exemple de forme : "#apprendre #culturegenerale #fyp"${e.variation?`

Ce slideshow a d\xE9j\xE0 \xE9t\xE9 publi\xE9 sous une autre formulation. Reformule-le
enti\xE8rement : m\xEAmes id\xE9es et m\xEAme ordre, mais tournures, rythme et exemples
diff\xE9rents. Un lecteur qui aurait vu les deux ne doit pas avoir l'impression de
relire le m\xEAme texte.`:""}

Rappel : la sortie est en ${s}.

R\xE9ponds uniquement en JSON, sans bloc de code :
{"slides":[{"position":1,"translated":"..."}, ...],"hashtags":"#tag1 #tag2 #tag3"}`,o=await _(P,[{text:i}]),r=U(o).replace(/^```(?:json)?|```$/g,"").trim();try{let u=JSON.parse(r);return{slides:(u.slides??[]).map(m=>({position:Number(m.position),translated:String(m.translated??"")})),hashtags:ke(String(u.hashtags??""))}}catch{return{slides:[],hashtags:""}}}var Le={fr:"\xAB l'appli micabo \xBB ou \xAB l'application micabo \xBB",en:"\xAB the micabo app \xBB",es:"\xAB la app micabo \xBB",de:"\xAB die micabo-App \xBB, le nom D'ABORD (jamais \xAB die App micabo \xBB), l'article suivant la phrase : \xAB mit der micabo-App \xBB"};async function de(e){let t=e.slides.map(a=>a.position).sort((a,c)=>a-c),n=H(t),s=n.join(", "),i=e.corrections.slice(0,40).map(a=>a.original_text?`- Au lieu de : "${a.original_text}"
  \xC9cris plut\xF4t : "${a.corrected_text}"`:`- Bon exemple : "${a.corrected_text}"`).join(`
`),o=e.slides.map(a=>`Slide ${a.position} : "${a.text||"(vide)"}"`).join(`
`),r=e.langue??"fr",u=R[r]??r,m=`LANGUE DE SORTIE : ${u.toUpperCase()}.
Les variantes que tu \xE9cris doivent \xEAtre en ${u}, quelle que soit la langue
des consignes ci-dessous.

${e.masterPrompt}

--- DONN\xC9ES ---
L\xE9gende de la vid\xE9o : ${e.caption||"(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${o}
${i?`
Corrections pass\xE9es \xE0 respecter :
${i}
`:""}
--- SORTIE ---
Ne remplace jamais la slide 1 (couverture). Le placement de ${e.marque==="micabo"?"micabo":"Sophia"} tombe dans la
SECONDE MOITI\xC9 du slideshow : choisis UNE slide parmi ces positions
UNIQUEMENT : ${s}. \xC9cris 3 variantes qui remplacent son texte.
Chaque variante DOIT :
${e.marque==="micabo"?`- MENTION DE micabo (toujours en minuscules), une seule fois, selon le TON des slides, sans formule publicitaire. micabo est une APPLICATION MOBILE, et il faut TOUJOURS le pr\xE9ciser avec son mot de cat\xE9gorie : ${Le[r]??"\xAB l'appli micabo \xBB, dans la langue des slides"}. Jamais le nom nu : une slide se lit en une seconde et ne dit pas ce qu'est micabo, c'est le mot de cat\xE9gorie qui fait ce travail. INTERDIT : \xAB micabo.app \xBB, \xAB site \xBB, \xAB plateforme \xBB.${r==="tr"?`
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

Rappel : les trois variantes sont en ${u}.

R\xE9ponds UNIQUEMENT en JSON, sans bloc de code ni commentaire :
{"chosen_position": <num\xE9ro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;for(let a=0;a<4;a+=1){a>0&&await new Promise(c=>setTimeout(c,1500*a+Math.random()*1e3));try{let c=await _(P,[{text:m}]),h=U(c).replace(/^```(?:json)?|```$/g,"").trim(),d=JSON.parse(h),y=Number(d.chosen_position),w=(d.variants??[]).map(x=>String(x??"").trim()).filter(Boolean),E=n.includes(y)?y:n[n.length-1];if(!E||w.length===0)continue;let b=Number(d.best),$=Number.isInteger(b)&&b>=0&&b<w.length?b:0,l=e.slides.find(x=>x.position===E)?.text??"",p=G(l,w,$,e.slides.map(x=>({position:x.position,texte_overlay:x.text})),E),g=[...w];return g[p.index]=p.texte,{chosenPosition:E,mode:String(d.mode??""),variants:g,bestIndex:p.index}}catch{}}return null}var qe={fr:"l'appli micabo",en:"the micabo app",es:"la app micabo",de:"die micabo-App",it:"l'app micabo",pt:"a app micabo",nl:"de micabo-app",pl:"aplikacja micabo",ro:"aplica\u021Bia micabo",cs:"aplikace micabo",sv:"micabo-appen",hu:"a micabo alkalmaz\xE1s",el:"\u03B7 \u03B5\u03C6\u03B1\u03C1\u03BC\u03BF\u03B3\u03AE micabo"},De=[[/[Mm]icabo['’]ya/g,"micabo uygulamas\u0131na"],[/[Mm]icabo['’]yu/g,"micabo uygulamas\u0131n\u0131"],[/[Mm]icabo['’]dan/g,"micabo uygulamas\u0131ndan"],[/[Mm]icabo['’]da/g,"micabo uygulamas\u0131nda"]],je=/[Mm][Ii][Cc][Aa][Bb][Oo]/g;function Fe(e,t){return t==="tr"?/uygulama/i.test(e):t==="es"?/\b(app|aplicaci[oó]n)\b/i.test(e):t==="en"?/\bapps?\b/i.test(e):t==="de"?/\b(App(likation)?|Anwendung|appli)\b/i.test(e):/\bapp(li|lication)?s?\b/i.test(e)}function Be(e,t){return t!=="de"?e:e.replace(/\b(?:App(?:likation)?|Anwendung|appli(?:cation)?)[ \t]+micabo\b/gi,"micabo-App").replace(/\bmicabo[ \t]+(?:App(?:likation)?|Anwendung)\b/gi,"micabo-App")}function Je(e,t){if(!e||!/[Mm][Ii][Cc][Aa][Bb][Oo]/.test(e))return e;let n=Be(e.replace(je,"micabo"),t);if(Fe(n,t))return n;if(t==="tr"){let i=n;for(let[o,r]of De)i=i.replace(o,r);return i=i.replace(/micabo(?!['’]|\s*uygulama)(?=(\s+\S+){0,2}\s+kullan)/g,"micabo uygulamas\u0131n\u0131"),i.replace(/micabo(?!['’]|\s*uygulama)/g,"micabo uygulamas\u0131")}let s=qe[t];return s?t==="en"?n.replace(/(^|\n)(\s*\d+[.)]\s*)?micabo/g,"$1$2micabo app").replace(/micabo(?! app)/g,s):n.replace(/micabo/g,s):n}function Ve(e){return e&&e.replace(/(\d)\s*[—–]\s*(\d)/g,"$1-$2").replace(/\s+[—–]\s+/g,", ").replace(/[—–]/g,", ").replace(/ ,/g,",").replace(/,\s*,/g,",")}var Ke=["hustly"],ze=/((l'|une |la |una |the )?app(li|lication)?s?|uygulama(sını|yla)?|comme)\s*$/i;function He(e,t=Ke){if(!e)return e;let n=o=>t.some(r=>o.toLowerCase().includes(r));if(!n(e))return e;let s=e.split(`
`).map(o=>{if(!n(o))return o;let r=o.split(/(?<=[.!?])\s+/);return r.length>1?r.filter(u=>!n(u)).join(" ").trim():o});if(!n(s.join(`
`)))return s.join(`
`).trim();let i="";for(let o of[!0,!1]){let r=s,u=r.map(()=>!0);for(let a=0;a<r.length;a+=1){if(!n(r[a]))continue;let c=a;if(o)for(;c>0&&r[c-1].trim()!==""&&!/[.!?:)»"]$/.test(r[c-1].trim())&&!r[c-1].includes("=");)c-=1;let h=a;for(;h<r.length-1&&!/[.!?]$/.test(r[h].trim())&&r[h+1].trim()!=="";)h+=1;for(let d=c;d<=h;d+=1)u[d]=!1}let m=[];for(let a=0;a<r.length;a+=1)u[a]&&(r[a].trim()===""&&m.length>0&&m[m.length-1].trim()===""||m.push(r[a]));if(i=m.join(`
`).trim(),i!=="")break}for(;ze.test(i);){let o=i.lastIndexOf(`
`);if(i=o===-1?"":i.slice(0,o).trim(),i==="")break}return i}function I(e,t){return Je(Ve(He(e)),t)}async function ge(e){let n=e.slides.map(a=>a.position).sort((a,c)=>a-c).filter(a=>a>=2).slice(-3),s=n.join(", "),i=e.corrections.slice(0,40).map(a=>a.original_text?`- Au lieu de : "${a.original_text}"
  \xC9cris plut\xF4t : "${a.corrected_text}"`:`- Bon exemple : "${a.corrected_text}"`).join(`
`),o=e.slides.map(a=>`Slide ${a.position} : "${a.text||"(vide)"}"`).join(`
`),r=e.langue??"fr",u=R[r]??r,m=`LANGUE DE SORTIE : ${u.toUpperCase()}.
Les variantes que tu \xE9cris doivent \xEAtre en ${u}, quelle que soit la langue
des consignes ci-dessous.

${e.masterPrompt}

--- DONN\xC9ES ---
L\xE9gende de la vid\xE9o : ${e.caption||"(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${o}
${i?`
Corrections pass\xE9es \xE0 respecter :
${i}
`:""}
--- SORTIE ---
Ne remplace jamais la slide 1 (couverture). Le placement de ${e.marque==="micabo"?"micabo":"Sophia"} doit toujours tomber dans les
2-3 DERNI\xC8RES slides, jamais avant : choisis UNE slide parmi ces positions
UNIQUEMENT : ${s}. \xC9cris 3 variantes qui remplacent son texte.
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

Rappel : les trois variantes sont en ${u}.

R\xE9ponds UNIQUEMENT en JSON, sans bloc de code ni commentaire :
{"chosen_position": <num\xE9ro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;for(let a=0;a<4;a+=1){a>0&&await new Promise(c=>setTimeout(c,1500*a+Math.random()*1e3));try{let c=await _(P,[{text:m}]),h=U(c).replace(/^```(?:json)?|```$/g,"").trim(),d=JSON.parse(h),y=Number(d.chosen_position),w=(d.variants??[]).map(l=>String(l??"").trim()).filter(Boolean),E=n.includes(y)?y:n[n.length-1];if(!E||w.length===0)continue;let b=Number(d.best),$=Number.isInteger(b)&&b>=0&&b<w.length?b:0;return{chosenPosition:E,mode:String(d.mode??""),variants:w,bestIndex:$}}catch{}}return null}Deno.serve(async e=>{let t=await se(e);if(t)return t;let n=B();try{let s=await e.json().catch(()=>({})),i=String(s?.contenuId??"").trim(),o=String(s?.langue??"fr").trim().toLowerCase();if(!i)return S({ok:!1,error:"contenuId manquant"},400);let{data:r}=await n.from("contenus").select("id, titre, langue_source, compte_reference_id").eq("id",i).single();if(!r)return S({ok:!1,error:"contenu introuvable"},404);let u=r.langue_source??"fr",{data:m}=await n.from("contenu_langues").select("slides").eq("contenu_id",i).eq("langue",u).maybeSingle(),a=(m?.slides??[]).filter(p=>p.position!=null);if(!a.some(p=>p.texte_overlay))return S({ok:!1,error:"deck source vide"},400);let c;if(o===u)c=a.map(p=>({position:p.position,texte_overlay:I(p.texte_overlay??"",o)}));else{let{data:p}=r.compte_reference_id?await n.from("comptes_reference").select("style_profile").eq("id",r.compte_reference_id).maybeSingle():{data:null},x=await N(n,`traduction_${o}`)??(o==="fr"?await N(n,"traduction"):void 0),A=p?.style_profile??null,T=[x,A?`Voix propre \xE0 cette source :
${A}`:null].filter(Boolean).join(`

`),C=await me({slides:a.map(f=>({position:f.position,original:f.texte_overlay??""})),sourceTitle:r.titre??"",rules:T||void 0,langue:o,variation:!1}),k=new Map(C.slides.map(f=>[f.position,f.translated]));c=a.map(f=>({position:f.position,texte_overlay:I(k.get(f.position)??"",o)}))}let[{data:h},d]=await Promise.all([n.from("concurrents").select("nom, motif").eq("actif",!0),n.from("concurrents_sans_marque").select("nom")]),y=h?ee(h,d.error?null:d.data):D,w=await N(n,"placement_micabo")??"",E=await N(n,"placement_micabo_v2")??"",b=p=>p.map(g=>({position:g.position,text:g.texte_overlay??""})),[$,l]=await Promise.all([(async()=>{let p=await ge({masterPrompt:w,corrections:[],slides:b(c),caption:r.titre??"",langue:o,marque:"micabo"});if(!p)return{position:null,texte:null,motif:"\xE9chec du mod\xE8le"};let g=j(c,y).filter(x=>x.position!==p.chosenPosition);return{position:p.chosenPosition,texte:p.variants[p.bestIndex]??null,variantes:p.variants,mode:p.mode,motif:"prompt actuel",concurrentsRestants:g}})(),(async()=>{let p=c,g=j(p,y),x=[];if(g.length>0){let C=new Set(g.map(f=>f.position)),k=await pe({langue:o,slides:p.map(f=>({position:f.position,texte:f.texte_overlay??""})),aJuger:g,micaboDejaCite:p.some(f=>!C.has(f.position)&&v(f.texte_overlay)),sansMarque:F(y).filter(f=>g.some(q=>q.cites.includes(f)))});if(k){let f=te(p,g,k,y,q=>I(q,o));p=f.slides,x=f.remplacees}}let A=X(p);if(A!=null)return{position:A,texte:p.find(C=>C.position===A)?.texte_overlay??null,motif:x.includes(A)?"concurrent remplac\xE9":"micabo d\xE9j\xE0 cit\xE9",concurrentsRemplaces:x,deck:p};let T=await de({masterPrompt:E,corrections:[],slides:b(p),caption:r.titre??"",langue:o,marque:"micabo"});return T?{position:T.chosenPosition,texte:I(T.variants[T.bestIndex]??"",o),variantes:T.variants,mode:T.mode,motif:"prompt v2",concurrentsRemplaces:x,deck:p}:{position:null,texte:null,motif:"\xE9chec du mod\xE8le",concurrentsRemplaces:x,deck:p}})()]);return S({ok:!0,contenuId:i,langue:o,titre:r.titre??null,deck:c,avant:$,apres:l})}catch(s){return S({ok:!1,error:O(s)},500)}});
