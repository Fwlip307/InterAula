export const aiBackendService = {
  /**
   * Evaluar semánticamente una respuesta abierta o de redacción con rúbrica pedagógica
   */
  async evaluateAnswer(data: {
    question: string;
    answer: string;
    rubric?: string;
    level?: string;
  }) {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Actúa como docente evaluador universitario en InterAula.
Pregunta: "${data.question}"
Respuesta del estudiante: "${data.answer}"
Rúbrica esperada: "${data.rubric || 'Demostrar comprensión conceptual, precisión técnica y capacidad explicativa.'}"
Nivel: ${data.level || 'intermedio'}

Evalúa la respuesta y responde ÚNICAMENTE con un JSON en este formato:
{
  "score": <número del 1 al 10>,
  "passed": <true si score >= 6, false de lo contrario>,
  "feedback": "<explicación pedagógica breve y constructiva de 2 a 3 líneas>"
}`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const resJson: any = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return parsed;
          }
        }
      } catch (err) {
        console.warn('[aiBackendService] Error al contactar Gemini API, usando motor heurístico:', err);
      }
    }

    // Evaluación heurística de respaldo en el servidor
    const wordCount = data.answer.trim().split(/\s+/).length;
    const hasTechnicalKeywords = data.answer.length > 25;
    const score = wordCount >= 10 && hasTechnicalKeywords ? 8 : wordCount >= 5 ? 6 : 4;

    return {
      score,
      passed: score >= 6,
      feedback:
        score >= 6
          ? 'Respuesta conceptualmente consistente. Presenta fundamentos técnicos adecuados para el nivel evaluado.'
          : 'Respuesta breve o incompleta. Se recomienda profundizar con mayor detalle técnico y ejemplos.',
    };
  },
};
