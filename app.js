'use strict';
/* Opole — mapa analityczna zieleni i dobrostanu. Vanilla JS + Leaflet.
   Dane ładowane z ./dane/*.geojson + *.json. Brakujące warstwy są pomijane. */

const MAP = L.map('map', {preferCanvas:true, zoomControl:true, maxZoom:21}).setView([50.668, 17.922], 12);
const CANVAS = L.canvas({padding:0.5});

// ---------- podkłady ----------
const bases = {
  'Jasny (CartoDB)': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
     {maxZoom:20, attribution:'© OpenStreetMap, © CARTO'}),
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
     {maxZoom:19, attribution:'© OpenStreetMap'}),
  'Satelita (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
     {maxZoom:19, attribution:'© Esri World Imagery'}),
  'Ciemny (CartoDB)': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
     {maxZoom:20, attribution:'© OpenStreetMap, © CARTO'}),
  'Kolorowy (Voyager)': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
     {maxZoom:20, attribution:'© OpenStreetMap, © CARTO'}),
  'Ulice (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
     {maxZoom:19, attribution:'© Esri'}),
  'Topograficzny (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
     {maxZoom:19, attribution:'© Esri'}),
  'Tylko etykiety (na ciemnym)': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
     {maxZoom:20, attribution:'© CARTO'}),
};
const NOBASE = {'Bez podkładu — ciemny':'#0f1720', 'Bez podkładu — jasny':'#eef2f5'};
bases['Jasny (CartoDB)'].addTo(MAP);
const baseSel = document.getElementById('base');
Object.keys(bases).forEach(n=>{const o=document.createElement('option');o.textContent=n;baseSel.appendChild(o);});
Object.keys(NOBASE).forEach(n=>{const o=document.createElement('option');o.textContent=n;baseSel.appendChild(o);});
let curBase = bases['Jasny (CartoDB)'];
function setBase(name){
  if(curBase){ MAP.removeLayer(curBase); curBase=null; }
  const mapDiv=document.getElementById('map');
  if(NOBASE[name]!==undefined){ mapDiv.style.background=NOBASE[name]; return; }  // bez podkładu
  mapDiv.style.background='';
  curBase=bases[name]; if(curBase) curBase.addTo(MAP);
}
baseSel.onchange = ()=>setBase(baseSel.value);

// referencyjna warstwa Strava (globalna heatmapa aktywności — publiczny podgląd)
const strava = L.tileLayer('https://heatmap-external-a.strava.com/tiles/all/hot/{z}/{x}/{y}.png?px=256',
   {maxZoom:15, opacity:0.7, attribution:'Strava Global Heatmap (ref.)'});

// ---------- rejestr warstw ----------
// type: poly | line | tree | dot(+color,r) ; grp: grupa
const REG = [
  // ZIELEŃ
  {id:'parki', file:'parki', grp:'Zieleń', label:'Parki', type:'poly', color:'#2f9e44', fill:'#2f9e44', on:true},
  {id:'zielen_pozostala', file:'zielen_pozostala', grp:'Zieleń', label:'Skwery, zieleńce, łąki', type:'poly', color:'#74c476', fill:'#74c476', on:true},
  {id:'lasy', file:'lasy', grp:'Zieleń', label:'Lasy', type:'poly', color:'#1b5e20', fill:'#2d6a30', on:true},
  {id:'drzewa', file:'drzewa', grp:'Zieleń', label:'Drzewa (OSM, pkt)', type:'tree', on:false},
  {id:'aleje_drzew', file:'aleje_drzew', grp:'Zieleń', label:'Aleje drzew', type:'line', color:'#37803b', on:false},
  {id:'place_zabaw', file:'place_zabaw', grp:'Zieleń', label:'Place zabaw', type:'dot', color:'#f59f00', r:4, on:false},
  {id:'boiska_sport', file:'boiska_sport', grp:'Zieleń', label:'Obiekty sportowe', type:'dot', color:'#e67700', r:4, on:false},
  {id:'woda', file:'woda', grp:'Zieleń', label:'Woda', type:'poly', color:'#4dabf7', fill:'#4dabf7', on:false},
  // ANALIZA
  {id:'puste_plamy', file:'puste_plamy', grp:'Analiza', label:'⚠ Puste plamy (>500 m od zieleni)', type:'dot', color:'#e03131', r:4, on:true},
  {id:'dostepnosc15', file:'dostepnosc15', grp:'Analiza', label:'Wynik 15-min (siatka)', type:'score', on:false},
  {id:'izochrony', file:'izochrony', grp:'Analizy strategiczne', label:'Izochrony — 3 punkty kluczowe (statyczne)', type:'izo', on:false},
  {id:'dostepnosc_siec', file:'dostepnosc_siec', grp:'Analizy strategiczne', label:'Dystans SIECIOWY do zieleni (min)', type:'netmin', on:false},
  {id:'lokalizacje_zlobki', file:'lokalizacje_zlobki', grp:'Analizy strategiczne', label:'💡 Sugerowane nowe żłobki', type:'site', color:'#e64980', on:false},
  {id:'lokalizacje_parki', file:'lokalizacje_parki', grp:'Analizy strategiczne', label:'💡 Sugerowane nowe parki', type:'site', color:'#2f9e44', on:false},
  {id:'strefy_zieleni_plan', file:'strefy_zieleni_plan', grp:'Analizy strategiczne', label:'🏛 Strefy zieleni — Plan Ogólny (UM)', type:'planzone', on:false},
  // TRANSPORT
  {id:'przystanki_bus', file:'przystanki_bus', grp:'Transport', label:'Przystanki autobusowe', type:'dot', color:'#1c7ed6', r:3, on:false},
  {id:'stacje_kolej', file:'stacje_kolej', grp:'Transport', label:'Stacje / przystanki kolejowe', type:'dot', color:'#7048e8', r:6, on:false},
  {id:'taxi', file:'taxi', grp:'Transport', label:'Postoje taxi', type:'dot', color:'#f08c00', r:5, on:false},
  {id:'rowery_miejskie', file:'rowery_miejskie', grp:'Transport', label:'Rowery / wypożyczalnie', type:'dot', color:'#0ca678', r:5, on:false},
  {id:'stojaki_rowerowe', file:'stojaki_rowerowe', grp:'Transport', label:'Stojaki rowerowe', type:'dot', color:'#63e6be', r:3, on:false},
  {id:'parkingi', file:'parkingi', grp:'Transport', label:'Parkingi', type:'dot', color:'#868e96', r:2, on:false},
  {id:'lotnicze', file:'lotnicze', grp:'Transport', label:'Lądowiska / lotnisko', type:'dot', color:'#d6336c', r:7, on:false},
  // USŁUGI
  {id:'szkoly', file:'szkoly', grp:'Usługi i młodzież', label:'Szkoły / uczelnie', type:'dot', color:'#1971c2', r:5, on:false},
  {id:'sklepy_spozywcze', file:'sklepy_spozywcze', grp:'Usługi i młodzież', label:'Sklepy pierwszej potrzeby', type:'dot', color:'#f76707', r:3, on:false},
  // EDUKACJA WG POZIOMU
  {id:'zlobki', file:'zlobki', grp:'Edukacja wg poziomu', label:'Żłobki', type:'dot', color:'#e64980', r:6, on:false},
  {id:'przedszkola', file:'przedszkola', grp:'Edukacja wg poziomu', label:'Przedszkola', type:'dot', color:'#4dabf7', r:5, on:false},
  {id:'szkoly_podstawowe', file:'szkoly_podstawowe', grp:'Edukacja wg poziomu', label:'Szkoły podstawowe', type:'dot', color:'#1971c2', r:5, on:false},
  {id:'szkoly_srednie', file:'szkoly_srednie', grp:'Edukacja wg poziomu', label:'Szkoły średnie', type:'dot', color:'#f08c00', r:5, on:false},
  {id:'szkoly_wyzsze', file:'szkoly_wyzsze', grp:'Edukacja wg poziomu', label:'Szkoły wyższe / uczelnie', type:'dot', color:'#7048e8', r:6, on:false},
  {id:'sklepy_pozostale', file:'sklepy_pozostale', grp:'Usługi i młodzież', label:'Pozostałe sklepy', type:'dot', color:'#ffa94d', r:2, on:false},
  {id:'zdrowie', file:'zdrowie', grp:'Usługi i młodzież', label:'Zdrowie (apteka, lekarz)', type:'dot', color:'#e03131', r:4, on:false},
  {id:'gastronomia', file:'gastronomia', grp:'Usługi i młodzież', label:'Gastronomia', type:'dot', color:'#f59f00', r:2, on:false},
  {id:'kultura_mlodziez', file:'kultura_mlodziez', grp:'Usługi i młodzież', label:'Kultura / rekreacja', type:'dot', color:'#ae3ec9', r:4, on:false},
  {id:'uslugi_publiczne', file:'uslugi_publiczne', grp:'Usługi i młodzież', label:'Usługi publiczne', type:'dot', color:'#3b5bdb', r:3, on:false},
  {id:'firmy_biura', file:'firmy_biura', grp:'Usługi i młodzież', label:'Firmy / biura', type:'dot', color:'#adb5bd', r:2, on:false},
  // INFRASTRUKTURA I KOMFORT
  {id:'sciezki_rowerowe', file:'sciezki_rowerowe', grp:'Infrastruktura i komfort', label:'Ścieżki rowerowe', type:'line', color:'#0ca678', on:false},
  {id:'chodniki_piesze', file:'chodniki_piesze', grp:'Infrastruktura i komfort', label:'Chodniki / ciągi piesze', type:'line', color:'#adb5bd', on:false},
  {id:'dzialki_ogrody', file:'dzialki_ogrody', grp:'Infrastruktura i komfort', label:'Ogródki działkowe (zieleń)', type:'poly', color:'#74b816', fill:'#94d82d', on:false},
  {id:'cmentarze', file:'cmentarze', grp:'Infrastruktura i komfort', label:'Cmentarze (zieleń)', type:'poly', color:'#66a80f', fill:'#82c91e', on:false},
  {id:'komfort', file:'komfort', grp:'Infrastruktura i komfort', label:'Ławki, woda, wiaty (komfort)', type:'dot', color:'#15aabf', r:3, on:false},
  // SPORT I REKREACJA
  {id:'silownie_zewn', file:'silownie_zewn', grp:'Sport i rekreacja', label:'Siłownie plenerowe', type:'dot', color:'#37b24d', r:5, on:false},
  {id:'silownie_wewn', file:'silownie_wewn', grp:'Sport i rekreacja', label:'Siłownie / fitness (w budynkach)', type:'dot', color:'#f76707', r:4, on:false},
  {id:'atrakcje', file:'atrakcje', grp:'Sport i rekreacja', label:'Atrakcje, sztuka, rozrywka', type:'dot', color:'#ae3ec9', r:4, on:false},
  {id:'centra_handlowe', file:'centra_handlowe', grp:'Sport i rekreacja', label:'Centra handlowe / targowiska', type:'dot', color:'#e8590c', r:6, on:false},
  // SŁUŻBY I RYZYKA
  {id:'sluzby', file:'sluzby', grp:'Służby i ryzyka', label:'Straż, policja, szpitale', type:'dot', color:'#e03131', r:6, on:false},
  {id:'waly_przeciwpow', file:'waly_przeciwpow', grp:'Służby i ryzyka', label:'Wały przeciwpowodziowe', type:'line', color:'#a0522d', on:false},
  // INFRASTRUKTURA KRYTYCZNA
  {id:'przemysl', file:'przemysl', grp:'Infrastruktura krytyczna', label:'Tereny przemysłowe / hale', type:'dot', color:'#868e96', r:3, on:false},
  {id:'energetyka', file:'energetyka', grp:'Infrastruktura krytyczna', label:'Energetyka (linie, stacje)', type:'line', color:'#f59f00', on:false},
  {id:'maszty_telekom', file:'maszty_telekom', grp:'Infrastruktura krytyczna', label:'Maszty / nadajniki telekom. (OSM)', type:'dot', color:'#d6336c', r:6, on:false},
  // TELEKOMUNIKACJA / ZASIĘG
  {id:'bts_nadajniki', file:'bts_nadajniki', grp:'Telekomunikacja (zasięg)', label:'📡 Stacje BTS — wszyscy operatorzy (SI2PEM)', type:'bts', r:5, on:false},
  {id:'zasieg_biale_plamy', file:'zasieg_biale_plamy', grp:'Telekomunikacja (zasięg)', label:'⚠ Białe plamy zasięgu (>1 km od BTS)', type:'dot', color:'#cc5de8', r:4, on:false},
];
// Źródło danych per grupa (do popupów i transparentności)
const GRP_SRC = {
  'Zieleń':'OpenStreetMap', 'Analiza':'Analiza własna (na danych OSM)', 'Transport':'OpenStreetMap',
  'Usługi i młodzież':'OpenStreetMap', 'Infrastruktura i komfort':'OpenStreetMap',
  'Sport i rekreacja':'OpenStreetMap', 'Służby i ryzyka':'OpenStreetMap',
  'Infrastruktura krytyczna':'OpenStreetMap', 'Edukacja wg poziomu':'OpenStreetMap',
  'Analizy strategiczne':'Analiza własna (sieć OSM + dane)',
  'Telekomunikacja (zasięg)':'SI2PEM (gov.pl) + analiza własna'};

const layers = {};   // id -> L.Layer
const dataCache = {}; // id -> geojson

// słownik czytelnych nazw atrybutów (z surowych tagów OSM)
const TAGPL = {amenity:'rodzaj',shop:'sklep',leisure:'rekreacja',landuse:'użytkowanie',natural:'przyroda',
  office:'biuro',sport:'dyscyplina',surface:'nawierzchnia',lit:'oświetlenie',access:'dostęp',operator:'zarządca',
  opening_hours:'godziny','isced:level':'poziom (ISCED)',grades:'klasy',capacity:'pojemność',
  wheelchair:'dla wózków',railway:'kolej',highway:'typ',cuisine:'kuchnia',religion:'religia',
  description:'opis','building:levels':'kondygnacje',official_name:'nazwa oficjalna','operator:type':'typ zarządcy',
  fee:'opłata',denomination:'wyznanie',tower:'wieża','tower:type':'typ masztu','power':'energetyka','man_made':'obiekt'};
const SKIP_TAGS = new Set(['_id','source','source:geometry','wikidata','wikipedia','name','level','barrier','ele','layer',
  'check_date','addr:city','addr:postcode','addr:street','addr:housenumber','website','url','contact:website',
  'phone','contact:phone','email','contact:email','contact:fax','ref:rspo','ref:regon','source:geometry']);
const AMENITY_PL = {school:'Szkoła',college:'Szkoła policealna/college',university:'Uczelnia wyższa',
  kindergarten:'Przedszkole',childcare:'Żłobek/opieka',pharmacy:'Apteka',doctors:'Przychodnia / lekarz',
  clinic:'Klinika',hospital:'Szpital',dentist:'Dentysta',library:'Biblioteka',theatre:'Teatr',cinema:'Kino',
  community_centre:'Dom kultury / centrum społ.',arts_centre:'Centrum sztuki',fire_station:'Straż pożarna',
  police:'Policja',townhall:'Ratusz / urząd',post_office:'Poczta',bank:'Bank',restaurant:'Restauracja',
  cafe:'Kawiarnia',fast_food:'Fast food',bar:'Bar',pub:'Pub',bench:'Ławka',drinking_water:'Woda pitna',
  shelter:'Wiata / schronienie',fountain:'Fontanna',marketplace:'Targowisko',taxi:'Postój taxi',
  bicycle_rental:'Wypożyczalnia rowerów',bicycle_parking:'Stojak rowerowy',parking:'Parking',
  ambulance_station:'Pogotowie'};

function classifySchool(p){
  const n=((p.name||p.official_name||'')+' '+(p['isced:level']||'')).toLowerCase();
  const a=p.amenity;
  if(a==='university'||/uniwersytet|politechnik|akademia|wyższa szkoł|wsb|wsei/.test(n)) return ['Uczelnia wyższa','#7048e8'];
  if(/przedszkol/.test(n)) return ['Przedszkole','#4dabf7'];
  if(/technik|branżow|zawodow|zsz|zespół szkół zawod/.test(n)) return ['Technikum / branżowa','#e8590c'];
  if(/liceum| lo |ogólnokształc/.test(n)) return ['Liceum','#f08c00'];
  if(/podstawow|psp|isced.*1|szkoła podstawow/.test(n)||p['isced:level']==='1'||p['isced:level']==='1;2') return ['Szkoła podstawowa','#1971c2'];
  if(/muzyczn|artystyczn|plastyczn|baletow/.test(n)) return ['Szkoła artystyczna','#ae3ec9'];
  if(/specjaln|integracyjn/.test(n)) return ['Szkoła specjalna','#37b24d'];
  if(/języków|language|cosmopolitan|szkolen|kurs|nauk jazdy|jazdy/.test(n)) return ['Szkoła językowa / kursy','#868e96'];
  if(a==='college') return ['Szkoła policealna','#1098ad'];
  if(a==='university') return ['Uczelnia','#7048e8'];
  if(/zespół szkół/.test(n)) return ['Zespół szkół','#4263eb'];
  return ['Szkoła (typ nieokreślony)','#495057'];
}

