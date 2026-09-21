const http = require('http');
const url = require('url');
const path = require('path');
const { createClient } = require('@libsql/client');

const PORT = 5555;
const dbPath = path.resolve(__dirname, '../dev.db');
const client = createClient({ url: `file:${dbPath}` });

async function getTables() {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
  );
  const tables = [];
  for (const row of result.rows) {
    const tableName = row.name;
    try {
      const countRes = await client.execute(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const count = countRes.rows[0]?.count ?? 0;
      tables.push({ name: tableName, count: Number(count) });
    } catch {
      tables.push({ name: tableName, count: 0 });
    }
  }
  return tables;
}

async function getTableData(tableName, page = 1, limit = 50, search = '') {
  // Validate table name against sqlite_master to prevent injection
  const validTables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [tableName]
  );
  if (validTables.rows.length === 0) {
    throw new Error('Table not found');
  }

  // Get table columns
  const colsRes = await client.execute(`PRAGMA table_info("${tableName}")`);
  const columns = colsRes.rows.map(c => ({
    cid: c.cid,
    name: c.name,
    type: c.type,
    notnull: c.notnull,
    dflt_value: c.dflt_value,
    pk: c.pk,
  }));

  const offset = (Math.max(1, page) - 1) * limit;
  const countRes = await client.execute(`SELECT COUNT(*) as total FROM "${tableName}"`);
  const total = Number(countRes.rows[0]?.total ?? 0);

  const dataRes = await client.execute(
    `SELECT * FROM "${tableName}" LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
  );

  return {
    tableName,
    columns,
    rows: dataRes.rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit) || 1,
  };
}

async function executeQuery(sql) {
  const trimmed = sql.trim();
  const res = await client.execute(trimmed);
  return {
    columns: res.columns,
    rows: res.rows,
    rowsAffected: res.rowsAffected,
  };
}

function getHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Studio | EPMS SQLite Viewer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --card-bg: #0f172a;
      --sidebar-bg: #090e1a;
      --border: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
      font-size: 13px;
    }
    /* Sidebar */
    #sidebar {
      width: 290px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
    }
    .brand-text h1 { font-size: 14px; font-weight: 700; color: #fff; }
    .brand-text p { font-size: 10px; color: var(--text-muted); }
    .search-box {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .search-box input {
      width: 100%;
      padding: 8px 12px;
      background: #030712;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #fff;
      font-size: 12px;
      outline: none;
    }
    .search-box input:focus { border-color: var(--accent); }
    .table-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .table-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 6px;
      color: #cbd5e1;
      text-decoration: none;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      margin-bottom: 2px;
      transition: all 0.15s ease;
    }
    .table-item:hover { background: #1e293b; color: #fff; }
    .table-item.active { background: #312e81; color: #a5b4fc; font-weight: 600; }
    .count-badge {
      font-size: 10px;
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 10px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
    }
    .table-item.active .count-badge { background: #4338ca; color: #e0e7ff; }

    /* Main Area */
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg);
    }
    .topbar {
      height: 52px;
      border-bottom: 1px solid var(--border);
      background: var(--card-bg);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      gap: 16px;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .table-title {
      font-size: 15px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
    }
    .badge {
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      background: #1e293b;
      color: #94a3b8;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border);
      background: #1e293b;
      color: #f8fafc;
      transition: all 0.15s ease;
    }
    .btn:hover { background: #334155; }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .btn-primary:hover { background: var(--accent-hover); }

    /* SQL Drawer */
    #sql-box {
      background: #0f172a;
      border-bottom: 1px solid var(--border);
      padding: 14px 20px;
      display: none;
    }
    #sql-input {
      width: 100%;
      height: 70px;
      background: #020617;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      color: #a5f3fc;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      resize: vertical;
      outline: none;
    }
    #sql-input:focus { border-color: var(--accent); }
    .sql-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    /* Content Area */
    .content-area {
      flex: 1;
      overflow: auto;
      padding: 20px;
    }
    .data-table-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    .table-container {
      overflow-x: auto;
      max-height: calc(100vh - 170px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }
    th {
      background: #090e1a;
      padding: 10px 14px;
      color: #94a3b8;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 10;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid #1e293b55;
      white-space: nowrap;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #cbd5e1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }
    tr:hover td { background: #1e293b66; color: #fff; }
    .val-null { color: #64748b; font-style: italic; }
    .val-pk { color: #f59e0b; font-weight: 600; }
    .val-bool { color: #a855f7; }
    .val-date { color: #06b6d4; }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #090e1a;
      border-top: 1px solid var(--border);
    }
    .page-info { color: var(--text-muted); font-size: 12px; }

    /* Empty state */
    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: var(--text-muted);
    }
    .empty-state h3 { font-size: 16px; color: #fff; margin-bottom: 6px; }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="brand-icon">🗄️</div>
      <div class="brand-text">
        <h1>Database Studio</h1>
        <p>dev.db (SQLite / Prisma)</p>
      </div>
    </div>
    <div class="search-box">
      <input type="text" id="table-search" placeholder="Search tables..." oninput="filterTables()">
    </div>
    <div class="table-list" id="table-list">
      <div style="padding: 20px; text-align: center; color: #64748b;">Loading tables...</div>
    </div>
  </aside>

  <!-- Main View -->
  <main id="main">
    <div class="topbar">
      <div class="topbar-left">
        <span class="table-title" id="current-table-title">Select a table</span>
        <span class="badge" id="current-table-count">0 rows</span>
      </div>
      <div class="topbar-right">
        <button class="btn" onclick="toggleSqlBox()">⚡ SQL Query</button>
        <button class="btn" onclick="refreshCurrentTable()">🔄 Refresh</button>
      </div>
    </div>

    <!-- SQL Runner Box -->
    <div id="sql-box">
      <textarea id="sql-input" placeholder="SELECT * FROM users LIMIT 10;"></textarea>
      <div class="sql-actions">
        <button class="btn" onclick="toggleSqlBox()">Close</button>
        <button class="btn btn-primary" onclick="runCustomQuery()">Run Query</button>
      </div>
    </div>

    <!-- Content Table -->
    <div class="content-area">
      <div class="data-table-card">
        <div class="table-container" id="table-container">
          <div class="empty-state">
            <h3>No table selected</h3>
            <p>Select any table from the sidebar on the left to view its schema and records.</p>
          </div>
        </div>
        <div class="pagination" id="pagination" style="display: none;">
          <span class="page-info" id="page-info">Showing 1-50 of 0</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn" id="prev-btn" onclick="changePage(-1)">Previous</button>
            <button class="btn" id="next-btn" onclick="changePage(1)">Next</button>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    let allTables = [];
    let currentTable = null;
    let currentPage = 1;
    let totalPages = 1;

    async function loadTables() {
      try {
        const res = await fetch('/api/tables');
        allTables = await res.json();
        renderTableList(allTables);
        if (allTables.length > 0 && !currentTable) {
          selectTable(allTables[0].name);
        }
      } catch (err) {
        document.getElementById('table-list').innerHTML = '<div style="padding: 20px; color: #ef4444;">Failed to load tables</div>';
      }
    }

    function renderTableList(tables) {
      const container = document.getElementById('table-list');
      if (tables.length === 0) {
        container.innerHTML = '<div style="padding: 16px; color: #64748b;">No tables found</div>';
        return;
      }
      container.innerHTML = tables.map(t => \`
        <div class="table-item \${currentTable === t.name ? 'active' : ''}" onclick="selectTable('\${t.name}')">
          <span>\${t.name}</span>
          <span class="count-badge">\${t.count}</span>
        </div>
      \`).join('');
    }

    function filterTables() {
      const query = document.getElementById('table-search').value.toLowerCase();
      const filtered = allTables.filter(t => t.name.toLowerCase().includes(query));
      renderTableList(filtered);
    }

    async function selectTable(name, page = 1) {
      currentTable = name;
      currentPage = page;
      document.getElementById('current-table-title').textContent = name;
      renderTableList(allTables);

      const container = document.getElementById('table-container');
      container.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Loading records...</div>';

      try {
        const res = await fetch(\`/api/table/\${name}?page=\${page}&limit=50\`);
        const data = await res.json();
        
        document.getElementById('current-table-count').textContent = \`\${data.total} rows\`;
        totalPages = data.totalPages;

        renderDataTable(data.columns, data.rows);

        // Update pagination
        const pagination = document.getElementById('pagination');
        if (data.total > 0) {
          pagination.style.display = 'flex';
          const start = (page - 1) * 50 + 1;
          const end = Math.min(page * 50, data.total);
          document.getElementById('page-info').textContent = \`Showing \${start}-\${end} of \${data.total} records (Page \${page} of \${totalPages})\`;
          document.getElementById('prev-btn').disabled = page <= 1;
          document.getElementById('next-btn').disabled = page >= totalPages;
        } else {
          pagination.style.display = 'none';
        }
      } catch (err) {
        container.innerHTML = \`<div style="padding: 40px; text-align: center; color: #ef4444;">Error: \${err.message}</div>\`;
      }
    }

    function renderDataTable(columns, rows) {
      const container = document.getElementById('table-container');
      if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>Table is empty</h3><p>No records found in this table.</p></div>';
        return;
      }

      let html = '<table><thead><tr>';
      columns.forEach(col => {
        const pkIcon = col.pk ? ' 🔑' : '';
        html += \`<th>\${col.name}\${pkIcon}</th>\`;
      });
      html += '</tr></thead><tbody>';

      rows.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
          let val = row[col.name];
          let formatted = val;
          let className = '';

          if (val === null || val === undefined) {
            formatted = 'NULL';
            className = 'val-null';
          } else if (typeof val === 'boolean' || val === 0 || val === 1 && (col.type === 'BOOLEAN' || col.type === 'INTEGER' && (col.name.startsWith('is') || col.name.startsWith('has')))) {
            formatted = val ? 'true' : 'false';
            className = 'val-bool';
          } else if (typeof val === 'object') {
            formatted = JSON.stringify(val);
          } else if (String(val).length > 60) {
            formatted = String(val).substring(0, 60) + '...';
          }
          if (col.pk) className += ' val-pk';

          html += \`<td class="\${className}" title="\${val !== null ? String(val).replace(/"/g, '&quot;') : 'NULL'}">\${formatted}</td>\`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function changePage(delta) {
      const target = currentPage + delta;
      if (target >= 1 && target <= totalPages) {
        selectTable(currentTable, target);
      }
    }

    function refreshCurrentTable() {
      loadTables();
      if (currentTable) {
        selectTable(currentTable, currentPage);
      }
    }

    function toggleSqlBox() {
      const box = document.getElementById('sql-box');
      box.style.display = box.style.display === 'none' || !box.style.display ? 'block' : 'none';
      if (box.style.display === 'block') {
        document.getElementById('sql-input').focus();
      }
    }

    async function runCustomQuery() {
      const sql = document.getElementById('sql-input').value.trim();
      if (!sql) return;
      const container = document.getElementById('table-container');
      container.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Executing query...</div>';

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        document.getElementById('current-table-title').textContent = 'Custom Query Results';
        document.getElementById('current-table-count').textContent = \`\${data.rows.length} rows\`;
        document.getElementById('pagination').style.display = 'none';

        const cols = (data.columns || Object.keys(data.rows[0] || {})).map(c => ({ name: c }));
        renderDataTable(cols, data.rows);
      } catch (err) {
        container.innerHTML = \`<div style="padding: 40px; text-align: center; color: #ef4444;">Query Error: \${err.message}</div>\`;
      }
    }

    loadTables();
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getHtml());
      return;
    }

    if (pathname === '/api/tables' && req.method === 'GET') {
      const tables = await getTables();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tables));
      return;
    }

    if (pathname.startsWith('/api/table/') && req.method === 'GET') {
      const tableName = decodeURIComponent(pathname.replace('/api/table/', ''));
      const page = parseInt(parsed.query.page || '1', 10);
      const limit = parseInt(parsed.query.limit || '50', 10);
      const search = parsed.query.search || '';
      const data = await getTableData(tableName, page, limit, search);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === '/api/query' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { sql } = JSON.parse(body || '{}');
          if (!sql) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'SQL query is required' }));
            return;
          }
          const result = await executeQuery(sql);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (queryErr) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: queryErr.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Database Studio is actively running on: http://localhost:${PORT}`);
  console.log(`Connected to SQLite file: ${dbPath}`);
});
