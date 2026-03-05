import { useState, useEffect, useRef, useCallback } from "react";

/* ─── TOKENS ─── */
const LT = {
  bg:"#ffffff", phoneBg:"#ffffff", surface:"#f5f5f5", surfaceHover:"#eeeeee",
  border:"#e8e8e8", borderMed:"#cccccc", borderStrong:"#111111",
  text:"#0a0a0a", textSub:"#555555", textMuted:"#999999",
  accent:"#000000", accentText:"#ffffff",
  tabActiveBg:"#000000", tabActiveText:"#ffffff", tabInactive:"#aaaaaa",
  navBorder:"#f0f0f0", inputBg:"#f5f5f5",
  green:"#16a34a", greenBg:"#f0fdf4", red:"#dc2626", redBg:"#fef2f2",
  amber:"#d97706", amberBg:"#fffbeb", blue:"#2563eb", blueBg:"#eff6ff",
  shadow:"0 0 0 1px rgba(0,0,0,0.06),0 20px 60px rgba(0,0,0,0.08)",
};
const DT = {
  bg:"#0a0a0a", phoneBg:"#111111", surface:"rgba(255,255,255,0.06)", surfaceHover:"rgba(255,255,255,0.09)",
  border:"rgba(255,255,255,0.09)", borderMed:"rgba(255,255,255,0.2)", borderStrong:"#e8dfc8",
  text:"#f5f5f5", textSub:"rgba(255,255,255,0.55)", textMuted:"rgba(255,255,255,0.28)",
  accent:"#e8dfc8", accentText:"#111111",
  tabActiveBg:"#e8dfc8", tabActiveText:"#111111", tabInactive:"rgba(255,255,255,0.3)",
  navBorder:"rgba(255,255,255,0.07)", inputBg:"rgba(255,255,255,0.06)",
  green:"#4ade80", greenBg:"rgba(74,222,128,0.1)", red:"#f87171", redBg:"rgba(248,113,113,0.1)",
  amber:"#fbbf24", amberBg:"rgba(251,191,36,0.1)", blue:"#60a5fa", blueBg:"rgba(96,165,250,0.1)",
  shadow:"0 0 0 1px rgba(255,255,255,0.07),0 32px 80px rgba(0,0,0,0.8)",
};

const SCAN = { IDLE:"idle", SCANNING:"scanning", SUCCESS:"success", WRITING:"writing", WRITTEN:"written", VERIFYING:"verifying", VERIFIED:"verified", LOCKING:"locking", LOCKED:"locked" };

/* ─── QR Generator ─── */
function makeQR(slug) {
  let h=0; for(let i=0;i<slug.length;i++){h=((h<<5)-h)+slug.charCodeAt(i);h|=0;}
  const rng=(s)=>{let x=s;return()=>{x=(x*1664525+1013904223)&0xffffffff;return(x>>>0)/0xffffffff;};};
  const rand=rng(Math.abs(h)); const S=21;
  return Array.from({length:S},(_,r)=>Array.from({length:S},(_,c)=>{
    const inFP=(rr,cc,ar,ac)=>rr>=ar&&rr<=ar+6&&cc>=ac&&cc<=ac+6;
    if(inFP(r,c,0,0)||inFP(r,c,0,14)||inFP(r,c,14,0)) return true;
    if(r===6||c===6) return (r+c)%2===0;
    return rand()>0.5;
  }));
}
const QRDisplay=({slug,size=150})=>{
  const grid=makeQR(slug); const cell=size/21;
  return(<div style={{background:"#fff",padding:10,borderRadius:12,display:"inline-block"}}>
    <svg width={size} height={size}>{grid.flatMap((row,r)=>row.map((on,c)=>on?<rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell} height={cell} fill="#000"/>:null))}</svg>
  </div>);
};