function osmLink(id){ if(!id||!id.includes('/'))return ''; return 'https://www.openstreetmap.org/'+id; }
function genericPopup(props, reg){
  props = props||{}; reg = reg||{};
  let typLabel = reg.label || '(obiekt)';
  let typColor = null;
  if(props.amenity && AMENITY_PL[props.amenity]) typLabel = AMENITY_PL[props.amenity];
  if(props.amenity && ['school','college','university'].includes(props.amenity)){
    const c=classifySchool(props); typLabel=c[0]; typColor=c[1];
  }
  const title = props.name || props.official_name || typLabel;
  const src = reg.src || GRP_SRC[reg.grp] || 'OpenStreetMap';
  // adres
  const addr=[props['addr:street'],props['addr:housenumber']].filter(Boolean).join(' ')+
    (props['addr:postcode']||props['addr:city']?', '+[props['addr:postcode'],props['addr:city']].filter(Boolean).join(' '):'');
  // kontakt
  const phone=props.phone||props['contact:phone'];
  const web=props.website||props.url||props['contact:website'];
  const email=props.email||props['contact:email'];
  let rows='';
  Object.keys(props).forEach(k=>{
    if(SKIP_TAGS.has(k)||props[k]==null||props[k]==='') return;
    const label = TAGPL[k]||k;
    if(label===k && k.includes(':')) return; // pomiń mało istotne złożone tagi
    rows+='<tr><td style="color:#9fb1c1;padding-right:8px">'+label+'</td><td>'+String(props[k])+'</td></tr>';
  });
  let h='<h3 style="margin-bottom:2px">'+title+'</h3>';
  h+='<div style="font-size:11px;margin:0 0 6px">'+
     (typColor?'<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+typColor+';margin-right:5px"></span>':'🏷 ')+
     '<b>'+typLabel+'</b></div>';
  if(addr.trim().replace(/^,/,'').trim()) h+='<div class="small">📍 '+addr.replace(/^, /,'')+'</div>';
  let contact='';
  if(phone) contact+='<a href="tel:'+phone+'">'+phone+'</a> ';
  if(web) contact+='<a href="'+(web.startsWith('http')?web:'https://'+web)+'" target="_blank">strona ↗</a> ';
  if(email) contact+='<a href="mailto:'+email+'">e-mail</a>';
  if(contact) h+='<div class="small" style="margin-top:2px">📞 '+contact+'</div>';
  if(rows) h+='<table style="margin-top:5px">'+rows+'</table>';
  // rejestry urzędowe
  if(props['ref:rspo']) h+='<div class="small muted" style="margin-top:3px">RSPO: '+
     '<a href="https://rspo.gov.pl/szukaj?q='+props['ref:rspo']+'" target="_blank">'+props['ref:rspo']+' ↗</a>'+
     (props['ref:regon']?' · REGON: '+props['ref:regon']:'')+'</div>';
  h+='<div style="border-top:1px solid #2a3b4a;margin-top:7px;padding-top:5px;font-size:11px">';
  h+='📋 Źródło: <b>'+src+'</b>';
  const lnk=osmLink(props._id);
  if(lnk) h+=' · <a href="'+lnk+'" target="_blank">obiekt w OSM ↗</a>';
  h+='</div>';
  return h;
}
function styleFor(r){
  if(r.type==='poly') return {color:r.color,weight:1,fillColor:r.fill,fillOpacity:0.45};
  if(r.type==='line') return {color:r.color,weight:2};
  return {};
}
function tipText(p,r){ return p.name||p.operator||p.nazwa||({}[r.id])||r.label.replace(/\s*\([^)]*\)$/,''); }
function dotLayer(gj, r){
  return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
    {radius:r.r,color:'#0b121a',weight:.5,fillColor:r.color,fillOpacity:overlayOpacity}),
    onEachFeature:(f,l)=>{l.bindPopup(genericPopup(f.properties,r),{maxWidth:300});
      const t=tipText(f.properties,r); if(t) l.bindTooltip(t,{direction:'top',opacity:.92});
      l.on('mouseover',()=>{try{l.setStyle({radius:r.r+2,weight:1.5,color:'#fff'});}catch(_){}});
      l.on('mouseout',()=>{try{l.setStyle({radius:r.r,weight:.5,color:'#0b121a'});}catch(_){}});}});
}
function buildLayer(r, gj){
  if(r.type==='poly') return L.geoJSON(gj,{renderer:CANVAS, style:styleFor(r),
     onEachFeature:(f,l)=>l.bindPopup(genericPopup(f.properties,r),{maxWidth:300})});
  if(r.type==='line') return L.geoJSON(gj,{renderer:CANVAS, style:styleFor(r),
     pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:3,weight:0,fillColor:r.color,fillOpacity:.9}),
     onEachFeature:(f,l)=>l.bindPopup(genericPopup(f.properties,r),{maxWidth:300})});
  if(r.type==='tree') return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
     {radius:1.7,color:'#2d6a30',weight:0,fillColor:'#37b24d',fillOpacity:.8}),
     onEachFeature:(f,l)=>l.bindPopup(genericPopup(f.properties,{label:'Drzewo (OSM)',grp:'Zieleń'}),{maxWidth:260})});
  if(r.type==='score'){
    const col=v=>v>=6?'#2b8a3e':v>=5?'#40c057':v>=4?'#94d82d':v>=3?'#ffd43b':v>=2?'#ff922b':'#e8590c';
    return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
     {radius:3,weight:0,fillColor:col(f.properties.score15||0),fillOpacity:.85}),
     onEachFeature:(f,l)=>{const p=f.properties;l.bindPopup('Usług w 15 min: <b>'+p.score15+'/6</b>');}});
  }
  if(r.type==='bts'){
    const opcol=o=>/P4|Play/i.test(o||'')?'#e8590c':/T-Mobile/i.test(o||'')?'#d6336c':/Orange/i.test(o||'')?'#f76707':/Towerlink/i.test(o||'')?'#7048e8':/Plus|Polkomtel/i.test(o||'')?'#2b8a3e':'#1c7ed6';
    return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
      {radius:r.r,color:'#0b121a',weight:.6,fillColor:opcol(f.properties.operator),fillOpacity:.9}),
      onEachFeature:(f,l)=>{const p=f.properties;l.bindPopup('<b>Stacja BTS</b><br>operator: <b>'+(p.operator||'—')+'</b><br>'+
        (p.nazwa?('id: '+p.nazwa+'<br>'):'')+(p.adres?('📍 '+p.adres+'<br>'):'')+
        '<span class="muted" style="font-size:11px">Źródło: SI2PEM (si2pem.gov.pl)</span>');
        if(p.operator) l.bindTooltip('BTS · '+p.operator,{direction:'top',opacity:.92});}});
  }
  if(r.type==='planzone'){
    const col={SN:'#2f9e44',SO:'#94a712',SC:'#66a80f'};
    return L.geoJSON(gj,{renderer:CANVAS,
      style:f=>{const s=f.properties.symbol;return {color:col[s]||'#888',weight:1,fillColor:col[s]||'#888',fillOpacity:.4};},
      onEachFeature:(f,l)=>{const p=f.properties;l.bindPopup('<b>'+(p.nazwa||p.symbol)+'</b> ('+p.oznaczenie+')<br>'+
        'min. powierzchnia biologicznie czynna: <b>'+(p.min_bio_czynna_proc||'—')+'%</b><br>'+
        '<span class="muted" style="font-size:11px">Oficjalne przeznaczenie — Plan Ogólny m. Opola (obowiązuje od 28.11.2025)</span>');}});
  }
  if(r.type==='izo'){
    const col=b=>b<=5?'#2b8a3e':b<=10?'#ffd43b':'#e8590c';
    return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
      {radius:4,weight:0,fillColor:col(f.properties.minuty_band),fillOpacity:.55}),
      onEachFeature:(f,l)=>l.bindPopup('<b>'+f.properties.punkt+'</b><br>czas pieszo: '+f.properties.min+' min<br><span class="muted">strefa ≤'+f.properties.minuty_band+' min</span>')});
  }
  if(r.type==='netmin'){
    const col=v=>v==null?'#444':v<=5?'#2b8a3e':v<=10?'#94d82d':v<=15?'#ffd43b':v<=20?'#ff922b':'#e03131';
    return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
      {radius:3,weight:0,fillColor:col(f.properties.min_zielen),fillOpacity:.8}),
      onEachFeature:(f,l)=>{const p=f.properties;l.bindPopup('Dystans sieciowy do zieleni: <b>'+(p.n_zielen??'—')+' m</b> ('+(p.min_zielen??'—')+' min pieszo)<br><span class="muted">do sklepu '+(p.n_sklep??'—')+' m · do przystanku '+(p.n_przystanek??'—')+' m</span>');}});
  }
  if(r.type==='site'){
    return L.geoJSON(gj,{pointToLayer:(f,ll)=>L.marker(ll,{icon:L.divIcon({className:'',
      html:'<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 2px #000)">📍</div><div style="position:absolute;top:-6px;left:12px;background:'+(r.color||'#e64980')+';color:#fff;font:700 10px system-ui;border-radius:8px;padding:0 4px">'+f.properties.ranga+'</div>',iconSize:[24,24],iconAnchor:[6,22]})}),
      onEachFeature:(f,l)=>l.bindPopup('<b>'+f.properties.rekomendacja+' — propozycja #'+f.properties.ranga+'</b><br>obejmuje ok. '+f.properties.objete_punkty_mieszk+' punktów mieszkalnych poza obecnym zasięgiem<br><span class="muted">Lokalizacja wyliczona algorytmem max-coverage (greedy) na siatce popytu. Wskazówka kierunkowa — do weryfikacji z planem miasta.</span>',{maxWidth:280})});
  }
  if(r.type==='dot'){
    if(r.id==='puste_plamy') return L.geoJSON(gj,{renderer:CANVAS, pointToLayer:(f,ll)=>L.circleMarker(ll,
      {radius:5,color:'#fff',weight:.6,fillColor:'#e03131',fillOpacity:.85}),
      onEachFeature:(f,l)=>l.bindPopup('⚠ Daleko od zieleni<br>najbliższa: <b>'+f.properties.dist_do_zieleni_m+' m</b>')});
    if(r.id==='szkoly') return schoolLayer(gj);
    return dotLayer(gj, r);
  }
  return L.geoJSON(gj,{renderer:CANVAS});
}

// ---------- choropleta dzielnic ----------
let DZ=null, DEMO=null, GREEN=null, M15=null;
let dzLayer=null, curMetric=null, curYear=2026;
let choroOpacity=0.72, overlayOpacity=0.9, showValues=false;
function fmtVal(v){ if(v==null)return ''; return (Math.abs(v)>=1000)?Math.round(v).toLocaleString('pl'):(Math.round(v*10)/10); }

const METRICS = [
  {key:'ludnosc', label:'Ludność', unit:'os.', kind:'demo', better:'high', ramp:['#fff5eb','#7f2704']},
  {key:'gestosc', label:'Gęstość zaludnienia', unit:'os./km²', kind:'demo', better:'mid', ramp:['#f7fbff','#08306b']},
  {key:'mlodziez_proc', label:'Udział młodzieży (0–17)', unit:'%', kind:'demo', better:'high', ramp:['#fff5f0','#7a0177']},
  {key:'sr_wieku', label:'Średni wiek', unit:'lat', kind:'demo', better:'low', ramp:['#edf8e9','#00441b']},
  {key:'zielen_dostepna_m2_na_os', label:'Zieleń urządzona / mieszkańca', unit:'m²', kind:'green', better:'high', ramp:['#fff7ec','#005824']},
  {key:'zielen_m2_na_os', label:'Zieleń łącznie / mieszkańca', unit:'m²', kind:'green', better:'high', ramp:['#fff7ec','#005824']},
  {key:'drzewa_na_1000', label:'Drzewa OSM / 1000 mieszk.', unit:'', kind:'green', better:'high', ramp:['#f7fcf5','#00441b']},
  {key:'zielen_proc_powierzchni', label:'Udział zieleni w powierzchni (OSM)', unit:'%', kind:'green', better:'high', ramp:['#f7fcf5','#00441b']},
  {key:'sat_zielen_proc', label:'Zieleń wg SATELITY (WorldCover)', unit:'%', kind:'sat', better:'high', ramp:['#f7fcf5','#00441b']},
  {key:'sat_drzewa_proc', label:'Drzewa wg SATELITY', unit:'%', kind:'sat', better:'high', ramp:['#f7fcf5','#00441b']},
  {key:'roznica_sat_minus_osm', label:'Ile zieleni OSM GUBI (satelita − OSM)', unit:'pkt%', kind:'sat', better:'high', ramp:['#fff5f0','#67000d']},
  {key:'wellbeing', label:'⭐ Indeks zieleni i dobrostanu (0–100)', unit:'pkt', kind:'index', better:'high', ramp:['#fff5eb','#005824']},
  {key:'bivar', label:'🎯 Priorytet: młodzież × deficyt zieleni', unit:'', kind:'bivar', better:'high'},
  {key:'deprywacja', label:'🧭 Indeks deprywacji dostępu (sieć)', unit:'/100', kind:'strat', better:'low', ramp:['#f7fcf5','#67000d']},
  {key:'priorytet_rownosci', label:'⚖ Priorytet równości (deprywacja×młodzież)', unit:'', kind:'strat', better:'low', ramp:['#fff5eb','#7f0000']},
  {key:'plan_SN_proc', label:'🏛 Strefa zieleni SN — Plan Ogólny', unit:'%', kind:'weryf', better:'high', ramp:['#f7fcf5','#00441b']},
  {key:'zielen_poza_strefami_proc', label:'⚠ Zieleń poza strefami (niechroniona)', unit:'% pow.', kind:'weryf', better:'low', ramp:['#fff5f0','#7f0000']},
  {key:'gestosc_bts_km2', label:'📡 Gęstość stacji BTS', unit:'/km²', kind:'zasieg', better:'high', ramp:['#fff5f0','#084081']},
  {key:'srednia_do_bts_m', label:'📶 Śr. odległość do BTS (zasięg)', unit:'m', kind:'zasieg', better:'low', ramp:['#f7fcf0','#4d004b']},
];
let ZASIEG=null;
function zasiegOf(numer){ return ZASIEG? ZASIEG.dzielnice.find(d=>d.numer===numer):null; }

// ====== OBJAŚNIENIA: opisy wskaźników, warstw, pojęć, źródeł ======
const METRIC_DESC = {
  ludnosc:'Liczba zameldowanych mieszkańców dzielnicy. Suwak roku pokazuje 2017–2026 i projekcję trendu do 2030.',
  gestosc:'Liczba mieszkańców na km² powierzchni dzielnicy. Wysoka = intensywna zabudowa.',
  mlodziez_proc:'Udział osób w wieku 0–17 lat (przedprodukcyjnym) w ludności dzielnicy. Wprost wskazuje, gdzie mieszka młodzież.',
  sr_wieku:'Średni wiek mieszkańców. Rośnie w całym mieście (43→46 lat) — miasto się starzeje.',
  zielen_dostepna_m2_na_os:'m² zieleni URZĄDZONEJ (parki, skwery, zieleńce, trawniki) na mieszkańca. Pole zieleni (OSM) przycięte geometrycznie do granic dzielnicy ÷ ludność. Próg odniesienia: min. 9 m², cel 50 m².',
  zielen_m2_na_os:'m² CAŁEJ zieleni (z lasami) na mieszkańca. Dla dzielnic leśnych wartość bywa bardzo wysoka.',
  drzewa_na_1000:'Liczba drzew (OSM) na 1000 mieszkańców. UWAGA: OSM niedoszacowuje drzewa — to dolne oszacowanie, dobre do porównań względnych między dzielnicami.',
  zielen_proc_powierzchni:'% powierzchni dzielnicy pokryty zielenią zmapowaną w OSM. Patrz zakładka Weryfikacja — satelita widzi więcej.',
  sat_zielen_proc:'% powierzchni z roślinnością rekreacyjną wg SATELITY (ESA WorldCover 10 m: drzewa, krzewy, trawy, mokradła). Niezależny pomiar — nie zależy od mapowania w OSM.',
  sat_drzewa_proc:'% powierzchni pokryty drzewami (klasa „tree cover”) wg satelity.',
  roznica_sat_minus_osm:'O ile punktów procentowych satelita widzi WIĘCEJ zieleni niż zmapowano w OSM. Wysoka wartość = OSM mocno niedoszacowuje (dane do uzupełnienia).',
  wellbeing:'Syntetyczny indeks 0–100: średnia znormalizowanych (0–1) wartości: zieleń satelitarna, zieleń urządzona/os, drzewa/1000 (liczone tylko z dostępnych komponentów). Wyższy = lepsze warunki zielone.',
  bivar:'Mapa dwucechowa 3×3: oś pozioma = tercyle udziału młodzieży, pionowa = tercyle deficytu zieleni SATELITARNEJ (im mniej, tym wyżej). Ciemny róg (dużo młodych + mało zieleni) = priorytet.',
  deprywacja:'Indeks 0–100 braku dostępu. Domeny edukacja (żłobek/przedszkole/podstawowa), usługi (sklep/zdrowie/przystanek), sport — liczone jako mediana dystansu po REALNEJ SIECI pieszej; domena zieleni — z POKRYCIA SATELITARNEGO (ESA WorldCover), nie z dystansu. Brak placówki = kara 4 km (najgorszy dostęp). Wyższy = gorzej.',
  priorytet_rownosci:'Deprywacja ważona udziałem młodzieży (0,5 + 0,5×udział). Kieruje inwestycje tam, gdzie jest najwięcej młodych i najgorszy dostęp.',
  plan_SN_proc:'% powierzchni dzielnicy w oficjalnej STREFIE ZIELENI I REKREACJI (symbol SN) nowego Planu Ogólnego (obowiązuje od 28.11.2025). To PRZEZNACZENIE, nie pomiar pokrycia.',
  zielen_poza_strefami_proc:'% powierzchni dzielnicy będący FAKTYCZNĄ zielenią (satelita) leżącą POZA wszystkimi strefami zieleni (SN+SO+SC) — zieleń potencjalnie niechroniona planem.',
  gestosc_bts_km2:'Liczba stacji bazowych BTS (wszyscy operatorzy, SI2PEM) na km². Wyższa = lepszy potencjalny zasięg.',
  srednia_do_bts_m:'Średnia odległość terenu mieszkalnego do najbliższej stacji BTS. PROXY zasięgu (realny zależy od mocy/anten). Wyższa = słabszy zasięg / „białe plamy”.',
};
const CONCEPTS = [
  ['Dystans sieciowy','Odległość liczona po realnych drogach i chodnikach (graf OSM 100,5 tys. węzłów, algorytm Dijkstry), nie w linii prostej. Uwzględnia bariery (Odra, tory). W Opolu realna droga jest średnio 1,43× dłuższa niż linia prosta.'],
  ['Izochrona','Obszar osiągalny pieszo w danym czasie (5/10/15 min, przy 4,8 km/h = 80 m/min) z wybranego punktu. Zastępuje mylący „okrąg w linii prostej”.'],
  ['Miasto 15-minutowe','Koncepcja urbanistyczna (C. Moreno): wszystkie codzienne potrzeby (szkoła, sklep, zieleń, zdrowie, transport, sport) w zasięgu 15 min pieszo lub rowerem.'],
  ['Indeks deprywacji','Syntetyczna miara braku dostępu do usług/zieleni, złożona z kilku domen i znormalizowana 0–100. Pozwala porównać dzielnice jednym wskaźnikiem.'],
  ['Mapa bivariate','Pokazuje DWIE cechy naraz w siatce kolorów 3×3 (tu: udział młodzieży × deficyt zieleni). Jeden obraz zamiast dwóch map — wskazuje priorytety.'],
  ['Powierzchnia biologicznie czynna','% terenu niezabudowanego, przepuszczalnego (zieleń, woda) wymagany planem dla strefy. W strefach zieleni SN to min. 50–60%.'],
  ['Strefa SN (Plan Ogólny)','„Strefa zieleni i rekreacji” w nowym Planie Ogólnym — oficjalne przeznaczenie terenu. Dopuszcza do 30% zabudowy, więc strefa SN ≠ 100% zieleni.'],
  ['Białe plamy zasięgu','Tereny mieszkalne odległe (>1 km) od najbliższej stacji BTS — proxy słabego zasięgu telekomunikacyjnego. Realny zasięg zależy od mocy, pasma i kierunku anten.'],
  ['Puste plamy zieleni','Tereny mieszkalne >500 m od jakiejkolwiek zieleni. W granicach miasta zostaje ich tylko 1 — zieleń jest niemal wszędzie w zasięgu.'],
  ['Współczynnik nadłożenia','Ile razy droga po realnej sieci jest dłuższa niż linia prosta. Średnio 1,43× (p90 = 1,8×) — liczony dla tras >300 m (krótkie zawyżają iloraz). Pokazuje, jak bariery (Odra, tory) wydłużają drogę i jak proste odległości zaniżają.'],
  ['Max-coverage (greedy)','Algorytm wybierający kolejno lokalizacje obejmujące najwięcej niezaspokojonego popytu (dla żłobków ważonego udziałem młodzieży). Wskazówka, gdzie dodać obiekt.'],
  ['Pewność danych','Ocena jakości pokrycia danych w dzielnicy (gęstość sieci/POI). Tam gdzie niska — wnioski są mniej pewne. Jawnie oznaczone.'],
];
const SOURCES_FULL = [
  ['OpenStreetMap','Zieleń, drzewa, transport, usługi, sieć dróg, budynki, infrastruktura','stan 25.06.2026','ODbL','openstreetmap.org'],
  ['ESA WorldCover 10 m','Niezależny pomiar pokrycia terenu z satelitów Sentinel-1/2 (zieleń, zabudowa)','2021','CC BY 4.0','esa-worldcover.org'],
  ['ArcGIS UM Opole','Dzielnice + demografia 2017–2026, Plan Ogólny (strefy), powódź, ortofotomapy','różne','dane publiczne UM','arcgisportal.um.opole.pl'],
  ['GUGiK / KIEG','Działki i budynki ewidencyjne (WMS)','aktualne','dane publiczne','geoportal.gov.pl'],
  ['GDOŚ Geoserwis','Ochrona przyrody: parki, Natura 2000, rezerwaty, pomniki','aktualne','dane publiczne','geoserwis.gdos.gov.pl'],
  ['GUS Bank Danych Lokalnych','Ceny mieszkań, wynagrodzenia, firmy, demografia','2019–2026','dane publiczne','bdl.stat.gov.pl'],
  ['Plan Ogólny m. Opola','Oficjalne strefy planistyczne (w tym zieleni SN)','od 28.11.2025','akt prawa miejscowego','gov.pl/zagospodarowanieprzestrzenne'],
  ['SI2PEM','Stacje bazowe BTS wszystkich operatorów (pole elektromagnetyczne)','aktualne','dane publiczne (rząd)','si2pem.gov.pl'],
  ['Analiza własna','Dystans sieciowy, izochrony, indeks deprywacji, max-coverage, walidacja 3 źródeł, białe plamy','25.06.2026','—','metoda zwalidowana wieloagentowym audytem'],
];
let STRAT=null, WERYF=null;
function stratOf(numer){ return STRAT? STRAT.indeks_deprywacji.find(d=>d.numer===numer):null; }
function weryfOf(numer){ return WERYF? WERYF.dzielnice.find(d=>d.numer===numer):null; }
let SAT=null;
function satOf(numer){ return SAT? SAT.dzielnice.find(d=>d.numer===numer):null; }

