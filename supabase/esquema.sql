
-- Plataforma de Habilidades Blandas · esquema para Supabase
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, cedula text unique, usuario text unique, correo text,
  rol text not null check (rol in ('estudiante','profesor')),
  clave_hash text not null, activo boolean not null default true, creado timestamptz default now());
create table if not exists matriculas (
  usuario_id uuid references usuarios on delete cascade, curso text, primary key (usuario_id, curso));
create table if not exists examenes (
  curso text primary key, visible boolean not null default false, apertura timestamptz, cierre timestamptz, intentos int not null default 1);
create table if not exists preguntas (
  id serial primary key, curso text not null, orden int not null, enunciado text not null, opciones jsonb not null, correcta int not null);
create table if not exists intentos (
  id uuid primary key default gen_random_uuid(), usuario_id uuid references usuarios on delete cascade,
  curso text not null, nota numeric(3,1) not null, correctas int not null, total int not null, respuestas jsonb, fecha timestamptz default now());
create table if not exists descargas (
  id bigserial primary key, usuario_id uuid references usuarios on delete cascade, archivo text not null, curso text, fecha timestamptz default now());
create table if not exists sesiones (
  token text primary key, usuario_id uuid references usuarios on delete cascade, creado timestamptz default now());

-- Nadie accede a las tablas directamente: solo a través de la función hb_rpc.
alter table usuarios enable row level security;  alter table matriculas enable row level security;
alter table examenes enable row level security;  alter table preguntas enable row level security;
alter table intentos enable row level security;  alter table descargas enable row level security;
alter table sesiones enable row level security;

create or replace function hb_estado(p_curso text) returns text language sql stable as $$
  select case when e.curso is null or not e.visible then 'oculto'
              when e.apertura is not null and now() < e.apertura then 'programado'
              when e.cierre is not null and now() > e.cierre then 'cerrado'
              else 'abierto' end
  from (select p_curso as c) x left join examenes e on e.curso = x.c;
$$;

