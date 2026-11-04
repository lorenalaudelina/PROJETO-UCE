import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = resolve(process.env.DB_FILE || 'data/zenith.sqlite');
mkdirSync(dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price REAL NOT NULL CHECK(price>0), duration INTEGER NOT NULL CHECK(duration>0));
CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, client TEXT NOT NULL, phone TEXT NOT NULL, service_id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Agendado' CHECK(status IN ('Agendado','Concluído','Cancelado')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(service_id) REFERENCES services(id));
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date,time);`);
const seedServices = [
 ['s1','Corte feminino','Corte personalizado e finalização.',75,60],['s2','Escova','Escova modelada para o seu estilo.',55,45],['s3','Coloração','Coloração com avaliação profissional.',180,120],['s4','Manicure','Cuidados e esmaltação das unhas.',45,50]
];
function seed() {
 const count = db.prepare('SELECT count(*) AS n FROM services').get().n;
 if (!count) { const ins = db.prepare('INSERT INTO services VALUES(?,?,?,?,?)'); for (const row of seedServices) ins.run(...row); }
 const aCount = db.prepare('SELECT count(*) AS n FROM appointments').get().n;
 if (!aCount) { const ins=db.prepare('INSERT INTO appointments(id,client,phone,service_id,date,time,status) VALUES(?,?,?,?,?,?,?)'); const date=new Date().toISOString().slice(0,10); ins.run('a1','Mariana Costa','(11) 98765-4321','s1',date,'09:00','Agendado'); ins.run('a2','Beatriz Souza','(11) 99123-4567','s4',date,'10:30','Agendado'); }
}
seed();
const listServices = () => db.prepare('SELECT id,name,description,price,duration FROM services ORDER BY name').all();
const listAppointments = () => db.prepare('SELECT id,client,phone,service_id AS serviceId,date,time,status FROM appointments ORDER BY date,time').all();
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end(JSON.stringify(data));};
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100_000)throw new Error('Corpo da requisição muito grande.');}return raw?JSON.parse(raw):{};}
const server=createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
 const url=new URL(req.url,'http://localhost'); const path=url.pathname;
 try {
  if(req.method==='GET'&&path==='/api/health')return send(res,200,{ok:true,database:file});
  if(req.method==='GET'&&path==='/api/bootstrap')return send(res,200,{services:listServices(),appointments:listAppointments()});
  if(req.method==='GET'&&path==='/api/services')return send(res,200,listServices());
  if(req.method==='GET'&&path==='/api/appointments')return send(res,200,listAppointments());
  if(req.method==='POST'&&path==='/api/services'){
   const b=await body(req);const name=String(b.name||'').trim(),price=Number(b.price),duration=Number(b.duration),description=String(b.description||'').trim();
   if(!name||name.length>70||!Number.isFinite(price)||price<=0||!Number.isInteger(duration)||duration<1||duration>600)return send(res,400,{error:'Dados do serviço inválidos.'});
   const id=randomUUID();db.prepare('INSERT INTO services VALUES(?,?,?,?,?)').run(id,name,description,price,duration);return send(res,201,db.prepare('SELECT id,name,description,price,duration FROM services WHERE id=?').get(id));
  }
  const serviceMatch=path.match(/^\/api\/services\/([^/]+)$/);
  if(serviceMatch&&req.method==='PUT'){
   const b=await body(req);const name=String(b.name||'').trim(),price=Number(b.price),duration=Number(b.duration),description=String(b.description||'').trim();
   if(!name||name.length>70||!Number.isFinite(price)||price<=0||!Number.isInteger(duration)||duration<1||duration>600)return send(res,400,{error:'Dados do serviço inválidos.'});
   const result=db.prepare('UPDATE services SET name=?,description=?,price=?,duration=? WHERE id=?').run(name,description,price,duration,serviceMatch[1]);if(!result.changes)return send(res,404,{error:'Serviço não encontrado.'});return send(res,200,db.prepare('SELECT id,name,description,price,duration FROM services WHERE id=?').get(serviceMatch[1]));
  }
  if(serviceMatch&&req.method==='DELETE'){
   const active=db.prepare("SELECT count(*) AS n FROM appointments WHERE service_id=? AND status='Agendado'").get(serviceMatch[1]).n;if(active)return send(res,409,{error:'Não é possível excluir: há agendamentos ativos para este serviço.'});
   const result=db.prepare('DELETE FROM services WHERE id=?').run(serviceMatch[1]);if(!result.changes)return send(res,404,{error:'Serviço não encontrado.'});return send(res,200,{ok:true});
  }
  if(req.method==='POST'&&path==='/api/appointments'){
   const b=await body(req);const client=String(b.client||'').trim(),phone=String(b.phone||'').trim(),serviceId=String(b.serviceId||''),date=String(b.date||''),time=String(b.time||'');
   if(!client||client.length>80||!phone||phone.length>20||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return send(res,400,{error:'Dados do agendamento inválidos.'});
   const service=db.prepare('SELECT id,duration FROM services WHERE id=?').get(serviceId);if(!service)return send(res,400,{error:'Serviço não encontrado.'});
   if(date<new Date().toISOString().slice(0,10))return send(res,400,{error:'Não é possível agendar em uma data passada.'});
   const startMinutes=Number(time.slice(0,2))*60+Number(time.slice(3,5));const endMinutes=startMinutes+service.duration;const busy=db.prepare("SELECT a.time,s.duration FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.date=? AND a.status!='Cancelado'").all(date);if(busy.some(a=>{const start=Number(a.time.slice(0,2))*60+Number(a.time.slice(3,5));return startMinutes<start+a.duration&&start<endMinutes;}))return send(res,409,{error:'Esse horário conflita com outro atendimento. Escolha outro.'});
   const id=randomUUID();db.prepare('INSERT INTO appointments(id,client,phone,service_id,date,time) VALUES(?,?,?,?,?,?)').run(id,client,phone,serviceId,date,time);return send(res,201,db.prepare('SELECT id,client,phone,service_id AS serviceId,date,time,status FROM appointments WHERE id=?').get(id));
  }
  const appointmentMatch=path.match(/^\/api\/appointments\/([^/]+)$/);
  if(appointmentMatch&&req.method==='PATCH'){
   const b=await body(req);if(!['Agendado','Concluído','Cancelado'].includes(b.status))return send(res,400,{error:'Status inválido.'});
   const result=db.prepare('UPDATE appointments SET status=? WHERE id=?').run(b.status,appointmentMatch[1]);if(!result.changes)return send(res,404,{error:'Agendamento não encontrado.'});return send(res,200,db.prepare('SELECT id,client,phone,service_id AS serviceId,date,time,status FROM appointments WHERE id=?').get(appointmentMatch[1]));
  }
  if(req.method==='POST'&&path==='/api/reset') {db.exec('DELETE FROM appointments; DELETE FROM services;');seed();return send(res,200,{services:listServices(),appointments:listAppointments()});}
  return send(res,404,{error:'Rota não encontrada.'});
 } catch(error){console.error(error);if(error instanceof SyntaxError)return send(res,400,{error:'JSON inválido.'});return send(res,500,{error:'Erro interno do servidor.'});}
});
const port=Number(process.env.API_PORT||3001);server.listen(port,'0.0.0.0',()=>console.log(`API Zenith ativa em http://localhost:${port}; SQLite: ${file}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>{db.close();process.exit(0)});});
