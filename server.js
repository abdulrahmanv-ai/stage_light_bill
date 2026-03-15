const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ── DATABASE SETUP ──────────────────────────────────
const db = new Database('data.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT, name TEXT NOT NULL, phone TEXT,
    area TEXT, cr TEXT, tax TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT, name TEXT NOT NULL, cat TEXT,
    price REAL DEFAULT 0, unit TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    num TEXT, client TEXT, phone TEXT, area TEXT,
    pay TEXT, desc TEXT, edate TEXT, days INTEGER DEFAULT 1,
    items TEXT, disc REAL DEFAULT 0, del REAL DEFAULT 0,
    ins REAL DEFAULT 0, recv REAL DEFAULT 0,
    sub REAL DEFAULT 0, total REAL DEFAULT 0, rem REAL DEFAULT 0,
    date TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default products if empty
const prodCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (prodCount === 0) {
  const ins = db.prepare('INSERT INTO products (code,name,cat,price,unit) VALUES (?,?,?,?,?)');
  const defaults = [
    ['00100','سماعة بلوتوث شحن صغير','صوتيات',150,'قطعة'],
    ['00101','سماعة بلوتوث شحن وسط','صوتيات',200,'قطعة'],
    ['00102','سماعة بلوتوث شحن كبير','صوتيات',250,'قطعة'],
    ['00107','مكسر صوت','صوتيات',200,'قطعة'],
    ['00108','مايك لاسلكي','صوتيات',100,'قطعة'],
    ['00109','بروجكتر','إضاءة',200,'قطعة'],
    ['02100','ستيج مضيء','ستيج',500,'يوم'],
    ['02101','ستيج عادي','ستيج',300,'يوم'],
    ['01100','كرسي عادي بدون تلبيسة','كراسي وطاولات',5,'حبة'],
    ['01101','كرسي عادي مع تلبيسة','كراسي وطاولات',8,'حبة'],
    ['01102','كرسي نابليون ذهبي','كراسي وطاولات',15,'حبة'],
    ['03100','آلة آيسكريم','ألعاب وتسلية',200,'يوم'],
    ['03101','آلة بخار','ألعاب وتسلية',150,'يوم'],
  ];
  defaults.forEach(r => ins.run(...r));
}

// ── API ROUTES ──────────────────────────────────────

// CLIENTS
app.get('/api/clients',    () => {}).all('/api/clients', (req, res) => {
  if (req.method === 'GET') return res.json(db.prepare('SELECT * FROM clients ORDER BY id DESC').all());
  if (req.method === 'POST') {
    const { code, name, phone, area, cr, tax } = req.body;
    const r = db.prepare('INSERT INTO clients (code,name,phone,area,cr,tax) VALUES (?,?,?,?,?,?)').run(code,name,phone||'',area||'',cr||'',tax||'');
    return res.json({ id: r.lastInsertRowid, ...req.body });
  }
});
app.put('/api/clients/:id', (req, res) => {
  const { code, name, phone, area, cr, tax } = req.body;
  db.prepare('UPDATE clients SET code=?,name=?,phone=?,area=?,cr=?,tax=? WHERE id=?').run(code,name,phone||'',area||'',cr||'',tax||'',req.params.id);
  res.json({ success: true });
});
app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// PRODUCTS
app.get('/api/products', (req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY cat,name').all()));
app.post('/api/products', (req, res) => {
  const { code, name, cat, price, unit } = req.body;
  const r = db.prepare('INSERT INTO products (code,name,cat,price,unit) VALUES (?,?,?,?,?)').run(code,name,cat,price||0,unit||'قطعة');
  res.json({ id: r.lastInsertRowid, ...req.body });
});
app.put('/api/products/:id', (req, res) => {
  const { code, name, cat, price, unit } = req.body;
  db.prepare('UPDATE products SET code=?,name=?,cat=?,price=?,unit=? WHERE id=?').run(code,name,cat,price||0,unit||'قطعة',req.params.id);
  res.json({ success: true });
});
app.delete('/api/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// INVOICES
app.get('/api/invoices', (req, res) => {
  const rows = db.prepare('SELECT * FROM invoices ORDER BY id DESC').all();
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items || '[]') })));
});
app.post('/api/invoices', (req, res) => {
  const d = req.body;
  const r = db.prepare(`INSERT INTO invoices (num,client,phone,area,pay,desc,edate,days,items,disc,del,ins,recv,sub,total,rem)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    d.num,d.client,d.phone||'',d.area||'',d.pay||'كاش',d.desc||'',d.edate||'',d.days||1,
    JSON.stringify(d.items||[]),d.disc||0,d.del||0,d.ins||0,d.recv||0,d.sub||0,d.total||0,d.rem||0
  );
  res.json({ id: r.lastInsertRowid });
});
app.delete('/api/invoices/:id', (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.json({ success: true });
});
app.delete('/api/invoices', (req, res) => {
  db.prepare('DELETE FROM invoices').run();
  res.json({ success: true });
});

// STATS
app.get('/api/stats', (req, res) => {
  const count  = db.prepare('SELECT COUNT(*) as v FROM invoices').get().v;
  const total  = db.prepare('SELECT COALESCE(SUM(total),0) as v FROM invoices').get().v;
  const debt   = db.prepare('SELECT COALESCE(SUM(rem),0) as v FROM invoices WHERE rem > 0').get().v;
  const clients= db.prepare('SELECT COUNT(*) as v FROM clients').get().v;
  res.json({ count, total, debt, clients });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Stage Lights running on port ${PORT}`));
