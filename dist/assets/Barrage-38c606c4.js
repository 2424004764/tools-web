import{_ as Z}from"./DetailHeader.vue_vue_type_script_setup_true_lang-e57ac3b2.js";import{_ as G}from"./ToolDetail.vue_vue_type_script_setup_true_lang-34e947e7.js";import{b as X,c as j,f as r,J as K,Z as O,d as q,H as g,I as v,v as H,o as Q,P as Y,$ as ee,a0 as te,n as ne,a1 as le,r as F,i as d,h as S,t as I,T as R,k as ae,j as w,_ as se}from"./index-4b4bc198.js";var T=q({name:"vue3-danmaku",components:{},props:{danmus:{type:Array,required:!0,default:()=>[]},channels:{type:Number,default:0},autoplay:{type:Boolean,default:!0},loop:{type:Boolean,default:!1},useSlot:{type:Boolean,default:!1},debounce:{type:Number,default:100},speeds:{type:Number,default:200},randomChannel:{type:Boolean,default:!1},fontSize:{type:Number,default:18},top:{type:Number,default:4},right:{type:Number,default:0},isSuspend:{type:Boolean,default:!1},extraStyle:{type:String,default:""}},emits:["list-end","play-end","dm-over","dm-out","update:danmus"],setup(u,{emit:e,slots:c}){let p=g(document.createElement("div")),a=g(document.createElement("div"));const y=g(0),B=g(0);let t=0;const x=g(0),E=g(0),f=g(0),C=g(!1),k=g(!1),s=g({}),m=function(o,i,n="modelValue"){return v({get:()=>o[n],set:l=>{i(`update:${n}`,l)}})}(u,e,"danmus"),h=H({channels:v(()=>u.channels||x.value),autoplay:v(()=>u.autoplay),loop:v(()=>u.loop),useSlot:v(()=>u.useSlot),debounce:v(()=>u.debounce),randomChannel:v(()=>u.randomChannel)}),_=H({height:v(()=>E.value),fontSize:v(()=>u.fontSize),speeds:v(()=>u.speeds),top:v(()=>u.top),right:v(()=>u.right)});function W(){U(),u.isSuspend&&function(){let o=[];a.value.addEventListener("mouseover",i=>{let n=i.target;n.className.includes("dm")||(n=n.closest(".dm")||n),n.className.includes("dm")&&(o.includes(n)||(e("dm-over",{el:n}),n.classList.add("pause"),o.push(n)))}),a.value.addEventListener("mouseout",i=>{let n=i.target;n.className.includes("dm")||(n=n.closest(".dm")||n),n.className.includes("dm")&&(e("dm-out",{el:n}),n.classList.remove("pause"),o.forEach(l=>{l.classList.remove("pause")}),o=[])})}(),h.autoplay&&M()}function U(){if(y.value=p.value.offsetWidth,B.value=p.value.offsetHeight,y.value===0||B.value===0)throw new Error("获取不到容器宽高")}function M(){k.value=!1,t||(t=window.setInterval(()=>function(){if(!k.value&&m.value.length)if(f.value>m.value.length-1){const o=a.value.children.length;h.loop&&(o<f.value&&(e("list-end"),f.value=0),P())}else P()}(),h.debounce))}function P(o){const i=h.loop?f.value%m.value.length:f.value,n=o||m.value[i];let l=document.createElement("div");h.useSlot?l=function(L,b){return ee({render:()=>te("div",{},[c.dm&&c.dm({danmu:L,index:b})])}).mount(document.createElement("div"))}(n,i).$el:(l.innerHTML=n,l.setAttribute("style",u.extraStyle),l.style.fontSize=`${_.fontSize}px`,l.style.lineHeight=`${_.fontSize}px`),l.classList.add("dm"),a.value.appendChild(l),l.style.opacity="0",ne(()=>{_.height||(E.value=l.offsetHeight),h.channels||(x.value=Math.floor(B.value/(_.height+_.top)));let L=function(b){let V=[...Array(h.channels).keys()];h.randomChannel&&(V=V.sort(()=>.5-Math.random()));for(let z of V){const N=s.value[z];if(!N||!N.length)return s.value[z]=[b],b.addEventListener("animationend",()=>s.value[z].splice(0,1)),z%h.channels;for(let $=0;$<N.length;$++){const D=J(N[$])-10;if(D<=.88*(b.offsetWidth-N[$].offsetWidth)||D<=0)break;if($===N.length-1)return s.value[z].push(b),b.addEventListener("animationend",()=>s.value[z].splice(0,1)),z%h.channels}}return-1}(l);if(L>=0){const b=l.offsetWidth,V=_.height;l.classList.add("move"),l.dataset.index=`${i}`,l.dataset.channel=L.toString(),l.style.opacity="1",l.style.top=L*(V+_.top)+"px",l.style.width=b+_.right+"px",l.style.setProperty("--dm-scroll-width",`-${y.value+b}px`),l.style.left=`${y.value}px`,l.style.animationDuration=y.value/_.speeds+"s",l.addEventListener("animationend",()=>{Number(l.dataset.index)!==m.value.length-1||h.loop||e("play-end",l.dataset.index),a.value&&a.value.removeChild(l)}),f.value++}else a.value.removeChild(l)})}function J(o){const i=o.offsetWidth||parseInt(o.style.width),n=o.getBoundingClientRect().right||a.value.getBoundingClientRect().right+i;return a.value.getBoundingClientRect().right-n}function A(){clearInterval(t),t=0,f.value=0}return Q(()=>{W()}),Y(()=>{A()}),{container:p,dmContainer:a,hidden:C,paused:k,danmuList:m,getPlayState:function(){return!k.value},resize:function(){U();const o=a.value.getElementsByClassName("dm");for(let i=0;i<o.length;i++){const n=o[i];n.style.setProperty("--dm-scroll-width",`-${y.value+n.offsetWidth}px`),n.style.left=`${y.value}px`,n.style.animationDuration=y.value/_.speeds+"s"}},play:M,pause:function(){k.value=!0},stop:function(){s.value={},a.value.innerHTML="",k.value=!0,C.value=!1,A()},show:function(){C.value=!1},hide:function(){C.value=!0},reset:function(){E.value=0,W()},add:function(o){if(f.value===m.value.length)return m.value.push(o),m.value.length-1;{const i=f.value%m.value.length;return m.value.splice(i,0,o),i+1}},push:function(o){return m.value.push(o),m.value.length-1},insert:P}}});const oe={ref:"container",class:"vue-danmaku"};(function(u,e){e===void 0&&(e={});var c=e.insertAt;if(typeof document<"u"){var p=document.head||document.getElementsByTagName("head")[0],a=document.createElement("style");a.type="text/css",c==="top"&&p.firstChild?p.insertBefore(a,p.firstChild):p.appendChild(a),a.styleSheet?a.styleSheet.cssText=u:a.appendChild(document.createTextNode(u))}})(`.vue-danmaku {
  position: relative;
  overflow: hidden;
}
.vue-danmaku .danmus {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  -webkit-transition: all 0.3s;
  transition: all 0.3s;
}
.vue-danmaku .danmus.show {
  opacity: 1;
}
.vue-danmaku .danmus.paused .dm.move {
  animation-play-state: paused;
}
.vue-danmaku .danmus .dm {
  position: absolute;
  font-size: 20px;
  color: #ddd;
  white-space: pre;
  transform: translateX(0);
  transform-style: preserve-3d;
}
.vue-danmaku .danmus .dm.move {
  will-change: transform;
  animation-name: moveLeft;
  animation-timing-function: linear;
  animation-play-state: running;
}
.vue-danmaku .danmus .dm.pause {
  animation-play-state: paused;
  z-index: 100;
}
@keyframes moveLeft {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--dm-scroll-width));
  }
}
@-webkit-keyframes moveLeft {
  from {
    -webkit-transform: translateX(0);
  }
  to {
    -webkit-transform: translateX(var(--dm-scroll-width));
  }
}`),T.render=function(u,e,c,p,a,y){return X(),j("div",oe,[r("div",{ref:"dmContainer",class:K(["danmus",{show:!u.hidden},{paused:u.paused}])},null,2),O(u.$slots,"default")],512)},T.__file="src/lib/Danmaku.vue";const ue={class:"flex flex-col mt-3 flex-1"},ie={class:"p-4 rounded-2xl bg-white"},de={class:"flex mb-2"},re={class:"w-72"},me={class:"flex mb-2"},pe={class:"w-72 ml-2"},fe={class:"flex mb-2"},ve={class:"w-72 ml-2"},ce={class:"flex mb-2"},ye={class:"flex mb-2"},he=q({__name:"Barrage",setup(u){const e=H({title:"手持弹幕",content:"工具坊",barrage:[],speed:200,textSize:500,textColor:"#FFFFFF",bgColor:"#000000",channels:1,extraStyle:"",danmakuFullStyle:"",isPlay:!1,danmakuFullHeight:"100%",danmakuFullWidth:"100%"}),c=g(null),p=()=>{e.isPlay?(a("visibility: hidden;"),c.value.resize(),c.value.stop(),e.isPlay=!1):(a(),y(),c.value.resize(),c.value.play(),e.isPlay=!0)},a=(B="")=>{e.extraStyle="color: "+e.textColor+";font-size: "+e.textSize+"px",e.danmakuFullStyle="z-index: 99; position: fixed; top: 0px; left: 0px; height:"+e.danmakuFullHeight+"; width:"+e.danmakuFullWidth+"; background-color:"+e.bgColor+";"+B},y=()=>{e.barrage[0]=e.content};return le(()=>{a("visibility: hidden;")}),(B,t)=>{const x=F("el-text"),E=F("el-input"),f=F("el-slider"),C=F("el-color-picker"),k=F("el-button");return X(),j("div",ue,[d(Z,{title:e.title},null,8,["title"]),d(ae(T),{ref_key:"danmakuFullRef",ref:c,danmus:e.barrage,"onUpdate:danmus":t[0]||(t[0]=s=>e.barrage=s),loop:"",autoplay:!1,speeds:e.speed,channels:e.channels,extraStyle:e.extraStyle,style:R(e.danmakuFullStyle),onDblclick:p,useSlot:!0},{dm:S(({danmu:s})=>[r("div",{class:"",style:R(e.extraStyle)},[r("span",null,I(s),1)],4)]),_:1},8,["danmus","speeds","channels","extraStyle","style"]),r("div",ie,[r("div",de,[d(x,{class:"w-20"},{default:S(()=>t[8]||(t[8]=[w("弹幕内容:",-1)])),_:1,__:[8]}),r("div",re,[d(E,{modelValue:e.content,"onUpdate:modelValue":t[1]||(t[1]=s=>e.content=s),type:"textarea",rows:3},null,8,["modelValue"])])]),r("div",me,[d(x,{class:"w-20"},{default:S(()=>t[9]||(t[9]=[w("播放速度:",-1)])),_:1,__:[9]}),r("div",pe,[d(f,{modelValue:e.speed,"onUpdate:modelValue":t[2]||(t[2]=s=>e.speed=s),min:1,max:500},null,8,["modelValue"])])]),r("div",fe,[d(x,{class:"w-20"},{default:S(()=>t[10]||(t[10]=[w("文字大小:",-1)])),_:1,__:[10]}),r("div",ve,[d(f,{modelValue:e.textSize,"onUpdate:modelValue":t[3]||(t[3]=s=>e.textSize=s),min:12,max:1e3},null,8,["modelValue"])])]),r("div",ce,[d(x,{class:"w-20"},{default:S(()=>t[11]||(t[11]=[w("文字颜色:",-1)])),_:1,__:[11]}),r("div",null,[d(C,{modelValue:e.textColor,"onUpdate:modelValue":t[4]||(t[4]=s=>e.textColor=s),size:"large",onChange:t[5]||(t[5]=s=>a())},null,8,["modelValue"])])]),r("div",ye,[d(x,{class:"w-20"},{default:S(()=>t[12]||(t[12]=[w("背景颜色:",-1)])),_:1,__:[12]}),r("div",null,[d(C,{modelValue:e.bgColor,"onUpdate:modelValue":t[6]||(t[6]=s=>e.bgColor=s),size:"large",onChange:t[7]||(t[7]=s=>a())},null,8,["modelValue"])])]),r("div",null,[d(k,{onClick:p,type:"primary",class:"mr-3"},{default:S(()=>[w(I(e.isPlay==!1?"播放":"暂停"),1)]),_:1}),d(x,null,{default:S(()=>t[13]||(t[13]=[w("双击可退出弹幕",-1)])),_:1,__:[13]})])]),d(G,{title:"描述"},{default:S(()=>[d(x,null,{default:S(()=>t[14]||(t[14]=[w(" 手持弹幕是一种新型的互动沟通工具，可以方便地为各种户外活动、演出嘉年华等活动增加趣味性和互动性。手持弹幕具有轻便、易携带、易操作等优点，可以让每个参与者都变成活动的一部分。同时，手持弹幕还可以通过预先编写的文本、表情等形式，表达参与者的情感和想法，实现沟通互动。在社交媒体时代，手持弹幕的使用也带来了更广泛的社交效应，增加了活动的互动性和传播度。无论是举办方还是参与者，手持弹幕都是一个非常有价值的互动工具。 ",-1)])),_:1,__:[14]})]),_:1})])}}});const be=se(he,[["__scopeId","data-v-13705924"]]);export{be as default};