create or replace function hb_rpc(p_token text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  u usuarios; ex examenes; est text; usados int; mejor numeric; maxi int; pres jsonb; tot int;
  ok_n int; v_nota numeric; det jsonb; c text; ident text; n int := 0; om jsonb := '[]'::jsonb;
  e jsonb; uid uuid; cur text; tok text;
begin
  if p_op = 'login' then
    select * into u from usuarios where activo and (cedula = btrim(p_args->>'usuario')
      or lower(usuario) = lower(btrim(p_args->>'usuario')) or lower(correo) = lower(btrim(p_args->>'usuario'))) limit 1;
    if not found or u.clave_hash <> crypt(coalesce(p_args->>'clave',''), u.clave_hash) then
      return jsonb_build_object('error','credenciales'); end if;
    delete from sesiones where creado < now() - interval '1 day';
    tok := gen_random_uuid()::text || gen_random_uuid()::text;
    insert into sesiones(token, usuario_id) values (tok, u.id);
    return jsonb_build_object('token', tok, 'usuario',
      jsonb_build_object('id',u.id,'nombre',u.nombre,'rol',u.rol,'cedula',u.cedula));
  end if;

  select us.* into u from sesiones s join usuarios us on us.id = s.usuario_id
   where s.token = p_token and s.creado > now() - interval '12 hours' and us.activo;
  if not found then return jsonb_build_object('error','sesion'); end if;

  if p_op = 'yo' then
    return jsonb_build_object('usuario', jsonb_build_object('id',u.id,'nombre',u.nombre,'rol',u.rol,'cedula',u.cedula));
  elsif p_op = 'mis_cursos' then
    return jsonb_build_object('cursos', coalesce((select jsonb_agg(curso) from matriculas where usuario_id = u.id),'[]'));
  elsif p_op in ('examen','enviar_examen') then
    cur := p_args->>'curso';
    if not exists (select 1 from matriculas where usuario_id = u.id and curso = cur) then
      return jsonb_build_object('error','sin_matricula'); end if;
    est := hb_estado(cur);
    select * into ex from examenes where curso = cur;
    select count(*), max(nota) into usados, mejor from intentos where usuario_id = u.id and curso = cur;
    maxi := coalesce(ex.intentos,1);
    select count(*) into tot from preguntas where curso = cur;
    if p_op = 'examen' then
      pres := null;
      if est = 'abierto' and usados < maxi then
        select jsonb_agg(jsonb_build_object('q',enunciado,'o',opciones) order by orden) into pres from preguntas where curso = cur;
      end if;
      return jsonb_build_object('estado',est,'apertura',ex.apertura,'cierre',ex.cierre,'intentosMax',maxi,
        'usados',usados,'mejor',mejor,'total',tot)
        || case when pres is null then '{}'::jsonb else jsonb_build_object('preguntas',pres) end;
    end if;
    if est <> 'abierto' or usados >= maxi or tot = 0 then return jsonb_build_object('error','no_disponible'); end if;
    select count(*) filter (where q.acierto), jsonb_agg(q.acierto order by q.idx) into ok_n, det
      from (select t.idx, coalesce(((p_args->'respuestas')->>(t.idx - 1))::int = t.correcta, false) as acierto
            from (select row_number() over (order by orden)::int as idx, correcta from preguntas where curso = cur) t) q;
    v_nota := round(ok_n::numeric / tot * 5, 1);
    insert into intentos(usuario_id,curso,nota,correctas,total,respuestas) values (u.id,cur,v_nota,ok_n,tot,p_args->'respuestas');
    return jsonb_build_object('nota',v_nota,'correctas',ok_n,'total',tot,'detalle',det);
  elsif p_op = 'mis_notas' then
    return jsonb_build_object('intentos', coalesce((select jsonb_agg(jsonb_build_object('curso',curso,'nota',nota,
      'correctas',correctas,'total',total,'fecha',fecha) order by fecha) from intentos where usuario_id = u.id),'[]'));
  elsif p_op = 'registrar_descarga' then
    insert into descargas(usuario_id,archivo,curso) values (u.id, p_args->>'archivo', p_args->>'curso');
    return jsonb_build_object('ok',true);
  elsif p_op = 'mis_descargas' then
    return jsonb_build_object('descargas', coalesce((select jsonb_agg(jsonb_build_object('archivo',archivo,'fecha',f))
      from (select archivo, max(fecha) f from descargas where usuario_id = u.id group by archivo) t),'[]'));
  end if;

  -- Operaciones exclusivas del profesor
  if u.rol <> 'profesor' then return jsonb_build_object('error','permiso'); end if;

  if p_op = 'estudiantes' then
    return jsonb_build_object('estudiantes', coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'nombre',x.nombre,
      'cedula',x.cedula,'correo',x.correo,'cursos',coalesce((select jsonb_agg(m.curso) from matriculas m where m.usuario_id = x.id),'[]'))
      order by x.nombre) from usuarios x where x.rol = 'estudiante'),'[]'));
  elsif p_op = 'crear_estudiantes' then
    for e in select value from jsonb_array_elements(coalesce(p_args->'lista','[]'::jsonb)) loop
      ident := btrim(coalesce(e->>'cedula','')); c := btrim(coalesce(e->>'nombre',''));
      if ident = '' or c = '' or exists (select 1 from usuarios where cedula = ident) then
        om := om || to_jsonb(coalesce(nullif(ident,''), nullif(c,''), '(vacío)')); continue; end if;
      insert into usuarios(nombre,cedula,correo,rol,clave_hash)
        values (c, ident, lower(nullif(btrim(coalesce(e->>'correo','')),'')), 'estudiante',
                crypt(coalesce(nullif(btrim(coalesce(e->>'clave','')),''), ident), gen_salt('bf'))) returning id into uid;
      for cur in select jsonb_array_elements_text(coalesce(p_args->'cursos','[]'::jsonb)) loop
        insert into matriculas values (uid, cur) on conflict do nothing; end loop;
      n := n + 1;
    end loop;
    return jsonb_build_object('creados', n, 'omitidos', om);
  elsif p_op = 'eliminar_estudiante' then
    delete from usuarios where id = (p_args->>'id')::uuid and rol = 'estudiante';
    return jsonb_build_object('ok',true);
  elsif p_op = 'restablecer_clave' then
    if length(coalesce(p_args->>'clave','')) < 4 then return jsonb_build_object('error','clave_corta'); end if;
    update usuarios set clave_hash = crypt(p_args->>'clave', gen_salt('bf')) where id = (p_args->>'id')::uuid and rol = 'estudiante';
    return jsonb_build_object('ok',true);
  elsif p_op = 'matricular' then
    for uid in select (jsonb_array_elements_text(coalesce(p_args->'ids','[]'::jsonb)))::uuid loop
      for cur in select jsonb_array_elements_text(coalesce(p_args->'cursos','[]'::jsonb)) loop
        if p_args->>'accion' = 'agregar' then insert into matriculas values (uid, cur) on conflict do nothing;
        else delete from matriculas where usuario_id = uid and curso = cur; end if;
      end loop;
    end loop;
    return jsonb_build_object('ok',true);
  elsif p_op = 'examenes' then
    return jsonb_build_object('examenes', coalesce((select jsonb_agg(jsonb_build_object('curso',x.curso,'visible',x.visible,
      'apertura',x.apertura,'cierre',x.cierre,'intentos',x.intentos,'estado',hb_estado(x.curso),
      'preguntas',(select count(*) from preguntas p where p.curso = x.curso),
      'presentaron',(select count(distinct i.usuario_id) from intentos i where i.curso = x.curso),
      'matriculados',(select count(*) from matriculas m where m.curso = x.curso)) order by x.curso) from examenes x),'[]'));
  elsif p_op = 'guardar_examen' then
    insert into examenes(curso,visible,apertura,cierre,intentos) values (p_args->>'curso',
      coalesce((p_args->>'visible')::boolean,false), nullif(p_args->>'apertura','')::timestamptz,
      nullif(p_args->>'cierre','')::timestamptz, greatest(1, coalesce((p_args->>'intentos')::int,1)))
    on conflict (curso) do update set visible = excluded.visible, apertura = excluded.apertura,
      cierre = excluded.cierre, intentos = excluded.intentos;
    return jsonb_build_object('ok',true);
  elsif p_op = 'notas' then
    return jsonb_build_object('intentos', coalesce((select jsonb_agg(jsonb_build_object('u',usuario_id,'curso',curso,
      'nota',nota,'correctas',correctas,'total',total,'fecha',fecha) order by fecha) from intentos),'[]'));
  elsif p_op = 'descargas_resumen' then
    return jsonb_build_object('descargas', coalesce((select jsonb_agg(jsonb_build_object('u',d.usuario_id,'nombre',x.nombre,
      'archivo',d.archivo,'curso',d.curso,'fecha',d.fecha) order by d.fecha desc)
      from (select * from descargas order by fecha desc limit 2000) d join usuarios x on x.id = d.usuario_id),'[]'));
  end if;
  return jsonb_build_object('error','operacion');
