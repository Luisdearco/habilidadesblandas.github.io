// Imágenes opcionales (logo, fondos): prueba varias extensiones
document.querySelectorAll('img[data-img]').forEach(function (img) {
  var exts = ['png', 'jpg', 'jpeg', 'webp', 'svg'], i = 0, base = img.dataset.img;
  function siguiente() { if (i >= exts.length) { img.remove(); return; } img.src = base + '.' + exts[i++]; }
  img.addEventListener('error', siguiente);
  img.addEventListener('load', function () { img.classList.add('ok'); if (img.parentElement) img.parentElement.classList.add('con-imagen'); });
  siguiente();
});

// Menú móvil
document.querySelectorAll('.menu-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    var nav = document.querySelector('.top nav'); var abierto = nav.classList.toggle('open');
    b.setAttribute('aria-expanded', abierto);
  });
});

function mensajeError(e) {
  var m = e && e.message;
  if (m === 'credenciales') return 'Usuario o contraseña incorrectos.';
  if (m === 'inseguro') return 'Abre el sitio con Live Server o desde GitHub Pages (conexión segura).';
  if (m === 'permiso') return 'No tienes permiso para esta acción.';
  return 'No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.';
}
window.mensajeError = mensajeError;

// Tarjetas de repaso (voltear al hacer clic)
document.querySelectorAll('.repaso').forEach(function (sec) {
  var panel = sec.querySelector('.sabias p'), inicial = panel.textContent;
  sec.querySelectorAll('.flip').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.classList.toggle('volteada');
      b.setAttribute('aria-pressed', v);
      b.setAttribute('aria-label', v ? b.dataset.q + ' Respuesta: ' + b.dataset.a : b.dataset.q + ' Pulsa para ver la respuesta.');
      panel.textContent = '';
      if (v) { var st = document.createElement('strong'); st.textContent = b.dataset.titulo + '. '; panel.appendChild(st); panel.appendChild(document.createTextNode(b.dataset.texto)); }
      else panel.textContent = inicial;
    });
  });
});

