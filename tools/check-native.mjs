import { chromium } from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=fileURLToPath(new URL('../test-results/native/',import.meta.url));await mkdir(out,{recursive:true});
await mkdir(`${out}Aplicativo portatil`,{recursive:true});
await writeFile(`${out}Aplicativo portatil/probe.rs`, '#![windows_subsystem = "windows"]\nfn main(){let data=std::fs::read_to_string("recurso.txt").unwrap();std::fs::write("executado.txt",data).unwrap();}');
await writeFile(`${out}Aplicativo portatil/recurso.txt`,'ORBIT cwd verificado');
const fixture=spawnSync('rustc',[`${out}Aplicativo portatil/probe.rs`,'-o',`${out}Aplicativo portatil/Probe.exe`],{windowsHide:true,encoding:'utf8'});
if(fixture.status!==0)throw Error(fixture.stderr);
const exe=process.argv[2];if(!exe)throw Error('Informe o executável a testar');
const child=spawn(exe,[],{cwd:root,windowsHide:true,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9226 --remote-debugging-address=127.0.0.1'}});
function input(action,args=[]){const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',`${root}tools/native-input.ps1`,'-OrbitProcessId',String(child.pid),'-Action',action,...args],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout.trim());}
let browser,page,settings,custom,invoke;const checks=[];let logs='';child.stderr.on('data',d=>logs+=d);child.stdout.on('data',d=>logs+=d);
try{
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:9226/json/version')).ok)break;}catch{}await delay(200);}
  browser=await chromium.connectOverCDP('http://127.0.0.1:9226');page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(10000);
  await page.locator('.category').first().waitFor();
  invoke=(cmd,args={})=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
  settings=(await invoke('get_state')).settings;const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const metrics=await page.evaluate(()=>({w:innerWidth,h:innerHeight,dpr:devicePixelRatio,bg:getComputedStyle(document.body).backgroundColor}));
  assert.equal(metrics.bg,'rgba(0, 0, 0, 0)');assert.equal(metrics.w,620);assert.equal(metrics.h,380);checks.push('Release Windows: 620x380 DIP, fundo externo transparente');
  await page.screenshot({path:`${out}/ORBIT-0.1.4.png`,omitBackground:true});input('capture',['-OutputPath',`${out}/desktop.png`]);
  for(const [x,y] of [[1,1],[1900,1],[1,1000],[1900,1000]]){
    input('move',['-X',String(x),'-Y',String(y)]);await invoke('frontend_ready');await delay(200);
    const fits=await page.evaluate(()=>{const r=document.querySelector('.launcher').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1});assert.ok(fits);
    const r=input('status');assert.ok(r.visible&&r.x>=0&&r.y>=0);checks.push(`Ativação e conteúdo enquadrados no canto ${x},${y}`);
  }
  await page.getByRole('button',{name:'Aplicativos',exact:true}).click();await page.getByRole('button',{name:'Adicionar aplicativo',exact:true}).click();
  assert.equal(await page.locator('#shortcut-kind').inputValue(),'executable');assert.equal(await page.locator('#shortcut-category').inputValue(),'apps');
  await page.getByRole('button',{name:'Selecionar executável (.exe)',exact:true}).click();await delay(500);
  assert.ok(input('dialog-tree').controls.length>0);await invoke('frontend_ready');input('escape');await delay(250);assert.equal(await page.locator('#shortcut-kind').inputValue(),'executable');checks.push('Seletor .exe preserva formulário mesmo após pedido de ativação');
  await page.getByRole('button',{name:'Fechar configurações'}).click();
  custom=await invoke('add_shortcut',{title:'ORBIT QA Notepad',category:'apps',action:{type:'executable',value:'C:\\Windows\\System32\\notepad.exe'}});
  await invoke('execute_action',{id:custom.id});assert.equal((await invoke('get_state')).usage[custom.id].count,1);checks.push('Executável .exe cadastrado e aberto de verdade, uso registrado');
  await assert.rejects(()=>invoke('add_shortcut',{title:'Inválido',category:'apps',action:{type:'executable',value:'C:\\Windows\\System32\\notepad.exe /x'}}));checks.push('Caminho com argumentos é rejeitado');
  await invoke('remove_shortcut',{id:custom.id});custom=null;
  custom=await invoke('add_shortcut',{title:'ORBIT QA Portable',category:'apps',action:{type:'executable',value:`${out}Aplicativo portatil/Probe.exe`}});
  await invoke('execute_action',{id:custom.id});await delay(400);assert.match(await readFile(`${out}Aplicativo portatil/executado.txt`,'utf8'),/ORBIT cwd verificado/);await invoke('remove_shortcut',{id:custom.id});custom=null;checks.push('Aplicativo portátil lê recurso relativo na própria pasta');
  await invoke('frontend_ready');await invoke('execute_action',{id:'browser-brave'});checks.push('Ação Nova guia do Brave executada pelo backend real');
  await invoke('frontend_ready');input('escape');assert.equal(input('status').visible,false);checks.push('ESC oculta');
  await invoke('save_settings',{settings:{trigger:'alt-middle',hotkey:'Ctrl+Alt+Space'}});input('hotkey');assert.equal(input('status').visible,true);checks.push('Atalho global reabre');
  input('outside');assert.equal(input('status').visible,false);checks.push('Clique externo oculta');
  await invoke('save_settings',{settings});settings=null;
  assert.deepEqual(errors,[]);await invoke('quit_orbit').catch(()=>{});for(let i=0;i<40&&child.exitCode===null;i++)await delay(100);assert.notEqual(child.exitCode,null);checks.push('Encerrar finaliza processo');
  const result={checks,metrics,errors,logs};await writeFile(`${out}/native-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
  if(child.exitCode===null){if(custom)await invoke('remove_shortcut',{id:custom.id}).catch(()=>{});if(settings)await invoke('save_settings',{settings}).catch(()=>{});await invoke?.('quit_orbit').catch(()=>{});await delay(400);if(child.exitCode===null)child.kill();}
  child.stdout.destroy();child.stderr.destroy();await Promise.race([browser?.close().catch(()=>{}),delay(1500)]);
}

