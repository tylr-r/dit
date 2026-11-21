// Test fixture only: old regression scopes explicitly returning with a valid old TENRA snapshot.
// Clean-install tests opt out; this is not a runtime bypass.
export async function seedReturning(page, {legacyPractice = true} = {}) {
 await page.addInitScript(({legacyPractice})=>{
  const key='dit.exact-spike.onboarding.v1'
  try {if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({version:1,status:'skipped',step:'welcome',profile:null,soundComplete:false,taps:0,holds:0}))}catch{}
  try {if(legacyPractice&&localStorage.getItem('dit.exact-spike.practice.v1')===null)localStorage.setItem('dit.exact-spike.practice.v1',JSON.stringify({version:1,settings:{},scores:{},history:[]}))}catch{}
 },{legacyPractice})
}