HB.listo.then(function () {
  var u = HB.yo, ruta = location.pathname;
  var zona = ruta.indexOf('/profesor/') > -1 ? 'profesor' : ruta.indexOf('/estudiante/') > -1 ? 'estudiante' : null;
  // El logo siempre lleva al inicio de quien tiene la sesión abierta
  var casa = u ? (u.rol === 'profesor' ? '../../profesor/html/principal.html' : '../../estudiante/html/principal.html') : '../../auth/html/login.html';
  document.querySelectorAll('a.logo').forEach(function (a) { a.setAttribute('href', casa); });
  // El profesor puede abrir los cursos y la evaluación como vista previa
  var previa = !!(u && u.rol === 'profesor' && zona === 'estudiante' && (document.body.dataset.curso || document.body.hasAttribute('data-preview')));
  if (zona && !(u && (u.rol === zona || previa))) { location.replace(casa); return; }
  document.body.classList.remove('guarda');
  if (previa) {
    var nav = document.querySelector('.top nav');
    var items = [['Panel', 'principal.html'], ['Estudiantes', 'estudiantes.html'], ['Matrículas', 'matriculas.html'], ['Evaluaciones', 'evaluaciones.html'], ['Calificaciones', 'calificaciones.html'], ['Descargas', 'descargas.html']];
    nav.querySelectorAll('a:not(.btn-sm)').forEach(function (a) { a.remove(); });
    items.slice().reverse().forEach(function (it) { var a = document.createElement('a'); a.href = '../../profesor/html/' + it[1]; a.textContent = it[0]; nav.insertBefore(a, nav.firstChild); });
    document.querySelectorAll('.side a').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      if (h.indexOf('calificaciones.html') === 0) a.setAttribute('href', '../../profesor/html/calificaciones.html');
      if (h === 'principal.html') a.setAttribute('href', '../../profesor/html/principal.html');
    });
    var main = document.querySelector('.main');
    if (main) { var av = document.createElement('p'); av.className = 'aviso-info'; av.innerHTML = '<b>Vista del profesor.</b> Así ve este contenido un estudiante matriculado.'; main.insertBefore(av, main.firstChild); }
    document.querySelectorAll('[data-estado]').forEach(function (s) { s.textContent = 'Vista del profesor'; });
  }

  document.querySelectorAll('[data-usuario]').forEach(function (s) { if (u) s.textContent = u.nombre; });
  document.querySelectorAll('[data-logout]').forEach(function (a) { a.addEventListener('click', function () { HB.salir(); }); });

  // ---- Inicio de sesión
  var login = document.querySelector('form[data-login]');
  if (login) {
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var aviso = login.querySelector('.aviso'), btn = login.querySelector('button');
      var us = login.querySelector('[name=usuario]').value, cl = login.querySelector('[name=clave]').value;
      if (!us.trim() || !cl) { aviso.textContent = 'Escribe tu usuario y tu contraseña.'; return; }
      btn.disabled = true; aviso.textContent = '';
      HB.entrar(us, cl).then(function (usr) {
        var req = login.dataset.rol;
        if (req && usr.rol !== req) {
          HB.salir(); btn.disabled = false;
          aviso.textContent = 'Esta cuenta es de ' + (usr.rol === 'profesor' ? 'profesor' : 'estudiante') + '. Usa el acceso correcto.'; return;
        }
        location.href = usr.rol === 'profesor' ? '../../profesor/html/principal.html' : '../../estudiante/html/principal.html';
      }).catch(function (err) { btn.disabled = false; aviso.textContent = mensajeError(err); });
    });
  }

  // ---- Solicitud de cuenta (por correo al profesor)
  var reg = document.querySelector('form[data-registro]');
  if (reg) {
    reg.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = function (n) { return reg.querySelector('[name=' + n + ']').value.trim(); };
      var para = HB.cfg.contacto || '';
      var cuerpo = 'Nombre: ' + f('nombre') + '\nCédula: ' + f('cedula') + '\nCorreo: ' + f('correo') +
        '\nCurso de interés: ' + f('curso') + '\n\nSolicito que me creen una cuenta en la plataforma.';
      reg.querySelector('.aviso').textContent = para ? '' : 'Tu profesor te creará la cuenta: entrégale estos datos.';
      if (para) location.href = 'mailto:' + para + '?subject=' + encodeURIComponent('Solicitud de cuenta - Habilidades Blandas') + '&body=' + encodeURIComponent(cuerpo);
    });
  }

  if (!u || u.rol !== 'estudiante') return;

  // ---- Estudiante: solo ve los cursos en los que está matriculado
  var cur = document.body.dataset.curso;
  var cards = document.querySelectorAll('.curso-card[data-slug]');
  if (cur || cards.length) {
    HB.llamar('mis_cursos').then(function (r) {
      var mios = r.cursos;
      if (cur && mios.indexOf(cur) < 0) {
        var main = document.querySelector('.main');
        if (main) main.innerHTML = '<h1>Sin acceso</h1><p class="aviso-info">No estás matriculado en este curso. Tu profesor es quien te matricula.</p><div class="acciones"><a class="btn" href="principal.html">Volver a mis cursos</a></div>';
      }
      if (cards.length) {
        var n = 0;
        cards.forEach(function (c) { if (mios.indexOf(c.dataset.slug) < 0) c.hidden = true; else n++; });
        var tit = document.getElementById('titulo-cursos');
        if (tit) tit.textContent = 'Tus cursos (' + n + ')';
        if (!n) document.getElementById('sin-cursos').hidden = false;
      }
    }).catch(function (e) { var s = document.getElementById('sin-cursos'); if (s) { s.hidden = false; s.textContent = mensajeError(e); } });
  }

  // ---- Descargas reales
  var estados = document.querySelectorAll('[data-estado]');
  if (estados.length) {
    HB.llamar('mis_descargas').then(function (r) {
      var m = {}; r.descargas.forEach(function (d) { m[d.archivo] = d.fecha; });
      estados.forEach(function (s) {
        var f = m[s.dataset.estado];
        s.textContent = f ? 'Descargado el ' + HB.fecha(f) : 'Aún no descargado';
        s.className = 'estado ' + (f ? 'si' : 'no');
      });
    });
  }
  document.querySelectorAll('[data-doc]').forEach(function (a) {
    a.addEventListener('click', function () {
      HB.llamar('registrar_descarga', { archivo: a.dataset.doc, curso: a.dataset.curso }).then(function () {
        document.querySelectorAll('[data-estado="' + a.dataset.doc + '"]').forEach(function (s) {
          s.textContent = 'Descargado el ' + HB.fecha(new Date().toISOString()); s.className = 'estado si';
        });
      });
    });
  });
});
