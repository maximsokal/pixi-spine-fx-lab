"""Exercise the editor in Chromium with injected scene, not GPU acceptance."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/ground-impact/src'

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE'))
        page = browser.new_page()
        page.set_default_timeout(4000)
        page.set_content((SRC/'ui.html').read_text().replace('__SAMPLE_DATA__','{}'))
        page.add_script_tag(path=SRC/'ground-impact-selection.js')
        page.add_script_tag(path=SRC/'ground-impact-asset-panel.js')
        page.evaluate('''() => {
          const clone=v=>JSON.parse(JSON.stringify(v));
          const defaults=()=>({quality:'balanced',gravity:500,trailingDustEnabled:true,contact:{id:'contact',x:256,y:320,rotation:0,anchor:{type:'world',name:'',slot:''}},layers:Object.fromEntries(['ring','debris','dust'].map(id=>[id,{id,x:0,y:0,rotation:0,enabled:true,visible:true,opacity:1,delayFrames:0,seed:1,blend:'normal',order:'front',anchor:{type:'inherit',name:'',slot:''}}])),curves:{radius:{}},palettes:{ring:{},debris:{},dust:{}}});
          let fail=false,closed=0,created=0,rendered=0;
          globalThis.FxGroundImpact={defaults,LAYERS:['ring','debris','dust']};
          globalThis.FxGroundImpactAuthoring={frame:t=>Math.floor(t*60+1e-6),advance:(t,dt,d)=>Math.max(0,Math.min(39/60,t+dt*d)),positions:c=>({contact:c.contact,...c.layers}),pointer:(x,y,r)=>({x:(x-r.left)/r.width*512,y:(y-r.top)/r.height*512}),move:(c,id,x,y)=>{const n=clone(c);Object.assign(id==='contact'?n.contact:n.layers[id],{x,y});return n;}};
          globalThis.FxCurveEditor={mount(){}};globalThis.FxColorUi={mount(){}};
          globalThis.fixture={fail:v=>fail=v,counts:()=>({closed,created,rendered})};
          globalThis.makeScene=async (backend,settings)=>{created++;if(fail)throw Error('backend rejected');let source=null,seconds=0,opt={animation:'',skin:'',speed:1,visible:true};const canvas=document.createElement('canvas');let c=clone(settings);return {actual:backend,canvas,world:{},session:{get settings(){return c},get seconds(){return seconds},get source(){return source},get asset(){return null},get options(){return opt},get meta(){return {primitiveBound:4,limit:96,omitted:{}}},get sample(){return {primitives:2}},get missing(){return []},configure(n){if(n.gravity<0)throw Error('gravity rejected');c=clone(n);},seek(t){seconds=t;},setOptions(n){opt=n;},async replaceSource(n){source=n;}},render(){rendered++},destroy(){closed++;canvas.remove();}};};
        }''')
        page.add_script_tag(path=SRC/'ground-impact-editor.js')
        page.evaluate('''async () => {globalThis.editor=FxGroundImpactEditor.mount(globalThis,{createScene:makeScene});await editor.ready;}''')
        assert page.locator('#actual').inner_text()=='webgl2'
        page.locator('[data-field="gravity"]').fill('600');page.locator('[data-field="gravity"]').dispatch_event('change')
        assert page.evaluate('editor.session.settings.gravity')==600
        page.locator('#frame').fill('17');page.locator('#frame').dispatch_event('input')
        assert abs(page.evaluate('editor.session.seconds')-17/60)<1e-9
        page.get_by_text("Preset JSON",exact=True).click()
        page.locator('#preset').fill('{"gravity":-1}');page.locator('#apply').click()
        assert page.evaluate('editor.session.settings.gravity')==600
        page.get_by_label('Skeleton JSON / SKEL',exact=True).set_input_files({'name':'rig.json','mimeType':'application/json','buffer':b'{}'})
        page.get_by_label('Atlas',exact=True).set_input_files({'name':'rig.atlas','mimeType':'text/plain','buffer':b'a'})
        page.get_by_label('Textures',exact=True).set_input_files({'name':'a.png','mimeType':'image/png','buffer':b'a'})
        page.get_by_role('button',name='Load selected',exact=True).click()
        page.wait_for_function('editor.session.source?.name==="rig.json"')
        page.evaluate('fixture.fail(true)');page.locator('#backend').select_option('webgpu')
        page.wait_for_function('document.querySelector("#status").textContent.includes("backend rejected")')
        assert page.locator('#actual').inner_text()=='webgl2'
        assert page.evaluate('editor.session.source.name')=='rig.json'
        page.evaluate('fixture.fail(false)');page.locator('#backend').select_option('webgpu')
        page.wait_for_function('document.querySelector("#actual").textContent==="webgpu"')
        assert page.evaluate('editor.session.settings.gravity')==600
        assert page.evaluate('editor.session.source.name')=='rig.json'
        assert abs(page.evaluate('editor.session.seconds')-17/60)<1e-9
        assert page.get_by_text('a.png',exact=True).is_visible()
        page.evaluate('editor.destroy()')
        assert page.evaluate('fixture.counts().closed')==2
        browser.close()
    print('PASS: Ground Impact integrated editor DOM, injected scenes')
if __name__=='__main__':
    run()
