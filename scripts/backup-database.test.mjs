import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
test('manual backup refuses unsafe/existing destinations and produces private verified files with the installed CLI contract',()=>{
 const temp=mkdtempSync(join(tmpdir(),'jobpilot-backup-check-'));
 try{
  const cli=join(temp,'supabase');writeFileSync(cli,'#!/bin/sh\nwhile [ "$#" -gt 0 ]; do if [ "$1" = "--file" ]; then shift; printf "fixture SQL\\n" > "$1"; exit 0; fi; shift; done\nexit 1\n');chmodSync(cli,0o700);
  const run=(ref,dest)=>spawnSync('sh',['scripts/backup-database.sh',ref,dest],{encoding:'utf8',env:{...process.env,PATH:temp+':'+process.env.PATH}});
  assert.notEqual(run('bad/ref',join(temp,'bad')).status,0);assert.notEqual(run('fixture','relative').status,0);assert.notEqual(run('fixture',resolve('backup-never-create')).status,0);
  const out=join(temp,'backup');assert.equal(run('fixture',out).status,0);assert.equal(statSync(out).mode&0o777,0o700);assert.equal(statSync(join(out,'data.sql')).mode&0o777,0o600);assert.match(readFileSync(join(out,'SHA256SUMS'),'utf8'),/data.sql/);assert.notEqual(run('fixture',out).status,0);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
