// Módulo del profesor (datos reales desde la base de datos)
HB.listo.then(function () {
  if (!HB.yo || HB.yo.rol !== 'profesor') return;
  var esc = HB.esc, vista = document.body.dataset.vista, cont = document.getElementById('vista');
  if (!cont) return;
  var $ = function (id) { return document.getElementById(id); };
  var err = function (e) { cont.innerHTML = '<p class="aviso-info">' + mensajeError(e) + '</p>'; };
  function descargarCSV(nombre, filas) {
    var txt = '\ufeff' + filas.map(function (f) { return f.map(function (c) { return '"' + String(c === null || c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function checks(idContenedor) {
    $(idContenedor).innerHTML = HB.cursos.map(function (c) { return '<label class="chk"><input type="checkbox" value="' + c.slug + '"> ' + esc(c.nombre) + '</label>'; }).join('');
  }
  function marcados(idContenedor) { return Array.prototype.map.call($(idContenedor).querySelectorAll('input:checked'), function (i) { return i.value; }); }
  function mejores(its) {
    var m = {}; its.forEach(function (i) { var k = i.u + '|' + i.curso; if (m[k] === undefined || i.nota > m[k]) m[k] = i.nota; }); return m;
  }

  // ============================================================ PANEL
  if (vista === 'panel') {
    Promise.all([HB.llamar('estudiantes'), HB.llamar('examenes'), HB.llamar('notas'), HB.llamar('descargas_resumen')]).then(function (r) {
      var es = r[0].estudiantes, ex = r[1].examenes, its = r[2].intentos, ds = r[3].descargas;
      var mat = es.reduce(function (a, e) { return a + e.cursos.length; }, 0);
      document.querySelectorAll('[data-matriculados]').forEach(function (s) { s.textContent = es.filter(function (x) { return x.cursos.indexOf(s.dataset.matriculados) > -1; }).length; });
      var abiertos = ex.filter(function (x) { return x.estado === 'abierto'; }).length;
      var nombres = {}; es.forEach(function (e) { nombres[e.id] = e.nombre; });
      var h = '<div class="panel">' + [['Estudiantes', es.length], ['Matrículas', mat], ['Evaluaciones abiertas', abiertos], ['Evaluaciones presentadas', its.length], ['Descargas', ds.length]]
        .map(function (x) { return '<div class="dato"><b>' + x[1] + '</b>' + x[0] + '</div>'; }).join('') + '</div>';
      var rec = its.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 8);
      h += '<h2>Actividad reciente</h2>' + (rec.length
        ? '<div class="scroll-x"><table class="tabla"><tr><th>Estudiante</th><th>Curso</th><th>Nota</th><th>Fecha</th></tr>' + rec.map(function (i) {
            return '<tr><td>' + esc(nombres[i.u] || '(eliminado)') + '</td><td>' + esc(HB.nombreCurso(i.curso)) + '</td><td class="nota">' + HB.nota(i.nota) + '</td><td>' + HB.fecha(i.fecha) + '</td></tr>'; }).join('') + '</table></div>'
        : '<p class="aviso-info">Todavía no hay evaluaciones presentadas.</p>');
      cont.innerHTML = h;
    }).catch(err);
  }

  // ============================================================ ESTUDIANTES
  if (vista === 'estudiantes') {
    checks('cursos-nuevos');
    var lista = [], filtroTxt = '';
    function pintar() {
      var f = lista.filter(function (e) { return (e.nombre + ' ' + e.cedula).toLowerCase().indexOf(filtroTxt) > -1; });
      $('tabla-est').innerHTML = f.length ? '<table class="tabla"><tr><th>Nombre</th><th>Cédula</th><th>Correo</th><th>Cursos</th><th>Acciones</th></tr>' + f.map(function (e) {
        return '<tr><td><b>' + esc(e.nombre) + '</b></td><td>' + esc(e.cedula) + '</td><td>' + esc(e.correo || '—') + '</td><td>' + e.cursos.length + '</td><td class="acc">' +
          '<button class="btn btn-sm2" data-act="clave" data-id="' + e.id + '">Contraseña</button> <button class="btn btn-sm2 btn-peligro" data-act="del" data-id="' + e.id + '">Eliminar</button></td></tr>'; }).join('') + '</table>'
        : '<p class="aviso-info">No hay estudiantes registrados todavía.</p>';
      $('total-est').textContent = lista.length;
    }
    function cargar() { HB.llamar('estudiantes').then(function (r) { lista = r.estudiantes; pintar(); }).catch(err); }
    cargar();
    $('buscar').addEventListener('input', function (e) { filtroTxt = e.target.value.toLowerCase(); pintar(); });
    $('tabla-est').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var est = lista.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (b.dataset.act === 'del' && confirm('¿Eliminar a ' + est.nombre + '? También se borrarán sus notas y matrículas.'))
        HB.llamar('eliminar_estudiante', { id: est.id }).then(cargar).catch(function (x) { alert(mensajeError(x)); });
      if (b.dataset.act === 'clave') {
        var n = prompt('Nueva contraseña para ' + est.nombre + ' (mínimo 4 caracteres):');
        if (n && n.length >= 4) HB.llamar('restablecer_clave', { id: est.id, clave: n }).then(function () { alert('Contraseña actualizada.'); }).catch(function (x) { alert(mensajeError(x)); });
      }
    });
    function resultado(r) {
      $('resultado').innerHTML = 'Estudiantes creados: <b>' + r.creados + '</b>.' + (r.omitidos.length ? ' Omitidos (cédula repetida o datos incompletos): ' + esc(r.omitidos.join(', ')) + '.' : '');
      cargar();
    }
    $('form-nuevo').addEventListener('submit', function (e) {
      e.preventDefault();
      var g = function (n) { return e.target.querySelector('[name=' + n + ']').value; };
      HB.llamar('crear_estudiantes', { lista: [{ nombre: g('nombre'), cedula: g('cedula'), correo: g('correo'), clave: g('clave') }], cursos: marcados('cursos-nuevos') })
        .then(function (r) { resultado(r); if (r.creados) e.target.reset(); }).catch(function (x) { $('resultado').textContent = mensajeError(x); });
    });
    // Importación desde Excel/CSV
    var filas = [];
    function norm(k) { return String(k).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, ''); }
    var sin = { nombre: ['nombre', 'nombres', 'nombrecompleto', 'estudiante'], cedula: ['cedula', 'documento', 'identificacion', 'id', 'cc'], correo: ['correo', 'email', 'correoelectronico'], clave: ['clave', 'contrasena', 'password'] };
    $('archivo').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      if (!window.XLSX) { $('prev').textContent = 'No se pudo cargar el lector de Excel (revisa tu conexión a internet).'; return; }
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
          var data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          filas = data.map(function (o) {
            var r = {}; Object.keys(o).forEach(function (k) { var n = norm(k); Object.keys(sin).forEach(function (c) { if (sin[c].indexOf(n) > -1) r[c] = String(o[k]).trim(); }); });
            return r;
          }).filter(function (r) { return r.nombre || r.cedula; });
          $('prev').innerHTML = filas.length ? 'Se leyeron <b>' + filas.length + '</b> estudiantes. Primeros: ' + esc(filas.slice(0, 3).map(function (r) { return r.nombre; }).join(', ')) + '…' : 'No se encontraron filas. Usa la plantilla: columnas nombre, cedula, correo, clave.';
          $('importar').disabled = !filas.length;
        } catch (x) { $('prev').textContent = 'No se pudo leer el archivo. Usa .xlsx o .csv.'; }
      };
      rd.readAsArrayBuffer(f);
    });
    $('importar').addEventListener('click', function () {
      $('importar').disabled = true;
      HB.llamar('crear_estudiantes', { lista: filas, cursos: marcados('cursos-nuevos') }).then(function (r) { resultado(r); filas = []; $('prev').textContent = ''; $('archivo').value = ''; })
        .catch(function (x) { $('resultado').textContent = mensajeError(x); });
    });
    $('plantilla').addEventListener('click', function () {
      descargarCSV('plantilla-estudiantes.csv', [['nombre', 'cedula', 'correo', 'clave'], ['Ana Pérez', '1001234567', 'ana@correo.com', ''], ['Carlos Gómez', '1007654321', '', '']]);
    });
  }

  // ============================================================ MATRÍCULAS
  if (vista === 'matriculas') {
    var est = [], q = '';
    function tabla() {
      var f = est.filter(function (e) { return (e.nombre + ' ' + e.cedula).toLowerCase().indexOf(q) > -1; });
      var h = '<table class="tabla"><tr><th>Estudiante</th>' + HB.cursos.map(function (c) {
        return '<th class="cen">' + esc(c.nombre) + '<br><button class="btn btn-sm2" data-col="' + c.slug + '" data-a="agregar">Todos</button> <button class="btn btn-sm2 btn-claro" data-col="' + c.slug + '" data-a="quitar">Ninguno</button></th>'; }).join('') + '</tr>';
      f.forEach(function (e) {
        h += '<tr><td><b>' + esc(e.nombre) + '</b><br><small>' + esc(e.cedula) + '</small></td>' + HB.cursos.map(function (c) {
          return '<td class="cen"><input type="checkbox" aria-label="' + esc(e.nombre + ' en ' + c.nombre) + '" data-id="' + e.id + '" data-c="' + c.slug + '"' + (e.cursos.indexOf(c.slug) > -1 ? ' checked' : '') + '></td>'; }).join('') + '</tr>';
      });
      cont.innerHTML = (f.length ? h + '</table>' : '<p class="aviso-info">No hay estudiantes. Primero créalos en la sección Estudiantes.</p>');
    }
    function cargarM() { HB.llamar('estudiantes').then(function (r) { est = r.estudiantes; tabla(); }).catch(err); }
    cargarM();
    $('buscar').addEventListener('input', function (e) { q = e.target.value.toLowerCase(); tabla(); });
    $('todo').addEventListener('click', function () {
      if (est.length && confirm('¿Matricular a todos los estudiantes en los 6 cursos?'))
        HB.llamar('matricular', { ids: est.map(function (e) { return e.id; }), cursos: HB.cursos.map(function (c) { return c.slug; }), accion: 'agregar' }).then(cargarM);
    });
    cont.addEventListener('change', function (e) {
      var i = e.target; if (!i.dataset.id) return;
      i.disabled = true;
      HB.llamar('matricular', { ids: [i.dataset.id], cursos: [i.dataset.c], accion: i.checked ? 'agregar' : 'quitar' }).then(function () {
        var s = est.filter(function (x) { return x.id === i.dataset.id; })[0];
        s.cursos = s.cursos.filter(function (c) { return c !== i.dataset.c; }); if (i.checked) s.cursos.push(i.dataset.c); i.disabled = false;
      }).catch(function (x) { i.checked = !i.checked; i.disabled = false; alert(mensajeError(x)); });
    });
    cont.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-col]'); if (!b || !est.length) return;
      HB.llamar('matricular', { ids: est.map(function (x) { return x.id; }), cursos: [b.dataset.col], accion: b.dataset.a }).then(cargarM);
    });
  }

  // ============================================================ EVALUACIONES (programar)
  if (vista === 'evaluaciones') {
    var loc = function (iso) { if (!iso) return ''; var d = new Date(iso), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
    var badge = { oculto: ['no', 'Oculta'], programado: ['prog', 'Programada'], abierto: ['si', 'Abierta'], cerrado: ['mal', 'Cerrada'] };
    HB.llamar('examenes').then(function (r) {
      var porCurso = {}; r.examenes.forEach(function (x) { porCurso[x.curso] = x; });
      cont.innerHTML = '<div class="scroll-x"><table class="tabla"><tr><th>Curso</th><th>Estado</th><th>Visible</th><th>Abre</th><th>Cierra</th><th>Intentos</th><th>Presentaron</th><th></th></tr>' +
        HB.cursos.map(function (c) {
          var x = porCurso[c.slug] || { estado: 'oculto', intentos: 1, presentaron: 0, matriculados: 0, preguntas: 0 }, b = badge[x.estado];
          return '<tr data-c="' + c.slug + '"><td><b>' + esc(c.nombre) + '</b><br><small>' + x.preguntas + ' preguntas</small></td><td><span class="estado ' + b[0] + '">' + b[1] + '</span></td>' +
            '<td class="cen"><input type="checkbox" class="v" aria-label="Visible"' + (x.visible ? ' checked' : '') + '></td>' +
            '<td><input type="datetime-local" class="a" value="' + loc(x.apertura) + '"></td><td><input type="datetime-local" class="z" value="' + loc(x.cierre) + '"></td>' +
            '<td><input type="number" class="n" min="1" max="10" value="' + x.intentos + '" style="width:4.5rem"></td><td>' + x.presentaron + ' de ' + x.matriculados + '</td>' +
            '<td><button class="btn btn-sm2" data-g>Guardar</button></td></tr>'; }).join('') + '</table></div>' +
        '<p class="meta">Si dejas vacías las fechas, la evaluación queda abierta mientras esté visible. Los estudiantes solo la ven si están matriculados en el curso.</p>';
    }).catch(err);
    cont.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b) return;
      var tr = b.closest('tr'), val = function (c) { return tr.querySelector(c).value; };
      var a = val('.a'), z = val('.z');
      if (a && z && new Date(z) <= new Date(a)) { alert('La fecha de cierre debe ser posterior a la de apertura.'); return; }
      b.disabled = true;
      HB.llamar('guardar_examen', { curso: tr.dataset.c, visible: tr.querySelector('.v').checked, apertura: a ? new Date(a).toISOString() : null, cierre: z ? new Date(z).toISOString() : null, intentos: Number(val('.n')) })
        .then(function () { location.reload(); }).catch(function (x) { b.disabled = false; alert(mensajeError(x)); });
    });
  }

  // ============================================================ CALIFICACIONES
  if (vista === 'calificaciones') {
    Promise.all([HB.llamar('estudiantes'), HB.llamar('notas')]).then(function (r) {
      var es = r[0].estudiantes, its = r[1].intentos, mej = mejores(its), sel = $('filtro');
      sel.innerHTML = '<option value="">Todos los cursos</option>' + HB.cursos.map(function (c) { return '<option value="' + c.slug + '">' + esc(c.nombre) + '</option>'; }).join('');
      function pintar() {
        var cs = HB.cursos.filter(function (c) { return !sel.value || c.slug === sel.value; });
        var h = '<div class="scroll-x"><table class="tabla"><tr><th>Estudiante</th><th>Cédula</th>' + cs.map(function (c) { return '<th class="cen">' + esc(c.nombre) + '</th>'; }).join('') + '<th class="cen">Promedio</th></tr>';
        es.forEach(function (e) {
          var vals = [];
          h += '<tr><td><b>' + esc(e.nombre) + '</b></td><td>' + esc(e.cedula) + '</td>' + cs.map(function (c) {
            var m = mej[e.id + '|' + c.slug], mat = e.cursos.indexOf(c.slug) > -1;
            if (m !== undefined) vals.push(m);
            return '<td class="cen nota' + (m !== undefined && m < 3 ? ' baja' : '') + '">' + (m !== undefined ? HB.nota(m) : mat ? '<span class="gris">Pendiente</span>' : '<span class="gris">—</span>') + '</td>'; }).join('') +
            '<td class="cen nota">' + (vals.length ? HB.nota(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) : '—') + '</td></tr>';
        });
        var det = its.filter(function (i) { return !sel.value || i.curso === sel.value; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
        var nom = {}; es.forEach(function (e) { nom[e.id] = e; });
        h += '</table></div><h2>Detalle de intentos</h2>' + (det.length ? '<div class="scroll-x"><table class="tabla"><tr><th>Estudiante</th><th>Curso</th><th>Aciertos</th><th>Nota</th><th>Fecha</th></tr>' + det.map(function (i) {
          return '<tr><td>' + esc((nom[i.u] || {}).nombre || '(eliminado)') + '</td><td>' + esc(HB.nombreCurso(i.curso)) + '</td><td>' + i.correctas + ' de ' + i.total + '</td><td class="nota">' + HB.nota(i.nota) + '</td><td>' + HB.fecha(i.fecha) + '</td></tr>'; }).join('') + '</table></div>'
          : '<p class="aviso-info">Todavía no hay evaluaciones presentadas.</p>');
        cont.innerHTML = es.length ? h : '<p class="aviso-info">No hay estudiantes registrados.</p>';
      }
      pintar(); sel.addEventListener('change', pintar);
      $('exportar').addEventListener('click', function () {
        var cs = HB.cursos.filter(function (c) { return !sel.value || c.slug === sel.value; });
        descargarCSV('calificaciones.csv', [['Estudiante', 'Cédula'].concat(cs.map(function (c) { return c.nombre; }))].concat(es.map(function (e) {
          return [e.nombre, e.cedula].concat(cs.map(function (c) { var m = mej[e.id + '|' + c.slug]; return m === undefined ? '' : m; })); })));
      });
    }).catch(err);
  }

  // ============================================================ DESCARGAS
  if (vista === 'descargas') {
    HB.llamar('descargas_resumen').then(function (r) {
      var ds = r.descargas, tipos = [['guia', 'Guía de estudio'], ['cuaderno', 'Cuaderno de práctica']], filas = '';
      HB.cursos.forEach(function (c) { tipos.forEach(function (t) {
        var arch = c.slug + (t[0] === 'guia' ? '-guia-de-estudio.pdf' : '-cuaderno-de-practica.pdf');
        var d = ds.filter(function (x) { return x.archivo === arch; }), quienes = {}; d.forEach(function (x) { quienes[x.u] = 1; });
        filas += '<tr><td>' + t[1] + ': ' + esc(c.nombre) + '</td><td class="cen">' + d.length + '</td><td class="cen">' + Object.keys(quienes).length + '</td><td>' + (d.length ? HB.fecha(d[0].fecha) : '—') + '</td></tr>';
      }); });
      cont.innerHTML = '<div class="scroll-x"><table class="tabla"><tr><th>Archivo</th><th class="cen">Descargas</th><th class="cen">Estudiantes</th><th>Última descarga</th></tr>' + filas + '</table></div>' +
        '<h2>Últimas descargas</h2>' + (ds.length ? '<div class="scroll-x"><table class="tabla"><tr><th>Estudiante</th><th>Archivo</th><th>Fecha</th></tr>' + ds.slice(0, 50).map(function (x) {
          return '<tr><td>' + esc(x.nombre) + '</td><td>' + esc(x.archivo) + '</td><td>' + HB.fecha(x.fecha) + '</td></tr>'; }).join('') + '</table></div>' : '<p class="aviso-info">Todavía no hay descargas registradas.</p>');
    }).catch(err);
  }
});
