var se=/(?<![\p{L}\p{N}_])micabo(?![\p{L}\p{N}_])/iu;function T(e){return!!e&&se.test(e)}function D(e){let t=[...new Set(e)].sort((r,p)=>r-p);if(t.length<2)return[];let n=t[0],s=t.slice(Math.floor(t.length/2)),o=t.filter(r=>r!==n).slice(-3),i=new Set([...s,...o]);return t.filter(r=>r!==n&&i.has(r))}function q(e){let t=e.filter(n=>T(n.texte_overlay)).map(n=>n.position);return t.length>0?Math.max(...t):null}var B=[{nom:"Wilgo",motif:"\\mwilgo\\M"},{nom:"Astra AI",motif:"\\mastra(\\s?ai)?\\M"},{nom:"Knowunity",motif:"\\mknowunity\\M"},{nom:"Quizlet",motif:"\\mquizlet\\M"},{nom:"Anki",motif:"\\manki\\M"},{nom:"StudySmarter",motif:"\\mstudy\\s?smarter\\M"},{nom:"Studocu",motif:"\\mstudocu\\M"},{nom:"Brainly",motif:"\\mbrainly\\M"},{nom:"Gauth",motif:"\\mgauth(math)?\\M"},{nom:"Photomath",motif:"\\mphotomath\\M"},{nom:"Turbo AI",motif:"\\mturbo\\s?ai\\M"},{nom:"StudyFetch",motif:"\\mstudy\\s?fetch\\M"},{nom:"Revisely",motif:"\\mrevisely\\M"},{nom:"Mindgrasp",motif:"\\mmindgrasp\\M"},{nom:"PeECH",motif:"\\mpeech\\M"}],oe="(?<![\\p{L}\\p{N}_])",ae="(?![\\p{L}\\p{N}_])";function le(e){return new RegExp(e.replace(/\\m/g,oe).replace(/\\M/g,ae),"iu")}function J(e,t){return e?t.filter(n=>le(n.motif).test(e)).map(n=>n.nom):[]}function L(e,t){return e.filter(n=>n.texte_overlay&&n.concurrent_laisse!==n.texte_overlay).map(n=>({position:n.position,cites:J(n.texte_overlay,t)})).filter(n=>n.cites.length>0)}var F=e=>e.split(`
`).length;function ue(e,t,n){return!t||!t.trim()||J(t,n).length>0||/[—–]/.test(t)||F(t)>F(e)+1?!1:t.length<=e.length*1.5+30}function V(e,t,n,s,o=i=>i){let i=new Set(t.map(l=>l.position)),r=new Map(n.filter(l=>i.has(l.position)).map(l=>[l.position,l])),p=new Map(e.map(l=>[l.position,l.texte_overlay])),m=new Map;for(let l of r.values()){let x=p.get(l.position);if(l.decision!=="remplacer"||!x)continue;let c=l.texte==null?null:o(l.texte);c!=null&&ue(x,c,s)&&m.set(l.position,c)}let a=e.some(l=>!i.has(l.position)&&T(l.texte_overlay)),u=[...m].filter(([,l])=>T(l)).map(([l])=>l),g=a||u.length===0?null:Math.max(...u),d=[],w=[],h=[],b=e.map(l=>{let x=r.get(l.position);if(!x||!l.texte_overlay)return l;if(x.decision==="laisser")return w.push(l.position),{...l,concurrent_laisse:l.texte_overlay};let c=m.get(l.position);return c==null||T(c)&&l.position!==g?(h.push(l.position),l):(d.push(l.position),{...l,texte_overlay:c,concurrent_laisse:null})});for(let l of i)r.has(l)||h.push(l);return{slides:b,remplacees:d,laissees:w,refusees:h}}function ce(e,t){if(!(!Array.isArray(t)||t.length<=400))throw new Error(`in("${e}", \u2026) re\xE7oit ${t.length} valeurs (max ${400}) : l'URL PostgREST d\xE9borderait et la requ\xEAte \xE9chouerait en 400. Passe par lireParLots() de _shared/lots.ts.`)}function H(e){return new Proxy(e,{get(t,n,s){let o=Reflect.get(t,n,s);return typeof o!="function"?o:n==="then"||n==="catch"||n==="finally"?o.bind(t):(...i)=>{n==="in"&&ce(String(i[0]),i[1]);let r=o.apply(t,i);return r&&typeof r=="object"&&r!==t?H(r):r}}})}function j(){let e=Deno.env.get("SUPABASE_URL"),t=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!e||!t)throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");let n=z(e,t,{auth:{persistSession:!1,autoRefreshToken:!1}});return new Proxy(n,{get(s,o,i){let r=Reflect.get(s,o,i);return o!=="from"||typeof r!="function"?r:(...p)=>H(r.apply(s,p))}})}async function X(e){if(e.method==="OPTIONS")return new Response(null,{status:204,headers:Y});let t=Deno.env.get("CRON_SECRET");if(!t)return E({error:"CRON_SECRET non configur\xE9"},500);if(e.headers.get("x-cron-secret")===t)return null;let n=Deno.env.get("TEST_SECRET");if(n&&e.headers.get("x-cron-secret")===n)return null;let o=(e.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");if(!o)return E({error:"unauthorized"},401);let i=await me(o);return i?i.roles.includes("admin")?null:E({error:"forbidden"},403):E({error:"unauthorized"},401)}function pe(e){try{let t=e.split(".")[1];return JSON.parse(atob(t.replace(/-/g,"+").replace(/_/g,"/"))).sub??null}catch{return null}}async function me(e){let t=pe(e);if(!t)return null;let n=Deno.env.get("SUPABASE_URL"),s=Deno.env.get("SUPABASE_ANON_KEY");if(!n||!s)return null;let o=z(n,s,{global:{headers:{Authorization:`Bearer ${e}`}},auth:{persistSession:!1,autoRefreshToken:!1}}),{data:i,error:r}=await o.from("user_roles").select("role").eq("user_id",t);return r?null:{userId:t,roles:(i??[]).map(p=>p.role)}}async function C(e,t){let{data:n}=await e.from("prompts").select("contenu").eq("cle",t).maybeSingle();return n?.contenu?.trim()||void 0}function k(e){if(e instanceof Error)return e.message;if(e&&typeof e=="object"){let t=e,n=[t.message,t.details,t.hint,t.code].filter(Boolean);if(n.length>0)return n.join(" \xB7 ");try{return JSON.stringify(e).slice(0,400)}catch{}}return String(e)}var Y={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type, accept, x-cron-secret","access-control-allow-methods":"POST, OPTIONS"};function E(e,t=200){return new Response(JSON.stringify(e),{status:t,headers:{"content-type":"application/json",...Y}})}var Ke=(()=>{let e=new Uint32Array(256);for(let t=0;t<256;t+=1){let n=t;for(let s=0;s<8;s+=1)n=n&1?3988292384^n>>>1:n>>>1;e[t]=n>>>0}return e})();function O(){return Deno.env.get("FAL_KEY")??Deno.env.get("FAL_API_KEY")??null}function N(e){return{Authorization:`Key ${e}`,"Content-Type":"application/json"}}async function Q(e,t,n){let s=O();if(!s)throw new Error("FAL_KEY manquant");let o=`https://queue.fal.run/${e}`;await n?.({phase:"submit",detail:`mod\xE8le=${e}`});let i=await fetch(o,{method:"POST",headers:N(s),body:JSON.stringify(t)});if(!i.ok)throw new Error(`Fal ${e} submit ${i.status}: ${(await i.text()).slice(0,400)}`);return await i.json()}async function G(e,t,n,s=6e5){let o=O();if(!o)throw new Error("FAL_KEY manquant");let i=`https://queue.fal.run/${e}`,r=t.request_id,p=t.status_url??(r?`${i}/requests/${r}/status`:null),m=t.response_url??(r?`${i}/requests/${r}`:null);if(!p||!m)throw new Error(`Fal ${e}: queue invalide ${JSON.stringify(t).slice(0,200)}`);let a=Date.now(),u=t.status,g=0;for(;Date.now()-a<s;){g+=1;let h=await fetch(`${p}?logs=0`,{headers:N(o)});if(!h.ok)throw new Error(`Fal ${e} status ${h.status}: ${(await h.text()).slice(0,250)}`);let b=await h.json();if(u=b.status,await n?.({phase:"poll",requestId:r,polls:g,statut:u,detail:`poll #${g} \u2192 ${u}`}),u==="COMPLETED")break;if(u==="FAILED"||u==="CANCELLED")throw new Error(`Fal ${e} ${u}: ${JSON.stringify(b.error??b).slice(0,300)}`);await new Promise(l=>setTimeout(l,2500))}if(u!=="COMPLETED")throw new Error(`Fal ${e}: timeout (${Math.round(s/1e3)}s), dernier=${u}, polls=${g}`);await n?.({phase:"result",requestId:r,polls:g,statut:u});let d=await fetch(m,{headers:N(o)}),w=await d.text();if(!d.ok)throw new Error(`Fal ${e} result ${d.status}: ${w.slice(0,300)}`);try{return JSON.parse(w)}catch{throw new Error(`Fal ${e}: JSON invalide ${w.slice(0,200)}`)}}var de="openrouter/router",ge="openrouter/router/vision";function fe(e){let t=e.trim();return t?t.includes("/")?t:`google/${t}`:"google/gemini-2.5-flash"}function Z(e){if(typeof e=="string")return e.trim();if(!e||typeof e!="object")return"";let t=e;if(typeof t.output=="string")return t.output.trim();if(typeof t.text=="string")return t.text.trim();if(typeof t.error=="string"&&t.error)throw new Error(`Fal LLM: ${t.error}`);let n=t.data;if(n&&typeof n=="object"){let s=n;if(typeof s.output=="string")return s.output.trim();if(typeof s.text=="string")return s.text.trim()}return""}async function W(e){let t=O();if(!t)throw new Error("FAL_KEY manquant");let n=(e.imageUrls??[]).filter(Boolean),s=n.length?ge:de,o={prompt:e.prompt,model:fe(e.model),reasoning:!1};typeof e.temperature=="number"&&(o.temperature=e.temperature),n.length&&(o.image_urls=n);let i=await fetch(`https://fal.run/${s}`,{method:"POST",headers:N(t),body:JSON.stringify(o)}),r=await i.text();if(i.ok)try{let u=Z(JSON.parse(r));if(u)return u}catch{if(r.trim())return r.trim()}if(i.status===404||i.status===422)throw new Error(`Fal LLM MODEL_REJECTED:${i.status}:${r.slice(0,180)}`);let p=await Q(s,o),m=await G(s,p,void 0,18e4),a=Z(m);if(!a)throw new Error(`Fal LLM vide: ${JSON.stringify(m).slice(0,200)}`);return a}var he="fal-ai/image-editing/text-removal",Qe=`https://queue.fal.run/${he}`;var we="flux-kontext-apps/text-removal",Ze=`https://api.replicate.com/v1/models/${we}/predictions`;var be="fal-ai/seedvr/upscale/image",et=`https://queue.fal.run/${be}`,tt=12*1024*1024;var P=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash"];function xe(e){let t=[];for(let n of e){let s=n.inlineData?.data??n.inline_data?.data;if(!s)continue;let o=n.inlineData?.mimeType??n.inline_data?.mime_type??"image/jpeg";t.push(`data:${o};base64,${s}`)}return t}async function ye(e,t,n){let s=$(t),o=xe(t);return[{text:await W({prompt:s||" ",model:e,temperature:n?.temperature,imageUrls:o.length?o:void 0})}]}function $(e){return e.map(t=>t.text??"").join("").trim()}function Ee(e){return/overload|unavailable|rate.?limit|resource.?exhaust|deadline|timeout|try again|429|500|502|503|504/i.test(e)}async function R(e,t){return(await Se(e,t)).parts}async function Se(e,t){let s=[];for(let o=0;o<4;o+=1){o>0&&await new Promise(i=>setTimeout(i,1500*o+Math.floor(Math.random()*1200))),s=[];for(let i of e)try{return{parts:await ye(i,t),model:i}}catch(r){s.push(`${i}: ${k(r)}`)}if(!s.some(Ee))break}throw new Error(s.join(" | "))}var Ae=`R\xE8gles de traduction imp\xE9ratives :
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
- Conserve les URLs et les sources cit\xE9es telles quelles.`;var _={fr:"fran\xE7ais",en:"anglais",es:"espagnol",it:"italien",de:"allemand",pt:"portugais",cs:"tch\xE8que",nl:"n\xE9erlandais",el:"grec",hu:"hongrois",pl:"polonais",ro:"roumain",sv:"su\xE9dois",tr:"turc"};function ve(e){return e.split(/\s+/).map(n=>n.trim()).filter(Boolean).map(n=>n.startsWith("#")?n:`#${n}`).map(n=>n.replace(/[^\p{L}\p{N}_#]/gu,"")).filter(n=>n.length>1).slice(0,3).join(" ")}var Te={fr:"\xAB l'appli micabo \xBB (\xAB la m\xE9thode X \xBB \u2192 \xAB l'appli micabo \xBB, \xAB avec X \xBB \u2192 \xAB avec l'appli micabo \xBB)",en:"\xAB the micabo app \xBB",es:"\xAB la app micabo \xBB (\xAB con X \xBB \u2192 \xAB con la app micabo \xBB, \xAB el m\xE9todo X \xBB \u2192 \xAB la app micabo \xBB)",de:"\xAB die micabo-App \xBB, nom D'ABORD, avec l'article que la phrase impose (\xAB mit der micabo-App \xBB, \xAB nutzen die micabo-App \xBB pour \xAB die X-Methode \xBB)",tr:"\xAB micabo uygulamas\u0131 \xBB, le suffixe de cas sur \xAB uygulamas\u0131 \xBB : X'dan \u2192 micabo uygulamas\u0131ndan, X'da \u2192 micabo uygulamas\u0131nda, X'yu / X'yi \u2192 micabo uygulamas\u0131n\u0131, X'ya \u2192 micabo uygulamas\u0131na ; jamais \xAB micabo'yu \xBB, jamais \xAB sitesi \xBB"};async function ee(e){if(e.aJuger.length===0)return[];let t=e.langue,n=_[t]??t,s=e.slides.map(r=>`Slide ${r.position} : ${JSON.stringify(r.texte)}`).join(`
`),o=e.aJuger.map(r=>`- slide ${r.position} (cite : ${r.cites.join(", ")})`).join(`
`),i=`LANGUE DU TEXTE : ${n.toUpperCase()}. Ne traduis rien.

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
${Te[t]??"\xAB l'appli micabo \xBB, traduit dans la langue du texte"}.
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
appli \xBB, \xAB une appli de quiz \xBB, \xAB une m\xE9thode \xBB).`}

Le slideshow entier :
${s}

Slides \xE0 juger :
${o}

R\xE9ponds uniquement en JSON, sans bloc de code :
{"slides":[{"position":<n>,"decision":"laisser"|"remplacer","texte":"<texte complet si remplacer, sinon null>"}]}`;try{let r=await R(P,[{text:i}]),p=$(r).replace(/^```(?:json)?|```$/g,"").trim(),m=JSON.parse(p).slides;return Array.isArray(m)?m.map(a=>({position:Number(a.position),decision:a.decision==="laisser"?"laisser":"remplacer",texte:typeof a.texte=="string"?a.texte:null})).filter(a=>Number.isInteger(a.position)):null}catch{return null}}async function te(e){let t=e.slides.map(p=>`Slide ${p.position} : "${p.original||"(aucun texte)"}"`).join(`
`),n=e.langue??"fr",s=_[n]??n,o=`LANGUE DE SORTIE : ${s.toUpperCase()}.
Tout le texte que tu produis doit \xEAtre en ${s}, sans exception, quelle que
soit la langue dans laquelle les consignes ci-dessous sont r\xE9dig\xE9es.

${e.rules??Ae}

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
{"slides":[{"position":1,"translated":"..."}, ...],"hashtags":"#tag1 #tag2 #tag3"}`,i=await R(P,[{text:o}]),r=$(i).replace(/^```(?:json)?|```$/g,"").trim();try{let p=JSON.parse(r);return{slides:(p.slides??[]).map(m=>({position:Number(m.position),translated:String(m.translated??"")})),hashtags:ve(String(p.hashtags??""))}}catch{return{slides:[],hashtags:""}}}var $e={fr:"\xAB l'appli micabo \xBB ou \xAB l'application micabo \xBB",en:"\xAB the micabo app \xBB",es:"\xAB la app micabo \xBB",de:"\xAB die micabo-App \xBB, le nom D'ABORD (jamais \xAB die App micabo \xBB), l'article suivant la phrase : \xAB mit der micabo-App \xBB"};async function ne(e){let t=e.slides.map(a=>a.position).sort((a,u)=>a-u),n=D(t),s=n.join(", "),o=e.corrections.slice(0,40).map(a=>a.original_text?`- Au lieu de : "${a.original_text}"
  \xC9cris plut\xF4t : "${a.corrected_text}"`:`- Bon exemple : "${a.corrected_text}"`).join(`
`),i=e.slides.map(a=>`Slide ${a.position} : "${a.text||"(vide)"}"`).join(`
`),r=e.langue??"fr",p=_[r]??r,m=`LANGUE DE SORTIE : ${p.toUpperCase()}.
Les variantes que tu \xE9cris doivent \xEAtre en ${p}, quelle que soit la langue
des consignes ci-dessous.

${e.masterPrompt}

--- DONN\xC9ES ---
L\xE9gende de la vid\xE9o : ${e.caption||"(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${i}
${o?`
Corrections pass\xE9es \xE0 respecter :
${o}
`:""}
--- SORTIE ---
Ne remplace jamais la slide 1 (couverture). Le placement de ${e.marque==="micabo"?"micabo":"Sophia"} tombe dans la
SECONDE MOITI\xC9 du slideshow : choisis UNE slide parmi ces positions
UNIQUEMENT : ${s}. \xC9cris 3 variantes qui remplacent son texte.
Chaque variante DOIT :
${e.marque==="micabo"?`- MENTION DE micabo (toujours en minuscules), une seule fois, selon le TON des slides, sans formule publicitaire. micabo est une APPLICATION MOBILE, et il faut TOUJOURS le pr\xE9ciser avec son mot de cat\xE9gorie : ${$e[r]??"\xAB l'appli micabo \xBB, dans la langue des slides"}. Jamais le nom nu : une slide se lit en une seconde et ne dit pas ce qu'est micabo, c'est le mot de cat\xE9gorie qui fait ce travail. INTERDIT : \xAB micabo.app \xBB, \xAB site \xBB, \xAB plateforme \xBB.${r==="tr"?`
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
{"chosen_position": <num\xE9ro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;for(let a=0;a<4;a+=1){a>0&&await new Promise(u=>setTimeout(u,1500*a+Math.random()*1e3));try{let u=await R(P,[{text:m}]),g=$(u).replace(/^```(?:json)?|```$/g,"").trim(),d=JSON.parse(g),w=Number(d.chosen_position),h=(d.variants??[]).map(c=>String(c??"").trim()).filter(Boolean),b=n.includes(w)?w:n[n.length-1];if(!b||h.length===0)continue;let l=Number(d.best),x=Number.isInteger(l)&&l>=0&&l<h.length?l:0;return{chosenPosition:b,mode:String(d.mode??""),variants:h,bestIndex:x}}catch{}}return null}var Ue={fr:"l'appli micabo",en:"the micabo app",es:"la app micabo",de:"die micabo-App",it:"l'app micabo",pt:"a app micabo",nl:"de micabo-app",pl:"aplikacja micabo",ro:"aplica\u021Bia micabo",cs:"aplikace micabo",sv:"micabo-appen",hu:"a micabo alkalmaz\xE1s",el:"\u03B7 \u03B5\u03C6\u03B1\u03C1\u03BC\u03BF\u03B3\u03AE micabo"},Ce=[[/[Mm]icabo['’]ya/g,"micabo uygulamas\u0131na"],[/[Mm]icabo['’]yu/g,"micabo uygulamas\u0131n\u0131"],[/[Mm]icabo['’]dan/g,"micabo uygulamas\u0131ndan"],[/[Mm]icabo['’]da/g,"micabo uygulamas\u0131nda"]],Ne=/[Mm][Ii][Cc][Aa][Bb][Oo]/g;function Pe(e,t){return t==="tr"?/uygulama/i.test(e):t==="es"?/\b(app|aplicaci[oó]n)\b/i.test(e):t==="en"?/\bapps?\b/i.test(e):t==="de"?/\b(App(likation)?|Anwendung|appli)\b/i.test(e):/\bapp(li|lication)?s?\b/i.test(e)}function Re(e,t){return t!=="de"?e:e.replace(/\b(?:App(?:likation)?|Anwendung|appli(?:cation)?)[ \t]+micabo\b/gi,"micabo-App").replace(/\bmicabo[ \t]+(?:App(?:likation)?|Anwendung)\b/gi,"micabo-App")}function _e(e,t){if(!e||!/[Mm][Ii][Cc][Aa][Bb][Oo]/.test(e))return e;let n=Re(e.replace(Ne,"micabo"),t);if(Pe(n,t))return n;if(t==="tr"){let o=n;for(let[i,r]of Ce)o=o.replace(i,r);return o=o.replace(/micabo(?!['’]|\s*uygulama)(?=(\s+\S+){0,2}\s+kullan)/g,"micabo uygulamas\u0131n\u0131"),o.replace(/micabo(?!['’]|\s*uygulama)/g,"micabo uygulamas\u0131")}let s=Ue[t];return s?t==="en"?n.replace(/(^|\n)(\s*\d+[.)]\s*)?micabo/g,"$1$2micabo app").replace(/micabo(?! app)/g,s):n.replace(/micabo/g,s):n}function Ie(e){return e&&e.replace(/(\d)\s*[—–]\s*(\d)/g,"$1-$2").replace(/\s+[—–]\s+/g,", ").replace(/[—–]/g,", ").replace(/ ,/g,",").replace(/,\s*,/g,",")}var Me=["hustly"],ke=/((l'|une |la |una |the )?app(li|lication)?s?|uygulama(sını|yla)?|comme)\s*$/i;function Oe(e,t=Me){if(!e)return e;let n=i=>t.some(r=>i.toLowerCase().includes(r));if(!n(e))return e;let s=e.split(`
`).map(i=>{if(!n(i))return i;let r=i.split(/(?<=[.!?])\s+/);return r.length>1?r.filter(p=>!n(p)).join(" ").trim():i});if(!n(s.join(`
`)))return s.join(`
`).trim();let o="";for(let i of[!0,!1]){let r=s,p=r.map(()=>!0);for(let a=0;a<r.length;a+=1){if(!n(r[a]))continue;let u=a;if(i)for(;u>0&&r[u-1].trim()!==""&&!/[.!?:)»"]$/.test(r[u-1].trim())&&!r[u-1].includes("=");)u-=1;let g=a;for(;g<r.length-1&&!/[.!?]$/.test(r[g].trim())&&r[g+1].trim()!=="";)g+=1;for(let d=u;d<=g;d+=1)p[d]=!1}let m=[];for(let a=0;a<r.length;a+=1)p[a]&&(r[a].trim()===""&&m.length>0&&m[m.length-1].trim()===""||m.push(r[a]));if(o=m.join(`
`).trim(),o!=="")break}for(;ke.test(o);){let i=o.lastIndexOf(`
`);if(o=i===-1?"":o.slice(0,i).trim(),o==="")break}return o}function I(e,t){return _e(Ie(Oe(e)),t)}async function re(e){let n=e.slides.map(a=>a.position).sort((a,u)=>a-u).filter(a=>a>=2).slice(-3),s=n.join(", "),o=e.corrections.slice(0,40).map(a=>a.original_text?`- Au lieu de : "${a.original_text}"
  \xC9cris plut\xF4t : "${a.corrected_text}"`:`- Bon exemple : "${a.corrected_text}"`).join(`
`),i=e.slides.map(a=>`Slide ${a.position} : "${a.text||"(vide)"}"`).join(`
`),r=e.langue??"fr",p=_[r]??r,m=`LANGUE DE SORTIE : ${p.toUpperCase()}.
Les variantes que tu \xE9cris doivent \xEAtre en ${p}, quelle que soit la langue
des consignes ci-dessous.

${e.masterPrompt}

--- DONN\xC9ES ---
L\xE9gende de la vid\xE9o : ${e.caption||"(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${i}
${o?`
Corrections pass\xE9es \xE0 respecter :
${o}
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

Rappel : les trois variantes sont en ${p}.

R\xE9ponds UNIQUEMENT en JSON, sans bloc de code ni commentaire :
{"chosen_position": <num\xE9ro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;for(let a=0;a<4;a+=1){a>0&&await new Promise(u=>setTimeout(u,1500*a+Math.random()*1e3));try{let u=await R(P,[{text:m}]),g=$(u).replace(/^```(?:json)?|```$/g,"").trim(),d=JSON.parse(g),w=Number(d.chosen_position),h=(d.variants??[]).map(c=>String(c??"").trim()).filter(Boolean),b=n.includes(w)?w:n[n.length-1];if(!b||h.length===0)continue;let l=Number(d.best),x=Number.isInteger(l)&&l>=0&&l<h.length?l:0;return{chosenPosition:b,mode:String(d.mode??""),variants:h,bestIndex:x}}catch{}}return null}Deno.serve(async e=>{let t=await X(e);if(t)return t;let n=j();try{let s=await e.json().catch(()=>({})),o=String(s?.contenuId??"").trim(),i=String(s?.langue??"fr").trim().toLowerCase();if(!o)return E({ok:!1,error:"contenuId manquant"},400);let{data:r}=await n.from("contenus").select("id, titre, langue_source, compte_reference_id").eq("id",o).single();if(!r)return E({ok:!1,error:"contenu introuvable"},404);let p=r.langue_source??"fr",{data:m}=await n.from("contenu_langues").select("slides").eq("contenu_id",o).eq("langue",p).maybeSingle(),a=(m?.slides??[]).filter(c=>c.position!=null);if(!a.some(c=>c.texte_overlay))return E({ok:!1,error:"deck source vide"},400);let u;if(i===p)u=a.map(c=>({position:c.position,texte_overlay:I(c.texte_overlay??"",i)}));else{let{data:c}=r.compte_reference_id?await n.from("comptes_reference").select("style_profile").eq("id",r.compte_reference_id).maybeSingle():{data:null},S=await C(n,`traduction_${i}`)??(i==="fr"?await C(n,"traduction"):void 0),v=c?.style_profile??null,A=[S,v?`Voix propre \xE0 cette source :
${v}`:null].filter(Boolean).join(`

`),U=await te({slides:a.map(f=>({position:f.position,original:f.texte_overlay??""})),sourceTitle:r.titre??"",rules:A||void 0,langue:i,variation:!1}),M=new Map(U.slides.map(f=>[f.position,f.translated]));u=a.map(f=>({position:f.position,texte_overlay:I(M.get(f.position)??"",i)}))}let{data:g}=await n.from("concurrents").select("nom, motif").eq("actif",!0),d=g??B,w=await C(n,"placement_micabo")??"",h=await C(n,"placement_micabo_v2")??"",b=c=>c.map(y=>({position:y.position,text:y.texte_overlay??""})),[l,x]=await Promise.all([(async()=>{let c=await re({masterPrompt:w,corrections:[],slides:b(u),caption:r.titre??"",langue:i,marque:"micabo"});if(!c)return{position:null,texte:null,motif:"\xE9chec du mod\xE8le"};let y=L(u,d).filter(S=>S.position!==c.chosenPosition);return{position:c.chosenPosition,texte:c.variants[c.bestIndex]??null,variantes:c.variants,mode:c.mode,motif:"prompt actuel",concurrentsRestants:y}})(),(async()=>{let c=u,y=L(c,d),S=[];if(y.length>0){let U=new Set(y.map(f=>f.position)),M=await ee({langue:i,slides:c.map(f=>({position:f.position,texte:f.texte_overlay??""})),aJuger:y,micaboDejaCite:c.some(f=>!U.has(f.position)&&T(f.texte_overlay))});if(M){let f=V(c,y,M,d,ie=>I(ie,i));c=f.slides,S=f.remplacees}}let v=q(c);if(v!=null)return{position:v,texte:c.find(U=>U.position===v)?.texte_overlay??null,motif:S.includes(v)?"concurrent remplac\xE9":"micabo d\xE9j\xE0 cit\xE9",concurrentsRemplaces:S,deck:c};let A=await ne({masterPrompt:h,corrections:[],slides:b(c),caption:r.titre??"",langue:i,marque:"micabo"});return A?{position:A.chosenPosition,texte:I(A.variants[A.bestIndex]??"",i),variantes:A.variants,mode:A.mode,motif:"prompt v2",concurrentsRemplaces:S,deck:c}:{position:null,texte:null,motif:"\xE9chec du mod\xE8le",concurrentsRemplaces:S,deck:c}})()]);return E({ok:!0,contenuId:o,langue:i,titre:r.titre??null,deck:u,avant:l,apres:x})}catch(s){return E({ok:!1,error:k(s)},500)}});
