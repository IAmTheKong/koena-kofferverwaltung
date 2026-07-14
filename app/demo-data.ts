export type Status = "available" | "in_use" | "awaiting_acceptance" | "issue_reported" | "maintenance";
export type InventoryItem = { name:string; expected:number; actual:number; icon:string };
export type CaseItem = { id:string; name:string; status:Status; holder:string; address:string; location:string; updated:string; inventory:InventoryItem[]; history:{date:string;title:string;detail:string}[] };
const base:InventoryItem[]=[
{name:"Server",expected:1,actual:1,icon:"▤"},{name:"Drucker",expected:3,actual:3,icon:"▣"},{name:"Handys",expected:4,actual:4,icon:"▯"},{name:"USV",expected:1,actual:1,icon:"▰"},{name:"Tablets",expected:2,actual:2,icon:"▭"},{name:"Router",expected:1,actual:1,icon:"⌁"},{name:"Kabel & Zubehör",expected:15,actual:15,icon:"⌇"},{name:"Weiteres",expected:0,actual:0,icon:"•••"}];
const inv=()=>base.map(x=>({...x}));
export const casesSeed:CaseItem[]=[
{id:"KFR-001",name:"Technikkoffer 01",status:"in_use",holder:"Max Mustermann",address:"Musterstraße 12, 4240 Freistadt",location:"Freistadt",updated:"13.07.2025, 14:32",inventory:inv(),history:[{date:"13.07.2025, 14:32",title:"Übernahme abgeschlossen",detail:"Max Mustermann · Freistadt"}]},
{id:"KFR-002",name:"Technikkoffer 02",status:"available",holder:"–",address:"Lager Freistadt",location:"Freistadt",updated:"10.07.2025, 09:15",inventory:inv(),history:[{date:"10.07.2025, 09:15",title:"Rückgabe abgeschlossen",detail:"Lager Freistadt"}]},
{id:"KFR-003",name:"Technikkoffer 03",status:"in_use",holder:"Peter Neumann",address:"Markt 4, 4251 Sandl",location:"Sandl",updated:"12.07.2025, 18:42",inventory:inv().map(x=>x.name==="Drucker"?{...x,actual:2}:x),history:[{date:"12.07.2025, 18:42",title:"Übernahme mit Abweichung",detail:"1 Drucker fehlt"}]},
{id:"KFR-004",name:"Technikkoffer 04",status:"in_use",holder:"Lisa Wagner",address:"Kirchenplatz 2, 4264 Grünbach",location:"Grünbach",updated:"11.07.2025, 16:05",inventory:inv(),history:[{date:"11.07.2025, 16:05",title:"Übernahme abgeschlossen",detail:"Lisa Wagner · Grünbach"}]},
{id:"KFR-005",name:"Technikkoffer 05",status:"awaiting_acceptance",holder:"–",address:"Summerauer Straße 8, 4261 Rainbach",location:"Rainbach",updated:"13.07.2025, 09:15",inventory:inv(),history:[{date:"13.07.2025, 09:15",title:"Wartet auf Übernahme",detail:"Abschluss durch Vormieter"}]},
];
export const getCase=(id:string)=>casesSeed.find(c=>c.id.toLowerCase()===id.toLowerCase())??casesSeed[0];
export const statusLabels:Record<Status,string>={available:"Verfügbar",in_use:"In Nutzung",awaiting_acceptance:"Wartet auf Übernahme",issue_reported:"Hinweis",maintenance:"Wartung"};