/* ─── Shared UI ─── */
const Pill=({children,color,bg})=><span style={{fontSize:10,color,background:bg,borderRadius:4,padding:"2px 8px",fontWeight:500,letterSpacing:0.2}}>{children}</span>;
const Label=({T,children,style={}})=><div style={{fontSize:10,color:T.textMuted,letterSpacing:2,textTransform:"uppercase",fontWeight:500,...style}}>{children}</div>;
const Chevron=({T,size=14})=><svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Divider=({T})=><div style={{height:1,background:T.border}}/>;
const Row=({T,label,value,last,action})=>(
  <div onClick={action} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:last?"none":`1px solid ${T.border}`,cursor:action?"pointer":"default"}}>
    <span style={{fontSize:13,color:T.textMuted}}>{label}</span>
    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,color:T.text}}>{value}</span>{action&&<Chevron T={T} size={12}/>}</div>
  </div>
);
const ScanArea=({active,T,onClick,minH=240,children})=>(
  <div onClick={onClick} style={{width:"100%",background:T.surface,border:`1px solid ${active?T.borderStrong:T.border}`,borderRadius:14,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 0 20px",minHeight:minH,position:"relative",overflow:"hidden",cursor:onClick?"pointer":"default",transition:"border-color 0.35s"}}>
    <div style={{position:"absolute",inset:0,background:active?`radial-gradient(circle at 50%,${T.accent}08,transparent 65%)`:"transparent",transition:"background 0.5s"}}/>
    {children}
  </div>
);
const DotsLoader=({T})=><div style={{display:"flex",gap:5,marginTop:10}}>{[1,2,3].map(i=><div key={i} className="dot" style={{background:T.accent}}/>)}</div>;
const CheckCircle=({T})=><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="12" fill={T.greenBg} stroke={T.green} strokeWidth="1.5"/><path d="M7.5 13L11 16.5L18.5 9.5" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const NFCRings=({active,T})=>{const c=T.accent;return(
  <div style={{position:"relative",width:180,height:180,display:"flex",alignItems:"center",justifyContent:"center"}}>
    {[1,2,3].map(i=><div key={i} style={{position:"absolute",borderRadius:"50%",border:`1.5px solid ${c}`,opacity:0,animation:active?`nfcP 2s ease-out ${i*0.4}s infinite`:"none",width:52+i*40,height:52+i*40}}/>)}
    <div style={{width:64,height:64,borderRadius:"50%",background:active?`${c}12`:T.surface,border:`1.5px solid ${active?c:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.4s",boxShadow:active?`0 0 24px ${c}22`:"none"}}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        {["M8 8C6 12 6 20 8 24","M11 11C9.5 14 9.5 18 11 21","M24 8C26 12 26 20 24 24","M21 11C22.5 14 22.5 18 21 21"].map((d,i)=><path key={i} d={d} stroke={active?c:T.textMuted} strokeWidth="2" strokeLinecap="round" style={{transition:"stroke 0.4s"}}/>)}
        <circle cx="16" cy="16" r="3" fill={active?c:T.textMuted} style={{transition:"fill 0.4s"}}/>
      </svg>
    </div>
  </div>
);};
const Sparkline=({data,color,w=90,h=38})=>{const max=Math.max(...data),min=Math.min(...data);const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/(max-min||1))*(h-4)-2}`).join(" ");return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;};

/* ─── Share Sheet ─── */
const ShareSheet=({T,slug,onClose})=>{
  const [copied,setCopied]=useState(false);
  const copy=()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);};
  return(
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",zIndex:60,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:T.phoneBg,borderRadius:"20px 20px 0 0",padding:"18px 20px 36px",animation:"slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1) both"}}>
        <div style={{width:36,height:4,borderRadius:2,background:T.border,margin:"0 auto 18px"}}/>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,color:T.text,marginBottom:3}}>Поделиться</div>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:18}}>unqx.uz/{slug}</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><QRDisplay slug={slug} size={130}/></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[{l:"Telegram",i:"✈",c:"#2aabee",b:"#e8f6fd"},{l:"WhatsApp",i:"✆",c:"#25d366",b:"#e8fdf0"},{l:"Instagram",i:"◈",c:"#e1306c",b:"#fde8ef"},{l:copied?"Скопировано":"Копировать",i:copied?"✓":"⧉",c:T.text,b:T.surface,fn:copy}].map(({l,i,c,b,fn})=>(
            <div key={l} onClick={fn} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer"}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:b,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:c}}>{i}</div>
              <div style={{fontSize:10,color:T.textSub,textAlign:"center"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Notification Panel ─── */
const NotifPanel=({T,onClose})=>{
  const notifs=[
    {icon:"◎",t:"Новый тап",s:"Мавлонбек открыл визитку",time:"2 мин",dot:true},
    {icon:"◎",t:"Новый тап",s:"Неизвестный — Chrome",time:"18 мин",dot:true},
    {icon:"⊕",t:"Метка записана",s:"ALI001 → NFC-браслет",time:"1 ч"},
    {icon:"⊙",t:"Недельный отчёт",s:"486 тапов · +32%",time:"вчера"},
    {icon:"★",t:"UNQ Elite",s:"Вы на 3-м месте",time:"вчера"},
  ];
  return(
    <div style={{position:"absolute",inset:0,background:T.phoneBg,zIndex:50,display:"flex",flexDirection:"column",animation:"pageIn 0.25s ease both"}}>
      <div style={{padding:"14px 20px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,color:T.text}}>Уведомления</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:24,lineHeight:1}}>×</button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"6px 0"}}>
        {notifs.map((n,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"13px 20px",borderBottom:`1px solid ${T.border}`,position:"relative",animation:`fadeSlideUp 0.3s ease ${i*0.05}s both`}}>
            {n.dot&&<div style={{position:"absolute",top:14,right:20,width:7,height:7,borderRadius:"50%",background:T.accent}}/>}
            <div style={{width:38,height:38,borderRadius:"50%",background:T.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:T.accent,flexShrink:0}}>{n.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,color:T.text,fontWeight:500}}>{n.t}</div>
              <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{n.s}</div>
            </div>
            <div style={{fontSize:11,color:T.textMuted,whiteSpace:"nowrap"}}>{n.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Card Preview Modal ─── */
const CardPreview=({T,card,onClose})=>(
  <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:320,animation:"successPop 0.3s ease both"}}>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",textAlign:"center",marginBottom:12,letterSpacing:1}}>КАК ВИДЯТ ДРУГИЕ</div>
      <div style={{background:card.theme==="dark"?"#111":"#fff",borderRadius:20,padding:"28px 24px",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,textAlign:"center"}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:card.theme==="dark"?"#222":"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:card.theme==="dark"?"#e8dfc8":"#111"}}>{card.name[0]}</div>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:card.theme==="dark"?"#f5f5f5":"#0a0a0a"}}>{card.name}</div>
            <div style={{fontSize:13,color:card.theme==="dark"?"rgba(255,255,255,0.5)":"#777",marginTop:3}}>{card.job}</div>
            <div style={{fontSize:12,color:card.theme==="dark"?"#e8dfc8":"#000",marginTop:4,letterSpacing:1}}>unqx.uz/{card.slug}</div>
          </div>
          <div style={{width:"100%",display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
            {card.buttons.filter(b=>b.label).map((b,i)=>(
              <div key={i} style={{padding:"12px",borderRadius:10,background:card.theme==="dark"?"rgba(255,255,255,0.08)":"#f5f5f5",fontSize:13,fontWeight:500,color:card.theme==="dark"?"#f5f5f5":"#111",textAlign:"center"}}>{b.icon} {b.label}</div>
            ))}
          </div>
        </div>
      </div>
      <button onClick={onClose} style={{display:"block",margin:"16px auto 0",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,padding:"10px 28px",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Закрыть</button>
    </div>
  </div>
);

/* ─── Widget Preview ─── */
const WidgetPreview=({T,taps})=>(
  <div style={{display:"flex",flexDirection:"column",gap:10}}>
    <Label T={T}>Виджеты для экрана</Label>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {/* Small widget */}
      <div style={{background:"linear-gradient(135deg,#111,#333)",borderRadius:16,padding:"14px 16px",aspectRatio:"1"}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>ТАПОВ</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:34,fontWeight:700,color:"#fff",lineHeight:1}}>{taps}</div>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:6}}>unqx.uz</div>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:2}}>Сегодня</div>
      </div>
      {/* Medium widget */}
      <div style={{background:"linear-gradient(135deg,#000,#1a1a1a)",borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",justifyContent:"space-between",aspectRatio:"1"}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,textTransform:"uppercase"}}>ALI001</div>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#fff",lineHeight:1}}>24</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:3}}>тапа сегодня</div>
          <div style={{display:"flex",gap:2,marginTop:8,alignItems:"flex-end",height:24}}>
            {[4,7,3,9,6,8,5].map((h,i)=><div key={i} style={{flex:1,background:i===6?"#e8dfc8":"rgba(255,255,255,0.2)",borderRadius:"2px 2px 0 0",height:`${(h/9)*22}px`}}/>)}
          </div>
        </div>
      </div>
    </div>
    {/* Wide widget */}
    <div style={{background:"linear-gradient(135deg,#111,#2a2a2a)",borderRadius:16,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>UNQX · ALI001</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:"#fff",lineHeight:1}}>247</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:3}}>всего тапов · ↑ +32%</div>
      </div>
      <Sparkline data={[8,14,9,18,22,16,20,13,24,19,28]} color="#e8dfc8" w={80} h={40}/>
    </div>
    <div style={{fontSize:11,color:T.textMuted,textAlign:"center",lineHeight:1.6}}>Виджеты добавляются через системное меню iOS/Android. Скопируй скриншот и покажи дизайнеру 😊</div>
  </div>
);

/* ══════════════════════════════════════
   CARD EDITOR
══════════════════════════════════════ */
const CardEditor=({T,card,setCard,onClose,onPreview})=>{
  const [local,setLocal]=useState({...card});
  const themes=[{id:"light",label:"Светлая"},{id:"dark",label:"Тёмная"},{id:"gradient",label:"Градиент"}];
  const btnIcons=["📞","✉","🔗","💼","📸","🌐","📍","💬"];
  const save=()=>{setCard(local);onClose();};
  return(
    <div style={{position:"absolute",inset:0,background:T.phoneBg,zIndex:50,display:"flex",flexDirection:"column",overflowY:"auto",animation:"pageIn 0.25s ease both"}}>
      <div style={{padding:"14px 20px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,flexShrink:0,position:"sticky",top:0,background:T.phoneBg,zIndex:1}}>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:14,fontFamily:"'Inter',sans-serif"}}>← Назад</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,color:T.text}}>Редактор</div>
        <button onClick={onPreview} style={{background:"none",border:"none",cursor:"pointer",color:T.accent,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif"}}>Превью</button>
      </div>
      <div style={{padding:"16px 20px 32px",display:"flex",flexDirection:"column",gap:18}}>
        {/* Avatar */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <div style={{width:76,height:76,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:T.accent,position:"relative"}}>
            {local.name[0]||"A"}
            <div style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:T.accentText}}>+</div>
          </div>
          <div style={{fontSize:11,color:T.textMuted}}>Нажми чтобы сменить фото</div>
        </div>
        {/* Fields */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Label T={T}>Основная информация</Label>
          {[["Имя","name","text"],["Должность","job","text"],["Телефон","phone","tel"],["Telegram","telegram","text"],["Email","email","email"]].map(([label,key,type])=>(
            <div key={key} style={{display:"flex",flexDirection:"column",gap:4}}>
              <div style={{fontSize:11,color:T.textMuted}}>{label}</div>
              <input type={type} value={local[key]||""} onChange={e=>setLocal({...local,[key]:e.target.value})}
                style={{padding:"11px 13px",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:14,outline:"none"}}/>
            </div>
          ))}
        </div>
        {/* Theme */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Label T={T}>Тема визитки</Label>
          <div style={{display:"flex",gap:8}}>
            {themes.map(th=>(
              <div key={th.id} onClick={()=>setLocal({...local,theme:th.id})} style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${local.theme===th.id?T.borderStrong:T.border}`,cursor:"pointer",textAlign:"center",fontSize:12,color:local.theme===th.id?T.text:T.textMuted,fontWeight:local.theme===th.id?600:400,background:local.theme===th.id?T.surface:"transparent"}}>{th.label}</div>
            ))}
          </div>
        </div>
        {/* Buttons */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Label T={T}>Кнопки ({local.buttons.filter(b=>b.label).length}/6)</Label>
            {local.buttons.length<6&&<button onClick={()=>setLocal({...local,buttons:[...local.buttons,{icon:"🔗",label:"",url:""}]})} style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:500}}>+ Добавить</button>}
          </div>
          {local.buttons.map((btn,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={btn.icon} onChange={e=>setLocal({...local,buttons:local.buttons.map((b,j)=>j===i?{...b,icon:e.target.value}:b)})}
                style={{padding:"10px 8px",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:16,outline:"none",width:52}}>
                {btnIcons.map(ic=><option key={ic} value={ic}>{ic}</option>)}
              </select>
              <input placeholder="Название" value={btn.label} onChange={e=>setLocal({...local,buttons:local.buttons.map((b,j)=>j===i?{...b,label:e.target.value}:b)})}
                style={{flex:1,padding:"10px 12px",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none"}}/>
              <button onClick={()=>setLocal({...local,buttons:local.buttons.filter((_,j)=>j!==i)})} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:16,padding:"0 4px"}}>×</button>
            </div>
          ))}
        </div>
        <button onClick={save} style={{padding:"14px",borderRadius:12,background:T.accent,border:"none",color:T.accentText,fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:600,cursor:"pointer"}}>Сохранить изменения</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   WRISTBAND PAGE
══════════════════════════════════════ */
const WristbandPage=({T,onBack})=>{
  const [orderStep,setOrderStep]=useState(null); // null | "form" | "confirm" | "tracking"
  const [editTag,setEditTag]=useState(null);
  const [editName,setEditName]=useState("");
  const [tags,setTags]=useState([
    {uid:"04:AB:CD:12:34:56:78",name:"Браслет",linked:"ALI001",lastTap:"5 мин назад",taps:247,status:"ok"},
    {uid:"04:FE:11:22:33:44:55",name:"Визитка на столе",linked:"ALI001",lastTap:"2 часа назад",taps:83,status:"ok"},
    {uid:"04:77:88:99:AA:BB:CC",name:"Наклейка на ноут",linked:"ALI001",lastTap:"вчера",taps:31,status:"warn"},
  ]);
  const renameTag=(uid,name)=>{setTags(ts=>ts.map(t=>t.uid===uid?{...t,name}:t));setEditTag(null);};
  const [selTag,setSelTag]=useState(null);
  const tagHistory={"04:AB:CD:12:34:56:78":[{slug:"ALI001",time:"сегодня, 14:32",op:"write"},{slug:"ALI001",time:"вчера, 18:10",op:"write"},{slug:"TMR000",time:"3 дн назад",op:"write"}],"04:FE:11:22:33:44:55":[{slug:"ALI001",time:"сегодня, 09:12",op:"write"}],"04:77:88:99:AA:BB:CC":[{slug:"ALI001",time:"неделю назад",op:"write"}]};

  const orderSteps=[
    {label:"Заявка принята",sub:"Проверяем данные",done:true},
    {label:"Оплата подтверждена",sub:"Payme · 300 000 сум",done:true},
    {label:"В сборке",sub:"Привязываем к ALI001",done:true},
    {label:"Передан в доставку",sub:"Яндекс Доставка",done:false},
    {label:"Доставлен",sub:"Ожидается 3 апр",done:false},
  ];

  if(selTag){
    const t=tags.find(x=>x.uid===selTag); const hist=tagHistory[selTag]||[];
    return(
      <div style={{position:"absolute",inset:0,background:T.phoneBg,zIndex:50,overflowY:"auto",animation:"pageIn 0.25s ease both"}}>
        <div style={{padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.phoneBg,zIndex:1}}>
          <button onClick={()=>setSelTag(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:14,fontFamily:"'Inter',sans-serif"}}>← Назад</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,color:T.text}}>{t.name}</div>
        </div>
        <div style={{padding:"16px 20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
            <Row T={T} label="UID" value={t.uid}/>
            <Row T={T} label="Привязан к" value={`unqx.uz/${t.linked}`}/>
            <Row T={T} label="Тапов" value={t.taps}/>
            <Row T={T} label="Последний тап" value={t.lastTap} last/>
          </div>
          <Label T={T}>История записей на эту метку</Label>
          {hist.map((h,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.accent,fontWeight:600}}>W</div>
              <div>
                <div style={{fontSize:13,color:T.text}}>unqx.uz/<span style={{fontFamily:"'Playfair Display',serif",fontWeight:600}}>{h.slug}</span></div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{h.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if(orderStep==="tracking"){
    return(
      <div style={{position:"absolute",inset:0,background:T.phoneBg,zIndex:50,overflowY:"auto",animation:"pageIn 0.25s ease both"}}>
        <div style={{padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.phoneBg,zIndex:1}}>
          <button onClick={()=>setOrderStep(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:14,fontFamily:"'Inter',sans-serif"}}>← Назад</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,color:T.text}}>Статус заказа</div>
        </div>
        <div style={{padding:"16px 20px 24px",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:`${T.amber}10`,border:`1px solid ${T.amber}30`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:12,color:T.amber,fontWeight:600,marginBottom:3}}>📦 В пути</div>
            <div style={{fontSize:13,color:T.textSub}}>Заказ #UNQ-2847 · Ташкент</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {orderSteps.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:s.done?T.green:T.surface,border:`1.5px solid ${s.done?T.green:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {s.done&&<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {i<orderSteps.length-1&&<div style={{width:2,height:28,background:s.done?T.green:T.border,margin:"2px 0"}}/>}
                </div>
                <div style={{paddingBottom:14}}>
                  <div style={{fontSize:13,color:s.done?T.text:T.textMuted,fontWeight:s.done?500:400}}>{s.label}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setOrderStep(null)} style={{padding:"13px",borderRadius:12,background:T.surface,border:`1px solid ${T.border}`,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer"}}>Закрыть</button>
        </div>
      </div>
    );
  }

  if(orderStep==="form"||orderStep==="confirm"){
    const [addr,setAddr]=useState(""); const [name2,setName2]=useState("Алишер Каримов");
    return(
      <div style={{position:"absolute",inset:0,background:T.phoneBg,zIndex:50,overflowY:"auto",animation:"pageIn 0.25s ease both"}}>
        <div style={{padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.phoneBg,zIndex:1}}>
          <button onClick={()=>setOrderStep(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:14,fontFamily:"'Inter',sans-serif"}}>← Назад</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,color:T.text}}>Заказ браслета</div>
        </div>
        <div style={{padding:"16px 20px 32px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:600,color:T.text}}>UNQX Wristband</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.text}}>300 000 сум</div>
            </div>
            <div style={{fontSize:12,color:T.textMuted}}>NFC-браслет · Тканевый · Привязывается к ALI001</div>
          </div>
          {[["Получатель","Алишер Каримов"],["Адрес доставки","ул. Амира Темура 107, кв. 12"],["Телефон","+998 90 123 45 67"]].map(([l,ph])=>(
            <div key={l} style={{display:"flex",flexDirection:"column",gap:4}}>
              <div style={{fontSize:11,color:T.textMuted}}>{l}</div>
              <input defaultValue={ph} style={{padding:"11px 13px",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:14,outline:"none"}}/>
            </div>
          ))}
          <div style={{background:`${T.blue}10`,border:`1px solid ${T.blue}25`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:12,color:T.blue,fontWeight:500}}>ℹ После оплаты</div>
            <div style={{fontSize:12,color:T.textSub,marginTop:3}}>Мы напишем в Telegram и отправим реквизиты Payme или Click. Активация в течение 15 мин.</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:14,color:T.text,fontWeight:500}}>Итого</span>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.text}}>300 000 сум</span>
          </div>
          <button onClick={()=>setOrderStep("tracking")} style={{padding:"14px",borderRadius:12,background:T.accent,border:"none",color:T.accentText,fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:600,cursor:"pointer"}}>Отправить заявку →</button>
        </div>
      </div>
    );
  }

  return(
    <div style={{position:"absolute",inset:0,background:T.phoneBg,zIndex:50,overflowY:"auto",animation:"pageIn 0.25s ease both"}}>
      <div style={{padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.phoneBg,zIndex:1}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:14,fontFamily:"'Inter',sans-serif"}}>← Назад</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,color:T.text}}>Браслет и метки</div>
      </div>
      <div style={{padding:"16px 20px 28px",display:"flex",flexDirection:"column",gap:16}}>
        {/* Status */}
        <div style={{background:`${T.green}0e`,border:`1px solid ${T.green}25`,borderRadius:14,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:T.greenBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📟</div>
            <div>
              <div style={{fontSize:14,color:T.text,fontWeight:600}}>Браслет активен</div>
              <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>ALI001 · последний тап 5 мин назад</div>
            </div>
            <Pill color={T.green} bg={T.greenBg} style={{marginLeft:"auto"}}>● Активен</Pill>
          </div>
        </div>
        {/* Tags list */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <Label T={T}>Мои метки ({tags.length})</Label>
        </div>
        {tags.map((tag)=>(
          <div key={tag.uid} style={{background:T.surface,border:`1px solid ${tag.status==="warn"?T.amber:T.border}`,borderRadius:14,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
              <div>
                {editTag===tag.uid?(
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")renameTag(tag.uid,editName);}}
                      style={{padding:"6px 10px",background:T.phoneBg,border:`1px solid ${T.borderStrong}`,borderRadius:8,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:14,outline:"none",width:160}}/>
                    <button onClick={()=>renameTag(tag.uid,editName)} style={{background:T.accent,border:"none",borderRadius:8,padding:"6px 12px",color:T.accentText,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>OK</button>
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:14,color:T.text,fontWeight:600}}>{tag.name}</div>
                    <button onClick={()=>{setEditTag(tag.uid);setEditName(tag.name);}} style={{background:"none",border:"none",cursor:"pointer",color:T.textMuted,fontSize:12,fontFamily:"'Inter',sans-serif",padding:0}}>✎</button>
                  </div>
                )}
                <div style={{fontSize:11,color:T.textMuted,marginTop:3,fontFamily:"monospace"}}>{tag.uid}</div>
              </div>
              {tag.status==="warn"&&<Pill color={T.amber} bg={T.amberBg}>Давно не тапали</Pill>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:T.textMuted}}>{tag.taps} тапов · {tag.lastTap}</div>
              <button onClick={()=>setSelTag(tag.uid)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 12px",color:T.text,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>История →</button>
            </div>
          </div>
        ))}
        {/* Order */}
        <div style={{height:1,background:T.border}}/>
        <Label T={T}>Заказать новый браслет</Label>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:600,color:T.text}}>UNQX Wristband</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:T.text}}>300 000 сум</div>
          </div>
          <div style={{fontSize:12,color:T.textMuted,marginBottom:14}}>Тканевый NFC-браслет · Разовая покупка · Доставка по Ташкенту</div>
          <button onClick={()=>setOrderStep("form")} style={{width:"100%",padding:"12px",borderRadius:10,background:T.accent,border:"none",color:T.accentText,fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>Заказать браслет</button>
        </div>
        <button onClick={()=>setOrderStep("tracking")} style={{padding:"12px",borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer"}}>Отслеживать заказ #UNQ-2847 →</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   AUTO-THEME SCHEDULER
══════════════════════════════════════ */
const useAutoTheme=(theme,setTheme,autoTheme)=>{
  useEffect(()=>{
    if(!autoTheme)return;
    const apply=()=>{const h=new Date().getHours();setTheme(h>=20||h<8?"dark":"light");};
    apply(); const t=setInterval(apply,60000);
    return()=>clearInterval(t);
  },[autoTheme,setTheme]);
};

/* ══════════════════════════════════════
   MAIN APP
══════════════════════════════════════ */
export default function App() {
  const [theme,setTheme]=useState("light");
  const [autoTheme,setAutoTheme]=useState(false);
  const [page,setPage]=useState("home");
  const [nfcTab,setNfcTab]=useState("read");
  const [peopleTab,setPeopleTab]=useState("contacts");
  const [scanState,setScanState]=useState(SCAN.IDLE);
  const [letters,setLetters]=useState("");
  const [digits,setDigits]=useState("");
  const [scannedData,setScannedData]=useState(null);
  const [showNotif,setShowNotif]=useState(false);
  const [showShare,setShowShare]=useState(false);
  const [notifDot,setNotifDot]=useState(true);
  const [showCardEditor,setShowCardEditor]=useState(false);
  const [showPreview,setShowPreview]=useState(false);
  const [showWristband,setShowWristband]=useState(false);
  const [lockPass,setLockPass]=useState("");
  const [batchCount,setBatchCount]=useState(0);
  const [card,setCard]=useState({name:"Алишер Каримов",job:"CEO · UNQX",phone:"+998 90 123 45 67",telegram:"@alisher_k",email:"ali@unqx.uz",slug:"ALI001",theme:"light",buttons:[{icon:"📞",label:"Позвонить",url:""},{icon:"✉",label:"Telegram",url:""},{icon:"🌐",label:"Сайт",url:""}]});
  const [savedContacts,setSavedContacts]=useState(["ORG777"]);
  const [subscribedTo,setSubscribedTo]=useState(["ALI001"]);
  const timerRef=useRef(null);
  const digitsRef=useRef(null);

  const T=theme==="light"?LT:DT;
  const isActive=[SCAN.SCANNING,SCAN.WRITING,SCAN.VERIFYING,SCAN.LOCKING].includes(scanState);
  const slugReady=letters.length===3&&digits.length===3;

  useAutoTheme(theme,setTheme,autoTheme);

  const reset=useCallback(()=>{clearTimeout(timerRef.current);setScanState(SCAN.IDLE);setScannedData(null);setBatchCount(0);},[]);
  const run=(ns,delay,ts,cb)=>{setScanState(ns);timerRef.current=setTimeout(()=>{setScanState(ts);cb&&cb();},delay);};
  const switchPage=p=>{reset();setPage(p);};
  const switchNfc=t=>{reset();setNfcTab(t);};

  const startScan=()=>{if(scanState!==SCAN.IDLE)return;run(SCAN.SCANNING,2500,SCAN.SUCCESS,()=>setScannedData({name:"Мавлонбек Юсупов",slug:"ORG777",phone:"+998 90 987 65 43",tag:"Премиум",uid:"04:AB:CD:12:34:56:78"}));};
  const startWrite=()=>{if(!slugReady)return;run(SCAN.WRITING,2400,SCAN.WRITTEN);};
  const startVerify=()=>run(SCAN.VERIFYING,2200,SCAN.VERIFIED);
  const startLock=()=>{if(!lockPass)return;run(SCAN.LOCKING,2300,SCAN.LOCKED);};
  const nextBatch=()=>run(SCAN.SCANNING,1800,SCAN.WRITTEN,()=>setBatchCount(c=>c+1));
  const handleLetters=v=>{const val=v.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3);setLetters(val);if(val.length===3)digitsRef.current?.focus();};
  const handleDigits=v=>setDigits(v.replace(/[^0-9]/g,"").slice(0,3));

  const exportVCF=()=>{
    const contacts=[
      {name:"Мавлонбек Юсупов",phone:"+998909876543",slug:"ORG777"},
      {name:"Малика Исмоилова",phone:"+998901112233",slug:"MLK007"},
      {name:"Тимур Рашидов",phone:"+998904445566",slug:"TMR000"},
      {name:"Санжар Ким",phone:"+998932223344",slug:"SNJ002"},
    ];
    const vcf=contacts.map(c=>`BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\nURL:https://unqx.uz/${c.slug}\nNOTE:UNQX Contact\nEND:VCARD`).join("\n\n");
    const blob=new Blob([vcf],{type:"text/vcard"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="unqx-contacts.vcf"; a.click();
    URL.revokeObjectURL(url);
  };
  const exportCSV=()=>{
    const rows=[["Имя","Телефон","UNQ","Тапов"],["Мавлонбек Юсупов","+998909876543","ORG777","3"],["Малика Исмоилова","+998901112233","MLK007","1"],["Тимур Рашидов","+998904445566","TMR000","7"],["Санжар Ким","+998932223344","SNJ002","2"]];
    const csv=rows.map(r=>r.join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="unqx-contacts.csv"; a.click(); URL.revokeObjectURL(url);
  };

  useEffect(()=>()=>clearTimeout(timerRef.current),[]);

  const NAV=[{id:"home",label:"Главная",Icon:IcoHome},{id:"nfc",label:"NFC",Icon:IcoNFC},{id:"people",label:"Люди",Icon:IcoPeople},{id:"analytics",label:"Аналитика",Icon:IcoChart},{id:"profile",label:"Профиль",Icon:IcoUser}];

  return(
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
      body{background:${T.bg};display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',sans-serif;transition:background 0.4s;}
      @keyframes nfcP{0%{transform:scale(0.6);opacity:0.6;}100%{transform:scale(1);opacity:0;}}
      @keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
      @keyframes pageIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      @keyframes successPop{0%{transform:scale(0.75);opacity:0;}65%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;}}
      @keyframes dotBlink{0%,80%,100%{opacity:0.18;transform:scale(0.78);}40%{opacity:1;transform:scale(1);}}
      @keyframes barGrow{from{transform:scaleY(0);}to{transform:scaleY(1);}}
      @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
      .page{animation:pageIn 0.28s ease both;}
      .card-r{animation:fadeSlideUp 0.4s ease both;}
      .s-pop{animation:successPop 0.42s cubic-bezier(0.34,1.56,0.64,1) both;}
      .dot{width:6px;height:6px;border-radius:50%;}
      .dot:nth-child(1){animation:dotBlink 1.2s ease 0s infinite;}
      .dot:nth-child(2){animation:dotBlink 1.2s ease 0.2s infinite;}
      .dot:nth-child(3){animation:dotBlink 1.2s ease 0.4s infinite;}
      .wtab{flex:1;padding:8px 0;font-size:12px;font-weight:500;border:none;cursor:pointer;background:transparent;font-family:'Inter',sans-serif;letter-spacing:0.2px;transition:color 0.25s;}
      .nb{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;border:none;background:transparent;padding:0;}
      .btn{width:100%;padding:13px 16px;border-radius:10px;font-family:'Inter',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;}
      .btn:active{transform:scale(0.97);}
      .btn-p{background:${T.accent};border:1.5px solid ${T.accent};color:${T.accentText};font-weight:600;}
      .btn-g{background:${T.surface};border:1.5px solid ${T.border};color:${T.text};}
      .wi{padding:12px 14px;border-radius:10px;color:${T.text};font-family:'Inter',sans-serif;font-size:20px;font-weight:700;outline:none;letter-spacing:4px;text-align:center;text-transform:uppercase;width:100%;transition:border-color 0.25s;}
      .wi::placeholder{color:${T.textMuted};font-weight:300;letter-spacing:1px;font-size:14px;text-transform:none;}
      ::-webkit-scrollbar{width:0;}
    `}</style>

    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,padding:20}}>
      {/* Brand */}
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:T.text,letterSpacing:4,transition:"color 0.4s"}}>UNQX</div>
          <div style={{fontSize:9.5,color:T.textMuted,letterSpacing:2.5,textTransform:"uppercase",marginTop:1}}>NFC Manager</div>
        </div>
        <div onClick={()=>{if(!autoTheme){reset();setTheme(t=>t==="light"?"dark":"light");}}}
          style={{width:40,height:22,borderRadius:11,background:T.surface,border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",padding:"0 3px",transition:"background 0.4s",opacity:autoTheme?0.4:1}}>
          <div style={{width:16,height:16,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:T.accentText,transform:`translateX(${theme==="dark"?"18px":"0"})`,transition:"transform 0.35s cubic-bezier(0.34,1.4,0.64,1),background 0.4s"}}>
            {theme==="light"?"☀":"☽"}
          </div>
        </div>
        {autoTheme&&<div style={{fontSize:10,color:T.textMuted}}>авто</div>}
      </div>

      {/* Phone */}
      <div style={{width:375,background:T.phoneBg,borderRadius:44,overflow:"hidden",position:"relative",boxShadow:T.shadow,transition:"background 0.4s,box-shadow 0.4s",display:"flex",flexDirection:"column",minHeight:720}}>
        {/* Status bar */}
        <div style={{padding:"14px 26px 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:500,color:T.textMuted,transition:"color 0.4s"}}>{new Date().getHours()}:{String(new Date().getMinutes()).padStart(2,"0")}</span>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {[3,4,5].map(h=><div key={h} style={{width:3,height:h,background:T.textMuted,borderRadius:1.5}}/>)}
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" style={{marginLeft:2}}><path d="M1 4C3 2,5.5 1,7.5 1C9.5 1,12 2,14 4" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/><path d="M3 6.5C4.5 5,6 4.3,7.5 4.3C9 4.3,10.5 5,12 6.5" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/><circle cx="7.5" cy="9.5" r="1.2" fill={T.textMuted}/></svg>
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none"><rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke={T.textMuted}/><rect x="2" y="2" width="14" height="7" rx="1.5" fill={T.textMuted}/><path d="M22 3.8V7.2C22.8 7,23.5 6.5,23.5 5.5C23.5 4.5,22.8 4,22 3.8Z" fill={T.textMuted}/></svg>
          </div>
        </div>
        {/* Top bar */}
        <div style={{padding:"14px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:23,fontWeight:600,color:T.text}}>
            {page==="home"?"Главная":page==="nfc"?"NFC":page==="people"?"Люди":page==="analytics"?"Аналитика":"Профиль"}
          </div>
          <button onClick={()=>{setShowNotif(true);setNotifDot(false);}} style={{background:"none",border:"none",cursor:"pointer",position:"relative",marginTop:4}}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2C7.7 2 5 4.7 5 8v3l-2 3h16l-2-3V8c0-3.3-2.7-6-6-6Z" stroke={T.text} strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 17c0 1.1.9 2 2 2s2-.9 2-2" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
            {notifDot&&<div style={{position:"absolute",top:0,right:0,width:8,height:8,borderRadius:"50%",background:T.accent,border:`2px solid ${T.phoneBg}`}}/>}
          </button>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto"}}>
          {page==="home"      && <HomePage T={T} switchPage={switchPage} setShowShare={setShowShare} card={card}/>}
          {page==="nfc"       && <NFCPage T={T} nfcTab={nfcTab} switchNfc={switchNfc} scanState={scanState} isActive={isActive} scannedData={scannedData} letters={letters} digits={digits} slugReady={slugReady} batchCount={batchCount} lockPass={lockPass} setLockPass={setLockPass} digitsRef={digitsRef} handleLetters={handleLetters} handleDigits={handleDigits} startScan={startScan} startWrite={startWrite} startVerify={startVerify} startLock={startLock} nextBatch={nextBatch} reset={reset}/>}
          {page==="people"    && <PeoplePage T={T} peopleTab={peopleTab} setPeopleTab={setPeopleTab} savedContacts={savedContacts} setSavedContacts={setSavedContacts} subscribedTo={subscribedTo} setSubscribedTo={setSubscribedTo} exportVCF={exportVCF} exportCSV={exportCSV}/>}
          {page==="analytics" && <AnalyticsPage T={T}/>}
          {page==="profile"   && <ProfilePage T={T} theme={theme} setTheme={setTheme} autoTheme={autoTheme} setAutoTheme={setAutoTheme} reset={reset} setShowShare={setShowShare} setShowCardEditor={setShowCardEditor} setShowWristband={setShowWristband} card={card}/>}
        </div>

        {/* Nav */}
        <div style={{borderTop:`1px solid ${T.navBorder}`,display:"flex",padding:"10px 4px 28px",flexShrink:0,background:T.phoneBg,transition:"background 0.4s,border-color 0.4s"}}>
          {NAV.map(({id,label,Icon})=>{const a=page===id;return(
            <button key={id} className="nb" onClick={()=>switchPage(id)} style={{opacity:a?1:0.3}}>
              <Icon color={a?T.accent:T.text} size={20}/><div style={{fontSize:9.5,color:a?T.accent:T.text}}>{label}</div>
              {a&&<div style={{width:4,height:4,borderRadius:"50%",background:T.accent}}/>}
            </button>
          );})}
        </div>

        {/* Overlays */}
        {showNotif    && <NotifPanel T={T} onClose={()=>setShowNotif(false)}/>}
        {showShare    && <ShareSheet T={T} slug={card.slug} onClose={()=>setShowShare(false)}/>}
        {showPreview  && <CardPreview T={T} card={card} onClose={()=>setShowPreview(false)}/>}
        {showCardEditor && <CardEditor T={T} card={card} setCard={setCard} onClose={()=>setShowCardEditor(false)} onPreview={()=>{setShowCardEditor(false);setShowPreview(true);}}/>}
        {showWristband && <WristbandPage T={T} onBack={()=>setShowWristband(false)}/>}
      </div>

      <div style={{fontSize:9.5,color:T.textMuted,letterSpacing:2.5,textTransform:"uppercase"}}>unqx.uz · NFC App Concept</div>
    </div>
    </>
  );
}

/* ── HOME ── */
function HomePage({T,switchPage,setShowShare,card}){
  const [count,setCount]=useState(0);
  useEffect(()=>{let c=0;const t=setInterval(()=>{c=Math.min(c+9,247);setCount(c);if(c>=247)clearInterval(t);},30);return()=>clearInterval(t);},[]);
  return(
    <div className="page" style={{padding:"14px 20px 24px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:T.accent,borderRadius:18,padding:"20px 22px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-16,top:-16,width:90,height:90,borderRadius:"50%",background:`${T.accentText}07`}}/>
        <div style={{fontSize:10,color:`${T.accentText}60`,letterSpacing:2.5,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>Добро пожаловать</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.accentText}}>{card.name}</div>
        <div style={{fontSize:13,color:`${T.accentText}70`,marginTop:3,letterSpacing:1}}>unqx.uz/{card.slug}</div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <span style={{background:`${T.accentText}14`,borderRadius:6,padding:"4px 10px",fontSize:11,color:T.accentText,fontWeight:500}}>Премиум</span>
          <span style={{background:`${T.accentText}14`,borderRadius:6,padding:"4px 10px",fontSize:11,color:T.accentText,fontWeight:500}}>● NFC активен</span>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button onClick={()=>setShowShare(true)} style={{flex:1,padding:"10px",background:`${T.accentText}18`,border:"none",borderRadius:8,color:T.accentText,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>↗ Поделиться</button>
          <button onClick={()=>setShowShare(true)} style={{flex:1,padding:"10px",background:`${T.accentText}18`,border:"none",borderRadius:8,color:T.accentText,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>⬛ QR-код</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[{l:"Сегодня",v:"24",s:"↑ +8 вчера"},{l:"Всего тапов",v:String(count),s:"↑ +32% месяц"}].map(({l,v,s})=>(
          <div key={l} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
            <Label T={T}>{l}</Label>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:T.text,lineHeight:1,marginTop:8}}>{v}</div>
            <div style={{fontSize:11,color:T.green,marginTop:6,fontWeight:500}}>{s}</div>
          </div>
        ))}
      </div>
      <Label T={T}>Быстрые действия</Label>
      {[{l:"Сканировать NFC",s:"Прочитать чужую метку",i:"◎",p:"nfc"},{l:"Записать метку",s:"Привязать UNQ к NFC",i:"⊕",p:"nfc"},{l:"Аналитика",s:"Статистика и карта тапов",i:"⊙",p:"analytics"}].map(({l,s,i,p})=>(
        <div key={l} onClick={()=>switchPage(p)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,cursor:"pointer"}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:`${T.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.accent}}>{i}</div>
          <div style={{flex:1}}><div style={{fontSize:14,color:T.text,fontWeight:500}}>{l}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s}</div></div>
          <Chevron T={T}/>
        </div>
      ))}
      <Label T={T}>Последние тапы</Label>
      {[{n:"Мавлонбек",s:"ORG777",t:"5 мин"},{n:"Малика",s:"MLK007",t:"1 час"},{n:"Тимур",s:"TMR000",t:"3 часа"}].map((u,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:T.accent}}>{u.n[0]}</div>
            <div><div style={{fontSize:13,color:T.text,fontWeight:500}}>{u.n}</div><div style={{fontSize:11,color:T.textMuted}}>unqx.uz/{u.s}</div></div>
          </div>
          <div style={{fontSize:11,color:T.textMuted}}>{u.t} назад</div>
        </div>
      ))}
    </div>
  );
}

/* ── NFC PAGE ── */
function NFCPage({T,nfcTab,switchNfc,scanState,isActive,scannedData,letters,digits,slugReady,batchCount,lockPass,setLockPass,digitsRef,handleLetters,handleDigits,startScan,startWrite,startVerify,startLock,nextBatch,reset}){
  const tabs=[["read","Читать"],["write","Записать"],["verify","Проверить"],["batch","Batch"],["lock","Защита"]];
  return(
    <div className="page" style={{padding:"12px 20px 24px",display:"flex",flexDirection:"column",gap:12}}>
      <div style={{overflowX:"auto"}}>
        <div style={{background:T.surface,borderRadius:10,padding:3,display:"flex",gap:2,width:"max-content",minWidth:"100%"}}>
          {tabs.map(([id,label])=>(
            <button key={id} className="wtab" onClick={()=>switchNfc(id)} style={{borderRadius:8,color:nfcTab===id?T.tabActiveText:T.tabInactive,background:nfcTab===id?T.tabActiveBg:"transparent",padding:"7px 12px",fontSize:12,fontWeight:nfcTab===id?600:400}}>{label}</button>
          ))}
        </div>
      </div>

      {nfcTab==="read"&&<>
        <ScanArea active={isActive} T={T} onClick={scanState===SCAN.IDLE?startScan:undefined} minH={250}>
          {scanState===SCAN.IDLE&&<><NFCRings active={false} T={T}/><div style={{marginTop:10,fontSize:13,color:T.textMuted}}>Нажми для сканирования</div></>}
          {scanState===SCAN.SCANNING&&<><NFCRings active T={T}/><DotsLoader T={T}/><div style={{marginTop:6,fontSize:12,color:T.textMuted}}>Поднеси метку...</div></>}
          {scanState===SCAN.SUCCESS&&scannedData&&(
            <div className="card-r" style={{padding:"0 20px",width:"100%",textAlign:"center"}}>
              <div className="s-pop" style={{display:"flex",justifyContent:"center",marginBottom:12}}><CheckCircle T={T}/></div>
              <div style={{fontSize:10,color:T.textMuted,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Метка прочитана</div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px",textAlign:"left",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:11}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.accent}}>{scannedData.name[0]}</div>
                  <div><div style={{fontSize:15,color:T.text,fontWeight:600}}>{scannedData.name}</div><Pill color={T.amber} bg={T.amberBg}>{scannedData.tag}</Pill></div>
                </div>
                <Row T={T} label="UNQ" value={`unqx.uz/${scannedData.slug}`}/>
                <Row T={T} label="Тел" value={scannedData.phone}/>
                <Row T={T} label="UID" value={scannedData.uid} last/>
              </div>
            </div>
          )}
        </ScanArea>
        {scanState===SCAN.IDLE&&<button className="btn btn-p" onClick={startScan}>Сканировать NFC</button>}
        {scanState===SCAN.SUCCESS&&<div style={{display:"flex",gap:10}}><button className="btn btn-g" onClick={reset} style={{flex:1}}>Ещё раз</button><button className="btn btn-p" style={{flex:1}}>Открыть</button></div>}
        <NFCHistory T={T}/>
      </>}

      {nfcTab==="write"&&<>
        <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}><Label T={T}>Буквы</Label><input className="wi" value={letters} onChange={e=>handleLetters(e.target.value)} placeholder="ABC" maxLength={3} disabled={[SCAN.WRITING,SCAN.WRITTEN].includes(scanState)} style={{background:T.inputBg,border:`1.5px solid ${letters.length===3?T.borderStrong:T.border}`}}/></div>
          <div style={{display:"flex",alignItems:"center",paddingTop:22,color:T.textMuted,fontSize:20,fontWeight:200}}>·</div>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}><Label T={T}>Цифры</Label><input ref={digitsRef} className="wi" value={digits} onChange={e=>handleDigits(e.target.value)} placeholder="000" maxLength={3} inputMode="numeric" disabled={[SCAN.WRITING,SCAN.WRITTEN].includes(scanState)} style={{background:T.inputBg,border:`1.5px solid ${digits.length===3?T.borderStrong:T.border}`}}/></div>
        </div>
        <ScanArea active={isActive} T={T} minH={200}>
          {scanState===SCAN.IDLE&&<><NFCRings active={false} T={T}/><div style={{marginTop:10,fontSize:13,color:T.textMuted}}>Поднеси NFC-метку</div></>}
          {scanState===SCAN.WRITING&&<><NFCRings active T={T}/><DotsLoader T={T}/><div style={{marginTop:6,fontSize:12,color:T.textMuted}}>Записываю...</div></>}
          {scanState===SCAN.WRITTEN&&<div className="card-r" style={{textAlign:"center",padding:"0 24px"}}><div className="s-pop" style={{display:"flex",justifyContent:"center",marginBottom:12}}><CheckCircle T={T}/></div><div style={{fontSize:14,color:T.text,fontWeight:600,marginBottom:6}}>Успешно записано</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:T.text,letterSpacing:4,background:T.surface,borderRadius:8,padding:"6px 16px",display:"inline-block"}}>{letters}{digits}</div></div>}
        </ScanArea>
        {scanState===SCAN.IDLE&&<button className={`btn ${slugReady?"btn-p":"btn-g"}`} onClick={startWrite} disabled={!slugReady} style={{opacity:slugReady?1:0.45}}>Записать в метку</button>}
        {scanState===SCAN.WRITTEN&&<button className="btn btn-g" onClick={reset}>Записать ещё</button>}
      </>}

      {nfcTab==="verify"&&<>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 15px",fontSize:13,color:T.textSub,lineHeight:1.6}}>Поднеси любую NFC-метку. Приложение проверит тип, ёмкость и данные.</div>
        <ScanArea active={isActive} T={T} onClick={scanState===SCAN.IDLE?startVerify:undefined} minH={230}>
          {scanState===SCAN.IDLE&&<><NFCRings active={false} T={T}/><div style={{marginTop:10,fontSize:13,color:T.textMuted}}>Нажми чтобы проверить</div></>}
          {scanState===SCAN.VERIFYING&&<><NFCRings active T={T}/><DotsLoader T={T}/><div style={{marginTop:6,fontSize:12,color:T.textMuted}}>Читаю метку...</div></>}
          {scanState===SCAN.VERIFIED&&<div className="card-r" style={{padding:"0 20px",width:"100%"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,justifyContent:"center"}}><div className="s-pop"><CheckCircle T={T}/></div><div style={{fontSize:14,color:T.text,fontWeight:600}}>Метка исправна</div></div>
            {[["Тип","NTAG213"],["Ёмкость","137 байт"],["Занято","24 байт"],["Свободно","113 байт"],["Статус","Без защиты"],["Данные","unqx.uz/ORG777"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:12,color:T.textMuted}}>{k}</span><span style={{fontSize:12,color:T.text,fontWeight:500}}>{v}</span></div>
            ))}
          </div>}
        </ScanArea>
        {scanState===SCAN.IDLE&&<button className="btn btn-p" onClick={startVerify}>Проверить метку</button>}
        {scanState===SCAN.VERIFIED&&<button className="btn btn-g" onClick={reset}>Проверить ещё</button>}
      </>}

      {nfcTab==="batch"&&<>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 15px",fontSize:13,color:T.textSub,lineHeight:1.6}}>Batch-режим: пиши одну ссылку на множество меток подряд.</div>
        <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}><Label T={T}>Буквы</Label><input className="wi" value={letters} onChange={e=>handleLetters(e.target.value)} placeholder="ABC" maxLength={3} style={{background:T.inputBg,border:`1.5px solid ${T.border}`}}/></div>
          <div style={{display:"flex",alignItems:"center",paddingTop:22,color:T.textMuted,fontSize:20,fontWeight:200}}>·</div>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}><Label T={T}>Цифры</Label><input ref={digitsRef} className="wi" value={digits} onChange={e=>handleDigits(e.target.value)} placeholder="000" maxLength={3} inputMode="numeric" style={{background:T.inputBg,border:`1.5px solid ${T.border}`}}/></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:`${T.accent}08`,border:`1px solid ${T.accent}18`,borderRadius:12}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:700,color:T.accent}}>{batchCount}</div>
          <div><div style={{fontSize:13,color:T.text,fontWeight:500}}>Записано меток</div><div style={{fontSize:11,color:T.textMuted}}>/{letters||"___"}{digits||"000"}</div></div>
        </div>
        <ScanArea active={isActive} T={T} minH={150}>
          {scanState===SCAN.IDLE&&<><NFCRings active={false} T={T}/><div style={{marginTop:8,fontSize:13,color:T.textMuted}}>Поднеси метку</div></>}
          {scanState===SCAN.SCANNING&&<><NFCRings active T={T}/><DotsLoader T={T}/></>}
          {scanState===SCAN.WRITTEN&&<div className="card-r" style={{textAlign:"center"}}><div className="s-pop" style={{display:"flex",justifyContent:"center",marginBottom:8}}><CheckCircle T={T}/></div><div style={{fontSize:13,color:T.text,fontWeight:500}}>Метка #{batchCount} записана</div></div>}
        </ScanArea>
        {(scanState===SCAN.IDLE||scanState===SCAN.WRITTEN)&&<button className={`btn ${slugReady?"btn-p":"btn-g"}`} onClick={nextBatch} disabled={!slugReady} style={{opacity:slugReady?1:0.45}}>{scanState===SCAN.WRITTEN?`Следующая #${batchCount+1}`:"Начать запись"}</button>}
        {batchCount>0&&<button className="btn btn-g" onClick={reset}>Завершить · {batchCount} шт.</button>}
      </>}

      {nfcTab==="lock"&&<>
        <div style={{background:T.amberBg,border:`1px solid ${T.amber}30`,borderRadius:12,padding:"13px 15px"}}>
          <div style={{fontSize:12,color:T.amber,fontWeight:600,marginBottom:3}}>⚠ Внимание</div>
          <div style={{fontSize:12,color:T.textSub,lineHeight:1.6}}>Защита паролем блокирует перезапись. Если забудешь — метку нельзя разблокировать.</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          <Label T={T}>Пароль для метки</Label>
          <input type="password" value={lockPass} onChange={e=>setLockPass(e.target.value)} placeholder="••••" maxLength={8} disabled={[SCAN.LOCKING,SCAN.LOCKED].includes(scanState)}
            style={{padding:"12px 14px",background:T.inputBg,border:`1.5px solid ${lockPass?T.borderStrong:T.border}`,borderRadius:10,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:18,outline:"none",letterSpacing:6,textAlign:"center"}}/>
          <div style={{fontSize:11,color:T.textMuted}}>От 4 до 8 символов</div>
        </div>
        <ScanArea active={isActive} T={T} minH={190}>
          {scanState===SCAN.IDLE&&<><NFCRings active={false} T={T}/><div style={{marginTop:10,fontSize:13,color:T.textMuted}}>Поднеси метку для защиты</div></>}
          {scanState===SCAN.LOCKING&&<><NFCRings active T={T}/><DotsLoader T={T}/><div style={{marginTop:6,fontSize:12,color:T.textMuted}}>Устанавливаю пароль...</div></>}
          {scanState===SCAN.LOCKED&&<div className="card-r" style={{textAlign:"center",padding:"0 24px"}}>
            <div className="s-pop" style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="12" fill={T.amberBg} stroke={T.amber} strokeWidth="1.5"/><path d="M9 12V9a4 4 0 018 0v3" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round"/><rect x="7" y="12" width="12" height="8" rx="2" fill={T.amber} opacity="0.9"/></svg>
            </div>
            <div style={{fontSize:14,color:T.text,fontWeight:600}}>Метка защищена</div>
          </div>}
        </ScanArea>
        {scanState===SCAN.IDLE&&<button className={`btn ${lockPass.length>=4?"btn-p":"btn-g"}`} onClick={startLock} disabled={lockPass.length<4} style={{opacity:lockPass.length>=4?1:0.45}}>🔒 Защитить метку</button>}
        {scanState===SCAN.LOCKED&&<button className="btn btn-g" onClick={()=>{reset();setLockPass("");}}>Защитить ещё</button>}
      </>}
    </div>
  );
}

