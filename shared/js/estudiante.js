// Evaluación y calificaciones del estudiante (datos reales desde la base de datos)
HB.listo.then(function () {
  if (!HB.yo) return;
  var esc = HB.esc, qs = new URLSearchParams(location.search), slug = qs.get('curso');
  if (HB.yo.rol === 'profesor') {
    var ce = document.getElementById('evaluacion');
    if (ce) {
      document.getElementById('curso-nombre').textContent = slug ? HB.nombreCurso(slug) : 'vista del profesor';
      ce.innerHTML = '<p class="aviso-info"><b>Vista del profesor.</b> Aquí el estudiante presenta la evaluación. Para programarla usa <a href="../../profesor/html/evaluaciones.html">Evaluaciones</a> y para ver las notas, <a href="../../profesor/html/calificaciones.html">Calificaciones</a>.</p>';
    }
    return;
  }
  if (HB.yo.rol !== 'estudiante') return;

  // ------------------------------------------------------------ EVALUACIÓN
  var cont = document.getElementById('evaluacion');
  if (cont) {
    var nombre = document.getElementById('curso-nombre');
    if (!slug) {
      nombre.textContent = 'elige un curso';
      HB.llamar('mis_cursos').then(function (r) {
        cont.innerHTML = r.cursos.length
          ? '<div class="acciones">' + r.cursos.map(function (s) { return '<a class="btn btn-claro" href="evaluacion.html?curso=' + s + '">' + esc(HB.nombreCurso(s)) + '</a>'; }).join('') + '</div>'
          : '<p class="aviso-info">Aún no estás matriculado en ningún curso.</p>';
      });
    } else {
      nombre.textContent = HB.nombreCurso(slug);
      HB.llamar('examen', { curso: slug }).then(pintarExamen).catch(function (e) {
        cont.innerHTML = '<p class="aviso-info">' + (e.message === 'sin_matricula' ? 'No estás matriculado en este curso.' : mensajeError(e)) + '</p>';
      });
    }
  }
  function resumen(ex) {
    return '<p class="meta">Intentos usados: <b>' + ex.usados + ' de ' + ex.intentosMax + '</b> · Mejor nota: <b>' + HB.nota(ex.mejor) + '</b> (escala 0,0 a 5,0)' +
      (ex.cierre ? ' · Cierra: <b>' + HB.fecha(ex.cierre) + '</b>' : '') + '</p>';
  }
  var pie = function () {
    return '<div class="acciones"><a class="btn btn-claro" href="calificaciones.html?curso=' + slug + '">Ver mis calificaciones</a>' +
      '<a class="btn btn-claro" href="' + slug + '.html">Volver al curso</a></div>';
  };
  function pintarExamen(ex) {
    var msg = { oculto: 'Esta evaluación aún no está disponible. Tu profesor la habilitará.',
      programado: 'Esta evaluación se abrirá el <b>' + HB.fecha(ex.apertura) + '</b>.',
      cerrado: 'Esta evaluación cerró el <b>' + HB.fecha(ex.cierre) + '</b>.' }[ex.estado];
    if (msg) { cont.innerHTML = '<p class="aviso-info">' + msg + '</p>' + (ex.usados ? resumen(ex) : '') + pie(); return; }
    if (!ex.preguntas) { cont.innerHTML = '<p class="aviso-info">Ya usaste todos tus intentos.</p>' + resumen(ex) + pie(); return; }
    var h = resumen(ex) + '<form id="form-ev">';
    ex.preguntas.forEach(function (p, i) {
      h += '<fieldset class="pregunta"><legend>Pregunta ' + (i + 1) + '</legend><p>' + esc(p.q) + '</p>';
      p.o.forEach(function (o, j) { h += '<label><input type="radio" name="p' + i + '" value="' + j + '" required> ' + esc(o) + '</label>'; });
      h += '<p class="retro"></p></fieldset>';
    });
    cont.innerHTML = h + '<button class="btn" type="submit">Enviar evaluación</button><p id="resultado" class="resultado" role="status"></p></form>' + pie();
    var form = document.getElementById('form-ev');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!confirm('¿Enviar la evaluación? Se registrará tu calificación.')) return;
      var resp = ex.preguntas.map(function (p, i) { var m = form.querySelector('input[name=p' + i + ']:checked'); return m ? Number(m.value) : -1; });
      var btn = form.querySelector('button'); btn.disabled = true;
      HB.llamar('enviar_examen', { curso: slug, respuestas: resp }).then(function (r) {
        form.querySelectorAll('.pregunta').forEach(function (box, i) {
          box.classList.toggle('bien', !!r.detalle[i]); box.classList.toggle('mal', !r.detalle[i]);
          box.querySelector('.retro').textContent = r.detalle[i] ? 'Correcta.' : 'Incorrecta.';
          box.querySelectorAll('input').forEach(function (x) { x.disabled = true; });
        });
        btn.remove();
        document.getElementById('resultado').innerHTML = 'Tu calificación: <b>' + HB.nota(r.nota) + ' / 5,0</b> (' + r.correctas + ' de ' + r.total + ' correctas). Quedó registrada y tu profesor ya la puede ver.';
      }).catch(function (err) { btn.disabled = false; document.getElementById('resultado').textContent = err.message === 'no_disponible' ? 'La evaluación ya no está disponible.' : mensajeError(err); });
    });
  }

  // ------------------------------------------------------------ CALIFICACIONES
  var cal = document.getElementById('calificaciones');
  if (cal) {
    Promise.all([HB.llamar('mis_cursos'), HB.llamar('mis_notas')]).then(function (r) {
      var cursos = HB.cursos.filter(function (c) { return r[0].cursos.indexOf(c.slug) > -1; }), its = r[1].intentos;
      if (!cursos.length) { cal.innerHTML = '<p class="aviso-info">Aún no estás matriculado en ningún curso.</p>'; return; }
      var mejores = [], filas = '';
      cursos.forEach(function (c) {
        var mios = its.filter(function (i) { return i.curso === c.slug; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
        var mejor = mios.reduce(function (m, i) { return i.nota > m ? i.nota : m; }, -1);
        if (mios.length) mejores.push(mejor);
        var est = !mios.length ? '<span class="estado no">Sin presentar</span>' : mejor >= 3 ? '<span class="estado si">Aprobado</span>' : '<span class="estado mal">No aprobado</span>';
        filas += '<tr><td><b>' + esc(c.nombre) + '</b></td><td>' + mios.length + '</td><td class="nota">' + (mios.length ? HB.nota(mejor) : '—') + '</td><td>' +
          (mios.length ? mios[0].correctas + ' de ' + mios[0].total : '—') + '</td><td>' + (mios.length ? HB.fecha(mios[0].fecha) : '—') + '</td><td>' + est +
          '</td><td><a href="calificaciones.html?curso=' + c.slug + '">Detalle</a></td></tr>';
      });
      var prom = mejores.length ? (mejores.reduce(function (a, b) { return a + b; }, 0) / mejores.length) : null;
      var h = '<p class="meta">Promedio de los cursos presentados: <b>' + HB.nota(prom) + '</b> (' + mejores.length + ' de ' + cursos.length + ' cursos). Escala 0,0 a 5,0; se aprueba con 3,0 o más. Cuenta tu mejor intento.</p>' +
        '<div class="scroll-x"><table class="tabla"><tr><th>Curso</th><th>Intentos</th><th>Mejor nota</th><th>Último intento</th><th>Fecha</th><th>Estado</th><th></th></tr>' + filas + '</table></div>';
      if (slug && cursos.some(function (c) { return c.slug === slug; })) {
        var d = its.filter(function (i) { return i.curso === slug; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
        h += '<h2>Detalle: ' + esc(HB.nombreCurso(slug)) + '</h2>' + (d.length
          ? '<div class="scroll-x"><table class="tabla"><tr><th>Intento</th><th>Fecha</th><th>Aciertos</th><th>Nota</th></tr>' +
            d.map(function (i, k) { return '<tr><td>' + (d.length - k) + '</td><td>' + HB.fecha(i.fecha) + '</td><td>' + i.correctas + ' de ' + i.total + '</td><td class="nota">' + HB.nota(i.nota) + '</td></tr>'; }).join('') + '</table></div>'
          : '<p class="aviso-info">Todavía no has presentado la evaluación de este curso.</p>') +
          '<div class="acciones"><a class="btn" href="evaluacion.html?curso=' + slug + '">Ir a la evaluación</a></div>';
      }
      cal.innerHTML = h;
    }).catch(function (e) { cal.innerHTML = '<p class="aviso-info">' + mensajeError(e) + '</p>'; });
  }
});
