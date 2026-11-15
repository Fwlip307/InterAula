import {BUSINESS_RULES} from '../constants/businessRules';
import type {CreateTutoringReviewDTO} from '../types/tutoring';

/** Preserve the three independent scores; the database calculates the average. */
export function tutoringReviewPayload(dto:CreateTutoringReviewDTO){
 const {MIN,MAX}=BUSINESS_RULES.TUTORING.RATING;
 const scores=[dto.communication_score,dto.knowledge_score,dto.punctuality_score];
 if(scores.some(score=>!Number.isInteger(score)||score<MIN||score>MAX))throw Error(`Elige una calificación entera entre ${MIN} y ${MAX} para cada criterio.`);
 const comment=dto.comment?.trim()||null;
 if(comment&&comment.length>1000)throw Error('El comentario no puede superar 1000 caracteres.');
 return {communication_score:dto.communication_score,knowledge_score:dto.knowledge_score,punctuality_score:dto.punctuality_score,comment};
}