// ----- wskaźniki złożone (liczone w przeglądarce) -----
let COMPOSITE=null; // numer -> {wellbeing, youthQ, deficitQ, bivarColor, parts}
const BIVAR_COLORS=[ // [deficitRow 0..2][youthCol 0..2]; prawy-dolny = priorytet
  ['#e8e8e8','#b8d6be','#73b793'],
  ['#e4acac','#ad9ea5','#5b9c8f'],
  ['#c85a5a','#985356','#444f6b']];
function quantile3(vals,v){ // 0/1/2 wg tercylu
  const s=vals.filter(x=>x!=null).slice().sort((a,b)=>a-b); if(!s.length)return 1;
  const t1=s[Math.floor(s.length/3)], t2=s[Math.floor(2*s.length/3)];
  return v<=t1?0:v<=t2?1:2;
}
function computeComposite(){
  if(!DZ) return; COMPOSITE={};
  const norm=(key,getter)=>{const vs=DZ.features.map(f=>getter(f.properties.numer)).filter(v=>v!=null);
    const mn=Math.min(...vs),mx=Math.max(...vs);return n=>{const v=getter(n);return (v==null||mx<=mn)?null:(v-mn)/(mx-mn);};};
  const gSat=n=>{const s=satOf(n);return s?s.sat_zielen_proc:null;};
  const gCap=n=>{const f=DZ.features.find(f=>f.properties.numer===n);return f?f.properties.zielen_dostepna_m2_na_os:null;};
  const gTree=n=>{const f=DZ.features.find(f=>f.properties.numer===n);return f?f.properties.drzewa_na_1000:null;};
  const gYouth=n=>{const d=demoOf(n);return d&&d.mlodziez_proc?d.mlodziez_proc[9]:null;};
  const nSat=norm('s',gSat), nCap=norm('c',gCap), nTree=norm('t',gTree);
  const youthVals=DZ.features.map(f=>gYouth(f.properties.numer));
  const defVals=DZ.features.map(f=>{const s=gSat(f.properties.numer);return s==null?null:-s;}); // deficyt = -zieleń
  DZ.features.forEach(f=>{const n=f.properties.numer;
    const parts=[nSat(n),nCap(n),nTree(n)].filter(v=>v!=null);
    const wb=parts.length?Math.round(100*parts.reduce((a,b)=>a+b,0)/parts.length):null;
    const yq=quantile3(youthVals,gYouth(n));
    const dq=quantile3(defVals,(gSat(n)==null?null:-gSat(n)));
    COMPOSITE[n]={wellbeing:wb,youthQ:yq,deficitQ:dq,bivarColor:BIVAR_COLORS[dq][yq]};
  });
}

function demoOf(numer){ return DEMO ? DEMO.dzielnice.find(d=>d.numer===numer) : null; }
function metricValue(m, numer, year){
  if(m.kind==='zasieg'){ const s=zasiegOf(numer); return s? s[m.key] : null; }
  if(m.kind==='weryf'){ const s=weryfOf(numer); return s? s[m.key] : null; }
  if(m.kind==='strat'){ const s=stratOf(numer); return s? s[m.key] : null; }
  if(m.kind==='index'){ return COMPOSITE&&COMPOSITE[numer]?COMPOSITE[numer].wellbeing:null; }
  if(m.kind==='bivar'){ const c=COMPOSITE&&COMPOSITE[numer]; return c?(c.deficitQ*3+c.youthQ):null; }
  if(m.kind==='sat'){ const s=satOf(numer); return s? s[m.key] : null; }
  if(m.kind==='green'){
    const f=DZ.features.find(f=>f.properties.numer===numer);
    return f? f.properties[m.key] : null;
  }
  const d=demoOf(numer); if(!d) return null;
  const idx=year-2017;
  if(year<=2026){
    if(m.key==='mlodziez_proc') return d.mlodziez_proc? d.mlodziez_proc[idx] : null;
    return d[m.key]? d[m.key][idx] : null;
  }
  // projekcja >2026
  const pi=year-2027;
  if(m.key==='ludnosc') return d.ludnosc_proj && d.ludnosc_proj[pi]!=null? d.ludnosc_proj[pi] : null;
  if(m.key==='mlodziez_proc'){
    const mp=d.mlodziez_proj&&d.mlodziez_proj[pi], lp=d.ludnosc_proj&&d.ludnosc_proj[pi];
    return (mp&&lp)? Math.round(1000*mp/lp)/10 : null;
  }
  if(m.key==='gestosc'){
    const lp=d.ludnosc_proj&&d.ludnosc_proj[pi], l26=d.ludnosc[9], g26=d.gestosc[9];
    return (lp&&l26&&g26)? Math.round(g26*lp/l26*100)/100 : null;
  }
  if(m.key==='sr_wieku'){ // ekstrapolacja z 2 ostatnich
    const a=d.sr_wieku[8],b=d.sr_wieku[9]; if(a==null||b==null)return b;
    return Math.round((b+(b-a)*(year-2026))*10)/10;
  }
  return null;
}
function rampColor(t, ramp){
  const h=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
  const a=h(ramp[0]),b=h(ramp[1]); t=Math.max(0,Math.min(1,t));
  return 'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')+')';
}
let dzLabels=null;
function drawChoropleth(){
  const m=curMetric;
  const vals=DZ.features.map(f=>metricValue(m,f.properties.numer,curYear)).filter(v=>v!=null);
  const mn=Math.min(...vals), mx=Math.max(...vals);
  if(dzLayer) MAP.removeLayer(dzLayer);
  dzLayer=L.geoJSON(DZ,{
    style:f=>{const n=f.properties.numer;
      if(m.kind==='bivar'){const c=COMPOSITE&&COMPOSITE[n];
        return {color:'#0b121a',weight:1.2,fillColor:c?c.bivarColor:'#444',fillOpacity:choroOpacity};}
      const v=metricValue(m,n,curYear);
      const t=(mx>mn)?(v-mn)/(mx-mn):.5;
      return {color:'#0b121a',weight:1.2,fillColor:v==null?'#444':rampColor(t,m.ramp),fillOpacity:choroOpacity};},
    onEachFeature:(f,l)=>{
      l.on('click',()=>{popupDistrict(f,l); selDistrict=f.properties.numer; drawDemoChart();});
      l.on('mouseover',()=>l.setStyle({weight:3,color:'#fff'}));
      l.on('mouseout',()=>l.setStyle({weight:1.2,color:'#0b121a'}));
    }
  }).addTo(MAP);
  // etykiety dzielnic (numer)
  if(dzLabels) MAP.removeLayer(dzLabels);
  dzLabels=L.layerGroup();
  DZ.features.forEach(f=>{const c=centroidOfFeature(f); if(!c)return;
    const v=metricValue(m,f.properties.numer,curYear);
    let lab=String(f.properties.nazwa);
    if(showValues && m.kind!=='bivar' && v!=null) lab+='<br><span style="font-size:12px;color:#0b3d1a">'+fmtVal(v)+(m.unit&&m.unit.length<4?m.unit:'')+'</span>';
    L.marker(c,{interactive:false,icon:L.divIcon({className:'',html:'<div style="font:600 11px system-ui;color:#0b121a;text-align:center;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">'+lab+'</div>',iconSize:[0,0]})}).addTo(dzLabels);});
  dzLabels.addTo(MAP);
  buildLegend(mn,mx,m);
  buildMapLegend();
  if(yearVal) yearVal.textContent = curYear + (curYear>2026?' ⮕':'');
}
function popupDistrict(f,l){
  const p=f.properties, n=p.numer, d=demoOf(n);
  const m=curMetric, v=metricValue(m,n,curYear);
  let html='<h3>Dzielnica '+(p.nazwa||n)+'</h3><table>';
  const row=(k,val,u)=>{html+='<tr><td>'+k+'</td><td>'+(val==null?'—':val)+(u?' '+u:'')+'</td></tr>';};
  row('Wybrany wskaźnik ('+curYear+')','<b>'+(v==null?'—':v)+'</b>',m.unit);
  if(d){
    row('Ludność 2026', d.ludnosc[9], 'os.');
    row('Zmiana 2017→26', (d.zmiana_10lat_proc>0?'+':'')+d.zmiana_10lat_proc, '%');
    row('Średni wiek 2026', d.sr_wieku[9], 'lat');
    row('Młodzież 0–17', d.mlodziez[9]!=null?d.mlodziez[9]:'—', 'os.');
  }
  row('Zieleń urządz./os', p.zielen_dostepna_m2_na_os, 'm²');
  const s=satOf(n); if(s) row('Zieleń wg satelity', s.sat_zielen_proc, '%');
  row('Drzewa OSM/1000', p.drzewa_na_1000, '');
  const cmp=COMPOSITE&&COMPOSITE[n];
  if(cmp){ row('⭐ Indeks dobrostanu','<b>'+(cmp.wellbeing==null?'—':cmp.wellbeing)+'</b>','/100');
    const pr=(cmp.youthQ===2&&cmp.deficitQ===2)?'WYSOKI (młodzież + deficyt)':(cmp.deficitQ>=1&&cmp.youthQ>=1)?'podwyższony':'niski';
    row('🎯 Priorytet inwestycji', pr, ''); }
  html+='</table>';
  html+='<button onclick="showScorecard('+n+')" style="margin-top:7px;width:100%;background:#2f9e44;color:#fff;border:none;padding:6px;border-radius:6px;cursor:pointer">📄 Pełna karta dzielnicy (PDF)</button>';
  l.bindPopup(html,{maxWidth:280}).openPopup();
}
function showScorecard(n){
  const dz=DZ&&DZ.features.find(f=>f.properties.numer===n); if(!dz)return;
  const p=dz.properties, d=demoOf(n), s=satOf(n), sc=SIEC&&SIEC.dzielnice.find(x=>x.numer===n),
        st=stratOf(n), w=weryfOf(n), cmp=COMPOSITE&&COMPOSITE[n];
  const kv=(k,v,u)=>'<div class="kv"><span>'+k+'</span><b>'+(v==null?'—':v)+(u?' '+u:'')+'</b></div>';
  const mn=v=>v==null?'—':(Math.round(v/80*10)/10)+' min';  // m -> min pieszo
  let h='<h1>Karta dzielnicy '+(p.nazwa||n)+'</h1>'+
    '<div style="color:#6b7a86;font-size:11px;margin-bottom:6px">Opole · Strategia Młodzieżowa, Obszar 7 · dane: OSM, ESA WorldCover, ArcGIS UM Opole, GUS</div>';
  h+='<h2>Demografia</h2><div class="grid">';
  if(d){ h+=kv('Ludność 2026',fmt(d.ludnosc[9]),'os.')+kv('Zmiana 2017→26',(d.zmiana_10lat_proc>0?'+':'')+d.zmiana_10lat_proc,'%')+
    kv('Średni wiek',d.sr_wieku[9],'lat')+kv('Młodzież 0–17',fmt(d.mlodziez[9])+' ('+(d.mlodziez_proc[9]??'—')+'%)','')+
    kv('Gęstość',fmt(p.gestosc),'os./km²')+kv('Powierzchnia',p.powierzchnia_km2,'km²'); }
  h+='</div>';
  h+='<h2>Zieleń — 3 niezależne źródła</h2><div class="grid">';
  h+=kv('🗺 OSM zieleń (% pow.)',p.zielen_proc_powierzchni,'%')+kv('🛰 Satelita zieleń',(s?s.sat_zielen_proc:null),'%')+
     kv('🏛 Plan Ogólny — strefa SN',(w?w.plan_SN_proc:null),'%')+kv('⚠ Zieleń poza strefami',(w?w.zielen_poza_strefami_proc:null),'% pow.')+
     kv('Zieleń urządzona / mieszk.',p.zielen_dostepna_m2_na_os,'m²')+kv('Drzewa OSM / 1000',p.drzewa_na_1000,'')+
     kv('Place zabaw',p.place_zabaw,'');
  h+='</div>';
  h+='<h2>Dostępność pieszo (mediana, po sieci)</h2><div class="grid">';
  if(sc){ h+=kv('Zieleń',mn(sc.med_zielen))+kv('Żłobek',mn(sc.med_zlobek))+kv('Przedszkole',mn(sc.med_przedszkole))+
    kv('Szkoła podstawowa',mn(sc.med_podstawowa))+kv('Sklep 1. potrzeby',mn(sc.med_sklep))+kv('Apteka/lekarz',mn(sc.med_zdrowie))+
    kv('Przystanek',mn(sc.med_przystanek))+kv('Sport',mn(sc.med_sport)); }
  h+='</div>';
  h+='<h2>Diagnoza syntetyczna</h2><div class="grid">';
  if(st){ h+=kv('Indeks deprywacji',st.deprywacja,'/100')+kv('Priorytet równości',st.priorytet_rownosci,'')+
    kv('— domena edukacja',st.dom_edukacja,'')+kv('— domena usługi',st.dom_uslugi,'')+
    kv('— domena sport',st.dom_sport,'')+kv('— domena zieleń',st.dom_zielen,'')+kv('Pewność danych',st.pewnosc,''); }
  if(cmp) h+=kv('Indeks dobrostanu',cmp.wellbeing,'/100');
  h+='</div>';
  // rekomendacja heurystyczna
  let rec=[];
  if(w&&w.zielen_poza_planem_pkt>=25) rec.push('rozważyć ochronę planistyczną istniejącej zieleni (dużo zieleni poza strefami)');
  if(sc&&sc.med_zlobek>1500) rec.push('priorytet: dostęp do żłobka/opieki (daleko)');
  if(p.drzewa_na_1000!=null&&p.drzewa_na_1000<5) rec.push('nasadzenia drzew (mało zieleni wysokiej)');
  if(st&&st.priorytet_rownosci>=50) rec.push('wysoki priorytet równości — inwestycje dla młodzieży');
  h+='<h2>Sugestie (heurystyka)</h2><div style="font-size:12.5px">'+(rec.length?'• '+rec.join('<br>• '):'Brak czerwonych flag — utrzymać standard.')+'</div>';
  h+='<div class="foot">Wygenerowano z interaktywnej mapy analitycznej. Mediana „min pieszo" liczona po realnej sieci (4,8 km/h). '+
     'Strefa SN = oficjalne przeznaczenie (Plan Ogólny, obowiązuje od 28.11.2025), nie pomiar pokrycia. '+
     'Dane ekonomiczne (ceny mieszkań, płace) są na poziomie miasta — patrz zakładka Ekonomia.</div>';
  document.getElementById('scorecard').innerHTML=h;
  document.getElementById('scWrap').style.display='block';
}

function buildLegend(mn,mx,m){
  const el=document.getElementById('legend');
  const dsc=METRIC_DESC[m.key]?'<div class="small muted" style="margin-top:6px;border-top:1px solid var(--line);padding-top:5px">ℹ️ '+METRIC_DESC[m.key]+'</div>':'';
  if(m.kind==='bivar'){
    let h='<b>'+m.label+'</b><div class="small muted" style="margin:4px 0">Ciemny róg ↘ = najwięcej młodzieży i największy deficyt zieleni = <b>priorytet inwestycji</b>.</div>';
    h+='<div style="display:flex;align-items:flex-end;gap:8px;margin-top:6px">';
    h+='<div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;color:#9fb1c1">← deficyt zieleni →</div><div>';
    for(let r=0;r<3;r++){h+='<div style="display:flex">';
      for(let c=0;c<3;c++) h+='<i style="width:20px;height:18px;margin:0;border-radius:0;background:'+BIVAR_COLORS[r][c]+'"></i>';
      h+='</div>';}
    h+='<div style="font-size:10px;color:#9fb1c1;margin-top:2px">→ więcej młodzieży →</div></div></div>';
    el.innerHTML=h+dsc; return;
  }
  let h='<b>'+m.label+'</b> '+(m.unit?'('+m.unit+')':'')+'<br><div style="margin:6px 0">';
  for(let i=0;i<=5;i++){h+='<i style="background:'+rampColor(i/5,m.ramp)+'"></i>';}
  h+='</div><span class="muted">'+(Math.round(mn*10)/10)+' → '+(Math.round(mx*10)/10)+'</span>';
  if(m.kind==='green'||m.kind==='sat') h+='<div class="small muted" style="margin-top:5px">dane 2026 / satelita (statyczne)</div>';
  el.innerHTML=h+dsc;
}

function legendSymbol(r){
  const c=r.color||'#888';
  if(r.type==='poly'||r.type==='planzone') return '<i style="width:13px;height:10px;background:'+(r.fill||c)+';border:1px solid '+c+';border-radius:2px;display:inline-block;margin-right:6px;vertical-align:middle"></i>';
  if(r.type==='line') return '<i style="width:14px;height:0;border-top:3px solid '+c+';display:inline-block;margin:0 6px 3px 0;vertical-align:middle"></i>';
  if(r.type==='tree') return '<i style="width:8px;height:8px;background:#37b24d;border-radius:50%;display:inline-block;margin-right:6px"></i>';
  if(r.type==='site') return '<span style="margin-right:4px">📍</span>';
  if(r.type==='izo') return '<i style="width:8px;height:8px;background:#2b8a3e;border-radius:50%;display:inline-block;margin-right:1px"></i><i style="width:8px;height:8px;background:#ffd43b;border-radius:50%;display:inline-block"></i><i style="width:8px;height:8px;background:#e8590c;border-radius:50%;display:inline-block;margin-right:4px"></i>';
  if(r.type==='netmin'||r.type==='score') return '<i style="width:24px;height:9px;background:linear-gradient(90deg,#2b8a3e,#ffd43b,#e03131);border-radius:2px;display:inline-block;margin-right:6px;vertical-align:middle"></i>';
  if(r.type==='bts') return '<i style="width:8px;height:8px;background:#e8590c;border-radius:50%;display:inline-block;margin-right:1px"></i><i style="width:8px;height:8px;background:#7048e8;border-radius:50%;display:inline-block;margin-right:4px"></i>';
  return '<i style="width:9px;height:9px;background:'+c+';border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle"></i>';
}
function buildMapLegend(){
  const box=document.getElementById('mapLegendBody'); if(!box)return;
  let h='';
  // choropleta
  if(curMetric){
    if(curMetric.kind==='bivar'){
      h+='<div style="font-weight:600;font-size:11px">'+curMetric.label+'</div>';
      h+='<div style="display:flex;margin:3px 0 7px">';
      for(let r=0;r<3;r++){h+='<div>';for(let c=0;c<3;c++)h+='<i style="width:11px;height:10px;display:block;background:'+BIVAR_COLORS[r][c]+'"></i>';h+='</div>';}
      h+='<span style="font-size:9px;color:#9fb1c1;align-self:flex-end;margin-left:4px">młodzież→<br>↑deficyt</span></div>';
    } else {
      const vals=DZ.features.map(f=>metricValue(curMetric,f.properties.numer,curYear)).filter(v=>v!=null);
      const mn=Math.min(...vals),mx=Math.max(...vals);
      h+='<div style="font-weight:600;font-size:11px">'+curMetric.label.replace(/^[^ ]*\s/,'')+(curMetric.unit?' ('+curMetric.unit+')':'')+'</div>';
      h+='<div style="margin:3px 0 1px"><i style="width:100%;height:9px;display:block;border-radius:2px;background:linear-gradient(90deg,'+rampColor(0,curMetric.ramp)+','+rampColor(1,curMetric.ramp)+')"></i></div>';
      h+='<div style="display:flex;justify-content:space-between;color:#9fb1c1;font-size:9.5px;margin-bottom:6px"><span>'+fmtVal(mn)+'</span><span>'+fmtVal(mx)+'</span></div>';
    }
  }
  // aktywne warstwy
  const act=REG.filter(r=>layers[r.id]&&MAP.hasLayer(layers[r.id]));
  if(act.length){
    h+='<div style="border-top:1px solid #2a3b4a;padding-top:5px;font-size:9.5px;color:#9fb1c1;margin-bottom:3px">WARSTWY</div>';
    act.forEach(r=>{h+='<div style="padding:1px 0;line-height:1.4">'+legendSymbol(r)+'<span>'+r.label.replace(/^[^\wąćęłńóśźż]+\s?/i,'').replace(/\s*\([^)]*\)$/,'')+'</span></div>';});
  }
  const offAct=OFFICIAL.filter(o=>officialLayers[o.id]&&MAP.hasLayer(officialLayers[o.id]));
  if(offAct.length){
    h+='<div style="border-top:1px solid #2a3b4a;padding-top:5px;font-size:9.5px;color:#9fb1c1;margin:4px 0 3px">URZĘDOWE</div>';
    offAct.forEach(o=>{h+='<div style="padding:1px 0;line-height:1.4;font-size:11px">'+o.label.replace(/\s*\([^)]*\)$/,'')+'</div>';});
  }
  if(satOverlay&&MAP.hasLayer(satOverlay)) h+='<div style="padding:2px 0;font-size:11px">🛰 Zieleń satelitarna (WorldCover)</div>';
  box.innerHTML=h||'<span class="muted" style="font-size:10px">Brak aktywnych warstw</span>';
}
function applyOverlayOpacity(){
  REG.forEach(r=>{const L_=layers[r.id]; if(!L_||!MAP.hasLayer(L_))return;
    try{ L_.setStyle&&L_.setStyle({fillOpacity:overlayOpacity, opacity:Math.min(1,overlayOpacity+0.1)}); }catch(e){} });
}

