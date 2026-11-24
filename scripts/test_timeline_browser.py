#!/usr/bin/env python3
"""Offline real Chromium CPU replay regression; not Pixi/Spine GPU evidence.
Requires Python Playwright (test-only) and Chromium via BROWSER_EXECUTABLE.
"""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

CHECKS = r"""
function checks(){
 const T=globalThis.FxTimeline,results=[];
 const equal=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('state mismatch');};
 const check=(name,fn)=>{try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}};
 function probe(){
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=4;
  const ctx=canvas.getContext('2d'),rng=T.createPrng(17);let state={x:0,seed:rng.state,parts:0},fail='';
  const inject=kind=>{if(fail===kind){fail='';throw Error('injected '+kind);}};
  const draw=()=>{ctx.clearRect(0,0,32,4);ctx.fillRect(Math.floor(state.x)%32,0,1,4);};
  const clock=T.createReplay({checkpointEvery:1,maxCheckpoints:3,capture:()=>state,
   restore:v=>{state=v;rng.setState(v.seed);},
   step:()=>{state.x+=1+rng.next();state.seed=rng.state;inject('step');},
   partial:dt=>{state.x+=dt*60;state.parts++;inject('partial');},
   render:()=>{draw();inject('render');}});
  return {clock,fail:kind=>{fail=kind;},snapshot:()=>({state:structuredClone(state),time:clock.time,frame:clock.frame,checkpoints:clock.checkpointFrames}),
   pixels:()=>Array.from(ctx.getImageData(0,0,32,4).data)};
 }
 const throws=fn=>{let error;try{fn();}catch(e){error=e;}if(!error)throw Error('expected exception');return error;};
 check('browser global loaded',()=>{equal(T.FPS,60);equal(typeof T.createReplay,'function');});
 check('invalid limit rejected before capture',()=>{let captures=0;for(const maxSeconds of [NaN,Infinity,-1,'2',null]){
  throws(()=>T.createReplay({maxSeconds,capture:()=>{captures++;return {};},restore(){},step(){}}));}equal(captures,0);});
 for(const [kind,target] of [['step',.2],['partial',.02],['render',.2]])check('failed '+kind+' then retry',()=>{
  const p=probe(),q=probe();for(const v of [p,q])v.clock.seek(.105);
  const before=p.snapshot();p.fail(kind);equal(throws(()=>p.clock.seek(target)).message,'injected '+kind);equal(p.snapshot(),before);
  p.clock.seek(target);q.clock.seek(target);equal(p.snapshot(),q.snapshot());equal(p.pixels(),q.pixels());
 });
 check('failed reset then recovery and re-render',()=>{const p=probe(),q=probe();for(const v of [p,q])v.clock.seek(.105);
  const before=p.snapshot();p.fail('render');equal(throws(()=>p.clock.invalidate()).message,'injected render');equal(p.snapshot(),before);
  p.clock.seek(.125);q.clock.seek(.125);equal(p.snapshot(),q.snapshot());equal(p.pixels(),q.pixels());
 });
 return results;
}
"""


def main():
    root = Path(__file__).resolve().parents[1]
    source = Path(os.environ.get("TIMELINE_BROWSER_SOURCE", root / "assets/template/src/timeline-core.js"))
    executable = os.environ.get("BROWSER_EXECUTABLE")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=executable)
        try:
            page = browser.new_page(offline=True)
            requests, errors = [], []
            page.on("request", lambda request: requests.append(request.url))
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.set_content("<!doctype html><meta charset=utf-8>")
            page.add_script_tag(path=source)
            results = page.evaluate("(" + CHECKS + ")()")
            print(json.dumps({"browser": browser.version, "cases": results, "requests": requests, "pageErrors": errors}))
            assert len(results) == 6 and all(case["pass"] for case in results), "browser regression failed"
            assert not any(url.startswith(("http:", "https:")) for url in requests), "network request"
            assert not errors, errors
        finally:
            browser.close()


if __name__ == "__main__":
    main()
