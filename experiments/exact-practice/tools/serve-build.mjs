import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,extname} from 'node:path'

// Test-only server follows built Exact static-route manifest. Unknown URLs stay404.
export async function createBuildServer(root) {
 const manifest=JSON.parse(await readFile(resolve(root,'routes.json'),'utf8'))
 const known=new Set(manifest.routes.filter(route=>!route.notfound).map(route=>route.pattern))
 return createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost')
  let file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname))
  if(!file.startsWith(root+'/'))throw Error('outside build')
  let bytes
  try {bytes=await readFile(file)} catch {
   if(!known.has(url.pathname))throw Error('undeclared route')
   file=resolve(root,'shell.html');bytes=await readFile(file)
  }
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream')
  res.end(bytes)
 }catch{res.writeHead(404);res.end()}})
}
