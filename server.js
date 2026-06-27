const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const COLLECTIONS = ['vehicles','drivers','fuels','maintenances','tires','checklists','kms','ocorrencias','config','postos'];
function filePath(col){return path.join(DATA_DIR,col+'.json');}
function readCol(col){try{const f=filePath(col);if(!fs.existsSync(f))return col==='config'?{}:[];return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return col==='config'?{}:[];}}
function writeCol(col,data){fs.writeFileSync(filePath(col),JSON.stringify(data,null,2),'utf8');}
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json'};
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
function json(res,status,data){cors(res);res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;});req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('invalid'));}});req.on('error',reject);});}
function serveStatic(res,fp){try{if(!fs.existsSync(fp)){json(res,404,{error:'Not found'});return;}const ext=path.extname(fp);res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});fs.createReadStream(fp).pipe(res);}catch(e){json(res,500,{error:e.message});}}
const server=http.createServer(async(req,res)=>{
  const parsed=url.parse(req.url,true);const pathname=parsed.pathname;
  if(req.method==='OPTIONS'){cors(res);res.writeHead(204);res.end();return;}
  const apiMatch=pathname.match(/^\/api\/([a-z_]+)(\/([a-z0-9]+))?$/);
  if(apiMatch){
    const col=apiMatch[1];const id=apiMatch[3];
    if(!COLLECTIONS.includes(col)){json(res,404,{error:'not found'});return;}
    try{
      if(req.method==='GET'&&!id){json(res,200,readCol(col));return;}
      if(req.method==='GET'&&id){const data=readCol(col);if(col==='config'){json(res,200,data);return;}const item=data.find(x=>x.id===id);json(res,item?200:404,item||{error:'not found'});return;}
      if(req.method==='POST'&&!id){const body=await readBody(req);if(col==='config'){writeCol(col,body);json(res,200,body);return;}const data=readCol(col);if(!body.id)body.id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);if(!body.createdAt)body.createdAt=new Date().toISOString();data.push(body);writeCol(col,data);json(res,201,body);return;}
      if(req.method==='PUT'&&id){const body=await readBody(req);const data=readCol(col);const idx=data.findIndex(x=>x.id===id);if(idx===-1){json(res,404,{error:'not found'});return;}data[idx]={...data[idx],...body,id};writeCol(col,data);
      // Sincronizar vínculo motorista <-> veículo
      if(col==='drivers'){
        const vehId=body.veiculoDesignado||'';
        const vehs=readCol('vehicles');
        // Remover este driver de todos os veículos
        vehs.forEach(v=>{if(v.motorista===id)v.motorista='';});
        // Atribuir ao veículo selecionado
        if(vehId){const vi=vehs.findIndex(v=>v.id===vehId);if(vi>-1)vehs[vi].motorista=id;}
        writeCol('vehicles',vehs);
      }
      json(res,200,data[idx]);return;}
      if(req.method==='DELETE'&&id){const data=readCol(col);const filtered=data.filter(x=>x.id!==id);writeCol(col,filtered);json(res,200,{deleted:id});return;}
      json(res,405,{error:'method not allowed'});
    }catch(e){json(res,500,{error:e.message});}
    return;
  }
  let fp;
  if(pathname==='/'||pathname==='/gestor')fp=path.join(PUBLIC_DIR,'gestor.html');
  else if(pathname==='/motorista')fp=path.join(PUBLIC_DIR,'motorista.html');
  else fp=path.join(PUBLIC_DIR,pathname.replace(/^\//,''));
  serveStatic(res,fp);
});
server.listen(PORT,'0.0.0.0',()=>{console.log('FleetManager porta '+PORT);});
process.on('SIGTERM',()=>{server.close(()=>process.exit(0));});
process.on('SIGINT',()=>{server.close(()=>process.exit(0));});
