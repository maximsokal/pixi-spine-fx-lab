"""Chromium DOM test for local asset selection; renderer/session are injected."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/ground-impact/src'


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE'))
        page = browser.new_page()
        page.set_content('<main id="assets"></main>')
        page.add_script_tag(path=SRC / 'ground-impact-selection.js')
        page.add_script_tag(path=SRC / 'ground-impact-asset-panel.js')
        page.evaluate('''() => {
          const calls=[]; let accepted=null, pending=null, error=false;
          const session={get busy(){return false},get source(){return accepted},replaceSource(s){calls.push(s);return new Promise((resolve,reject)=>{pending=()=>{if(error)reject(Error('bad page'));else{accepted=s;resolve();}};});}};
          const selection=FxGroundImpactSelection.createSelection(session);
          const panel=FxGroundImpactAssetPanel.mount(document.querySelector('#assets'),{selection,getAccepted:()=>session.source?.name??'',sample:()=>({name:'sample.json'}),onAccepted:()=>{},onError:()=>{}});
          globalThis.fixture={panel,selection,calls,finish:()=>pending(),fail:v=>error=v,accepted:()=>accepted?.name??null};
        }''')
        load=page.get_by_role('button',name='Load selected',exact=True)
        assert load.is_disabled()
        def select(label, name):
            page.get_by_label(label,exact=True).set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':b'abc'})
        select('Skeleton JSON / SKEL','rig.json')
        select('Atlas','rig.atlas')
        select('Textures','a.png')
        select('Textures','b.webp')
        assert page.get_by_text('a.png',exact=True).count()==1
        assert page.get_by_text('b.webp',exact=True).count()==1
        assert page.evaluate('fixture.calls.length')==0
        load.click()
        assert load.is_disabled() and page.get_by_label('Textures',exact=True).is_disabled()
        page.evaluate('fixture.finish()')
        page.wait_for_function('fixture.accepted()==="rig.json"')
        assert page.get_by_text('Active: rig.json',exact=True).is_visible()
        select('Skeleton JSON / SKEL','new.skel')
        page.evaluate('fixture.fail(true)')
        load.click(); page.evaluate('fixture.finish()')
        page.get_by_role('alert').get_by_text('bad page').wait_for()
        assert page.get_by_text('Active: rig.json',exact=True).is_visible()
        assert page.get_by_text('new.skel',exact=True).is_visible()
        assert load.is_enabled()
        page.get_by_role('button',name='Remove a.png').click()
        assert page.get_by_text('a.png',exact=True).count()==0
        page.evaluate('''() => {const d=new DataTransfer();d.items.add(new File(['x'],'c.png'));document.querySelector('[data-drop-zone]').dispatchEvent(new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true}));}''')
        assert page.get_by_text('c.png',exact=True).is_visible()
        page.get_by_role('button',name='Clear selected').click()
        assert load.is_disabled() and page.get_by_text('Active: rig.json',exact=True).is_visible()
        page.evaluate('fixture.fail(false)')
        page.get_by_role('button',name='Load sample').click(); page.evaluate('fixture.finish()')
        page.get_by_text('Active: sample.json',exact=True).wait_for()
        page.get_by_role('button',name='Remove preview').click(); page.evaluate('fixture.finish()')
        page.get_by_text('Active: none',exact=True).wait_for()
        page.evaluate('fixture.panel.destroy()')
        assert page.locator('#assets').inner_html()==''
        browser.close()
    print('PASS: asset panel Chromium DOM lifecycle')


if __name__ == '__main__':
    run()
