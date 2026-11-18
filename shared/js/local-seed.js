// Solo para el modo local. Bórralo al pasar a Supabase (las respuestas correctas viven en la base de datos).
window.HB_SEED = {
 "usuarios": [
  {
   "id": "u-yalidis",
   "nombre": "Yalidis Beltrán",
   "usuario": "yalidis",
   "rol": "profesor",
   "clave": "12345"
  },
  {
   "id": "u-luis",
   "nombre": "Luis Carlos de Arco",
   "cedula": "1047440371",
   "rol": "estudiante",
   "clave": "12345",
   "cursos": [
    "comunicacion",
    "liderazgo",
    "trabajo-en-equipo",
    "inteligencia-emocional",
    "oratoria",
    "control-del-tiempo"
   ]
  }
 ],
 "preguntas": {
  "comunicacion": [
   {
    "q": "¿Cuál es un ejemplo de mensaje en primera persona?",
    "o": [
     "Tú nunca me escuchas",
     "Me siento ignorado cuando me interrumpen",
     "Todos saben que estás equivocado"
    ],
    "ok": 1
   },
   {
    "q": "Una persona asertiva…",
    "o": [
     "Evita expresar lo que piensa",
     "Impone su opinión",
     "Expresa lo que piensa con respeto"
    ],
    "ok": 2
   },
   {
    "q": "Parafrasear en la escucha activa sirve para…",
    "o": [
     "Confirmar que entendiste el mensaje",
     "Cambiar de tema",
     "Demostrar que tienes la razón"
    ],
    "ok": 0
   },
   {
    "q": "Si alguien te critica injustamente, una respuesta asertiva es…",
    "o": [
     "Gritar para defenderte",
     "Expresar con calma tu punto de vista",
     "Quedarte callado y resentido"
    ],
    "ok": 1
   },
   {
    "q": "La asertividad busca…",
    "o": [
     "Ganar la discusión",
     "Respetar tus derechos y los de los demás",
     "Evitar todo conflicto"
    ],
    "ok": 1
   }
  ],
  "liderazgo": [
   {
    "q": "Delegar bien implica…",
    "o": [
     "Hacer todo uno mismo",
     "Explicar objetivo, plazo y recursos",
     "Revisar cada paso a cada momento"
    ],
    "ok": 1
   },
   {
    "q": "Una buena retroalimentación incluye…",
    "o": [
     "Hechos concretos y una sugerencia",
     "Críticas generales",
     "Solo elogios"
    ],
    "ok": 0
   },
   {
    "q": "El líder eficaz…",
    "o": [
     "Usa siempre el mismo estilo",
     "Adapta su estilo a la situación",
     "Evita tomar decisiones"
    ],
    "ok": 1
   },
   {
    "q": "¿Qué caracteriza a un líder democrático?",
    "o": [
     "Decide solo",
     "Involucra al equipo en las decisiones",
     "No participa"
    ],
    "ok": 1
   },
   {
    "q": "Para inspirar confianza, un líder debe…",
    "o": [
     "Ser coherente entre lo que dice y hace",
     "Prometer sin cumplir",
     "Evitar dar explicaciones"
    ],
    "ok": 0
   }
  ],
  "trabajo-en-equipo": [
   {
    "q": "Definir roles en un equipo ayuda a…",
    "o": [
     "Evitar duplicidades y vacíos",
     "Que una sola persona decida todo",
     "Trabajar sin comunicarse"
    ],
    "ok": 0
   },
   {
    "q": "Ante un conflicto lo mejor es…",
    "o": [
     "Culpar a alguien",
     "Escuchar todas las posturas y buscar acuerdos",
     "Ignorarlo"
    ],
    "ok": 1
   },
   {
    "q": "Los acuerdos de equipo funcionan mejor cuando…",
    "o": [
     "Quedan por escrito",
     "Se dan por entendidos",
     "Los define una sola persona"
    ],
    "ok": 0
   },
   {
    "q": "Una ventaja del trabajo en equipo es…",
    "o": [
     "Combinar habilidades diferentes",
     "Que todos hagan lo mismo",
     "Evitar la comunicación"
    ],
    "ok": 0
   },
   {
    "q": "Cuando un compañero no cumple, lo más adecuado es…",
    "o": [
     "Hablar con él para entender y acordar",
     "Hacer su parte en silencio",
     "Reportarlo sin hablarle"
    ],
    "ok": 0
   }
  ],
  "inteligencia-emocional": [
   {
    "q": "El primer paso para manejar una emoción es…",
    "o": [
     "Negarla",
     "Reconocerla y ponerle nombre",
     "Reaccionar de inmediato"
    ],
    "ok": 1
   },
   {
    "q": "La empatía consiste en…",
    "o": [
     "Ver la situación desde el punto de vista del otro",
     "Dar siempre la razón",
     "Evitar hablar de emociones"
    ],
    "ok": 0
   },
   {
    "q": "La autorregulación nos permite…",
    "o": [
     "Responder en lugar de reaccionar por impulso",
     "Ocultar lo que sentimos",
     "Evitar a las personas"
    ],
    "ok": 0
   },
   {
    "q": "¿Cuál es un ejemplo de empatía?",
    "o": [
     "Escuchar y reconocer lo que siente el otro",
     "Ignorar sus emociones",
     "Dar órdenes"
    ],
    "ok": 0
   },
   {
    "q": "Las emociones son…",
    "o": [
     "Información útil sobre lo que nos pasa",
     "Siempre un error",
     "Algo que se debe ocultar"
    ],
    "ok": 0
   }
  ],
  "oratoria": [
   {
    "q": "Un buen discurso tiene…",
    "o": [
     "Solo desarrollo",
     "Inicio, desarrollo y cierre",
     "Muchas ideas sin orden"
    ],
    "ok": 1
   },
   {
    "q": "Las pausas al hablar sirven para…",
    "o": [
     "Dar énfasis a las ideas",
     "Mostrar nerviosismo",
     "Alargar el discurso"
    ],
    "ok": 0
   },
   {
    "q": "Para manejar el miedo escénico conviene…",
    "o": [
     "Improvisar todo",
     "Prepararse y respirar profundo",
     "Evitar mirar al público"
    ],
    "ok": 1
   },
   {
    "q": "Las muletillas al hablar en público…",
    "o": [
     "Conviene reducirlas para dar claridad",
     "Son recomendables",
     "No afectan nunca"
    ],
    "ok": 0
   },
   {
    "q": "El contacto visual con la audiencia sirve para…",
    "o": [
     "Generar conexión y confianza",
     "Distraer al público",
     "Leer mejor las diapositivas"
    ],
    "ok": 0
   }
  ],
  "control-del-tiempo": [
   {
    "q": "En la técnica Pomodoro se trabaja…",
    "o": [
     "25 minutos y se descansa 5",
     "Cuatro horas seguidas",
     "Sin descansos"
    ],
    "ok": 0
   },
   {
    "q": "Para evitar procrastinar conviene…",
    "o": [
     "Esperar a tener ganas",
     "Dividir la tarea en pasos pequeños",
     "Hacer todo a la vez"
    ],
    "ok": 1
   },
   {
    "q": "Priorizar significa…",
    "o": [
     "Hacer primero lo importante",
     "Hacer lo más fácil siempre",
     "Dejar todo para el final"
    ],
    "ok": 0
   },
   {
    "q": "La matriz de Eisenhower clasifica las tareas según…",
    "o": [
     "Urgencia e importancia",
     "Color y tamaño",
     "Dificultad y precio"
    ],
    "ok": 0
   },
   {
    "q": "Planificar la semana ayuda a…",
    "o": [
     "Reducir el estrés y priorizar",
     "Hacer menos actividades siempre",
     "Evitar descansar"
    ],
    "ok": 0
   }
  ]
 }
};
