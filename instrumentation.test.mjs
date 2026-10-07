import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestError} from './instrumentation.ts';
test('server error events keep only safe correlation fields and never log request or error content',()=>{
 const log=console.error,events=[];console.error=value=>events.push(JSON.parse(value));
 try{
  const error=new Error('private@example.test token=SECRET');error.digest='123456';
  onRequestError(error,{path:'/inbox?token=SECRET',headers:{cookie:'SECRET'}},{routePath:'/inbox',routeType:'render'});
  assert.deepEqual(events[0],{event:'jobpilot_request_error',digest:'123456',route:'/inbox',kind:'render'});
  error.digest='private@example.test';onRequestError(error,{}, {routePath:'/opportunities/[id]',routeType:'render'});
  assert.equal(events[1].digest,'unavailable');assert.ok(!JSON.stringify(events).includes('SECRET'));assert.ok(!JSON.stringify(events).includes('@example'));
 }finally{console.error=log;}
});