/* ── NFC HISTORY ── */
function NFCHistory({T}){
  const items=[{slug:"ALI001",time:"сегодня, 14:32",type:"read"},{slug:"MLK007",time:"вчера, 18:10",type:"write"},{slug:"TMR000",time:"вчера, 11:45",type:"read"}];
  return(<div style={{marginTop:6}}>
    <Label T={T} style={{marginBottom:12}}>История</Label>
    {items.map((item,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:item.type==="read"?T.surface:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:item.type==="read"?T.textSub:T.accent,fontWeight:600}}>{item.type==="read"?"R":"W"}</div>
          <div><div style={{fontSize:13,color:T.text}}><span style={{color:T.textMuted,fontSize:11}}>unqx.uz/</span><span style={{fontFamily:"'Playfair Display',serif",fontWeight:600,letterSpacing:1}}>{item.slug}</span></div><div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{item.time}</div></div>
        </div>
        <Chevron T={T}/>
      </div>
    ))}
  </div>);
}

/* ── PEOPLE PAGE ── */
function PeoplePage({T,peopleTab,setPeopleTab,savedContacts,setSavedContacts,subscribedTo,setSubscribedTo,exportVCF,exportCSV}){
  const [showExport,setShowExport]=useState(false);
  return(
    <div className="page" style={{padding:"12px 20px 24px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:T.surface,borderRadius:10,padding:3,display:"flex",position:"relative"}}>
        {[["contacts","Контакты"],["directory","Резиденты"],["leaderboard","Elite"]].map(([id,label],idx)=>(
          <button key={id} className="wtab" onClick={()=>setPeopleTab(id)} style={{zIndex:1,color:peopleTab===id?T.tabActiveText:T.tabInactive,background:peopleTab===id?T.tabActiveBg:"transparent",borderRadius:8,padding:"8px 0"}}>{label}</button>
        ))}
      </div>
      {peopleTab==="contacts"&&<ContactsTab T={T} savedContacts={savedContacts} setSavedContacts={setSavedContacts} exportVCF={exportVCF} exportCSV={exportCSV}/>}
      {peopleTab==="directory"&&<DirectoryTab T={T} subscribedTo={subscribedTo} setSubscribedTo={setSubscribedTo}/>}
      {peopleTab==="leaderboard"&&<LeaderboardTab T={T}/>}
    </div>
  );
}

function ContactsTab({T,savedContacts,setSavedContacts,exportVCF,exportCSV}){
  const [filter,setFilter]=useState("all");
  const people=[
    {name:"Мавлонбек Юсупов",slug:"ORG777",phone:"+998 90 987 65 43",taps:3,tag:"Премиум",last:"5 мин назад"},
    {name:"Малика Исмоилова",slug:"MLK007",phone:"+998 90 111 22 33",taps:1,tag:"Базовый",last:"1 час назад"},
    {name:"Тимур Рашидов",slug:"TMR000",phone:"+998 90 444 55 66",taps:7,tag:"Премиум",last:"3 часа назад"},
    {name:"Санжар Ким",slug:"SNJ002",phone:"+998 93 222 33 44",taps:2,tag:"Базовый",last:"вчера"},
  ];
  const toggle=slug=>setSavedContacts(s=>s.includes(slug)?s.filter(x=>x!==slug):[...s,slug]);
  const filtered=filter==="saved"?people.filter(p=>savedContacts.includes(p.slug)):people;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8}}>
        <input placeholder="Поиск..." style={{flex:1,padding:"10px 13px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none"}}/>
        <button onClick={()=>setFilter(f=>f==="all"?"saved":"all")} style={{padding:"10px 13px",background:filter==="saved"?T.accent:T.surface,border:`1px solid ${filter==="saved"?T.accent:T.border}`,borderRadius:10,color:filter==="saved"?T.accentText:T.text,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:500}}>★</button>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={exportVCF} style={{flex:1,padding:"10px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,fontSize:12,color:T.text,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:500}}>↓ Экспорт .vcf</button>
        <button onClick={exportCSV} style={{flex:1,padding:"10px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,fontSize:12,color:T.text,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:500}}>↓ Экспорт .csv</button>
      </div>
      <Label T={T}>{filtered.length} контактов{filter==="saved"?" · Избранные":""}</Label>
      {filtered.map((p,i)=>(
        <div key={i} style={{display:"flex",gap:13,padding:"13px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,animation:`fadeSlideUp 0.3s ease ${i*0.05}s both`}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.accent,flexShrink:0}}>{p.name[0]}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <div style={{fontSize:13,color:T.text,fontWeight:600}}>{p.name}</div>
              <Pill color={p.tag==="Премиум"?T.amber:T.textMuted} bg={p.tag==="Премиум"?T.amberBg:T.surface}>{p.tag}</Pill>
            </div>
            <div style={{fontSize:11,color:T.textMuted}}>unqx.uz/{p.slug} · {p.taps} тапов · {p.last}</div>
          </div>
          <button onClick={()=>toggle(p.slug)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:savedContacts.includes(p.slug)?T.amber:T.border,padding:"0 2px"}}>★</button>
        </div>
      ))}
    </div>
  );
}

function DirectoryTab({T,subscribedTo,setSubscribedTo}){
  const residents=[
    {name:"Алишер К.",slug:"ALI001",city:"Ташкент",tag:"Премиум",taps:247},
    {name:"Мавлонбек Ю.",slug:"ORG777",city:"Ташкент",tag:"Премиум",taps:183},
    {name:"Санжар К.",slug:"SNJ002",city:"Самарканд",tag:"Базовый",taps:94},
    {name:"Малика И.",slug:"MLK007",city:"Ташкент",tag:"Базовый",taps:71},
    {name:"Тимур Р.",slug:"TMR000",city:"Нукус",tag:"Премиум",taps:158},
    {name:"Зафар Н.",slug:"ZFR009",city:"Ташкент",tag:"Премиум",taps:122},
  ];
  const toggle=slug=>setSubscribedTo(s=>s.includes(slug)?s.filter(x=>x!==slug):[...s,slug]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <input placeholder="Поиск резидента..." style={{width:"100%",padding:"10px 13px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none"}}/>
      <Label T={T}>{residents.length} резидентов</Label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {residents.map((r,i)=>(
          <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px",animation:`fadeSlideUp 0.3s ease ${i*0.04}s both`,position:"relative"}}>
            <button onClick={()=>toggle(r.slug)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",cursor:"pointer",fontSize:14,color:subscribedTo.includes(r.slug)?T.accent:T.border,padding:0}}>🔔</button>
            <div style={{width:36,height:36,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:T.accent,marginBottom:10}}>{r.name[0]}</div>
            <div style={{fontSize:13,color:T.text,fontWeight:600,marginBottom:2}}>{r.name}</div>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:6}}>/{r.slug}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <Pill color={r.tag==="Премиум"?T.amber:T.textMuted} bg={r.tag==="Премиум"?T.amberBg:T.surface}>{r.tag}</Pill>
              <div style={{fontSize:11,color:T.textMuted}}>{r.taps}</div>
            </div>
            {subscribedTo.includes(r.slug)&&<div style={{fontSize:9,color:T.accent,marginTop:6,fontWeight:500}}>● Подписан</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardTab({T}){
  const board=[{r:1,n:"Алишер К.",s:"ALI001",t:247,d:"+12"},{r:2,n:"Мавлонбек Ю.",s:"ORG777",t:183,d:"+5"},{r:3,n:"Тимур Р.",s:"TMR000",t:158,d:"+8"},{r:4,n:"Зафар Н.",s:"ZFR009",t:122,d:"+3"},{r:5,n:"Санжар К.",s:"SNJ002",t:94,d:"+1"},{r:6,n:"Малика И.",s:"MLK007",t:71,d:"+2"}];
  const medals=["🥇","🥈","🥉"];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {board.map((u,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:13,padding:"13px 16px",background:i<3?`${T.accent}06`:T.surface,border:`1px solid ${i<3?`${T.accent}18`:T.border}`,borderRadius:12}}>
          <div style={{width:28,fontSize:i<3?20:13,textAlign:"center",flexShrink:0,color:T.textMuted}}>{i<3?medals[i]:u.r}</div>
          <div style={{width:36,height:36,borderRadius:"50%",background:`${T.accent}14`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:T.accent,flexShrink:0}}>{u.n[0]}</div>
          <div style={{flex:1}}><div style={{fontSize:13,color:T.text,fontWeight:600}}>{u.n}</div><div style={{fontSize:11,color:T.textMuted}}>/{u.s}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.text}}>{u.t}</div><div style={{fontSize:10,color:T.green,fontWeight:500}}>{u.d} сег.</div></div>
        </div>
      ))}
    </div>
  );
}

/* ── ANALYTICS ── */
function AnalyticsPage({T}){
  const week=[12,18,9,24,31,19,28],days=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],maxV=Math.max(...week);
  const month=[8,12,7,15,20,14,18,11,9,22,17,24,19,16,13,21,25,18,14,20,23,17,19,22,26,21,18,24,20,28];
  const mapDots=[{x:185,y:68,r:8},{x:178,y:72,r:5},{x:192,y:64,r:3},{x:200,y:75,r:4},{x:172,y:76,r:2},{x:80,y:90,r:3},{x:230,y:55,r:2}];
  return(
    <div className="page" style={{padding:"14px 20px 28px",display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px 20px"}}>
        <Label T={T}>Тапов за 30 дней</Label>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginTop:10}}>
          <div><div style={{fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:700,color:T.text,lineHeight:1}}>486</div><div style={{fontSize:12,color:T.green,marginTop:6,fontWeight:500}}>↑ +32% к прошлому месяцу</div></div>
          <Sparkline data={month} color={T.accent} w={100} h={44}/>
        </div>
      </div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px"}}>
        <Label T={T} style={{marginBottom:16}}>Эта неделя</Label>
        <div style={{display:"flex",gap:6,alignItems:"flex-end",height:76}}>
          {week.map((v,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:10,color:T.textMuted}}>{v}</div>
              <div style={{width:"100%",background:i===4?T.accent:T.border,borderRadius:"3px 3px 0 0",height:`${(v/maxV)*50}px`,transformOrigin:"bottom",animation:`barGrow 0.6s cubic-bezier(0.34,1.2,0.64,1) ${i*0.07}s both`}}/>
              <div style={{fontSize:10,color:i===4?T.text:T.textMuted,fontWeight:i===4?600:400}}>{days[i]}</div>
            </div>
          ))}
        </div>
      </div>
      <Label T={T}>Карта тапов</Label>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",position:"relative"}}>
        <svg viewBox="0 0 327 160" width="100%" style={{display:"block"}}>
          <path d="M40,55 L60,40 L90,35 L120,38 L150,30 L185,35 L220,28 L255,32 L280,40 L290,55 L285,70 L270,80 L260,95 L245,100 L225,98 L205,110 L190,115 L175,108 L160,115 L145,118 L130,110 L115,112 L100,105 L85,110 L70,100 L55,90 L45,75 Z" fill={T.surface} stroke={T.border} strokeWidth="1.5"/>
          {[40,80,120].map(y=><line key={y} x1="0" y1={y} x2="327" y2={y} stroke={T.border} strokeWidth="0.5" strokeDasharray="3,4"/>)}
          {mapDots.map((d,i)=><g key={i}><circle cx={d.x} cy={d.y} r={d.r*2.5} fill={T.accent} opacity="0.08"/><circle cx={d.x} cy={d.y} r={d.r} fill={T.accent} opacity="0.85"/></g>)}
          <text x="178" y="75" fontSize="8" fill={T.textMuted} fontFamily="Inter,sans-serif">Ташкент</text>
        </svg>
      </div>
      <Label T={T}>Источники</Label>
      {[["NFC-браслет",58,282],["QR-код",29,141],["Прямая ссылка",13,63]].map(([l,p,v])=>(
        <div key={l} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:T.text}}>{l}</span><span style={{fontSize:12,color:T.textMuted}}>{v} · {p}%</span></div>
          <div style={{height:5,borderRadius:3,background:T.surface,border:`1px solid ${T.border}`}}><div style={{height:"100%",borderRadius:3,background:T.accent,width:`${p}%`}}/></div>
        </div>
      ))}
    </div>
  );
}

