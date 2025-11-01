import { useEffect, useMemo, useState } from 'react'
import AuthGate from '../components/AuthGate'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { fmt } from '../lib/money'

type Tx = { id:string; user_id:string; date:string; type:'income'|'expense'; category:string|null; method:'cash'|'gcash'|'bank'; amount:number; notes:string|null }
type Balance = { id:string; user_id:string; label:string; kind:'cash'|'bank'; balance:number; updated_at:string }

export default function Dashboard(){
  const [email, setEmail] = useState<string|null>(null)
  const [tx, setTx] = useState<Tx[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [filters, setFilters] = useState({ type:'all', method:'all', q:'', from:'', to:'' })

  async function load(){
    const me = await supabase.auth.getUser()
    setEmail(me.data.user?.email ?? null)
    let query = supabase.from('transactions').select('*').order('date', { ascending: false })
    if(filters.type!=='all') query = query.eq('type', filters.type as any)
    if(filters.method!=='all') query = query.eq('method', filters.method as any)
    if(filters.q) query = query.ilike('notes', `%${filters.q}%`)
    if(filters.from) query = query.gte('date', filters.from)
    if(filters.to) query = query.lte('date', filters.to)
    const { data: t } = await query
    setTx(t as Tx[] || [])
    const { data: b } = await supabase.from('balances').select('*').order('updated_at', { ascending:false })
    setBalances(b as Balance[] || [])
  }
  useEffect(() => { load() }, [filters.type, filters.method, filters.q, filters.from, filters.to])

  const totals = useMemo(() => {
    const income = tx.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0)
    const expense = tx.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0)
    const net = income - expense
    const currentMoney = balances.reduce((a,b)=>a+b.balance,0)
    const byMethod = ['cash','gcash','bank'].map(m => ({
      method: m,
      income: tx.filter(x=>x.type==='income' && x.method===m).reduce((a,b)=>a+b.amount,0),
      expense: tx.filter(x=>x.type==='expense' && x.method===m).reduce((a,b)=>a+b.amount,0)
    }))
    return { income, expense, net, currentMoney, byMethod }
  }, [tx, balances])

  async function addTx(e:any){
    e.preventDefault()
    const form = new FormData(e.target as HTMLFormElement)
    const payload = {
      date: form.get('date') as string,
      type: form.get('type') as 'income'|'expense',
      category: (form.get('category') as string) || null,
      method: form.get('method') as 'cash'|'gcash'|'bank',
      amount: Number(form.get('amount')),
      notes: (form.get('notes') as string) || null
    }
    const { error: txErr } = await supabase.from('transactions').insert(payload as any)
    if (txErr) { alert('Save failed: ' + txErr.message); return; }
    (e.target as HTMLFormElement).reset()
    load()
  }

  async function addBalance(e:any){
    e.preventDefault()
    const f = new FormData(e.target as HTMLFormElement)
    const record = { label: f.get('label') as string, kind: f.get('kind') as 'cash'|'bank', balance: Number(f.get('balance')) }
    const { error: balErr } = await supabase.from('balances').insert(record as any)
    if (balErr) { alert('Save failed: ' + balErr.message); return; }
    (e.target as HTMLFormElement).reset()
    load()
  }

  return (
    <AuthGate>
      <Nav email={email} />
      <div className="container">
        <div className="kpi">
          <div className="card"><h3>Total Income</h3><div>{fmt(totals.income)}</div></div>
          <div className="card"><h3>Total Expenses</h3><div>{fmt(totals.expense)}</div></div>
          <div className="card"><h3>Net Profit</h3><div>{fmt(totals.net)}</div></div>
          <div className="card"><h3>Money on Hand + Bank</h3><div>{fmt(totals.currentMoney)}</div></div>
          <div className="card"><h3>Gap (Net vs Money)</h3><div>{fmt(totals.currentMoney - totals.net)}</div></div>
        </div>

        <div className="card">
          <h2>Add Transaction</h2>
          <form onSubmit={addTx} className="row">
            <div style={{gridColumn:'span 2'}}><label>Date</label><input className="input" type="date" name="date" required/></div>
            <div style={{gridColumn:'span 2'}}><label>Type</label><select name="type" className="input" required><option value="income">Income</option><option value="expense">Expense</option></select></div>
            <div style={{gridColumn:'span 3'}}><label>Category</label><input className="input" name="category" placeholder="e.g. Sales / Rent / COGS"/></div>
            <div style={{gridColumn:'span 2'}}><label>Method</label><select name="method" className="input" required><option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank">Bank</option></select></div>
            <div style={{gridColumn:'span 2'}}><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required/></div>
            <div style={{gridColumn:'span 12'}}><label>Notes</label><input className="input" name="notes" placeholder="optional"/></div>
            <div style={{gridColumn:'span 12'}}><button className="btn">Save</button></div>
          </form>
        </div>

        <div className="card">
          <h2>Filters</h2>
          <div className="row">
            <div style={{gridColumn:'span 2'}}><label>Type</label><select className="input" value={filters.type} onChange={e=>setFilters({...filters, type:e.target.value})}><option value="all">All</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
            <div style={{gridColumn:'span 2'}}><label>Method</label><select className="input" value={filters.method} onChange={e=>setFilters({...filters, method:e.target.value})}><option value="all">All</option><option value="cash">Cash</option><option value="gcash">GCash</option><option value="bank">Bank</option></select></div>
            <div style={{gridColumn:'span 3'}}><label>From</label><input className="input" type="date" value={filters.from} onChange={e=>setFilters({...filters, from:e.target.value})}/></div>
            <div style={{gridColumn:'span 3'}}><label>To</label><input className="input" type="date" value={filters.to} onChange={e=>setFilters({...filters, to:e.target.value})}/></div>
            <div style={{gridColumn:'span 2'}}><label>Search</label><input className="input" placeholder="notes..." value={filters.q} onChange={e=>setFilters({...filters, q:e.target.value})}/></div>
          </div>
        </div>

        <div className="card">
          <h2>Transactions</h2>
          <table className="table">
            <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Method</th><th>Amount</th><th>Notes</th></tr></thead>
            <tbody>
              {tx.map(row => (<tr key={row.id}><td>{row.date}</td><td>{row.type}</td><td>{row.category}</td><td>{row.method}</td><td>{fmt(row.amount)}</td><td>{row.notes}</td></tr>))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Add Money Balance (Cash/Bank)</h2>
          <form onSubmit={addBalance} className="row">
            <div style={{gridColumn:'span 3'}}><label>Label</label><input className="input" name="label" placeholder="e.g. Cash Drawer / BDO"/></div>
            <div style={{gridColumn:'span 3'}}><label>Kind</label><select className="input" name="kind"><option value="cash">Cash</option><option value="bank">Bank</option></select></div>
            <div style={{gridColumn:'span 3'}}><label>Balance</label><input className="input" type="number" step="0.01" name="balance" required/></div>
            <div style={{gridColumn:'span 3'}}><label>&nbsp;</label><button className="btn">Save</button></div>
          </form>

          <table className="table" style={{marginTop:12}}>
            <thead><tr><th>Label</th><th>Kind</th><th>Balance</th><th>Updated</th></tr></thead>
            <tbody>
              {balances.map(b => (<tr key={b.id}><td>{b.label}</td><td>{b.kind}</td><td>{fmt(b.balance)}</td><td>{new Date(b.updated_at).toLocaleString()}</td></tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGate>
  )
}