// ---------- szkoły z analizą otoczenia ----------
function schoolLayer(gj){
  const wsk = dataCache['szkoly_wskazniki'];
  return L.geoJSON(gj,{renderer:CANVAS,
    style:f=>{const col=classifySchool(f.properties||{})[1];return {color:col,weight:1.5,fillColor:col,fillOpacity:.4};},
    pointToLayer:(f,ll)=>{
      const col=classifySchool(f.properties||{})[1];
      return L.circleMarker(ll,{radius:5,color:'#0b121a',weight:.7,fillColor:col,fillOpacity:.95});},
    onEachFeature:(f,l)=>{const p=f.properties||{};
      let w=null;
      if(wsk){const c=f.geometry.coordinates;
        w=wsk.features.find(x=>Math.abs(x.geometry.coordinates[0]-c[0])<1e-6 && Math.abs(x.geometry.coordinates[1]-c[1])<1e-6);}
      let html=genericPopup(p,{label:'Szkoła',grp:'Usługi i młodzież'});
      if(w){const q=w.properties;html+='<div style="border-top:1px solid #2a3b4a;margin-top:6px;padding-top:5px">'+
        '<b style="font-size:11px;color:#39b54a">OTOCZENIE (analiza)</b><table style="margin-top:3px">'+
        '<tr><td>do zieleni</td><td><b>'+q.do_zieleni_m+' m</b></td></tr>'+
        '<tr><td>do sportu</td><td>'+q.do_sportu_m+' m</td></tr>'+
        '<tr><td>do placu zabaw</td><td>'+q.do_placu_zabaw_m+' m</td></tr>'+
        '<tr><td>przystanki ≤400 m</td><td>'+q.przystanki_400m+'</td></tr>'+
        '<tr><td>apteka/lekarz</td><td>'+q.do_apteki_lekarza_m+' m</td></tr></table></div>';}
      l.bindPopup(html,{maxWidth:300});}});
}

// ---------- ładowanie ----------
let selDistrict=null, yearVal=null;
const DATE='25.06.2026';

async function fetchJSON(f){ try{const r=await fetch('dane/'+f); if(!r.ok)return null; return await r.json();}catch(e){return null;} }

async function init(){
  yearVal=document.getElementById('yearVal');
  document.getElementById('dataDate').textContent=DATE+' (OSM) / 2017–2026 (ArcGIS)';
  // core
  DZ=await fetchJSON('dzielnice_wskazniki.geojson');
  DEMO=await fetchJSON('demografia.json');
  GREEN=await fetchJSON('podsumowanie_analiza.json');
  M15=await fetchJSON('podsumowanie15.json');
  SAT=await fetchJSON('worldcover_dzielnice.json');
  ECON=await fetchJSON('ekonomia.json');
  EDU=await fetchJSON('dostepnosc_edukacja.json');
  STRAT=await fetchJSON('strategia_analiza.json');
  SIEC=await fetchJSON('dostepnosc_siec.json');
  WERYF=await fetchJSON('weryfikacja_zielen.json');
  ZASIEG=await fetchJSON('podsumowanie_zasieg.json');
  dataCache['szkoly_wskazniki']=await fetchJSON('szkoly_wskazniki.geojson');
  await setupSatellite();

  // metric selector
  const ms=document.getElementById('metric'); metricSel=ms;
  METRICS.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=m.label+(m.unit?' ['+m.unit+']':'');ms.appendChild(o);});
  ms.value=4; curMetric=METRICS[4]; // zieleń urządz./os domyślnie
  const mp=new URLSearchParams(location.search).get('metric');
  if(mp!=null && METRICS[+mp]){ ms.value=+mp; curMetric=METRICS[+mp]; }
  ms.onchange=()=>{curMetric=METRICS[ms.value];toggleYear();drawChoropleth();};

  // year slider
  const yr=document.getElementById('year');
  yr.oninput=()=>{curYear=+yr.value;drawChoropleth();};
  document.getElementById('play').onclick=animate;
  const cop=document.getElementById('choroOpacity'); if(cop) cop.oninput=()=>{choroOpacity=cop.value/100; drawChoropleth();};
  const sv=document.getElementById('showValues'); if(sv){ sv.onchange=()=>{showValues=sv.checked; drawChoropleth();}; if(location.search.includes('values')){showValues=true;sv.checked=true;} }
  const oop=document.getElementById('overlayOpacity'); if(oop) oop.oninput=()=>{overlayOpacity=oop.value/100; applyOverlayOpacity();};

  computeComposite();
  if(DZ) drawChoropleth();
  toggleYear();

  // warstwy — ładuj asynchronicznie
  buildLayerControl();
  setupOfficial();
  buildStory();
  buildMapControls();
  for(const r of REG){ loadOverlay(r); }

  fillPanels();
  {const cp=new URLSearchParams(location.search).get('card'); if(cp!=null) setTimeout(()=>showScorecard(parseInt(cp)||1),600);}
  {const bp=new URLSearchParams(location.search).get('base'); if(bp){ const opt=[...baseSel.options].find(o=>o.textContent.toLowerCase().includes(bp.toLowerCase())); if(opt){baseSel.value=opt.textContent; setBase(opt.textContent);} }}
  {const ip=new URLSearchParams(location.search).get('iso'); if(ip){const [la,lo]=ip.split(',').map(Number); if(la&&lo){isoMode=true; setTimeout(()=>runIso({lat:la,lng:lo}),900);}}}
  const badge=document.getElementById('mapBadge');
  if(badge) badge.innerHTML = GREEN ?
    '<b>'+(GREEN.zielen_dostepna_m2_na_os)+' m²</b> zieleni urządz./mieszk. · <b>'+GREEN.dostepnosc_300m_proc+'%</b> w zasięgu 300 m · <b>'+GREEN.puste_plamy_punkty+'</b> pustych plam' : 'Dane częściowe';
}

// ---------- satelita ----------
let satOverlay=null;
async function setupSatellite(){
  const b=await fetchJSON('worldcover_bounds.json');
  if(b){
    satOverlay=L.imageOverlay('dane/worldcover_green.png',
      [[b.south,b.west],[b.north,b.east]], {opacity:0.7, interactive:false});
    // dodatkowy podkład Sentinel-2 (EOX) do listy podkładów
    bases['Sentinel-2 cloudless (EOX)']=L.tileLayer(
      'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
      {maxZoom:16, attribution:'Sentinel-2 cloudless © EOX'});
    const o=document.createElement('option');o.textContent='Sentinel-2 cloudless (EOX)';baseSel.appendChild(o);
    // legenda
    let lg='<b>Zieleń z satelity (ESA WorldCover 10 m)</b><div style="margin:6px 0">';
    Object.entries(b.legenda_veg).forEach(([k,name])=>{const c=b.kolory[k];
      lg+='<div><i style="background:rgb('+c.join(',')+')"></i>'+name+'</div>';});
    lg+='</div>';
    const le=document.getElementById('satLegend'); if(le)le.innerHTML=lg;
  }
  const cb=document.getElementById('satOv');
  if(cb) cb.onchange=()=>{ if(!satOverlay)return; cb.checked?satOverlay.addTo(MAP):MAP.removeLayer(satOverlay); };
  const op=document.getElementById('satOpacity');
  if(op) op.oninput=()=>{ if(satOverlay)satOverlay.setOpacity(op.value/100); };
  if(location.search.includes('sat')&&satOverlay){satOverlay.addTo(MAP);if(cb)cb.checked=true;}
}

// ---------- warstwy urzędowe (WMS / ArcGIS dynamiczny) ----------
const EsriDynamic = L.TileLayer.extend({
  initialize:function(url,opts){this._url=url;L.setOptions(this,opts);L.TileLayer.prototype.initialize.call(this,url,opts);},
  getTileUrl:function(coords){
    const b=this._tileCoordsToBounds(coords);
    const nw=L.CRS.EPSG3857.project(b.getNorthWest());
    const se=L.CRS.EPSG3857.project(b.getSouthEast());
    const bbox=[nw.x,se.y,se.x,nw.y].join(',');
    const ly=(this.options.showLayers!=null)?('&layers=show:'+this.options.showLayers):'';
    return this._url+'/export?bbox='+bbox+'&bboxSR=3857&imageSR=3857&size=256,256&dpi=96&format=png32&transparent=true'+ly+'&f=image';
  }
});
function esriDyn(url,opts){return new EsriDynamic(url,Object.assign({opacity:0.6,attribution:'UM Opole (ArcGIS)'},opts));}
function esriBase(url,opts){return new EsriDynamic(url,Object.assign({opacity:1,maxZoom:21,attribution:'Ortofotomapa © UM Opole'},opts));}

const OFFICIAL = [
  {id:'of_powodz', label:'🌊 Strefy powodziowe (UM Opole)',
    make:()=>esriDyn('https://arcgisportal.um.opole.pl/server/rest/services/ogolne/zasiegi_powodzi_2022/MapServer',{opacity:0.5})},
  {id:'of_plan', label:'📐 Plan miasta / MPZP (UM Opole)',
    make:()=>esriDyn('https://arcgisportal.um.opole.pl/server/rest/services/Plany_miasta/plan_miasta_v1/MapServer',{opacity:0.65})},
  {id:'of_krajobraz', label:'🏞 Strefy uchwały krajobrazowej (UM Opole)',
    make:()=>esriDyn('https://arcgisportal.um.opole.pl/server/rest/services/Strefy_uchwa%C5%82y_krajobrazowej_MIL1/MapServer',{opacity:0.55})},
  {id:'of_dzialki', label:'📦 Działki ewidencyjne (geoportal/KIEG) — zbliż',
    make:()=>L.tileLayer.wms('https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',
      {layers:'dzialki,numery_dzialek',format:'image/png',transparent:true,version:'1.3.0',opacity:0.8,attribution:'GUGiK KIEG'})},
  {id:'of_budynki', label:'🏠 Budynki ewidencyjne (geoportal/KIEG) — zbliż',
    make:()=>L.tileLayer.wms('https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',
      {layers:'budynki',format:'image/png',transparent:true,version:'1.3.0',opacity:0.8,attribution:'GUGiK KIEG'})},
  {id:'of_ochrona', label:'🛡 Ochrona przyrody — parki, Natura 2000 (GDOŚ)',
    make:()=>L.tileLayer.wms('https://sdi.gdos.gov.pl/wms',
      {layers:'GDOS:ParkiNarodowe,GDOS:ParkiKrajobrazowe,GDOS:ObszarySpecjalnejOchrony,GDOS:ObszaryChronionegoKrajobrazu,GDOS:PomnikiPrzyrody',
       format:'image/png',transparent:true,version:'1.3.0',opacity:0.5,attribution:'GDOŚ'})},
];
const officialLayers={};
function setupOfficial(){
  // oficjalne podkłady miejskie (głęboki zoom, ground-truth do weryfikacji)
  bases['Ortofotomapa Opole 2019 (UM)']=esriBase('https://arcgisportal.um.opole.pl/server/rest/services/ortofoto/ortofotomapa_2019/MapServer');
  bases['Sentinel-2 Opole 09.2024 (UM)']=esriBase('https://arcgisportal.um.opole.pl/server/rest/services/ortofoto/Sentinel2_RGB18_09_2024/MapServer');
  ['Ortofotomapa Opole 2019 (UM)','Sentinel-2 Opole 09.2024 (UM)'].forEach(n=>{const o=document.createElement('option');o.textContent=n;baseSel.appendChild(o);});
  const box=document.getElementById('layerCtl');
  const h=document.createElement('div');h.className='grp';h.textContent='Warstwy urzędowe (na żywo)';box.appendChild(h);
  const OFCOL={of_powodz:'#4dabf7',of_plan:'#b8a44d',of_krajobraz:'#b197fc',of_dzialki:'#ced4da',of_budynki:'#f59f00',of_ochrona:'#69db7c'};
  OFFICIAL.forEach(o=>{
    const d=document.createElement('label');d.className='lyr';
    const sw='<i style="width:13px;height:10px;background:'+(OFCOL[o.id]||'#888')+'66;border:1px solid '+(OFCOL[o.id]||'#888')+';border-radius:2px;display:inline-block;margin-right:6px;vertical-align:middle"></i>';
    d.innerHTML='<input type="checkbox" id="cb_'+o.id+'">'+sw+'<span>'+o.label+'</span>';
    d.querySelector('input').onchange=e=>{
      if(!officialLayers[o.id]) officialLayers[o.id]=o.make();
      const L_=officialLayers[o.id];
      e.target.checked?L_.addTo(MAP):MAP.removeLayer(L_);
      buildMapLegend();
    };
    box.appendChild(d);
  });
  const note=document.createElement('div');note.className='small muted';note.style.marginTop='4px';
  note.textContent='Pobierane na żywo z serwerów UM Opole, GUGiK i GDOŚ. Działki/budynki widoczne po przybliżeniu.';
  box.appendChild(note);
  if(location.search.includes('testof')){['of_powodz','of_ochrona'].forEach(id=>{
    const o=OFFICIAL.find(x=>x.id===id);officialLayers[id]=o.make();officialLayers[id].addTo(MAP);
    const cb=document.getElementById('cb_'+id);if(cb)cb.checked=true;});}
}

function toggleYear(){
  const box=document.getElementById('yearBox');
  box.style.opacity = curMetric.kind==='demo'?1:.4;
  box.style.pointerEvents = curMetric.kind==='demo'?'auto':'none';
}
let animTimer=null;
function animate(){
  if(animTimer){clearInterval(animTimer);animTimer=null;document.getElementById('play').textContent='▶ Animuj 2017→2030';return;}
  document.getElementById('play').textContent='⏸ Stop';
  const yr=document.getElementById('year'); let y=2017;
  animTimer=setInterval(()=>{yr.value=y;curYear=y;drawChoropleth();y++;if(y>2030){clearInterval(animTimer);animTimer=null;document.getElementById('play').textContent='▶ Animuj 2017→2030';}},650);
}

async function loadOverlay(r){
  const gj=await fetchJSON(r.file+'.geojson');
  if(!gj||!gj.features||!gj.features.length){const cb=document.getElementById('cb_'+r.id);if(cb){cb.parentElement.style.opacity=.4;cb.disabled=true;cb.parentElement.title='brak danych';}return;}
  dataCache[r.id]=gj;
  const lyr=buildLayer(r,gj); layers[r.id]=lyr;
  const cnt=document.getElementById('cnt_'+r.id); if(cnt)cnt.textContent='('+gj.features.length+')';
  const onParam=(new URLSearchParams(location.search).get('on')||'').split(',');
  if(r.on || onParam.includes(r.id)){ lyr.addTo(MAP); try{lyr.setStyle&&lyr.setStyle({fillOpacity:overlayOpacity});}catch(_){}; const cb=document.getElementById('cb_'+r.id); if(cb)cb.checked=true; buildMapLegend(); }
}
function buildLayerControl(){
  const box=document.getElementById('layerCtl'); const groups={};
  REG.forEach(r=>{(groups[r.grp]=groups[r.grp]||[]).push(r);});
  // Strava ref toggle
  Object.keys(groups).forEach(g=>{
    const h=document.createElement('div');h.className='grp';h.textContent=g;box.appendChild(h);
    groups[g].forEach(r=>{
      const d=document.createElement('label');d.className='lyr';
      d.innerHTML='<input type="checkbox" id="cb_'+r.id+'" '+(r.on?'checked':'')+'>'+legendSymbol(r)+'<span>'+r.label+' <span class="muted" id="cnt_'+r.id+'"></span></span>';
      d.querySelector('input').onchange=e=>{const L_=layers[r.id];if(!L_)return;if(e.target.checked){L_.addTo(MAP);try{L_.setStyle&&L_.setStyle({fillOpacity:overlayOpacity});}catch(_){}}else MAP.removeLayer(L_);buildMapLegend();};
      box.appendChild(d);
    });
  });
  const h=document.createElement('div');h.className='grp';h.textContent='Referencje';box.appendChild(h);
  const d=document.createElement('label');d.className='lyr';
  d.innerHTML='<input type="checkbox" id="cb_strava"><i style="width:14px;height:10px;background:linear-gradient(90deg,#3a0ca3,#e8590c,#ffd43b);border-radius:2px;display:inline-block;margin-right:6px;vertical-align:middle"></i><span>Strava — heatmapa aktywności <span class="muted">(podgląd)</span></span>';
  d.querySelector('input').onchange=e=>{e.target.checked?strava.addTo(MAP):MAP.removeLayer(strava);};
  box.appendChild(d);
  const note=document.createElement('div');note.className='small muted';note.style.marginTop='4px';
  note.textContent='Strava: publiczny podgląd zagregowanych tras biegowych/rowerowych. Surowe dane tras = Strava Metro (dla samorządów, na wniosek).';
  box.appendChild(note);
}