end $$;

revoke all on function hb_rpc(text,text,jsonb) from public;
revoke all on function hb_estado(text) from public;
grant execute on function hb_rpc(text,text,jsonb) to anon, authenticated;

-- ============ Datos iniciales ============
insert into usuarios(nombre,usuario,rol,clave_hash) values ('Yalidis Beltrán','yalidis','profesor',extensions.crypt('12345',extensions.gen_salt('bf'))) on conflict do nothing;
insert into usuarios(nombre,cedula,rol,clave_hash) values ('Luis Carlos de Arco','1047440371','estudiante',extensions.crypt('12345',extensions.gen_salt('bf'))) on conflict do nothing;
insert into matriculas select id, 'comunicacion' from usuarios where cedula='1047440371' on conflict do nothing;
insert into examenes(curso,visible,intentos) values ('comunicacion', true, 3) on conflict do nothing;
insert into matriculas select id, 'liderazgo' from usuarios where cedula='1047440371' on conflict do nothing;
insert into examenes(curso,visible,intentos) values ('liderazgo', true, 3) on conflict do nothing;
insert into matriculas select id, 'trabajo-en-equipo' from usuarios where cedula='1047440371' on conflict do nothing;
insert into examenes(curso,visible,intentos) values ('trabajo-en-equipo', true, 3) on conflict do nothing;
insert into matriculas select id, 'inteligencia-emocional' from usuarios where cedula='1047440371' on conflict do nothing;
insert into examenes(curso,visible,intentos) values ('inteligencia-emocional', true, 3) on conflict do nothing;
insert into matriculas select id, 'oratoria' from usuarios where cedula='1047440371' on conflict do nothing;
insert into examenes(curso,visible,intentos) values ('oratoria', true, 3) on conflict do nothing;
insert into matriculas select id, 'control-del-tiempo' from usuarios where cedula='1047440371' on conflict do nothing;
insert into examenes(curso,visible,intentos) values ('control-del-tiempo', true, 3) on conflict do nothing;
delete from preguntas;
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('comunicacion',1,'¿Cuál es un ejemplo de mensaje en primera persona?','["Tú nunca me escuchas", "Me siento ignorado cuando me interrumpen", "Todos saben que estás equivocado"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('comunicacion',2,'Una persona asertiva…','["Evita expresar lo que piensa", "Impone su opinión", "Expresa lo que piensa con respeto"]'::jsonb,2);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('comunicacion',3,'Parafrasear en la escucha activa sirve para…','["Confirmar que entendiste el mensaje", "Cambiar de tema", "Demostrar que tienes la razón"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('comunicacion',4,'Si alguien te critica injustamente, una respuesta asertiva es…','["Gritar para defenderte", "Expresar con calma tu punto de vista", "Quedarte callado y resentido"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('comunicacion',5,'La asertividad busca…','["Ganar la discusión", "Respetar tus derechos y los de los demás", "Evitar todo conflicto"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('liderazgo',1,'Delegar bien implica…','["Hacer todo uno mismo", "Explicar objetivo, plazo y recursos", "Revisar cada paso a cada momento"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('liderazgo',2,'Una buena retroalimentación incluye…','["Hechos concretos y una sugerencia", "Críticas generales", "Solo elogios"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('liderazgo',3,'El líder eficaz…','["Usa siempre el mismo estilo", "Adapta su estilo a la situación", "Evita tomar decisiones"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('liderazgo',4,'¿Qué caracteriza a un líder democrático?','["Decide solo", "Involucra al equipo en las decisiones", "No participa"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('liderazgo',5,'Para inspirar confianza, un líder debe…','["Ser coherente entre lo que dice y hace", "Prometer sin cumplir", "Evitar dar explicaciones"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('trabajo-en-equipo',1,'Definir roles en un equipo ayuda a…','["Evitar duplicidades y vacíos", "Que una sola persona decida todo", "Trabajar sin comunicarse"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('trabajo-en-equipo',2,'Ante un conflicto lo mejor es…','["Culpar a alguien", "Escuchar todas las posturas y buscar acuerdos", "Ignorarlo"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('trabajo-en-equipo',3,'Los acuerdos de equipo funcionan mejor cuando…','["Quedan por escrito", "Se dan por entendidos", "Los define una sola persona"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('trabajo-en-equipo',4,'Una ventaja del trabajo en equipo es…','["Combinar habilidades diferentes", "Que todos hagan lo mismo", "Evitar la comunicación"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('trabajo-en-equipo',5,'Cuando un compañero no cumple, lo más adecuado es…','["Hablar con él para entender y acordar", "Hacer su parte en silencio", "Reportarlo sin hablarle"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('inteligencia-emocional',1,'El primer paso para manejar una emoción es…','["Negarla", "Reconocerla y ponerle nombre", "Reaccionar de inmediato"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('inteligencia-emocional',2,'La empatía consiste en…','["Ver la situación desde el punto de vista del otro", "Dar siempre la razón", "Evitar hablar de emociones"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('inteligencia-emocional',3,'La autorregulación nos permite…','["Responder en lugar de reaccionar por impulso", "Ocultar lo que sentimos", "Evitar a las personas"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('inteligencia-emocional',4,'¿Cuál es un ejemplo de empatía?','["Escuchar y reconocer lo que siente el otro", "Ignorar sus emociones", "Dar órdenes"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('inteligencia-emocional',5,'Las emociones son…','["Información útil sobre lo que nos pasa", "Siempre un error", "Algo que se debe ocultar"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('oratoria',1,'Un buen discurso tiene…','["Solo desarrollo", "Inicio, desarrollo y cierre", "Muchas ideas sin orden"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('oratoria',2,'Las pausas al hablar sirven para…','["Dar énfasis a las ideas", "Mostrar nerviosismo", "Alargar el discurso"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('oratoria',3,'Para manejar el miedo escénico conviene…','["Improvisar todo", "Prepararse y respirar profundo", "Evitar mirar al público"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('oratoria',4,'Las muletillas al hablar en público…','["Conviene reducirlas para dar claridad", "Son recomendables", "No afectan nunca"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('oratoria',5,'El contacto visual con la audiencia sirve para…','["Generar conexión y confianza", "Distraer al público", "Leer mejor las diapositivas"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('control-del-tiempo',1,'En la técnica Pomodoro se trabaja…','["25 minutos y se descansa 5", "Cuatro horas seguidas", "Sin descansos"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('control-del-tiempo',2,'Para evitar procrastinar conviene…','["Esperar a tener ganas", "Dividir la tarea en pasos pequeños", "Hacer todo a la vez"]'::jsonb,1);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('control-del-tiempo',3,'Priorizar significa…','["Hacer primero lo importante", "Hacer lo más fácil siempre", "Dejar todo para el final"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('control-del-tiempo',4,'La matriz de Eisenhower clasifica las tareas según…','["Urgencia e importancia", "Color y tamaño", "Dificultad y precio"]'::jsonb,0);
insert into preguntas(curso,orden,enunciado,opciones,correcta) values ('control-del-tiempo',5,'Planificar la semana ayuda a…','["Reducir el estrés y priorizar", "Hacer menos actividades siempre", "Evitar descansar"]'::jsonb,0);
