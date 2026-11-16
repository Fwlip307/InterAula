import crypto from 'node:crypto';
export interface AdaptiveSkill {id:string;name:string;prerequisites:string[];description:string;lesson:string}
export interface PracticeExercise {id:string;skillId:string;templateId:string;prompt:string;options:{id:string;text:string}[];correctOptionId:string;explanation:string;hint:string}
export const COURSE_ID='calculo-piloto-v1';
export const DEFAULT_GOAL='chain';
export const adaptiveSkills:AdaptiveSkill[]=[
 {id:'equations',name:'Ecuaciones lineales',prerequisites:[],description:'Despejar una incógnita conservando la igualdad.',lesson:'Para despejar x, aplica la misma operación a ambos lados. Ejemplo: 2x + 6 = 12 → 2x = 6 → x = 3.'},
 {id:'powers',name:'Potencias',prerequisites:[],description:'Aplicar productos, cocientes y potencias de potencias.',lesson:'Para una misma base: xᵃ·xᵇ = xᵃ⁺ᵇ y (xᵃ)ᵇ = xᵃᵇ. Si divides, resta exponentes y exige que el denominador no sea cero.'},
 {id:'factoring',name:'Factorización',prerequisites:['powers'],description:'Reconocer factores comunes e identidades.',lesson:'Busca primero un factor común. Una diferencia de cuadrados se escribe a² − b² = (a − b)(a + b).'},
 {id:'functions',name:'Funciones',prerequisites:['equations'],description:'Evaluar funciones y reconocer restricciones de dominio.',lesson:'Evaluar f(a) significa sustituir x por a, incluyendo los paréntesis necesarios. En una fracción, el denominador no puede ser cero.'},
 {id:'limits',name:'Límites de polinomios',prerequisites:['functions','powers'],description:'Calcular límites por sustitución directa.',lesson:'Los polinomios son continuos: para hallar su límite en un punto, sustituye x por ese valor y calcula.'},
 {id:'indeterminate',name:'Límites con factorización',prerequisites:['limits','factoring'],description:'Resolver indeterminaciones 0/0 mediante simplificación.',lesson:'Si la sustitución produce 0/0, factoriza y simplifica para x distinto del punto. Después evalúa el límite de la expresión simplificada.'},
 {id:'definition',name:'Definición de derivada',prerequisites:['indeterminate'],description:'Interpretar el cociente incremental y su límite.',lesson:'La derivada se obtiene de f′(x) = lim h→0 [f(x+h) − f(x)]/h. Expande, simplifica y finalmente toma el límite.'},
 {id:'power-rule',name:'Regla de la potencia',prerequisites:['definition','powers'],description:'Derivar potencias, constantes y sumas.',lesson:'Para f(x)=xⁿ, f′(x)=n·xⁿ⁻¹. La derivada de una constante es 0. Deriva cada término de una suma por separado.'},
 {id:'chain',name:'Regla de la cadena',prerequisites:['power-rule','functions'],description:'Derivar una composición de funciones.',lesson:'Si f(x)=g(u(x)), entonces f′(x)=g′(u(x))·u′(x). Deriva la función exterior y multiplica por la derivada de la interior.'},
 {id:'optimization',name:'Optimización básica',prerequisites:['chain','equations'],description:'Encontrar puntos críticos y distinguir mínimos y máximos.',lesson:'En estos ejercicios sin restricciones adicionales, busca puntos donde f′(x)=0. Si f″ es positiva hay un mínimo local; si es negativa hay un máximo local.'},
];
type Seed=[string,string[],string,string]; // prompt, correct answer first, explanation, hint
const seeds:Record<string,Seed[]>={
 equations:[
 ['Resuelve 2x + 3 = 11. ¿Cuánto vale x?',['4','7','8','2'],'Resta 3 a ambos lados: 2x=8. Divide entre 2: x=4.','Primero elimina el término que se suma a 2x.'],
 ['Resuelve 3(x − 1) = 12.',['5','3','4','13'],'Divide entre 3: x−1=4. Suma 1: x=5.','Puedes dividir ambos lados por 3 antes de despejar.'],
 ['Resuelve x/4 + 2 = 5.',['12','3','7','20'],'Resta 2: x/4=3. Multiplica por 4: x=12.','Después de restar 2, deshaz la división entre 4.'],
 ['Resuelve −2x + 6 = 0.',['3','−3','6','−6'],'Resta 6: −2x=−6. Divide entre −2: x=3.','Conserva el signo del coeficiente al dividir.'],
 ],
 powers:[
 ['Simplifica x³ · x².',['x⁵','x⁶','2x³','x'],'En un producto de potencias de la misma base, se suman exponentes: 3+2=5.','Las bases son iguales; revisa qué operación se aplica a los exponentes.'],
 ['Para x ≠ 0, simplifica x⁴/x².',['x²','x⁶','x⁸','1/x²'],'En un cociente de la misma base, resta exponentes: 4−2=2.','Compara este cociente con la regla del producto.'],
 ['Simplifica (x²)³.',['x⁶','x⁵','3x²','x⁸'],'En una potencia de potencia se multiplican exponentes: 2·3=6.','Piensa en x² multiplicado por sí mismo tres veces.'],
 ['Para x ≠ 0, ¿a qué equivale x⁻²?',['1/x²','−x²','1/(2x)','x²'],'Un exponente negativo representa el recíproco: x⁻²=1/x².','Un exponente negativo no significa cambiar el signo del resultado.'],
 ],
 factoring:[
 ['Factoriza x² − 9.',['(x − 3)(x + 3)','(x − 9)(x + 1)','(x − 3)²','x(x − 9)'],'Es una diferencia de cuadrados: x²−3²=(x−3)(x+3).','Identifica si ambos términos son cuadrados.'],
 ['Factoriza x² + 5x + 6.',['(x + 2)(x + 3)','(x + 1)(x + 6)','(x − 2)(x − 3)','x(x + 5)'],'2 y 3 suman 5 y multiplican 6.','Busca dos números con producto 6 y suma 5.'],
 ['Extrae el factor común de x² − 4x.',['x(x − 4)','x(x + 4)','(x − 2)²','(x − 4)²'],'Ambos términos contienen x; al extraerla queda x(x−4).','¿Qué factor aparece en los dos términos?'],
 ['Factoriza x² − 2x + 1.',['(x − 1)²','(x + 1)²','(x − 2)(x + 1)','x(x − 2)'],'Es el cuadrado de una diferencia: (x−1)²=x²−2x+1.','Compara con (a−b)²=a²−2ab+b².'],
 ],
 functions:[
 ['Si f(x)=2x+1, calcula f(3).',['7','6','4','9'],'Sustituye x por 3: 2·3+1=7.','Sustituye el argumento en todos los lugares donde aparece x.'],
 ['Si f(x)=x², calcula f(−2).',['4','−4','−2','2'],'Al sustituir debes conservar los paréntesis: (−2)²=4.','Eleva al cuadrado el valor completo, incluyendo su signo.'],
 ['¿Qué valor se excluye del dominio real de f(x)=1/(x−2)?',['2','0','−2','1'],'x=2 hace cero el denominador y se excluye.','Una división por cero no está definida.'],
 ['Si f(x)=3x−2, ¿cuál es f(x+1)?',['3x+1','3x−1','3x−2','4x−2'],'Sustituye el argumento completo: 3(x+1)−2=3x+1.','Coloca x+1 entre paréntesis antes de multiplicar.'],
 ],
 limits:[
 ['Calcula lim x→2 (x² + 1).',['5','4','3','2'],'Al ser un polinomio, se sustituye directamente: 2²+1=5.','Puedes sustituir el punto en un polinomio.'],
 ['Calcula lim x→−1 (3x + 2).',['−1','1','−5','5'],'3·(−1)+2=−1.','Conserva el signo negativo al sustituir.'],
 ['Calcula lim x→0 (x³ + 2).',['2','0','3','1'],'Sustituye x=0: 0³+2=2.','Se trata de un polinomio continuo.'],
 ['Calcula lim x→3 (x² − x).',['6','9','3','12'],'3²−3=9−3=6.','Evalúa ambos términos en el mismo punto.'],
 ],
 indeterminate:[
 ['Calcula lim x→1 (x²−1)/(x−1).',['2','0','1','No existe'],'Para x≠1, factoriza y simplifica a x+1. El límite es 2.','Factoriza el numerador como diferencia de cuadrados.'],
 ['Calcula lim x→2 (x²−4)/(x−2).',['4','2','0','No existe'],'x²−4=(x−2)(x+2). Simplifica y evalúa x+2 en 2: 4.','No confundas el valor indefinido de la fracción con su límite.'],
 ['Calcula lim x→3 (x²−9)/(x−3).',['6','3','9','0'],'Para x≠3, la expresión se simplifica a x+3. Su límite es 6.','Identifica un factor común entre numerador y denominador.'],
 ['Calcula lim x→0 (x²+x)/x.',['1','0','2','No existe'],'Para x≠0, x(x+1)/x=x+1; el límite es 1.','Extrae x como factor común.'],
 ],
 definition:[
 ['Si f(x)=x², ¿cuál es f(x+h)−f(x)?',['2xh+h²','h²','2x+h','2xh'],'(x+h)²−x²=x²+2xh+h²−x²=2xh+h².','Expande el cuadrado de la suma antes de restar.'],
 ['Para f(x)=x² y h≠0, simplifica [f(x+h)−f(x)]/h.',['2x+h','2x','h','x²+h²'],'El numerador es 2xh+h². Divide cada término por h: 2x+h.','Factoriza h en el numerador antes de cancelar.'],
 ['Calcula lim h→0 (2x+h), considerando x fijo.',['2x','0','x','2h'],'Solo h tiende a cero, por lo que queda 2x.','Distingue la variable que tiende a cero del parámetro que permanece fijo.'],
 ['Usando el cociente incremental, ¿cuál es la derivada de f(x)=3x+2?',['3','2','3x','0'],'[3(x+h)+2−(3x+2)]/h=3h/h=3.','Los términos que no dependen de h se cancelan al restar.'],
 ],
 'power-rule':[
 ['Deriva f(x)=x⁵.',['5x⁴','x⁴','5x⁵','4x⁵'],'Multiplica por el exponente 5 y réstale uno: 5x⁴.','Aplica d(xⁿ)/dx=n·xⁿ⁻¹.'],
 ['Deriva f(x)=3x³−2x.',['9x²−2','3x²−2','9x²−2x','6x²'],'Deriva término a término: 3·3x²−2=9x²−2.','Conserva los coeficientes al aplicar la regla.'],
 ['¿Cuál es la derivada de la función constante f(x)=7?',['0','7','1','7x'],'Una función constante no cambia con x; su derivada es 0.','Piensa en la pendiente de una recta horizontal.'],
 ['Para x≠0, deriva f(x)=x⁻¹.',['−1/x²','1/x²','−x','1/x'],'La regla da −x⁻², equivalente a −1/x².','La regla de la potencia también se aplica a exponentes negativos en su dominio.'],
 ],
 chain:[
 ['Deriva f(x)=(2x+1)³.',['6(2x+1)²','3(2x+1)²','6x²','(2x+1)²'],'Deriva la exterior y multiplica por la interior: 3(2x+1)²·2.','Recuerda multiplicar por la derivada de 2x+1.'],
 ['Deriva f(x)=(x²+1)².',['4x(x²+1)','2(x²+1)','4x','2x²+2'],'La exterior aporta 2(x²+1) y la interior 2x: 4x(x²+1).','Hay una función elevada al cuadrado que a su vez depende de x.'],
 ['Para 3x+1>0, deriva f(x)=√(3x+1).',['3/(2√(3x+1))','1/(2√(3x+1))','3√(3x+1)','1/√(3x+1)'],'La derivada de √u es u′/(2√u), con u′=3.','Considera la raíz como una potencia de exponente 1/2.'],
 ['Deriva f(x)=(5−x)².',['−2(5−x)','2(5−x)','−2x','10−x'],'La exterior da 2(5−x) y la interior −1; el resultado es −2(5−x).','La derivada de la función interior puede ser negativa.'],
 ],
 optimization:[
 ['Para A(x)=x(10−x), ¿en qué valor se anula A′(x)?',['5','10','0','2'],'A=10x−x² y A′=10−2x; se anula en x=5.','Expande el producto antes de derivar.'],
 ['Para f(x)=x²−4x, ¿dónde se ubica su mínimo?',['x=2','x=4','x=−2','x=0'],'f′=2x−4 se anula en 2; f″=2>0 confirma el mínimo.','Encuentra el punto crítico y revisa la segunda derivada.'],
 ['Para R(x)=x(20−2x), ¿en qué valor se anula R′(x)?',['5','10','20','4'],'R=20x−2x² y R′=20−4x; el punto crítico es x=5.','Deriva después de distribuir x.'],
 ['¿Dónde tiene su máximo f(x)=−x²+6x?',['x=3','x=6','x=−3','x=0'],'f′=−2x+6 se anula en 3; f″=−2<0 confirma el máximo.','El signo de la segunda derivada distingue máximo de mínimo.'],
 ],
};
export const exerciseTemplates=adaptiveSkills.flatMap(skill=>(seeds[skill.id]||[]).map((seed,index)=>({
 id:skill.id+'-'+(index+1),skillId:skill.id,prompt:seed[0],answers:seed[1],explanation:seed[2],hint:seed[3],
})));
export function createPracticeExercise(skillId:string,recentTemplateIds:string[]=[]):PracticeExercise {
 const all=exerciseTemplates.filter(e=>e.skillId===skillId);
 if(!all.length)throw new Error('Concepto sin ejercicios');
 const unseen=all.filter(e=>!recentTemplateIds.includes(e.id));
 const pool=unseen.length?unseen:all.filter(e=>e.id!==recentTemplateIds[0]);
 const chosen=pool[crypto.randomInt(pool.length)];
 const shuffled=chosen.answers.map((text,index)=>({text,correct:index===0}));
 for(let i=shuffled.length-1;i>0;i--){const j=crypto.randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const options=shuffled.map((answer,index)=>({id:String.fromCharCode(97+index),text:answer.text}));
 return {id:crypto.randomUUID(),skillId,templateId:chosen.id,prompt:chosen.prompt,options,correctOptionId:options[shuffled.findIndex(a=>a.correct)].id,explanation:chosen.explanation,hint:chosen.hint};
}