// ---------- panele ----------
function fillPanels(){
  // DEMOGRAFIA
  if(DEMO){
    const c=DEMO.miasto, i=c.ludnosc.length-1;
    document.getElementById('demoCity').innerHTML=
      stat('Ludność 2026',c.ludnosc[i],'os.')+
      stat('Zmiana 2017→2026',((c.ludnosc[i]-c.ludnosc[0])>0?'+':'')+(c.ludnosc[i]-c.ludnosc[0])+' ('+(Math.round(1000*(c.ludnosc[i]-c.ludnosc[0])/c.ludnosc[0])/10)+'%)','')+
      stat('Projekcja 2030',c.ludnosc_proj[c.ludnosc_proj.length-1]+' (trend '+c.trend_ludnosc_rok+'/rok)','')+
      stat('Średni wiek',c.sr_wieku[0]+' → '+c.sr_wieku[i],'lat')+
      stat('Młodzież 0–17 (2026)',c.mlodziez[i]+' ('+c.mlodziez_proc[i]+'%)','');
    const dm=document.getElementById('demoMetric');
    [['ludnosc','Ludność'],['mlodziez','Młodzież 0–17'],['sr_wieku','Średni wiek'],['gestosc','Gęstość']].forEach(([k,l])=>{
      const o=document.createElement('option');o.value=k;o.textContent=l;dm.appendChild(o);});
    dm.onchange=drawDemoChart; drawDemoChart();
    // tabela dzielnic
    let t='<tr><th>Dz.</th><th>Ludn. 26</th><th>Δ%</th><th>Wiek</th><th>Młodz.</th></tr>';
    DEMO.dzielnice.slice().sort((a,b)=>a.numer-b.numer).forEach(d=>{
      const cls=d.zmiana_10lat_proc<0?'style="color:#ff8787"':'style="color:#69db7c"';
      t+='<tr><td>'+d.nazwa+'</td><td>'+d.ludnosc[9]+'</td><td '+cls+'>'+(d.zmiana_10lat_proc>0?'+':'')+d.zmiana_10lat_proc+'</td><td>'+d.sr_wieku[9]+'</td><td>'+(d.mlodziez[9]??'—')+'</td></tr>';
    });
    document.getElementById('demoTbl').innerHTML=t;
    document.getElementById('demoSrc').textContent='Źródło: '+DEMO.zrodlo+'. Rok 2024 dla struktury wieku odrzucony (dane niespójne). Liczby zameldowanych — GUS dla całego miasta podaje wyższą wartość (≈128 tys.).';
  }
  // ZIELEŃ
  if(GREEN){
    document.getElementById('greenStats').innerHTML=
      stat('Zieleń łącznie',GREEN.zielen_ha,'ha')+
      stat('— parki',GREEN.parki_ha,'ha')+stat('— lasy',GREEN.lasy_ha,'ha')+
      stat('— urządzona+park / mieszk.',GREEN.zielen_dostepna_m2_na_os,'m²')+
      stat('Drzewa (OSM)',GREEN.drzewa_osm,'szt.')+
      stat('Drzewa / 1000 mieszk.',GREEN.drzewa_na_1000,'');
    document.getElementById('accStats').innerHTML=
      stat('W zasięgu 300 m',GREEN.dostepnosc_300m_proc,'%')+
      stat('W zasięgu 500 m',GREEN.dostepnosc_500m_proc,'%')+
      stat('⚠ Puste plamy',GREEN.puste_plamy_punkty+' ('+GREEN.puste_plamy_proc+'%)','pkt')+
      '<div class="small muted" style="margin-top:6px">Próbki w terenach mieszkaniowych co 120 m. „Puste plamy" = >500 m od jakiejkolwiek zieleni.</div>';
  }
  if(DZ){
    let t='<tr><th>Dz.</th><th>Urządz./os</th><th>Łącznie/os</th><th>Drzewa/1k</th></tr>';
    DZ.features.map(f=>f.properties).sort((a,b)=>(a.zielen_dostepna_m2_na_os||0)-(b.zielen_dostepna_m2_na_os||0)).forEach(p=>{
      t+='<tr><td>'+p.nazwa+'</td><td>'+p.zielen_dostepna_m2_na_os+'</td><td>'+p.zielen_m2_na_os+'</td><td>'+p.drzewa_na_1000+'</td></tr>';});
    document.getElementById('greenTbl').innerHTML=t;
  }
  // 15-MIN
  if(M15){
    document.getElementById('m15Intro').innerHTML='Czy w codziennym życiu młody mieszkaniec ma w 15 min pieszo: szkołę, sklep, przystanek, zieleń, sport i opiekę zdrowotną? Analiza '+M15.probek+' punktów mieszkaniowych.';
    const a=M15.dostepnosc_15min_proc||{}, names={szkola:'Szkoła',sklep_spoz:'Sklep spożywczy',apteka_lekarz:'Apteka/lekarz',przystanek:'Przystanek',zielen:'Zieleń',sport:'Sport'};
    let h=stat('Pełne 15-min miasto (6/6)',M15.proc_pelne_15min_miasto,'%');
    Object.keys(names).forEach(k=>{if(a[k]!=null)h+=bar(names[k],a[k]);});
    document.getElementById('m15Stats').innerHTML=h;
    const dd=M15.srednia_odleglosc_m||{};
    document.getElementById('m15Dist').innerHTML=
      Object.keys(names).map(k=>dd[k]!=null?stat(names[k],dd[k],'m'):'').join('');
    // szkoły
    const sw=dataCache['szkoly_wskazniki'];
    if(sw&&sw.features.length){
      const f=sw.features.map(x=>x.properties);
      const avg=(arr)=>Math.round(arr.filter(v=>v!=null).reduce((s,v)=>s+v,0)/arr.filter(v=>v!=null).length);
      document.getElementById('schoolStats').innerHTML=
        stat('Szkół przeanalizowanych',f.length,'')+
        stat('Śr. odległość do zieleni',avg(f.map(x=>x.do_zieleni_m)),'m')+
        stat('Śr. odległość do sportu',avg(f.map(x=>x.do_sportu_m)),'m')+
        stat('Śr. przystanków ≤400 m',Math.round(10*f.reduce((s,x)=>s+(x.przystanki_400m||0),0)/f.length)/10,'');
    } else document.getElementById('schoolStats').innerHTML='<span class="muted small">Brak danych analizy szkół.</span>';
  } else {
    document.getElementById('m15Intro').innerHTML='<span class="muted">Analiza 15-min jeszcze się liczy lub dane POI niekompletne — odśwież po pobraniu.</span>';
  }
  fillSatellite();
  fillEconomy();
  fillEdu();
  fillAnalizy();
  fillWeryf();
  fillObjasnienia();
  fillWnioski();
  fillHelp();
  fillProvenance();
}
function fillWnioski(){
  const kel=document.getElementById('wnKey'); if(!kel)return;
  const card=(ico,t,b)=>'<div class="kard" style="display:flex;gap:10px;align-items:flex-start"><div style="font-size:22px">'+ico+'</div><div><b>'+t+'</b><div class="small" style="margin-top:2px">'+b+'</div></div></div>';
  let h='';
  if(DEMO){const c=DEMO.miasto,d=c.ludnosc[9]-c.ludnosc[0];
    h+=card('📉','Ludność maleje i się starzeje','Spadek '+fmtVal(d)+' os. (2017→26, '+Math.round(1000*d/c.ludnosc[0])/10+'%), średni wiek '+c.sr_wieku[0]+'→'+c.sr_wieku[9]+' lat. Projekcja 2030: ~'+fmtVal(c.ludnosc_proj.at(-1))+'. Strategia musi planować pod mniejszą, starszą populację.');}
  if(GREEN&&SIEC){
    h+=card('🌳','Zieleni jest dużo, dostęp niemal pełny','W granicach miasta '+GREEN.dostepnosc_300m_proc+'% terenów mieszkalnych ma zieleń w 300 m, tylko '+GREEN.puste_plamy_punkty+' „pusta plama”. Mediana dojścia po sieci: '+SIEC.siec_mediana_min.zielen+' min. Problem to nie ilość, lecz JAKOŚĆ i OCHRONA zieleni.');}
  if(WERYF){const g=WERYF.globalne;
    h+=card('⚠️','Połowa zieleni jest niechroniona planem',g.zielen_poza_strefami_proc+'% faktycznej zieleni leży poza strefami zieleni Planu Ogólnego, a tylko '+g.SN_faktycznie_zielone_proc+'% stref zieleni jest faktycznie zielone. To kluczowy temat: chronić istniejącą zieleń i zagospodarować strefy.');}
  if(SIEC&&EDU){
    h+=card('🍼','Żłobki to największa luka dostępności','Mediana dojścia pieszo do żłobka: '+SIEC.siec_mediana_min.zlobek+' min (do przedszkola '+SIEC.siec_mediana_min.przedszkole+', do sklepu '+SIEC.siec_mediana_min.sklep+'). Tylko '+EDU.liczba_placowek.zlobek+' żłobki w danych — pilne dla młodych rodzin.');}
  if(STRAT){const s=STRAT.indeks_deprywacji.slice().sort((a,b)=>(b.priorytet_rownosci||0)-(a.priorytet_rownosci||0));
    h+=card('🎯','Priorytet inwestycji: dzielnice '+s[0].nazwa+', '+s[1].nazwa,'Najwyższy priorytet równości (deprywacja ważona młodzieżą): '+s[0].nazwa+' ('+s[0].priorytet_rownosci+'), '+s[1].nazwa+' ('+s[1].priorytet_rownosci+'). Tam inwestycje dadzą największy efekt dla młodzieży.');}
  if(ZASIEG){
    h+=card('📡','Białe plamy zasięgu na peryferiach',ZASIEG.biale_plamy_proc+'% terenów mieszkalnych jest >1 km od stacji BTS (mediana '+ZASIEG.mediana_do_bts_m+' m). Słabszy zasięg telekomunikacyjny dotyka peryferii — istotne dla młodych „bez telefonu i hałasu”, ale i dla nauki/pracy zdalnej.');}
  if(ECON){const cw=ECON.ceny_mieszkan_zl_m2.wolny_rynek,w=ECON.wynagrodzenia.brutto_zl;const lp=cw.at(-1),fp=cw[0];
    h+=card('💰','Mieszkanie poza zasięgiem młodych','Mediana '+fmtVal(lp[1])+' zł/m² (+'+Math.round(100*(lp[1]-fp[1])/fp[1])+'% od '+fp[0]+'). Pensja '+fmtVal(w.at(-1)[1])+' zł „kupuje” ~'+(w.at(-1)[1]/lp[1]).toFixed(2)+' m²/mies. Mieszkalnictwo/najem to tło każdej decyzji o zatrzymaniu młodych.');}
  kel.innerHTML=h;
  document.getElementById('wnRec').innerHTML=
    '<div class="kard">1. <b>Chronić i zagospodarować zieleń</b> — wpisać faktyczną zieleń w strefy planu (50% jest poza), urządzić niezagospodarowane strefy SN.<br>'+
    '2. <b>Żłobki i opieka</b> — to najpilniejsza luka dostępności dla młodych rodzin.<br>'+
    '3. <b>Zazielenianie tam, gdzie młodzież + deficyt</b> (priorytet równości) — nie równo, lecz sprawiedliwie.<br>'+
    '4. <b>Drzewa w gęstym centrum</b> — cień i adaptacja do upałów.<br>'+
    '5. <b>Jakość, nie tylko ilość</b> — „strefy bez telefonu i hałasu”, ławki, woda, miejsca spotkań młodzieży.<br>'+
    '6. <b>Pozyskać dane</b> — patrz niżej, by kolejne decyzje były jeszcze pewniejsze.</div>';
  document.getElementById('wnGaps').innerHTML=
    tableGaps();
}
function tableGaps(){
  const rows=[
    ['Stan techniczny obiektów','place zabaw, boiska, parki — czy bezpieczne/sprawne','rejestry MZD/MOSiR + audyt terenowy','wysoki'],
    ['Rejony szkół podstawowych','obwody szkolne (uchwała Rady Miasta)','UM Opole — warstwa GIS','średni'],
    ['Realny zasięg/pokrycie sieci','pokrycie LTE/5G per operator (nie tylko lokalizacje BTS)','UKE internet.gov.pl / operatorzy','średni'],
    ['Trasy aktywności młodzieży','gdzie młodzież realnie biega/jeździa/spotyka się','Strava Metro (na wniosek samorządu)','wysoki'],
    ['Natężenie ruchu / hałas','obciążenie ulic, strefy ciszy','mapy hałasu UM Opole 2022 + liczniki MZD','średni'],
    ['Ceny gruntów per działka','wyceny pod inwestycje','RCiWN / geoportal (na wniosek)','niski'],
    ['Frekwencja / popularne godziny','kiedy miejsca są używane','brak otwartego API (Google/Apple zastrzeżone)','niski'],
    ['Dane z poprzednich spotkań strategii','zdrowie psychiczne, edukacja, kultura/sport','własne notatki/strategie — powiązać warstwowo','wysoki'],
  ];
  let t='<table class="tbl"><tr><th>Czego brakuje</th><th>Po co</th><th>Skąd pozyskać</th></tr>';
  rows.forEach(r=>{const c=r[3]==='wysoki'?'#ff8787':r[3]==='średni'?'#ffa94d':'#9fb1c1';
    t+='<tr><td><b style="color:'+c+'">●</b> '+r[0]+'</td><td class="small">'+r[1]+'</td><td class="small">'+r[2]+'</td></tr>';});
  t+='</table><div class="small muted" style="margin-top:5px">● czerwony = wysoki priorytet pozyskania. Pełny rejestr źródeł i luk — zakładka Źródła.</div>';
  return t;
}
const KIND_SRC={demo:'ArcGIS UM Opole (demografia)',green:'OpenStreetMap (przycięte do dzielnic)',
  sat:'ESA WorldCover (satelita)',index:'Analiza własna',strat:'Analiza własna (sieć)',
  bivar:'Analiza własna',weryf:'OSM + satelita + Plan Ogólny',zasieg:'SI2PEM + analiza własna'};
