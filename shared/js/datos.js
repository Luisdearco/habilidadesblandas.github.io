// Capa de datos. Dos modos (ver config.js):
//  - local:    todo se guarda en el navegador (solo para probar).
//  - supabase: base de datos compartida (uso real: el profesor ve lo que hace el estudiante).
(function () {
  var CFG = window.HB_CONFIG || { modo: 'local' };
  var TK = 'hb_token';
  var HB = window.HB = { cfg: CFG, cursos: [{"slug": "comunicacion", "nombre": "Comunicación asertiva"}, {"slug": "liderazgo", "nombre": "Liderazgo"}, {"slug": "trabajo-en-equipo", "nombre": "Trabajo en equipo"}, {"slug": "inteligencia-emocional", "nombre": "Inteligencia emocional"}, {"slug": "oratoria", "nombre": "Oratoria"}, {"slug": "control-del-tiempo", "nombre": "Control del tiempo"}], yo: null };

  HB.nombreCurso = function (s) { var c = HB.cursos.filter(function (x) { return x.slug === s; })[0]; return c ? c.nombre : s; };
  HB.fecha = function (iso) { return iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
  HB.nota = function (n) { return (n === null || n === undefined) ? '—' : Number(n).toFixed(1).replace('.', ','); };
  HB.esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ---------------------------------------------------------------- modo Supabase
  function remoto(op, args) {
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/hb_rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey },
      body: JSON.stringify({ p_token: sessionStorage.getItem(TK), p_op: op, p_args: args || {} })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.error) throw new Error(j.error);
      if (j && j.message && !('ok' in j)) throw new Error(j.message);
      return j;
    });
  }

  // ---------------------------------------------------------------- modo local
  var DB = 'hb_db', SEED = null;
  function sha(t) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('inseguro'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function leer() { try { return JSON.parse(localStorage.getItem(DB)); } catch (e) { return null; } }
  function guardar(db) { localStorage.setItem(DB, JSON.stringify(db)); }
  function nuevoId() { return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4); }
  function estadoDe(e) {
    var t = Date.now();
    if (!e || !e.visible) return 'oculto';
    if (e.apertura && t < Date.parse(e.apertura)) return 'programado';
    if (e.cierre && t > Date.parse(e.cierre)) return 'cerrado';
    return 'abierto';
  }
  function sembrar() {
    var db = { usuarios: [], matriculas: [], examenes: {}, intentos: [], descargas: [] };
    return Promise.all(SEED.usuarios.map(function (u) {
      return sha(u.id + ':' + u.clave).then(function (h) {
        db.usuarios.push({ id: u.id, nombre: u.nombre, cedula: u.cedula || '', usuario: u.usuario || '', correo: u.correo || '', rol: u.rol, hash: h, activo: true });
        (u.cursos || []).forEach(function (c) { db.matriculas.push({ u: u.id, c: c }); });
      });
    })).then(function () {
      HB.cursos.forEach(function (c) { db.examenes[c.slug] = { visible: true, apertura: null, cierre: null, intentos: 3 }; });
      guardar(db); return db;
    });
  }
  function pub(u) { return { id: u.id, nombre: u.nombre, rol: u.rol, cedula: u.cedula }; }
  function soloProfe(u) { if (u.rol !== 'profesor') throw new Error('permiso'); }
  function matriculado(db, u, c) { return db.matriculas.some(function (m) { return m.u === u.id && m.c === c; }); }

  var ops = {
    yo: function (a, u) { return { usuario: pub(u) }; },
    mis_cursos: function (a, u, db) { return { cursos: db.matriculas.filter(function (m) { return m.u === u.id; }).map(function (m) { return m.c; }) }; },
    examen: function (a, u, db) {
      if (!matriculado(db, u, a.curso)) throw new Error('sin_matricula');
      var e = db.examenes[a.curso] || {}, est = estadoDe(e), pre = SEED.preguntas[a.curso] || [];
      var mios = db.intentos.filter(function (i) { return i.u === u.id && i.curso === a.curso; });
      var mejor = mios.length ? Math.max.apply(null, mios.map(function (i) { return i.nota; })) : null;
      var r = { estado: est, apertura: e.apertura, cierre: e.cierre, intentosMax: e.intentos || 1, usados: mios.length, mejor: mejor, total: pre.length };
      if (est === 'abierto' && mios.length < r.intentosMax) r.preguntas = pre.map(function (p) { return { q: p.q, o: p.o }; });
      return r;
    },
    enviar_examen: function (a, u, db) {
      var r = ops.examen(a, u, db);
      if (r.estado !== 'abierto' || !r.preguntas) throw new Error('no_disponible');
      var pre = SEED.preguntas[a.curso], det = pre.map(function (p, i) { return Number(a.respuestas[i]) === p.ok; });
      var ok = det.filter(Boolean).length, nota = Math.round(ok / pre.length * 50) / 10;
      db.intentos.push({ id: nuevoId(), u: u.id, curso: a.curso, nota: nota, correctas: ok, total: pre.length, fecha: new Date().toISOString() });
      guardar(db);
      return { nota: nota, correctas: ok, total: pre.length, detalle: det };
    },
    mis_notas: function (a, u, db) {
      return { intentos: db.intentos.filter(function (i) { return i.u === u.id; }) };
    },
    registrar_descarga: function (a, u, db) {
      db.descargas.push({ u: u.id, archivo: a.archivo, curso: a.curso, fecha: new Date().toISOString() }); guardar(db); return { ok: true };
    },
    mis_descargas: function (a, u, db) {
      var m = {};
      db.descargas.filter(function (d) { return d.u === u.id; }).forEach(function (d) { if (!m[d.archivo] || d.fecha > m[d.archivo]) m[d.archivo] = d.fecha; });
      return { descargas: Object.keys(m).map(function (k) { return { archivo: k, fecha: m[k] }; }) };
    },
    // ---- profesor
    estudiantes: function (a, u, db) {
      soloProfe(u);
      return { estudiantes: db.usuarios.filter(function (x) { return x.rol === 'estudiante'; }).map(function (x) {
        return { id: x.id, nombre: x.nombre, cedula: x.cedula, correo: x.correo,
          cursos: db.matriculas.filter(function (m) { return m.u === x.id; }).map(function (m) { return m.c; }) };
      }) };
    },
    crear_estudiantes: function (a, u, db) {
      soloProfe(u);
      var creados = 0, omitidos = [];
      return Promise.all((a.lista || []).map(function (e) {
        var ced = String(e.cedula || '').trim(), nom = String(e.nombre || '').trim();
        if (!ced || !nom || db.usuarios.some(function (x) { return x.cedula === ced; })) { omitidos.push(ced || nom || '(vacío)'); return null; }
        var id = nuevoId();
        return sha(id + ':' + (String(e.clave || '').trim() || ced)).then(function (h) {
          db.usuarios.push({ id: id, nombre: nom, cedula: ced, usuario: '', correo: String(e.correo || '').trim().toLowerCase(), rol: 'estudiante', hash: h, activo: true });
          (a.cursos || []).forEach(function (c) { db.matriculas.push({ u: id, c: c }); });
          creados++;
        });
      })).then(function () { guardar(db); return { creados: creados, omitidos: omitidos }; });
    },
    eliminar_estudiante: function (a, u, db) {
      soloProfe(u);
      db.usuarios = db.usuarios.filter(function (x) { return !(x.id === a.id && x.rol === 'estudiante'); });
      db.matriculas = db.matriculas.filter(function (m) { return m.u !== a.id; });
      db.intentos = db.intentos.filter(function (i) { return i.u !== a.id; });
      db.descargas = db.descargas.filter(function (d) { return d.u !== a.id; });
      guardar(db); return { ok: true };
    },
    restablecer_clave: function (a, u, db) {
      soloProfe(u);
      return sha(a.id + ':' + a.clave).then(function (h) {
        db.usuarios.forEach(function (x) { if (x.id === a.id) x.hash = h; }); guardar(db); return { ok: true };
      });
    },
    matricular: function (a, u, db) {
      soloProfe(u);
      a.ids.forEach(function (id) { a.cursos.forEach(function (c) {
        db.matriculas = db.matriculas.filter(function (m) { return !(m.u === id && m.c === c); });
        if (a.accion === 'agregar') db.matriculas.push({ u: id, c: c });
      }); });
      guardar(db); return { ok: true };
    },
    examenes: function (a, u, db) {
      soloProfe(u);
      return { examenes: HB.cursos.map(function (c) {
        var e = db.examenes[c.slug] || {}, its = db.intentos.filter(function (i) { return i.curso === c.slug; });
        var quienes = {}; its.forEach(function (i) { quienes[i.u] = 1; });
        return { curso: c.slug, visible: !!e.visible, apertura: e.apertura, cierre: e.cierre, intentos: e.intentos || 1, estado: estadoDe(e),
          preguntas: (SEED.preguntas[c.slug] || []).length, presentaron: Object.keys(quienes).length,
          matriculados: db.matriculas.filter(function (m) { return m.c === c.slug; }).length };
      }) };
    },
    guardar_examen: function (a, u, db) {
      soloProfe(u);
      db.examenes[a.curso] = { visible: !!a.visible, apertura: a.apertura || null, cierre: a.cierre || null, intentos: Math.max(1, Number(a.intentos) || 1) };
      guardar(db); return { ok: true };
    },
    notas: function (a, u, db) { soloProfe(u); return { intentos: db.intentos }; },
    descargas_resumen: function (a, u, db) {
      soloProfe(u);
      return { descargas: db.descargas.map(function (d) {
        var x = db.usuarios.filter(function (y) { return y.id === d.u; })[0] || {};
        return { u: d.u, nombre: x.nombre || '(eliminado)', archivo: d.archivo, curso: d.curso, fecha: d.fecha };
      }) };
    }
  };

  function local(op, args) {
    var db = leer();
    var p = db ? Promise.resolve(db) : sembrar();
    return p.then(function (db) {
      if (op === 'login') {
        var id = String(args.usuario || '').trim().toLowerCase();
        var cand = db.usuarios.filter(function (x) { return x.activo && (x.cedula === id || x.usuario === id || (x.correo && x.correo === id)); })[0];
        if (!cand) throw new Error('credenciales');
        return sha(cand.id + ':' + args.clave).then(function (h) {
          if (h !== cand.hash) throw new Error('credenciales');
          return { token: cand.id, usuario: pub(cand) };
        });
      }
      var u = db.usuarios.filter(function (x) { return x.id === sessionStorage.getItem(TK) && x.activo; })[0];
      if (!u) throw new Error('sesion');
      return ops[op](args || {}, u, db);
    });
  }

  // ---------------------------------------------------------------- API común
  HB.llamar = function (op, args) {
    return CFG.modo === 'supabase' ? remoto(op, args) : local(op, args);
  };
  HB.entrar = function (usuario, clave) {
    return HB.llamar('login', { usuario: usuario, clave: clave }).then(function (r) {
      sessionStorage.setItem(TK, r.token); HB.yo = r.usuario; return r.usuario;
    });
  };
  HB.salir = function () { sessionStorage.removeItem(TK); HB.yo = null; };

  function cargarSemilla() {
    if (CFG.modo === 'supabase') return Promise.resolve();
    return new Promise(function (ok) {
      var s = document.createElement('script');
      s.src = '../../shared/js/local-seed.js';
      s.onload = function () { SEED = window.HB_SEED; ok(); };
      s.onerror = function () { ok(); };
      document.head.appendChild(s);
    });
  }
  HB.listo = cargarSemilla().then(function () {
    if (!sessionStorage.getItem(TK)) return null;
    return HB.llamar('yo').then(function (r) { HB.yo = r.usuario; }).catch(function () { HB.salir(); });
  });
})();
