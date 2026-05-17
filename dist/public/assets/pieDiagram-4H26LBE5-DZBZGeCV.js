import{L as K,aC as Q,M as Y,aD as tt,P as et,aF as at,a as d,ai as R,O as nt,m as rt,aB as it,ao as st,w as ot,n as lt,F as ct}from"./mermaid.core-COhJax9e.js";import{p as ut}from"./chunk-4BX2VUAB-DCP06f8J.js";import{p as dt}from"./wardley-L42UT6IY-Dnd5EqZ0.js";import{d as I}from"./arc-B3wzVO4s.js";import{l as S,aa as F,d as pt,Z as gt}from"./index-BVvuh-4p.js";function ft(t,a){return a<t?-1:a>t?1:a>=t?0:NaN}function ht(t){return t}function mt(){var t=ht,a=ft,f=null,w=S(0),s=S(F),p=S(0);function o(e){var r,l=(e=pt(e)).length,g,h,v=0,c=new Array(l),i=new Array(l),x=+w.apply(this,arguments),y=Math.min(F,Math.max(-F,s.apply(this,arguments)-x)),m,D=Math.min(Math.abs(y)/l,p.apply(this,arguments)),$=D*(y<0?-1:1),u;for(r=0;r<l;++r)(u=i[c[r]=r]=+t(e[r],r,e))>0&&(v+=u);for(a!=null?c.sort(function(A,C){return a(i[A],i[C])}):f!=null&&c.sort(function(A,C){return f(e[A],e[C])}),r=0,h=v?(y-l*$)/v:0;r<l;++r,x=m)g=c[r],u=i[g],m=x+(u>0?u*h:0)+$,i[g]={data:e[g],index:r,value:u,startAngle:x,endAngle:m,padAngle:D};return i}return o.value=function(e){return arguments.length?(t=typeof e=="function"?e:S(+e),o):t},o.sortValues=function(e){return arguments.length?(a=e,f=null,o):a},o.sort=function(e){return arguments.length?(f=e,a=null,o):f},o.startAngle=function(e){return arguments.length?(w=typeof e=="function"?e:S(+e),o):w},o.endAngle=function(e){return arguments.length?(s=typeof e=="function"?e:S(+e),o):s},o.padAngle=function(e){return arguments.length?(p=typeof e=="function"?e:S(+e),o):p},o}var vt=ct.pie,W={sections:new Map,showData:!1},T=W.sections,z=W.showData,xt=structuredClone(vt),St=d(()=>structuredClone(xt),"getConfig"),wt=d(()=>{T=new Map,z=W.showData,lt()},"clear"),yt=d(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);T.has(t)||(T.set(t,a),R.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),At=d(()=>T,"getSections"),Ct=d(t=>{z=t},"setShowData"),Dt=d(()=>z,"getShowData"),_={getConfig:St,clear:wt,setDiagramTitle:at,getDiagramTitle:et,setAccTitle:tt,getAccTitle:Y,setAccDescription:Q,getAccDescription:K,addSection:yt,getSections:At,setShowData:Ct,getShowData:Dt},$t=d((t,a)=>{ut(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),Tt={parse:d(async t=>{const a=await dt("pie",t);R.debug(a),$t(a,_)},"parse")},Mt=d(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),kt=Mt,Et=d(t=>{const a=[...t.values()].reduce((s,p)=>s+p,0),f=[...t.entries()].map(([s,p])=>({label:s,value:p})).filter(s=>s.value/a*100>=1);return mt().value(s=>s.value).sort(null)(f)},"createPieArcs"),bt=d((t,a,f,w)=>{R.debug(`rendering pie chart
`+t);const s=w.db,p=nt(),o=rt(s.getConfig(),p.pie),e=40,r=18,l=4,g=450,h=g,v=it(a),c=v.append("g");c.attr("transform","translate("+h/2+","+g/2+")");const{themeVariables:i}=p;let[x]=st(i.pieOuterStrokeWidth);x??=2;const y=o.textPosition,m=Math.min(h,g)/2-e,D=I().innerRadius(0).outerRadius(m),$=I().innerRadius(m*y).outerRadius(m*y);c.append("circle").attr("cx",0).attr("cy",0).attr("r",m+x/2).attr("class","pieOuterCircle");const u=s.getSections(),A=Et(u),C=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let M=0;u.forEach(n=>{M+=n});const L=A.filter(n=>(n.data.value/M*100).toFixed(0)!=="0"),k=gt(C).domain([...u.keys()]);c.selectAll("mySlices").data(L).enter().append("path").attr("d",D).attr("fill",n=>k(n.data.label)).attr("class","pieCircle"),c.selectAll("mySlices").data(L).enter().append("text").text(n=>(n.data.value/M*100).toFixed(0)+"%").attr("transform",n=>"translate("+$.centroid(n)+")").style("text-anchor","middle").attr("class","slice");const V=c.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),B=[...u.entries()].map(([n,b])=>({label:n,value:b})),E=c.selectAll(".legend").data(B).enter().append("g").attr("class","legend").attr("transform",(n,b)=>{const P=r+l,q=P*B.length/2,H=12*r,J=b*P-q;return"translate("+H+","+J+")"});E.append("rect").attr("width",r).attr("height",r).style("fill",n=>k(n.label)).style("stroke",n=>k(n.label)),E.append("text").attr("x",r+l).attr("y",r-l).text(n=>s.getShowData()?`${n.label} [${n.value}]`:n.label);const U=Math.max(...E.selectAll("text").nodes().map(n=>n?.getBoundingClientRect().width??0)),Z=h+e+r+l+U,G=V.node()?.getBoundingClientRect().width??0,j=h/2-G/2,X=h/2+G/2,N=Math.min(0,j),O=Math.max(Z,X)-N;v.attr("viewBox",`${N} 0 ${O} ${g}`),ot(v,g,O,o.useMaxWidth)},"draw"),Ft={draw:bt},Nt={parser:Tt,db:_,renderer:Ft,styles:kt};export{Nt as diagram};
