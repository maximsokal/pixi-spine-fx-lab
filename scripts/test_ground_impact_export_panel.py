"""Actual Chromium DOM + injected bake/developer jobs; not GPU acceptance."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE'))
    page=browser.new_page()
    page.set_default_timeout(4000)
    page.set_content('<fieldset id="host"></fieldset><div id="cancel"></div><div id="surface" style="position:relative;width:512px;height:512px;overflow:hidden"></div>')
    page.add_script_tag(path=ROOT/'assets/ground-impact/src/ground-impact-export-panel.js')
    page.evaluate('''() => {
      const state={locked:false,events:[],downloads:[],requests:[],seconds:.3,mode:'ok'};
      const session={settings:{seed:7},source:{name:'rig.json',atlasName:'rig.atlas',images:new Map([['a.png',new Blob(['a'])]])},asset:{version:'4.2.43'},options:{animation:'idle',skin:'',speed:1,visible:true},seconds:.3};
      globalThis.FxShieldExport={cropSpec:c=>{if(c.width<1||c.height<1||c.width>4096||c.height>4096||Math.abs(c.x)>16384||Math.abs(c.y)>16384)throw Error('crop bounds');return Object.freeze(c);}};
      globalThis.FxGroundImpact={compile:()=>{}};
      globalThis.FxGroundImpactAuthoring={pointer:(x,y,r)=>({x:(x-r.left)/r.width*512,y:(y-r.top)/r.height*512})};
      globalThis.FxGroundImpactBake={sceneFactory:arg=>arg};
      async function job(p){state.requests.push(p);if(p.progress)p.progress(1,p.frameCount);if(state.mode==='fail')throw Error('fixture failed');if(state.mode==='wait')await new Promise(resolve=>p.signal.addEventListener('abort',resolve,{once:true}));return {zip:new Uint8Array([1,2,3])};}
      globalThis.FxGroundImpactExport={bakeSequence:job};globalThis.FxGroundImpactDeveloper={developer:job};
      const $=id=>document.getElementById(id);
      globalThis.fixture={state,session};globalThis.panel=FxGroundImpactExportPanel.mount({env:globalThis,host:$('host'),surface:$('surface'),cancelHost:$('cancel'),getSession:()=>session,getBackend:()=> 'webgl2',isLocked:()=>state.locked,begin(){state.locked=true;$('host').disabled=true;state.events.push('begin');},end(){state.locked=false;$('host').disabled=false;state.events.push('end');},report:(m,e)=>state.events.push([m,e]),getDeveloperData:()=>({sources:{a:'test'},vendors:{b:'test'},licenses:'test'}),download:(bytes,name)=>state.downloads.push([name,[...bytes]])});panel.refresh();
    }''')
    page.locator('#exportWidth').fill('280');page.locator('#exportWidth').dispatch_event('input')
    page.locator('#exportHeight').fill('200');page.locator('#exportHeight').dispatch_event('input')
    assert page.locator('#cropGuide').evaluate('(e)=>e.style.width')=='54.6875%'
    page.locator('#exportWidth').fill('0');page.locator('#exportPng').click()
    assert page.evaluate('fixture.state.requests.length')==0
    page.locator('#exportWidth').fill('280');page.locator('#exportFrames').fill('42')
    page.locator('#exportPng').click()
    page.wait_for_function('fixture.state.downloads.length===1')
    assert page.evaluate('fixture.state.requests[0].crop')=={'x':116,'y':156,'width':280,'height':200}
    assert page.evaluate('fixture.state.requests[0].frameCount')==42
    assert page.evaluate('fixture.state.requests[0].assetInfo.options.animation')=='idle'
    assert page.evaluate('fixture.state.requests[0].createScene.source.atlasName')=='rig.atlas'
    page.locator('#surface').evaluate("e=>{e.style.width='1024px';e.style.height='1024px'}")
    page.locator('#cropLabel').scroll_into_view_if_needed()
    b=page.locator('#cropLabel').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+40,y+20);page.mouse.up()
    assert page.locator('#exportX').input_value()=='20'
    assert page.locator('#exportY').input_value()=='10'
    page.locator('#exportGuide').uncheck()
    assert page.locator('#cropGuide').is_hidden()
    page.locator('#exportWebGL').click();page.wait_for_function('fixture.state.downloads.length===2')
    page.locator('#exportWebGPU').click();page.wait_for_function('fixture.state.downloads.length===3')
    assert page.evaluate('fixture.state.requests.slice(1).map(r=>r.target)')==['webgl','webgpu']
    assert page.evaluate('fixture.state.requests[1].crop')=={'x':136,'y':166,'width':280,'height':200}
    assert page.evaluate('fixture.state.requests[1].previewSeconds')==.3
    page.evaluate("fixture.state.mode='wait'")
    page.locator('#exportPng').click();page.wait_for_function('fixture.state.locked')
    assert page.locator('#exportCancel').is_enabled()
    assert page.locator('#exportWebGL').is_disabled()
    page.evaluate('document.querySelector("#exportWebGPU").onclick()')
    assert page.evaluate('fixture.state.requests.length')==4
    page.locator('#exportCancel').click();page.wait_for_function('!fixture.state.locked')
    assert page.evaluate('fixture.state.downloads.length')==3
    page.evaluate("fixture.state.mode='fail'");page.locator('#exportPng').click()
    page.wait_for_function('fixture.state.events.some(e=>Array.isArray(e)&&e[0]==="fixture failed")')
    assert page.evaluate('!fixture.state.locked')
    page.evaluate("fixture.state.mode='wait'");page.locator('#exportPng').click();page.wait_for_function('fixture.state.locked');page.evaluate('panel.destroy()');page.wait_for_function('!fixture.state.locked')
    assert page.evaluate('fixture.state.downloads.length')==3
    browser.close()
print('PASS: export panel Chromium DOM, crop drag at 200%, 3 targets, lock, cancel, failure, teardown')