function fillObjasnienia(){
  const intro=document.getElementById('objIntro'); if(!intro)return;
  intro.innerHTML='Ta mapa zbiera publiczne, weryfikowalne dane o Opolu pod Strategię Młodzieżową (Obszar 7). '+
    'Poniżej objaśniono <b>każdy wskaźnik, warstwę, pojęcie i źródło</b> — tak, by każdy, kto dostanie tę mapę, '+
    'rozumiał, na co patrzy, skąd to pochodzi i jak zostało policzone.';
  // wskaźniki
  let t='<table class="tbl"><tr><th>Wskaźnik</th><th>Jedn.</th><th>Źródło</th></tr>';
  METRICS.forEach(m=>{ t+='<tr><td title="'+(METRIC_DESC[m.key]||'').replace(/"/g,"'")+'"><b>'+m.label.replace(/^[^ ]*\s/,'')+'</b><div class="small muted">'+(METRIC_DESC[m.key]||'')+'</div></td><td>'+(m.unit||'—')+'</td><td class="small">'+(KIND_SRC[m.kind]||'—')+'</td></tr>'; });
  t+='</table>'; document.getElementById('objMetrics').innerHTML=t;
  // warstwy (grupowane)
  const groups={}; REG.forEach(r=>{(groups[r.grp]=groups[r.grp]||[]).push(r);});
  let lh='';
  Object.keys(groups).forEach(g=>{ lh+='<div class="grp" style="margin-top:8px">'+g+' <span class="muted" style="text-transform:none">— '+(GRP_SRC[g]||'')+'</span></div>';
    groups[g].forEach(r=>{ lh+='<div class="small" style="padding:2px 0;border-bottom:1px dashed var(--line)">'+r.label+'</div>'; }); });
  lh+='<div class="grp" style="margin-top:8px">Warstwy urzędowe (na żywo)</div>';
  OFFICIAL.forEach(o=>{ lh+='<div class="small" style="padding:2px 0;border-bottom:1px dashed var(--line)">'+o.label+'</div>'; });
  document.getElementById('objLayers').innerHTML=lh;
  // pojęcia
  document.getElementById('objConcepts').innerHTML=CONCEPTS.map(c=>'<div class="kard" style="padding:8px 10px"><b>'+c[0]+'</b><br><span class="small">'+c[1]+'</span></div>').join('');
  // źródła
  let sh='<table class="tbl"><tr><th>Źródło</th><th>Zakres</th><th>Data</th></tr>';
  SOURCES_FULL.forEach(s=>{ sh+='<tr><td><b>'+s[0]+'</b><div class="small muted">'+s[4]+' · '+s[3]+'</div></td><td class="small">'+s[1]+'</td><td class="small">'+s[2]+'</td></tr>'; });
  sh+='</table>'; document.getElementById('objSources').innerHTML=sh;
}
function fillWeryf(){
  const el=document.getElementById('weryfIntro'); if(!el)return;
  if(!WERYF){el.innerHTML='<span class="muted">Brak danych (uruchom weryfikacja.py).</span>';return;}
  const g=WERYF.globalne;
  el.innerHTML='Porównujemy trzy <b>niezależne</b> źródła zieleni, by sprawdzić, czy dane pokrywają się z rzeczywistością i gdzie są błędy.';
  document.getElementById('weryfGlob').innerHTML=
    stat('🏛 Strefy zieleni SN (Plan Ogólny)', g.strefa_SN_ha, 'ha ('+g.strefa_SN_proc_miasta+'%)')+
    stat('🛰 Zieleń faktyczna (satelita)', g.satelita_zielen_ha, 'ha ('+g.satelita_zielen_proc+'%)')+
    stat('Strefy SN faktycznie zielone', g.SN_faktycznie_zielone_proc, '%')+
    stat('⚠ Zieleń POZA strefami zieleni', g.zielen_poza_strefami_proc, '%')+
    '<div class="small muted" style="margin-top:5px">Prawie połowa faktycznej zieleni nie leży w strefie o funkcji zieleni — potencjalnie niechroniona planem.</div>';
  let t='<tr><th>Dz.</th><th>🏛 plan</th><th>🛰 sat</th><th>🗺 OSM</th><th>poza strefami</th></tr>';
  WERYF.dzielnice.slice().sort((a,b)=>(b.zielen_poza_strefami_proc||0)-(a.zielen_poza_strefami_proc||0)).forEach(d=>{
    const v=d.zielen_poza_strefami_proc; const c=v>=25?'#ff8787':v>=18?'#ffa94d':'#69db7c';
    t+='<tr><td>'+d.nazwa+'</td><td>'+(d.plan_SN_proc??'—')+'%</td><td>'+(d.satelita_zielen_proc??'—')+'%</td><td>'+(d.osm_zielen_proc??'—')+'%</td><td style="color:'+c+'"><b>'+(v??'—')+'%</b></td></tr>';});
  document.getElementById('weryfTbl').innerHTML=t;
  document.getElementById('weryfErr').innerHTML=
    '<b>OSM (🗺):</b> niemal wszędzie pokazuje MNIEJ zieleni niż satelita — <i>niedoszacowanie</i> (nie każdy teren zmapowany). Nasz wskaźnik OSM/os jest więc dolnym oszacowaniem.<br><br>'+
    '<b>Plan Ogólny (🏛):</b> strefy SN to <i>przeznaczenie</i>, nie pomiar — '+WERYF.globalne.SN_faktycznie_zielone_proc+'% z nich jest faktycznie zielone (reszta to ścieżki/dozwolona zabudowa). '+
    'I odwrotnie: '+WERYF.globalne.zielen_poza_strefami_proc+'% realnej zieleni jest poza strefami zieleni — do rozważenia ochrona.<br><br>'+
    '<b>Satelita (🛰):</b> mierzy faktyczne pokrycie roślinnością (10 m), ale nie rozróżnia jakości/dostępności (las ≠ park dla młodzieży).<br><br>'+
    '<b>Wniosek do dyskusji:</b> łączcie źródła — satelita do pomiaru, plan do ochrony, OSM/teren do jakości. Rozbieżności to nie błąd jednego źródła, lecz <b>różne pytania</b>.';
  document.getElementById('weryfSrc').textContent=WERYF.uwaga+' Źródła: '+Object.values(WERYF.zrodla).join(' · ');
}
let SIEC=null;
function fillAnalizy(){
  const el=document.getElementById('anSiec'); if(!el)return;
  if(SIEC){
    const s=SIEC.siec_mediana_min, S=SIEC;
    el.innerHTML='Liczymy dystanse po <b>rzeczywistej sieci pieszej</b> (drogi, chodniki), nie w linii prostej — to uwzględnia bariery (Odra, tory).<br><br>'+
      '<b>Realna droga jest średnio '+S.wsp_nadlozenia_srednia+'× dłuższa</b> niż linia prosta (p90 = '+S.wsp_nadlozenia_p90+'×). '+
      'Dlatego proste odległości zaniżają — tu są skorygowane.<br><br>'+
      'Mediana czasu pieszo: żłobek <b>'+s.zlobek+' min</b> · przedszkole '+s.przedszkole+' · podstawowa '+s.podstawowa+' · '+
      'sklep '+s.sklep+' · przystanek '+s.przystanek+' · zieleń '+s.zielen+' min.';
  } else el.innerHTML='<span class="muted">Brak danych sieciowych (uruchom analiza_siec.py).</span>';
  if(STRAT){
    let t='<tr><th>Dz.</th><th>Deprywacja</th><th>Priorytet</th><th>Pewność</th></tr>';
    STRAT.indeks_deprywacji.slice().sort((a,b)=>(b.deprywacja||0)-(a.deprywacja||0)).forEach(d=>{
      const c=d.deprywacja>=60?'#ff8787':d.deprywacja>=40?'#ffa94d':'#69db7c';
      t+='<tr><td>'+d.nazwa+'</td><td style="color:'+c+'"><b>'+d.deprywacja+'</b></td><td>'+(d.priorytet_rownosci??'—')+'</td><td class="muted">'+(d.pewnosc||'—')+'</td></tr>';});
    document.getElementById('anDeprTbl').innerHTML=t;
    const L=STRAT.lokalizacje;
    document.getElementById('anSiting').innerHTML=
      '<b>Żłobki:</b> '+L.zlobki_nieobjete_punkty+' punktów mieszkalnych poza zasięgiem ~12 min pieszo. '+
      'Algorytm wskazał <b>'+L.zlobki_sugestie+' lokalizacji</b> (warstwa „💡 Sugerowane nowe żłobki").<br><br>'+
      '<b>Parki/skwery:</b> '+L.parki_nieobjete_punkty+' punktów >~7 min od zieleni → <b>'+L.parki_sugestie+' lokalizacji</b> (warstwa „💡 Sugerowane nowe parki").<br><br>'+
      '<span class="muted">Włącz te warstwy na mapie (grupa „Analizy strategiczne"). To wskazówki kierunkowe — do weryfikacji z planem miasta i własnością gruntów.</span>';
    document.getElementById('anSrc').textContent='Metoda: '+STRAT.metoda;
  }
  if(ZASIEG){
    const z=ZASIEG; const wc=z.dzielnice.slice().sort((a,b)=>(b.srednia_do_bts_m||0)-(a.srednia_do_bts_m||0))[0];
    const el=document.getElementById('anSiting');
    if(el) el.innerHTML+='<div style="border-top:1px solid var(--line);margin-top:10px;padding-top:8px"><b>📡 Zasięg telekomunikacyjny (SI2PEM):</b> '+
      z.stacji_bts+' stacji BTS wszystkich operatorów. Mediana do najbliższej: <b>'+z.mediana_do_bts_m+' m</b>. '+
      '<b>Białe plamy</b> (>1 km od BTS): '+z.biale_plamy_powyzej_1km+' punktów ('+z.biale_plamy_proc+'% terenów). '+
      'Najsłabiej: <b>dz. '+wc.nazwa+'</b> (śr. '+wc.srednia_do_bts_m+' m, max '+wc.max_do_bts_m+' m). '+
      '<span class="muted">Warstwy: „📡 Stacje BTS" i „⚠ Białe plamy zasięgu". To proxy — realny zasięg zależy od mocy/pasma/anten.</span></div>';
  }
}
let EDU=null;
function fillEdu(){
  const intro=document.getElementById('eduIntro'); if(!intro)return;
  if(!EDU){intro.innerHTML='<span class="muted">Brak danych (uruchom edukacja.py).</span>';return;}
  const order=['zlobek','przedszkole','podstawowa','srednia','wyzsza','sklep_pierwszej'];
  const col={zlobek:'#e64980',przedszkole:'#4dabf7',podstawowa:'#1971c2',srednia:'#f08c00',wyzsza:'#7048e8',sklep_pierwszej:'#f76707'};
  intro.innerHTML='Odległość pieszo (mediana) do najbliższej placówki każdego typu. Żłobki to największa luka — '+
    'tylko '+EDU.liczba_placowek.zlobek+' placówek w danych (możliwe niedoszacowanie w OSM).';
  let t='<tr><th>Poziom</th><th>Mediana</th><th>Średnia</th><th>≤800 m</th><th>Liczba</th></tr>';
  order.forEach(k=>{const dot='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+col[k]+';margin-right:5px"></span>';
    t+='<tr><td>'+dot+EDU.kategorie[k]+'</td><td><b>'+(EDU.mediana_m[k]??'—')+' m</b></td><td>'+(EDU.srednia_m[k]??'—')+' m</td><td>'+(EDU.w_800m_proc[k]??'—')+'%</td><td>'+EDU.liczba_placowek[k]+'</td></tr>';});
  document.getElementById('eduTbl').innerHTML=t;
}
let ECON=null;
function fillEconomy(){
  if(!ECON){const el=document.getElementById('ekonMieszk');if(el)el.innerHTML='<span class="muted small">Brak danych (uruchom ekonomia.py).</span>';return;}
  const cw=ECON.ceny_mieszkan_zl_m2.wolny_rynek||[];
  const wage=ECON.wynagrodzenia.brutto_zl||[];
  const lastP=cw.length?cw[cw.length-1]:null, firstP=cw.length?cw[0]:null;
  const lastW=wage.length?wage[wage.length-1]:null;
  // dostępność: m² za miesięczną pensję brutto; lata na 50 m² (pensja netto ~0.72)
  let aff='';
  if(lastP&&lastW){
    const m2perMonth=(lastW[1]/lastP[1]);
    const net=lastW[1]*0.72; const flat50=lastP[1]*50; const years=flat50/(net*12);
    aff=stat('m² za 1 miesięczną pensję brutto', m2perMonth.toFixed(2),'m²')+
        stat('Lata pracy na 50 m² (netto, bez kosztów życia)', years.toFixed(1),'lat');
  }
  document.getElementById('ekonMieszk').innerHTML=
    (lastP?stat('Cena mieszkania (mediana, wolny rynek)', lastP[1].toLocaleString('pl'), 'zł/m² ('+lastP[0]+')'):'')+
    (firstP&&lastP?stat('Wzrost '+firstP[0]+'→'+lastP[0], '+'+Math.round(100*(lastP[1]-firstP[1])/firstP[1]),'%'):'')+
    aff;
  document.getElementById('ekonPlace').innerHTML=
    (lastW?stat('Przeciętne wynagrodzenie brutto', lastW[1].toLocaleString('pl'), 'zł ('+lastW[0]+')'):'')+
    ((ECON.wynagrodzenia.relacja_do_kraju_proc||[]).slice(-1).map(x=>stat('Relacja do średniej krajowej',x[1],'%')).join(''));
  // firmy
  const fw=ECON.firmy_wg_wielkosci||{};
  const pick=(k)=>{const s=fw[k];return s&&s.length?s[s.length-1][1]:null;};
  const tot=pick('ogółem'), micro=pick('0 - 9'), small=pick('10 - 49'), med=pick('50 - 249'),
        big=pick('250 - 999'), xbig=pick('1000 i więcej');
  let fh = tot?stat('Firmy ogółem (REGON)', tot.toLocaleString('pl'),''):'';
  if(tot&&micro) fh+=bar('Mikro (0–9)', Math.round(100*micro/tot));
  if(tot&&small) fh+=bar('Małe (10–49)', Math.round(100*small/tot));
  if(tot&&(med||big||xbig)) fh+=bar('Średnie+duże (50+)', Math.round(100*((med||0)+(big||0)+(xbig||0))/tot));
  fh+='<div class="small muted" style="margin-top:4px">Duże (250+): '+((big||0)+(xbig||0))+' firm.</div>';
  document.getElementById('ekonFirmy').innerHTML=fh;
  document.getElementById('ekonSrc').textContent='Źródło: '+ECON.zrodlo+' — '+ECON.jednostka+'. Ceny gruntów per działka: RCiWN/geoportal (na wniosek). Dostępność liczona szacunkowo.';
  drawEkonChart();
}
function drawEkonChart(){
  if(!ECON)return; const svg=document.getElementById('ekonChart'); if(!svg)return;
  const cw=ECON.ceny_mieszkan_zl_m2.wolny_rynek||[]; if(!cw.length){svg.innerHTML='';return;}
  const W=svg.clientWidth||340,H=96,pad=8;
  const vals=cw.map(x=>x[1]); const mn=Math.min(...vals),mx=Math.max(...vals);
  const X=i=>pad+(W-2*pad)*i/(cw.length-1||1);
  const Y=v=>H-pad-(H-2*pad)*((v-mn)/((mx-mn)||1));
  let p='';cw.forEach((x,i)=>{p+=(p?'L':'M')+X(i).toFixed(1)+' '+Y(x[1]).toFixed(1)+' ';});
  let dots='';cw.forEach((x,i)=>{dots+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(x[1]).toFixed(1)+'" r="2.5" fill="#f59f00"/>';});
  svg.innerHTML='<path d="'+p+'" fill="none" stroke="#f59f00" stroke-width="2"/>'+dots;
  document.getElementById('ekonChartCap').textContent=cw[0][0]+': '+cw[0][1].toLocaleString('pl')+' zł/m² → '+cw[cw.length-1][0]+': '+cw[cw.length-1][1].toLocaleString('pl')+' zł/m²';
}
function fillSatellite(){
  if(!SAT){document.getElementById('satIntro').innerHTML='<span class="muted">Brak danych satelitarnych (uruchom satelita.py).</span>';return;}
  const g=SAT.globalne;
  document.getElementById('satIntro').innerHTML=
    'Niezależny obraz zieleni z satelitów Sentinel (ESA WorldCover 10 m, 2021). Dla całego obszaru: '+
    '<b>'+g.drzewa_proc+'%</b> drzew, <b>'+g.trawy_krzewy_proc+'%</b> traw/krzewów, '+
    '<b>'+g.zabudowa_proc+'%</b> zabudowy. To <b>drugi, niezależny zbiór</b> — pokazuje zieleń, której nie ma w OSM.';
  let t='<tr><th>Dz.</th><th>Satelita</th><th>Drzewa</th><th>OSM</th><th>OSM gubi</th></tr>';
  SAT.dzielnice.slice().sort((a,b)=>(b.roznica_sat_minus_osm||-99)-(a.roznica_sat_minus_osm||-99)).forEach(d=>{
    const gap=d.roznica_sat_minus_osm;
    const cls=gap>0?'style="color:#ff8787"':'style="color:#69db7c"';
    t+='<tr><td>'+d.nazwa+'</td><td>'+d.sat_zielen_proc+'%</td><td>'+d.sat_drzewa_proc+'%</td><td>'+(d.osm_zielen_proc??'—')+'%</td><td '+cls+'>'+(gap>0?'+':'')+(gap??'—')+'</td></tr>';
  });
  document.getElementById('satTbl').innerHTML=t;
  document.getElementById('satSrc').textContent='Źródło: '+SAT.zrodlo+'. „OSM gubi" = pokrycie z satelity minus zmapowane w OSM (w pkt proc. powierzchni dzielnicy).';
}
function fillHelp(){
  document.getElementById('helpRead').innerHTML=
    '• <b>Zakładka Mapa</b>: po lewej mapa, po prawej sterowanie. Górą wybierasz <i>podkład</i> (w tym satelitarny) i <i>wskaźnik</i> kolorujący dzielnice.<br>'+
    '• <b>Suwak roku</b> działa dla wskaźników demograficznych — pokazuje zmianę 2017→2026 i projekcję do 2030 (szare tło = prognoza).<br>'+
    '• <b>Warstwy</b>: zaznaczasz, co widać na mapie. Liczba w nawiasie = ile obiektów.<br>'+
    '• <b>Klik/najazd na obiekt</b> = co to jest, atrybuty i <b>źródło danych</b> (z linkiem do OSM).';
  document.getElementById('helpDist').innerHTML=
    'Mamy <b>dwie metody</b>:<br>'+
    '• <b>Linia prosta</b> (szybka) — zakładki Zieleń/15-min. Zaniża dystans.<br>'+
    '• <b>Sieć rzeczywista</b> (dokładna) — zakładka 🧭 Analizy. Liczymy trasę po grafie dróg i chodników OSM (Dijkstra), więc uwzględniamy bariery (Odra, tory). '+
    'Realna droga jest średnio <b>1,43× dłuższa</b> niż linia prosta — dlatego sieć jest podstawą wniosków.<br><br>'+
    '<b>Dostępność:</b> w terenach mieszkalnych co 120 m stawiamy punkt i mierzymy dystans do najbliższej placówki/zieleni. '+
    'Punkty >500 m od zieleni = „puste plamy"; nieosiągalne w 4 km = poza zasięgiem.<br>'+
    '<b>15-min miasto:</b> ile z usług jest w 1200 m (≈15 min, 4,8 km/h). '+
    '<b>Izochrony:</b> realne strefy 5/10/15 min pieszo z kluczowych punktów.';
  const dot=c=>'<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+c+';margin:0 4px 0 0;vertical-align:middle"></span>';
  document.getElementById('helpLayers').innerHTML=
    '🟢 odcienie zieleni = parki / skwery / lasy · 🔴 czerwone punkty = puste plamy · 🟦 transport/usługi.<br>'+
    '<div style="margin-top:7px"><b>Kolory szkół wg typu:</b><br>'+
    dot('#1971c2')+'podstawowa '+dot('#f08c00')+'liceum '+dot('#e8590c')+'technikum/branżowa<br>'+
    dot('#7048e8')+'uczelnia '+dot('#4dabf7')+'przedszkole '+dot('#ae3ec9')+'artystyczna '+dot('#868e96')+'językowa/kursy</div>'+
    '<div style="margin-top:6px"><b>Tryb prezentacji</b> (przycisk na mapie) prowadzi przez 7 kroków-wniosków — pod spotkanie.</div>';
  const intro=document.getElementById('intro'), close=document.getElementById('introClose');
  if(close) close.onclick=()=>{intro.style.display='none';};
  if(location.search.includes('nointro')&&intro) intro.style.display='none';
  const demo=document.getElementById('demoBtn'); if(demo) demo.onclick=toggleDemo;
  const iso=document.getElementById('isoBtn'); if(iso) iso.onclick=toggleIso;
}

// ---------- IZOCHRONY INTERAKTYWNE (cała sieć miasta, klik dowolny punkt) ----------
const ISO_MLAT=111320, ISO_MLON=111320*Math.cos(50.67*Math.PI/180), ISO_L0=17.92, ISO_B0=50.67, WALK_MMIN=80;
function isoToM(lon,lat){return [(lon-ISO_L0)*ISO_MLON,(lat-ISO_B0)*ISO_MLAT];}
function isoToLL(x,y){return [ISO_L0+x/ISO_MLON, ISO_B0+y/ISO_MLAT];}
// kopiec binarny (min-heap) dla Dijkstry
function MinHeap(){this.a=[];}
MinHeap.prototype.push=function(d,v){const a=this.a;a.push([d,v]);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;[a[p],a[i]]=[a[i],a[p]];i=p;}};
MinHeap.prototype.pop=function(){const a=this.a;const top=a[0];const last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){let l=2*i+1,r=l+1,s=i;if(l<a.length&&a[l][0]<a[s][0])s=l;if(r<a.length&&a[r][0]<a[s][0])s=r;if(s===i)break;[a[s],a[i]]=[a[i],a[s]];i=s;}}return top;};
MinHeap.prototype.size=function(){return this.a.length;};
let GRAPH=null, isoMode=false, isoLayer=null, isoBuilding=false;
async function buildGraph(){
  const gj=await fetchJSON('siec_piesza.geojson'); if(!gj)return null;
  const SNAP=1.5, CELL=50, adj=new Map(), xy=new Map(), hash=new Map();
  const nid=(x,y)=>Math.round(x/SNAP)+','+Math.round(y/SNAP);
  function addNode(x,y){const id=nid(x,y);if(!xy.has(id)){xy.set(id,[x,y]);adj.set(id,[]);const hk=Math.floor(x/CELL)+','+Math.floor(y/CELL);(hash.get(hk)||hash.set(hk,[]).get(hk)).push(id);}return id;}
  for(const f of gj.features){const g=f.geometry;if(!g||g.type!=='LineString')continue;let prev=null;
    for(const co of g.coordinates){const [x,y]=isoToM(co[0],co[1]);const id=addNode(x,y);
      if(prev!==null){const p=xy.get(prev);const w=Math.hypot(x-p[0],y-p[1]);if(w>0){adj.get(prev).push([id,w]);adj.get(id).push([prev,w]);}}prev=id;}}
  return {adj,xy,hash,cell:CELL};
}
function isoNearest(g,x,y,maxr=800){const c=g.cell;let cx=Math.floor(x/c),cy=Math.floor(y/c),best=null,bd=1e18,rad=0;
  while(rad*c<=maxr+c){for(let ix=cx-rad;ix<=cx+rad;ix++)for(let iy=cy-rad;iy<=cy+rad;iy++){if(rad>0&&Math.abs(ix-cx)!==rad&&Math.abs(iy-cy)!==rad)continue;const arr=g.hash.get(ix+','+iy);if(!arr)continue;for(const id of arr){const p=g.xy.get(id);const dd=(p[0]-x)**2+(p[1]-y)**2;if(dd<bd){bd=dd;best=id;}}}if(best!==null&&rad>=1)break;rad++;}
  return best===null?null:{id:best,snap:Math.sqrt(bd)};}
function isoDijkstra(g,src,maxd){const dist=new Map();const h=new MinHeap();dist.set(src,0);h.push(0,src);
  while(h.size()){const [d,u]=h.pop();if(d>(dist.get(u)??1e18))continue;if(d>maxd)continue;for(const [v,w] of g.adj.get(u)){const nd=d+w;if(nd<(dist.get(v)??1e18)){dist.set(v,nd);h.push(nd,v);}}}return dist;}
function isoColor(b){return b<=5?'#2b8a3e':b<=10?'#ffd43b':'#e8590c';}
async function runIso(latlng){
  if(!GRAPH){ if(isoBuilding)return; isoBuilding=true; setIsoStatus('⏳ Buduję sieć miasta (raz)…'); GRAPH=await buildGraph(); isoBuilding=false; if(!GRAPH){setIsoStatus('Brak danych sieci.');return;} }
  const [x,y]=isoToM(latlng.lng,latlng.lat); const nn=isoNearest(GRAPH,x,y); if(!nn){setIsoStatus('Brak drogi w pobliżu.');return;}
  const dist=isoDijkstra(GRAPH,nn.id,1200+nn.snap);
  if(isoLayer)MAP.removeLayer(isoLayer); isoLayer=L.layerGroup().addTo(MAP);
  const cell=55, seen=new Map();
  for(const [id,dm] of dist){const p=GRAPH.xy.get(id);const gx=Math.floor(p[0]/cell),gy=Math.floor(p[1]/cell),key=gx+','+gy;const mins=(dm+nn.snap)/WALK_MMIN;const band=mins<=5?5:mins<=10?10:mins<=15?15:0;if(!band)continue;const prev=seen.get(key);if(prev===undefined||band<prev)seen.set(key,band);}
  const counts={5:0,10:0,15:0};
  seen.forEach((band,key)=>{counts[band]++;const [gx,gy]=key.split(',').map(Number);const [clon,clat]=isoToLL(gx*cell+cell/2,gy*cell+cell/2);
    L.circleMarker([clat,clon],{renderer:CANVAS,radius:4,weight:0,fillColor:isoColor(band),fillOpacity:.5}).addTo(isoLayer);});
  L.circleMarker(latlng,{radius:6,color:'#fff',weight:2,fillColor:'#1c7ed6',fillOpacity:1}).addTo(isoLayer);
  const ha=b=>Math.round((counts[b])*cell*cell/1e4);
  setIsoStatus('🚶 Z tego punktu pieszo:<br><b style="color:#2b8a3e">≤5 min</b> ~'+ha(5)+' ha · <b style="color:#ffd43b">≤10 min</b> ~'+ha(10)+' ha · <b style="color:#e8590c">≤15 min</b> ~'+ha(15)+' ha. Kliknij dalej lub wyłącz tryb.');
}
function setIsoStatus(html){const el=document.getElementById('isoStatus');if(el)el.innerHTML=html;}
function toggleIso(){
  isoMode=!isoMode;
  if(isoMode && typeof demoMode!=='undefined' && demoMode) toggleDemo();
  const b=document.getElementById('isoBtn'); if(b)b.textContent=isoMode?'🛑 Wyłącz izochrony':'🚶 Izochrona z punktu — kliknij mapę';
  const hint=document.getElementById('isoHint'); if(hint)hint.style.display=isoMode?'block':'none';
  if(!isoMode){ if(isoLayer){MAP.removeLayer(isoLayer);isoLayer=null;} }
  else setIsoStatus('Kliknij dowolne miejsce w mieście, by zobaczyć zasięg 5/10/15 min pieszo.');
}
MAP.on('click', e=>{ if(isoMode) runIso(e.latlng); });