/* ── PROFILE ── */
function ProfilePage({T,theme,setTheme,autoTheme,setAutoTheme,reset,setShowShare,setShowCardEditor,setShowWristband,card}){
  const curH=new Date().getHours();
  const autoLabel=autoTheme?`Авто (${curH>=20||curH<8?"Тёмная":"Светлая"} · ${curH}:00)`:theme==="light"?"Светлая":"Тёмная";
  const Toggle=({on,onToggle})=>(
    <div onClick={onToggle} style={{width:40,height:22,borderRadius:11,background:on?T.accent:T.surface,border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",padding:"0 3px",transition:"background 0.3s"}}>
      <div style={{width:16,height:16,borderRadius:"50%",background:on?T.accentText:T.textMuted,transform:`translateX(${on?"18px":"0"})`,transition:"transform 0.3s cubic-bezier(0.34,1.4,0.64,1)"}}/>
    </div>
  );
  return(
    <div className="page" style={{padding:"14px 20px 28px",display:"flex",flexDirection:"column",gap:14}}>
      {/* Avatar */}
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"18px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:16}}>
        <div style={{width:58,height:58,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.accentText,flexShrink:0}}>{card.name[0]}</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:T.text}}>{card.name}</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>unqx.uz/<span style={{fontFamily:"'Playfair Display',serif",letterSpacing:1,fontWeight:600}}>{card.slug}</span></div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <Pill color={T.amber} bg={T.amberBg}>Премиум</Pill>
            <Pill color={T.green} bg={T.greenBg}>● NFC активен</Pill>
          </div>
        </div>
      </div>
      {/* QR + Share */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>setShowShare(true)} style={{padding:"14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer"}}>
          <div style={{fontSize:22}}>⬛</div><div style={{fontSize:12,color:T.text,fontWeight:500}}>QR-код</div><div style={{fontSize:10,color:T.textMuted}}>Скачать или показать</div>
        </button>
        <button onClick={()=>setShowShare(true)} style={{padding:"14px",background:T.accent,border:`1px solid ${T.accent}`,borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer"}}>
          <div style={{fontSize:22,color:T.accentText}}>↗</div><div style={{fontSize:12,color:T.accentText,fontWeight:600}}>Поделиться</div><div style={{fontSize:10,color:`${T.accentText}70`}}>WhatsApp, Telegram...</div>
        </button>
      </div>
      {/* Actions */}
      {[
        {l:"Редактировать визитку",s:"Имя, ссылки, тема, кнопки",fn:()=>setShowCardEditor(true)},
        {l:"Браслет и метки",s:"Статус, история, заказ",fn:()=>setShowWristband(true)},
      ].map(({l,s,fn})=>(
        <div key={l} onClick={fn} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,cursor:"pointer"}}>
          <div style={{flex:1}}><div style={{fontSize:14,color:T.text,fontWeight:500}}>{l}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s}</div></div>
          <Chevron T={T}/>
        </div>
      ))}
      {/* Widgets */}
      <WidgetPreview T={T} taps={24}/>
      {/* Settings */}
      <Label T={T}>Настройки</Label>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"0 16px"}}>
        {[
          {l:"Тема",s:autoLabel,toggle:true,on:theme==="dark"&&!autoTheme,fn:()=>{if(!autoTheme){reset();setTheme(t=>t==="light"?"dark":"light");}},noToggle:autoTheme},
          {l:"Авто-тема (по времени)",s:"Тёмная 20:00–08:00",toggle:true,on:autoTheme,fn:()=>setAutoTheme(a=>!a)},
          {l:"Уведомления",s:"Тапы и активность",toggle:true,on:true,fn:()=>{}},
          {l:"Язык",s:"Русский"},
          {l:"Поддержка",s:"@unqx_uz"},
          {l:"О приложении",s:"UNQX v2.0.0",last:true},
        ].map(({l,s,toggle,on,fn,last,noToggle})=>(
          <div key={l} onClick={fn} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 0",borderBottom:last?"none":`1px solid ${T.border}`,cursor:fn?"pointer":"default"}}>
            <div><div style={{fontSize:14,color:T.text}}>{l}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s}</div></div>
            {toggle&&!noToggle?<div onClick={e=>{e.stopPropagation();fn&&fn();}} style={{width:40,height:22,borderRadius:11,background:on?T.accent:T.surface,border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",padding:"0 3px",transition:"background 0.3s"}}><div style={{width:16,height:16,borderRadius:"50%",background:on?T.accentText:T.textMuted,transform:`translateX(${on?"18px":"0"})`,transition:"transform 0.3s cubic-bezier(0.34,1.4,0.64,1)"}}/></div>:<Chevron T={T}/>}
          </div>
        ))}
      </div>
      <button style={{padding:"14px",borderRadius:12,background:"transparent",border:`1.5px solid ${T.border}`,color:T.red,fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:500,cursor:"pointer"}}>Выйти из аккаунта</button>
    </div>
  );
}

