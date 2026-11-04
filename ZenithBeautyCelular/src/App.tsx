import { FormEvent, useEffect, useMemo, useState } from "react";
import "./app.css";

type Service = { id: string; name: string; description: string; price: number; duration: number };
type Appointment = { id: string; client: string; phone: string; serviceId: string; date: string; time: string; status: "Agendado" | "Concluído" | "Cancelado" };
type Screen = "agenda" | "services" | "clients";
const seedServices: Service[] = [
  { id: "s1", name: "Corte feminino", description: "Corte personalizado e finalização.", price: 75, duration: 60 },
  { id: "s2", name: "Escova", description: "Escova modelada para o seu estilo.", price: 55, duration: 45 },
  { id: "s3", name: "Coloração", description: "Coloração com avaliação profissional.", price: 180, duration: 120 },
  { id: "s4", name: "Manicure", description: "Cuidados e esmaltação das unhas.", price: 45, duration: 50 },
];
const today = new Date().toISOString().slice(0, 10);
const seedAppointments: Appointment[] = [
  { id: "a1", client: "Mariana Costa", phone: "(11) 98765-4321", serviceId: "s1", date: today, time: "09:00", status: "Agendado" },
  { id: "a2", client: "Beatriz Souza", phone: "(11) 99123-4567", serviceId: "s4", date: today, time: "10:30", status: "Agendado" },
];
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Erro ao comunicar com o servidor.");
  return body as T;
}
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (s: string) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default function App() {
  const [services, setServices] = useState<Service[]>(seedServices);
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);
  const [screen, setScreen] = useState<Screen>("agenda");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"booking" | "service" | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  useEffect(() => { api<{services:Service[];appointments:Appointment[] }>("/bootstrap").then(data => { setServices(data.services); setAppointments(data.appointments); }).catch(() => setNotice("Servidor indisponível. Inicie a aplicação com npm run dev.")); }, []);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 3500); return () => window.clearTimeout(id); }, [notice]);
  const clients = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; visits: number; lastDate: string }>();
    appointments.forEach(a => { const key = a.phone.replace(/\D/g, ""); const old = map.get(key); if (old) { old.visits++; if (a.date > old.lastDate) old.lastDate = a.date; } else map.set(key, { name: a.client, phone: a.phone, visits: 1, lastDate: a.date }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);
  const listed = appointments.filter(a => (filter === "Todos" || a.status === filter) && `${a.client} ${a.phone}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const todayAppointments = appointments.filter(a => a.date === today && a.status !== "Cancelado");
  const income = todayAppointments.filter(a => a.status === "Concluído").reduce((n,a) => n + (services.find(s => s.id === a.serviceId)?.price || 0), 0);

  async function saveBooking(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const item = { client: String(f.get("client") || "").trim(), phone: String(f.get("phone") || "").trim(), serviceId: String(f.get("service") || ""), date: String(f.get("date") || ""), time: String(f.get("time") || "") };
    if (appointments.some(a => a.date === item.date && a.time === item.time && a.status !== "Cancelado")) { setNotice("Esse horário já está ocupado. Escolha outro."); return; }
    try { const created = await api<Appointment>("/appointments", { method: "POST", body: JSON.stringify(item) }); setAppointments(old => [...old, created]); setModal(null); setNotice("Agendamento salvo no banco de dados."); } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar agendamento."); }
  }
  async function saveService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get("name") || "").trim(); const price = Number(f.get("price")); const duration = Number(f.get("duration")); const description = String(f.get("description") || "").trim();
    if (!name || price <= 0 || duration <= 0) { setNotice("Preencha os dados com valores válidos."); return; }
    try { const saved = await api<Service>(editing ? `/services/${editing.id}` : "/services", { method: editing ? "PUT" : "POST", body: JSON.stringify({ name, price, duration, description }) }); setServices(old => editing ? old.map(s => s.id === saved.id ? saved : s) : [...old, saved]); setModal(null); setEditing(null); setNotice("Serviço salvo no banco de dados."); } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar serviço."); }
  }
  async function updateStatus(id: string, status: Appointment["status"]) { try { const saved = await api<Appointment>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setAppointments(old => old.map(a => a.id === id ? saved : a)); setNotice(`Status atualizado: ${status}.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao atualizar status."); } }
  async function removeService(s: Service) { if (confirm(`Excluir “${s.name}”?`)) { try { await api(`/services/${s.id}`, { method: "DELETE" }); setServices(old => old.filter(x => x.id !== s.id)); setNotice("Serviço excluído."); } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao excluir serviço."); } } }
  async function reset() { if (confirm("Restaurar os dados de demonstração? Suas alterações serão removidas.")) { try { const data = await api<{services:Service[];appointments:Appointment[]}>("/reset", { method: "POST" }); setServices(data.services); setAppointments(data.appointments); setNotice("Dados de demonstração restaurados no banco."); } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao restaurar dados."); } } }
  const openNew = () => { setEditing(null); setModal(screen === "services" ? "service" : "booking"); };
  return <div className="layout">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">Z</span><span><b>ZENITH</b><small>BEAUTY STUDIO</small></span></div><div className="side-caption">GESTÃO</div>
      {([["agenda","▦","Agenda"],["services","✦","Serviços"],["clients","♙","Clientes"]] as [Screen,string,string][]).map(([id,icon,label]) => <button key={id} className={`nav ${screen === id ? "selected" : ""}`} onClick={() => { setScreen(id); setQuery(""); setFilter("Todos"); }}><span>{icon}</span>{label}</button>)}
      <div className="profile"><span className="avatar">Z</span><span><b>Equipe Zenith</b><small>Demonstração local</small></span></div>
    </aside>
    <main className="main"><header className="header"><div><span className="eyebrow">ZENITH BEAUTY STUDIO</span><h1>{screen === "agenda" ? "Agenda" : screen === "services" ? "Serviços" : "Clientes"}</h1></div><div className="header-right"><span className="date-chip">{new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long" })}</span><button className="button primary" onClick={openNew}>＋ {screen === "services" ? "Novo serviço" : "Novo agendamento"}</button></div></header>
      {screen === "agenda" && <><section className="stats"><article><span>Atendimentos hoje</span><strong>{todayAppointments.length}</strong><small>Agendados e concluídos</small></article><article><span>Agendamentos ativos</span><strong>{appointments.filter(a => a.status === "Agendado").length}</strong><small>Em toda a agenda</small></article><article><span>Clientes</span><strong>{clients.length}</strong><small>Identificados por telefone</small></article><article><span>Receita concluída hoje</span><strong>{money(income)}</strong><small>Serviços marcados como concluídos</small></article></section>
        <section className="panel"><div className="panel-head"><div><h2>Agendamentos</h2><p>Consulte e atualize os atendimentos.</p></div><div className="filters"><input aria-label="Buscar" placeholder="Buscar cliente ou telefone" value={query} onChange={e => setQuery(e.target.value)} /><select value={filter} onChange={e => setFilter(e.target.value)}><option>Todos</option><option>Agendado</option><option>Concluído</option><option>Cancelado</option></select></div></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>SERVIÇO</th><th>DATA / HORA</th><th>VALOR</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{listed.map(a => { const s = services.find(x => x.id === a.serviceId); return <tr key={a.id}><td><b>{a.client}</b><small className="subline">{a.phone}</small></td><td>{s?.name || "Serviço removido"}</td><td>{dateLabel(a.date)} · {a.time}</td><td>{s ? money(s.price) : "—"}</td><td><span className={`badge ${a.status}`}>{a.status}</span></td><td className="actions">{a.status === "Agendado" ? <><button className="link-action" onClick={() => updateStatus(a.id,"Concluído")}>Concluir</button><button className="link-action red" onClick={() => updateStatus(a.id,"Cancelado")}>Cancelar</button></> : <button className="link-action" onClick={() => updateStatus(a.id,"Agendado")}>Reabrir</button>}</td></tr>; })}{listed.length === 0 && <tr><td className="empty" colSpan={6}>Nenhum agendamento encontrado.</td></tr>}</tbody></table></div></section></>}
      {screen === "services" && <section className="panel"><div className="panel-head"><div><h2>Catálogo de serviços</h2><p>Cadastre e mantenha os serviços oferecidos pelo estúdio.</p></div></div><div className="cards">{services.map(s => <article className="service-card" key={s.id}><span className="service-icon">✦</span><h3>{s.name}</h3><p>{s.description || "Sem descrição cadastrada."}</p><div className="service-meta"><b>{money(s.price)}</b><span>{s.duration} min</span></div><div className="service-buttons"><button className="button light" onClick={() => { setEditing(s); setModal("service"); }}>Editar</button><button className="button outline-red" onClick={() => removeService(s)}>Excluir</button></div></article>)}{!services.length && <div className="empty">Nenhum serviço. Clique em “Novo serviço”.</div>}</div></section>}
      {screen === "clients" && <section className="panel"><div className="panel-head"><div><h2>Clientes</h2><p>Lista criada automaticamente pelos agendamentos.</p></div><input placeholder="Buscar cliente ou telefone" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>TELEFONE</th><th>AGENDAMENTOS</th><th>ÚLTIMO AGENDAMENTO</th></tr></thead><tbody>{clients.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase())).map(c => <tr key={c.phone}><td><b>{c.name}</b></td><td>{c.phone}</td><td>{c.visits}</td><td>{dateLabel(c.lastDate)}</td></tr>)}{clients.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase())).length === 0 && <tr><td className="empty" colSpan={4}>Nenhum cliente encontrado.</td></tr>}</tbody></table></div></section>}
      <footer className="footer"><span>Zenith Beauty · Projeto acadêmico demonstrativo</span><button className="text-button" onClick={reset}>Restaurar dados de exemplo</button></footer>
    </main>
    {notice && <div className="toast" role="status">{notice}</div>}
    {modal && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setModal(null); setEditing(null); } }}><section className="modal" role="dialog" aria-modal="true"><button className="close" aria-label="Fechar" onClick={() => { setModal(null); setEditing(null); }}>×</button><span className="eyebrow">{modal === "booking" ? "AGENDA" : "CATÁLOGO"}</span><h2>{modal === "booking" ? "Novo agendamento" : editing ? "Editar serviço" : "Novo serviço"}</h2><p className="modal-desc">Alterações serão salvas no banco de dados.</p>
      {modal === "booking" ? <form className="form" onSubmit={saveBooking}><label>Nome do cliente<input name="client" required maxLength={80} placeholder="Ex.: Ana Silva" /></label><label>Telefone<input name="phone" required type="tel" maxLength={20} placeholder="(11) 99999-9999" /></label><label>Serviço<select name="service" required defaultValue=""><option value="" disabled>Selecione um serviço</option>{services.map(s => <option value={s.id} key={s.id}>{s.name} · {money(s.price)}</option>)}</select></label><div className="form-row"><label>Data<input name="date" type="date" required min={today} defaultValue={today} /></label><label>Horário<input name="time" type="time" required min="08:00" max="20:00" step="1800" /></label></div><div className="form-buttons"><button type="button" className="button light" onClick={() => setModal(null)}>Voltar</button><button className="button primary">Salvar agendamento</button></div></form> : <form className="form" onSubmit={saveService}><label>Nome<input name="name" required maxLength={70} defaultValue={editing?.name || ""} placeholder="Ex.: Hidratação" /></label><label>Descrição<textarea name="description" rows={3} maxLength={200} defaultValue={editing?.description || ""} placeholder="Descreva o serviço" /></label><div className="form-row"><label>Preço (R$)<input name="price" type="number" required min="0.01" step="0.01" defaultValue={editing?.price ?? ""} /></label><label>Duração (minutos)<input name="duration" type="number" required min="1" max="600" defaultValue={editing?.duration ?? ""} /></label></div><div className="form-buttons"><button type="button" className="button light" onClick={() => { setModal(null); setEditing(null); }}>Voltar</button><button className="button primary">Salvar serviço</button></div></form>}</section></div>}
    <div className="demo-note">MVP acadêmico · SQLite local · Ainda requer autenticação e publicação para uso comercial.</div>
  </div>;
}
