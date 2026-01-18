# Instructions
Please create a js bookmarklet app for the purpose specified below. 

## Coding Standards
The bookmarklet is quite extensive and bookmarklets are notoriously hard to debug so it's very important that the code follows these conventions meticulously:
* multiline, human readable
* precede the whole code with "javascript:""
* /* */ style comments ONLY
* Log everything that happens and the state the bookmarklet app is in using:
  * console.debug (for documenting every relevant detail going on and to help debugging by making the state the app "thinks" it is in explicit)
  * console.log (for key events)
  * console.warn (for things that are not as expected that might indicate a problem)
  * console.error  (for things that definitely are errors or that prevent the script from continuing in a meaningful way)

## Purpose
The purpose of the bookmarklet is to enable people who need to create user manuals/documentation for a webapp, to easily take screenshots of: 
* a complete browser window
* a certain areas of a web app
* a certain element of a web app

## Libraries available
The bookmarklet may assume that html2canvas 
`location.origin + "/third-party/html2canvas/html2canvas.min.js"`

## Visual Appearance
When activated it should show a small overlay dialog that can be dragged around to any place in the browser window by grabbing it in the title bar.
Please ensure that it is always on top of everything else.

It should have a radio button selection labeled "Screenshot Type" with these options available
* "Whole Window"
* "Select Area"
* "Select Element(s)"

then it should have a text input labeled "Label"
the default value for this input should be:
"unknown"

then it should have a text input labeled "File Name"
the default value for this input should be:
"screenshot-<LABEL>-<NUMBER>--<DAY>-<TIME>.png"

then it should have a numeric input labeled "Delay (seconds)"
the default value for this input should be: "1"

then it should have an area that hosts the "Dynamic Inputs" that are described in detail below.

In the bottom it should have two buttons: one "Take Screenshot" and one "Close" button

### Dynamic Inputs
Depending on what "Screenshot Type" the user selects, the area for the "Dynamic Inputs" gets filled with different controls

#### "Whole Window"
This "Screenshot Type" does not have any dynamic inputs.

#### "Select Area"
This Screenshot Type has four numeric integer inputs for specifying the position and width/height (in pixel) of the area that should get screen shotted.
If the user enters invalid data please show an error message specifying which input contains non numeric data.
If all fields contain a valid number please highlight the area in the browser window by drawing a rectangle with a 20px 50% transparent green border at the position.

#### "Select Element(s)"
This "Screenshot Type" has text input fields for:
* an element name field labeled "Element Name"
* a list of comma separated class names labeled "Class List (comma separated)"
* a CSS selector field labeled "CSS selector"
all these fields are empty by default.

## Templating
when saving the screenshot the filename of the image is created by replacing the templates in the "File Name".
Use the current Date for <LABEL> and <DAY> and then replace the templates like this:
* <LABEL> -> the content of the "Label" text input 
* <NUMBER> -> 
  * When "Screenshot Type" "Select Element(s)" is selected
    * if multiple elements matching the criteria were found then please use the number of each element here. Numbering starts with 1.
    * else use the string "unique"
  * For all other "Screenshot Types" please use the string "single" 
* <DAY> -> YYYY-MM-DD (use the current Date)
* <TIME> -> HH-MM-SS (use the current Date)


## Taking the screenshots
When the user clicks the "Take Screenshot" button then the way the screenshot is taken is dependent on what "Screenshot Type" is selected

###



* Show a Label counting down the ammount of seconds that was entered in the "Delay" input.
Depending on the option the user selected






### deleteme

Als browser plugin

javascript:(async()=>{const sleep=t=>new Promise(r=>setTimeout(r,t));const loadScript=(src,timeoutMs=15000)=>new Promise((res,rej)=>{const s=document.createElement("script");let done=false;const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(to);s.onload=s.onerror=null;if(!ok)s.remove();ok?res():rej(err||new Error("script load failed"));};s.src=src;s.onload=()=>finish(true);s.onerror=()=>finish(false,new Error(`Failed to load: ${src}`));const to=setTimeout(()=>finish(false,new Error(`Timed out loading: ${src}`)),timeoutMs);document.head.appendChild(s);});const ensureHtml2Canvas=async()=>{if(window.html2canvas)return;const url=location.origin+"/third-party/html2canvas/html2canvas.min.js";await loadScript(url);if(!window.html2canvas)throw new Error("Loaded script but window.html2canvas is still missing.");};const toBlob=c=>new Promise(res=>c.toBlob(b=>res(b),"image/png"));const dl=(blob,name)=>{const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);};const safe=s=>(s||"screenshot").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim().slice(0,120)||"screenshot";const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;};try{await ensureHtml2Canvas();await sleep(100);const docEl=document.documentElement,body=document.body;const w=Math.max(docEl.scrollWidth,body?.scrollWidth||0,docEl.clientWidth);const h=Math.max(docEl.scrollHeight,body?.scrollHeight||0,docEl.clientHeight);const dpr=Math.min(2,window.devicePixelRatio||1);const canvas=await window.html2canvas(body||docEl,{backgroundColor:"#fff",scale:dpr,scrollX:0,scrollY:0,windowWidth:w,windowHeight:h,width:w,height:h,useCORS:true,allowTaint:false,logging:false});const blob=await toBlob(canvas);if(!blob)throw new Error("Canvas→PNG failed (blob is null).");dl(blob,safe((document.title||location.hostname||"page")+" "+stamp())+".png");}catch(e){console.error(e);alert("Screenshot failed: "+(e?.message||e));}})()


