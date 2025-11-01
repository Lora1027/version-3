import { useEffect, useMemo, useState } from 'react'
import AuthGate from '../components/AuthGate'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { fmt } from '../lib/money'
type Tx = { date:string; type:'income'|'expense'; category:string|null; method:'cash'|'gcash'|'bank'; amount:number }
function sum(nums:number[]){ return nums.reduce((a,b)=>a+b,0) }
export default function Comparison(){
  const [email, setEmail] = useState<string|null>(null)
  const [rangeA, setA] = useState({ from:'', to:'' })
  const [rangeB, setB] = useState({ from:'', to:'' })
  const [rowsA, setRowsA] = useState<Tx[]>([])
  const [rowsB, setRowsB] = useState<Tx[]>([])
  useEffect(()=>{ supabase.auth.getUser().then(u => setEmail(u.data.user?.email ?? null)) }, [])
  async function load(which:'A'|'B'){
    const r = which==='A' ? rangeA : rangeB
    let q = supabase.from('transactions').select('*')
    if(r.from) q = q.gte('date', r.from)
    if(r.to) q = q.lte('date', r.to)
    const { data, error } = await q
    if (error) { alert('Load failed: ' + error.message); return; }
    if(which==='A') setRowsA(data||[]); else setRowsB(data||[])
  }
  function kpis(rows:Tx[]){
    const income = sum(rows.filter(x=>x.type==='income').map(x=>x.amount))
    const expense = sum(rows.filter(x=>x.type==='expense').map(x=>x.amount))
    const net = income - expense
    const cogs = sum(rows.filter(x=>x.category?.toLowerCase()==='cogs').map(x=>x.amount))
    const grossMargin = income - cogs
    const mop = (m:Tx['method']) => ({ income: sum(rows.filter(x=>x.type==='income' && x.method===m).map(x=>x.amount)), expense: sum(rows.filter(x=>x.type==='expense' && x.method===m).map(x=>x.amount)) })
    return { income, expense, net, grossMargin, cash:mop('cash'), gcash:mop('gcash'), bank:mop('bank') }
  }
  const A = useMemo(()=>kpis(rowsA), [rowsA])
  const B = useMemo(()=>kpis(rowsB), [rowsB])
  function Delta(a:number,b:number){ const d=(a-b); const pct=b===0?0:(d/b*100); return <span>{fmt(d)} ({pct.toFixed(1)}%)</span> }
  return (<AuthGate><Nav email={email} /><div className="container"><div className="card"><h2>Pick Two Ranges to Compare</h2><div className="row"><div style={{gridColumn:'span 6'}}><h3>Range A</h3><label>From</label><input className="input" type="date" value={rangeA.from} onChange={e=>setA({...rangeA, from:e.target.value})}/><label>To</label><input className="input" type="date" value={rangeA.to} onChange={e=>setA({...rangeA, to:e.target.value})}/><div style={{marginTop:8}}><button className="btn" onClick={()=>load('A')}>Load A</button></div></div><div style={{gridColumn:'span 6'}}><h3>Range B</h3><label>From</label><input className="input" type="date" value={rangeB.from} onChange={e=>setB({...rangeB, from:e.target.value})}/><label>To</label><input className="input" type="date" value={rangeB.to} onChange={e=>setB({...rangeB, to:e.target.value})}/><div style={{marginTop:8}}><button className="btn" onClick={()=>load('B')}>Load B</button></div></div></div></div><div className="card"><h2>KPIs</h2><div className="kpi"><div className="card"><h3>Revenue</h3><div>{fmt(A.income)} vs {fmt(B.income)}<br/><span className="small">Δ {Delta(A.income,B.income)}</span></div></div><div className="card"><h3>Expenses</h3><div>{fmt(A.expense)} vs {fmt(B.expense)}<br/><span className="small">Δ {Delta(A.expense,B.expense)}</span></div></div><div className="card"><h3>Gross Margin (est.)</h3><div>{fmt(A.grossMargin)} vs {fmt(B.grossMargin)}<br/><span className="small">Δ {Delta(A.grossMargin,B.grossMargin)}</span></div></div><div className="card"><h3>Net Profit</h3><div>{fmt(A.net)} vs {fmt(B.net)}<br/><span className="small">Δ {Delta(A.net,B.net)}</span></div></div><div className="card"><h3>Method Mix (Income)</h3><div>Cash {fmt(A.cash.income)} vs {fmt(B.cash.income)}<br/>GCash {fmt(A.gcash.income)} vs {fmt(B.gcash.income)}<br/>Bank {fmt(A.bank.income)} vs {fmt(B.bank.income)}</div></div></div></div></div></AuthGate>)
}