/* ── NAV ICONS ── */
const IcoHome=({color,size})=><svg width={size} height={size} viewBox="0 0 20 20" fill="none"><path d="M3 8.5L10 2.5L17 8.5V17H12.5V12.5H7.5V17H3V8.5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" style={{transition:"stroke 0.3s"}}/></svg>;
const IcoNFC=({color,size})=><svg width={size} height={size} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.2" fill={color} style={{transition:"fill 0.3s"}}/><path d="M6.5 6.5C5.5 7.5 5 8.7 5 10s.5 2.5 1.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/><path d="M13.5 6.5C14.5 7.5 15 8.7 15 10s-.5 2.5-1.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/><path d="M4 4C2.2 5.8 1.5 7.8 1.5 10s.7 4.2 2.5 6" stroke={color} strokeWidth="1.3" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/><path d="M16 4c1.8 1.8 2.5 3.8 2.5 6s-.7 4.2-2.5 6" stroke={color} strokeWidth="1.3" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/></svg>;
const IcoPeople=({color,size})=><svg width={size} height={size} viewBox="0 0 20 20" fill="none"><circle cx="7" cy="7" r="3" stroke={color} strokeWidth="1.5" style={{transition:"stroke 0.3s"}}/><circle cx="14" cy="7" r="2.5" stroke={color} strokeWidth="1.3" style={{transition:"stroke 0.3s"}}/><path d="M1 17c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/><path d="M14 11c2 .4 4 1.6 4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/></svg>;
const IcoChart=({color,size})=><svg width={size} height={size} viewBox="0 0 20 20" fill="none"><path d="M3 14l4.5-5L11 12l6-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{transition:"stroke 0.3s"}}/><path d="M3 17h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/></svg>;
const IcoUser=({color,size})=><svg width={size} height={size} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke={color} strokeWidth="1.5" style={{transition:"stroke 0.3s"}}/><path d="M3 17c0-3.3 3.1-5 7-5s7 1.7 7 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{transition:"stroke 0.3s"}}/></svg>;