// ---------- tryb demonstracji liczenia odległości ----------
let demoMode=false, demoLayer=null;
function toggleDemo(){
  demoMode=!demoMode;
  if(demoMode && isoMode) toggleIso();
  document.getElementById('demoBtn').textContent=demoMode?'🛑 Wyłącz tryb demonstracji':'🎯 Włącz tryb demonstracji — kliknij mapę';
  document.getElementById('demoHint').style.display=demoMode?'block':'none';
  if(!demoMode&&demoLayer){MAP.removeLayer(demoLayer);demoLayer=null;}
}
function centroidOfFeature(f){
  const g=f.geometry; if(!g)return null;
  if(g.type==='Point')return [g.coordinates[1],g.coordinates[0]];
  let ring=g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0][0]:g.type==='LineString'?g.coordinates:null;
  if(!ring)return null;
  let la=0,lo=0;ring.forEach(p=>{lo+=p[0];la+=p[1];});return [la/ring.length,lo/ring.length];
}
function nearestFrom(latlng, ids){
  let best=null,bd=1e18,bid=null;
  ids.forEach(id=>{const gj=dataCache[id];if(!gj)return;
    gj.features.forEach(f=>{const c=centroidOfFeature(f);if(!c)return;
      const d=MAP.distance(latlng,c);if(d<bd){bd=d;best=c;bid=id;}});});
  return best?{ll:best,dist:bd,layer:bid}:null;
}
MAP.on('click', e=>{
  if(!demoMode)return;
  if(demoLayer)MAP.removeLayer(demoLayer);
  demoLayer=L.layerGroup().addTo(MAP);
  // bufory 300/500 m
  L.circle(e.latlng,{radius:300,color:'#39b54a',weight:1.5,fill:false,dashArray:'5 5'}).addTo(demoLayer)
    .bindTooltip('300 m (≈5 min pieszo)',{permanent:false});
  L.circle(e.latlng,{radius:500,color:'#f59f00',weight:1.2,fill:false,dashArray:'3 6'}).addTo(demoLayer);
  L.circleMarker(e.latlng,{radius:6,color:'#fff',fillColor:'#e03131',fillOpacity:1,weight:2}).addTo(demoLayer);
  // najbliższa zieleń + usługi
  const targets=[['Zieleń',['parki','zielen_pozostala'],'#2f9e44'],
                 ['Szkoła',['szkoly'],'#1971c2'],['Sklep',['sklepy_spozywcze'],'#f76707'],
                 ['Przystanek',['przystanki_bus'],'#1c7ed6'],['Zdrowie',['zdrowie'],'#e03131']];
  let html='<b>Pomiar od klikniętego punktu</b><br><table>';
  targets.forEach(([name,ids,col])=>{
    const n=nearestFrom(e.latlng,ids);if(!n)return;
    L.polyline([e.latlng,n.ll],{color:col,weight:2,opacity:.85}).addTo(demoLayer);
    const mid=[(e.latlng.lat+n.ll[0])/2,(e.latlng.lng+n.ll[1])/2];
    L.marker(mid,{icon:L.divIcon({className:'',html:'<span style="background:'+col+';color:#fff;font-size:10px;padding:1px 4px;border-radius:4px;white-space:nowrap">'+Math.round(n.dist)+' m</span>',iconSize:[1,1]})}).addTo(demoLayer);
    html+='<tr><td style="color:'+col+'">'+name+'</td><td><b>'+Math.round(n.dist)+' m</b></td></tr>';
  });
  html+='</table><div class="small muted" style="margin-top:4px">Dystans w linii prostej. Zielony okrąg = 300 m, pomarańczowy = 500 m.</div>';
  L.popup({maxWidth:240}).setLatLng(e.latlng).setContent(html).openOn(MAP);
});
function stat(k,v,u){return '<div class="stat"><span>'+k+'</span><span><b>'+(v==null?'—':v)+'</b>'+(u?'<span class="u">'+u+'</span>':'')+'</span></div>';}
function bar(k,pct){return '<div style="margin:5px 0"><div class="row" style="justify-content:space-between"><span class="small">'+k+'</span><span class="small"><b>'+pct+'%</b></span></div><div class="barbg"><div class="barfg" style="width:'+pct+'%"></div></div></div>';}

function drawDemoChart(){
  if(!DEMO)return;
  const key=document.getElementById('demoMetric').value||'ludnosc';
  const svg=document.getElementById('demoChart'); const W=svg.clientWidth||340,H=96,pad=6;
  const years=DEMO.lata.concat(DEMO.proj_lata);
  function seriesFor(obj){
    let v;
    if(key==='ludnosc') v=obj.ludnosc.concat(obj.ludnosc_proj||[]);
    else if(key==='mlodziez') v=(obj.mlodziez||[]).concat(obj.mlodziez_proj||[]);
    else if(key==='sr_wieku') v=(obj.sr_wieku||[]).concat([null,null,null,null]);
    else if(key==='gestosc') v=(obj.gestosc||[]).concat([null,null,null,null]);
    return v;
  }
  const city=seriesFor(DEMO.miasto);
  const sel=selDistrict!=null?seriesFor(demoOf(selDistrict)):null;
  const all=city.concat(sel||[]).filter(v=>v!=null);
  const mn=Math.min(...all),mx=Math.max(...all);
  const X=i=>pad+(W-2*pad)*i/(years.length-1);
  const Y=v=>H-pad-(H-2*pad)*((v-mn)/((mx-mn)||1));
  function path(v,col,w){let p='';v.forEach((val,i)=>{if(val==null)return;p+=(p?'L':'M')+X(i).toFixed(1)+' '+Y(val).toFixed(1)+' ';});return '<path d="'+p+'" fill="none" stroke="'+col+'" stroke-width="'+w+'"/>';}
  const splitX=X(DEMO.lata.length-1);
  let s='<rect x="'+splitX+'" y="0" width="'+(W-splitX)+'" height="'+H+'" fill="#ffffff08"/>';
  s+='<line x1="'+splitX+'" y1="0" x2="'+splitX+'" y2="'+H+'" stroke="#3a4b5a" stroke-dasharray="3 3"/>';
  s+=path(city,'#39b54a',2);
  if(sel)s+=path(sel,'#f59f00',1.6);
  svg.innerHTML=s;
  document.getElementById('demoChartCap').innerHTML='<span style="color:#39b54a">━ miasto</span>'+(selDistrict!=null?' <span style="color:#f59f00">━ dzielnica '+(demoOf(selDistrict)?.nazwa)+'</span>':'')+' · szary obszar = projekcja';
}

function fillProvenance(){
  const reg=[
    ['Granice i demografia dzielnic','ArcGIS UM Opole (mieszkańcy/Map/0)','2017–2026','13 dzielnic; ludność, gęstość, wiek, struktura wieku. Rok 2024 (struktura wieku) niespójny — odrzucony.'],
    ['Tereny zielone, drzewa, place zabaw','OpenStreetMap (Overpass)','stan 25.06.2026','Kompletność zależna od społeczności OSM — drzewa i place zabaw są niedoszacowane (nie każdy obiekt zmapowany).'],
    ['Transport, usługi, firmy','OpenStreetMap (Overpass)','stan 25.06.2026','Przystanki, kolej, taxi, rowery, parkingi, sklepy, zdrowie, kultura, ścieżki rowerowe, chodniki. Pokrycie dobre dla transportu, częściowe dla firm.'],
    ['Zieleń satelitarna (drugi zbiór)','ESA WorldCover 10 m v200 (Sentinel-1/2)','2021','Niezależna klasyfikacja pokrycia terenu z satelity. Pokazuje zieleń pominiętą w OSM. Rozdzielczość 10 m — drobne obiekty miejskie mogą być uśrednione.'],
    ['Strefy powodziowe, plan miasta, krajobraz','ArcGIS UM Opole (na żywo, WMS/export)','2020–2022','Warstwy urzędowe pobierane na żywo; reprojekcja z EPSG:2177. Stan wg serwera miasta.'],
    ['Działki i budynki ewidencyjne','GUGiK — Krajowa Integracja Ewidencji Gruntów (WMS)','aktualne','Oficjalna ewidencja gruntów i budynków. Widoczne po przybliżeniu (próg skali).'],
    ['Ochrona przyrody (parki, Natura 2000)','GDOŚ — Geoserwis (WMS)','aktualne','Parki narodowe/krajobrazowe, obszary Natura 2000, chronionego krajobrazu, pomniki przyrody.'],
    ['Ekonomia: ceny mieszkań, płace, firmy','GUS Bank Danych Lokalnych (API)','2019–2025','Mediana cen mieszkań zł/m², wynagrodzenia, liczba firm wg wielkości — poziom miasta. Ceny gruntów per działka: RCiWN (na wniosek).'],
    ['Ludność miasta (kontrola)','GUS','01.06.2026','128 140 os. (faktyczna). Suma zameldowanych w dzielnicach ArcGIS: 116 628 — różnica metodologiczna.'],
    ['Analizy sieciowe i strategiczne','Analiza własna na sieci OSM','stan 25.06.2026','Router pieszy (graf 100,5 tys. węzłów), dystans po drogach, izochrony, indeks deprywacji, max-coverage. Metoda zwalidowana wieloagentowym audytem. Analizy siatkowe przycięte do granic miasta.'],
    ['Stacje bazowe BTS (zasięg)','SI2PEM (si2pem.gov.pl, rząd)','aktualne','136 stacji wszystkich operatorów. Białe plamy = odległość do najbliższej stacji (proxy). Realny zasięg = dane operatorów/UKE.'],
    ['Plan Ogólny — strefy zieleni','ArcGIS UM Opole (Plan Ogólny)','od 28.11.2025','Oficjalne przeznaczenie terenów (strefy SN/SO). Walidacja zieleni 3 źródeł.'],
    ['Stan techniczny obiektów','— brak w danych otwartych —','—','OSM ma jedynie proxy: nawierzchnia (boiska 32%, place zabaw 13%), oświetlenie (14%). Pełna ocena = rejestry MZD/MOSiR + audyt terenowy.'],
  ];
  let h='<table class="tbl"><tr><th>Zbiór</th><th>Źródło</th><th>Data</th></tr>';
  reg.forEach(r=>{h+='<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td></tr>';});
  h+='</table>';
  reg.forEach(r=>{h+='<div class="src"><b>'+r[0]+'</b> — '+r[3]+'</div>';});
  document.getElementById('provReg').innerHTML=h;
  document.getElementById('gaps').innerHTML=
    '<b>Czego NIE da się pobrać publicznie (i jak to zdobyć):</b><br><br>'+
    '• <b>Natężenie ruchu Google/Apple, „popular times"</b> — dane zastrzeżone, brak otwartego API do masowego pobrania. Alternatywy: mapy hałasu UM Opole (2022, pochodne ruchu), liczniki ruchu MZD, GDDKiA.<br><br>'+
    '• <b>Trasy aktywności (Strava/Endomondo)</b> — Strava udostępnia publiczny <i>podgląd</i> heatmapy (warstwa w mapie), ale surowe, anonimowe trasy to <b>Strava Metro</b> — bezpłatne dla samorządów na wniosek. Endomondo zamknięte (2021).<br><br>'+
    '• <b>Rejony szkół podstawowych</b> — definiuje uchwała Rady Miasta; warto pozyskać z UM jako warstwę GIS.<br><br>'+
    '• <b>Pełny rejestr firm z adresami</b> — GUS REGON/BIR (API) i CEIDG; tu pokazano firmy z OSM (podzbiór).<br><br>'+
    '• <b>Nadajniki / zasięg</b> — ✅ pobrane z <b>SI2PEM</b> (136 stacji BTS, warstwa „📡 Stacje BTS"). „Białe plamy" to proxy (odległość do BTS). Realny zasięg (moc, pasmo, kierunek anten) = dane operatorów lub UKE/internet.gov.pl.<br><br>'+
    '• <b>Prędkości łączy / dostawcy internetu</b> — UKE „Internet.gov.pl" / Punkt Informacyjny ds. Telekomunikacji (PIT); pełne pokrycie operatorów na wniosek.<br><br>'+
    '• <b>Sieci wod-kan, ciepłownicze</b> — dane zarządców (Wodociągi Opole, Energetyka Cieplna) — nie są publiczne ze względów bezpieczeństwa.<br><br>'+
    '• <b>Susze</b> — IMGW-PIB / Stop Suszy (PGW WP); dane regionalne, nie w skali miejskiej.<br><br>'+
    '• <b>„Przedepty" (skróty mieszkańców)</b> — brak rejestru; pośrednio widać je na heatmapie Strava (warstwa Referencje) i jako nieformalne ścieżki w OSM.<br><br>'+
    '• <b>Czas dojazdu służb</b> — wymaga silnika tras (OSRM/Valhalla); tu pokazano lokalizacje służb. Izochrony do dołożenia.<br><br>'+
    '<b>Rekomendacja:</b> dane otwarte wystarczają do wskazania <i>obszarów problemowych</i>; do decyzji inwestycyjnych połączyć je z rejestrami UM (MZD/MOSiR) i wnioskiem o Strava Metro.';
}

// ---------- sterowanie wskaźnikiem + warstwami (dla prezentacji) ----------
let metricSel=null;
function setMetric(i){ if(!metricSel)return; metricSel.value=i; curMetric=METRICS[i]; toggleYear(); drawChoropleth(); }
function setLayers(onIds){
  REG.forEach(r=>{const L_=layers[r.id],cb=document.getElementById('cb_'+r.id);if(!L_)return;
    const want=onIds.includes(r.id);
    if(want&&!MAP.hasLayer(L_)){L_.addTo(MAP);if(cb)cb.checked=true;}
    if(!want&&MAP.hasLayer(L_)){MAP.removeLayer(L_);if(cb)cb.checked=false;}});
}
function setOfficial(id,on){const o=OFFICIAL.find(x=>x.id===id);if(!o)return;
  if(!officialLayers[id])officialLayers[id]=o.make();const L_=officialLayers[id];const cb=document.getElementById('cb_'+id);
  if(on){L_.addTo(MAP);if(cb)cb.checked=true;}else{MAP.removeLayer(L_);if(cb)cb.checked=false;}}

// ---------- tryb prezentacji (storymap) ----------
// ====== TRYB PREZENTACJI (rozbudowany, dane na żywo) ======
const fmt=n=>(n==null?'—':Number(n).toLocaleString('pl'));
function dnum(name){ return DEMO? DEMO.dzielnice.find(d=>String(d.nazwa)===name):null; }
function dzCentroid(numer){ const f=DZ&&DZ.features.find(x=>x.properties.numer===numer); return f?centroidOfFeature(f):null; }
function maxBy(arr,f){ return (arr||[]).reduce((a,b)=>(f(b)>f(a)?b:a),(arr||[])[0]); }
function minBy(arr,f){ return (arr||[]).reduce((a,b)=>(f(b)<f(a)?b:a),(arr||[])[0]); }

function applyState(st){
  st=st||{};
  if(st.metric!=null) setMetric(st.metric);
  setLayers(st.layers||[]);
  if(satOverlay){ const cb=document.getElementById('satOv');
    if(st.sat){satOverlay.addTo(MAP); if(cb)cb.checked=true;} else {MAP.removeLayer(satOverlay); if(cb)cb.checked=false;} }
  OFFICIAL.forEach(o=>setOfficial(o.id, (st.official||[]).includes(o.id)));
  if(st.fly){ MAP.flyTo(st.fly, st.zoom||13); }
  else { MAP.setView(st.view||[50.668,17.922], st.zoom||12); }
}

