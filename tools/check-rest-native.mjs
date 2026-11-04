import {chromium} from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=fileURLToPath(new URL('../test-results/native-v015/',import.meta.url));
await mkdir(`${out}Livros de teste`,{recursive:true});await mkdir(`${out}Jogo de teste`,{recursive:true});
await writeFile(`${out}Jogo de teste/probe.rs`,'#![windows_subsystem="windows"]\nfn main(){let x=std::fs::read_to_string("recurso.txt").unwrap();std::fs::write("executado.txt",x).unwrap();}');
await writeFile(`${out}Jogo de teste/recurso.txt`,'ORBIT jogo iniciado com diretório correto');
const fixture=spawnSync('rustc',[`${out}Jogo de teste/probe.rs`,'-o',`${out}Jogo de teste/Jogo.exe`],{windowsHide:true,encoding:'utf8'});assert.equal(fixture.status,0,fixture.stderr);
const exe=process.argv[2];if(!exe)throw Error('Informe o executável');
const child=spawn(exe,[],{cwd:root,windowsHide:true,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9226 --remote-debugging-address=127.0.0.1'}});
let spawnError;child.on('error',e=>spawnError=e);
let browser,page,invoke,settings;const ids=[],checks=[],errors=[];
function input(action,args=[]) {const r=spawnSync('powershell.exe',['-NoProfile','-File',`${root}tools/native-input.ps1`,'-OrbitProcessId',String(child.pid),'-Action',action,...args],{windowsHide:true,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout.trim());}
async function activate(){await invoke('frontend_ready');await delay(250)}
try {
  for(let i=0;i<80;i++){if(spawnError)throw spawnError;if(child.exitCode!==null)throw Error(`ORBIT encerrou: ${child.exitCode}`);try{if((await fetch('http://127.0.0.1:9226/json/version')).ok)break}catch{}await delay(250)}
  browser=await chromium.connectOverCDP('http://127.0.0.1:9226');page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(String(e)));
  await page.locator('.category').first().waitFor();
  invoke=(cmd,args={})=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
  settings=(await invoke('get_state')).settings;
  await invoke('save_settings',{settings:{...settings,mode:'main',theme:'ocean'}});await activate();
  const metrics=await page.evaluate(()=>({w:innerWidth,h:innerHeight,dpr:devicePixelRatio,bg:getComputedStyle(document.body).backgroundColor}));
  assert.equal(metrics.w,720);assert.equal(metrics.h,440);assert.equal(metrics.bg,'rgba(0, 0, 0, 0)');checks.push('Release 720x440 DIP; exterior transparente');
  await page.getByRole('button',{name:'Próxima bola: Descanso',exact:true}).click();
  await page.getByRole('button',{name:'Streaming',exact:true}).waitFor();
  assert.equal((await invoke('get_state')).settings.mode,'rest');checks.push('Seta troca modo e SQLite persiste Descanso');
  await page.screenshot({path:`${out}descanso.png`,omitBackground:true,animations:'disabled'});
  for(const [title,id] of [['Papel','paper'],['Ametista','amethyst']]) {
    await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:`Tema ${title}`,exact:true}).click();
    assert.equal((await invoke('get_state')).settings.theme,id);await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
  }
  checks.push('Temas alterados na UI e gravados no SQLite');
  await page.getByRole('button',{name:'Livros',exact:true}).click();
  await page.getByRole('button',{name:'Selecionar pasta',exact:true}).click();await delay(350);
  assert.ok(input('dialog-tree').controls.length>0);await invoke('frontend_ready');input('escape');await delay(300);
  assert.equal(await page.locator('#shortcut-title').inputValue(),'Livros');checks.push('Seletor nativo e cancelamento preservam formulário Livros');
  await page.getByRole('button',{name:'Fechar configurações',exact:true}).click();
  const game=await invoke('add_shortcut',{title:'ORBIT QA Jogo',category:'games',action:{type:'executable',value:`${out}Jogo de teste/Jogo.exe`}});ids.push(game.id);
  await activate();await page.getByRole('button',{name:'Jogos',exact:true}).click();await page.getByRole('button',{name:'ORBIT QA Jogo',exact:true}).click();
  for(let i=0;i<20;i++){try{assert.match(await readFile(`${out}Jogo de teste/executado.txt`,'utf8'),/diretório correto/);break}catch(e){if(i===19)throw e;await delay(100)}}
  assert.equal((await invoke('get_state')).usage[game.id].count,1);checks.push('Jogo .exe aberto pela UI com caminho contendo espaços e recurso relativo');
  const books=await invoke('add_shortcut',{title:'ORBIT QA Livros',category:'orbit-rest',action:{type:'folder',value:`${out}Livros de teste`}});ids.push(books.id);
  await activate();await page.getByRole('button',{name:'ORBIT QA Livros',exact:true}).click();await delay(300);
  assert.equal((await invoke('get_state')).usage[books.id].count,1);checks.push('Pasta Livros aberta pelo botão na bola e uso registrado');
  for(const [x,y] of [[1,1],[1900,1],[1,1000],[1900,1000]]) {
    input('move',['-X',String(x),'-Y',String(y)]);await activate();const r=input('status');assert.ok(r.visible&&r.x>=0&&r.y>=0);
    assert.ok(await page.evaluate(()=>{const r=document.querySelector('.launcher').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}));
  }
  checks.push('Janela e conteúdo enquadrados nos quatro cantos');
  assert.deepEqual(errors,[]);
  await writeFile(`${out}result.json`,JSON.stringify({checks,metrics,errors},null,2));console.log(JSON.stringify({checks,metrics,errors},null,2));
} finally {
  if(invoke&&child.exitCode===null){for(const id of ids)await invoke('remove_shortcut',{id}).catch(()=>{});if(settings)await invoke('save_settings',{settings}).catch(()=>{});await invoke('quit_orbit').catch(()=>{});await delay(500)}
  if(child.exitCode===null)child.kill();child.stdout?.destroy();child.stderr?.destroy();await Promise.race([browser?.close().catch(()=>{}),delay(1500)]);
}