const STORY=[
  // ——— WPROWADZENIE ———
  {sect:'Wprowadzenie', t:'Strategia Młodzieżowa — Obszar 7', state:{metric:4,layers:['parki','zielen_pozostala','lasy']},
   c:()=>'Zielona przestrzeń i dobrostan młodych w Opolu — na <b>publicznych, zweryfikowanych danych</b>. '+
     'Mapa łączy OpenStreetMap, satelitę (ESA WorldCover), oficjalne warstwy UM Opole/GUGiK/GDOŚ i GUS. '+
     'Metodyka przeszła wieloagentowy audyt (naprawiono 13 błędów). Przejdźmy przez kluczowe wnioski.'},

  // ——— KTO ———
  {sect:'Kto tu mieszka', t:'Ludność maleje i się starzeje', state:{metric:0,layers:[]},
   c:()=>{const c=DEMO?.miasto; if(!c)return''; const d=c.ludnosc[9]-c.ludnosc[0];
     return 'Opole: <b>'+fmt(c.ludnosc[9])+'</b> mieszkańców (2026), zmiana 2017→26: <b>'+(d>0?'+':'')+fmt(d)+'</b> ('+Math.round(1000*d/c.ludnosc[0])/10+'%). '+
     'Średni wiek wzrósł z <b>'+c.sr_wieku[0]+'</b> do <b>'+c.sr_wieku[9]+'</b> lat. Projekcja 2030: ~'+fmt(c.ludnosc_proj.at(-1))+'. '+
     'To presja na usługi i przestrzeń — przy mniejszej, starszej populacji.';}},
  {sect:'Kto tu mieszka', t:'Młodzież — gdzie rośnie, gdzie znika', state:{metric:2,layers:[]},
   c:()=>{if(!DEMO)return''; const grow=maxBy(DEMO.dzielnice,d=>d.zmiana_mlodziez_10lat_proc||-1e9), drop=minBy(DEMO.dzielnice,d=>d.zmiana_mlodziez_10lat_proc??1e9);
     return 'Udział młodzieży (0–17) na mapie. Najszybciej rośnie <b>dzielnica '+grow.nazwa+'</b> ('+(grow.zmiana_mlodziez_10lat_proc>0?'+':'')+grow.zmiana_mlodziez_10lat_proc+'% młodzieży, ludność '+grow.zmiana_10lat_proc+'%) — rozwojowa. '+
     'Najszybciej ubywa młodych w <b>dzielnicy '+drop.nazwa+'</b> ('+drop.zmiana_mlodziez_10lat_proc+'%). Potrzeby są nierówne przestrzennie.';}},

  // ——— ZIELEŃ ———
  {sect:'Zieleń', t:'Zieleni jest dużo — rzecz w rozmieszczeniu', state:{metric:4,layers:['parki','zielen_pozostala','lasy']},
   c:()=>{const g=GREEN; if(!g)return''; return 'Łącznie <b>'+fmt(g.zielen_ha)+' ha</b> (≈22% miasta), <b>'+g.zielen_dostepna_m2_na_os+' m²</b> zieleni urządzonej na mieszkańca — '+
     'znacznie powyżej cytowanego minimum 9 m². Problemem nie jest ilość, lecz <b>nierówny dostęp i jakość</b>.';}},
  {sect:'Zieleń', t:'Puste plamy — gdzie brakuje zieleni', state:{metric:7,layers:['puste_plamy','parki','zielen_pozostala']},
   c:()=>{const g=GREEN; if(!g)return''; return '<b>'+g.dostepnosc_300m_proc+'%</b> terenów mieszkalnych ma zieleń w 300 m (norma WHO/EEA), '+g.dostepnosc_500m_proc+'% w 500 m. '+
     'Zostaje <b>'+g.puste_plamy_punkty+' „pustych plam"</b> (>500 m, czerwone punkty) — gotowa lista lokalizacji pod nowe skwery.';}},
  {sect:'Zieleń', t:'Ile zieleni gubią dane — satelita', state:{metric:10,sat:true,layers:[]},
   c:()=>{if(!SAT)return''; const top=maxBy(SAT.dzielnice,d=>d.roznica_sat_minus_osm||-1e9);
     return 'Niezależny obraz z satelity (ESA WorldCover 10 m) widzi znacznie więcej zieleni niż zmapowano w OSM. '+
     'Rekord: <b>dzielnica '+top.nazwa+'</b> — satelita '+top.sat_zielen_proc+'% vs OSM '+top.osm_zielen_proc+'% (różnica <b>+'+top.roznica_sat_minus_osm+' pkt%</b>). '+
     'Wniosek: realny potencjał zieleni jest większy, niż sugerują dane wektorowe.';}},
  {sect:'Zieleń', t:'Nierówność „drzewiasta" — centrum bez cienia', state:{metric:6,layers:['drzewa']},
   c:()=>{if(!DZ)return''; const ps=DZ.features.map(f=>f.properties); const lo=minBy(ps,p=>p.drzewa_na_1000??1e9), hi=maxBy(ps,p=>p.drzewa_na_1000??-1);
     return 'Drzewa na 1000 mieszkańców (OSM). Skrajność: <b>dzielnica '+lo.nazwa+'</b> ma '+lo.drzewa_na_1000+', a <b>'+hi.nazwa+'</b> aż '+hi.drzewa_na_1000+'. '+
     'Gęste, zabudowane dzielnice mają najmniej drzew = najmniej cienia. To priorytet adaptacji do upałów.';}},

  // ——— WERYFIKACJA DANYCH ———
  {sect:'Weryfikacja', t:'Oficjalne strefy zieleni miasta (Plan Ogólny)', state:{metric:15,layers:['strefy_zieleni_plan']},
   c:()=>{if(!WERYF)return''; const g=WERYF.globalne; return 'Nowy <b>Plan Ogólny</b> (obowiązuje od 28.11.2025) przeznacza na zieleń/rekreację strefy SN: <b>'+fmt(g.strefa_SN_ha)+' ha</b> ('+g.strefa_SN_proc_miasta+'% miasta). '+
     'To oficjalne <b>przeznaczenie</b> — porównajmy je z tym, co faktycznie rośnie.';}},
  {sect:'Weryfikacja', t:'Czy nasze dane = rzeczywistość?', state:{metric:16,layers:[]},
   c:()=>{if(!WERYF)return''; const g=WERYF.globalne; return 'Trzy źródła zieleni się rozjeżdżają — i to ważne: '+
     'satelita widzi <b>'+g.satelita_zielen_proc+'%</b> zieleni, OSM mapuje znacznie mniej (niedoszacowanie), '+
     'a tylko <b>'+g.SN_faktycznie_zielone_proc+'%</b> oficjalnych stref zieleni jest faktycznie zielone. '+
     'Co ważniejsze: <b>'+g.zielen_poza_strefami_proc+'% realnej zieleni leży POZA strefami zieleni</b> — potencjalnie niechronione (mapa: ciemne = duża rozbieżność).';}},
  {sect:'Weryfikacja', t:'Sprawdź sam — ortofotomapa miejska', state:{layers:['puste_plamy']},
   c:()=>'Przełącz podkład na <b>„Ortofotomapę Opole 2019 (UM)"</b> (lub Sentinel-2 2024) i przybliż — to oficjalne zdjęcia lotnicze miasta. '+
     'Można wizualnie zweryfikować każdą „pustą plamę" i każdy teren zielony. Dane są jawne i sprawdzalne — to fundament merytorycznej dyskusji.'},

  // ——— DOSTĘPNOŚĆ (SIEĆ) ———
  {sect:'Dostępność', t:'Liczymy realną drogę, nie linię prostą', state:{metric:13,layers:['dostepnosc_siec']},
   c:()=>{if(!SIEC)return''; return 'Przeszliśmy z odległości w linii prostej na <b>dystans po sieci pieszej</b> (drogi, chodniki; graf 100,5 tys. węzłów). '+
     'To uwzględnia bariery — Odrę, tory. <b>Realna droga jest średnio '+SIEC.wsp_nadlozenia_srednia+'× dłuższa</b> (p90 = '+SIEC.wsp_nadlozenia_p90+'×). '+
     'Dlatego proste odległości zaniżały — wnioski opieramy na sieci.';}},
  {sect:'Dostępność', t:'Izochrony — realne zasięgi 5/10/15 min', state:{metric:13,layers:['izochrony'],fly:[50.6668,17.9236],zoom:13},
   c:()=>'Strefy dojścia pieszo z kluczowych punktów (centrum, dworzec, uniwersytet): '+
     '<span style="color:#2b8a3e">●</span> ≤5 min · <span style="color:#ffd43b">●</span> ≤10 min · <span style="color:#e8590c">●</span> ≤15 min. '+
     'Widać, jak bariery i układ ulic kształtują realny zasięg — inaczej niż okrąg „w linii prostej".'},
  {sect:'Dostępność', t:'Miasto 15-minutowe — zdrowie najsłabsze', state:{metric:4,layers:['zdrowie','przystanki_bus']},
   c:()=>{if(!M15)return''; const a=M15.dostepnosc_15min_proc||{};
     return 'Czy codzienne potrzeby są w 15 min pieszo? Najlepiej: przystanek '+a.przystanek+'%, zieleń '+a.zielen+'%. '+
     'Najsłabiej: <b>apteka/lekarz '+a.apteka_lekarz+'%</b>. Pełne „15-min miasto" (6/6 usług): <b>'+M15.proc_pelne_15min_miasto+'%</b> terenów. '+
     'Zdrowie to luka dostępności — szczególnie poza centrum.';}},
  {sect:'Dostępność', t:'Edukacja wg poziomu — żłobki to luka', state:{metric:13,layers:['zlobki','przedszkola']},
   c:()=>{if(!EDU)return''; const z=EDU; return 'Dystans pieszo (mediana): przedszkole '+z.mediana_m.przedszkole+' m, podstawowa '+z.mediana_m.podstawowa+' m — przyzwoicie. '+
     'Ale <b>żłobek '+z.mediana_m.zlobek+' m</b> (tylko '+z.w_800m_proc.zlobek+'% w 800 m, '+z.liczba_placowek.zlobek+' placówek w danych). '+
     'Szkoły średnie/wyższe skupione centralnie. Żłobki = najpilniejsza luka dla młodych rodzin.';}},

  // ——— DIAGNOZA SYNTETYCZNA ———
  {sect:'Diagnoza', t:'Indeks deprywacji dostępu', state:{metric:13,layers:[]},
   c:()=>{if(!STRAT)return''; const s=STRAT.indeks_deprywacji.slice().sort((a,b)=>b.deprywacja-a.deprywacja);
     return 'Złożenie dostępu (edukacja, usługi, sport, zieleń) po sieci, per dzielnica. Wyższy = gorszy dostęp. '+
     'Najgorzej: <b>'+s[0].nazwa+' ('+s[0].deprywacja+')</b>, '+s[1].nazwa+' ('+s[1].deprywacja+'), '+s[2].nazwa+' ('+s[2].deprywacja+'). '+
     'Najlepiej: '+s.at(-1).nazwa+' ('+s.at(-1).deprywacja+'). To obiektywna mapa nierówności.';}},
  {sect:'Diagnoza', t:'🎯 Priorytet równości — gdzie najpierw', state:{metric:14,layers:[]},
   c:()=>{if(!STRAT)return''; const s=STRAT.indeks_deprywacji.slice().sort((a,b)=>(b.priorytet_rownosci||0)-(a.priorytet_rownosci||0));
     return 'Deprywacja <b>ważona udziałem młodzieży</b> — tam, gdzie jest najwięcej młodych i najgorszy dostęp. '+
     'Najwyższy priorytet: <b>'+s[0].nazwa+' ('+s[0].priorytet_rownosci+')</b> i '+s[1].nazwa+' ('+s[1].priorytet_rownosci+'). '+
     'To kieruje inwestycje tam, gdzie dadzą największy efekt dla młodzieży.';}},
  {sect:'Diagnoza', t:'Mapa bivariate: młodzież × deficyt zieleni', state:{metric:12,layers:[]},
   c:()=>'Dwuwymiarowo: oś pozioma = udział młodzieży, pionowa = deficyt zieleni. '+
     '<b>Ciemny róg = dużo młodych + mało zieleni</b> = priorytet zazieleniania. Jeden obraz zamiast dwóch map.'},

  // ——— DZIAŁANIE ———
  {sect:'Co robić', t:'💡 Gdzie dodać żłobki (max-coverage)', state:{metric:13,layers:['lokalizacje_zlobki','zlobki']},
   c:()=>{if(!STRAT)return''; const L=STRAT.lokalizacje;
     return '<b>'+fmt(L.zlobki_nieobjete_punkty)+'</b> punktów mieszkalnych jest poza zasięgiem ~12 min od żłobka. '+
     'Algorytm max-coverage (ważony młodzieżą) wskazał <b>'+L.zlobki_sugestie+' lokalizacji</b> (📍) obejmujących najwięcej rodzin. '+
     'To wskazówki kierunkowe — do nałożenia na własność gruntów i plan miasta.';}},
  {sect:'Co robić', t:'💡 Gdzie dodać parki/skwery', state:{metric:7,layers:['lokalizacje_parki','puste_plamy']},
   c:()=>{if(!STRAT)return''; const L=STRAT.lokalizacje;
     return '<b>'+fmt(L.parki_nieobjete_punkty)+'</b> punktów leży >~7 min od zieleni. Algorytm proponuje <b>'+L.parki_sugestie+' lokalizacji</b> nowych skwerów (📍), '+
     'domykających „puste plamy". Priorytet: tam, gdzie pokrywa się z wysokim udziałem młodzieży.';}},

  // ——— KONTEKST ———
  {sect:'Kontekst', t:'Ekonomia: mieszkanie poza zasięgiem młodych', state:{metric:0,layers:[]},
   c:()=>{if(!ECON)return''; const cw=ECON.ceny_mieszkan_zl_m2.wolny_rynek, w=ECON.wynagrodzenia.brutto_zl;
     const lp=cw.at(-1), fp=cw[0], lw=w.at(-1); const m2=(lw[1]/lp[1]).toFixed(2);
     return 'Mediana ceny mieszkania: <b>'+fmt(lp[1])+' zł/m²</b> ('+lp[0]+'), wzrost <b>+'+Math.round(100*(lp[1]-fp[1])/fp[1])+'%</b> od '+fp[0]+'. '+
     'Pensja brutto '+fmt(lw[1])+' zł „kupuje" tylko <b>~'+m2+' m²</b> miesięcznie. '+
     'Dla młodych własne mieszkanie jest realnie nieosiągalne — to tło strategii (mieszkalnictwo, najem).';}},
  {sect:'Kontekst', t:'Ryzyko: strefy powodziowe', state:{layers:['waly_przeciwpow'],official:['of_powodz']},
   c:()=>'Oficjalna warstwa UM Opole (na żywo). Planowanie zieleni i miejsc dla młodych musi uwzględniać <b>tereny zalewowe wzdłuż Odry</b> '+
     '(Opole pamięta 1997 i 2010). Nowe inwestycje — poza strefami wysokiego ryzyka lub z zabezpieczeniami.'},
  {sect:'Kontekst', t:'Zasięg telekomunikacyjny — białe plamy', state:{metric:18,layers:['bts_nadajniki','zasieg_biale_plamy']},
   c:()=>{if(!ZASIEG)return''; const z=ZASIEG; const wc=z.dzielnice.slice().sort((a,b)=>(b.srednia_do_bts_m||0)-(a.srednia_do_bts_m||0))[0];
     return 'Oficjalne dane SI2PEM: <b>'+z.stacji_bts+' stacji BTS</b> wszystkich operatorów (Play, Orange, T-Mobile, Plus). '+
     'Mediana do najbliższej: '+z.mediana_do_bts_m+' m. <b>'+z.biale_plamy_proc+'% terenów</b> jest >1 km od nadajnika — naturalne „białe plamy" zasięgu, '+
     'głównie na peryferiach (dz. '+wc.nazwa+': max '+wc.max_do_bts_m+' m). To proxy — realny zasięg zależy od mocy i anten.';}},
  {sect:'Kontekst', t:'Uczciwość: pewność danych i luki', state:{metric:13,layers:[]},
   c:()=>{if(!STRAT)return''; const low=STRAT.indeks_deprywacji.filter(d=>String(d.pewnosc||'').startsWith('niska')||String(d.pewnosc||'').startsWith('średnia'));
     return 'Każdy wniosek ma <b>flagę pewności danych</b> (gęstość sieci/POI). '+(low.length?('Mniej pewne: '+low.map(d=>d.nazwa).join(', ')+'. '):'Pokrycie danych jest dobre. ')+
     'Czego brak publicznie: stan techniczny obiektów, ruch Google/Apple, trasy Strava (Metro na wniosek), ceny gruntów per działka (RCiWN). '+
     'To wszystko jest jawnie opisane w zakładce Źródła.';}},

  // ——— PODSUMOWANIE ———
  {sect:'Podsumowanie', t:'Rekomendacje do dyskusji', state:{metric:14,layers:['lokalizacje_zlobki','lokalizacje_parki']},
   c:()=>'1) <b>Zazielenianie tam, gdzie młodzież + deficyt</b> (priorytet równości). '+
     '2) <b>Żłobki</b> — najpilniejsza luka dostępności. '+
     '3) <b>Drzewa w centrum</b> — cień i klimat. '+
     '4) <b>Zdrowie w 15 min</b> poza centrum. '+
     '5) Pozyskać: Strava Metro, rejony szkół, stan techniczny obiektów. '+
     'Wszystko poparte danymi na tej mapie — gotowe pod decyzje.'},
];

let storyStep=-1, storyBox=null, storyAuto=null;
function buildMapControls(){
  const wrap=document.createElement('div');
  wrap.style.cssText='position:absolute;left:10px;top:80px;z-index:1000;display:flex;flex-direction:column;gap:5px';
  const mk=(txt,title,fn)=>{const b=document.createElement('div');
    b.style.cssText='background:rgba(15,23,32,.92);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:5px 8px;font-size:13px;cursor:pointer;text-align:center;min-width:30px';
    b.textContent=txt;b.title=title;b.onclick=fn;return b;};
  wrap.appendChild(mk('⤢','Pełny ekran',()=>{const el=document.documentElement;
    if(!document.fullscreenElement){(el.requestFullscreen||el.webkitRequestFullscreen).call(el);}else{document.exitFullscreen();}
    setTimeout(()=>MAP.invalidateSize(),300);}));
  wrap.appendChild(mk('⌖','Reset widoku',()=>MAP.setView([50.668,17.922],12)));
  wrap.appendChild(mk('🗺','Ukryj/pokaż panel',()=>{const s=document.getElementById('side');
    s.style.display=s.style.display==='none'?'':'none';setTimeout(()=>MAP.invalidateSize(),100);}));
  document.getElementById('map').appendChild(wrap);
}
function buildStory(){
  const btn=document.createElement('div');
  btn.style.cssText='position:absolute;left:10px;top:46px;z-index:1000;background:var(--accent2);color:#fff;border-radius:8px;padding:6px 11px;font-size:12.5px;cursor:pointer;font-weight:600';
  btn.textContent='▶ Tryb prezentacji'; btn.onclick=()=>startStory();
  document.getElementById('map').appendChild(btn);
  {const m=new URLSearchParams(location.search).get('story'); if(m!=null) setTimeout(()=>{storyStep=Math.max(0,Math.min(STORY.length-1,parseInt(m)||0));renderStory();},800);}
  document.addEventListener('keydown',e=>{
    if(storyStep<0)return;
    if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();storyNext();}
    else if(e.key==='ArrowLeft'){e.preventDefault();if(storyStep>0){storyStep--;renderStory();}}
    else if(e.key==='Escape'){endStory();}
  });
}
function startStory(){ storyStep=0; renderStory(); }
function storyNext(){ if(storyStep<STORY.length-1){storyStep++;renderStory();} else endStory(); }
function stopAuto(){ if(storyAuto){clearInterval(storyAuto);storyAuto=null;} }
function endStory(){ storyStep=-1; stopAuto(); if(storyBox){storyBox.remove();storyBox=null;} applyState({metric:4,layers:['parki','zielen_pozostala','lasy']}); }
function renderStory(){
  const s=STORY[storyStep]; if(!s)return; applyState(s.state);
  if(!storyBox){storyBox=document.createElement('div');
    storyBox.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:22px;z-index:1500;background:rgba(15,23,32,.97);border:1px solid var(--accent2);border-radius:12px;padding:0;width:min(660px,90%);box-shadow:0 8px 40px #000a;overflow:hidden';
    document.getElementById('map').appendChild(storyBox);}
  const c = typeof s.c==='function'? s.c() : s.c;
  const pct = Math.round(100*(storyStep+1)/STORY.length);
  // sekcje — kropki
  const sections=[...new Set(STORY.map(x=>x.sect))];
  const dots=sections.map(sc=>{const on=sc===s.sect;return '<span title="'+sc+'" style="display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 2px;background:'+(on?'#69db7c':'#33485a')+'"></span>';}).join('');
  storyBox.innerHTML=
    '<div style="height:3px;background:#33485a"><div style="height:3px;width:'+pct+'%;background:#39b54a;transition:width .3s"></div></div>'+
    '<div style="padding:12px 16px 13px">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9fb1c1">'+
    '<span><b style="color:#69db7c">'+s.sect+'</b> · krok '+(storyStep+1)+'/'+STORY.length+'</span><span>'+dots+'</span></div>'+
    '<div style="font-size:16px;font-weight:700;margin:4px 0 5px">'+s.t+'</div>'+
    '<div style="font-size:12.5px;line-height:1.6">'+c+'</div>'+
    '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:11px">'+
    '<div><button id="stAuto" style="font-size:11px">'+(storyAuto?'⏸ Auto':'▶ Auto')+'</button> <button id="stEnd" style="font-size:11px">✕ Zakończ</button></div>'+
    '<div style="display:flex;gap:8px"><button id="stPrev">◀</button><button id="stNext" style="background:var(--accent2);color:#fff;border:none;padding:6px 14px">'+(storyStep===STORY.length-1?'Zakończ ✓':'Dalej ▶')+'</button></div></div>'+
    '<div class="muted" style="font-size:10px;margin-top:5px">Nawigacja: ← → lub spacja · Esc = wyjście</div></div>';
  document.getElementById('stPrev').onclick=()=>{if(storyStep>0){storyStep--;renderStory();}};
  document.getElementById('stNext').onclick=storyNext;
  document.getElementById('stEnd').onclick=endStory;
  document.getElementById('stAuto').onclick=()=>{ if(storyAuto){stopAuto();}else{storyAuto=setInterval(storyNext,7000);} renderStory(); };
}

// ---------- tabs ----------
const TABS=[['warstwy','🗺 Mapa'],['satelita','📡 Satelita'],['demografia','📈 Demografia'],['zielen','🌳 Zieleń'],['ekonomia','💰 Ekonomia'],['m15','🚶 15-min'],['analizy','🧭 Analizy'],['weryfikacja','✅ Weryfikacja'],['wnioski','💡 Wnioski'],['objasnienia','📖 Objaśnienia'],['metoda','❓ Metoda'],['zrodla','📋 Źródła']];
const tabsEl=document.getElementById('tabs');
TABS.forEach(([k,l],i)=>{const b=document.createElement('div');b.className='tab'+(i===0?' on':'');b.textContent=l;
  b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));b.classList.add('on');
    document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.dataset.pane===k));
    if(k==='demografia')setTimeout(drawDemoChart,30);
    if(k==='ekonomia')setTimeout(drawEkonChart,30);};
  tabsEl.appendChild(b);});

init();
